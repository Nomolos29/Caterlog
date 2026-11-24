import http from "node:http";
import { existsSync } from "node:fs";
import { URL } from "node:url";
import { formatNaira, nairaToKobo, parseVendorWhatsAppCommand } from "@caterlog/commerce-core";
import { isTerritoryDeliverable } from "@caterlog/shared";
import { CaterlogStage1Engine } from "./runtime-engine.ts";
import type { StaffPermissionKey, VendorSession } from "./runtime-types.ts";
import { createEngineFromEnv } from "./bootstrap.ts";
import { renderDynamicProductOgSvg } from "./og-card.ts";
import { mediaStore } from "./media/media-store.ts";
import {
  checkNeonAuthStatus,
  checkNeonPostgresPool,
  downloadObjectFromNeonBucket,
  getNeonBucketPresignedUrl,
  invokeNeonFunction,
  resolveNeonFunctionUrl,
  sealNeonLiveQuery,
  uploadObjectToNeonBucket,
  verifyNeonAuthToken,
} from "./neon/services.ts";

// Load a local `.env` when present so `npm run dev` / `npm start` pick up
// WhatsApp & Monnify credentials without requiring a manual `export`.
const envFile = ".env";
if (existsSync(envFile) && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(envFile);
  } catch (err) {
    console.warn(`Could not load ${envFile}:`, err);
  }
}

export class HttpError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function getSessionToken(req: http.IncomingMessage): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/caterlog_session=([^;]+)/);
    if (match) return match[1].trim();
  }
  return null;
}

export function requireVendorSession(
  engine: CaterlogStage1Engine,
  req: http.IncomingMessage,
  requiredPermission?: StaffPermissionKey,
  actionLabel?: string
): VendorSession {
  const token = getSessionToken(req);
  if (!token) {
    throw new HttpError(401, "Authentication required. Please sign in to access vendor operations.");
  }
  const session = engine.authenticateVendorSession(token);
  if (!session) {
    throw new HttpError(401, "Invalid or expired session. Please sign in again.");
  }
  if (requiredPermission) {
    checkSessionPermission(session, requiredPermission, actionLabel);
  }
  return session;
}

function checkSessionPermission(
  session: Pick<VendorSession, "staffRole" | "isOwner" | "permissions">,
  permission: StaffPermissionKey,
  actionLabel = "this operation"
): void {
  if (session.isOwner) return;
  if (permission === "ownerOnly") {
    throw new HttpError(
      403,
      `Access denied (${session.staffRole}): Only the Store Owner can perform ${actionLabel}.`
    );
  }
  if (!session.permissions[permission]) {
    throw new HttpError(
      403,
      `Access denied (${session.staffRole}): Your staff role does not have "${permission}" permission to perform ${actionLabel}.`
    );
  }
}

/**
 * RBAC Auth Middleware:
 * When a request carries a staff session token (`Authorization: Bearer <token>` or `caterlog_session`)
 * or an explicit staff identity header (`x-caterlog-staff-email`), verifies the staff member is active
 * and enforces the required role-based permission (`canManageOrders`, `canManageInventory`, etc.).
 */
export function enforceStaffPermission(
  engine: CaterlogStage1Engine,
  req: http.IncomingMessage,
  permission: StaffPermissionKey,
  actionLabel = "this operation"
): VendorSession | null {
  const token = getSessionToken(req);
  if (token) {
    const session = engine.authenticateVendorSession(token);
    if (!session) {
      throw new HttpError(401, "Invalid, expired, or suspended staff session. Please sign in again.");
    }
    checkSessionPermission(session, permission, actionLabel);
    return session;
  }

  const staffEmailHeader = req.headers["x-caterlog-staff-email"];
  const staffEmail = Array.isArray(staffEmailHeader) ? staffEmailHeader[0] : staffEmailHeader;
  if (staffEmail && staffEmail.trim()) {
    const cleanEmail = staffEmail.trim().toLowerCase();
    const member = engine.teamMembers.find(
      (m) => m.email.toLowerCase() === cleanEmail || m.id.toLowerCase() === cleanEmail
    );
    if (!member) {
      throw new HttpError(401, `Unknown staff member "${staffEmail}".`);
    }
    if (member.status === "Suspended") {
      throw new HttpError(403, `Staff account "${member.email}" has been suspended.`);
    }
    const isOwner = member.role === "Owner";
    checkSessionPermission(
      {
        staffRole: member.role,
        isOwner,
        permissions: {
          canManageOrders: isOwner ? true : member.canManageOrders,
          canManageInventory: isOwner ? true : member.canManageInventory,
          canViewPayouts: isOwner ? true : member.canViewPayouts,
          canProcessRefunds: isOwner ? true : member.canProcessRefunds,
          canOverrideCopilot: isOwner ? true : member.canOverrideCopilot,
        },
      },
      permission,
      actionLabel
    );
  }

  return null;
}

function resolveRouteRbacPermission(
  method: string | undefined,
  path: string
): { permission: StaffPermissionKey; label: string } | null {
  const m = (method || "GET").toUpperCase();
  if (
    m === "GET" &&
    (path === "/api/v1/vendor/state" ||
      path === "/api/v1/vendor/analytics" ||
      path.startsWith("/api/v1/vendor/network/suppliers") ||
      path === "/api/v1/vendor/market-boost/pricing")
  ) {
    return null;
  }
  if (path === "/api/v1/vendor/sync" || path === "/api/v1/vendor/notifications/sync") {
    return null;
  }

  // 1. Owner-Only Administration (Team management, Bank linking, Withdrawals, Secure Settings, Subscriptions)
  if (
    path.startsWith("/api/v1/vendor/team") ||
    path.startsWith("/api/v1/vendor/bank") ||
    path === "/api/v1/vendor/withdraw" ||
    path === "/api/v1/vendor/settings/secure" ||
    path.startsWith("/api/v1/vendor/subscription") ||
    path.startsWith("/api/v1/vendor/kyc") ||
    path.startsWith("/api/v1/vendor/trust-tier")
  ) {
    return { permission: "ownerOnly", label: "Store Owner administration & payout security" };
  }

  // 2. Customer Refunds (canProcessRefunds)
  if (path.startsWith("/api/v1/vendor/orders/") && path.endsWith("/refund")) {
    return { permission: "canProcessRefunds", label: "instant customer refund" };
  }

  // 3. Order Fulfillment & Dispatch (canManageOrders)
  if (
    path.startsWith("/api/v1/vendor/orders/") ||
    path.startsWith("/api/v1/vendor/shipping-zones")
  ) {
    return { permission: "canManageOrders", label: "order fulfillment & dispatch" };
  }

  // 4. Catalog, Inventory, Discounts, Storefront & Wholesale Mirroring (canManageInventory)
  if (
    path.startsWith("/api/v1/vendor/products") ||
    path.startsWith("/api/v1/vendor/discounts") ||
    path.startsWith("/api/v1/vendor/market-boost") ||
    path.startsWith("/api/v1/vendor/network/mirror") ||
    (path.startsWith("/api/v1/vendor/storefront") && m !== "GET")
  ) {
    return { permission: "canManageInventory", label: "catalog & inventory management" };
  }

  // 5. Payouts, Payment Links & Split Rules (canViewPayouts)
  if (
    path.startsWith("/api/v1/vendor/payment-links") ||
    path.startsWith("/api/v1/vendor/split-rules")
  ) {
    return { permission: "canViewPayouts", label: "payment links & settlement split configuration" };
  }

  // 6. Co-Pilot & General Settings (canOverrideCopilot)
  if (path === "/api/v1/vendor/settings") {
    return { permission: "canOverrideCopilot", label: "WhatsApp Co-Pilot & store settings" };
  }

  return null;
}

export function createCaterlogApiServer(engine = new CaterlogStage1Engine()) {
  const sseClients = new Set<http.ServerResponse>();

  // Broadcast live state updates over Server-Sent Events (SSE) to connected Web Dashboards
  engine.eventBus.on("*", () => {
    const payload = `data: ${JSON.stringify(
      engine.serializeState(),
      (_k, v) => (typeof v === "bigint" ? v.toString() : v)
    )}\n\n`;
    for (const res of sseClients) {
      res.write(payload);
    }
  });

  const server = http.createServer(async (req, res) => {
    // Enable CORS for Web Dashboard
    const reqOrigin = req.headers.origin;
    if (reqOrigin) {
      res.setHeader("Access-Control-Allow-Origin", reqOrigin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PATCH, PUT, DELETE, OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, x-caterlog-staff-email, monnify-signature, x-hub-signature-256, x-ship-signature"
    );

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const path = url.pathname;

    try {
      // 0. Redirect the API root to the Next.js Vendor Dashboard
      if (req.method === "GET" && (path === "/" || path === "/dashboard")) {
        const dashboardUrl = process.env.DASHBOARD_URL ?? "http://localhost:3000";
        res.writeHead(302, { Location: dashboardUrl });
        res.end();
        return;
      }

      // 1. Health Check
      if (req.method === "GET" && path === "/health") {
        return sendJson(res, 200, {
          status: "ok",
          stage: "Stage 1 — Chat Commerce Core",
          dataMode: engine.getDataMode(),
          jobs: engine.getJobScheduler()?.getStatus() ?? {
            mode: "off",
            running: false,
            queue: null,
            pending: null,
          },
          persistenceErrors: engine.getPersistenceErrors(),
          integrations: {
            monnify: engine.monnify.getMode(),
            whatsapp: engine.whatsapp.getMode(),
            catalog: engine.catalog.getMode(),
          },
        });
      }

      // 1b. Integration Modes & Credential Readiness (redacted)
      if (req.method === "GET" && path === "/api/v1/integrations/status") {
        return sendJson(res, 200, {
          integrations: engine.getIntegrationStatus(),
          catalogSync: {
            mode: engine.catalog.getMode(),
            lastSyncedAt: engine.catalog.getIntegrationStatus().lastSyncedAt,
            publishedItems: engine.catalog.getIntegrationStatus().publishedItems,
          },
        });
      }

      // 1b-neon. Neon Services Status & Endpoints (Postgres, Auth, Object Storage, Functions, Realtime)
      if (req.method === "GET" && path === "/api/v1/neon/status") {
        const [postgres, auth] = await Promise.all([
          checkNeonPostgresPool().catch((err) => ({
            connected: false,
            error: err instanceof Error ? err.message : String(err),
          })),
          checkNeonAuthStatus(),
        ]);
        return sendJson(res, 200, {
          branch: process.env.NEON_BRANCH ?? null,
          branchId: process.env.NEON_BRANCH_ID ?? null,
          dataMode: engine.getDataMode(),
          postgres,
          auth,
          objectStorage: {
            configured: Boolean(
              process.env.AWS_ENDPOINT_URL_S3 &&
                process.env.AWS_ACCESS_KEY_ID &&
                process.env.AWS_SECRET_ACCESS_KEY
            ),
            endpoint: process.env.AWS_ENDPOINT_URL_S3 ?? null,
            region: process.env.AWS_REGION ?? null,
            bucket: process.env.NEON_STORAGE_BUCKET || "assets",
          },
          functions: {
            configured: Boolean(resolveNeonFunctionUrl("hello")),
            helloUrl: resolveNeonFunctionUrl("hello"),
          },
          realtime: {
            configured: Boolean(
              process.env.NEON_REALTIME_URL && process.env.NEON_REALTIME_SECRET
            ),
            url: process.env.NEON_REALTIME_URL ?? null,
          },
        });
      }

      if (path === "/api/v1/neon/storage") {
        if (req.method === "POST") {
          const rawBody = await readRawBody(req);
          const body = (rawBody ? JSON.parse(rawBody) : {}) as {
            key?: string;
            content?: string;
            base64?: string;
            contentType?: string;
            bucket?: string;
          };
          const key = (body.key ?? `uploads/test-${Date.now()}.txt`).trim();
          const payloadBuffer = body.base64
            ? Buffer.from(body.base64, "base64")
            : Buffer.from(body.content ?? "Caterlog Neon Object Storage payload", "utf8");
          const uploaded = await uploadObjectToNeonBucket({
            key,
            body: payloadBuffer,
            contentType: body.contentType ?? "text/plain",
            bucket: body.bucket,
          });
          if (!uploaded) {
            throw new HttpError(503, "Neon Object Storage is not configured in environment.");
          }
          return sendJson(res, 201, {
            ok: true,
            ...uploaded,
            bytes: payloadBuffer.byteLength,
          });
        }
        if (req.method === "GET") {
          const key = url.searchParams.get("key");
          if (!key) {
            throw new HttpError(400, "Query parameter ?key= is required.");
          }
          const downloaded = await downloadObjectFromNeonBucket(key);
          if (!downloaded) {
            throw new HttpError(404, `Object "${key}" not found in Neon Object Storage.`);
          }
          const presignedUrl = await getNeonBucketPresignedUrl(key, 3600);
          return sendJson(res, 200, {
            ok: true,
            key,
            bytes: downloaded.byteLength,
            text: downloaded.toString("utf8"),
            presignedUrl,
          });
        }
      }

      if (
        (req.method === "POST" || req.method === "GET") &&
        path === "/api/v1/neon/realtime/seal"
      ) {
        let kind: "orders" | "products" = "orders";
        let vendorSlug = engine.vendor.slug;
        if (req.method === "POST") {
          const rawBody = await readRawBody(req);
          const body = (rawBody ? JSON.parse(rawBody) : {}) as {
            kind?: "orders" | "products";
            table?: "orders" | "products";
            vendorSlug?: string;
          };
          if (body.kind === "products" || body.table === "products") kind = "products";
          if (body.vendorSlug?.trim()) vendorSlug = body.vendorSlug.trim();
        } else {
          if (
            url.searchParams.get("kind") === "products" ||
            url.searchParams.get("table") === "products"
          ) {
            kind = "products";
          }
          const qsVendor = url.searchParams.get("vendorSlug");
          if (qsVendor?.trim()) vendorSlug = qsVendor.trim();
        }
        const sealed = await sealNeonLiveQuery(kind, vendorSlug);
        return sendJson(res, 200, {
          ok: true,
          ...sealed,
          table: sealed.kind,
          vendorId: engine.vendor.id,
          sealed: sealed.sealedQuery,
        });
      }

      if (req.method === "GET" && path === "/api/v1/neon/functions/hello") {
        const format = url.searchParams.get("format") === "text" ? "/" : "/status?format=json";
        const result = await invokeNeonFunction("hello", format);
        return sendJson(res, 200, {
          ok: result.status >= 200 && result.status < 300,
          ...result,
        });
      }

      if (req.method === "GET" && path === "/api/v1/neon/auth/status") {
        const authStatus = await checkNeonAuthStatus();
        return sendJson(res, 200, { ok: authStatus.configured, ...authStatus });
      }

      if (req.method === "POST" && path === "/api/v1/neon/auth/verify") {
        const authHeader = req.headers.authorization;
        const rawBody = await readRawBody(req);
        const body = (rawBody ? JSON.parse(rawBody) : {}) as { token?: string };
        const token = authHeader?.toLowerCase().startsWith("bearer ")
          ? authHeader.slice(7).trim()
          : body.token?.trim();
        if (!token) {
          throw new HttpError(401, "Missing Bearer token.");
        }
        const verified = await verifyNeonAuthToken(token);
        if (!verified) {
          throw new HttpError(401, "Invalid or expired Neon Auth JWT.");
        }
        return sendJson(res, 200, {
          ok: true,
          userId: verified.userId,
          claims: verified.payload,
        });
      }

      // 1c. Vendor WhatsApp 6-Digit OTP / Magic Link Request (`POST /api/v1/auth/whatsapp-otp` or `POST /api/v1/auth/request-otp`)
      if (req.method === "POST" && (path === "/api/v1/auth/whatsapp-otp" || path === "/api/v1/auth/request-otp")) {
        const rawBody = await readRawBody(req);
        const body = (rawBody ? JSON.parse(rawBody) : {}) as {
          phone?: string;
          vendorSlug?: string;
          purpose?: "LOGIN" | "SIGNUP" | "WITHDRAWAL" | "SETTINGS";
        };
        const normalizedInput = body.phone ? engine.normalizeOtpPhone(body.phone) : "";
        const normalizedVendor = engine.normalizeOtpPhone(engine.vendor.whatsappPhone);
        const inputSlug = body.vendorSlug?.trim().toLowerCase();

        const isKnownVendor =
          (!normalizedInput || normalizedInput === normalizedVendor || normalizedInput === "+2348031234567") &&
          (!inputSlug || inputSlug === engine.vendor.slug.toLowerCase());

        let targetPhone = normalizedVendor;
        if (!isKnownVendor) {
          if (!normalizedInput) {
            throw new HttpError(400, "Please provide your WhatsApp phone number.");
          }
          targetPhone = normalizedInput;
        }

        const purpose = body.purpose || "LOGIN";
        const generatedCode = engine.generateOtp(targetPhone, purpose);

        const masked = targetPhone.replace(
          /(\+\d{3})\d+(\d{4})/,
          "$1****$2"
        );
        return sendJson(res, 200, {
          status: "sent",
          destinationPhone: masked,
          purpose,
          expiresInSeconds: 600,
          isNewVendor: !isKnownVendor,
          ...(engine.whatsapp.getMode() === "mock" ? { devCode: generatedCode } : {}),
        });
      }

      // 1c1. Verify 6-Digit WhatsApp Code (`POST /api/v1/auth/verify-otp`)
      if (req.method === "POST" && path === "/api/v1/auth/verify-otp") {
        const rawBody = await readRawBody(req);
        const body = (rawBody ? JSON.parse(rawBody) : {}) as {
          phone?: string;
          code?: string;
          purpose?: "LOGIN" | "SIGNUP" | "WITHDRAWAL" | "SETTINGS";
          businessName?: string;
          role?: "reseller" | "starter" | "growth" | "pro" | "vendor" | "supplier";
          isExistingBusiness?: boolean;
          catalogSelection?: "mirror" | "custom";
        };

        if (!body.code || body.code.trim().length !== 6) {
          throw new HttpError(400, "Please enter the 6-digit code sent to your WhatsApp.");
        }

        const normalizedInput = body.phone ? engine.normalizeOtpPhone(body.phone) : "";
        const normalizedVendor = engine.normalizeOtpPhone(engine.vendor.whatsappPhone);
        const targetPhone =
          !normalizedInput || normalizedInput === normalizedVendor || normalizedInput === "+2348031234567"
            ? normalizedVendor
            : normalizedInput;
        const purpose = body.purpose || "LOGIN";

        const isValid = await engine.verifyOtpAsync(targetPhone, body.code, purpose);
        if (!isValid) {
          throw new HttpError(401, "Invalid or expired 6-digit verification code. Please check your WhatsApp and try again.");
        }

        if (purpose === "SIGNUP") {
          engine.onboardVendorProfile({
            businessName: body.businessName || "My WhatsApp Store",
            whatsappPhone: targetPhone,
            role: body.role,
            isExistingBusiness: body.isExistingBusiness,
            catalogSelection: body.catalogSelection,
          });
          await engine.flushPersistence();
        }

        const sessionResult = engine.createVendorSession({
          phone: targetPhone,
          email: `${targetPhone.replace(/\D/g, "")}@caterlog.store`,
          ipAddress: req.socket.remoteAddress,
          userAgent: req.headers["user-agent"],
        });
        const token = sessionResult.token;

        res.setHeader(
          "Set-Cookie",
          `caterlog_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 86400}`
        );

        return sendJson(res, 200, {
          authenticated: true,
          token,
          sessionToken: token,
          session: sessionResult.session,
          vendor: {
            id: engine.vendor.id,
            slug: engine.vendor.slug,
            businessName: engine.vendor.businessName,
            role: engine.vendor.role ?? "reseller",
            whatsappPhone: engine.vendor.whatsappPhone,
          },
          state: engine.serializeState(),
        });
      }

      // 1c1-b. Demo Session Activation for Local Testing (`POST /api/v1/auth/demo-session`)
      if (req.method === "POST" && path === "/api/v1/auth/demo-session") {
        const sessionResult = engine.createVendorSession({
          phone: engine.vendor.whatsappPhone,
          email: "owner@niastores.example",
          ipAddress: req.socket.remoteAddress,
          userAgent: req.headers["user-agent"],
        });
        const token = sessionResult.token;

        res.setHeader(
          "Set-Cookie",
          `caterlog_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 86400}`
        );

        return sendJson(res, 200, {
          authenticated: true,
          token,
          sessionToken: token,
          session: sessionResult.session,
          vendor: {
            id: engine.vendor.id,
            slug: engine.vendor.slug,
            businessName: engine.vendor.businessName,
            role: engine.vendor.role ?? "reseller",
            whatsappPhone: engine.vendor.whatsappPhone,
          },
          state: engine.serializeState(),
        });
      }

      // 1c1-b2. Staff Member Sub-Account Login (`POST /api/v1/auth/staff-login`)
      if (req.method === "POST" && path === "/api/v1/auth/staff-login") {
        const rawBody = await readRawBody(req);
        const body = (rawBody ? JSON.parse(rawBody) : {}) as {
          email?: string;
        };
        if (!body.email || !body.email.trim()) {
          throw new HttpError(400, "Staff member email is required to sign in.");
        }
        const authResult = engine.authenticateStaffMember({
          email: body.email,
          ipAddress: req.socket.remoteAddress,
          userAgent: req.headers["user-agent"],
        });

        res.setHeader(
          "Set-Cookie",
          `caterlog_session=${authResult.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 86400}`
        );

        return sendJson(res, 200, {
          authenticated: true,
          token: authResult.token,
          sessionToken: authResult.token,
          session: authResult.session,
          member: authResult.member,
          vendor: engine.vendor,
          state: engine.serializeState(),
        });
      }

      // 1c1-b3. Get Current Session Identity & RBAC Permissions (`GET /api/v1/auth/session`)
      if (req.method === "GET" && path === "/api/v1/auth/session") {
        const token = getSessionToken(req);
        const session = token ? engine.authenticateVendorSession(token) : null;
        return sendJson(res, 200, {
          authenticated: Boolean(session),
          session,
        });
      }

      // 1c1-c. Transaction PIN Setup (`POST /api/v1/auth/pin/setup`)
      if (req.method === "POST" && path === "/api/v1/auth/pin/setup") {
        requireVendorSession(engine, req);
        const rawBody = await readRawBody(req);
        const body = (rawBody ? JSON.parse(rawBody) : {}) as {
          pin: string;
          otpCode?: string;
          currentPin?: string;
        };
        if (!body.pin) {
          throw new HttpError(400, "A 6-digit transaction PIN is required.");
        }
        const result = await engine.setTransactionPin(body);
        return sendJson(res, 200, {
          status: "pin_set",
          message: result.message,
          state: engine.serializeState(),
        });
      }

      // 1c1-d. Transaction PIN Verification (`POST /api/v1/auth/pin/verify`)
      if (req.method === "POST" && path === "/api/v1/auth/pin/verify") {
        requireVendorSession(engine, req);
        const rawBody = await readRawBody(req);
        const body = (rawBody ? JSON.parse(rawBody) : {}) as { pin: string };
        if (!body.pin) {
          throw new HttpError(400, "Transaction PIN is required.");
        }
        await engine.verifyTransactionPin(body.pin);
        return sendJson(res, 200, {
          status: "verified",
          valid: true,
        });
      }

      // 1c2. Vendor Onboarding / Profile Setup (`POST /api/v1/auth/onboard`)
      if (req.method === "POST" && path === "/api/v1/auth/onboard") {
        const rawBody = await readRawBody(req);
        const body = (rawBody ? JSON.parse(rawBody) : {}) as {
          phone?: string;
          businessName?: string;
          role?: "reseller" | "starter" | "growth" | "pro" | "vendor" | "supplier";
          isExistingBusiness?: boolean;
          catalogSelection?: "mirror" | "custom";
          cacNumber?: string;
          skipOtp?: boolean;
        };

        if (!body.phone && !body.businessName) {
          throw new HttpError(400, "Please provide your WhatsApp phone number and store name.");
        }

        const updatedVendor = engine.onboardVendorProfile({
          businessName: body.businessName || "My WhatsApp Store",
          whatsappPhone: body.phone || engine.vendor.whatsappPhone,
          role: body.role,
          isExistingBusiness: body.isExistingBusiness,
          catalogSelection: body.catalogSelection,
        });
        await engine.flushPersistence();

        // Trigger 6-digit verification code to the vendor's WhatsApp phone unless Email/Password signup already verified
        let sessionToken: string | undefined;
        if (!body.skipOtp) {
          engine.generateOtp(updatedVendor.whatsappPhone, "SIGNUP");
        } else {
          const sessionResult = engine.createVendorSession({
            phone: updatedVendor.whatsappPhone,
            email: `${updatedVendor.whatsappPhone.replace(/\D/g, "")}@caterlog.store`,
            ipAddress: req.socket.remoteAddress,
            userAgent: req.headers["user-agent"],
          });
          sessionToken = sessionResult.token;
          res.setHeader(
            "Set-Cookie",
            `caterlog_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 86400}`
          );
        }

        const masked = updatedVendor.whatsappPhone.replace(
          /(\+\d{3})\d+(\d{4})/,
          "$1****$2"
        );

        return sendJson(res, 200, {
          status: body.skipOtp ? "onboarded" : "otp_sent",
          destinationPhone: masked,
          token: sessionToken,
          sessionToken,
          vendor: {
            id: updatedVendor.id,
            slug: updatedVendor.slug,
            businessName: updatedVendor.businessName,
            role: updatedVendor.role ?? "reseller",
            whatsappPhone: updatedVendor.whatsappPhone,
          },
          state: engine.serializeState(),
        });
      }

      // 1d. Vendor Magic Link Verification (`POST /api/v1/auth/verify`)
      if (req.method === "POST" && path === "/api/v1/auth/verify") {
        const rawBody = await readRawBody(req);
        const body = (rawBody ? JSON.parse(rawBody) : {}) as { token?: string };
        if (!body.token) {
          throw new HttpError(400, "Missing login token.");
        }

        const verified = engine.verifyMagicLinkToken(body.token);
        if (!verified) {
          throw new HttpError(401, "Invalid, expired, or already used login token.");
        }

        const sessionResult = engine.createVendorSession({
          phone: engine.vendor.whatsappPhone,
          email: `${engine.vendor.slug}@caterlog.store`,
          ipAddress: req.socket.remoteAddress,
          userAgent: req.headers["user-agent"],
        });
        const token = sessionResult.token;

        res.setHeader(
          "Set-Cookie",
          `caterlog_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 86400}`
        );

        return sendJson(res, 200, {
          authenticated: true,
          token,
          sessionToken: token,
          session: sessionResult.session,
          vendor: {
            id: engine.vendor.id,
            slug: engine.vendor.slug,
            businessName: engine.vendor.businessName,
            role: engine.vendor.role ?? "reseller",
            whatsappPhone: engine.vendor.whatsappPhone,
          },
          state: engine.serializeState(),
        });
      }

      // 2. Real-Time SSE Stream for Dashboard Synchronization
      if (req.method === "GET" && path === "/api/v1/events") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
          "Access-Control-Allow-Origin": req.headers.origin || "*",
          "Access-Control-Allow-Credentials": "true",
        });
        res.flushHeaders?.();
        res.write(
          `data: ${JSON.stringify(engine.serializeState(), (_k, v) =>
            typeof v === "bigint" ? v.toString() : v
          )}\n\n`
        );
        sseClients.add(res);
        const heartbeat = setInterval(() => {
          res.write(": keep-alive\n\n");
        }, 25_000);
        req.on("close", () => {
          clearInterval(heartbeat);
          sseClients.delete(res);
        });
        return;
      }

      // 3. Dynamic OpenGraph Product Card (`/og/product/:sku`) for WhatsApp Link Previews
      if (req.method === "GET" && path.startsWith("/og/product/")) {
        const sku = decodeURIComponent(path.replace("/og/product/", "")).toUpperCase();
        const product =
          engine.products.find((p) => p.skuCode.toUpperCase() === sku) ?? engine.products[0]!;
        const svg = renderDynamicProductOgSvg({
          vendorName: engine.vendor.businessName,
          isVerified: engine.vendor.verificationStatus === "VERIFIED",
          skuCode: product.skuCode,
          productName: product.name,
          priceKobo: product.basePriceKobo,
          availableStock: Math.max(0, product.stockTotal - product.stockReserved),
        });
        res.writeHead(200, { "Content-Type": "image/svg+xml" });
        res.end(svg);
        return;
      }

      // 4. Meta WhatsApp Webhook Verification Challenge (`GET /webhooks/whatsapp`)
      if (req.method === "GET" && path === "/webhooks/whatsapp") {
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const expectedToken =
          process.env.WHATSAPP_VERIFY_TOKEN ?? "caterlog-whatsapp-verify-token";

        if (mode === "subscribe" && token === expectedToken && challenge) {
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end(challenge);
          return;
        }
        return sendJson(res, 403, { error: "Invalid WhatsApp webhook verification token" });
      }

      // 5. Meta WhatsApp Inbound Webhook (`POST /webhooks/whatsapp`)
      if (req.method === "POST" && path === "/webhooks/whatsapp") {
        const rawBody = await readRawBody(req);

        // Verify Meta's `x-hub-signature-256` HMAC when running against the live Graph API.
        if (!engine.whatsapp.isMockMode()) {
          const signature = req.headers["x-hub-signature-256"];
          if (
            typeof signature !== "string" ||
            !engine.whatsapp.verifyWebhookSignature(rawBody, signature)
          ) {
            return sendJson(res, 401, { error: "Invalid WhatsApp x-hub-signature-256" });
          }
        }

        const body = JSON.parse(rawBody || "{}") as {
          entry?: Array<{
            changes?: Array<{
              field?: string;
              value?: {
                metadata?: {
                  display_phone_number?: string;
                  phone_number_id?: string;
                };
                statuses?: Array<{
                  id?: string;
                  status?: "sent" | "delivered" | "read" | "failed";
                  recipient_id?: string;
                  timestamp?: string;
                }>;
                messages?: Array<{
                  from?: string;
                  from_user_id?: string;
                  text?: { body?: string };
                  image?: { caption?: string; sha256?: string; id?: string; url?: string; link?: string };
                  interactive?: {
                    type?: string;
                    button_reply?: { id?: string; title?: string };
                    list_reply?: { id?: string; title?: string; description?: string };
                  };
                }>;
                message_echoes?: Array<{
                  from?: string;
                  text?: { body?: string };
                }>;
                smb_message_echoes?: Array<{
                  from?: string;
                  text?: { body?: string };
                }>;
              };
            }>;
          }>;
        };

        const processInboundWebhook = async () => {
          for (const entry of body.entry ?? []) {
            for (const change of entry.changes ?? []) {
              const val = change.value;
              if (
                val?.metadata?.phone_number_id &&
                val.metadata.phone_number_id !== "105992837465001" &&
                engine.vendor.whatsappPhoneId !== val.metadata.phone_number_id
              ) {
                engine.vendor.whatsappPhoneId = val.metadata.phone_number_id;
              }

              // Handle Meta WhatsApp message delivery/read status ticks (`sent`, `delivered`, `read`, `failed`)
              if (val?.statuses && val.statuses.length > 0) {
                for (const st of val.statuses) {
                  if (st.status === "failed") {
                    console.warn(`[whatsapp:status] Outbound message ${st.id} to ${st.recipient_id} failed.`);
                  }
                }
              }

              // Handle Coexistence `message_echoes` / `smb_message_echoes` (Vendor replied from mobile app or companion device)
              const allEchoes = [
                ...(val?.message_echoes ?? []),
                ...(val?.smb_message_echoes ?? []),
              ];
              for (const echo of allEchoes) {
                if (echo.text?.body) {
                  await engine.recordVendorManualReplyInBuyerThread(echo.text.body);
                }
              }

              if (change.field === "smb_app_state_sync") {
                console.log("[caterlog:webhook] Received smb_app_state_sync (WhatsApp Business app contact sync event).");
              }
              // Handle inbound messages (Vendor Keyword CLI or Buyer Inquiry)
              for (const msg of val?.messages ?? []) {
                const rawFrom = msg.from ?? msg.from_user_id ?? "";
                const fromPhone = rawFrom
                  ? rawFrom.startsWith("+")
                    ? rawFrom
                    : `+${rawFrom}`
                  : "";
                // Handle text messages, image captions, and WhatsApp interactive button/list replies
                const text =
                  msg.text?.body ??
                  msg.image?.caption ??
                  msg.interactive?.button_reply?.id ??
                  msg.interactive?.button_reply?.title ??
                  msg.interactive?.list_reply?.id ??
                  msg.interactive?.list_reply?.title ??
                  "";
                if (!text) continue;

                const cleanVendorPhone = engine.vendor.whatsappPhone.replace(/\+/g, "");
                const cleanFromPhone = fromPhone.replace(/\+/g, "");

                // Extract attached product photo/media from WhatsApp payload if present
                let attachedImageUrl: string | undefined = undefined;
                let attachedImagePhash: string | undefined = undefined;
                const apiBase = process.env.API_BASE_URL || "http://localhost:4000";

                if (msg.image) {
                  if (msg.image.id) {
                    try {
                      const downloaded = await engine.whatsapp.downloadMedia(msg.image.id);
                      if (downloaded) {
                        const saved = await mediaStore.saveMedia({
                          buffer: downloaded.buffer,
                          contentType: downloaded.contentType,
                          mediaId: msg.image.id,
                        });
                        attachedImageUrl = `${apiBase}/api/v1/media/${encodeURIComponent(saved.mediaId)}`;
                        attachedImagePhash = saved.phash;
                      }
                    } catch (err) {
                      console.error("[whatsapp:media] Failed to download media from Meta:", err);
                    }
                    if (!attachedImageUrl) {
                      attachedImageUrl = `${apiBase}/api/v1/media/${encodeURIComponent(msg.image.id)}`;
                    }
                  } else if (msg.image.url || msg.image.link) {
                    const rawUrl = (msg.image.url || msg.image.link)!;
                    try {
                      const saved = await mediaStore.saveFromUrl(rawUrl);
                      if (saved) {
                        attachedImageUrl = `${apiBase}/api/v1/media/${encodeURIComponent(saved.mediaId)}`;
                        attachedImagePhash = saved.phash;
                      } else {
                        attachedImageUrl = rawUrl;
                      }
                    } catch {
                      attachedImageUrl = rawUrl;
                    }
                  }
                }

                // Also check if text contained an image URL directly
                if (!attachedImageUrl) {
                  const embeddedMatch = text.match(/https?:\/\/[^\s,]+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s,]*)?/i);
                  if (embeddedMatch) {
                    attachedImageUrl = embeddedMatch[0];
                    try {
                      const saved = await mediaStore.saveFromUrl(attachedImageUrl);
                      if (saved) {
                        attachedImageUrl = `${apiBase}/api/v1/media/${encodeURIComponent(saved.mediaId)}`;
                        attachedImagePhash = saved.phash;
                      }
                    } catch {}
                  }
                }

                if (cleanFromPhone === cleanVendorPhone) {
                  // If the message is an explicit vendor keyword command (#help, sales, stock, ship, discount, reply, resume, etc.),
                  // execute store owner admin CLI.
                  const cmd = parseVendorWhatsAppCommand(text);
                  if (cmd.type !== "UNKNOWN_COMMAND" || text.trim().startsWith("#")) {
                    await engine.handleVendorWhatsAppKeyword(text, attachedImageUrl, attachedImagePhash);
                  } else {
                    // Check if a customer is currently awaiting assistance or vendor is in active assistance mode
                    const needsAssistSession = Array.from(engine.buyerSessions.values()).find(
                      (s) => s.state === "NEEDS_ASSISTANCE" || s.state === "ASSISTING"
                    );
                    if (needsAssistSession) {
                      await engine.recordVendorManualReplyInBuyerThread(text, needsAssistSession.buyerPhone);
                    } else {
                      await engine.handleBuyerWhatsAppInquiry({
                        buyerPhone: fromPhone,
                        text,
                        quotedStatusImagePhash: attachedImagePhash,
                        attachedImageUrl,
                      });
                    }
                  }
                } else {
                  // All other phone numbers are customer shoppers
                  await engine.handleBuyerWhatsAppInquiry({
                    buyerPhone: fromPhone,
                    text,
                    quotedStatusImagePhash: attachedImagePhash,
                    attachedImageUrl,
                  });
                }
              }
            }
          }
        };

        // Fast-Ack (<3s SLA for Meta Graph API):
        // Complete synchronously if fast (<2.2s), or immediately acknowledge 200 OK while continuing in background.
        const processingPromise = processInboundWebhook().catch((err) => {
          console.error("[caterlog:whatsapp-webhook] Background processing error:", err);
        });

        if (process.env.WHATSAPP_FAST_ACK === "true") {
          return sendJson(res, 200, { status: "acknowledged", mode: "fast-ack" });
        }

        await Promise.race([
          processingPromise,
          new Promise<void>((resolve) => setTimeout(resolve, 2200)),
        ]);

        return sendJson(res, 200, { status: "acknowledged" });
      }

      // 6. Monnify Payment Webhook (`POST /webhooks/monnify`) — Principle 10.2
      if (req.method === "POST" && path === "/webhooks/monnify") {
        const rawBody = await readRawBody(req);
        const signature = req.headers["monnify-signature"];
        if (
          typeof signature !== "string" ||
          !engine.monnify.verifyWebhookSignature(rawBody, signature)
        ) {
          return sendJson(res, 401, { error: "Invalid Monnify webhook signature." });
        }

        const parsed = JSON.parse(rawBody || "{}") as {
          eventType?: string;
          eventData?: { transactionReference?: string };
        };

        if (parsed.eventType && parsed.eventType !== "SUCCESSFUL_TRANSACTION") {
          return sendJson(res, 200, { status: "ignored", eventType: parsed.eventType });
        }

        const txRef = parsed.eventData?.transactionReference;
        if (!txRef) {
          return sendJson(res, 400, { error: "Missing eventData.transactionReference" });
        }

        const result = await engine.reconcileMonnifyWebhook({
          rawBody,
          signatureHeader: signature,
          providerTransactionRef: txRef,
        });

        return sendJson(res, 200, {
          status: "reconciled",
          orderShortCode: result.order.shortCode,
          reconciliationStatus: result.status,
        });
      }

      // 6b. WhatsApp & Product Media Proxy (`GET /api/v1/media/:mediaId`)
      if (req.method === "GET" && path.startsWith("/api/v1/media/")) {
        const mediaId = decodeURIComponent(path.replace("/api/v1/media/", ""));

        // 1. Check local media store cache/disk
        const cached = mediaStore.getMedia(mediaId);
        if (cached) {
          res.writeHead(200, {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": cached.contentType,
            "Cache-Control": "public, max-age=86400",
          });
          res.end(cached.buffer);
          return;
        }

        // 2. Try proxying / downloading original media from Meta Cloud API
        try {
          const downloaded = await engine.whatsapp.downloadMedia(mediaId);
          if (downloaded) {
            const saved = await mediaStore.saveMedia({
              buffer: downloaded.buffer,
              contentType: downloaded.contentType,
              mediaId,
            });
            res.writeHead(200, {
              "Access-Control-Allow-Origin": "*",
              "Content-Type": saved.contentType,
              "Cache-Control": "public, max-age=86400",
            });
            res.end(saved.buffer);
            return;
          }
        } catch (err) {
          console.error("[caterlog:media-proxy] Failed to proxy media from Meta:", err);
        }

        // 3. Clean SVG placeholder when image is genuinely absent (NEVER redirect to random Unsplash)
        res.writeHead(200, {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=3600",
        });
        res.end(
          `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400" fill="#f8fafc"><rect width="400" height="400" rx="16" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/><g transform="translate(140, 130)" fill="#94a3b8"><path d="M60 10a20 20 0 100 40 20 20 0 000-40zM10 110h100l-30-40-20 25-15-18-35 33z"/></g><text x="200" y="270" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-size="14" font-weight="600" fill="#64748b" text-anchor="middle">Original Photo Unavailable</text></svg>`
        );
        return;
      }

      // 6c. Media Upload Endpoint (`POST /api/v1/media/upload`)
      if (req.method === "POST" && path === "/api/v1/media/upload") {
        const body = JSON.parse(await readRawBody(req)) as {
          dataUrl: string;
          mediaId?: string;
        };
        if (!body.dataUrl) {
          throw new HttpError(400, "dataUrl is required for media upload.");
        }
        const saved = await mediaStore.saveDataUrl(body.dataUrl, body.mediaId);
        if (!saved) {
          throw new HttpError(400, "Invalid base64 dataUrl format.");
        }
        const apiBase = process.env.API_BASE_URL || "http://localhost:4000";
        return sendJson(res, 201, {
          mediaId: saved.mediaId,
          url: `${apiBase}/api/v1/media/${encodeURIComponent(saved.mediaId)}`,
          phash: saved.phash,
          contentType: saved.contentType,
        });
      }

      // 6d. Emergency Store Panic Button / Payout Freeze (`POST /api/v1/security/freeze` & `GET /security/freeze`)
      if (req.method === "POST" && path === "/api/v1/security/freeze") {
        const rawBody = await readRawBody(req);
        const body = (rawBody ? JSON.parse(rawBody) : {}) as { token?: string };
        const token = body.token || url.searchParams.get("token");
        if (!token) {
          throw new HttpError(400, "Emergency cancellation token is required.");
        }
        const result = engine.emergencyFreezeStore(token);
        return sendJson(res, 200, {
          status: "frozen",
          message: result.message,
          state: engine.serializeState(),
        });
      }

      if (req.method === "GET" && (path === "/security/freeze" || path === "/api/v1/security/freeze")) {
        const token = url.searchParams.get("token");
        if (token) {
          engine.emergencyFreezeStore(token);
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`<!DOCTYPE html>
<html>
<head><title>Caterlog Store Frozen</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fef2f2; color: #991b1b; text-align: center; padding: 20px;">
  <div>
    <h1 style="font-size: 24px; margin-bottom: 8px;">🛑 Store Security Lockdown Activated</h1>
    <p style="font-size: 14px; max-width: 480px; margin: 0 auto 16px; color: #7f1d1d;">All payouts have been frozen, pending bank account modifications discarded, and all active login sessions terminated.</p>
    <p style="font-size: 13px; color: #b91c1c;">Contact Caterlog Security: <a href="mailto:security@caterlog.store" style="color: #991b1b; font-weight: bold;">security@caterlog.store</a></p>
  </div>
</body>
</html>`);
        return;
      }

      // -----------------------------------------------------------------------
      // AUTHENTICATION & RBAC GUARD: All /api/v1/vendor/* endpoints require an active session
      // and enforce role-based permissions for staff sub-accounts.
      // -----------------------------------------------------------------------
      if (path.startsWith("/api/v1/vendor/")) {
        const rbacRule = resolveRouteRbacPermission(req.method, path);
        requireVendorSession(engine, req, rbacRule?.permission, rbacRule?.label);
        if (rbacRule) {
          enforceStaffPermission(engine, req, rbacRule.permission, rbacRule.label);
        }
      }

      // 7. Dashboard REST API: Full Vendor State (`GET /api/v1/vendor/state`)
      if (req.method === "GET" && path === "/api/v1/vendor/state") {
        if (
          url.searchParams.get("refresh") === "true" ||
          url.searchParams.get("sync") === "true"
        ) {
          await engine.syncFromDatabase();
        }
        return sendJson(res, 200, engine.serializeState());
      }

      // 7a. Dashboard REST API: Explicit Database-to-Dashboard Sync (`POST /api/v1/vendor/sync`)
      if (req.method === "POST" && path === "/api/v1/vendor/sync") {
        await engine.syncFromDatabase();
        return sendJson(res, 200, engine.serializeState());
      }

      // 7b. Dashboard REST API: Analytics Breakdown (`GET /api/v1/vendor/analytics?range=today|week|month`)
      if (req.method === "GET" && path === "/api/v1/vendor/analytics") {
        const requested = url.searchParams.get("range");
        const range =
          requested === "today" || requested === "week" || requested === "month"
            ? requested
            : "month";
        return sendJson(res, 200, { range, ...engine.getAnalyticsBreakdown(range) });
      }

      // 8. Dashboard REST API: Update Settings (`PATCH /api/v1/vendor/settings`)
      if (req.method === "PATCH" && path === "/api/v1/vendor/settings") {
        const body = JSON.parse(await readRawBody(req)) as {
          copilotMode?: "COPILOT" | "FULL_AUTO" | "MANUAL";
          copilotIdleSeconds?: number;
          reservationTtlMinutes?: number;
        };
        engine.updateSettings(body);
        await engine.flushPersistence();
        return sendJson(res, 200, engine.serializeState());
      }

      // 8a. Dashboard REST API: Update Profile (`PATCH /api/v1/vendor/profile`)
      if (req.method === "PATCH" && path === "/api/v1/vendor/profile") {
        const body = JSON.parse(await readRawBody(req)) as {
          businessName?: string;
          role?: "reseller" | "starter" | "growth" | "pro" | "vendor" | "supplier";
          whatsappPhone?: string;
          instagramHandle?: string;
          baseState?: string;
          baseCity?: string;
        };
        engine.updateVendorProfile(body);
        await engine.flushPersistence();
        return sendJson(res, 200, engine.serializeState());
      }

      // 8a-2. Dashboard REST API: Update Social Channel Connections (`POST /api/v1/vendor/channels` or `PATCH /api/v1/vendor/channels`)
      if (
        (req.method === "POST" || req.method === "PATCH") &&
        path === "/api/v1/vendor/channels"
      ) {
        const body = JSON.parse(await readRawBody(req)) as {
          instagramHandle?: string;
          instagramConnected?: boolean;
          instagramBusinessId?: string;
          facebookPageName?: string;
          facebookPageId?: string;
          facebookConnected?: boolean;
        };
        engine.updateSocialChannelConfig(body);
        await engine.flushPersistence();
        return sendJson(res, 200, engine.serializeState());
      }

      // 8b. Dashboard REST API: Secure Fund Withdrawal (`POST /api/v1/vendor/withdraw`)
      if (req.method === "POST" && path === "/api/v1/vendor/withdraw") {
        const body = JSON.parse(await readRawBody(req)) as {
          amountNaira: number;
          bankName?: string;
          accountNumber?: string;
          securityCode?: string;
          pin?: string;
        };

        if (body.pin) {
          await engine.verifyTransactionPin(body.pin);
        } else if (body.securityCode && body.securityCode.trim().length === 6) {
          const isValid = await engine.verifyOtpAsync(engine.vendor.whatsappPhone, body.securityCode, "WITHDRAWAL");
          if (!isValid) {
            throw new HttpError(401, "Invalid or expired 6-digit withdrawal security code. Please check WhatsApp.");
          }
        } else {
          throw new HttpError(
            400,
            "A 6-digit Transaction PIN or WhatsApp security code is required to authorize fund withdrawal."
          );
        }

        const withdrawal = engine.recordWithdrawal({
          amountNaira: body.amountNaira,
          bankName: body.bankName,
          accountNumber: body.accountNumber,
        });
        const withdrawAmountKobo = nairaToKobo(body.amountNaira || 0);
        await engine.whatsapp.sendTextMessage({
          toPhone: engine.vendor.whatsappPhone,
          text: `💸 *Settlement Payout Dispatched:*\nAmount: *${formatNaira(withdrawAmountKobo)}*\nBank: *${withdrawal.bankName}* (\`${withdrawal.accountNumber}\`)\nReference: \`${withdrawal.reference}\`\n\n_Funds will reflect in your verified settlement account within 10 minutes._`,
          vendorPhoneId: engine.vendor.whatsappPhoneId,
        });

        return sendJson(res, 200, {
          status: "dispatched",
          amountNaira: body.amountNaira,
          bankName: withdrawal.bankName,
          accountNumber: withdrawal.accountNumber,
          reference: withdrawal.reference,
          message: "Withdrawal successfully authorized and queued for bank settlement.",
          state: engine.serializeState(),
        });
      }

      // 8c. Dashboard REST API: Update Sensitive Settings with 6-Digit Code (`POST /api/v1/vendor/settings/secure`)
      if (req.method === "POST" && path === "/api/v1/vendor/settings/secure") {
        const body = JSON.parse(await readRawBody(req)) as {
          securityCode: string;
          businessName?: string;
          notifyPhone?: string;
        };
        if (!body.securityCode || body.securityCode.trim().length !== 6) {
          throw new HttpError(400, "A 6-digit WhatsApp security code is required to modify account settings.");
        }
        const isValid = await engine.verifyOtpAsync(engine.vendor.whatsappPhone, body.securityCode, "SETTINGS");
        if (!isValid) {
          throw new HttpError(401, "Invalid or expired 6-digit security code. Please check WhatsApp.");
        }

        engine.updateVendorSettings({
          businessName: body.businessName,
          notifyPhone: body.notifyPhone,
        });

        return sendJson(res, 200, {
          status: "updated",
          vendor: engine.vendor,
          state: engine.serializeState(),
          message: "Sensitive account settings updated successfully.",
        });
      }

      // 8d. Dashboard REST API: Initial Settlement Bank Account Linking (`POST /api/v1/vendor/bank`)
      if (req.method === "POST" && path === "/api/v1/vendor/bank") {
        const body = JSON.parse(await readRawBody(req)) as {
          bankCode: string;
          accountNumber: string;
          email?: string;
        };
        if (!body.bankCode || !body.accountNumber) {
          throw new HttpError(400, "Bank code and 10-digit account number are required.");
        }

        // If an active account is already linked, reject un-cooled changes
        if (
          engine.vendor.bankAccountNumber &&
          engine.vendor.bankAccountNumber !== body.accountNumber.trim().replace(/\D/g, "")
        ) {
          throw new HttpError(
            400,
            "A verified payout account is already active. Modifying payout bank accounts requires step-up verification via /api/v1/vendor/bank/request-change with a 72-hour cooling-off freeze."
          );
        }

        const result = await engine.linkVendorBankAccount(body);
        return sendJson(res, 200, {
          status: "linked",
          subAccountCode: result.subAccount.subAccountCode,
          bankName: result.vendor.bankName,
          accountNumber: result.vendor.bankAccountNumber,
          accountName: result.vendor.bankAccountName,
          state: engine.serializeState(),
        });
      }

      // 8d-2. Dashboard REST API: Request Payout Bank Account Change with 72h Cooling-off (`POST /api/v1/vendor/bank/request-change`)
      if (req.method === "POST" && path === "/api/v1/vendor/bank/request-change") {
        const body = JSON.parse(await readRawBody(req)) as {
          bankCode: string;
          accountNumber: string;
          pin: string;
          otpCode: string;
        };
        if (!body.bankCode || !body.accountNumber || !body.pin || !body.otpCode) {
          throw new HttpError(
            400,
            "Bank code, account number, 6-digit transaction PIN, and WhatsApp OTP are all required."
          );
        }
        const result = await engine.requestPayoutAccountChange({
          bankCode: body.bankCode,
          accountNumber: body.accountNumber,
          pin: body.pin,
          otpCode: body.otpCode,
          requestorIp: req.socket.remoteAddress,
        });
        return sendJson(res, 200, {
          status: result.status,
          bankName: result.bankName,
          accountNumber: result.accountNumber,
          accountName: result.accountName,
          effectiveAt: result.effectiveAt,
          cancelToken: result.cancelToken,
          state: engine.serializeState(),
        });
      }

      // 8d-3. Dashboard REST API: Apply Elapsed Bank Change (`POST /api/v1/vendor/bank/apply-pending`)
      if (req.method === "POST" && path === "/api/v1/vendor/bank/apply-pending") {
        const applied = await engine.applyPendingBankUpdate();
        return sendJson(res, 200, {
          applied,
          state: engine.serializeState(),
        });
      }

      // 8e. Dashboard REST API: Save Market Boost & Geographic Visibility (`PUT /api/v1/vendor/market-boost`)
      if (req.method === "PUT" && path === "/api/v1/vendor/market-boost") {
        const body = JSON.parse(await readRawBody(req));
        const listing = engine.saveMarketBoost(body);
        await engine.flushPersistence();
        return sendJson(res, 200, {
          status: "saved",
          listing,
          state: engine.serializeState(),
        });
      }

      // 8e-2. Dashboard REST API: Market Boost Wholesale Pricing Preview (`GET /api/v1/vendor/market-boost/pricing`)
      if (req.method === "GET" && path === "/api/v1/vendor/market-boost/pricing") {
        const reseller = url.searchParams.get("reseller") ?? undefined;
        return sendJson(res, 200, {
          reseller: reseller ?? "ALL_RESELLERS",
          catalog: engine.getMarketBoostWholesaleCatalog(reseller),
        });
      }

      // 8f-1. Dashboard REST API: Get Wholesale Suppliers with Geofence Filtering (`GET /api/v1/vendor/network/suppliers`)
      if (req.method === "GET" && path === "/api/v1/vendor/network/suppliers") {
        const targetState = url.searchParams.get("state") || engine.vendor.baseState || "Lagos";
        const targetLga = url.searchParams.get("lga") || engine.vendor.baseCity || undefined;
        const category = url.searchParams.get("category") || undefined;
        const deliverableOnly = url.searchParams.get("deliverableOnly") === "true";

        let filtered = engine.suppliers.map((sup) => {
          const geofence = isTerritoryDeliverable(sup, {
            state: targetState,
            lga: targetLga,
          });
          return {
            ...sup,
            geofence,
          };
        });

        if (category && category !== "All Categories") {
          filtered = filtered.filter((s) => s.category.toLowerCase().includes(category.toLowerCase()));
        }
        if (deliverableOnly) {
          filtered = filtered.filter((s) => s.geofence.deliverable);
        }

        return sendJson(res, 200, {
          status: "success",
          territory: { state: targetState, lga: targetLga },
          total: filtered.length,
          suppliers: filtered,
        });
      }

      // 8f. Dashboard REST API: Mirror Supplier Catalog (`POST /api/v1/vendor/network/mirror`)
      if (req.method === "POST" && path === "/api/v1/vendor/network/mirror") {
        const body = JSON.parse(await readRawBody(req)) as {
          supplierIdOrSlug: string;
          productSkus?: string[];
          defaultMarkupBps?: number;
          status?: "ACTIVE" | "PAUSED";
        };
        if (!body.supplierIdOrSlug) {
          throw new HttpError(400, "supplierIdOrSlug is required.");
        }
        const result = engine.mirrorSupplierCatalog(body);
        await engine.flushPersistence();
        return sendJson(res, 200, {
          status: "mirrored",
          mirror: result.mirror,
          mirroredProductsCount: result.mirroredProducts.length,
          state: engine.serializeState(),
        });
      }

      // 8g. Dashboard REST API: Create Payment Link (`POST /api/v1/vendor/payment-links`)
      if (req.method === "POST" && path === "/api/v1/vendor/payment-links") {
        const body = JSON.parse(await readRawBody(req)) as {
          customerName?: string;
          customerPhone?: string;
          productSku?: string;
          description?: string;
          amountNaira: number | string;
        };
        const link = engine.createPaymentLink(body);
        return sendJson(res, 201, {
          status: "created",
          link: {
            ...link,
            amountNaira: Number(link.amountKobo) / 100,
            amountFormatted: formatNaira(link.amountKobo),
          },
          state: engine.serializeState(),
        });
      }

      // 8h. Dashboard REST API: Delete Payment Link (`DELETE /api/v1/vendor/payment-links/:slug`)
      if (req.method === "DELETE" && path.startsWith("/api/v1/vendor/payment-links/")) {
        const slug = decodeURIComponent(path.replace("/api/v1/vendor/payment-links/", ""));
        engine.deletePaymentLink(slug);
        return sendJson(res, 200, engine.serializeState());
      }

      // 8i. Dashboard REST API: Update Settlement Split Rule (`PUT /api/v1/vendor/split-rules`)
      if (req.method === "PUT" && path === "/api/v1/vendor/split-rules") {
        const body = JSON.parse(await readRawBody(req)) as {
          name?: string;
          supplierSubAccountCode?: string;
          supplierShareBps: number;
          resellerShareBps: number;
          platformFeeBps?: number;
        };
        const rule = engine.saveSplitRule(body);
        return sendJson(res, 200, {
          status: "updated",
          rule,
          state: engine.serializeState(),
        });
      }

      // 8j. Dashboard REST API: Submit KYC Verification (`POST /api/v1/vendor/kyc`)
      if (req.method === "POST" && path === "/api/v1/vendor/kyc") {
        const body = JSON.parse(await readRawBody(req)) as {
          businessName: string;
          cacNumber: string;
          tinNumber?: string;
          businessAddress?: string;
          businessCategory?: string;
          bankCode: string;
          bankName?: string;
          accountNumber: string;
          resolvedAccountName: string;
          whatsappPhone?: string;
          instagramHandle?: string;
          cacDocumentUploaded?: boolean;
          idDocumentUploaded?: boolean;
        };
        if (!body.cacNumber || !body.accountNumber) {
          throw new HttpError(400, "CAC number and 10-digit account number are required.");
        }
        const submission = engine.submitKyc(body);
        return sendJson(res, 200, {
          status: "submitted",
          submission,
          state: engine.serializeState(),
        });
      }

      // 8k. Dashboard REST API: Save/Invite Team Member (`POST /api/v1/vendor/team`)
      if (req.method === "POST" && path === "/api/v1/vendor/team") {
        const body = JSON.parse(await readRawBody(req)) as {
          name: string;
          email: string;
          phone?: string;
          role: string;
          status?: "Active" | "Invited" | "Suspended";
          canManageOrders?: boolean;
          canManageInventory?: boolean;
          canViewPayouts?: boolean;
          canProcessRefunds?: boolean;
          canOverrideCopilot?: boolean;
        };
        const member = engine.saveTeamMember(body);
        return sendJson(res, 200, {
          status: "saved",
          member,
          state: engine.serializeState(),
        });
      }

      // 8l. Dashboard REST API: Remove Team Member (`DELETE /api/v1/vendor/team/:id`)
      if (req.method === "DELETE" && path.startsWith("/api/v1/vendor/team/")) {
        const idOrEmail = decodeURIComponent(path.replace("/api/v1/vendor/team/", ""));
        engine.deleteTeamMember(idOrEmail);
        return sendJson(res, 200, engine.serializeState());
      }

      // 8m. Dashboard REST API: Sync Notifications (`POST /api/v1/vendor/notifications/sync`)
      if (req.method === "POST" && path === "/api/v1/vendor/notifications/sync") {
        const body = JSON.parse(await readRawBody(req)) as {
          readKeys?: string[];
          dismissedKeys?: string[];
          markAllRead?: boolean;
        };
        engine.syncNotifications(body);
        return sendJson(res, 200, engine.serializeState());
      }

      // 8n. Dashboard REST API: Upgrade Subscription (`POST /api/v1/vendor/subscription/upgrade`)
      if (req.method === "POST" && path === "/api/v1/vendor/subscription/upgrade") {
        const body = JSON.parse(await readRawBody(req)) as {
          planId: "FREE" | "GROWTH" | "SCALE";
          billingCycle?: "MONTHLY" | "ANNUALLY";
        };
        if (!body.planId) {
          throw new HttpError(400, "planId is required.");
        }
        const subscription = engine.updateSubscription(body.planId, body.billingCycle || "MONTHLY");
        return sendJson(res, 200, {
          status: "upgraded",
          subscription,
          state: engine.serializeState(),
        });
      }

      // 8o. Dashboard REST API: Fast-Track Trust Tier (`POST /api/v1/vendor/trust-tier/fast-track`)
      if (req.method === "POST" && path === "/api/v1/vendor/trust-tier/fast-track") {
        const body = JSON.parse(await readRawBody(req)) as {
          cacNumber?: string;
        };
        const trustTier = engine.fastTrackTrustTier(body.cacNumber);
        return sendJson(res, 200, {
          status: "fast_tracked",
          trustTier,
          state: engine.serializeState(),
        });
      }

      // 9. Dashboard REST API: Add Product (`POST /api/v1/vendor/products`)
      if (req.method === "POST" && path === "/api/v1/vendor/products") {
        const body = JSON.parse(await readRawBody(req)) as {
          skuCode?: string;
          name: string;
          description?: string;
          priceNaira: number | string;
          stockTotal?: number;
          category?: string;
          customFields?: Record<string, string>;
          primaryImageUrl?: string;
          variants?: Array<{
            id?: string;
            name: string;
            sku?: string;
            skuCode?: string;
            priceNaira?: number | string;
            stock?: number;
            stockTotal?: number;
          }>;
        };

        const mappedVariants = body.variants?.map((v) => ({
          id: v.id || crypto.randomUUID(),
          name: v.name,
          skuCode: (v.sku || v.skuCode || "").toUpperCase(),
          priceKobo: v.priceNaira !== undefined ? nairaToKobo(v.priceNaira) : undefined,
          stockTotal: Number(v.stock ?? v.stockTotal ?? 0),
          stockReserved: 0,
        }));

        let primaryImageUrl = body.primaryImageUrl;
        let imagePhash: string | undefined = undefined;
        if (primaryImageUrl && primaryImageUrl.startsWith("data:")) {
          const saved = await mediaStore.saveDataUrl(primaryImageUrl);
          if (saved) {
            const apiBase = process.env.API_BASE_URL || "http://localhost:4000";
            primaryImageUrl = `${apiBase}/api/v1/media/${encodeURIComponent(saved.mediaId)}`;
            imagePhash = saved.phash;
          }
        }

        engine.addProduct({
          skuCode: body.skuCode,
          name: body.name,
          description: body.description,
          basePriceKobo: nairaToKobo(body.priceNaira),
          stockTotal: Number(body.stockTotal ?? 0),
          category: body.category,
          primaryImageUrl,
          imagePhash,
          variants: mappedVariants,
          customFields: body.customFields,
        });
        await engine.flushPersistence();
        return sendJson(res, 201, engine.serializeState());
      }

      // 9b. Dashboard REST API: Full Product/Variant Update (`PUT /api/v1/vendor/products/:sku`)
      if (req.method === "PUT" && path.startsWith("/api/v1/vendor/products/")) {
        const sku = decodeURIComponent(path.replace("/api/v1/vendor/products/", ""));
        const body = JSON.parse(await readRawBody(req)) as {
          name?: string;
          description?: string;
          category?: string;
          priceNaira?: number | string;
          stockTotal?: number;
          primaryImageUrl?: string;
          customFields?: Record<string, string>;
          variants?: Array<{
            id?: string;
            name: string;
            sku?: string;
            skuCode?: string;
            priceNaira?: number | string;
            stock?: number;
            stockTotal?: number;
          }>;
        };

        let primaryImageUrl = body.primaryImageUrl;
        let imagePhash: string | undefined = undefined;
        if (primaryImageUrl && primaryImageUrl.startsWith("data:")) {
          const saved = await mediaStore.saveDataUrl(primaryImageUrl);
          if (saved) {
            const apiBase = process.env.API_BASE_URL || "http://localhost:4000";
            primaryImageUrl = `${apiBase}/api/v1/media/${encodeURIComponent(saved.mediaId)}`;
            imagePhash = saved.phash;
          }
        }

        const mappedVariants = body.variants?.map((v) => ({
          id: v.id || crypto.randomUUID(),
          name: v.name,
          skuCode: (v.sku || v.skuCode || "").toUpperCase(),
          priceKobo: v.priceNaira !== undefined ? nairaToKobo(v.priceNaira) : undefined,
          stockTotal: Number(v.stock ?? v.stockTotal ?? 0),
          stockReserved: 0,
        }));

        const updated = engine.updateProduct(sku, {
          name: body.name,
          description: body.description,
          category: body.category,
          basePriceKobo: body.priceNaira !== undefined ? nairaToKobo(body.priceNaira) : undefined,
          stockTotal: body.stockTotal !== undefined ? Number(body.stockTotal) : undefined,
          primaryImageUrl,
          imagePhash,
          variants: mappedVariants,
          customFields: body.customFields,
        });
        if (!updated) {
          throw new HttpError(404, `Product SKU "${sku}" not found.`);
        }
        await engine.flushPersistence();
        return sendJson(res, 200, engine.serializeState());
      }

      // 10. Dashboard REST API: Update Stock (`PATCH /api/v1/vendor/products/:sku/stock`)
      if (
        req.method === "PATCH" &&
        path.startsWith("/api/v1/vendor/products/") &&
        path.endsWith("/stock")
      ) {
        const sku = decodeURIComponent(
          path.replace("/api/v1/vendor/products/", "").replace("/stock", "")
        );
        const body = JSON.parse(await readRawBody(req)) as { stockTotal: number };
        const updated = engine.updateProductStock(sku, Number(body.stockTotal));
        if (!updated) {
          throw new HttpError(404, `Product SKU "${sku}" not found.`);
        }
        await engine.flushPersistence();
        return sendJson(res, 200, engine.serializeState());
      }

      // 10b. Dashboard REST API: Delete Product (`DELETE /api/v1/vendor/products/:sku`)
      if (req.method === "DELETE" && path.startsWith("/api/v1/vendor/products/")) {
        const sku = decodeURIComponent(path.replace("/api/v1/vendor/products/", ""));
        const deleted = engine.deleteProduct(sku);
        if (!deleted) {
          throw new HttpError(404, `Product SKU "${sku}" not found.`);
        }
        await engine.flushPersistence();
        return sendJson(res, 200, engine.serializeState());
      }

      // 11. Dashboard REST API: Upsert Shipping Zone (`POST /api/v1/vendor/shipping-zones`)
      if (req.method === "POST" && path === "/api/v1/vendor/shipping-zones") {
        const body = JSON.parse(await readRawBody(req)) as {
          name: string;
          feeNaira: number | string;
        };
        engine.upsertShippingZone(body.name, nairaToKobo(body.feeNaira));
        await engine.flushPersistence();
        return sendJson(res, 200, engine.serializeState());
      }

      // 12. Dashboard REST API: Delete Shipping Zone (`DELETE /api/v1/vendor/shipping-zones/:code`)
      if (req.method === "DELETE" && path.startsWith("/api/v1/vendor/shipping-zones/")) {
        const code = Number.parseInt(path.replace("/api/v1/vendor/shipping-zones/", ""), 10);
        if (!Number.isInteger(code)) {
          throw new HttpError(400, "Shipping zone code must be an integer.");
        }
        const deleted = engine.deleteShippingZone(code);
        if (!deleted) {
          throw new HttpError(404, `Active shipping zone #${code} not found.`);
        }
        await engine.flushPersistence();
        return sendJson(res, 200, engine.serializeState());
      }

      // 13. Dashboard REST API: Upsert Discount (`POST /api/v1/vendor/discounts`)
      if (req.method === "POST" && path === "/api/v1/vendor/discounts") {
        const body = JSON.parse(await readRawBody(req)) as {
          code: string;
          type: "PERCENTAGE" | "FLAT_KOBO";
          value: number; // percentage e.g. 10, or Naira e.g. 5000
        };
        const koboOrBps =
          body.type === "PERCENTAGE"
            ? BigInt(Math.round(Number(body.value) * 100))
            : nairaToKobo(body.value);
        engine.upsertDiscount({
          code: body.code,
          type: body.type,
          value: koboOrBps,
        });
        await engine.flushPersistence();
        return sendJson(res, 200, engine.serializeState());
      }

      // 14. Dashboard REST API: Deactivate Discount (`DELETE /api/v1/vendor/discounts/:code`)
      if (req.method === "DELETE" && path.startsWith("/api/v1/vendor/discounts/")) {
        const code = decodeURIComponent(path.replace("/api/v1/vendor/discounts/", ""));
        const deactivated = engine.deactivateDiscount(code);
        if (!deactivated) {
          throw new HttpError(404, `Active discount code "${code}" not found.`);
        }
        await engine.flushPersistence();
        return sendJson(res, 200, engine.serializeState());
      }

      // 15. Dashboard REST API: Mark Order Dispatched (`POST /api/v1/vendor/orders/:code/dispatch`)
      if (
        req.method === "POST" &&
        path.startsWith("/api/v1/vendor/orders/") &&
        path.endsWith("/dispatch")
      ) {
        const shortCode = decodeURIComponent(
          path.replace("/api/v1/vendor/orders/", "").replace("/dispatch", "")
        );
        const body = JSON.parse((await readRawBody(req)) || "{}") as {
          riderPhone?: string;
        };
        const dispatched = await engine.dispatchOrder(shortCode, body.riderPhone);
        if (!dispatched) {
          throw new HttpError(404, `Order "${shortCode}" not found.`);
        }
        return sendJson(res, 200, engine.serializeState());
      }

      // 15b. Dashboard REST API: Expire Unpaid Order & Release Stock (`POST /api/v1/vendor/orders/:code/expire`)
      if (
        req.method === "POST" &&
        path.startsWith("/api/v1/vendor/orders/") &&
        path.endsWith("/expire")
      ) {
        const shortCode = decodeURIComponent(
          path.replace("/api/v1/vendor/orders/", "").replace("/expire", "")
        );
        const expired = await engine.expireOrderReservation(shortCode);
        if (!expired) {
          throw new HttpError(
            404,
            `Order "${shortCode}" not found or is no longer awaiting payment.`
          );
        }
        return sendJson(res, 200, engine.serializeState());
      }

      // 15c. Dashboard REST API: Manually Verify Pending Payment via Monnify Search
      if (
        req.method === "POST" &&
        path.startsWith("/api/v1/vendor/orders/") &&
        path.endsWith("/verify-payment")
      ) {
        const shortCode = decodeURIComponent(
          path.replace("/api/v1/vendor/orders/", "").replace("/verify-payment", "")
        );
        const result = await engine.verifyOrderPayment(shortCode);
        if (!result) {
          throw new HttpError(404, `Order "${shortCode}" not found.`);
        }
        return sendJson(res, 200, {
          status: result.status,
          applied: result.applied,
          remainingBalanceKobo: result.remainingBalanceKobo.toString(),
          overpaidAmountKobo: result.overpaidAmountKobo.toString(),
          state: engine.serializeState(),
        });
      }

      // 15d. Dashboard REST API: 1-Click Dispatch Rider Waybill / Packing Slip (`GET /api/v1/vendor/orders/:code/waybill`)
      if (
        req.method === "GET" &&
        path.startsWith("/api/v1/vendor/orders/") &&
        path.endsWith("/waybill")
      ) {
        const shortCode = decodeURIComponent(
          path.replace("/api/v1/vendor/orders/", "").replace("/waybill", "")
        );
        const waybill = engine.getOrderWaybill(shortCode);
        if (!waybill) {
          throw new HttpError(404, `Order "${shortCode}" not found.`);
        }
        return sendJson(res, 200, { waybill });
      }

      // 15e. Dashboard REST API: 1-Click Instant Customer Refund (`POST /api/v1/vendor/orders/:code/refund`)
      if (
        req.method === "POST" &&
        path.startsWith("/api/v1/vendor/orders/") &&
        path.endsWith("/refund")
      ) {
        const shortCode = decodeURIComponent(
          path.replace("/api/v1/vendor/orders/", "").replace("/refund", "")
        );
        const body = JSON.parse((await readRawBody(req)) || "{}") as {
          reason?: string;
          amountNaira?: number | string;
        };
        const result = await engine.refundOrder(shortCode, {
          reason: body.reason,
          amountKobo: body.amountNaira !== undefined ? nairaToKobo(body.amountNaira) : undefined,
        });
        if (!result) {
          throw new HttpError(404, `Order "${shortCode}" not found.`);
        }
        return sendJson(res, 200, {
          status: "refunded",
          refundReference: result.refund.refundReference,
          refundAmountFormatted: formatNaira(result.refund.refundAmountKobo),
          refundStatus: result.refund.refundStatus,
          state: engine.serializeState(),
        });
      }

      // 15f. Public Post-Payment Web Receipt & Live Tracker (`GET /api/v1/public/orders/:shortCode`)
      if (
        req.method === "GET" &&
        path.startsWith("/api/v1/public/orders/") &&
        !path.endsWith("/delivery") &&
        !path.includes("/shipbubble/")
      ) {
        const shortCode = decodeURIComponent(
          path.replace("/api/v1/public/orders/", "")
        );
        const receipt = engine.getPublicOrderReceipt(shortCode);
        if (!receipt) {
          throw new HttpError(404, `Order "${shortCode}" not found.`);
        }
        return sendJson(res, 200, { receipt });
      }

      // 15g. Public Post-Payment Buyer Delivery Landmark & Alternate Phone Update (`PATCH /api/v1/public/orders/:shortCode/delivery`)
      if (
        (req.method === "PATCH" || req.method === "POST") &&
        path.startsWith("/api/v1/public/orders/") &&
        path.endsWith("/delivery")
      ) {
        const shortCode = decodeURIComponent(
          path.replace("/api/v1/public/orders/", "").replace("/delivery", "")
        );
        const body = JSON.parse((await readRawBody(req)) || "{}") as {
          deliveryAddress?: string;
          deliveryLandmark?: string;
          alternatePhone?: string;
        };
        const updated = await engine.updateOrderDeliveryDetails(shortCode, body);
        if (!updated) {
          throw new HttpError(404, `Order "${shortCode}" not found.`);
        }
        return sendJson(res, 200, {
          status: "updated",
          receipt: engine.getPublicOrderReceipt(shortCode),
        });
      }

      // 15g-sb1. Public Storefront Live Rate Shopping (`POST /api/v1/public/orders/:shortCode/shipbubble/rates`)
      if (
        req.method === "POST" &&
        path.startsWith("/api/v1/public/orders/") &&
        path.endsWith("/shipbubble/rates")
      ) {
        const shortCode = decodeURIComponent(
          path.replace("/api/v1/public/orders/", "").replace("/shipbubble/rates", "")
        );
        const body = JSON.parse((await readRawBody(req)) || "{}") as {
          deliveryAddress?: string;
        };
        const rates = await engine.fetchOrderShipbubbleRates(shortCode, {
          deliveryAddress: body.deliveryAddress,
        });
        return sendJson(res, 200, rates);
      }

      // 15g-sb2. Public Storefront Buyer Selects Courier Rate (`POST /api/v1/public/orders/:shortCode/shipbubble/select-rate`)
      if (
        req.method === "POST" &&
        path.startsWith("/api/v1/public/orders/") &&
        path.endsWith("/shipbubble/select-rate")
      ) {
        const shortCode = decodeURIComponent(
          path.replace("/api/v1/public/orders/", "").replace("/shipbubble/select-rate", "")
        );
        const body = JSON.parse((await readRawBody(req)) || "{}") as {
          courierId: string;
          serviceCode: string;
          courierName: string;
          rateNaira: number;
          deliveryAddress?: string;
          requestToken?: string;
        };
        await engine.selectPublicOrderShipbubbleRate(shortCode, body);
        return sendJson(res, 200, {
          status: "selected",
          receipt: engine.getPublicOrderReceipt(shortCode),
        });
      }

      // 15g-sf1. Public Storefront & Brand Website Payload (`GET /api/v1/public/storefront` & `GET /api/v1/public/storefront/:slug`)
      if (
        req.method === "GET" &&
        (path === "/api/v1/public/storefront" ||
          (path.startsWith("/api/v1/public/storefront/") && !path.endsWith("/checkout")))
      ) {
        const tierOverride = url.searchParams.get("tier") ?? undefined;
        return sendJson(res, 200, engine.getPublicStorefrontData(tierOverride));
      }

      // 15g-sf2. Public Storefront Instant Checkout (`POST /api/v1/public/storefront/checkout` & `POST /api/v1/public/storefront/:slug/checkout`)
      if (
        req.method === "POST" &&
        (path === "/api/v1/public/storefront/checkout" ||
          (path.startsWith("/api/v1/public/storefront/") && path.endsWith("/checkout")))
      ) {
        const body = JSON.parse((await readRawBody(req)) || "{}") as Parameters<
          typeof engine.createPublicStorefrontOrder
        >[0];
        const created = await engine.createPublicStorefrontOrder(body);
        return sendJson(res, 201, {
          status: "created",
          orderShortCode: created.orderShortCode,
          receipt: created.receipt,
          state: created.state,
        });
      }

      // 15g-sf3. Dashboard REST API: Get or Update Storefront & Website Config (`GET/PUT/PATCH /api/v1/vendor/storefront`)
      if (req.method === "GET" && path === "/api/v1/vendor/storefront") {
        const tierOverride = url.searchParams.get("tier") ?? undefined;
        return sendJson(res, 200, {
          storefrontConfig: engine.getStorefrontConfig(tierOverride),
        });
      }

      if (
        (req.method === "PUT" || req.method === "PATCH" || req.method === "POST") &&
        path === "/api/v1/vendor/storefront"
      ) {
        const body = JSON.parse((await readRawBody(req)) || "{}") as {
          config?: Record<string, unknown>;
          roleOrPlan?: string;
        } & Record<string, unknown>;
        const configPayload =
          body.config && typeof body.config === "object" ? body.config : body;
        const storefrontConfig = engine.updateStorefrontConfig(
          configPayload,
          typeof body.roleOrPlan === "string" ? body.roleOrPlan : undefined
        );
        await engine.flushPersistence();
        return sendJson(res, 200, {
          status: "saved",
          storefrontConfig,
          state: engine.serializeState(),
        });
      }

      // 15h. Dashboard REST API: Publish Inventory to the WhatsApp Business Catalog
      if (req.method === "POST" && path === "/api/v1/vendor/catalog/sync") {
        const rawBody = await readRawBody(req);
        const body = rawBody
          ? (JSON.parse(rawBody) as { deleteMissing?: boolean })
          : {};
        const result = await engine.syncWhatsAppCatalog({
          deleteMissing: body.deleteMissing ?? true,
        });
        return sendJson(res, 200, { result, state: engine.serializeState() });
      }

      // 15i. Shipbubble Logistics API: Fetch Couriers, Wallet Balance & Config (`GET /api/v1/vendor/shipbubble/couriers`)
      if (req.method === "GET" && path === "/api/v1/vendor/shipbubble/couriers") {
        const [couriers, wallet] = await Promise.all([
          engine.shipbubble.fetchCouriers(),
          engine.shipbubble.getWalletBalance(),
        ]);
        return sendJson(res, 200, {
          mode: engine.shipbubble.getMode(),
          couriers,
          wallet,
          config: engine.getShipbubbleConfig(),
          isHighestTier: engine.isHighestSubscriptionVendor(),
        });
      }

      // 15j. Shipbubble Logistics API: Validate Vendor Pickup Address (`POST /api/v1/vendor/shipbubble/validate-address`)
      if (req.method === "POST" && path === "/api/v1/vendor/shipbubble/validate-address") {
        const body = JSON.parse((await readRawBody(req)) || "{}") as {
          address?: string;
        };
        const result = await engine.validateVendorPickupAddress(body.address ?? "");
        return sendJson(res, 200, {
          ...result,
          state: engine.serializeState(),
        });
      }

      // 15k. Shipbubble Logistics API: Update Vendor Shipbubble Config (`PATCH /api/v1/vendor/shipbubble/config`)
      if (
        (req.method === "PATCH" || req.method === "POST") &&
        path === "/api/v1/vendor/shipbubble/config"
      ) {
        const body = JSON.parse((await readRawBody(req)) || "{}") as Record<string, unknown>;
        const config = engine.updateShipbubbleConfig(body);
        return sendJson(res, 200, {
          config,
          state: engine.serializeState(),
        });
      }

      // 15l. Shipbubble Logistics API: Fetch Live Order Courier Rates (`POST /api/v1/vendor/orders/:code/shipbubble/rates`)
      if (
        req.method === "POST" &&
        path.startsWith("/api/v1/vendor/orders/") &&
        path.endsWith("/shipbubble/rates")
      ) {
        const shortCode = decodeURIComponent(
          path.replace("/api/v1/vendor/orders/", "").replace("/shipbubble/rates", "")
        );
        const body = JSON.parse((await readRawBody(req)) || "{}") as {
          deliveryAddress?: string;
          weightPreset?: "SMALL_BAG" | "SHOEBOX" | "CARTON" | "CUSTOM";
          customWeightKg?: number;
        };
        const rates = await engine.fetchOrderShipbubbleRates(shortCode, body);
        return sendJson(res, 200, rates);
      }

      // 15m. Shipbubble Logistics API: Book Courier & Generate Official Courier Receipt (`POST /api/v1/vendor/orders/:code/shipbubble/book`)
      if (
        req.method === "POST" &&
        path.startsWith("/api/v1/vendor/orders/") &&
        path.endsWith("/shipbubble/book")
      ) {
        const shortCode = decodeURIComponent(
          path.replace("/api/v1/vendor/orders/", "").replace("/shipbubble/book", "")
        );
        const body = JSON.parse((await readRawBody(req)) || "{}") as {
          requestToken?: string;
          courierId?: string;
          serviceCode?: string;
          deliveryAddress?: string;
          weightPreset?: "SMALL_BAG" | "SHOEBOX" | "CARTON" | "CUSTOM";
          customWeightKg?: number;
        };
        const booked = await engine.bookOrderShipbubbleCourier(shortCode, body);
        return sendJson(res, 200, {
          status: "booked",
          receipt: booked.receipt,
          state: engine.serializeState(),
        });
      }

      // 15n. Shipbubble Logistics API: Simulate / Update Courier Tracking Status (`POST /api/v1/vendor/orders/:code/shipbubble/simulate-status`)
      if (
        req.method === "POST" &&
        path.startsWith("/api/v1/vendor/orders/") &&
        path.endsWith("/shipbubble/simulate-status")
      ) {
        const shortCode = decodeURIComponent(
          path.replace("/api/v1/vendor/orders/", "").replace("/shipbubble/simulate-status", "")
        );
        const body = JSON.parse((await readRawBody(req)) || "{}") as {
          status: "pending" | "confirmed" | "picked_up" | "in_transit" | "completed" | "cancelled";
        };
        const updated = await engine.handleShipbubbleWebhook({
          orderShortCode: shortCode,
          status: body.status,
        });
        return sendJson(res, 200, {
          status: updated.receipt.status,
          receipt: updated.receipt,
          state: engine.serializeState(),
        });
      }

      // 15o. Shipbubble Inbound Webhook (`POST /webhooks/shipbubble` or `POST /api/v1/integrations/shipbubble/webhook`)
      if (
        req.method === "POST" &&
        (path === "/webhooks/shipbubble" || path === "/api/v1/integrations/shipbubble/webhook")
      ) {
        const rawBody = await readRawBody(req);
        const signature = req.headers["x-ship-signature"];
        if (
          typeof signature === "string" &&
          signature.length > 0 &&
          !engine.shipbubble.verifyWebhookSignature(rawBody, signature)
        ) {
          return sendJson(res, 401, { error: "Invalid Shipbubble x-ship-signature." });
        }
        const payload = JSON.parse(rawBody || "{}") as {
          event?: string;
          status?: "pending" | "confirmed" | "picked_up" | "in_transit" | "completed" | "cancelled";
          order_id?: string;
          orderShortCode?: string;
          tracking_url?: string;
          waybill_document?: string;
          courier?: { name?: string; tracking_code?: string };
        };
        const updated = await engine.handleShipbubbleWebhook(payload);
        return sendJson(res, 200, {
          status: "processed",
          receipt: updated.receipt,
        });
      }

      // 16. Local Simulator Endpoint: WhatsApp / Instagram / Facebook Vendor Keyword OR Buyer Inquiry (`POST /api/v1/simulate/whatsapp`)
      if (req.method === "POST" && path === "/api/v1/simulate/whatsapp") {
        const body = JSON.parse(await readRawBody(req)) as {
          role: "VENDOR_KEYWORD" | "BUYER_INQUIRY" | "VENDOR_MANUAL_BUYER_REPLY";
          text: string;
          attachedImageUrl?: string;
          buyerPhone?: string;
          buyerName?: string;
          quotedStatusImagePhash?: string;
          simulateFastForwardIdleTimer?: boolean;
          sourceChannel?: "WHATSAPP" | "INSTAGRAM" | "FACEBOOK";
        };

        let attachedImageUrl = body.attachedImageUrl;
        let attachedPhash = body.quotedStatusImagePhash;

        // Extract inline image URL from message text if no explicit attachedImageUrl provided
        if (!attachedImageUrl && body.text) {
          const urlMatch =
            body.text.match(/https?:\/\/[^\s,]+(?:\.(?:jpg|jpeg|png|webp|gif|svg)|\?[^\s,]*)/i) ||
            body.text.match(/https?:\/\/images\.unsplash\.com\/[^\s,]+/i);
          if (urlMatch) {
            attachedImageUrl = urlMatch[0];
          }
        }

        if (attachedImageUrl && attachedImageUrl.startsWith("data:")) {
          const saved = await mediaStore.saveDataUrl(attachedImageUrl);
          if (saved) {
            const apiBase = process.env.API_BASE_URL || "http://localhost:4000";
            attachedImageUrl = `${apiBase}/api/v1/media/${encodeURIComponent(saved.mediaId)}`;
            attachedPhash = attachedPhash || saved.phash;
          }
        } else if (attachedImageUrl && /^https?:\/\//i.test(attachedImageUrl)) {
          if (!attachedPhash) {
            try {
              const saved = await mediaStore.saveFromUrl(attachedImageUrl);
              if (saved) {
                attachedPhash = saved.phash;
              }
            } catch {
              // Non-blocking if remote host fails
            }
          }
        }

        if (body.role === "VENDOR_KEYWORD") {
          const resData = await engine.handleVendorWhatsAppKeyword(
            body.text,
            attachedImageUrl,
            attachedPhash
          );
          return sendJson(res, 200, { ...resData, state: engine.serializeState() });
        }

        if (body.role === "VENDOR_MANUAL_BUYER_REPLY") {
          if (body.text.trim().toLowerCase() === "resume" || body.text.trim().toLowerCase() === "resume copilot") {
            await engine.handleResumeCopilot(body.buyerPhone);
          } else {
            await engine.recordVendorManualReplyInBuyerThread(body.text, body.buyerPhone);
          }
          return sendJson(res, 200, { state: engine.serializeState() });
        }

        const inquiryResult = await engine.handleBuyerWhatsAppInquiry({
          buyerPhone: body.buyerPhone ?? "+2348099887766",
          buyerName: body.buyerName ?? "Chidinma Okafor",
          text: body.text,
          quotedStatusImagePhash: attachedPhash,
          attachedImageUrl,
          simulateFastForwardIdleTimer: body.simulateFastForwardIdleTimer ?? true,
          sourceChannel: body.sourceChannel,
        });

        return sendJson(res, 200, { ...inquiryResult, state: engine.serializeState() });
      }

      // 16b. Unified Meta Messenger Platform & Instagram Direct Webhook (`GET /webhooks/meta` & `POST /webhooks/meta`)
      if (req.method === "GET" && path === "/webhooks/meta") {
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const expectedToken =
          process.env.META_VERIFY_TOKEN ??
          process.env.WHATSAPP_VERIFY_TOKEN ??
          "caterlog-whatsapp-verify-token";

        if (mode === "subscribe" && token === expectedToken && challenge) {
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end(challenge);
          return;
        }
        return sendJson(res, 403, { error: "Invalid Meta webhook verification token" });
      }

      if (req.method === "POST" && path === "/webhooks/meta") {
        const rawBody = await readRawBody(req);
        const body = JSON.parse(rawBody || "{}") as Parameters<
          typeof engine.handleMetaSocialWebhook
        >[0];
        const socialResult = await engine.handleMetaSocialWebhook(body);
        return sendJson(res, 200, {
          status: "acknowledged",
          ...socialResult,
          state: engine.serializeState(),
        });
      }

      // 17. Local Simulator Endpoint: Monnify Bank Transfer (`POST /api/v1/simulate/monnify-transfer`)
      if (req.method === "POST" && path === "/api/v1/simulate/monnify-transfer") {
        if (!engine.monnify.isMockMode()) {
          throw new HttpError(
            409,
            `Manual transfer simulation is disabled while MONNIFY_MODE=${engine.monnify.getMode()}. Use the Monnify Bank Simulator for sandbox transfers, or switch MONNIFY_MODE=mock for local testing.`
          );
        }
        const body = JSON.parse(await readRawBody(req)) as {
          orderShortCode: string;
          amountNaira: number;
          payerName?: string;
        };
        const order = engine.orders.find(
          (o) => o.shortCode.toUpperCase() === body.orderShortCode.toUpperCase()
        );
        if (!order) {
          return sendJson(res, 404, { error: `Order ${body.orderShortCode} not found` });
        }

        const txRef = `MNFY|SIM|${order.shortCode}|${Date.now()}`;
        engine.monnify.seedMockVerifiedTransfer({
          providerTransactionRef: txRef,
          paymentReference: order.invoiceReference,
          invoiceReference: order.invoiceReference,
          paymentStatus: "PAID",
          amountPaidKobo: nairaToKobo(body.amountNaira),
          payerName: body.payerName ?? order.customerName,
          payerBankName: "OPay / GTBank",
          paymentMethod: "ACCOUNT_TRANSFER",
          serverVerifiedAt: new Date(),
          rawResponse: { simulated: true, orderShortCode: order.shortCode },
        });

        const rawPayload = JSON.stringify({
          eventType: "SUCCESSFUL_TRANSACTION",
          eventData: {
            transactionReference: txRef,
            paymentReference: order.invoiceReference,
            amountPaid: body.amountNaira,
          },
        });
        const signature = engine.monnify.signPayloadForTesting(rawPayload);

        const rec = await engine.reconcileMonnifyWebhook({
          rawBody: rawPayload,
          signatureHeader: signature,
          providerTransactionRef: txRef,
        });

        return sendJson(res, 200, {
          reconciliationStatus: rec.status,
          remainingBalanceKobo: rec.remainingBalanceKobo.toString(),
          state: engine.serializeState(),
        });
      }

      return sendJson(res, 404, { error: `Route not found: ${req.method} ${path}` });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = err instanceof HttpError ? err.status : 400;
      return sendJson(res, status, { error: message });
    }
  });

  return { server, engine };
}

const MAX_BODY_BYTES = 25 * 1024 * 1024; // 25 MB allows high-resolution mobile camera uploads

function readRawBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let rejected = false;
    req.on("data", (chunk: Buffer) => {
      if (rejected) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        rejected = true;
        reject(new HttpError(413, "Request body exceeds the maximum 25 MB limit."));
        req.resume(); // drain incoming data gracefully without destroying TCP socket
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!rejected) {
        resolve(Buffer.concat(chunks).toString("utf8"));
      }
    });
    req.on("error", (err) => {
      if (!rejected) reject(err);
    });
  });
}

function sendJson(res: http.ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify(data, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

// Start server if invoked directly
const isDirectEntry =
  Boolean(process.argv[1]) &&
  (import.meta.url === `file://${process.argv[1]}` ||
    import.meta.url.endsWith(process.argv[1].replace(/^\.?\//, "")) ||
    process.argv[1].endsWith("server.ts"));

if (isDirectEntry) {
  const port = Number(process.env.API_PORT ?? 4000);

  const start = async () => {
    const { engine, dataMode, vendorSlug, scheduler, jobsConfig, shutdown } =
      await createEngineFromEnv();

    const { server } = createCaterlogApiServer(engine);

    // Schedule repeatable sweep via background scheduler, or fallback to interval if disabled
    let expiryTimer: NodeJS.Timeout | null = null;
    if (scheduler) {
      await scheduler.scheduleRepeat(
        "order-expiry-sweep",
        { name: "order-expiry-sweep", payload: {} },
        jobsConfig.sweepIntervalMs
      );
    } else {
      expiryTimer = setInterval(() => {
        void engine.expireOverdueOrders().catch((err) => {
          console.error("Reservation expiry sweep failed:", err);
        });
      }, jobsConfig.sweepIntervalMs);
      expiryTimer.unref();
    }

    const shutDown = async (signal: string) => {
      console.log(`\n[caterlog] ${signal} received — shutting down...`);
      if (expiryTimer) clearInterval(expiryTimer);
      server.close();
      try {
        await shutdown();
      } catch (err) {
        console.error("[caterlog] Persistence shutdown failed:", err);
      }
      process.exit(0);
    };
    process.once("SIGINT", () => void shutDown("SIGINT"));
    process.once("SIGTERM", () => void shutDown("SIGTERM"));

    server.listen(port, () => {
      const status = engine.getIntegrationStatus();
      console.log(`🚀 Caterlog Stage 1 API & Webhook Server listening on http://localhost:${port}`);
      console.log(`   • Vendor Dashboard:  ${process.env.DASHBOARD_URL ?? "http://localhost:3000"}`);
      console.log(`   • Data mode:         ${dataMode}${dataMode === "database" ? ` (vendor: ${vendorSlug})` : ""}`);
      console.log(
        `   • Jobs:              mode=${jobsConfig.mode}${scheduler ? ` (sweep every ${Math.round(jobsConfig.sweepIntervalMs / 1000)}s)` : ""}`
      );
      console.log(
        `   • Modes:             Monnify=${status.monnify.mode}  WhatsApp=${status.whatsapp.mode}  Catalog=${status.catalog.mode}`
      );
      for (const issue of status.issues) {
        console.warn(`   ⚠️  [${issue.severity}] ${issue.variable}: ${issue.message}`);
      }
      console.log(`   • WhatsApp Webhook:  http://localhost:${port}/webhooks/whatsapp`);
      console.log(`   • Monnify Webhook:   http://localhost:${port}/webhooks/monnify`);
      console.log(`   • Dynamic OG Card:   http://localhost:${port}/og/product/SHOE-01`);
      console.log(`   • Vendor State API:  http://localhost:${port}/api/v1/vendor/state`);
    });
  };

  start().catch((err) => {
    console.error("Failed to start the Caterlog API:", err);
    process.exit(1);
  });
}
