import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CaterlogStage1Engine } from "./runtime-engine.ts";
import { renderDynamicProductOgSvg } from "./og-card.ts";

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
});

