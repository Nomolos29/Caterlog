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

