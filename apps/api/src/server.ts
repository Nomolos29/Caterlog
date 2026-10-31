import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { URL, fileURLToPath } from "node:url";
import { nairaToKobo } from "@caterlog/commerce-core";
import { CaterlogStage1Engine } from "./runtime-engine.ts";
import { renderDynamicProductOgSvg } from "./og-card.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dashboardHtmlPath = path.resolve(__dirname, "../../dashboard/src/index.html");

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
      // 0. Serve Vendor Command Dashboard at root `GET /`
      if (req.method === "GET" && (path === "/" || path === "/dashboard")) {
        const html = fs.readFileSync(dashboardHtmlPath, "utf8");
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }

      // 1. Health Check
      if (req.method === "GET" && path === "/health") {
        return sendJson(res, 200, { status: "ok", stage: "Stage 1 — Chat Commerce Core" });
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
        req.on("close", () => sseClients.delete(res));
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
        const body = JSON.parse(rawBody || "{}") as {
          entry?: Array<{
            changes?: Array<{
              field?: string;
              value?: {
                messages?: Array<{
                  from?: string;
                  text?: { body?: string };
                  image?: { caption?: string; sha256?: string };
                }>;
                message_echoes?: Array<{
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
            // Handle Coexistence `message_echoes` (Vendor replied from mobile app)
            for (const echo of val?.message_echoes ?? []) {
              if (echo.text?.body) {
                await engine.recordVendorManualReplyInBuyerThread(echo.text.body);
              }
            }
            // Handle inbound messages (Vendor Keyword CLI or Buyer Inquiry)
            for (const msg of val?.messages ?? []) {
              const fromPhone = msg.from
                ? msg.from.startsWith("+")
                  ? msg.from
                  : `+${msg.from}`
                : "";
              const text = msg.text?.body ?? msg.image?.caption ?? "";
              if (!text) continue;

              const cleanVendorPhone = engine.vendor.whatsappPhone.replace(/\+/g, "");
              const cleanFromPhone = fromPhone.replace(/\+/g, "");

              if (cleanFromPhone === cleanVendorPhone) {
                await engine.handleVendorWhatsAppKeyword(text);
              } else {
                await engine.handleBuyerWhatsAppInquiry({
                  buyerPhone: fromPhone,
                  text,
                  quotedStatusImagePhash: msg.image?.sha256?.slice(0, 16),
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
        const signature = req.headers["monnify-signature"] as string | undefined;
        const parsed = JSON.parse(rawBody || "{}") as {
          eventData?: { transactionReference?: string };
        };
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

      // 7. Dashboard REST API: Full Vendor State (`GET /api/v1/vendor/state`)
      if (req.method === "GET" && path === "/api/v1/vendor/state") {
        return sendJson(res, 200, engine.serializeState());
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
          priceNaira: number | string;
          stockTotal: number;
          category?: string;
        };
        engine.addProduct({
          skuCode: body.skuCode,
          name: body.name,
          basePriceKobo: nairaToKobo(body.priceNaira),
          stockTotal: Number(body.stockTotal),
          category: body.category,
        });
        return sendJson(res, 201, engine.serializeState());
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
        engine.updateProductStock(sku, Number(body.stockTotal));
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
        engine.deleteShippingZone(code);
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
        engine.deactivateDiscount(code);
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
        await engine.dispatchOrder(shortCode, body.riderPhone);
        return sendJson(res, 200, engine.serializeState());
      }

      // 16. Local Simulator Endpoint: WhatsApp Vendor Keyword OR Buyer Inquiry (`POST /api/v1/simulate/whatsapp`)
      if (req.method === "POST" && path === "/api/v1/simulate/whatsapp") {
        const body = JSON.parse(await readRawBody(req)) as {
          role: "VENDOR_KEYWORD" | "BUYER_INQUIRY" | "VENDOR_MANUAL_BUYER_REPLY";
          text: string;
          buyerPhone?: string;
          buyerName?: string;
          quotedStatusImagePhash?: string;
          simulateFastForwardIdleTimer?: boolean;
        };

        if (body.role === "VENDOR_KEYWORD") {
          const resData = await engine.handleVendorWhatsAppKeyword(body.text);
          return sendJson(res, 200, { ...resData, state: engine.serializeState() });
        }

        if (body.role === "VENDOR_MANUAL_BUYER_REPLY") {
          await engine.recordVendorManualReplyInBuyerThread(body.text);
          return sendJson(res, 200, { state: engine.serializeState() });
        }

        const inquiryResult = await engine.handleBuyerWhatsAppInquiry({
          buyerPhone: body.buyerPhone ?? "+2348099887766",
          buyerName: body.buyerName ?? "Chidinma Okafor",
          text: body.text,
          quotedStatusImagePhash: body.quotedStatusImagePhash,
          simulateFastForwardIdleTimer: body.simulateFastForwardIdleTimer ?? true,
        });

        return sendJson(res, 200, { ...inquiryResult, state: engine.serializeState() });
      }

      // 17. Local Simulator Endpoint: Monnify Bank Transfer (`POST /api/v1/simulate/monnify-transfer`)
      if (req.method === "POST" && path === "/api/v1/simulate/monnify-transfer") {
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
      return sendJson(res, 400, { error: message });
    }
  });

  return { server, engine };
}

function readRawBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
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
  const { server } = createCaterlogApiServer();
  server.listen(port, () => {
    console.log(`🚀 Caterlog Stage 1 API & Webhook Server listening on http://localhost:${port}`);
    console.log(`   • WhatsApp Webhook:  http://localhost:${port}/webhooks/whatsapp`);
    console.log(`   • Monnify Webhook:   http://localhost:${port}/webhooks/monnify`);
    console.log(`   • Dynamic OG Card:   http://localhost:${port}/og/product/SHOE-01`);
    console.log(`   • Vendor State API:  http://localhost:${port}/api/v1/vendor/state`);
  });
}
