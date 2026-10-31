import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nairaToKobo } from "@caterlog/commerce-core";
import { MonnifyPaymentAdapter, WhatsAppCloudAdapter } from "./index.ts";

describe("Layer 1 Integrations — Monnify & WhatsApp Cloud Adapters", () => {
  it("generates a 10-digit Monnify Dynamic NUBAN and verifies HMAC-SHA512 webhook signatures", async () => {
    const monnify = new MonnifyPaymentAdapter({
      baseUrl: "https://sandbox.monnify.com",
      apiKey: "MK_TEST_KEY",
      secretKey: "SK_TEST_SECRET",
      contractCode: "1234567890",
      sandboxMock: true,
    });

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const invoice = await monnify.createDynamicVirtualAccount({
      orderId: "ord-uuid-1",
      orderShortCode: "ORD-882",
      vendorBusinessName: "Amaka Luxury Shoes",
      customerPhone: "+2348099887766",
      expectedAmountKobo: nairaToKobo(28500),
      expiresAt,
    });

    assert.equal(invoice.provider, "MONNIFY");
    assert.equal(invoice.accountNumber.length, 10);
    assert.match(invoice.accountNumber, /^80\d{8}$/);
    assert.equal(invoice.bankName, "Moniepoint MFB");

    // Verify HMAC-SHA512 webhook signature validation
    const rawWebhookPayload = JSON.stringify({
      eventType: "SUCCESSFUL_TRANSACTION",
      eventData: { transactionReference: "MNFY|2026|001", amountPaid: 28500 },
    });
    const validSignature = monnify.signPayloadForTesting(rawWebhookPayload);

    assert.equal(monnify.verifyWebhookSignature(rawWebhookPayload, validSignature), true);
    assert.equal(monnify.verifyWebhookSignature(rawWebhookPayload, "invalid-sig"), false);
  });

  it("sends WhatsApp Invoice Summary followed by a standalone 10-digit NUBAN bubble for 1-tap mobile copy", async () => {
    const whatsapp = new WhatsAppCloudAdapter({
      accessToken: "EAAG_MOCK",
      defaultPhoneNumberId: "105992837465001",
      appSecret: "wa_app_secret",
      verifyToken: "wa_verify_token",
      sandboxMock: true,
    });

    await whatsapp.sendVirtualAccountInvoice({
      toBuyerPhone: "+2348099887766",
      vendorBusinessName: "Amaka Luxury Shoes",
      isVendorVerified: true,
      orderShortCode: "ORD-882",
      productSummary: "Zara Block Heel (x1)",
      totalAmountFormatted: "₦28,500",
      bankName: "Moniepoint MFB",
      accountNumber: "8092341102",
      accountName: "CATERLOG / AMAKA LUXURY SHOES",
      expiresInMinutes: 15,
    });

    const outbox = whatsapp.getSandboxOutbox();
    assert.equal(outbox.length, 2);
    assert.ok(outbox[0]?.text.includes("✓ *Verified Caterlog Seller*"));
    assert.ok(outbox[0]?.text.includes("₦28,500"));
    // Second bubble MUST be only the 10-digit account number so the buyer can 1-tap copy on WhatsApp mobile
    assert.equal(outbox[1]?.text, "8092341102");
  });
});

