import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nairaToKobo, type ServerVerifiedPaymentRecord } from "@caterlog/commerce-core";
import { CaterlogStage1Engine } from "./runtime-engine.ts";
import type {
  PersistenceEvent,
  PersistenceStore,
} from "./persistence/types.ts";
import type {
  RuntimeDiscount,
  RuntimeOrder,
  RuntimeProduct,
  RuntimeShippingZone,
  RuntimeSnapshot,
  RuntimeVendor,
} from "./runtime-types.ts";

class FakePersistenceStore implements PersistenceStore {
  public readonly mode = "database" as const;
  public savedVendor: RuntimeVendor | null = null;
  public savedProducts: RuntimeProduct[] = [];
  public savedZones: RuntimeShippingZone[] = [];
  public savedDiscounts: RuntimeDiscount[] = [];
  public savedOrders: RuntimeOrder[] = [];
  public payments: Array<{ order: RuntimeOrder; verified: ServerVerifiedPaymentRecord }> = [];
  public events: PersistenceEvent[] = [];
  public closed = false;
  private readonly snapshot: RuntimeSnapshot | null;

  constructor(snapshot: RuntimeSnapshot | null) {
    this.snapshot = snapshot;
  }

  public async loadSnapshot(_vendorSlug: string): Promise<RuntimeSnapshot | null> {
    return this.snapshot;
  }
  public async saveVendor(vendor: RuntimeVendor): Promise<void> {
    this.savedVendor = { ...vendor };
  }
  public async saveProduct(product: RuntimeProduct): Promise<void> {
    this.savedProducts.push({ ...product });
  }
  public async deleteProduct(skuCode: string): Promise<void> {
    this.savedProducts = this.savedProducts.filter(
      (p) => p.skuCode.toUpperCase() !== skuCode.toUpperCase()
    );
  }
  public async saveShippingZone(zone: RuntimeShippingZone): Promise<void> {
    this.savedZones.push({ ...zone });
  }
  public async saveDiscount(discount: RuntimeDiscount): Promise<void> {
    this.savedDiscounts.push({ ...discount });
  }
  public async createOrder(order: RuntimeOrder, _product: RuntimeProduct): Promise<void> {
    this.savedOrders.push({ ...order });
  }
  public async saveOrder(order: RuntimeOrder): Promise<void> {
    this.savedOrders.push({ ...order });
  }
  public async recordPayment(
    order: RuntimeOrder,
    verified: ServerVerifiedPaymentRecord
  ): Promise<void> {
    this.payments.push({ order: { ...order }, verified });
  }
  public async recordEvent(event: PersistenceEvent): Promise<void> {
    this.events.push(event);
  }
  public async close(): Promise<void> {
    this.closed = true;
  }
}

function buildSnapshot(): RuntimeSnapshot {
  return {
    vendor: {
      id: "v-db-001",
      slug: "persisted-shop",
      businessName: "Persisted Shop",
      whatsappPhone: "+2348000000000",
      whatsappPhoneId: "100000000000001",
      verificationStatus: "VERIFIED",
      copilotMode: "COPILOT",
      copilotIdleSeconds: 60,
      reservationTtlMinutes: 15,
    },
    products: [
      {
        id: "prod-db-1",
        skuCode: "SHOE-01",
        name: "Persisted Heel",
        description: "Loaded from PostgreSQL",
        category: "fashion",
        basePriceKobo: nairaToKobo(20000),
        primaryImageUrl: "https://example.test/heel.png",
        imagePhash: "0123456789abcdef",
        stockTotal: 10,
        stockReserved: 2,
      },
    ],
    shippingZones: [
      { id: "zone-1", code: 1, name: "Lekki", feeKobo: nairaToKobo(3000), isActive: true },
    ],
    discounts: [],
    orders: [
      {
        id: "ord-db-1",
        shortCode: "ORD-900",
        customerPhone: "+2348111111111",
        customerName: "Database Buyer",
        productId: "prod-db-1",
        productSku: "SHOE-01",
        productName: "Persisted Heel",
        quantity: 1,
        shippingZoneName: "Lekki",
        subtotalKobo: nairaToKobo(20000),
        shippingFeeKobo: nairaToKobo(3000),
        discountAmountKobo: 0n,
        totalAmountKobo: nairaToKobo(23000),
        amountPaidKobo: 0n,
        status: "PENDING_PAYMENT",
        invoiceReference: "CAT_ORD900_TEST",
        accountNumber: "8090000000",
        bankName: "Moniepoint MFB",
        accountName: "CATERLOG / PERSISTED SHOP",
        paymentExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        createdAt: new Date(),
      },
    ],
    processedTransactionRefs: [],
  };
}

describe("PersistenceStore wiring", () => {
  it("hydrates the engine from a database snapshot and writes mutations through", async () => {
    const store = new FakePersistenceStore(buildSnapshot());
    const engine = new CaterlogStage1Engine();

    await engine.attachPersistence(store, "persisted-shop");

    assert.equal(engine.getDataMode(), "database");
    assert.equal(engine.vendor.businessName, "Persisted Shop");
    assert.equal(engine.products.length, 1);
    assert.equal(engine.products[0]!.stockTotal, 10);
    assert.equal(engine.orders[0]!.shortCode, "ORD-900");

    engine.updateSettings({ reservationTtlMinutes: 45 });
    engine.updateProductStock("SHOE-01", 12);
    engine.upsertShippingZone("Ikeja", nairaToKobo(2000));
    engine.upsertDiscount({ code: "DB10", type: "PERCENTAGE", value: 1000n });
    await engine.flushPersistence();

    assert.equal(store.savedVendor?.reservationTtlMinutes, 45);
    assert.ok(store.savedProducts.some((p) => p.stockTotal === 12));
    assert.ok(store.savedZones.some((z) => z.name === "Ikeja"));
    assert.ok(store.savedDiscounts.some((d) => d.code === "DB10"));

    await engine.closePersistence();
    assert.equal(store.closed, true);
  });

  it("rejects database hydration when the vendor is missing", async () => {
    const engine = new CaterlogStage1Engine();
    const store = new FakePersistenceStore(null);
    await assert.rejects(
      () => engine.attachPersistence(store, "missing-vendor"),
      /was not found in the database/
    );
  });

  it("persists a verified payment and order transition exactly once", async () => {
    const store = new FakePersistenceStore(buildSnapshot());
    const engine = new CaterlogStage1Engine();
    await engine.attachPersistence(store, "persisted-shop");

    const order = engine.orders[0]!;
    engine.monnify.seedMockVerifiedTransfer({
      providerTransactionRef: "MNFY_DB_001",
      paymentReference: order.invoiceReference,
      invoiceReference: order.invoiceReference,
      paymentStatus: "PAID",
      amountPaidKobo: order.totalAmountKobo,
      payerName: "Database Buyer",
      paymentMethod: "ACCOUNT_TRANSFER",
      serverVerifiedAt: new Date(),
      rawResponse: {},
    });

    const paid = await engine.verifyOrderPayment("ORD-900");
    assert.ok(paid);
    assert.equal(paid.status, "PAID");
    assert.equal(paid.applied, true);
    assert.equal(store.payments.length, 1);
    assert.equal(store.savedOrders.at(-1)?.status, "PAID");

    // Duplicate polling must not create a second provider transaction.
    const duplicate = await engine.verifyOrderPayment("ORD-900");
    assert.ok(duplicate);
    assert.equal(duplicate.applied, false);
    assert.equal(store.payments.length, 1);

    await engine.closePersistence();
  });
});
