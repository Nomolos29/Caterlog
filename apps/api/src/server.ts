import http from "node:http";
import { existsSync } from "node:fs";
import { URL } from "node:url";
import { nairaToKobo, parseVendorWhatsAppCommand } from "@caterlog/commerce-core";
import { CaterlogStage1Engine } from "./runtime-engine.ts";
import { createEngineFromEnv } from "./bootstrap.ts";
import { renderDynamicProductOgSvg } from "./og-card.ts";
import { mediaStore } from "./media/media-store.ts";

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
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PATCH, PUT, DELETE, OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, monnify-signature, x-hub-signature-256"
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

      // 1c. Vendor WhatsApp Magic Link / OTP Login Request (`POST /api/v1/auth/whatsapp-otp`)
      if (req.method === "POST" && path === "/api/v1/auth/whatsapp-otp") {
        const rawBody = await readRawBody(req);
        const body = (rawBody ? JSON.parse(rawBody) : {}) as {
          phone?: string;
          vendorSlug?: string;
        };
        const inputPhone = body.phone ? body.phone.replace(/\D/g, "") : null;
        const vendorPhone = engine.vendor.whatsappPhone.replace(/\D/g, "");
        const inputSlug = body.vendorSlug?.trim().toLowerCase();

        if (inputPhone && inputPhone !== vendorPhone && inputSlug !== engine.vendor.slug.toLowerCase()) {
          throw new HttpError(404, "Vendor not found for provided phone or slug.");
        }

        const token = engine.createMagicLinkToken();
        const dashboardUrl = process.env.DASHBOARD_URL ?? "http://localhost:3000";
        const loginUrl = `${dashboardUrl}?token=${token}&magic_vendor=${engine.vendor.slug}`;

        await engine.whatsapp.sendTextMessage({
          toPhone: engine.vendor.whatsappPhone,
          text: `🔐 *Your 1-Tap Dashboard Login Link:*\n${loginUrl}\n\n⏳ _Valid for 15 minutes._`,
          vendorPhoneId: engine.vendor.whatsappPhoneId,
        });

        const masked = engine.vendor.whatsappPhone.replace(
          /(\+\d{3})\d+(\d{4})/,
          "$1****$2"
        );
        return sendJson(res, 200, {
          status: "sent",
          destinationPhone: masked,
          expiresInSeconds: 900,
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

        return sendJson(res, 200, {
          authenticated: true,
          vendor: {
            id: engine.vendor.id,
            slug: engine.vendor.slug,
            businessName: engine.vendor.businessName,
            whatsappPhone: engine.vendor.whatsappPhone,
          },
          state: engine.serializeState(),
        });
      }

      // 2. Real-Time SSE Stream for Dashboard Synchronization
      if (req.method === "GET" && path === "/api/v1/events") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
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

        for (const entry of body.entry ?? []) {
          for (const change of entry.changes ?? []) {
            const val = change.value;
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
                  const rawUrl = msg.image.url || msg.image.link;
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

      // 7. Dashboard REST API: Full Vendor State (`GET /api/v1/vendor/state`)
      if (req.method === "GET" && path === "/api/v1/vendor/state") {
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
        return sendJson(res, 200, engine.serializeState());
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
          id: v.id || `var-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: v.name,
          skuCode: (v.sku || v.skuCode || `${body.skuCode || "ITEM"}-${v.name.slice(0, 3)}`).toUpperCase(),
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
        });
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
          id: v.id || `var-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: v.name,
          skuCode: (v.sku || v.skuCode || `${sku}-${v.name.slice(0, 3)}`).toUpperCase(),
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
        });
        if (!updated) {
          throw new HttpError(404, `Product SKU "${sku}" not found.`);
        }
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
        return sendJson(res, 200, engine.serializeState());
      }

      // 10b. Dashboard REST API: Delete Product (`DELETE /api/v1/vendor/products/:sku`)
      if (req.method === "DELETE" && path.startsWith("/api/v1/vendor/products/")) {
        const sku = decodeURIComponent(path.replace("/api/v1/vendor/products/", ""));
        const deleted = engine.deleteProduct(sku);
        if (!deleted) {
          throw new HttpError(404, `Product SKU "${sku}" not found.`);
        }
        return sendJson(res, 200, engine.serializeState());
      }

      // 11. Dashboard REST API: Upsert Shipping Zone (`POST /api/v1/vendor/shipping-zones`)
      if (req.method === "POST" && path === "/api/v1/vendor/shipping-zones") {
        const body = JSON.parse(await readRawBody(req)) as {
          name: string;
          feeNaira: number | string;
        };
        engine.upsertShippingZone(body.name, nairaToKobo(body.feeNaira));
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
        return sendJson(res, 200, engine.serializeState());
      }

      // 14. Dashboard REST API: Deactivate Discount (`DELETE /api/v1/vendor/discounts/:code`)
      if (req.method === "DELETE" && path.startsWith("/api/v1/vendor/discounts/")) {
        const code = decodeURIComponent(path.replace("/api/v1/vendor/discounts/", ""));
        const deactivated = engine.deactivateDiscount(code);
        if (!deactivated) {
          throw new HttpError(404, `Active discount code "${code}" not found.`);
        }
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

      // 15d. Dashboard REST API: Publish Inventory to the WhatsApp Business Catalog
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

      // 16. Local Simulator Endpoint: WhatsApp Vendor Keyword OR Buyer Inquiry (`POST /api/v1/simulate/whatsapp`)
      if (req.method === "POST" && path === "/api/v1/simulate/whatsapp") {
        const body = JSON.parse(await readRawBody(req)) as {
          role: "VENDOR_KEYWORD" | "BUYER_INQUIRY" | "VENDOR_MANUAL_BUYER_REPLY";
          text: string;
          attachedImageUrl?: string;
          buyerPhone?: string;
          buyerName?: string;
          quotedStatusImagePhash?: string;
          simulateFastForwardIdleTimer?: boolean;
        };

        let attachedImageUrl = body.attachedImageUrl;
        let attachedPhash = body.quotedStatusImagePhash;

        if (attachedImageUrl && attachedImageUrl.startsWith("data:")) {
          const saved = await mediaStore.saveDataUrl(attachedImageUrl);
          if (saved) {
            const apiBase = process.env.API_BASE_URL || "http://localhost:4000";
            attachedImageUrl = `${apiBase}/api/v1/media/${encodeURIComponent(saved.mediaId)}`;
            attachedPhash = attachedPhash || saved.phash;
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
        });

        return sendJson(res, 200, { ...inquiryResult, state: engine.serializeState() });
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

const MAX_BODY_BYTES = 1_000_000;

function readRawBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, "Request body exceeds the 1 MB limit."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
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
if (import.meta.url === `file://${process.argv[1]}`) {
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
