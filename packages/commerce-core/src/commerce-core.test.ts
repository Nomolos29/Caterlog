import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  nairaToKobo,
  formatNaira,
  computeDiscountKobo,
  computeOrderTotalKobo,
  evaluatePaymentReconciliation,
  canTransitionOrderStatus,
  evaluateCopilotAction,
  shouldExecuteScheduledTakeover,
  parseVendorWhatsAppCommand,
  computePhashHammingDistance,
  InMemoryDomainEventBus,
} from "./index.ts";

describe("Layer 1 Commerce Core — Pure Domain & Architecture Tests", () => {
  it("converts Naira to Kobo accurately including Nigerian #6000, N3500, and 6k shorthands", () => {
    assert.equal(nairaToKobo(25000), 2500000n);
    assert.equal(nairaToKobo("₦3,500"), 350000n);
    assert.equal(nairaToKobo("#6000"), 600000n);
    assert.equal(nairaToKobo("N6,000"), 600000n);
    assert.equal(nairaToKobo("#6k"), 600000n);
    assert.equal(formatNaira(2850000n), "₦28,500");
  });

  it("computes percentage and flat kobo discounts and order totals", () => {
    const subtotalKobo = nairaToKobo(25000);
    const shippingFeeKobo = nairaToKobo(3500);

    // 10% off (1000 basis points)
    const discountAmountKobo = computeDiscountKobo({
      subtotalKobo,
      discountType: "PERCENTAGE",
      discountValue: 1000n,
      minOrderKobo: nairaToKobo(20000),
    });
    assert.equal(discountAmountKobo, nairaToKobo(2500));

    const breakdown = computeOrderTotalKobo({
      subtotalKobo,
      shippingFeeKobo,
      discountAmountKobo,
    });
    // 25,000 - 2,500 + 3,500 = 26,000 Naira
    assert.equal(breakdown.totalAmountKobo, nairaToKobo(26000));
  });

  it("reconciles exact, partial (forgot shipping fee), and over-payments", () => {
    const totalAmountKobo = nairaToKobo(28500); // 25k item + 3.5k shipping

    // Buyer transfers only 25,000 (forgot 3,500 shipping)
    const partial = evaluatePaymentReconciliation({
      totalAmountKobo,
      previousAmountPaidKobo: 0n,
      verifiedIncomingKobo: nairaToKobo(25000),
    });
    assert.equal(partial.nextStatus, "PARTIALLY_PAID");
    assert.equal(partial.remainingBalanceKobo, nairaToKobo(3500));
    assert.equal(partial.shouldConsumeStockReservation, false);

    // Buyer transfers remaining 3,500 balance
    const completed = evaluatePaymentReconciliation({
      totalAmountKobo,
      previousAmountPaidKobo: partial.newAmountPaidKobo,
      verifiedIncomingKobo: nairaToKobo(3500),
    });
    assert.equal(completed.nextStatus, "PAID");
    assert.equal(completed.remainingBalanceKobo, 0n);
    assert.equal(completed.shouldConsumeStockReservation, true);
  });

  it("enforces strict order state transitions", () => {
    assert.equal(canTransitionOrderStatus("PENDING_PAYMENT", "PAID"), true);
    assert.equal(canTransitionOrderStatus("PENDING_PAYMENT", "OUT_FOR_DELIVERY"), false);
    assert.equal(canTransitionOrderStatus("PAID", "OUT_FOR_DELIVERY"), true);
  });

  it("evaluates Smart Co-Pilot idle takeover (default 60s) and cancels if vendor replies", () => {
    const decision = evaluateCopilotAction({
      copilotMode: "COPILOT",
      copilotIdleSeconds: 60,
      sessionCopilotPaused: false,
      lastVendorMessageAt: null,
      now: new Date("2026-10-31T12:00:00Z"),
    });
    assert.equal(decision.action, "SCHEDULE_IDLE_TAKEOVER");
    if (decision.action === "SCHEDULE_IDLE_TAKEOVER") {
      assert.equal(decision.delaySeconds, 60);
    }

    // If vendor replied on their phone 20 seconds after buyer asked, cancel auto-takeover
    const shouldTakeOverWhenVendorReplied = shouldExecuteScheduledTakeover({
      buyerMessageReceivedAt: new Date("2026-10-31T12:00:00Z"),
      lastVendorMessageAt: new Date("2026-10-31T12:00:20Z"),
      sessionCopilotPaused: false,
      copilotMode: "COPILOT",
    });
    assert.equal(shouldTakeOverWhenVendorReplied, false);

    // If vendor has not replied since yesterday, execute auto-takeover
    const shouldTakeOverWhenVendorIdle = shouldExecuteScheduledTakeover({
      buyerMessageReceivedAt: new Date("2026-10-31T12:00:00Z"),
      lastVendorMessageAt: new Date("2026-10-30T18:00:00Z"),
      sessionCopilotPaused: false,
      copilotMode: "COPILOT",
    });
    assert.equal(shouldTakeOverWhenVendorIdle, true);
  });

  it("matches WhatsApp Status product photos using perceptual hash (pHash) Hamming distance", () => {
    const catalogPhash = "f8c39a71b2e409d1";
    const statusCompressedPhash = "f8c39a71b2e409d0"; // 1 bit difference after WhatsApp compression
    const unrelatedPhotoPhash = "0123456789abcdef";

    assert.equal(computePhashHammingDistance(catalogPhash, statusCompressedPhash), 1);
    assert.ok(computePhashHammingDistance(catalogPhash, unrelatedPhotoPhash) > 20);
  });

  it("parses all Dual-Access WhatsApp Vendor Keyword commands accurately", () => {
    assert.deepEqual(parseVendorWhatsAppCommand("dashboard"), { type: "OPEN_DASHBOARD" });
    assert.deepEqual(parseVendorWhatsAppCommand("sales week"), {
      type: "SALES_SUMMARY",
      range: "week",
    });
    assert.deepEqual(parseVendorWhatsAppCommand("shipping add Lekki Phase 1 3500"), {
      type: "UPSERT_SHIPPING",
      name: "Lekki Phase 1",
      feeKobo: 350000n,
    });
    assert.deepEqual(parseVendorWhatsAppCommand("ship Ibadan #6000"), {
      type: "UPSERT_SHIPPING",
      name: "Ibadan",
      feeKobo: 600000n,
    });
    assert.deepEqual(parseVendorWhatsAppCommand("shiping Yaba #2,500"), {
      type: "UPSERT_SHIPPING",
      name: "Yaba",
      feeKobo: 250000n,
    });
    assert.deepEqual(parseVendorWhatsAppCommand("delivery Abuja 5k"), {
      type: "UPSERT_SHIPPING",
      name: "Abuja",
      feeKobo: 500000n,
    });
    assert.deepEqual(parseVendorWhatsAppCommand("disc VIP #5000"), {
      type: "CREATE_DISCOUNT",
      code: "VIP",
      discountType: "FLAT_KOBO",
      value: 500000n,
    });
    assert.deepEqual(parseVendorWhatsAppCommand("shipping delete 2"), {
      type: "DELETE_SHIPPING",
      code: 2,
    });
    assert.deepEqual(parseVendorWhatsAppCommand("discount add PAYDAY 10%"), {
      type: "CREATE_DISCOUNT",
      code: "PAYDAY",
      discountType: "PERCENTAGE",
      value: 1000n,
    });
    assert.deepEqual(parseVendorWhatsAppCommand("discount add VIP 5000"), {
      type: "CREATE_DISCOUNT",
      code: "VIP",
      discountType: "FLAT_KOBO",
      value: 500000n,
    });
    assert.deepEqual(parseVendorWhatsAppCommand("stock SHOE-01 12"), {
      type: "UPDATE_STOCK",
      skuCode: "SHOE-01",
      stockTotal: 12,
    });
    assert.deepEqual(parseVendorWhatsAppCommand("mode copilot 90s"), {
      type: "SET_COPILOT_MODE",
      mode: "COPILOT",
      idleSeconds: 90,
    });
    assert.deepEqual(parseVendorWhatsAppCommand("hold 20"), {
      type: "SET_RESERVATION_TTL",
      minutes: 20,
    });
    assert.deepEqual(parseVendorWhatsAppCommand("dispatch 882 08031112222"), {
      type: "DISPATCH_ORDER",
      shortCode: "ORD-882",
      riderPhone: "08031112222",
    });
    assert.deepEqual(parseVendorWhatsAppCommand("Zara Block Heel, 25000, stock 5"), {
      type: "QUICK_ADD_PRODUCT",
      name: "Zara Block Heel",
      priceKobo: 2500000n,
      stockTotal: 5,
    });
  });

  it("publishes cross-layer domain events so future layers subscribe without coupling", async () => {
    const bus = new InMemoryDomainEventBus();
    const receivedEvents: string[] = [];

    bus.on("INVENTORY_CHANGED", (ev) => {
      receivedEvents.push(`${ev.eventType}:${ev.entityId}`);
    });

    await bus.publish({
      eventType: "INVENTORY_CHANGED",
      vendorId: "vendor-1",
      actorType: "VENDOR_WA_KEYWORD",
      entityType: "PRODUCT",
      entityId: "prod-1",
      payload: { stockTotal: 10 },
      occurredAt: new Date(),
    });

    assert.deepEqual(receivedEvents, ["INVENTORY_CHANGED:prod-1"]);
  });
});

