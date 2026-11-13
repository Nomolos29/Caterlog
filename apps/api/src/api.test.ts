import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nairaToKobo } from "@caterlog/commerce-core";
import { CaterlogStage1Engine } from "./runtime-engine.ts";
import { renderDynamicProductOgSvg } from "./og-card.ts";
import { InlineJobScheduler } from "./jobs/inline.ts";
import { createJobHandler } from "./jobs/handler.ts";
import { mediaStore } from "./media/media-store.ts";

describe("Stage 1.4 — Caterlog API & End-to-End Synchronization Engine", () => {
  it("synchronizes WhatsApp Vendor Keywords with Dashboard State (Shipping, Discounts, Stock, Settings)", async () => {
    const engine = new CaterlogStage1Engine();

    // 1. Vendor sends `shipping add Ikoyi 4000` on WhatsApp
    await engine.handleVendorWhatsAppKeyword("shipping add Ikoyi 4000");
    const ikoyiZone = engine.shippingZones.find((z) => z.name === "Ikoyi");
    assert.ok(ikoyiZone);
    assert.equal(ikoyiZone.feeKobo, 400000n);

    // 2. Vendor sends `discount add FLASH20 20%` on WhatsApp
    await engine.handleVendorWhatsAppKeyword("discount add FLASH20 20%");
    const flashPromo = engine.discounts.find((d) => d.code === "FLASH20");
    assert.ok(flashPromo);
    assert.equal(flashPromo.type, "PERCENTAGE");
    assert.equal(flashPromo.value, 2000n);

    // 3. Vendor sends `stock SHOE-01 15` on WhatsApp
    await engine.handleVendorWhatsAppKeyword("stock SHOE-01 15");
    const shoe = engine.products.find((p) => p.skuCode === "SHOE-01");
    assert.equal(shoe?.stockTotal, 15);

    // 4. Vendor sends `mode copilot 90s` and `hold 25` on WhatsApp
    await engine.handleVendorWhatsAppKeyword("mode copilot 90s");
    await engine.handleVendorWhatsAppKeyword("hold 25");
    assert.equal(engine.vendor.copilotMode, "COPILOT");
    assert.equal(engine.vendor.copilotIdleSeconds, 90);
    assert.equal(engine.vendor.reservationTtlMinutes, 25);

    // 5. Vendor adds a variable product with attached photo via WhatsApp
    const attachedPhoto = "https://images.unsplash.com/photo-example-heel.jpg";
    const res = await engine.handleVendorWhatsAppKeyword(
      "Louboutin Pigalle Pump, #45000, sizes: 38 (3), 39 (4), 40 (2)",
      attachedPhoto
    );
    assert.equal(res.commandType, "QUICK_ADD_PRODUCT");
    assert.match(res.replyText, /Variants \(3\)/);

    const louboutin = engine.products.find((p) => p.name === "Louboutin Pigalle Pump");
    assert.ok(louboutin);
    assert.equal(louboutin.primaryImageUrl, attachedPhoto);
    assert.equal(louboutin.stockTotal, 9);
    assert.equal(louboutin.variants?.length, 3);
    assert.equal(louboutin.variants[0].name, "38");
    assert.equal(louboutin.variants[0].stockTotal, 3);
    assert.equal(louboutin.variants[1].name, "39");
    assert.equal(louboutin.variants[1].stockTotal, 4);

    // Verify dashboard serialized state retains image and variants
    const dashboardState = engine.serializeState();
    const serializedProd = dashboardState.products.find((p) => p.name === "Louboutin Pigalle Pump");
    assert.ok(serializedProd);
    assert.equal(serializedProd.primaryImageUrl, attachedPhoto);
    assert.equal(serializedProd.variants?.length, 3);
  });

  it("executes end-to-end WhatsApp Status reply -> Dynamic NUBAN -> Partial & Full Monnify Reconciliation", async () => {
    const engine = new CaterlogStage1Engine();

    // Buyer swipes up on WhatsApp Status photo of BAG-01 (pHash: 9988776655443322) and asks for Lekki delivery
    const inquiry = await engine.handleBuyerWhatsAppInquiry({
      buyerPhone: "+2348055551111",
      buyerName: "Kemi Adebayo",
      text: "I want this bag delivered to Lekki",
      quotedStatusImagePhash: "9988776655443322",
      simulateFastForwardIdleTimer: true,
    });

    assert.ok(inquiry.createdOrder);
    assert.equal(inquiry.createdOrder.productSku, "BAG-01");
    // 42,000 bag + 3,500 Lekki shipping = 45,500 Naira (4,550,000 kobo)
    assert.equal(inquiry.createdOrder.totalAmountKobo, 4550000n);

    // Bag stockReserved incremented from 0 -> 1
    const bagBeforePayment = engine.products.find((p) => p.skuCode === "BAG-01")!;
    assert.equal(bagBeforePayment.stockTotal, 3);
    assert.equal(bagBeforePayment.stockReserved, 1);

    // Step A: Buyer transfers only 42,000 Naira (forgot 3,500 shipping fee)
    const txRef1 = "MNFY_TEST_PARTIAL_001";
    engine.monnify.seedMockVerifiedTransfer({
      providerTransactionRef: txRef1,
      paymentReference: inquiry.createdOrder.invoiceReference,
      invoiceReference: inquiry.createdOrder.invoiceReference,
      paymentStatus: "PAID",
      amountPaidKobo: 4200000n,
      payerName: "Kemi Adebayo",
      paymentMethod: "ACCOUNT_TRANSFER",
      serverVerifiedAt: new Date(),
      rawResponse: {},
    });
    const payload1 = JSON.stringify({ eventData: { transactionReference: txRef1 } });
    const sig1 = engine.monnify.signPayloadForTesting(payload1);

    const partialResult = await engine.reconcileMonnifyWebhook({
      rawBody: payload1,
      signatureHeader: sig1,
      providerTransactionRef: txRef1,
    });
    assert.equal(partialResult.status, "PARTIALLY_PAID");
    assert.equal(partialResult.remainingBalanceKobo, 350000n); // 3,500 Naira remaining

    // Step B: Buyer transfers the remaining 3,500 Naira balance
    const txRef2 = "MNFY_TEST_BALANCE_002";
    engine.monnify.seedMockVerifiedTransfer({
      providerTransactionRef: txRef2,
      paymentReference: inquiry.createdOrder.invoiceReference,
      invoiceReference: inquiry.createdOrder.invoiceReference,
      paymentStatus: "PAID",
      amountPaidKobo: 350000n,
      payerName: "Kemi Adebayo",
      paymentMethod: "ACCOUNT_TRANSFER",
      serverVerifiedAt: new Date(),
      rawResponse: {},
    });
    const payload2 = JSON.stringify({ eventData: { transactionReference: txRef2 } });
    const sig2 = engine.monnify.signPayloadForTesting(payload2);

    const fullResult = await engine.reconcileMonnifyWebhook({
      rawBody: payload2,
      signatureHeader: sig2,
      providerTransactionRef: txRef2,
    });
    assert.equal(fullResult.status, "PAID");
    assert.equal(fullResult.remainingBalanceKobo, 0n);

    // Bag stockTotal decremented from 3 -> 2, and stockReserved released from 1 -> 0
    assert.equal(bagBeforePayment.stockTotal, 2);
    assert.equal(bagBeforePayment.stockReserved, 0);
  });

  it("records overpayments, releases the reservation, and never drives reserved stock negative", async () => {
    const engine = new CaterlogStage1Engine();

    const inquiry = await engine.handleBuyerWhatsAppInquiry({
      buyerPhone: "+2348055552222",
      buyerName: "Bola Adeyemi",
      text: "I want the Hermes Oran Leather Slide delivered to Mainland",
      simulateFastForwardIdleTimer: true,
    });
    assert.ok(inquiry.createdOrder);
    assert.equal(inquiry.createdOrder.totalAmountKobo, 2100000n); // ₦21,000

    const slide = engine.products.find((p) => p.skuCode === "SHOE-02")!;
    assert.equal(slide.stockReserved, 1);

    const txRef = "MNFY_TEST_OVERPAY_001";
    engine.monnify.seedMockVerifiedTransfer({
      providerTransactionRef: txRef,
      paymentReference: inquiry.createdOrder.invoiceReference,
      invoiceReference: inquiry.createdOrder.invoiceReference,
      paymentStatus: "PAID",
      amountPaidKobo: 2500000n, // ₦4,000 too much
      payerName: "Bola Adeyemi",
      paymentMethod: "ACCOUNT_TRANSFER",
      serverVerifiedAt: new Date(),
      rawResponse: {},
    });
    const payload = JSON.stringify({ eventData: { transactionReference: txRef } });

    const result = await engine.reconcileMonnifyWebhook({
      rawBody: payload,
      signatureHeader: engine.monnify.signPayloadForTesting(payload),
      providerTransactionRef: txRef,
    });

    assert.equal(result.status, "PAID");
    assert.equal(result.remainingBalanceKobo, 0n);
    assert.equal(result.overpaidAmountKobo, 400000n);
    assert.equal(inquiry.createdOrder.overpaidAmountKobo, 400000n);
    assert.equal(slide.stockTotal, 7);
    assert.equal(slide.stockReserved, 0);

    const state = engine.serializeState();
    const serialized = state.orders.find((o) => o.shortCode === inquiry.createdOrder!.shortCode)!;
    assert.equal(serialized.overpaidAmountFormatted, "₦4,000");

    // A duplicate webhook for the same provider transaction is ignored.
    const duplicate = await engine.reconcileMonnifyWebhook({
      rawBody: payload,
      signatureHeader: engine.monnify.signPayloadForTesting(payload),
      providerTransactionRef: txRef,
    });
    assert.equal(duplicate.overpaidAmountKobo, 400000n);
    assert.equal(slide.stockTotal, 7);
  });

  it("expires an unpaid reservation, releases stock, and accepts a late payment without double-releasing", async () => {
    const engine = new CaterlogStage1Engine();
    const shoe = engine.products.find((p) => p.skuCode === "SHOE-01")!;
    const order = engine.orders.find((o) => o.shortCode === "ORD-882")!;

    assert.equal(shoe.stockTotal, 5);
    assert.equal(shoe.stockReserved, 1);

    const expired = await engine.expireOrderReservation("ord-882");
    assert.ok(expired);
    assert.equal(expired.status, "EXPIRED");
    assert.equal(expired.reservationReleased, true);
    assert.equal(shoe.stockTotal, 5);
    assert.equal(shoe.stockReserved, 0);

    // Expiring twice is a no-op.
    assert.equal(await engine.expireOrderReservation("ORD-882"), undefined);

    // Late transfer arrives after the hold elapsed: the sale still completes,
    // stockTotal is decremented, and stockReserved is not decremented again.
    const txRef = "MNFY_TEST_LATE_001";
    engine.monnify.seedMockVerifiedTransfer({
      providerTransactionRef: txRef,
      paymentReference: order.invoiceReference,
      invoiceReference: order.invoiceReference,
      paymentStatus: "PAID",
      amountPaidKobo: order.totalAmountKobo,
      payerName: "Chidinma Okafor",
      paymentMethod: "ACCOUNT_TRANSFER",
      serverVerifiedAt: new Date(),
      rawResponse: {},
    });
    const payload = JSON.stringify({ eventData: { transactionReference: txRef } });

    const late = await engine.reconcileMonnifyWebhook({
      rawBody: payload,
      signatureHeader: engine.monnify.signPayloadForTesting(payload),
      providerTransactionRef: txRef,
    });

    assert.equal(late.status, "PAID");
    assert.equal(order.status, "PAID");
    assert.equal(shoe.stockTotal, 4);
    assert.equal(shoe.stockReserved, 0);
  });

  it("expires partially-paid orders and every overdue hold in a sweep", async () => {
    const engine = new CaterlogStage1Engine();

    const inquiry = await engine.handleBuyerWhatsAppInquiry({
      buyerPhone: "+2348055553333",
      buyerName: "Nneka Eze",
      text: "I want this bag delivered to Lekki",
      quotedStatusImagePhash: "9988776655443322",
      simulateFastForwardIdleTimer: true,
    });
    assert.ok(inquiry.createdOrder);

    const bag = engine.products.find((p) => p.skuCode === "BAG-01")!;
    assert.equal(bag.stockReserved, 1);

    const txRef = "MNFY_TEST_PARTIAL_EXPIRE_001";
    engine.monnify.seedMockVerifiedTransfer({
      providerTransactionRef: txRef,
      paymentReference: inquiry.createdOrder.invoiceReference,
      invoiceReference: inquiry.createdOrder.invoiceReference,
      paymentStatus: "PAID",
      amountPaidKobo: 4200000n,
      payerName: "Nneka Eze",
      paymentMethod: "ACCOUNT_TRANSFER",
      serverVerifiedAt: new Date(),
      rawResponse: {},
    });
    const payload = JSON.stringify({ eventData: { transactionReference: txRef } });
    const partial = await engine.reconcileMonnifyWebhook({
      rawBody: payload,
      signatureHeader: engine.monnify.signPayloadForTesting(payload),
      providerTransactionRef: txRef,
    });
    assert.equal(partial.status, "PARTIALLY_PAID");

    // Force both the seeded order and the new partial order past their windows.
    for (const order of engine.orders) {
      if (order.status === "PENDING_PAYMENT" || order.status === "PARTIALLY_PAID") {
        order.paymentExpiresAt = new Date(Date.now() - 60_000);
      }
    }

    const swept = await engine.expireOverdueOrders();
    assert.equal(swept.length, 2);
    assert.ok(swept.every((o) => o.status === "EXPIRED" && o.reservationReleased));
    assert.equal(bag.stockReserved, 0);
  });

  it("rejects invalid catalog, shipping, discount, and settings input", async () => {
    const engine = new CaterlogStage1Engine();

    assert.throws(
      () => engine.addProduct({ name: "   ", basePriceKobo: 100n, stockTotal: 1 }),
      /Product name is required/
    );
    assert.throws(
      () => engine.addProduct({ name: "Freebie", basePriceKobo: 0n, stockTotal: 1 }),
      /price must be greater than/
    );
    assert.throws(
      () => engine.addProduct({ name: "Bad Stock", basePriceKobo: 100n, stockTotal: 1.5 }),
      /whole number/
    );
    assert.throws(
      () =>
        engine.addProduct({
          skuCode: "!",
          name: "Bad SKU",
          basePriceKobo: 100n,
          stockTotal: 1,
        }),
      /SKU must be/
    );

    // SHOE-01 has 1 unit reserved, so the total cannot drop below it.
    assert.throws(() => engine.updateProductStock("SHOE-01", 0), /currently reserved by buyers/);
    assert.throws(() => engine.updateProductStock("SHOE-01", -1), /whole number/);
    assert.equal(engine.updateProductStock("SHOE-01", 1)?.stockTotal, 1);
    assert.equal(engine.updateProductStock("NOPE-00", 1), undefined);

    assert.throws(() => engine.upsertShippingZone("  ", 100n), /name is required/);
    assert.throws(() => engine.upsertShippingZone("Bad", -1n), /cannot be negative/);
    assert.equal(engine.upsertShippingZone("Lekki", 400000n).code, 2);

    assert.throws(
      () => engine.upsertDiscount({ code: " ", type: "PERCENTAGE", value: 1000n }),
      /cannot be empty/
    );
    assert.throws(
      () => engine.upsertDiscount({ code: "OVER", type: "PERCENTAGE", value: 10001n }),
      /between 0.01% and 100%/
    );
    assert.throws(
      () => engine.upsertDiscount({ code: "FREE", type: "FLAT_KOBO", value: 0n }),
      /greater than/
    );

    // Settings are clamped into safe ranges rather than persisted out of bounds.
    engine.updateSettings({ copilotIdleSeconds: 1, reservationTtlMinutes: 10_000 });
    assert.equal(engine.vendor.copilotIdleSeconds, 5);
    assert.equal(engine.vendor.reservationTtlMinutes, 180);
  });

  it("does not apply discounts that are exhausted or expired", async () => {
    const engine = new CaterlogStage1Engine();
    const payday = engine.discounts.find((d) => d.code === "PAYDAY")!;
    payday.usedCount = payday.maxUses!;

    const exhausted = await engine.handleBuyerWhatsAppInquiry({
      buyerPhone: "+2348055554444",
      buyerName: "Kemi Exhausted",
      text: "I want the Zara Block Heel delivered to Lekki with PAYDAY",
      simulateFastForwardIdleTimer: true,
    });
    assert.ok(exhausted.createdOrder);
    assert.equal(exhausted.createdOrder.discountAmountKobo, 0n);
    assert.equal(exhausted.createdOrder.discountCode, undefined);

    const vip = engine.discounts.find((d) => d.code === "VIP5000")!;
    vip.expiresAt = new Date(Date.now() - 60_000);

    const expired = await engine.handleBuyerWhatsAppInquiry({
      buyerPhone: "+2348055555555",
      buyerName: "Tunde Expired",
      text: "I want the Jacquemus Le Chiquito Mini Bag delivered to Lekki with VIP5000",
      simulateFastForwardIdleTimer: true,
    });
    assert.ok(expired.createdOrder);
    assert.equal(expired.createdOrder.discountAmountKobo, 0n);
    assert.equal(expired.createdOrder.discountCode, undefined);
  });

  it("polls Monnify for a pending payment and applies it without a webhook", async () => {
    const engine = new CaterlogStage1Engine();
    const order = engine.orders.find((o) => o.shortCode === "ORD-882")!;

    const pending = await engine.verifyOrderPayment("ord-882");
    assert.ok(pending);
    assert.equal(pending.status, "PENDING");
    assert.equal(pending.applied, false);
    assert.equal(order.status, "PENDING_PAYMENT");

    engine.monnify.seedMockVerifiedTransfer({
      providerTransactionRef: "MNFY_POLL_001",
      paymentReference: order.invoiceReference,
      invoiceReference: order.invoiceReference,
      paymentStatus: "PAID",
      amountPaidKobo: order.totalAmountKobo,
      payerName: "Chidinma Okafor",
      paymentMethod: "ACCOUNT_TRANSFER",
      serverVerifiedAt: new Date(),
      rawResponse: {},
    });

    const paid = await engine.verifyOrderPayment("ORD-882");
    assert.ok(paid);
    assert.equal(paid.status, "PAID");
    assert.equal(paid.applied, true);
    assert.equal(order.status, "PAID");

    // Polling twice must not double-apply the same provider transaction.
    const duplicate = await engine.verifyOrderPayment("ORD-882");
    assert.ok(duplicate);
    assert.equal(duplicate.applied, false);
    assert.equal(duplicate.status, "PAID");

    assert.equal(await engine.verifyOrderPayment("ORD-UNKNOWN"), undefined);
  });

  it("publishes the inventory to the WhatsApp catalog and records sync state", async () => {
    const engine = new CaterlogStage1Engine();
    const result = await engine.syncWhatsAppCatalog();

    assert.equal(result.mode, "mock");
    assert.equal(result.attempted, engine.products.length);
    assert.equal(result.upserted, engine.products.length);
    assert.equal(result.failed.length, 0);

    const status = engine.catalog.getIntegrationStatus();
    assert.equal(status.publishedItems, engine.products.length);
    assert.ok(status.lastSyncedAt);

    const state = engine.serializeState();
    assert.equal(state.catalogSync.publishedItems, engine.products.length);
    assert.equal(state.integrations.catalog.mode, "mock");
    assert.equal(state.integrations.monnify.mode, "mock");
  });

  it("handles vendor 'sync catalog' keyword command and resolves relative or empty image URLs safely", async () => {
    const engine = new CaterlogStage1Engine();

    // Add product with relative media URL and product with empty image URL
    engine.addProduct({
      name: "Custom Local Bag",
      basePriceKobo: 15_000_00n,
      stockTotal: 5,
      primaryImageUrl: "/api/v1/media/med_test123",
    });
    engine.addProduct({
      name: "No Image Slippers",
      basePriceKobo: 8_000_00n,
      stockTotal: 10,
      primaryImageUrl: "",
    });

    const vendorRes = await engine.handleVendorWhatsAppKeyword("sync catalog");
    assert.equal(vendorRes.commandType, "SYNC_CATALOG");
    assert.ok(vendorRes.replyText.includes("WhatsApp Business Catalog Synced"));
    assert.ok(vendorRes.replyText.includes("Successfully Upserted"));

    // Verify mock catalog items all received valid absolute http(s) image URLs
    const items = engine.catalog.getMockCatalog();
    assert.ok(items.length >= 6);
    for (const item of items) {
      assert.ok(item.image_url, `Expected image_url for ${item.retailer_id}`);
      assert.ok(/^https?:\/\//.test(item.image_url), `Expected valid http(s) URL for ${item.retailer_id}, got ${item.image_url}`);
    }
  });

  it("renders Dynamic OpenGraph Product Card SVG with price, live stock, and verified badge", () => {
    const svg = renderDynamicProductOgSvg({
      vendorName: "Amaka Luxury Shoes",
      isVerified: true,
      skuCode: "SHOE-01",
      productName: "Zara Block Heel (Gold)",
      priceKobo: 2500000n,
      availableStock: 4,
    });
    assert.ok(svg.includes("✓ Verified Caterlog Seller"));
    assert.ok(svg.includes("₦25,000"));
    assert.ok(svg.includes("4 Left in Stock"));
  });

  it("creates and verifies vendor magic link login tokens and rejects invalid or expired tokens", async () => {
    const engine = new CaterlogStage1Engine();

    // 1. Vendor types `dashboard`
    const res = await engine.handleVendorWhatsAppKeyword("dashboard");
    assert.ok(res.replyText.includes("token="));

    const tokenMatch = /token=([a-f0-9]+)/.exec(res.replyText);
    assert.ok(tokenMatch && tokenMatch[1]);
    const token = tokenMatch[1];

    // 2. Verify token
    const verified = engine.verifyMagicLinkToken(token);
    assert.ok(verified);
    assert.equal(verified.token, token);
    assert.equal(verified.vendorSlug, engine.vendor.slug);

    // 3. Second verification fails (single-use)
    const secondTry = engine.verifyMagicLinkToken(token);
    assert.equal(secondTry, null);

    // 4. Invalid token fails
    const invalid = engine.verifyMagicLinkToken("fake-token-1234");
    assert.equal(invalid, null);
  });

  it("schedules order-expiry and payment-reminder jobs and executes them via job handler", async () => {
    const engine = new CaterlogStage1Engine();
    const scheduler = new InlineJobScheduler();
    const handler = createJobHandler(engine);
    await scheduler.start(handler);
    engine.attachJobScheduler(scheduler);

    // 1. Create order
    const inquiry = await engine.handleBuyerWhatsAppInquiry({
      buyerPhone: "+2348011223344",
      buyerName: "Tolu Adeleke",
      text: "I want SHOE-01 delivered to Lekki",
      simulateFastForwardIdleTimer: true,
    });
    assert.ok(inquiry.createdOrder);
    const orderCode = inquiry.createdOrder.shortCode;

    // Verify jobs are scheduled
    const status = scheduler.getStatus();
    assert.equal(status.mode, "inline");
    assert.ok((status.pending ?? 0) >= 1);

    // 2. Test standard payment reminder directly via handler
    await handler({ name: "payment-reminder", payload: { orderShortCode: orderCode, minutesRemaining: 5 } });
    const reminderMsg = engine.chatMessages[engine.chatMessages.length - 2];
    assert.ok(reminderMsg.text.includes("Payment Reminder"));

    // 3. Test urgent 2-minute payment reminder directly via handler
    await handler({ name: "payment-reminder-2min", payload: { orderShortCode: orderCode } });
    const urgentMsg = engine.chatMessages[engine.chatMessages.length - 2];
    assert.ok(urgentMsg.text.includes("URGENT: 2 MINUTES LEFT"));
    assert.ok(urgentMsg.text.includes("2-minute countdown ends"));

    // 4. Test order expiry via handler: stock released and DO NOT PAY notice sent to customer
    await handler({ name: "order-expiry", payload: { orderShortCode: orderCode } });
    const expiredOrder = engine.orders.find((o) => o.shortCode === orderCode);
    assert.equal(expiredOrder?.status, "EXPIRED");
    assert.equal(expiredOrder?.reservationReleased, true);

    const expiryNotice = engine.chatMessages.find(
      (m) => m.channel === "BUYER_SHOP_WA" && m.text.includes("ORDER EXPIRED — DO NOT PAY")
    );
    assert.ok(expiryNotice, "Customer must receive explicit 'ORDER EXPIRED — DO NOT PAY' notification");
    assert.ok(expiryNotice.text.includes("PLEASE DO NOT TRANSFER FUNDS TO THIS ACCOUNT"));
    assert.ok(expiryNotice.text.includes(inquiry.createdOrder.accountNumber));
    assert.ok(expiryNotice.quickReplies && expiryNotice.quickReplies.some((qr) => qr.replyText.startsWith("I want")));

    await scheduler.stop();
  });

  it("handles categorized vendor Help menu with interactive button-like quick replies", async () => {
    const engine = new CaterlogStage1Engine();
    const result = await engine.handleVendorWhatsAppKeyword("help");

    assert.equal(result.commandType, "HELP_MENU");
    assert.ok(result.replyText.includes("CATALOG & INVENTORY"));
    assert.ok(result.replyText.includes("SALES & ORDERS"));
    assert.ok(result.replyText.includes("SHIPPING & DISCOUNTS"));
    assert.ok(result.replyText.includes("SETTINGS & CO-PILOT"));

    const botMsg = engine.chatMessages.find(
      (m) => m.channel === "VENDOR_ADMIN_WA" && m.sender === "CATERLOG_BOT" && m.quickReplies
    );
    assert.ok(botMsg);
    assert.ok(botMsg.quickReplies && botMsg.quickReplies.length >= 5);
    const replyTexts = botMsg.quickReplies.map((qr) => qr.replyText);
    assert.ok(replyTexts.includes("products"));
    assert.ok(replyTexts.includes("sales"));
    assert.ok(replyTexts.includes("shipping"));
    assert.ok(replyTexts.includes("discount"));
    assert.ok(replyTexts.includes("pending"));
    assert.ok(replyTexts.includes("paid"));
    assert.ok(replyTexts.includes("dashboard"));
  });

  it("adds variable product with individual prices per variation and preserves original photo", async () => {
    const engine = new CaterlogStage1Engine();
    const originalPhoto = "https://cdn.caterlog.com/uploads/original-zara-stiletto.jpg";
    const result = await engine.handleVendorWhatsAppKeyword(
      "Zara Stiletto Heel, 38: #20000 (5), 39: #25000 (3)",
      originalPhoto
    );

    assert.equal(result.commandType, "QUICK_ADD_PRODUCT");
    assert.ok(result.replyText.includes("Zara Stiletto Heel"));
    assert.ok(result.replyText.includes("₦20,000"));
    assert.ok(result.replyText.includes("₦25,000"));

    const prod = engine.products.find((p) => p.name === "Zara Stiletto Heel");
    assert.ok(prod);
    assert.equal(prod.stockTotal, 8);
    assert.equal(prod.basePriceKobo, 2000000n);
    assert.ok(prod.variants && prod.variants.length === 2);

    const v38 = prod.variants.find((v) => v.name === "38");
    assert.ok(v38);
    assert.equal(v38.stockTotal, 5);
    assert.equal(v38.priceKobo, 2000000n);

    const v39 = prod.variants.find((v) => v.name === "39");
    assert.ok(v39);
    assert.equal(v39.stockTotal, 3);
    assert.equal(v39.priceKobo, 2500000n);

    // Original vendor photo is preserved, NEVER replaced by random unsplash
    assert.equal(prod.primaryImageUrl, originalPhoto);
  });

  it("inquiring about a product displays image and variations WITHOUT adding to cart", async () => {
    const engine = new CaterlogStage1Engine();
    const originalPhoto = "https://cdn.caterlog.com/uploads/original-bella-heel.jpg";

    // 1. Add variable product with individual prices and attached photo
    await engine.handleVendorWhatsAppKeyword(
      "Bella Block Heel, 38: #22000 (4), 39: #26000 (2)",
      originalPhoto
    );

    const buyerPhone = "+2348077778888";

    // 2. Buyer merely asks about the product
    const inquiry = await engine.handleBuyerWhatsAppInquiry({
      buyerPhone,
      buyerName: "Amaka Eze",
      text: "Bella Block Heel",
      simulateFastForwardIdleTimer: true,
    });

    // CRUCIAL: Must NOT automatically add to cart!
    const cart = engine.getBuyerCart(buyerPhone);
    assert.equal(cart.length, 0, "Inquiring about an item must NOT add it to the cart");

    // Must display image and variations with individual prices & stock
    const lastBotMsg = engine.chatMessages
      .filter((m) => m.channel === "BUYER_SHOP_WA" && m.sender === "CATERLOG_BOT")
      .pop();

    assert.ok(lastBotMsg);
    assert.ok(lastBotMsg.imageUrl, "Product card must include image");
    assert.ok(lastBotMsg.text.includes("Bella Block Heel"));
    assert.ok(lastBotMsg.text.includes("38"));
    assert.ok(lastBotMsg.text.includes("₦22,000"));
    assert.ok(lastBotMsg.text.includes("4 in stock"));
    assert.ok(lastBotMsg.text.includes("39"));
    assert.ok(lastBotMsg.text.includes("₦26,000"));
    assert.ok(lastBotMsg.text.includes("2 in stock"));

    // Must offer quick replies to add each variant to cart + category exploration
    assert.ok(lastBotMsg.quickReplies && lastBotMsg.quickReplies.length >= 2);
    const replyLabels = lastBotMsg.quickReplies.map((qr) => qr.label);
    assert.ok(replyLabels.some((l) => l.includes("Add 38") && l.includes("₦22,000")));
    assert.ok(replyLabels.some((l) => l.includes("Add 39") && l.includes("₦26,000")));
    assert.ok(lastBotMsg.quickReplies.some((qr) => qr.replyText.startsWith("category")));

    // 3. Buyer clicks the quick reply to add variant 38 -> Prompts for quantity selection!
    const addReply = lastBotMsg.quickReplies.find((qr) => qr.label.includes("Add 38"))!;
    const variantRes = await engine.handleBuyerWhatsAppInquiry({
      buyerPhone,
      buyerName: "Amaka Eze",
      text: addReply.replyText,
      simulateFastForwardIdleTimer: true,
    });

    assert.equal(variantRes.step, "PROMPTED_FOR_QUANTITY");
    const sessionAfterClick = engine.buyerSessions.get(buyerPhone);
    assert.equal(sessionAfterClick?.state, "AWAITING_QUANTITY");

    const qtyPromptMsg = engine.chatMessages
      .filter((m) => m.channel === "BUYER_SHOP_WA" && m.sender === "CATERLOG_BOT")
      .pop();
    assert.ok(qtyPromptMsg?.text.includes("How many units"));
    assert.ok(qtyPromptMsg?.text.includes("Bella Block Heel — 38"));
    assert.ok(qtyPromptMsg?.quickReplies && qtyPromptMsg.quickReplies.some((qr) => qr.replyText === "2 units"));

    // 4. Buyer taps "2 units"
    const qtyRes = await engine.handleBuyerWhatsAppInquiry({
      buyerPhone,
      buyerName: "Amaka Eze",
      text: "2 units",
      simulateFastForwardIdleTimer: true,
    });

    assert.equal(qtyRes.step, "PROMPTED_FOR_SHIPPING_ZONE");

    // NOW 2 units of the item are added to cart
    const updatedCart = engine.getBuyerCart(buyerPhone);
    assert.equal(updatedCart.length, 1);
    assert.equal(updatedCart[0].variantName, "38");
    assert.equal(updatedCart[0].quantity, 2);
    assert.equal(updatedCart[0].unitPriceKobo, 2200000n);

    // And buyer is prompted for delivery zone with ×2 in summary
    const promptMsg = engine.chatMessages
      .filter((m) => m.channel === "BUYER_SHOP_WA" && m.sender === "CATERLOG_BOT")
      .pop();
    assert.ok(promptMsg?.text.includes("Where should we deliver your order"));
    assert.ok(promptMsg?.text.includes("×2"));
  });

  it("browses items under a category with quick-reply cards", async () => {
    const engine = new CaterlogStage1Engine();
    const buyerPhone = "+2348033334444";

    await engine.handleBuyerWhatsAppInquiry({
      buyerPhone,
      text: "category fashion",
      simulateFastForwardIdleTimer: true,
    });

    const lastBotMsg = engine.chatMessages
      .filter((m) => m.channel === "BUYER_SHOP_WA" && m.sender === "CATERLOG_BOT")
      .pop();

    assert.ok(lastBotMsg);
    assert.ok(lastBotMsg.text.includes("Items in Category"));
    assert.ok(lastBotMsg.quickReplies && lastBotMsg.quickReplies.length >= 1);
  });

  it("syncs Co-Pilot with Vendor Chat: escalates assistance requests, pauses Co-Pilot during vendor assistance, and resumes seamlessly", async () => {
    const engine = new CaterlogStage1Engine();
    const buyerPhone = "+2348033334444";
    const buyerName = "Chioma Nwosu";

    // 1. Buyer asks to speak with the vendor/owner
    await engine.handleBuyerWhatsAppInquiry({
      buyerPhone,
      buyerName,
      text: "Can I talk to the store owner please?",
      simulateFastForwardIdleTimer: true,
    });

    // Verify session flagged as NEEDS_ASSISTANCE
    const session = engine.buyerSessions.get(buyerPhone);
    assert.ok(session);
    assert.equal(session.state, "NEEDS_ASSISTANCE");

    // Verify buyer received support acknowledgment
    const buyerAck = engine.chatMessages
      .filter((m) => m.channel === "BUYER_SHOP_WA" && m.sender === "CATERLOG_BOT")
      .pop();
    assert.ok(buyerAck?.text.includes("Customer Assistance Request Received"));

    // Verify vendor was alerted on WhatsApp
    const vendorAlert = engine.chatMessages
      .filter((m) => m.channel === "VENDOR_ADMIN_WA" && m.sender === "CATERLOG_BOT")
      .pop();
    assert.ok(vendorAlert?.text.includes("Customer Assistance Request"));
    assert.ok(vendorAlert?.text.includes(buyerName));

    // 2. Vendor replies to customer via WhatsApp keyword command
    const vendorReplyRes = await engine.handleVendorWhatsAppKeyword(
      "reply 4444 Hello Chioma! I am the store owner, how can I assist with your order?"
    );
    assert.equal(vendorReplyRes.commandType, "VENDOR_ASSIST_REPLY");

    // Verify customer received the vendor message formatted as Store Owner
    const deliveredMsg = engine.chatMessages
      .filter((m) => m.channel === "BUYER_SHOP_WA" && m.sender === "VENDOR")
      .pop();
    assert.ok(deliveredMsg);
    assert.ok(deliveredMsg.text.includes("Store Owner"));
    assert.ok(deliveredMsg.text.includes("how can I assist"));

    // Verify Co-Pilot is paused for this thread
    assert.equal(session.copilotPaused, true);
    assert.equal(session.state, "ASSISTING");

    // 3. Buyer replies while vendor is assisting -> Co-Pilot stays paused & forwards to vendor
    const buyerFollowUp = await engine.handleBuyerWhatsAppInquiry({
      buyerPhone,
      buyerName,
      text: "Do you have size 43 available in white leather?",
      simulateFastForwardIdleTimer: true,
    });
    assert.equal(buyerFollowUp.copilotDecision.action, "DO_NOTHING");
    assert.ok(buyerFollowUp.copilotDecision.reason.includes("Vendor is actively assisting customer"));

    const vendorForward = engine.chatMessages
      .filter((m) => m.channel === "VENDOR_ADMIN_WA" && m.sender === "CATERLOG_BOT")
      .pop();
    assert.ok(vendorForward?.text.includes("Do you have size 43 available in white leather?"));

    // 4. Vendor hands customer back to Co-Pilot
    const resumeRes = await engine.handleVendorWhatsAppKeyword("resume");
    assert.equal(resumeRes.commandType, "RESUME_COPILOT");
    assert.equal(session.copilotPaused, false);

    // Verify buyer received Co-Pilot back online message
    const botResumedMsg = engine.chatMessages
      .filter((m) => m.channel === "BUYER_SHOP_WA" && m.sender === "CATERLOG_BOT")
      .pop();
    assert.ok(botResumedMsg?.text.includes("Sales Co-Pilot is back online"));
  });

  it("supports ordering more than one unit at a time with stock validation and variant selection", async () => {
    const engine = new CaterlogStage1Engine();
    const buyerPhone = "+2348055554433";

    // Add product with variants
    await engine.handleVendorWhatsAppKeyword(
      "Designer Sneaker, 40: #30000 (10), 41: #30000 (2)"
    );

    // 1. Natural multi-unit order: "I want 3 Designer Sneaker"
    await engine.handleBuyerWhatsAppInquiry({
      buyerPhone,
      buyerName: "Tolu Adeleke",
      text: "I want 3 Designer Sneaker",
      simulateFastForwardIdleTimer: true,
    });

    const session = engine.buyerSessions.get(buyerPhone);
    assert.ok(session);
    assert.equal(session.quantity, 3);
    assert.equal(session.state, "AWAITING_VARIANT");

    // 2. Select variant 40 for the 3 units
    await engine.handleBuyerWhatsAppInquiry({
      buyerPhone,
      buyerName: "Tolu Adeleke",
      text: "40",
      simulateFastForwardIdleTimer: true,
    });

    const cart = engine.getBuyerCart(buyerPhone);
    assert.equal(cart.length, 1);
    assert.equal(cart[0].productName, "Designer Sneaker");
    assert.equal(cart[0].variantName, "40");
    assert.equal(cart[0].quantity, 3);
    assert.equal(cart[0].unitPriceKobo, 3000000n);

    // 3. Test multi-unit variant with natural expression: "2 size 41"
    const buyer2Phone = "+2348011112222";
    await engine.handleBuyerWhatsAppInquiry({
      buyerPhone: buyer2Phone,
      buyerName: "Chuka Obi",
      text: "Designer Sneaker",
      simulateFastForwardIdleTimer: true,
    });

    await engine.handleBuyerWhatsAppInquiry({
      buyerPhone: buyer2Phone,
      buyerName: "Chuka Obi",
      text: "2 size 41",
      simulateFastForwardIdleTimer: true,
    });

    const cart2 = engine.getBuyerCart(buyer2Phone);
    assert.equal(cart2.length, 1);
    assert.equal(cart2[0].variantName, "41");
    assert.equal(cart2[0].quantity, 2);

    // 4. Exceeding stock: asking for 5 units when only 2 available
    const buyer3Phone = "+2348099990000";
    await engine.handleBuyerWhatsAppInquiry({
      buyerPhone: buyer3Phone,
      buyerName: "Kunle",
      text: "Designer Sneaker",
      simulateFastForwardIdleTimer: true,
    });

    const overStockRes = await engine.handleBuyerWhatsAppInquiry({
      buyerPhone: buyer3Phone,
      buyerName: "Kunle",
      text: "5 size 41",
      simulateFastForwardIdleTimer: true,
    });
    assert.equal(overStockRes.step, "OUT_OF_STOCK");
  });

  it("supports 1-tap cart viewing and instant checkout displaying Monnify virtual account details", async () => {
    const engine = new CaterlogStage1Engine();
    const buyerPhone = "+2348088887766";

    // 1. Add simple product and add 2 units to cart
    await engine.handleBuyerWhatsAppInquiry({
      buyerPhone,
      buyerName: "Ngozi Eze",
      text: "I want 2 BAG-01",
      simulateFastForwardIdleTimer: true,
    });

    // 2. View cart
    await engine.handleBuyerWhatsAppInquiry({
      buyerPhone,
      buyerName: "Ngozi Eze",
      text: "view cart",
      simulateFastForwardIdleTimer: true,
    });

    const cartMsg = engine.chatMessages
      .filter((m) => m.channel === "BUYER_SHOP_WA" && m.sender === "CATERLOG_BOT")
      .pop();
    assert.ok(cartMsg?.text.includes("Your Shopping Cart"));
    assert.ok(cartMsg?.text.includes("×2"));
    assert.ok(cartMsg?.quickReplies?.some((qr) => qr.label.includes("Checkout")));

    // 3. Instant checkout via "checkout" command
    const checkoutRes = await engine.handleBuyerWhatsAppInquiry({
      buyerPhone,
      buyerName: "Ngozi Eze",
      text: "checkout",
      simulateFastForwardIdleTimer: true,
    });

    assert.equal(checkoutRes.step, "INVOICE_CREATED");
    assert.ok(checkoutRes.createdOrder);
    assert.equal(checkoutRes.createdOrder.quantity, 2);
    assert.ok(checkoutRes.createdOrder.accountNumber);
    assert.ok(checkoutRes.createdOrder.bankName);

    // Cart is emptied and invoice is delivered
    const cartAfter = engine.getBuyerCart(buyerPhone);
    assert.equal(cartAfter.length, 0);

    const invoiceMsg = engine.chatMessages
      .filter((m) => m.channel === "BUYER_SHOP_WA" && m.sender === "CATERLOG_BOT")
      .slice(-2)[0];
    assert.ok(invoiceMsg?.text.includes("Order Invoice"));
    assert.ok(invoiceMsg?.text.includes("Account No:"));

    // Standalone 10-digit NUBAN bubble for 1-tap mobile copying
    const nubanBubble = engine.chatMessages
      .filter((m) => m.channel === "BUYER_SHOP_WA" && m.sender === "CATERLOG_BOT")
      .pop();
    assert.equal(nubanBubble?.text, checkoutRes.createdOrder.accountNumber);
  });

  it("computes real 64-bit dHash via MediaStore, preserves original images without Unsplash replacement, and matches WhatsApp status photo", async () => {
    const { mediaStore } = await import("./media/media-store.ts");

    // Generate test image buffer (PNG) using sharp
    const sharp = (await import("sharp")).default;
    const testImageBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 255, g: 0, b: 128, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const stored = await mediaStore.saveMedia({
      buffer: testImageBuffer,
      contentType: "image/png",
    });

    assert.ok(stored.mediaId.startsWith("med_"));
    assert.ok(stored.phash.length === 16, "Perceptual dHash must be 16-hex-char 64-bit string");

    // Verify retrieving by mediaId
    const retrieved = mediaStore.getMedia(stored.mediaId);
    assert.ok(retrieved);
    assert.equal(retrieved.contentType, "image/png");
    assert.equal(retrieved.phash, stored.phash);

    // Register product with this real perceptual hash
    const engine = new CaterlogStage1Engine();
    const prod = engine.addProduct({
      name: "Original Amaka Loafer",
      basePriceKobo: 4500000n,
      stockTotal: 10,
      primaryImageUrl: `/api/v1/media/${stored.mediaId}`,
      imagePhash: stored.phash,
    });

    assert.equal(prod.primaryImageUrl, `/api/v1/media/${stored.mediaId}`);
    assert.equal(prod.imagePhash, stored.phash);

    // Match status photo inquiry using the real perceptual hash
    const inquiry = await engine.handleBuyerWhatsAppInquiry({
      buyerPhone: "+2348044443322",
      buyerName: "Simi",
      text: "How much is this?",
      quotedStatusImagePhash: stored.phash,
      simulateFastForwardIdleTimer: true,
    });

    assert.equal(inquiry.step, "PROMPTED_FOR_SHIPPING_ZONE");
    const lastMsg = engine.chatMessages
      .filter((m) => m.channel === "BUYER_SHOP_WA" && m.sender === "CATERLOG_BOT")
      .pop();
    assert.ok(lastMsg?.text.includes("Original Amaka Loafer"));
    assert.ok(lastMsg?.text.includes("₦45,000"));
  });

  it("enforces 100% consistent Content IDs (SKUs) and groups variants with item_group_id", async () => {
    const engine = new CaterlogStage1Engine();

    // 1. Adding with explicit bracketed SKU
    const resExplicit = await engine.handleVendorWhatsAppKeyword(
      "[SHOE-09] Luxury Stiletto, #35000, sizes: 38 (3), 39 (4)"
    );
    assert.equal(resExplicit.commandType, "QUICK_ADD_PRODUCT");
    const stiletto = engine.products.find((p) => p.skuCode === "SHOE-09");
    assert.ok(stiletto, "Product must have Content ID SHOE-09");
    assert.equal(stiletto.variants?.length, 2);
    assert.equal(stiletto.variants?.[0]?.skuCode, "SHOE-09-38");
    assert.equal(stiletto.variants?.[1]?.skuCode, "SHOE-09-39");

    // 2. Adding without explicit SKU auto-derives consistent sequential SKU (SHOE-03 after SHOE-01, SHOE-02)
    const resAuto = await engine.handleVendorWhatsAppKeyword(
      "Velvet Platform Heels, #28000, sizes: 38 (2), 39 (3)"
    );
    assert.equal(resAuto.commandType, "QUICK_ADD_PRODUCT");
    const velvet = engine.products.find((p) => p.skuCode === "SHOE-03");
    assert.ok(velvet, "Product must have auto-derived sequential Content ID SHOE-03");
    assert.equal(velvet.variants?.length, 2);
    assert.equal(velvet.variants?.[0]?.skuCode, "SHOE-03-38");
    assert.equal(velvet.variants?.[1]?.skuCode, "SHOE-03-39");

    // 3. Sync to WhatsApp Catalog and verify variants are linked with item_group_id
    const syncRes = await engine.syncWhatsAppCatalog();
    assert.ok(syncRes.upserted > 0);
    const mockItems = engine.catalog.getMockCatalog();

    const parentItem = mockItems.find((i) => i.retailer_id === "SHOE-09");
    assert.ok(parentItem, "Parent product must exist in catalog");

    const variant38 = mockItems.find((i) => i.retailer_id === "SHOE-09-38");
    assert.ok(variant38, "Variant 38 must exist in catalog with its own Content ID");
    assert.equal(variant38.item_group_id, "SHOE-09", "Variant must link to parent Content ID via item_group_id");

    const variant39 = mockItems.find((i) => i.retailer_id === "SHOE-09-39");
    assert.ok(variant39, "Variant 39 must exist in catalog with its own Content ID");
    assert.equal(variant39.item_group_id, "SHOE-09", "Variant must link to parent Content ID via item_group_id");
  });

  it("syncs original product photos to catalog without replacing with random stock images", async () => {
    const engine = new CaterlogStage1Engine();

    // Store real image in MediaStore
    const realBuffer = Buffer.from("fake-real-product-image-content");
    const stored = await mediaStore.saveMedia({
      buffer: realBuffer,
      contentType: "image/png",
      publicUrl: "https://files.catbox.moe/real-vendor-original-photo.png",
    });

    // Add product with the original local media URL
    engine.addProduct({
      name: "Handmade Suede Loafers",
      basePriceKobo: 40_000_00n,
      stockTotal: 8,
      primaryImageUrl: `/api/v1/media/${stored.mediaId}`,
    });

    await engine.syncWhatsAppCatalog();
    const mockItems = engine.catalog.getMockCatalog();
    const loafer = mockItems.find((i) => i.name.includes("Handmade Suede Loafers"));
    assert.ok(loafer, "Loafer must be in mock catalog");
    assert.equal(
      loafer.image_url,
      "https://files.catbox.moe/real-vendor-original-photo.png",
      "Catalog must use the vendor's real original photo, never a random stock image"
    );
  });

  it("supports order flow quantity selection for variations and simple products with stock limits", async () => {
    const engine = new CaterlogStage1Engine();

    // 1. SIMPLE PRODUCT ORDER FLOW: Clicking simple product prompts for quantity
    const buyerA = "+2348011223344";
    const simpleRes = await engine.handleBuyerWhatsAppInquiry({
      buyerPhone: buyerA,
      buyerName: "Funke Akindele",
      text: "Add to cart BAG-01",
      simulateFastForwardIdleTimer: true,
    });

    assert.equal(simpleRes.step, "PROMPTED_FOR_QUANTITY");
    const sessionA = engine.buyerSessions.get(buyerA);
    assert.equal(sessionA?.state, "AWAITING_QUANTITY");

    const simpleQtyMsg = engine.chatMessages
      .filter((m) => m.channel === "BUYER_SHOP_WA" && m.sender === "CATERLOG_BOT")
      .pop();
    assert.ok(simpleQtyMsg?.text.includes("How many units of Jacquemus Le Chiquito Mini Bag would you like?"));
    assert.ok(simpleQtyMsg?.quickReplies && simpleQtyMsg.quickReplies.some((qr) => qr.replyText === "3 units"));

    // Buyer replies with "3 units"
    const simpleQtySubmit = await engine.handleBuyerWhatsAppInquiry({
      buyerPhone: buyerA,
      buyerName: "Funke Akindele",
      text: "3 units",
      simulateFastForwardIdleTimer: true,
    });
    assert.equal(simpleQtySubmit.step, "PROMPTED_FOR_SHIPPING_ZONE");

    const cartA = engine.getBuyerCart(buyerA);
    assert.equal(cartA.length, 1);
    assert.equal(cartA[0].productSku, "BAG-01");
    assert.equal(cartA[0].quantity, 3);

    // 2. VARIABLE PRODUCT ORDER FLOW: Clicking variation prompts for quantity
    await engine.handleVendorWhatsAppKeyword(
      "[SHOE-55] Luxury Sneaker, Size 38: #35000 (4), Size 39: #37000 (2)"
    );

    const buyerB = "+2348099887766";
    // First browse Sneakers
    await engine.handleBuyerWhatsAppInquiry({
      buyerPhone: buyerB,
      buyerName: "Emeka Okafor",
      text: "SHOE-55",
      simulateFastForwardIdleTimer: true,
    });

    // Emeka selects variation "Add SHOE-55 Size 38"
    const varPromptRes = await engine.handleBuyerWhatsAppInquiry({
      buyerPhone: buyerB,
      buyerName: "Emeka Okafor",
      text: "Add SHOE-55 Size 38",
      simulateFastForwardIdleTimer: true,
    });
    assert.equal(varPromptRes.step, "PROMPTED_FOR_QUANTITY");
    const sessionB = engine.buyerSessions.get(buyerB);
    assert.equal(sessionB?.state, "AWAITING_QUANTITY");

    // Emeka taps "2" (bare numeric reply)
    const varQtySubmit = await engine.handleBuyerWhatsAppInquiry({
      buyerPhone: buyerB,
      buyerName: "Emeka Okafor",
      text: "2",
      simulateFastForwardIdleTimer: true,
    });
    assert.equal(varQtySubmit.step, "PROMPTED_FOR_SHIPPING_ZONE");

    const cartB = engine.getBuyerCart(buyerB);
    assert.equal(cartB.length, 1);
    assert.equal(cartB[0].variantName, "38");
    assert.equal(cartB[0].quantity, 2);

    // 3. EXPLICIT QUANTITY BYPASS: Buyer specifies quantity upfront in command
    const buyerC = "+2348055443322";
    const explicitRes = await engine.handleBuyerWhatsAppInquiry({
      buyerPhone: buyerC,
      buyerName: "Simi Adeleke",
      text: "Add 2 SHOE-55 Size 39",
      simulateFastForwardIdleTimer: true,
    });
    // Bypasses quantity prompt directly to shipping zone!
    assert.equal(explicitRes.step, "PROMPTED_FOR_SHIPPING_ZONE");

    const cartC = engine.getBuyerCart(buyerC);
    assert.equal(cartC.length, 1);
    assert.equal(cartC[0].variantName, "39");
    assert.equal(cartC[0].quantity, 2);

    // 4. OVER-STOCK REQUEST IN QUANTITY SELECTION: Exceeding available units
    const buyerD = "+2348077665544";
    // Size 39 has 2 units in stock
    await engine.handleBuyerWhatsAppInquiry({
      buyerPhone: buyerD,
      buyerName: "Dapo",
      text: "Add SHOE-55 Size 39",
      simulateFastForwardIdleTimer: true,
    });
    // Dapo asks for 10 units
    const overStockRes = await engine.handleBuyerWhatsAppInquiry({
      buyerPhone: buyerD,
      buyerName: "Dapo",
      text: "10 units",
      simulateFastForwardIdleTimer: true,
    });
    assert.equal(overStockRes.step, "OUT_OF_STOCK");

    const overStockMsg = engine.chatMessages
      .filter((m) => m.channel === "BUYER_SHOP_WA" && m.sender === "CATERLOG_BOT")
      .pop();
    assert.ok(overStockMsg?.text.includes("only has 2 unit(s) available"));
  });

  it("collects and saves street delivery address from buyer after payment is confirmed", async () => {
    const engine = new CaterlogStage1Engine();
    const buyerPhone = "+2348012341234";

    // 1. Buyer creates an order
    const inquiry = await engine.handleBuyerWhatsAppInquiry({
      buyerPhone,
      buyerName: "Ifeoma Nwosu",
      text: "I want SHOE-01 delivered to Lekki",
      simulateFastForwardIdleTimer: true,
    });
    assert.ok(inquiry.createdOrder);
    const order = inquiry.createdOrder;

    // 2. Buyer pays via bank transfer
    const txRef = "MNFY_TEST_ADDR_001";
    engine.monnify.seedMockVerifiedTransfer({
      providerTransactionRef: txRef,
      paymentReference: order.invoiceReference,
      invoiceReference: order.invoiceReference,
      paymentStatus: "PAID",
      amountPaidKobo: order.totalAmountKobo,
      payerName: "Ifeoma Nwosu",
      paymentMethod: "ACCOUNT_TRANSFER",
      serverVerifiedAt: new Date(),
      rawResponse: {},
    });
    const payload = JSON.stringify({ eventData: { transactionReference: txRef } });

    await engine.reconcileMonnifyWebhook({
      rawBody: payload,
      signatureHeader: engine.monnify.signPayloadForTesting(payload),
      providerTransactionRef: txRef,
    });

    // Verify buyer received receipt asking for delivery address
    const receiptMsg = engine.chatMessages.find(
      (m) => m.channel === "BUYER_SHOP_WA" && m.text.includes("Payment Confirmed!")
    );
    assert.ok(receiptMsg);
    assert.ok(receiptMsg.text.includes("Where should the rider deliver your package?"));

    // Verify buyer session is now AWAITING_DELIVERY_ADDRESS
    const session = engine.buyerSessions.get(buyerPhone);
    assert.ok(session);
    assert.equal(session.state, "AWAITING_DELIVERY_ADDRESS");

    // 3. Buyer replies with street address
    await engine.handleBuyerWhatsAppInquiry({
      buyerPhone,
      buyerName: "Ifeoma Nwosu",
      text: "14 Admiralty Way, opposite Filmhouse Cinema, Lekki Phase 1",
      simulateFastForwardIdleTimer: true,
    });

    // Address is saved to the order
    const updatedOrder = engine.orders.find((o) => o.shortCode === order.shortCode);
    assert.equal(
      updatedOrder?.deliveryAddress,
      "14 Admiralty Way, opposite Filmhouse Cinema, Lekki Phase 1"
    );

    // Confirmation message delivered to customer
    const confirmMsg = engine.chatMessages
      .filter((m) => m.channel === "BUYER_SHOP_WA" && m.sender === "CATERLOG_BOT")
      .pop();
    assert.ok(confirmMsg?.text.includes("Delivery Address Saved!"));
    assert.ok(confirmMsg?.text.includes("14 Admiralty Way"));

    // Vendor alerted with street address
    const vendorAlert = engine.chatMessages.find(
      (m) => m.channel === "VENDOR_ADMIN_WA" && m.text.includes("Delivery Address Provided")
    );
    assert.ok(vendorAlert);
    assert.ok(vendorAlert.text.includes("14 Admiralty Way"));
  });

  it("handles late payment on expired orders: revives order when stock is available, and flags sold-out refund when stock is exhausted", async () => {
    const engine = new CaterlogStage1Engine();

    // 1. CASE A: Stock is STILL available when late payment arrives -> Revives order & asks for address
    const buyerA = "+2348099112233";
    const inqA = await engine.handleBuyerWhatsAppInquiry({
      buyerPhone: buyerA,
      buyerName: "Tunde Bakare",
      text: "I want SHOE-01 delivered to Mainland",
      simulateFastForwardIdleTimer: true,
    });
    assert.ok(inqA.createdOrder);
    const orderA = inqA.createdOrder;

    // Order expires and stock hold is released
    await engine.expireOrderReservation(orderA.shortCode);
    const expiredA = engine.orders.find((o) => o.shortCode === orderA.shortCode);
    assert.equal(expiredA?.status, "EXPIRED");
    assert.equal(expiredA?.reservationReleased, true);

    // Late payment arrives for Order A while stock is still available (shoe stock > 0)
    const txA = "MNFY_TEST_LATE_REVIVE_001";
    engine.monnify.seedMockVerifiedTransfer({
      providerTransactionRef: txA,
      paymentReference: orderA.invoiceReference,
      invoiceReference: orderA.invoiceReference,
      paymentStatus: "PAID",
      amountPaidKobo: orderA.totalAmountKobo,
      payerName: "Tunde Bakare",
      paymentMethod: "ACCOUNT_TRANSFER",
      serverVerifiedAt: new Date(),
      rawResponse: {},
    });
    const payloadA = JSON.stringify({ eventData: { transactionReference: txA } });
    await engine.reconcileMonnifyWebhook({
      rawBody: payloadA,
      signatureHeader: engine.monnify.signPayloadForTesting(payloadA),
      providerTransactionRef: txA,
    });

    // Order A is revived to PAID with reservation secured
    assert.equal(orderA.status, "PAID");
    assert.equal(orderA.reservationReleased, false);

    const reviveMsg = engine.chatMessages.find(
      (m) => m.channel === "BUYER_SHOP_WA" && m.text.includes("Late Payment Accepted")
    );
    assert.ok(reviveMsg, "Receipt must note late payment acceptance");
    assert.ok(reviveMsg.text.includes("Where should the rider deliver your package?"));

    // 2. CASE B: Stock was EXHAUSTED while expired -> Customer & vendor alerted of Sold Out status
    const buyerB = "+2348088223344";
    const inqB = await engine.handleBuyerWhatsAppInquiry({
      buyerPhone: buyerB,
      buyerName: "Korede Bello",
      text: "I want BAG-01 delivered to Lekki",
      simulateFastForwardIdleTimer: true,
    });
    assert.ok(inqB.createdOrder);
    const orderB = inqB.createdOrder;

    // Expire order B
    await engine.expireOrderReservation(orderB.shortCode);

    // In the meantime, the remaining BAG-01 stock is bought or depleted
    const bag = engine.products.find((p) => p.skuCode === "BAG-01")!;
    bag.stockTotal = 0; // Completely sold out

    // Late transfer arrives for Order B when item is completely sold out
    const txB = "MNFY_TEST_LATE_SOLDOUT_002";
    engine.monnify.seedMockVerifiedTransfer({
      providerTransactionRef: txB,
      paymentReference: orderB.invoiceReference,
      invoiceReference: orderB.invoiceReference,
      paymentStatus: "PAID",
      amountPaidKobo: orderB.totalAmountKobo,
      payerName: "Korede Bello",
      paymentMethod: "ACCOUNT_TRANSFER",
      serverVerifiedAt: new Date(),
      rawResponse: {},
    });
    const payloadB = JSON.stringify({ eventData: { transactionReference: txB } });
    await engine.reconcileMonnifyWebhook({
      rawBody: payloadB,
      signatureHeader: engine.monnify.signPayloadForTesting(payloadB),
      providerTransactionRef: txB,
    });

    // Customer receives sold out notice and vendor is alerted to refund
    const soldOutBuyerAlert = engine.chatMessages.find(
      (m) => m.channel === "BUYER_SHOP_WA" && m.text.includes("PAYMENT RECEIVED FOR EXPIRED ORDER")
    );
    assert.ok(soldOutBuyerAlert);
    assert.ok(soldOutBuyerAlert.text.includes("Sold Out"));

    const soldOutVendorAlert = engine.chatMessages.find(
      (m) => m.channel === "VENDOR_ADMIN_WA" && m.text.includes("Late Transfer on Expired Order")
    );
    assert.ok(soldOutVendorAlert);
    assert.ok(soldOutVendorAlert.text.includes("SOLD OUT"));
    assert.ok(soldOutVendorAlert.text.includes("arrange an alternative product or issue a refund"));
  });

  it("dispatches order with rider details, alerts buyer via WhatsApp, and provides live self-service tracking", async () => {
    const engine = new CaterlogStage1Engine();

    // 1. Buyer places order
    const inq = await engine.handleBuyerWhatsAppInquiry({
      buyerPhone: "+2348055554444",
      buyerName: "Ibrahim Sadiq",
      text: "I want SHOE-01 delivered to Mainland",
      simulateFastForwardIdleTimer: true,
    });
    assert.ok(inq.createdOrder);
    const order = inq.createdOrder;
    assert.strictEqual(order.status, "PENDING_PAYMENT");

    // 2. Buyer tracks order while PENDING_PAYMENT
    const trackPending = await engine.processBuyerConversationTurn({
      buyerPhone: "+2348055554444",
      buyerName: "Ibrahim Sadiq",
      text: "track",
    });
    assert.strictEqual(trackPending.step, "ORDER_TRACKED");
    const trackPendingMsg = engine.chatMessages.slice().reverse().find(
      (m) => m.channel === "BUYER_SHOP_WA" && m.text.includes("ORDER STATUS")
    );
    assert.ok(trackPendingMsg);
    assert.ok(trackPendingMsg.text.includes("AWAITING BANK TRANSFER"));
    assert.ok(trackPendingMsg.text.includes(order.shortCode));

    // 3. Payment is verified and delivery address provided
    await engine.applyVerifiedPayment({
      providerTransactionRef: "TX_TRACK_1",
      paymentReference: order.invoiceReference,
      invoiceReference: order.invoiceReference,
      paymentStatus: "PAID",
      amountPaidKobo: order.totalAmountKobo,
      payerName: "Ibrahim Sadiq",
      paymentMethod: "ACCOUNT_TRANSFER",
      serverVerifiedAt: new Date(),
      rawResponse: {},
    });
    await engine.handleBuyerWhatsAppInquiry({
      buyerPhone: "+2348055554444",
      buyerName: "Ibrahim Sadiq",
      text: "Plot 8 Admiralty Road, Lekki Phase 1",
      simulateFastForwardIdleTimer: true,
    });
    assert.strictEqual(order.status, "PAID");
    assert.strictEqual(order.deliveryAddress, "Plot 8 Admiralty Road, Lekki Phase 1");

    // 4. Vendor dispatches order with rider phone number
    const riderPhone = "08023456789";
    const dispatchResult = await engine.dispatchOrder(order.shortCode, riderPhone);
    assert.ok(dispatchResult);
    assert.strictEqual(order.status, "OUT_FOR_DELIVERY");
    assert.strictEqual(order.riderPhone, riderPhone);
    assert.ok(order.dispatchedAt instanceof Date);

    // Verify buyer received automated WhatsApp dispatch notification
    const dispatchNotice = engine.chatMessages.find(
      (m) => m.channel === "BUYER_SHOP_WA" && m.text.includes("ORDER OUT FOR DELIVERY")
    );
    assert.ok(dispatchNotice);
    assert.ok(dispatchNotice.text.includes(order.shortCode));
    assert.ok(dispatchNotice.text.includes(riderPhone));
    assert.ok(dispatchNotice.text.includes("Plot 8 Admiralty Road"));

    // Verify vendor admin was also notified
    const vendorNotice = engine.chatMessages.find(
      (m) => m.channel === "VENDOR_ADMIN_WA" && m.text.includes("marked Out for Delivery")
    );
    assert.ok(vendorNotice);
    assert.ok(vendorNotice.text.includes(riderPhone));

    // 5. Buyer queries live status via "track", "status", and "track <orderCode>"
    const trackDispatched = await engine.processBuyerConversationTurn({
      buyerPhone: "+2348055554444",
      buyerName: "Ibrahim Sadiq",
      text: `track ${order.shortCode}`,
    });
    assert.strictEqual(trackDispatched.step, "ORDER_TRACKED");

    const trackDispatchedMsg = engine.chatMessages.slice().reverse().find(
      (m) => m.channel === "BUYER_SHOP_WA" && m.text.includes("OUT FOR DELIVERY")
    );
    assert.ok(trackDispatchedMsg);
    assert.ok(trackDispatchedMsg.text.includes(riderPhone));
    assert.ok(trackDispatchedMsg.text.includes("Plot 8 Admiralty Road"));
    assert.ok(trackDispatchedMsg.text.includes("Zara Block Heel"));

    // 6. Unknown order tracking returns helpful guidance
    const trackUnknown = await engine.processBuyerConversationTurn({
      buyerPhone: "+2348099990000",
      buyerName: "Unknown Customer",
      text: "track ORD-9999",
    });
    assert.strictEqual(trackUnknown.step, "UNMATCHED");
    const trackUnknownMsg = engine.chatMessages.slice().reverse().find(
      (m) => m.channel === "BUYER_SHOP_WA" && m.text.includes("Order Not Found")
    );
    assert.ok(trackUnknownMsg);
  });

  it("automatically syncs catalog in real time and displays product image when requested via WhatsApp", async () => {
    const engine = new CaterlogStage1Engine();

    // 1. Vendor adds new product via WhatsApp with photo URL
    const photoUrl = "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=80";
    const addResult = await engine.handleVendorWhatsAppKeyword(
      `Tote Bag, #42000, stock: 7, ${photoUrl}`
    );
    assert.strictEqual(addResult.commandType, "QUICK_ADD_PRODUCT");

    const toteBag = engine.products.find((p) => p.name === "Tote Bag");
    assert.ok(toteBag, "Tote Bag should be added to products");
    assert.strictEqual(toteBag.primaryImageUrl, photoUrl);
    assert.strictEqual(toteBag.stockTotal, 7);

    // 2. Buyer inquires about the newly added Tote Bag on WhatsApp
    await engine.handleBuyerWhatsAppInquiry({
      buyerPhone: "+2348077665544",
      buyerName: "Adaobi Nnamdi",
      text: "Do you have the Tote Bag?",
      simulateFastForwardIdleTimer: true,
    });

    // 3. Verify the WhatsApp bot reply displays the product image
    const buyerReply = engine.chatMessages.slice().reverse().find(
      (m) => m.channel === "BUYER_SHOP_WA" && m.text.includes("Tote Bag")
    );
    assert.ok(buyerReply, "Buyer should receive a reply about Tote Bag");
    assert.strictEqual(
      buyerReply.imageUrl,
      photoUrl,
      "WhatsApp reply must include the Tote Bag primary image"
    );
  });

  it("creates a product with custom category and custom attributes, and links vendor settlement bank subaccount", async () => {
    const engine = new CaterlogStage1Engine();

    // 1. Create product with category and custom fields
    const product = engine.addProduct({
      skuCode: "ANK-BAG-01",
      name: "Handmade Ankara Bag",
      category: "Fashion & Apparel",
      basePriceKobo: nairaToKobo(18500),
      stockTotal: 12,
      customFields: {
        Material: "100% Cotton Ankara",
        Color: "Indigo / Gold",
        Origin: "Lagos, Nigeria",
      },
    });

    assert.equal(product.skuCode, "ANK-BAG-01");
    assert.equal(product.category, "Fashion & Apparel");
    assert.deepEqual(product.customFields, {
      Material: "100% Cotton Ankara",
      Color: "Indigo / Gold",
      Origin: "Lagos, Nigeria",
    });

    // 2. Link vendor bank account and provision subaccount
    const bankRes = await engine.linkVendorBankAccount({
      bankCode: "058",
      accountNumber: "0234567890",
    });

    assert.ok(bankRes.subAccount.subAccountCode.startsWith("MFY_SUB_058_7890"));
    assert.equal(engine.vendor.monnifySubAccountCode, bankRes.subAccount.subAccountCode);
    assert.equal(engine.vendor.bankName, "Guaranty Trust Bank (GTBank)");
    assert.equal(engine.vendor.bankAccountNumber, "0234567890");

    // 3. Serialized state preserves custom fields and subaccount
    const state = engine.serializeState();
    const serializedProd = state.products.find((p) => p.skuCode === "ANK-BAG-01");
    assert.ok(serializedProd?.customFields);
    assert.equal(serializedProd.customFields.Material, "100% Cotton Ankara");
    assert.equal(state.vendor.monnifySubAccountCode, bankRes.subAccount.subAccountCode);
  });

  it("supports MVP 1 Post-Payment Web Tracker (/track/:code), Buyer Landmark & Alternate Phone Sync, 1-Click Rider Waybill, and 1-Click Instant Refund with Stock Restoration", async () => {
    const engine = new CaterlogStage1Engine();
    const buyerPhone = "+2348066778899";

    const shoeBefore = engine.products.find((p) => p.skuCode === "SHOE-01")!;
    const initialStockTotal = shoeBefore.stockTotal;

    // 1. Buyer places an order on WhatsApp
    const inquiry = await engine.handleBuyerWhatsAppInquiry({
      buyerPhone,
      buyerName: "Zainab Lawal",
      text: "I want SHOE-01 delivered to Lekki",
      simulateFastForwardIdleTimer: true,
    });
    assert.ok(inquiry.createdOrder);
    const order = inquiry.createdOrder;

    // 2. Reconcile Monnify payment & verify the WhatsApp receipt contains the /track/:shortCode companion link
    const txRef = "MNFY_MVP1_TRACK_001";
    engine.monnify.seedMockVerifiedTransfer({
      providerTransactionRef: txRef,
      paymentReference: order.invoiceReference,
      invoiceReference: order.invoiceReference,
      paymentStatus: "PAID",
      amountPaidKobo: order.totalAmountKobo,
      payerName: "Zainab Lawal",
      paymentMethod: "ACCOUNT_TRANSFER",
      serverVerifiedAt: new Date(),
      rawResponse: {},
    });
    const payload = JSON.stringify({ eventData: { transactionReference: txRef } });
    await engine.reconcileMonnifyWebhook({
      rawBody: payload,
      signatureHeader: engine.monnify.signPayloadForTesting(payload),
      providerTransactionRef: txRef,
    });

    assert.equal(order.status, "PAID");
    assert.equal(order.paymentTransactionRef, txRef);
    assert.equal(shoeBefore.stockTotal, initialStockTotal - order.quantity);

    const paymentReceiptMsg = engine.chatMessages.find(
      (m) => m.channel === "BUYER_SHOP_WA" && m.text.includes("Payment Confirmed!")
    );
    assert.ok(paymentReceiptMsg);
    assert.ok(
      paymentReceiptMsg.text.includes(`/track/${order.shortCode}`),
      "WhatsApp payment receipt must include the /track/:orderCode companion web link"
    );

    // 3. Buyer opens /track/:orderCode and submits Street Address, Prominent Landmark, and Alternate Gate Phone
    const publicBefore = engine.getPublicOrderReceipt(order.shortCode);
    assert.ok(publicBefore);
    assert.equal(publicBefore.status, "PAID");
    assert.equal(publicBefore.paymentTransactionRef, txRef);

    const updatedOrder = await engine.updateOrderDeliveryDetails(order.shortCode, {
      deliveryAddress: "22 Fola Osibo Street, Lekki Phase 1",
      deliveryLandmark: "Yellow gate opposite Ebeano Supermarket",
      alternatePhone: "08091112233",
    });

    assert.ok(updatedOrder);
    assert.equal(updatedOrder.deliveryAddress, "22 Fola Osibo Street, Lekki Phase 1");
    assert.equal(updatedOrder.deliveryLandmark, "Yellow gate opposite Ebeano Supermarket");
    assert.equal(updatedOrder.alternatePhone, "08091112233");

    // Verify buyer's AWAITING_DELIVERY_ADDRESS session was automatically satisfied & cleared
    const sessionAfterWebUpdate = engine.buyerSessions.get(buyerPhone);
    assert.equal(sessionAfterWebUpdate, undefined);

    // 4. Generate 1-Click Dispatch Rider Waybill and verify landmark, alt phone, and paid-in-advance stamp
    const waybill = engine.getOrderWaybill(order.shortCode);
    assert.ok(waybill);
    assert.equal(waybill.waybillNumber, `WB-${order.shortCode}`);
    assert.equal(waybill.deliveryLandmark, "Yellow gate opposite Ebeano Supermarket");
    assert.equal(waybill.alternatePhone, "08091112233");
    assert.ok(waybill.paymentStamp.includes("PAID IN ADVANCE"));
    assert.ok(waybill.whatsappRiderText.includes("Yellow gate opposite Ebeano Supermarket"));
    assert.ok(waybill.whatsappRiderText.includes("08091112233"));

    // 5. Vendor triggers 1-Click Instant Refund -> Monnify refund initiated, stock restored, order marked REFUNDED
    const refundRes = await engine.refundOrder(order.shortCode, {
      reason: "Customer requested swap to flat sandals",
    });

    assert.ok(refundRes);
    assert.equal(refundRes.order.status, "REFUNDED");
    assert.ok(refundRes.refund.refundReference.startsWith("MFY_RFD_"));
    assert.equal(refundRes.order.refundReference, refundRes.refund.refundReference);
    assert.equal(refundRes.order.refundReason, "Customer requested swap to flat sandals");

    // Verify inventory stock was automatically restored to initial level
    assert.equal(
      shoeBefore.stockTotal,
      initialStockTotal,
      "Product stock must be restored automatically after instant refund"
    );

    // Verify buyer received official WhatsApp refund receipt
    const buyerRefundMsg = engine.chatMessages.find(
      (m) => m.channel === "BUYER_SHOP_WA" && m.text.includes("INSTANT REFUND PROCESSED")
    );
    assert.ok(buyerRefundMsg);
    assert.ok(buyerRefundMsg.text.includes(refundRes.refund.refundReference));
  });
});

