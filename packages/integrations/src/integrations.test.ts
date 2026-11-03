import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nairaToKobo } from "@caterlog/commerce-core";
import {
  MonnifyPaymentAdapter,
  resolveIntegrationConfig,
  resolveMonnifyConfig,
  validateIntegrationConfig,
  WhatsAppCatalogAdapter,
  WhatsAppCloudAdapter,
} from "./index.ts";

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

  it("resolves explicit modes, honours legacy sandbox flags, and only fails validation for real modes", () => {
    const explicit = resolveMonnifyConfig({
      MONNIFY_MODE: "sandbox",
      MONNIFY_BASE_URL: "https://sandbox.monnify.com",
      MONNIFY_API_KEY: "MK_TEST_abc",
      MONNIFY_SECRET_KEY: "SK_TEST_abc",
      MONNIFY_CONTRACT_CODE: "1234567890",
    });
    assert.equal(explicit.mode, "sandbox");
    assert.equal(validateIntegrationConfig(resolveIntegrationConfig({
      MONNIFY_MODE: "sandbox",
      MONNIFY_API_KEY: "MK_TEST_abc",
      MONNIFY_SECRET_KEY: "SK_TEST_abc",
      MONNIFY_CONTRACT_CODE: "1234567890",
      WHATSAPP_MODE: "mock",
      WHATSAPP_CATALOG_MODE: "mock",
    })).filter((issue) => issue.severity === "error").length, 0);

    // Legacy `MONNIFY_SANDBOX_MOCK=false` with the sandbox URL means sandbox, not live.
    const legacy = resolveMonnifyConfig({
      MONNIFY_SANDBOX_MOCK: "false",
      MONNIFY_BASE_URL: "https://sandbox.monnify.com",
    });
    assert.equal(legacy.mode, "sandbox");

    // Explicit mode wins over the legacy flag.
    const precedence = resolveMonnifyConfig({
      MONNIFY_MODE: "live",
      MONNIFY_SANDBOX_MOCK: "true",
      MONNIFY_BASE_URL: "https://api.monnify.com",
    });
    assert.equal(precedence.mode, "live");

    // Fresh checkouts stay in mock mode even without credentials.
    const defaults = resolveIntegrationConfig({});
    assert.equal(defaults.monnify.mode, "mock");
    assert.equal(defaults.whatsapp.mode, "mock");
    assert.equal(defaults.catalog.mode, "mock");
    assert.equal(validateIntegrationConfig(defaults).length, 0);

    // Real mode with `.env.example` placeholders fails fast.
    const invalid = validateIntegrationConfig(
      resolveIntegrationConfig({
        MONNIFY_MODE: "live",
        MONNIFY_API_KEY: "MK_TEST_PLACEHOLDER",
        MONNIFY_SECRET_KEY: "SK_TEST_PLACEHOLDER",
        MONNIFY_CONTRACT_CODE: "1234567890",
      })
    );
    assert.ok(
      invalid.some(
        (issue) =>
          issue.severity === "error" && issue.variable === "MONNIFY_API_KEY"
      )
    );
  });

  it("maps vendor products to Meta catalog items and syncs them in mock mode", async () => {
    const catalog = new WhatsAppCatalogAdapter({
      mode: "mock",
      catalogId: "catalog-123",
      businessAccountId: "waba-456",
      accessToken: "token",
      productUrlBase: "https://shop.caterlog.store/p",
    });

    const item = catalog.mapProduct({
      skuCode: "shoe-01",
      name: "Zara Block Heel (Gold)",
      description: "Imported gold strap block heel",
      basePriceKobo: 2_850_000n,
      stockAvailable: 4,
      primaryImageUrl: "https://cdn.example.com/shoe.jpg",
    });

    assert.equal(item.retailer_id, "SHOE-01");
    assert.equal(item.price, 2_850_000); // kobo integer, not Naira float
    assert.equal(item.currency, "NGN");
    assert.equal(item.availability, "in stock");
    assert.equal(item.url, "https://shop.caterlog.store/p/SHOE-01");
    assert.equal(item.image_url, "https://cdn.example.com/shoe.jpg");

    const outOfStock = catalog.mapProduct({
      skuCode: "BAG-02",
      name: "Sold Out Bag",
      basePriceKobo: 1_000_000n,
      stockAvailable: 0,
    });
    assert.equal(outOfStock.availability, "out of stock");

    const first = await catalog.syncProducts([{
      skuCode: "SHOE-01",
      name: "Zara Block Heel (Gold)",
      basePriceKobo: 2_850_000n,
      stockAvailable: 4,
    }]);
    assert.equal(first.upserted, 1);
    assert.equal(first.failed.length, 0);
    assert.equal(catalog.getMockCatalog().length, 1);
    assert.equal(catalog.getIntegrationStatus().publishedItems, 1);

    // A later sync that deletes missing items drops the old SKU.
    const second = await catalog.syncProducts([], {
      deleteMissing: true,
      existingSkus: [],
    });
    assert.equal(second.upserted, 0);
    assert.equal(catalog.getMockCatalog().length, 0);
  });

  it("emits catalog and product-list interactive messages in mock mode", async () => {
    const whatsapp = new WhatsAppCloudAdapter({
      mode: "mock",
      accessToken: "token",
      defaultPhoneNumberId: "105992837465001",
      appSecret: "secret",
      verifyToken: "verify",
      graphApiVersion: "v22.0",
    });

    await whatsapp.sendCatalogMessage({
      toPhone: "+2348099887766",
      bodyText: "Browse the new arrivals",
    });
    await whatsapp.sendProductListMessage({
      toPhone: "+2348099887766",
      headerText: "New arrivals",
      bodyText: "Pick a pair",
      catalogId: "catalog-123",
      sections: [{ title: "Shoes", productRetailerIds: ["SHOE-01"] }],
    });

    const outbox = whatsapp.getSandboxOutbox();
    assert.equal(outbox.length, 2);
    assert.equal(outbox[0]?.kind, "CATALOG_MESSAGE");
    const catalogPayload = outbox[0]?.payload as {
      interactive: { type: string; action: { name: string } };
    };
    assert.equal(catalogPayload.interactive.type, "catalog_message");
    assert.equal(catalogPayload.interactive.action.name, "catalog_message");

    assert.equal(outbox[1]?.kind, "PRODUCT_LIST");
    const listPayload = outbox[1]?.payload as {
      interactive: {
        action: { catalog_id: string; sections: Array<{ product_items: unknown[] }> };
      };
    };
    assert.equal(listPayload.interactive.action.catalog_id, "catalog-123");
    assert.equal(listPayload.interactive.action.sections[0]?.product_items.length, 1);
  });
});

