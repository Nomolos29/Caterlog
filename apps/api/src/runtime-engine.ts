import crypto from "node:crypto";
import {
  assertValidOrderTransition,
  computeDiscountKobo,
  computeOrderTotalKobo,
  computePhashHammingDistance,
  evaluateCopilotAction,
  evaluatePaymentReconciliation,
  formatNaira,
  InMemoryDomainEventBus,
  koboToNaira,
  nairaToKobo,
  parseVendorWhatsAppCommand,
  shouldExecuteScheduledTakeover,
  type DomainCopilotMode,
  type DomainOrderStatus,
  type ServerVerifiedPaymentRecord,
} from "@caterlog/commerce-core";
import {
  assertValidIntegrationConfig,
  describeIntegrationConfig,
  MonnifyPaymentAdapter,
  resolveIntegrationConfig,
  WhatsAppCatalogAdapter,
  WhatsAppCloudAdapter,
  type CatalogSyncResult,
  type EnvLike,
  type IntegrationConfig,
} from "@caterlog/integrations";
import type {
  BuyerConversationSession,
  ChatThreadMessage,
  PaymentReconciliationResult,
  QuickReplyOption,
  RuntimeCartItem,
  RuntimeDiscount,
  RuntimeOrder,
  RuntimeOrderItem,
  RuntimeProduct,
  RuntimeProductVariant,
  RuntimeShippingZone,
  RuntimeSnapshot,
  RuntimeVendor,
} from "./runtime-types.ts";
import { createMemoryPersistence } from "./persistence/memory.ts";
import type { PersistenceStore } from "./persistence/types.ts";
import type { BackgroundJobScheduler } from "./jobs/types.ts";

export type {
  BuyerConversationSession,
  ChatThreadMessage,
  PaymentReconciliationResult,
  QuickReplyOption,
  RuntimeDiscount,
  RuntimeOrder,
  RuntimeProduct,
  RuntimeShippingZone,
  RuntimeSnapshot,
  RuntimeVendor,
} from "./runtime-types.ts";


/**
 * High-quality contextual fallback photos for products added via WhatsApp
 * without an image attachment, avoiding placeholder/broken image boxes.
 */
export function getSmartFallbackImage(name: string, category?: string): string {
  const combined = `${name} ${category ?? ""}`.toLowerCase();
  if (/heel|shoe|boot|sneaker|slide|sandal|footwear/i.test(combined)) {
    return "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600&q=80";
  }
  if (/bag|tote|handbag|purse|backpack|clutch/i.test(combined)) {
    return "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=80";
  }
  if (/dress|shirt|gown|cloth|wear|hoodie|top|pants|suit|jacket/i.test(combined)) {
    return "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80";
  }
  if (/flask|bottle|cup|tumbler|mug|drinkware/i.test(combined)) {
    return "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&q=80";
  }
  if (/food|lunch|cake|snack|rice|pastry|meal|kitchen/i.test(combined)) {
    return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80";
  }
  if (/cosmetic|cream|lotion|perfume|oil|soap|beauty|skin/i.test(combined)) {
    return "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=600&q=80";
  }
  return "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80";
}

/**
 * Deterministically computes a 64-bit hex perceptual fingerprint (`imagePhash`)
 * from an uploaded image Data URL or URL string.
 */
export function computeDeterministicImagePhash(imageSource: string): string {
  return crypto.createHash("sha256").update(imageSource.trim()).digest("hex").slice(0, 16);
}

export class CaterlogStage1Engine {
  public readonly eventBus = new InMemoryDomainEventBus();
  public readonly monnify: MonnifyPaymentAdapter;
  public readonly whatsapp: WhatsAppCloudAdapter;
  public readonly catalog: WhatsAppCatalogAdapter;
  public readonly integrationConfig: IntegrationConfig;

  public vendor: RuntimeVendor = {
    id: "v-amaka-001",
    slug: "amaka-shoes",
    businessName: "Amaka Luxury Shoes",
    whatsappPhone: process.env.VENDOR_WHATSAPP_PHONE ?? "+2348031234567",
    whatsappPhoneId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "105992837465001",
    verificationStatus: "VERIFIED",
    copilotMode: "COPILOT" as DomainCopilotMode,
    copilotIdleSeconds: 60,
    reservationTtlMinutes: 15,
  };

  public products: RuntimeProduct[] = [
    {
      id: "prod-1",
      skuCode: "SHOE-01",
      name: "Zara Block Heel (Gold)",
      description: "Imported gold strap block heel, sizes 38-41.",
      category: "fashion",
      basePriceKobo: nairaToKobo(25000),
      primaryImageUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600&q=80",
      imagePhash: "f8c39a71b2e409d1",
      stockTotal: 5,
      stockReserved: 1,
    },
    {
      id: "prod-2",
      skuCode: "SHOE-02",
      name: "Hermes Oran Leather Slide",
      description: "Classic tan flat leather sandal for everyday luxury.",
      category: "fashion",
      basePriceKobo: nairaToKobo(18500),
      primaryImageUrl: "https://images.unsplash.com/photo-1562273138-f46be4ebdf33?w=600&q=80",
      imagePhash: "a1b2c3d4e5f60718",
      stockTotal: 8,
      stockReserved: 0,
    },
    {
      id: "prod-3",
      skuCode: "BAG-01",
      name: "Jacquemus Le Chiquito Mini Bag",
      description: "Structured mini top-handle bag with gold hardware.",
      category: "fashion",
      basePriceKobo: nairaToKobo(42000),
      primaryImageUrl: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=80",
      imagePhash: "9988776655443322",
      stockTotal: 3,
      stockReserved: 0,
    },
    {
      id: "prod-4",
      skuCode: "SKU-0895",
      name: "Stainless Steel Vacuum Flask",
      description: "Double-walled stainless steel thermal vacuum flask.",
      category: "Kitchenware & Drinkware",
      basePriceKobo: nairaToKobo(10000),
      primaryImageUrl: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500&auto=format&fit=crop&q=60",
      imagePhash: "1122334455667788",
      stockTotal: 45,
      stockReserved: 0,
    },
  ];

  public shippingZones: RuntimeShippingZone[] = [
    { id: "sz-1", code: 1, name: "Mainland", feeKobo: nairaToKobo(2500), isActive: true },
    { id: "sz-2", code: 2, name: "Lekki", feeKobo: nairaToKobo(3500), isActive: true },
    { id: "sz-3", code: 3, name: "Abuja / Interstate", feeKobo: nairaToKobo(5000), isActive: true },
    { id: "sz-4", code: 4, name: "Pickup", feeKobo: nairaToKobo(0), isActive: true },
  ];

  public discounts: RuntimeDiscount[] = [
    {
      id: "disc-1",
      code: "PAYDAY",
      type: "PERCENTAGE",
      value: 1000n, // 10%
      minOrderKobo: nairaToKobo(15000),
      usedCount: 2,
      maxUses: 50,
      isActive: true,
    },
    {
      id: "disc-2",
      code: "VIP5000",
      type: "FLAT_KOBO",
      value: nairaToKobo(5000),
      minOrderKobo: nairaToKobo(35000),
      usedCount: 1,
      maxUses: 20,
      isActive: true,
    },
  ];

  public orders: RuntimeOrder[] = [
    {
      id: "ord-seed-882",
      shortCode: "ORD-882",
      customerPhone: "+2348099887766",
      customerName: "Chidinma Okafor",
      productId: "prod-1",
      productSku: "SHOE-01",
      productName: "Zara Block Heel (Gold)",
      variantId: "var-1-39",
      variantSku: "SHOE-01-39",
      variantName: "Size 39",
      quantity: 1,
      shippingZoneName: "Lekki",
      subtotalKobo: nairaToKobo(25000),
      shippingFeeKobo: nairaToKobo(3500),
      discountAmountKobo: 0n,
      totalAmountKobo: nairaToKobo(28500),
      amountPaidKobo: 0n,
      status: "PENDING_PAYMENT",
      invoiceReference: "CAT_ORD882_SEED",
      accountNumber: "8092341102",
      bankName: "Moniepoint MFB",
      accountName: "CATERLOG / AMAKA LUXUROUS SHOES",
      paymentExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      createdAt: new Date(Date.now() - 2 * 60 * 1000),
    },
    {
      id: "ord-seed-881",
      shortCode: "ORD-881",
      customerPhone: "+2348022334455",
      customerName: "Tunde Bakare",
      productId: "prod-2",
      productSku: "SHOE-02",
      productName: "Hermes Oran Leather Slide",
      quantity: 1,
      shippingZoneName: "Mainland",
      subtotalKobo: nairaToKobo(18500),
      shippingFeeKobo: nairaToKobo(2500),
      discountAmountKobo: 0n,
      totalAmountKobo: nairaToKobo(21000),
      amountPaidKobo: nairaToKobo(21000),
      status: "PAID",
      invoiceReference: "CAT_ORD881_SEED",
      accountNumber: "8044556677",
      bankName: "Moniepoint MFB",
      accountName: "CATERLOG / AMAKA LUXURY SHOES",
      paymentExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      createdAt: new Date(Date.now() - 45 * 60 * 1000),
      paidAt: new Date(Date.now() - 40 * 60 * 1000),
    },
  ];

  public chatMessages: ChatThreadMessage[] = [];

  public readonly buyerSessions = new Map<string, BuyerConversationSession>();
  public readonly buyerCarts = new Map<string, RuntimeCartItem[]>();

  public getBuyerCart(phone: string): RuntimeCartItem[] {
    return this.buyerCarts.get(phone) ?? [];
  }

  public addToBuyerCart(phone: string, item: RuntimeCartItem): RuntimeCartItem[] {
    const cart = this.buyerCarts.get(phone) ?? [];
    const existing = cart.find(
      (ci) => ci.productId === item.productId && ci.variantId === item.variantId
    );
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      cart.push({ ...item });
    }
    this.buyerCarts.set(phone, cart);
    return cart;
  }

  public clearBuyerCart(phone: string): void {
    this.buyerCarts.delete(phone);
  }
  private readonly processedTxRefs = new Set<string>();
  private readonly activeCopilotTimers = new Map<string, NodeJS.Timeout>();
  private lastVendorReplyInBuyerThreadAt: Date | null = null;
  private persistence: PersistenceStore = createMemoryPersistence();
  private persistenceQueue: Promise<void> = Promise.resolve();
  private readonly persistenceErrors: string[] = [];
  private jobScheduler: BackgroundJobScheduler | null = null;
  private readonly magicTokens = new Map<
    string,
    { token: string; vendorSlug: string; expiresAt: Date; used: boolean }
  >();

  public attachJobScheduler(scheduler: BackgroundJobScheduler | null): void {
    this.jobScheduler = scheduler;
  }

  public getJobScheduler(): BackgroundJobScheduler | null {
    return this.jobScheduler;
  }

  public createMagicLinkToken(): string {
    const token = crypto.randomBytes(24).toString("hex");
    this.magicTokens.set(token, {
      token,
      vendorSlug: this.vendor.slug,
      expiresAt: new Date(Date.now() + 15 * 60_000),
      used: false,
    });
    return token;
  }

  public verifyMagicLinkToken(token: string): { token: string; vendorSlug: string } | null {
    const record = this.magicTokens.get(token);
    if (!record || record.used || record.expiresAt < new Date()) {
      return null;
    }
    record.used = true;
    return { token: record.token, vendorSlug: record.vendorSlug };
  }

  constructor(env: EnvLike = process.env) {
    this.integrationConfig = resolveIntegrationConfig(env);
    // Mock mode is always allowed; sandbox/live fail fast on missing credentials.
    assertValidIntegrationConfig(this.integrationConfig);

    this.monnify = MonnifyPaymentAdapter.fromConfig(this.integrationConfig.monnify);
    this.whatsapp = WhatsAppCloudAdapter.fromConfig(this.integrationConfig.whatsapp);
    this.catalog = WhatsAppCatalogAdapter.fromConfig(this.integrationConfig.catalog, {
      brand: this.vendor.businessName,
      productUrlBase: env.CATALOG_PRODUCT_URL_BASE,
    });
  }

  /**
   * Switches the engine to a durable store and hydrates its working set.
   *
   * `DATA_MODE=memory` keeps the built-in demo data. When a database store is
   * attached, the demo seed is replaced by the persisted vendor snapshot and
   * every later mutation is mirrored back through `persistence`.
   */
  public async attachPersistence(
    store: PersistenceStore,
    vendorSlug: string = this.vendor.slug
  ): Promise<void> {
    this.persistence = store;
    const snapshot = await store.loadSnapshot(vendorSlug);
    if (snapshot) {
      this.applySnapshot(snapshot);
      return;
    }
    if (store.mode === "database") {
      throw new Error(
        `Vendor "${vendorSlug}" was not found in the database. Run "npm run db:seed" or set PERSISTENCE_VENDOR_SLUG to an existing vendor.`
      );
    }
    if ("initSnapshot" in store && typeof (store as any).initSnapshot === "function") {
      (store as any).initSnapshot(this.takeSnapshot());
    }
  }

  public takeSnapshot(): RuntimeSnapshot {
    return {
      vendor: { ...this.vendor },
      products: this.products.map((product) => ({ ...product })),
      shippingZones: this.shippingZones.map((zone) => ({ ...zone })),
      discounts: this.discounts.map((discount) => ({ ...discount })),
      orders: this.orders.map((order) => ({ ...order })),
      processedTransactionRefs: Array.from(this.processedTxRefs),
    };
  }

  public getDataMode(): "memory" | "database" {
    return this.persistence.mode;
  }

  /** Persistence failures observed since boot (for health/debug endpoints). */
  public getPersistenceErrors(): readonly string[] {
    return this.persistenceErrors;
  }

  /** Waits for all queued write-through operations to finish. */
  public async flushPersistence(): Promise<void> {
    await this.persistenceQueue;
  }

  /** Flushes pending write-through operations and disconnects the store. */
  public async closePersistence(): Promise<void> {
    await this.persistenceQueue;
    await this.persistence.close();
  }

  private applySnapshot(snapshot: RuntimeSnapshot): void {
    this.vendor = { ...snapshot.vendor };
    const seedMap = new Map(this.products.map((p) => [p.skuCode.toUpperCase(), p]));
    this.products = snapshot.products.map((product) => {
      const seed = seedMap.get(product.skuCode.toUpperCase());
      const variants =
        product.variants && product.variants.length > 0 ? product.variants : seed?.variants;
      return {
        ...product,
        variants,
      };
    });
    this.shippingZones = snapshot.shippingZones.map((zone) => ({ ...zone }));
    this.discounts = snapshot.discounts.map((discount) => ({ ...discount }));
    this.orders = snapshot.orders.map((order) => ({ ...order }));
    this.processedTxRefs.clear();
    for (const ref of snapshot.processedTransactionRefs) {
      this.processedTxRefs.add(ref);
    }
  }

  /**
   * Queues a write-through operation without blocking the caller. Used by the
   * synchronous dashboard/WhatsApp mutations so their return values stay sync.
   */
  private persistInBackground(label: string, work: () => Promise<void>): void {
    if (this.persistence.mode === "memory") return;
    const run = this.persistenceQueue.then(work);
    this.persistenceQueue = run.catch((err) => {
      this.recordPersistenceError(label, err);
    });
  }

  /**
   * Awaited variant for async flows (orders, payments, expiry, dispatch) where
   * the caller must know the durable write happened before replying.
   */
  private async persistNow(label: string, work: () => Promise<void>): Promise<void> {
    if (this.persistence.mode === "memory") return;
    const run = this.persistenceQueue.then(work);
    // Keep the queue usable even if this operation rejects.
    this.persistenceQueue = run.catch(() => undefined);
    try {
      await run;
    } catch (err) {
      this.recordPersistenceError(label, err);
      throw err;
    }
  }

  private recordPersistenceError(label: string, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    this.persistenceErrors.push(`${label}: ${message}`);
    console.error(`[caterlog:persistence] ${label} failed: ${message}`);
  }

  /**
   * Redacted integration modes + credential readiness for the dashboard header.
   */
  public getIntegrationStatus() {
    const described = describeIntegrationConfig(this.integrationConfig);
    return {
      ...described,
      monnify: {
        ...described.monnify,
        runtime: this.monnify.getIntegrationStatus(),
      },
      whatsapp: {
        ...described.whatsapp,
        runtime: this.whatsapp.getIntegrationStatus(),
      },
      catalog: {
        ...described.catalog,
        runtime: this.catalog.getIntegrationStatus(),
      },
    };
  }

  /**
   * Handles Vendor WhatsApp Keyword Commands (including attached product photos!).
   */
  public async handleVendorWhatsAppKeyword(
    rawText: string,
    attachedImageUrl?: string
  ): Promise<{
    replyText: string;
    commandType: string;
  }> {
    this.appendChat({
      channel: "VENDOR_ADMIN_WA",
      sender: "VENDOR",
      fromPhone: this.vendor.whatsappPhone,
      text: rawText,
      imageUrl: attachedImageUrl,
    });

    const cmd = parseVendorWhatsAppCommand(rawText);
    let replyText = "";
    let quickReplies: QuickReplyOption[] | undefined;

    switch (cmd.type) {
      case "OPEN_DASHBOARD": {
        const token = this.createMagicLinkToken();
        const dashboardUrl = process.env.DASHBOARD_URL ?? "http://localhost:3000";
        replyText = `🔐 *Your 1-Tap Dashboard Login Link:*\n${dashboardUrl}?token=${token}&magic_vendor=${this.vendor.slug}\n\n⏳ _Valid for 15 minutes._`;
        break;
      }

      case "HELP_MENU": {
        replyText = [
          "🛠️ *CATERLOG VENDOR COMMAND MENU*",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📦 *CATALOG & INVENTORY*",
          "• *products* — View all products & live stock",
          "• *stock <SKU> <Qty>* — Update stock count (e.g. `stock SHOE-01 10`)",
          "• *Photo + Name, #Price, stock Qty* — Add single product",
          "• *Photo + Name, 38: #20000 (5), 39: #25000 (3)* — Add variable product with individual prices",
          "• *delete <SKU>* — Remove product from store & catalog",
          "",
          "💰 *SALES & ORDERS*",
          "• *sales* — Today's revenue & order breakdown",
          "• *sales week* / *sales month* — 7-day or 30-day breakdown",
          "• *pending* — View orders awaiting bank transfer",
          "• *paid* — View paid orders ready for dispatch",
          "• *dispatch <OrderCode> <RiderPhone>* — Dispatch order & notify buyer",
          "",
          "🚚 *SHIPPING & DISCOUNTS*",
          "• *shipping* — View all delivery zones",
          "• *ship <Location> #<Fee>* — Add or update delivery zone (e.g. `ship Ibadan #6000`)",
          "• *shipping delete <#>* — Remove zone (e.g. `shipping delete 2`)",
          "• *discount* — View active promo codes",
          "• *discount add <Code> <Value>* — Add code (e.g. `discount add PAYDAY 10%`)",
          "• *discount off <Code>* — Deactivate discount code",
          "",
          "⚙️ *SETTINGS & CO-PILOT*",
          "• *mode copilot 60s* — AI Co-Pilot steps in after 60s vendor idle",
          "• *mode auto* — Instant automated checkout replies",
          "• *mode off* — Manual mode (Co-Pilot paused)",
          "• *hold <minutes>* — Set transfer hold window (e.g. `hold 15`)",
          "• *dashboard* — 1-tap instant login link to Web Dashboard",
        ].join("\n");

        quickReplies = [
          { label: "📦 Products", replyText: "products" },
          { label: "📊 Sales", replyText: "sales" },
          { label: "🚚 Shipping", replyText: "shipping" },
          { label: "🏷️ Discounts", replyText: "discount" },
          { label: "🟡 Pending", replyText: "pending" },
          { label: "🟢 Paid", replyText: "paid" },
          { label: "🔐 Dashboard", replyText: "dashboard" },
        ];
        break;
      }

      case "LIST_PRODUCTS": {
        quickReplies = [
          { label: "📊 Sales Today", replyText: "sales" },
          { label: "🚚 Shipping Zones", replyText: "shipping" },
          { label: "🛠️ Help Menu", replyText: "help" },
        ];
        replyText =
          this.products.length === 0
            ? "📦 Your catalog is empty. Send a photo with caption *Name, #25000, stock 5* to add an item."
            : [
                `📦 *Your Catalog (${this.products.length} items):*`,
                ...this.products.map((p) => {
                  const avail = Math.max(0, p.stockTotal - p.stockReserved);
                  return `• *${p.skuCode}* — ${p.name}: *${formatNaira(p.basePriceKobo)}* (${avail} avail, ${p.stockReserved} locked)`;
                }),
              ].join("\n");
        break;
      }

      case "SALES_SUMMARY": {
        quickReplies = [
          { label: "🟡 Pending Transfers", replyText: "pending" },
          { label: "🟢 Paid Orders", replyText: "paid" },
          { label: "📦 Products", replyText: "products" },
        ];
        const b = this.getAnalyticsBreakdown(cmd.range);
        replyText = [
          `📊 *Transactional Breakdown (${cmd.range.toUpperCase()})*`,
          `• Paid Orders: *${b.paidOrdersCount} (${formatNaira(b.paidGrossKobo)})*`,
          `• Pending Transfers: *${b.pendingOrdersCount} (${formatNaira(b.pendingAmountKobo)})*`,
          `• Shipping Collected: *${formatNaira(b.shippingCollectedKobo)}*`,
          `• Discounts Given: *${formatNaira(b.discountsGivenKobo)}*`,
          `• Net Product Revenue: *${formatNaira(b.netProductRevenueKobo)}*`,
        ].join("\n");
        break;
      }

      case "LIST_SHIPPING": {
        quickReplies = [
          { label: "🏷️ Discounts", replyText: "discount" },
          { label: "📦 Products", replyText: "products" },
          { label: "🛠️ Help Menu", replyText: "help" },
        ];
        const active = this.shippingZones.filter((z) => z.isActive);
        replyText =
          active.length === 0
            ? "🚚 No active delivery zones. Reply *ship Ibadan #6000* to add one."
            : `🚚 *Your Delivery Zones:*\n${active.map((z) => `${z.code}. ${z.name}: *${formatNaira(z.feeKobo)}*`).join("\n")}`;
        break;
      }

      case "UPSERT_SHIPPING": {
        try {
          const zone = this.upsertShippingZone(cmd.name, cmd.feeKobo);
          replyText = `✅ *Shipping Zone Synced:*\n#${zone.code} *${zone.name}* → *${formatNaira(zone.feeKobo)}*`;
        } catch (err) {
          replyText = `⚠️ ${err instanceof Error ? err.message : String(err)}`;
        }
        break;
      }

      case "DELETE_SHIPPING": {
        const deleted = this.deleteShippingZone(cmd.code);
        replyText = deleted
          ? `🗑️ Removed delivery zone #${deleted.code} (*${deleted.name}*).`
          : `⚠️ Delivery zone #${cmd.code} not found.`;
        break;
      }

      case "LIST_DISCOUNTS": {
        quickReplies = [
          { label: "🚚 Shipping Zones", replyText: "shipping" },
          { label: "📦 Products", replyText: "products" },
          { label: "🛠️ Help Menu", replyText: "help" },
        ];
        const active = this.discounts.filter((d) => d.isActive);
        replyText =
          active.length === 0
            ? "🏷️ No active discount codes. Reply *discount add PAYDAY 10%* to create one."
            : `🏷️ *Active Discount Codes:*\n${active
                .map((d) => {
                  const label =
                    d.type === "PERCENTAGE"
                      ? `${Number(d.value) / 100}% off`
                      : `${formatNaira(d.value)} off`;
                  return `• *${d.code}* — ${label} (${d.usedCount} used)`;
                })
                .join("\n")}`;
        break;
      }

      case "CREATE_DISCOUNT": {
        try {
          const disc = this.upsertDiscount({
            code: cmd.code,
            type: cmd.discountType,
            value: cmd.value,
          });
          const label =
            disc.type === "PERCENTAGE"
              ? `${Number(disc.value) / 100}% off`
              : `${formatNaira(disc.value)} off`;
          replyText = `✅ *Discount Code Synced:* *${disc.code}* (${label})`;
        } catch (err) {
          replyText = `⚠️ ${err instanceof Error ? err.message : String(err)}`;
        }
        break;
      }

      case "DEACTIVATE_DISCOUNT": {
        const deactivated = this.deactivateDiscount(cmd.code);
        replyText = deactivated
          ? `🛑 Discount code *${deactivated.code}* deactivated.`
          : `⚠️ Discount code *${cmd.code}* not found.`;
        break;
      }

      case "UPDATE_STOCK": {
        try {
          const prod = this.updateProductStock(cmd.skuCode, cmd.stockTotal);
          if (!prod) {
            replyText = `⚠️ Product SKU *${cmd.skuCode}* not found.`;
          } else {
            const avail = Math.max(0, prod.stockTotal - prod.stockReserved);
            replyText = `📦 *Inventory Synced:*\n*${prod.name}* (${prod.skuCode})\nTotal Stock: *${prod.stockTotal}* (${avail} available, ${prod.stockReserved} reserved)`;
          }
        } catch (err) {
          replyText = `⚠️ ${err instanceof Error ? err.message : String(err)}`;
        }
        break;
      }

      case "QUICK_ADD_PRODUCT": {
        try {
          const namePrefix = (cmd.name || "ITEM")
            .trim()
            .split(/\s+/)
            .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
            .filter(Boolean)
            .slice(0, 2)
            .join("-")
            .toUpperCase() || "ITEM";

          const mappedVariants: RuntimeProductVariant[] | undefined = cmd.variants?.map((v, i) => {
            const cleanName = v.name.trim();
            const suffix = (
              v.skuSuffix ||
              cleanName.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6) ||
              String(i + 1)
            ).toUpperCase();
            return {
              id: `var-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 5)}`,
              name: cleanName,
              skuCode: `${namePrefix}-${suffix}`,
              priceKobo: v.priceKobo,
              stockTotal: v.stockTotal,
              stockReserved: 0,
            };
          });

          // Derive effective base price if not explicitly provided or 0n
          let effectiveBasePrice = cmd.priceKobo;
          if ((!effectiveBasePrice || effectiveBasePrice <= 0n) && mappedVariants && mappedVariants.length > 0) {
            const variantWithPrice = mappedVariants.find((v) => v.priceKobo && v.priceKobo > 0n);
            effectiveBasePrice = variantWithPrice?.priceKobo ?? 0n;
          }

          const prod = this.addProduct({
            name: cmd.name,
            basePriceKobo: effectiveBasePrice,
            stockTotal: cmd.stockTotal,
            primaryImageUrl: attachedImageUrl,
            variants: mappedVariants,
          });

          const variantLines =
            prod.variants && prod.variants.length > 0
              ? [
                  `🎛️ *Variants (${prod.variants.length}):*`,
                  ...prod.variants.map(
                    (v) =>
                      `  • *${v.name}*: ${v.stockTotal} in stock (${formatNaira(v.priceKobo ?? prod.basePriceKobo)})`
                  ),
                ]
              : [];

          replyText = [
            `✅ *New Product Added & Synced:*`,
            `📦 *${prod.name}*`,
            `🏷️ SKU: *${prod.skuCode}*`,
            `💰 Base Price: *${formatNaira(prod.basePriceKobo)}*`,
            `🔢 Total Stock: *${prod.stockTotal}*`,
            ...variantLines,
            `🔍 Status Fingerprint (pHash): \`${prod.imagePhash}\``,
          ].join("\n");

          quickReplies = [
            { label: "📦 View Catalog", replyText: "products" },
            { label: "🛠️ Help Menu", replyText: "help" },
          ];
        } catch (err) {
          replyText = `⚠️ ${err instanceof Error ? err.message : String(err)}`;
        }
        break;
      }

      case "DELETE_PRODUCT": {
        const deleted = this.deleteProduct(cmd.skuCode);
        if (deleted) {
          replyText = `🗑️ *Product Deleted:* \`${cmd.skuCode.toUpperCase()}\` has been removed from your store and WhatsApp catalog.`;
        } else {
          replyText = `⚠️ Product with SKU \`${cmd.skuCode.toUpperCase()}\` was not found.`;
        }
        break;
      }

      case "LIST_ORDERS": {
        const list = this.orders.filter((o) =>
          cmd.status === "PENDING_PAYMENT"
            ? o.status === "PENDING_PAYMENT" || o.status === "PARTIALLY_PAID"
            : o.status === "PAID"
        );
        if (list.length === 0) {
          replyText =
            cmd.status === "PENDING_PAYMENT"
              ? "🟡 No pending bank transfers right now."
              : "🟢 No paid orders waiting for dispatch.";
        } else {
          replyText = list
            .map(
              (o) =>
                `• *${o.shortCode}* (${o.status}) — ${o.customerName} — ${o.productName} x${o.quantity} (${o.shippingZoneName}) — *${formatNaira(o.totalAmountKobo)}* (NUBAN: ${o.accountNumber})`
            )
            .join("\n");
        }
        break;
      }

      case "DISPATCH_ORDER": {
        try {
          const ord = await this.dispatchOrder(cmd.shortCode, cmd.riderPhone);
          replyText = ord
            ? `🚚 Order *${ord.shortCode}* marked Out for Delivery! Buyer (${ord.customerPhone}) has been notified on WhatsApp.`
            : `⚠️ Order *${cmd.shortCode}* not found.`;
        } catch (err) {
          replyText = `⚠️ ${err instanceof Error ? err.message : String(err)}`;
        }
        break;
      }

      case "REMIND_ORDER": {
        const ord = this.orders.find((o) => o.shortCode === cmd.shortCode);
        if (!ord) {
          replyText = `⚠️ Order *${cmd.shortCode}* not found.`;
        } else {
          this.appendChat({
            channel: "BUYER_SHOP_WA",
            sender: "CATERLOG_BOT",
            fromPhone: "CATERLOG",
            text: `⏰ *Friendly Reminder (${ord.shortCode}):* Your reserved *${ord.productName}* is waiting for payment of *${formatNaira(ord.totalAmountKobo - ord.amountPaidKobo)}* to *${ord.accountNumber}* (${ord.bankName}).`,
          });
          replyText = `🔔 Sent WhatsApp transfer reminder to *${ord.customerName}* for *${ord.shortCode}*.`;
        }
        break;
      }

      case "SET_COPILOT_MODE": {
        this.updateSettings({
          copilotMode: cmd.mode,
          copilotIdleSeconds: cmd.idleSeconds,
        });
        replyText =
          this.vendor.copilotMode === "COPILOT"
            ? `🤖 *Co-Pilot Active:* Steps in after *${this.vendor.copilotIdleSeconds}s* of vendor inactivity.`
            : this.vendor.copilotMode === "FULL_AUTO"
              ? `⚡ *Full Auto-Pilot Active:* Instant <2s automated checkout replies.`
              : `⏸️ *Manual Mode:* Co-Pilot paused.`;
        break;
      }

      case "SET_RESERVATION_TTL": {
        this.updateSettings({ reservationTtlMinutes: cmd.minutes });
        replyText = `⏳ *Stock Reservation Hold Window Updated:* Buyers now have *${this.vendor.reservationTtlMinutes} minutes* to complete bank transfers.`;
        break;
      }

      case "UNKNOWN_COMMAND": {
        replyText = `❓ Unrecognized command "${cmd.rawInput}". Type *help* to see all Caterlog commands (or send *Name, #Price, stock Qty* to add a product).`;
        break;
      }
    }

    await this.whatsapp.sendTextMessage({
      toPhone: this.vendor.whatsappPhone,
      text: replyText,
      vendorPhoneId: this.vendor.whatsappPhoneId,
    });

    this.appendChat({
      channel: "VENDOR_ADMIN_WA",
      sender: "CATERLOG_BOT",
      fromPhone: "CATERLOG",
      text: replyText,
      quickReplies,
    });

    await this.broadcastStateChange();
    return { replyText, commandType: cmd.type };
  }

  /**
   * Records that the Vendor manually sent a message inside the Buyer's WhatsApp thread
   * (received via Meta `message_echoes` webhook). Cancels any pending Co-Pilot idle timer!
   */
  public async recordVendorManualReplyInBuyerThread(text: string): Promise<void> {
    this.lastVendorReplyInBuyerThreadAt = new Date();
    const timer = this.activeCopilotTimers.get("buyer-thread");
    if (timer) {
      clearTimeout(timer);
      this.activeCopilotTimers.delete("buyer-thread");
    }

    this.appendChat({
      channel: "BUYER_SHOP_WA",
      sender: "VENDOR",
      fromPhone: this.vendor.whatsappPhone,
      text,
    });

    this.appendChat({
      channel: "VENDOR_ADMIN_WA",
      sender: "CATERLOG_BOT",
      fromPhone: "CATERLOG",
      text: `✋ Detected your manual reply in the buyer chat. Smart Co-Pilot cancelled its idle takeover timer so you can chat uninterrupted.`,
    });

    await this.broadcastStateChange();
  }

  /**
   * Handles an inbound Buyer message or WhatsApp Status reply.
   *
   * Two-Step Conversational Checkout State Machine:
   * - Step 1: If the buyer requests a product WITHOUT specifying a shipping zone,
   *   Caterlog renders the Product Card (image, price, available stock) and asks the buyer
   *   to select one of the vendor's active shipping zones (never guesses a random zone!).
   * - Step 2: Once the buyer selects their shipping zone (by number, name, or quick-reply button)—
   *   or if they explicitly named a valid shipping zone in their initial message—
   *   Caterlog locks stock and issues the Monnify 10-digit NUBAN invoice.
   */
  public async handleBuyerWhatsAppInquiry(params: {
    buyerPhone: string;
    buyerName?: string;
    text: string;
    quotedStatusImagePhash?: string;
    simulateFastForwardIdleTimer?: boolean;
  }): Promise<{
    copilotDecision: ReturnType<typeof evaluateCopilotAction>;
    step?: "PROMPTED_FOR_SHIPPING_ZONE" | "INVOICE_CREATED" | "OUT_OF_STOCK" | "UNMATCHED";
    createdOrder?: RuntimeOrder;
  }> {
    const buyerMessageTime = new Date();
    const matchedStatusProduct = params.quotedStatusImagePhash
      ? this.products.find(
          (p) => computePhashHammingDistance(p.imagePhash, params.quotedStatusImagePhash!) <= 8
        )
      : undefined;

    this.appendChat({
      channel: "BUYER_SHOP_WA",
      sender: "BUYER",
      fromPhone: params.buyerPhone,
      text: params.quotedStatusImagePhash
        ? `📸 [Replied to WhatsApp Status${matchedStatusProduct ? `: ${matchedStatusProduct.name}` : ""}] ${params.text}`
        : params.text,
      imageUrl: matchedStatusProduct?.primaryImageUrl,
    });

    const decision = evaluateCopilotAction({
      copilotMode: this.vendor.copilotMode,
      copilotIdleSeconds: this.vendor.copilotIdleSeconds,
      sessionCopilotPaused: false,
      lastVendorMessageAt: this.lastVendorReplyInBuyerThreadAt,
      now: buyerMessageTime,
    });

    if (decision.action === "DO_NOTHING") {
      await this.broadcastStateChange();
      return { copilotDecision: decision };
    }

    if (decision.action === "RESPOND_IMMEDIATELY" || params.simulateFastForwardIdleTimer) {
      const flowResult = await this.processBuyerConversationTurn({
        buyerPhone: params.buyerPhone,
        buyerName: params.buyerName ?? "Chidinma Okafor",
        text: params.text,
        quotedStatusImagePhash: params.quotedStatusImagePhash,
      });
      return {
        copilotDecision: decision,
        step: flowResult.step,
        createdOrder: flowResult.createdOrder,
      };
    }

    // SCHEDULE_IDLE_TAKEOVER
    this.appendChat({
      channel: "VENDOR_ADMIN_WA",
      sender: "CATERLOG_BOT",
      fromPhone: "CATERLOG",
      text: `⏳ *Smart Co-Pilot Standby:* Buyer (${params.buyerPhone}) sent: "${params.text}". Waiting *${decision.delaySeconds}s* for you to reply before Co-Pilot steps in...`,
    });

    const existingTimer = this.activeCopilotTimers.get("buyer-thread");
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(async () => {
      this.activeCopilotTimers.delete("buyer-thread");
      const shouldTakeOver = shouldExecuteScheduledTakeover({
        buyerMessageReceivedAt: buyerMessageTime,
        lastVendorMessageAt: this.lastVendorReplyInBuyerThreadAt,
        sessionCopilotPaused: false,
        copilotMode: this.vendor.copilotMode,
      });
      if (shouldTakeOver) {
        await this.processBuyerConversationTurn({
          buyerPhone: params.buyerPhone,
          buyerName: params.buyerName ?? "Chidinma Okafor",
          text: params.text,
          quotedStatusImagePhash: params.quotedStatusImagePhash,
        });
      }
    }, decision.delaySeconds * 1000);

    this.activeCopilotTimers.set("buyer-thread", timer);
    await this.broadcastStateChange();
    return { copilotDecision: decision };
  }

  /**
   * Core Conversational Checkout State Machine for a Buyer Turn.
   */
  public async processBuyerConversationTurn(params: {
    buyerPhone: string;
    buyerName: string;
    text: string;
    quotedStatusImagePhash?: string;
  }): Promise<{
    step: "PROMPTED_FOR_SHIPPING_ZONE" | "INVOICE_CREATED" | "OUT_OF_STOCK" | "UNMATCHED";
    createdOrder?: RuntimeOrder;
  }> {
    const activeZones = this.shippingZones.filter((z) => z.isActive);
    const existingSession = this.buyerSessions.get(params.buyerPhone);
    const trimmed = params.text.trim();

    // 0. Category Browse Commands (e.g. "category fashion", "more in fashion", "browse kitchen")
    const catMatch = trimmed.match(/^(?:category|cat|browse|more\s+in)\s+(.+)$/i);
    if (catMatch) {
      const targetCat = catMatch[1].trim().toLowerCase();
      const matchedProducts = this.products.filter(
        (p) =>
          p.category?.toLowerCase().includes(targetCat) ||
          targetCat.includes(p.category?.toLowerCase() || "")
      );
      if (matchedProducts.length === 0) {
        const noCatMsg = `📂 No items found in category "*${catMatch[1]}*". Reply *catalog* to view all items!`;
        await this.whatsapp.sendTextMessage({ toPhone: params.buyerPhone, text: noCatMsg, vendorPhoneId: this.vendor.whatsappPhoneId });
        this.appendChat({ channel: "BUYER_SHOP_WA", sender: "CATERLOG_BOT", fromPhone: "CATERLOG", text: noCatMsg });
        await this.broadcastStateChange();
        return { step: "UNMATCHED" };
      }

      const catLines = matchedProducts.map((p) => {
        const avail = Math.max(0, p.stockTotal - p.stockReserved);
        const varNote = p.variants && p.variants.length > 0 ? ` (${p.variants.length} options)` : "";
        return `• *${p.skuCode}* — ${p.name}${varNote}: *${formatNaira(p.basePriceKobo)}* (${avail > 0 ? `🟢 ${avail} in stock` : "🔴 Sold Out"})`;
      });

      const catMsg = [
        `📂 *Items in Category "${matchedProducts[0]?.category || catMatch[1]}":*`,
        ``,
        ...catLines,
        ``,
        `_Tap an item below to view details, image, and options:_`,
      ].join("\n");

      const quickReplies: QuickReplyOption[] = matchedProducts
        .filter((p) => p.stockTotal - p.stockReserved > 0)
        .slice(0, 5)
        .map((p) => ({
          label: `🛍️ ${p.skuCode}: ${p.name.slice(0, 18)}`,
          replyText: p.skuCode,
        }));

      await this.whatsapp.sendTextMessage({ toPhone: params.buyerPhone, text: catMsg, vendorPhoneId: this.vendor.whatsappPhoneId });
      this.appendChat({
        channel: "BUYER_SHOP_WA",
        sender: "CATERLOG_BOT",
        fromPhone: "CATERLOG",
        text: catMsg,
        imageUrl: matchedProducts[0]?.primaryImageUrl,
        quickReplies,
      });
      await this.broadcastStateChange();
      return { step: "PROMPTED_FOR_SHIPPING_ZONE" };
    }

    // 1. Cart Management Commands (View Cart / Clear Cart)
    const isCartView = /^(?:view\s+cart|cart|my\s+cart|show\s+cart)$/i.test(trimmed);
    const isCartClear = /^(?:clear\s+cart|empty\s+cart|reset\s+cart)$/i.test(trimmed);

    if (isCartClear) {
      this.clearBuyerCart(params.buyerPhone);
      this.buyerSessions.delete(params.buyerPhone);
      const clearMsg = "🗑️ Your shopping cart has been cleared.\nReply with a product name or SKU (e.g. *SHOE-01*) to start shopping!";
      await this.whatsapp.sendTextMessage({ toPhone: params.buyerPhone, text: clearMsg, vendorPhoneId: this.vendor.whatsappPhoneId });
      this.appendChat({ channel: "BUYER_SHOP_WA", sender: "CATERLOG_BOT", fromPhone: "CATERLOG", text: clearMsg });
      await this.broadcastStateChange();
      return { step: "UNMATCHED" };
    }

    const currentCart = this.getBuyerCart(params.buyerPhone);

    if (isCartView) {
      if (currentCart.length === 0) {
        const emptyMsg = "🛒 Your cart is currently empty.\nReply with an item name or SKU (e.g. *SHOE-01*) to start shopping!";
        await this.whatsapp.sendTextMessage({ toPhone: params.buyerPhone, text: emptyMsg, vendorPhoneId: this.vendor.whatsappPhoneId });
        this.appendChat({ channel: "BUYER_SHOP_WA", sender: "CATERLOG_BOT", fromPhone: "CATERLOG", text: emptyMsg });
        await this.broadcastStateChange();
        return { step: "UNMATCHED" };
      }

      const cartTotalKobo = currentCart.reduce((sum, item) => sum + item.unitPriceKobo * BigInt(item.quantity), 0n);
      const lines = currentCart.map((it, idx) => {
        const itemLineTotal = it.unitPriceKobo * BigInt(it.quantity);
        const vDisplay = it.variantName ? ` (${it.variantName})` : "";
        return `*${idx + 1}.* ${it.productName}${vDisplay} ×${it.quantity} — *${formatNaira(itemLineTotal)}*`;
      }).join("\n");

      const zoneOptions = activeZones.map((z) => `*${z.code}.* ${z.name} — *${formatNaira(z.feeKobo)}*`).join("\n");
      const cartMsg = [
        `🛒 *Your Shopping Cart (${currentCart.length} item${currentCart.length > 1 ? "s" : ""}):*`,
        ``,
        lines,
        ``,
        `💰 *Items Subtotal:* *${formatNaira(cartTotalKobo)}*`,
        ``,
        `📍 *Where should we deliver your order?*`,
        `Reply with the delivery number or location to checkout (or add another item):`,
        zoneOptions,
      ].join("\n");

      const quickReplies: QuickReplyOption[] = [
        ...activeZones.map((z) => ({
          label: `🚚 ${z.code}. ${z.name} (${formatNaira(z.feeKobo)})`,
          replyText: z.name,
        })),
        { label: "🗑️ Clear Cart", replyText: "clear cart" },
      ];

      await this.whatsapp.sendTextMessage({ toPhone: params.buyerPhone, text: cartMsg, vendorPhoneId: this.vendor.whatsappPhoneId });
      this.appendChat({ channel: "BUYER_SHOP_WA", sender: "CATERLOG_BOT", fromPhone: "CATERLOG", text: cartMsg, quickReplies });
      await this.broadcastStateChange();
      return { step: "PROMPTED_FOR_SHIPPING_ZONE" };
    }

    // Check if the buyer explicitly mentioned a product or variant in this message
    const { product: explicitlyMentionedProduct, variant: explicitlyMentionedVariant } =
      this.findProductAndVariantInBuyerMessage(params.text, params.quotedStatusImagePhash);

    // Check if the buyer's message selects a shipping zone
    const allowZoneNumeric = Boolean(
      existingSession && existingSession.state === "AWAITING_SHIPPING_ZONE" && !explicitlyMentionedProduct
    );
    const matchedZone = this.findShippingZoneInBuyerMessage(
      params.text,
      activeZones,
      allowZoneNumeric
    );

    // Check if a discount code is mentioned in this turn
    const mentionedDiscount = this.discounts
      .filter((d) => this.isDiscountUsable(d))
      .find((d) => params.text.toUpperCase().includes(d.code));

    // CASE A1: Buyer is in `AWAITING_VARIANT` and just replied to choose a variant!
    if (existingSession && existingSession.state === "AWAITING_VARIANT" && !explicitlyMentionedProduct) {
      const activeProd = this.products.find((p) => p.id === existingSession.activeProductId);
      if (activeProd && activeProd.variants && activeProd.variants.length > 0) {
        const { variant } = this.findProductAndVariantInBuyerMessage(params.text, undefined, activeProd);
        if (variant) {
          const vAvail = variant.stockTotal - variant.stockReserved;
          const reqQty = existingSession.quantity ?? 1;
          if (vAvail < reqQty) {
            const outMsg = `⚠️ Sorry, *${activeProd.name} — ${variant.name}* is currently sold out! Please select another option:`;
            await this.whatsapp.sendTextMessage({ toPhone: params.buyerPhone, text: outMsg, vendorPhoneId: this.vendor.whatsappPhoneId });
            this.appendChat({ channel: "BUYER_SHOP_WA", sender: "CATERLOG_BOT", fromPhone: "CATERLOG", text: outMsg });
            await this.broadcastStateChange();
            return { step: "OUT_OF_STOCK" };
          }

          // Add to buyer's cart!
          this.addToBuyerCart(params.buyerPhone, {
            productId: activeProd.id,
            productSku: activeProd.skuCode,
            productName: activeProd.name,
            variantId: variant.id,
            variantSku: variant.skuCode,
            variantName: variant.name,
            quantity: reqQty,
            unitPriceKobo: variant.priceKobo ?? activeProd.basePriceKobo,
          });

          const updatedCart = this.getBuyerCart(params.buyerPhone);
          const cartTotalKobo = updatedCart.reduce((sum, item) => sum + item.unitPriceKobo * BigInt(item.quantity), 0n);

          existingSession.activeVariantId = variant.id;
          existingSession.state = "AWAITING_SHIPPING_ZONE";
          existingSession.updatedAt = new Date();

          if (matchedZone) {
            this.buyerSessions.delete(params.buyerPhone);
            const discountCode = mentionedDiscount?.code ?? existingSession.discountCode;
            const order = await this.finalizeOrderAndSendVirtualAccount({
              buyerPhone: params.buyerPhone,
              buyerName: params.buyerName,
              cartItems: updatedCart,
              shippingZone: matchedZone,
              discountCode,
            });
            this.clearBuyerCart(params.buyerPhone);
            return { step: order ? "INVOICE_CREATED" : "OUT_OF_STOCK", createdOrder: order };
          }

          const cartSummaryLines = updatedCart.map((it) => {
            const lineTotal = it.unitPriceKobo * BigInt(it.quantity);
            const vLabel = it.variantName ? ` (${it.variantName})` : "";
            return `• *${it.productName}${vLabel}* ×${it.quantity} — *${formatNaira(lineTotal)}*`;
          }).join("\n");

          const zoneOptionsText = activeZones
            .map((z) => `*${z.code}.* ${z.name} — *${formatNaira(z.feeKobo)}*`)
            .join("\n");

          const promptText = [
            `✅ Added: *${activeProd.name} — ${variant.name}* (\`${variant.skuCode}\`)`,
            ``,
            `🛒 *Your Order (${updatedCart.length} item${updatedCart.length > 1 ? "s" : ""}):*`,
            cartSummaryLines,
            `💰 *Items Subtotal:* *${formatNaira(cartTotalKobo)}*`,
            ``,
            `📍 *Where should we deliver your order?*`,
            `Reply with the delivery number or location to checkout (or reply with another item to keep shopping):`,
            zoneOptionsText,
            ``,
            `_💡 Have a promo code? Include it with your reply (e.g. "${activeZones[0]?.name ?? "Lekki"} PAYDAY")_`,
          ].join("\n");

          const quickReplies: QuickReplyOption[] = [
            ...activeZones.map((z) => ({
              label: `🚚 ${z.code}. ${z.name} (${formatNaira(z.feeKobo)})`,
              replyText: z.name,
            })),
            { label: "🛒 View Cart", replyText: "cart" },
          ];

          await this.whatsapp.sendTextMessage({ toPhone: params.buyerPhone, text: promptText, vendorPhoneId: this.vendor.whatsappPhoneId });
          this.appendChat({ channel: "BUYER_SHOP_WA", sender: "CATERLOG_BOT", fromPhone: "CATERLOG", text: promptText, quickReplies });
          await this.broadcastStateChange();
          return { step: "PROMPTED_FOR_SHIPPING_ZONE" };
        }
      }
    }

    // CASE A2: Buyer selected a Shipping Zone (and has cart items or session)
    if (matchedZone && !explicitlyMentionedProduct) {
      let cartToCheckout = this.getBuyerCart(params.buyerPhone);
      if (cartToCheckout.length === 0 && existingSession?.activeProductId) {
        const prod = this.products.find((p) => p.id === existingSession.activeProductId);
        if (prod) {
          const vr = prod.variants?.find((v) => v.id === existingSession.activeVariantId);
          cartToCheckout = [{
            productId: prod.id,
            productSku: prod.skuCode,
            productName: prod.name,
            variantId: vr?.id,
            variantSku: vr?.skuCode,
            variantName: vr?.name,
            quantity: existingSession.quantity ?? 1,
            unitPriceKobo: vr?.priceKobo ?? prod.basePriceKobo,
          }];
        }
      }

      if (cartToCheckout.length > 0) {
        this.buyerSessions.delete(params.buyerPhone);
        const discountCode = mentionedDiscount?.code ?? existingSession?.discountCode;
        const order = await this.finalizeOrderAndSendVirtualAccount({
          buyerPhone: params.buyerPhone,
          buyerName: params.buyerName,
          cartItems: cartToCheckout,
          shippingZone: matchedZone,
          discountCode,
        });
        this.clearBuyerCart(params.buyerPhone);
        return {
          step: order ? "INVOICE_CREATED" : "OUT_OF_STOCK",
          createdOrder: order,
        };
      }
    }

    // Resolve target product & variant
    const product = explicitlyMentionedProduct;
    const variant = explicitlyMentionedVariant;

    if (!product) {
      // Buyer did not name a recognizable product: show friendly catalog options
      const catalogLines = this.products.map((p) => {
        const avail = Math.max(0, p.stockTotal - p.stockReserved);
        const varNote = p.variants && p.variants.length > 0 ? ` (${p.variants.length} options)` : "";
        return `• *${p.skuCode}* — ${p.name}${varNote}: *${formatNaira(p.basePriceKobo)}* (${avail > 0 ? `🟢 ${avail} in stock` : "🔴 Sold Out"})`;
      });
      const menuMsg = [
        `👋 Welcome to *${this.vendor.businessName}* (✓ Verified Caterlog Seller)!`,
        ``,
        `Here are our available items:`,
        ...catalogLines,
        ``,
        `_Reply with the item name or SKU (e.g. *SHOE-01*) or tap an item below to order:_`,
      ].join("\n");

      const quickReplies: QuickReplyOption[] = this.products
        .filter((p) => p.stockTotal - p.stockReserved > 0)
        .map((p) => ({
          label: `🛍️ ${p.skuCode}: ${p.name} (${formatNaira(p.basePriceKobo)})`,
          replyText: `I want ${p.skuCode}`,
        }));

      await this.whatsapp.sendTextMessage({
        toPhone: params.buyerPhone,
        text: menuMsg,
        vendorPhoneId: this.vendor.whatsappPhoneId,
      });
      this.appendChat({
        channel: "BUYER_SHOP_WA",
        sender: "CATERLOG_BOT",
        fromPhone: "CATERLOG",
        text: menuMsg,
        quickReplies,
      });
      await this.broadcastStateChange();
      return { step: "UNMATCHED" };
    }

    const quantity = this.extractQuantityFromText(params.text) ?? 1;

    // Check if the buyer message expresses direct checkout or add-to-cart intent
    // (e.g. mentions a delivery zone or begins with "add", "buy", "order", "i want to buy", etc.)
    const isDirectPurchaseIntent =
      Boolean(matchedZone) ||
      /^(?:add(?:\s+to\s+cart)?|buy|order|purchase|i\s+(?:want|need)\s+(?:to\s+buy|this)|checkout|send\s+me|i'll\s+take)\b/i.test(trimmed);

    // USER'S STRICT BUSINESS REQUIREMENT:
    // "lastly when a product is requested, it should display the image of the product with the details and there are variations it should show the different variations with their prices and stock info.
    // Also requesting an item should not automatically add it to cart that is really bad and manipulative/misleading there should be click options to add to cart. there should also be click options to view other items under that category."
    if (!isDirectPurchaseIntent) {
      let priceDisplay = formatNaira(product.basePriceKobo);
      if (product.variants && product.variants.length > 0) {
        const variantPrices = product.variants
          .map((v) => v.priceKobo)
          .filter((pr): pr is bigint => pr !== undefined && pr > 0n);
        if (variantPrices.length > 0) {
          const minPr = variantPrices.reduce((m, p) => (p < m ? p : m), variantPrices[0]);
          const maxPr = variantPrices.reduce((m, p) => (p > m ? p : m), variantPrices[0]);
          if (minPr !== maxPr) {
            priceDisplay = `${formatNaira(minPr)} - ${formatNaira(maxPr)}`;
          } else {
            priceDisplay = formatNaira(minPr);
          }
        }
      }

      const variantLines =
        product.variants && product.variants.length > 0
          ? product.variants.map((v, i) => {
              const vPrice =
                v.priceKobo !== undefined
                  ? formatNaira(v.priceKobo)
                  : formatNaira(product.basePriceKobo);
              const vAvail = Math.max(0, v.stockTotal - v.stockReserved);
              return `${i + 1}. *${v.name}* (\`${v.skuCode}\`) — *${vPrice}* (${
                vAvail > 0 ? `🟢 ${vAvail} in stock` : "🔴 Sold Out"
              })`;
            })
          : [];

      const promptText = [
        `📦 *${product.name}* (\`${product.skuCode}\`)`,
        product.description ? `_${product.description}_` : "",
        `📂 Category: *${product.category || "General"}*`,
        `💰 Price: *${priceDisplay}*`,
        `🔢 Available Stock: *${Math.max(0, product.stockTotal - product.stockReserved)} unit(s)*`,
        ...(variantLines.length > 0
          ? [``, `🎛️ *Available Options & Live Stock:*`, ...variantLines]
          : []),
        ``,
        `_Tap an option below to add to cart, or view other items in this category:_`,
      ]
        .filter(Boolean)
        .join("\n");

      const quickReplies: QuickReplyOption[] = [];
      if (product.variants && product.variants.length > 0) {
        for (const v of product.variants.filter((v) => v.stockTotal - v.stockReserved > 0)) {
          const vPrice =
            v.priceKobo !== undefined
              ? formatNaira(v.priceKobo)
              : formatNaira(product.basePriceKobo);
          quickReplies.push({
            label: `🛒 Add ${v.name} (${vPrice})`,
            replyText: `Add ${product.skuCode} ${v.name}`,
          });
        }
      } else if (product.stockTotal - product.stockReserved > 0) {
        quickReplies.push({
          label: `🛒 Add to Cart (${formatNaira(product.basePriceKobo)})`,
          replyText: `Add to cart ${product.skuCode}`,
        });
      }

      if (product.category) {
        quickReplies.push({
          label: `📂 More in ${product.category}`,
          replyText: `category ${product.category}`,
        });
      }

      if (currentCart.length > 0) {
        quickReplies.push({
          label: `🛒 View Cart (${currentCart.length})`,
          replyText: "cart",
        });
      }

      await this.whatsapp.sendTextMessage({
        toPhone: params.buyerPhone,
        text: promptText,
        vendorPhoneId: this.vendor.whatsappPhoneId,
      });

      this.appendChat({
        channel: "BUYER_SHOP_WA",
        sender: "CATERLOG_BOT",
        fromPhone: "CATERLOG",
        text: promptText,
        imageUrl: product.primaryImageUrl,
        quickReplies,
      });

      await this.broadcastStateChange();
      return { step: "PROMPTED_FOR_SHIPPING_ZONE" };
    }

    // IF PRODUCT HAS VARIANTS AND BUYER HAS NOT SPECIFIED WHICH VARIANT:
    // USER'S EXACT REQUIREMENT:
    // "when a product is requested for, if it is a variable products display all the variants and their stock quantity"
    if (product.variants && product.variants.length > 0 && !variant) {
      this.buyerSessions.set(params.buyerPhone, {
        buyerPhone: params.buyerPhone,
        buyerName: params.buyerName,
        activeProductId: product.id,
        quantity,
        discountCode: mentionedDiscount?.code,
        state: "AWAITING_VARIANT",
        updatedAt: new Date(),
      });

      const variantLines = product.variants.map((v, i) => {
        const vPrice = v.priceKobo !== undefined ? formatNaira(v.priceKobo) : formatNaira(product.basePriceKobo);
        const vAvail = Math.max(0, v.stockTotal - v.stockReserved);
        return `*${i + 1}.* *${v.name}* (\`${v.skuCode}\`) — *${vPrice}* (${vAvail > 0 ? `🟢 ${vAvail} in stock` : "🔴 Sold Out"})`;
      }).join("\n");

      const promptText = [
        `📦 *${product.name}* is available in the following options:`,
        ``,
        variantLines,
        ``,
        `_Reply with the option number (e.g. *1*) or variant name to select:_`,
      ].join("\n");

      const quickReplies: QuickReplyOption[] = product.variants
        .filter((v) => v.stockTotal - v.stockReserved > 0)
        .map((v) => ({
          label: `${v.name} (${v.priceKobo !== undefined ? formatNaira(v.priceKobo) : formatNaira(product.basePriceKobo)})`,
          replyText: v.name,
        }));

      await this.whatsapp.sendTextMessage({
        toPhone: params.buyerPhone,
        text: promptText,
        vendorPhoneId: this.vendor.whatsappPhoneId,
      });

      this.appendChat({
        channel: "BUYER_SHOP_WA",
        sender: "CATERLOG_BOT",
        fromPhone: "CATERLOG",
        text: promptText,
        imageUrl: product.primaryImageUrl,
        quickReplies,
      });

      await this.broadcastStateChange();
      return { step: "PROMPTED_FOR_SHIPPING_ZONE" };
    }

    // IF VARIANT WAS SPECIFIED OR SIMPLE PRODUCT:
    const available = variant
      ? variant.stockTotal - variant.stockReserved
      : product.stockTotal - product.stockReserved;

    const itemLabel = variant ? `${product.name} (${variant.name})` : product.name;

    if (available < quantity) {
      const soldOutMsg =
        available <= 0
          ? `😔 Sorry, *${itemLabel}* is currently *Sold Out* (0 available).`
          : `⚠️ Only *${available}* unit(s) of *${itemLabel}* left in stock (you requested ${quantity}).`;
      await this.whatsapp.sendTextMessage({
        toPhone: params.buyerPhone,
        text: soldOutMsg,
        vendorPhoneId: this.vendor.whatsappPhoneId,
      });
      this.appendChat({
        channel: "BUYER_SHOP_WA",
        sender: "CATERLOG_BOT",
        fromPhone: "CATERLOG",
        text: soldOutMsg,
      });
      await this.broadcastStateChange();
      return { step: "OUT_OF_STOCK" };
    }

    // Add to buyer's cart!
    this.addToBuyerCart(params.buyerPhone, {
      productId: product.id,
      productSku: product.skuCode,
      productName: product.name,
      variantId: variant?.id,
      variantSku: variant?.skuCode,
      variantName: variant?.name,
      quantity,
      unitPriceKobo: variant?.priceKobo ?? product.basePriceKobo,
    });

    const updatedCart = this.getBuyerCart(params.buyerPhone);
    const cartTotalKobo = updatedCart.reduce((sum, item) => sum + item.unitPriceKobo * BigInt(item.quantity), 0n);

    // If shipping zone was also specified in this message, finalize immediately!
    if (matchedZone) {
      this.buyerSessions.delete(params.buyerPhone);
      const discountCode = mentionedDiscount?.code;
      const order = await this.finalizeOrderAndSendVirtualAccount({
        buyerPhone: params.buyerPhone,
        buyerName: params.buyerName,
        cartItems: updatedCart,
        shippingZone: matchedZone,
        discountCode,
      });
      this.clearBuyerCart(params.buyerPhone);
      return {
        step: order ? "INVOICE_CREATED" : "OUT_OF_STOCK",
        createdOrder: order,
      };
    }

    // Save session awaiting shipping zone
    this.buyerSessions.set(params.buyerPhone, {
      buyerPhone: params.buyerPhone,
      buyerName: params.buyerName,
      activeProductId: product.id,
      activeVariantId: variant?.id,
      quantity,
      discountCode: mentionedDiscount?.code,
      state: "AWAITING_SHIPPING_ZONE",
      updatedAt: new Date(),
    });

    const cartSummaryLines = updatedCart.map((it) => {
      const lineTotal = it.unitPriceKobo * BigInt(it.quantity);
      const vLabel = it.variantName ? ` (${it.variantName})` : "";
      return `• *${it.productName}${vLabel}* ×${it.quantity} — *${formatNaira(lineTotal)}*`;
    }).join("\n");

    const zoneOptionsText = activeZones
      .map((z) => `*${z.code}.* ${z.name} — *${formatNaira(z.feeKobo)}*`)
      .join("\n");

    const promptText = [
      `✅ Added: *${itemLabel}* (×${quantity})`,
      ``,
      `🛒 *Your Order (${updatedCart.length} item${updatedCart.length > 1 ? "s" : ""}):*`,
      cartSummaryLines,
      `💰 *Items Subtotal:* *${formatNaira(cartTotalKobo)}*`,
      ``,
      `📍 *Where should we deliver your order?*`,
      `Reply with the delivery number or location to checkout (or reply with another item to keep shopping):`,
      zoneOptionsText,
      ``,
      `_💡 Have a promo code? Include it with your reply (e.g. "${activeZones[0]?.name ?? "Lekki"} PAYDAY")_`,
    ].join("\n");

    const quickReplies: QuickReplyOption[] = [
      ...activeZones.map((z) => ({
        label: `🚚 ${z.code}. ${z.name} (${formatNaira(z.feeKobo)})`,
        replyText: z.name,
      })),
      ...(product.category
        ? [{ label: `📂 More in ${product.category}`, replyText: `category ${product.category}` }]
        : []),
      { label: "🛒 View Cart", replyText: "cart" },
    ];

    await this.whatsapp.sendTextMessage({
      toPhone: params.buyerPhone,
      text: promptText,
      vendorPhoneId: this.vendor.whatsappPhoneId,
    });

    this.appendChat({
      channel: "BUYER_SHOP_WA",
      sender: "CATERLOG_BOT",
      fromPhone: "CATERLOG",
      text: promptText,
      imageUrl: product.primaryImageUrl,
      quickReplies,
    });

    await this.broadcastStateChange();
    return { step: "PROMPTED_FOR_SHIPPING_ZONE" };
  }

  private async finalizeOrderAndSendVirtualAccount(params: {
    buyerPhone: string;
    buyerName: string;
    product?: RuntimeProduct;
    variant?: RuntimeProductVariant;
    quantity?: number;
    cartItems?: RuntimeCartItem[];
    shippingZone: RuntimeShippingZone;
    discountCode?: string;
  }): Promise<RuntimeOrder | undefined> {
    const rawCart: RuntimeCartItem[] =
      params.cartItems && params.cartItems.length > 0
        ? params.cartItems
        : params.product
        ? [
            {
              productId: params.product.id,
              productSku: params.product.skuCode,
              productName: params.product.name,
              variantId: params.variant?.id,
              variantSku: params.variant?.skuCode,
              variantName: params.variant?.name,
              quantity: params.quantity ?? 1,
              unitPriceKobo: params.variant?.priceKobo ?? params.product.basePriceKobo,
            },
          ]
        : [];

    if (rawCart.length === 0) return undefined;

    // Check available stock for each item in the cart
    for (const item of rawCart) {
      const prod = this.products.find((p) => p.id === item.productId);
      if (!prod) return undefined;
      const v = item.variantId ? prod.variants?.find((vr) => vr.id === item.variantId) : undefined;
      const avail = v ? v.stockTotal - v.stockReserved : prod.stockTotal - prod.stockReserved;
      if (avail < item.quantity) {
        const itemLabel = v ? `${prod.name} (${v.name})` : prod.name;
        const outMsg = `⚠️ Sorry, *${itemLabel}* only has ${Math.max(0, avail)} unit(s) left in stock (you requested ${item.quantity}). Please adjust your cart.`;
        await this.whatsapp.sendTextMessage({ toPhone: params.buyerPhone, text: outMsg, vendorPhoneId: this.vendor.whatsappPhoneId });
        this.appendChat({ channel: "BUYER_SHOP_WA", sender: "CATERLOG_BOT", fromPhone: "CATERLOG", text: outMsg });
        await this.broadcastStateChange();
        return undefined;
      }
    }

    const activeDiscount = params.discountCode
      ? this.discounts.find(
          (d) => this.isDiscountUsable(d) && d.code.toUpperCase() === params.discountCode!.toUpperCase()
        )
      : undefined;

    const subtotalKobo = rawCart.reduce(
      (sum, it) => sum + it.unitPriceKobo * BigInt(it.quantity),
      0n
    );

    const discountAmountKobo = activeDiscount
      ? computeDiscountKobo({
          subtotalKobo,
          discountType: activeDiscount.type,
          discountValue: activeDiscount.value,
          minOrderKobo: activeDiscount.minOrderKobo,
        })
      : 0n;

    if (activeDiscount && discountAmountKobo > 0n) {
      activeDiscount.usedCount += 1;
    }

    const pricing = computeOrderTotalKobo({
      subtotalKobo,
      shippingFeeKobo: params.shippingZone.feeKobo,
      discountAmountKobo,
    });

    // Atomically Reserve Stock for all items in the cart
    const affectedProducts = new Set<RuntimeProduct>();
    for (const item of rawCart) {
      const prod = this.products.find((p) => p.id === item.productId);
      if (prod) {
        affectedProducts.add(prod);
        if (item.variantId && prod.variants) {
          const v = prod.variants.find((vr) => vr.id === item.variantId);
          if (v) v.stockReserved += item.quantity;
        }
        prod.stockReserved += item.quantity;
      }
    }

    const shortCode = this.nextOrderShortCode();
    const expiresAt = new Date(Date.now() + this.vendor.reservationTtlMinutes * 60 * 1000);

    const virtualAccount = await this.monnify.createDynamicVirtualAccount({
      orderId: `ord-${Date.now()}`,
      orderShortCode: shortCode,
      vendorBusinessName: this.vendor.businessName,
      customerName: params.buyerName,
      customerPhone: params.buyerPhone,
      expectedAmountKobo: pricing.totalAmountKobo,
      expiresAt,
    });

    const orderItems: RuntimeOrderItem[] = rawCart.map((it, idx) => ({
      id: `item-${Date.now()}-${idx}`,
      productId: it.productId,
      productSku: it.productSku,
      productName: it.productName,
      variantId: it.variantId,
      variantSku: it.variantSku,
      variantName: it.variantName,
      quantity: it.quantity,
      unitPriceKobo: it.unitPriceKobo,
      subtotalKobo: it.unitPriceKobo * BigInt(it.quantity),
    }));

    const totalQuantity = rawCart.reduce((sum, it) => sum + it.quantity, 0);
    const primaryItem = rawCart[0];
    const displayProductName =
      rawCart.length === 1
        ? primaryItem.productName
        : `${primaryItem.productName} + ${rawCart.length - 1} more item${rawCart.length > 2 ? "s" : ""}`;

    const newOrder: RuntimeOrder = {
      id: `ord-${Date.now()}`,
      shortCode,
      customerPhone: params.buyerPhone,
      customerName: params.buyerName,
      productId: primaryItem.productId,
      productSku: primaryItem.productSku,
      productName: displayProductName,
      variantId: rawCart.length === 1 ? primaryItem.variantId : undefined,
      variantSku: rawCart.length === 1 ? primaryItem.variantSku : undefined,
      variantName: rawCart.length === 1 ? primaryItem.variantName : undefined,
      quantity: totalQuantity,
      items: orderItems,
      shippingZoneName: params.shippingZone.name,
      subtotalKobo: pricing.subtotalKobo,
      shippingFeeKobo: pricing.shippingFeeKobo,
      discountCode: activeDiscount && discountAmountKobo > 0n ? activeDiscount.code : undefined,
      discountAmountKobo: pricing.discountAmountKobo,
      totalAmountKobo: pricing.totalAmountKobo,
      amountPaidKobo: 0n,
      status: "PENDING_PAYMENT",
      invoiceReference: virtualAccount.invoiceReference,
      accountNumber: virtualAccount.accountNumber,
      bankName: virtualAccount.bankName,
      accountName: virtualAccount.accountName,
      paymentExpiresAt: expiresAt,
      createdAt: new Date(),
    };

    this.orders.unshift(newOrder);

    // Mirror the reservation, invoice and order atomically
    await this.persistNow("createOrder", async () => {
      if (activeDiscount && discountAmountKobo > 0n) {
        await this.persistence.saveDiscount(activeDiscount);
      }
      for (const p of affectedProducts) {
        await this.persistence.createOrder(newOrder, p);
      }
    });

    const itemInvoiceLines = rawCart.map((it) => {
      const vDisplay = it.variantName ? ` (${it.variantName})` : "";
      const lineCost = it.unitPriceKobo * BigInt(it.quantity);
      return `• ${it.productName}${vDisplay} ×${it.quantity} — *${formatNaira(lineCost)}*`;
    });

    const summaryText = rawCart
      .map((it) => `${it.productName}${it.variantName ? ` (${it.variantName})` : ""} x${it.quantity}`)
      .join(", ");

    await this.whatsapp.sendVirtualAccountInvoice({
      toBuyerPhone: params.buyerPhone,
      vendorBusinessName: this.vendor.businessName,
      isVendorVerified: this.vendor.verificationStatus === "VERIFIED",
      orderShortCode: newOrder.shortCode,
      productSummary: `${summaryText} + ${params.shippingZone.name} delivery (${formatNaira(params.shippingZone.feeKobo)})${
        newOrder.discountCode
          ? ` - Promo ${newOrder.discountCode} (${formatNaira(newOrder.discountAmountKobo)})`
          : ""
      }`,
      totalAmountFormatted: formatNaira(newOrder.totalAmountKobo),
      bankName: newOrder.bankName,
      accountNumber: newOrder.accountNumber,
      accountName: newOrder.accountName,
      expiresInMinutes: this.vendor.reservationTtlMinutes,
      vendorPhoneId: this.vendor.whatsappPhoneId,
    });

    this.appendChat({
      channel: "BUYER_SHOP_WA",
      sender: "CATERLOG_BOT",
      fromPhone: "CATERLOG",
      text: [
        `🧾 *Order Invoice ${newOrder.shortCode}*`,
        `${this.vendor.businessName} (✓ *Verified Caterlog Seller*)`,
        `📦 *Items Ordered:*`,
        ...itemInvoiceLines,
        `💰 *Items Subtotal:* ${formatNaira(pricing.subtotalKobo)}`,
        `🚚 *Delivery (${params.shippingZone.name}):* ${formatNaira(params.shippingZone.feeKobo)}`,
        ...(newOrder.discountCode
          ? [`🏷️ *Discount (${newOrder.discountCode}):* -${formatNaira(newOrder.discountAmountKobo)}`]
          : []),
        `💳 *Total Due:* *${formatNaira(newOrder.totalAmountKobo)}*`,
        `🏦 *Bank:* ${newOrder.bankName}`,
        `🔢 *Account No:* *${newOrder.accountNumber}*`,
        `⏳ *Reserved For:* ${this.vendor.reservationTtlMinutes} mins`,
      ].join("\n"),
    });

    this.appendChat({
      channel: "BUYER_SHOP_WA",
      sender: "CATERLOG_BOT",
      fromPhone: "CATERLOG",
      text: newOrder.accountNumber,
    });

    if (this.jobScheduler) {
      const delayMs = Math.max(0, newOrder.paymentExpiresAt.getTime() - Date.now());
      void this.jobScheduler
        .schedule(
          { name: "order-expiry", payload: { orderShortCode: newOrder.shortCode } },
          { jobId: `expiry-${newOrder.shortCode}`, delayMs }
        )
        .catch((err) =>
          console.error(`[caterlog:jobs] Failed to schedule expiry for ${newOrder.shortCode}:`, err)
        );

      if (this.vendor.reservationTtlMinutes >= 10) {
        const reminderDelayMs = Math.max(0, delayMs - 5 * 60_000);
        void this.jobScheduler
          .schedule(
            { name: "payment-reminder", payload: { orderShortCode: newOrder.shortCode } },
            { jobId: `reminder-${newOrder.shortCode}`, delayMs: reminderDelayMs }
          )
          .catch((err) =>
            console.error(
              `[caterlog:jobs] Failed to schedule payment reminder for ${newOrder.shortCode}:`,
              err
            )
          );
      }
    }

    await this.broadcastStateChange();
    return newOrder;
  }

  /** Allocates the next order code from the highest existing code, not the array length. */
  private nextOrderShortCode(): string {
    let max = 880;
    for (const order of this.orders) {
      const match = /^ORD-(\d+)$/i.exec(order.shortCode);
      if (match) max = Math.max(max, Number(match[1]));
    }
    return `ORD-${max + 1}`;
  }

  private isDiscountUsable(discount: RuntimeDiscount, now = new Date()): boolean {
    return (
      discount.isActive &&
      (discount.maxUses === null || discount.usedCount < discount.maxUses) &&
      (!discount.expiresAt || discount.expiresAt > now)
    );
  }

  public findProductAndVariantInBuyerMessage(
    text: string,
    quotedStatusImagePhash?: string,
    activeProduct?: RuntimeProduct
  ): { product?: RuntimeProduct; variant?: RuntimeProductVariant } {
    const trimmed = text.trim();
    const upper = trimmed.toUpperCase();
    const lower = trimmed.toLowerCase();
    const cleanAlpha = lower.replace(/[^a-z0-9]/g, "");

    // 0. If in an active product session, check if reply selects a variant
    if (activeProduct && activeProduct.variants && activeProduct.variants.length > 0) {
      // Check 1-based index (e.g. "1", "2", "#1")
      const numMatch = trimmed.match(/^#?(\d+)$/);
      if (numMatch) {
        const idx = Number.parseInt(numMatch[1], 10) - 1;
        if (idx >= 0 && idx < activeProduct.variants.length) {
          return { product: activeProduct, variant: activeProduct.variants[idx] };
        }
      }
      // Check variant SKU
      const bySku = activeProduct.variants.find((v) => {
        const vSkuClean = v.skuCode.toLowerCase().replace(/[^a-z0-9]/g, "");
        return upper.includes(v.skuCode.toUpperCase()) || (vSkuClean.length >= 4 && cleanAlpha.includes(vSkuClean));
      });
      if (bySku) return { product: activeProduct, variant: bySku };

      // Distinct variant words that do NOT appear in the parent product name
      const parentWords = new Set(
        activeProduct.name.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 2)
      );

      const matched = activeProduct.variants.find((v) => {
        const distinctWords = v.name
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ")
          .split(/\s+/)
          .filter((w) => w.length >= 2 && !parentWords.has(w));
        return distinctWords.some((w) => lower.includes(w));
      });
      if (matched) return { product: activeProduct, variant: matched };
    }

    // 1. Check if text explicitly names a variant SKU across all products
    for (const p of this.products) {
      if (p.variants && p.variants.length > 0) {
        for (const v of p.variants) {
          const vSkuClean = v.skuCode.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (upper.includes(v.skuCode.toUpperCase()) || (vSkuClean.length >= 4 && cleanAlpha.includes(vSkuClean))) {
            return { product: p, variant: v };
          }
        }
      }
    }

    // 2. Match parent product by pHash, SKU, or name
    let product: RuntimeProduct | undefined;
    if (quotedStatusImagePhash) {
      product = this.products.find(
        (p) => computePhashHammingDistance(p.imagePhash, quotedStatusImagePhash) <= 8
      );
    }
    if (!product) {
      product = this.products.find((p) => {
        const pSkuClean = p.skuCode.toLowerCase().replace(/[^a-z0-9]/g, "");
        return upper.includes(p.skuCode.toUpperCase()) || (pSkuClean.length >= 3 && cleanAlpha.includes(pSkuClean));
      });
    }
    if (!product) {
      product = this.products.find((p) => {
        const significantWords = p.name
          .toLowerCase()
          .replace(/[()]/g, "")
          .split(/\s+/)
          .filter((w) => w.length >= 3);
        if (significantWords.some((word) => lower.includes(word))) return true;

        const pLower = p.name.toLowerCase();
        if ((lower.includes("shoe") || lower.includes("heel")) && (pLower.includes("shoe") || pLower.includes("heel"))) return true;
        if (lower.includes("flask") && pLower.includes("flask")) return true;
        if (lower.includes("bag") && pLower.includes("bag")) return true;
        if (lower.includes("slide") && pLower.includes("slide")) return true;
        return false;
      });
    }

    if (!product) return {};

    // 3. If product has variants, check if text ALSO specified a distinct variant
    let matchedVariant: RuntimeProductVariant | undefined;
    if (product.variants && product.variants.length > 0) {
      const parentWords = new Set(
        product.name.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 2)
      );

      matchedVariant = product.variants.find((v) => {
        const vSkuClean = v.skuCode.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (upper.includes(v.skuCode.toUpperCase()) || (vSkuClean.length >= 4 && cleanAlpha.includes(vSkuClean))) return true;

        const distinctWords = v.name
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ")
          .split(/\s+/)
          .filter((w) => w.length >= 2 && !parentWords.has(w));
        return distinctWords.length > 0 && distinctWords.some((w) => lower.includes(w));
      });
    }

    return { product, variant: matchedVariant };
  }

  private findProductInBuyerMessage(
    text: string,
    quotedStatusImagePhash?: string
  ): RuntimeProduct | undefined {
    return this.findProductAndVariantInBuyerMessage(text, quotedStatusImagePhash).product;
  }

  private findShippingZoneInBuyerMessage(
    text: string,
    activeZones: RuntimeShippingZone[],
    allowNumericCode: boolean
  ): RuntimeShippingZone | undefined {
    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();

    // 1. Check exact or substring zone name match
    const byName = activeZones.find((z) => {
      const zoneWords = z.name
        .toLowerCase()
        .split(/[\s/]+/)
        .filter((w) => w.length >= 3);
      return lower.includes(z.name.toLowerCase()) || zoneWords.some((w) => lower.includes(w));
    });
    if (byName) return byName;

    // 2. If buyer is replying to the numbered shipping menu (e.g. "1", "2", or "2 PAYDAY"), match zone.code
    if (allowNumericCode) {
      const firstToken = trimmed.split(/\s+/)[0]?.replace(/^[#.]|[.]$/g, "") ?? "";
      if (/^\d+$/.test(firstToken)) {
        const code = Number.parseInt(firstToken, 10);
        return activeZones.find((z) => z.code === code);
      }
    }

    return undefined;
  }

  private extractQuantityFromText(text: string): number | undefined {
    const match =
      text.match(/(?:x|qty|quantity)\s*(\d+)/i) ??
      text.match(/(\d+)\s*(?:pcs|pieces|pairs|units|bags|shoes|of\b)/i);
    if (match?.[1]) {
      const parsed = Number.parseInt(match[1], 10);
      if (parsed >= 1 && parsed <= 50) return parsed;
    }
    return undefined;
  }

  /**
   * Principle 10.2: Server-Verified Monnify Webhook Reconciliation.
   */
  public async reconcileMonnifyWebhook(params: {
    rawBody: string;
    signatureHeader?: string;
    providerTransactionRef: string;
  }): Promise<PaymentReconciliationResult> {
    if (!this.monnify.verifyWebhookSignature(params.rawBody, params.signatureHeader)) {
      throw new Error("Invalid Monnify HMAC-SHA512 webhook signature.");
    }

    const verified = await this.monnify.verifyTransactionServerToServer(
      params.providerTransactionRef
    );

    return this.applyVerifiedPayment(verified);
  }

  /**
   * Polling fallback for local/live testing: asks Monnify directly whether the
   * order's invoice has been paid. Returns `undefined` when the order is unknown
   * and a `PENDING` result when no completed transfer exists yet.
   */
  public async verifyOrderPayment(
    shortCode: string
  ): Promise<PaymentReconciliationResult | undefined> {
    const order = this.orders.find(
      (o) => o.shortCode.toUpperCase() === shortCode.trim().toUpperCase()
    );
    if (!order) return undefined;

    const verified = await this.monnify.verifyPaymentByInvoiceReference(
      order.invoiceReference
    );
    if (!verified) {
      return {
        order,
        status: "PENDING",
        remainingBalanceKobo:
          order.totalAmountKobo > order.amountPaidKobo
            ? order.totalAmountKobo - order.amountPaidKobo
            : 0n,
        overpaidAmountKobo:
          order.amountPaidKobo > order.totalAmountKobo
            ? order.amountPaidKobo - order.totalAmountKobo
            : 0n,
        applied: false,
      };
    }

    return this.applyVerifiedPayment(verified);
  }

  /**
   * Applies an already server-verified payment record. Shared by the webhook
   * path and the manual/polling verification path.
   */
  public async applyVerifiedPayment(
    verified: ServerVerifiedPaymentRecord
  ): Promise<PaymentReconciliationResult> {
    const order = this.orders.find(
      (o) =>
        o.invoiceReference === verified.invoiceReference ||
        o.invoiceReference === verified.paymentReference
    );
    if (!order) {
      throw new Error(
        `Order not found for invoiceReference: ${verified.invoiceReference || verified.paymentReference}`
      );
    }

    const outstanding = () => ({
      order,
      remainingBalanceKobo:
        order.totalAmountKobo > order.amountPaidKobo
          ? order.totalAmountKobo - order.amountPaidKobo
          : 0n,
      overpaidAmountKobo:
        order.amountPaidKobo > order.totalAmountKobo
          ? order.amountPaidKobo - order.totalAmountKobo
          : 0n,
    });

    // Only settled transfers move an order; PENDING/FAILED records are informational.
    if (
      verified.paymentStatus !== "PAID" &&
      verified.paymentStatus !== "OVERPAID" &&
      verified.paymentStatus !== "PARTIALLY_PAID"
    ) {
      return { ...outstanding(), status: "PENDING", applied: false };
    }

    if (this.processedTxRefs.has(verified.providerTransactionRef)) {
      return {
        ...outstanding(),
        status: order.status === "PARTIALLY_PAID" ? "PARTIALLY_PAID" : "PAID",
        applied: false,
      };
    }
    this.processedTxRefs.add(verified.providerTransactionRef);

    const decision = evaluatePaymentReconciliation({
      totalAmountKobo: order.totalAmountKobo,
      previousAmountPaidKobo: order.amountPaidKobo,
      verifiedIncomingKobo: verified.amountPaidKobo,
    });

    assertValidOrderTransition(order.status, decision.nextStatus);

    order.amountPaidKobo = decision.newAmountPaidKobo;
    order.overpaidAmountKobo = decision.overpaidAmountKobo;
    order.status = decision.nextStatus;

    const product = this.products.find((p) => p.id === order.productId);

    if (decision.nextStatus === "PAID") {
      order.paidAt = new Date();
      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          const prod = this.products.find((p) => p.id === item.productId);
          if (prod) {
            const reservedQty = order.reservationReleased ? 0 : item.quantity;
            prod.stockTotal = Math.max(0, prod.stockTotal - item.quantity);
            prod.stockReserved = Math.max(0, prod.stockReserved - reservedQty);

            if (item.variantId && prod.variants) {
              const variant = prod.variants.find((v) => v.id === item.variantId);
              if (variant) {
                variant.stockTotal = Math.max(0, variant.stockTotal - item.quantity);
                variant.stockReserved = Math.max(0, variant.stockReserved - reservedQty);
              }
            }

            if (prod.variants && prod.variants.length > 0) {
              prod.stockTotal = prod.variants.reduce((sum, v) => sum + v.stockTotal, 0);
              prod.stockReserved = prod.variants.reduce((sum, v) => sum + v.stockReserved, 0);
            }
            this.persistInBackground("updateStockOnPayment", () => this.persistence.saveProduct(prod));
          }
        }
      } else if (product) {
        product.stockTotal = Math.max(0, product.stockTotal - order.quantity);
        const reservedQuantity = order.reservationReleased ? 0 : order.quantity;
        product.stockReserved = Math.max(0, product.stockReserved - reservedQuantity);

        if (order.variantId || order.variantSku) {
          const variant = product.variants?.find(
            (v) => v.id === order.variantId || v.skuCode === order.variantSku
          );
          if (variant) {
            variant.stockTotal = Math.max(0, variant.stockTotal - order.quantity);
            variant.stockReserved = Math.max(0, variant.stockReserved - reservedQuantity);
          }
        }

        if (product.variants && product.variants.length > 0) {
          product.stockTotal = product.variants.reduce((sum, v) => sum + v.stockTotal, 0);
          product.stockReserved = product.variants.reduce((sum, v) => sum + v.stockReserved, 0);
        }
        this.persistInBackground("updateStockOnPayment", () => this.persistence.saveProduct(product));
      }

      const overpayNote =
        decision.overpaidAmountKobo > 0n
          ? `\n💚 *Overpayment:* ${formatNaira(decision.overpaidAmountKobo)} extra was received. The vendor will refund or credit it.`
          : "";

      const itemDisplay = order.variantName
        ? `${order.productName} (${order.variantName})`
        : order.productName;

      const buyerReceipt = `✅ *Payment Confirmed!* (${formatNaira(decision.newAmountPaidKobo)})\n🧾 Receipt: *${order.shortCode}*\n📦 Item: *${itemDisplay}* ×${order.quantity}\n🚚 Delivery: *${order.shippingZoneName}*\n🏪 Vendor: *${this.vendor.businessName}*\n\nYour order is now being packed for dispatch!${overpayNote}`;
      const vendorAlert = `🔔 *PAID ORDER ${order.shortCode}!*\n💰 Verified Transfer: *${formatNaira(decision.newAmountPaidKobo)}* from ${verified.payerName ?? order.customerName}\n📦 Item: *${itemDisplay}* ×${order.quantity} (Remaining available stock: ${product ? product.stockTotal - product.stockReserved : 0})\n\nReply *dispatch ${order.shortCode} <riderPhone>* when handed to rider.${overpayNote}`;

      this.appendChat({
        channel: "BUYER_SHOP_WA",
        sender: "CATERLOG_BOT",
        fromPhone: "CATERLOG",
        text: buyerReceipt,
      });
      this.appendChat({
        channel: "VENDOR_ADMIN_WA",
        sender: "CATERLOG_BOT",
        fromPhone: "CATERLOG",
        text: vendorAlert,
      });

      if (this.jobScheduler) {
        void this.jobScheduler.cancel(`expiry-${order.shortCode}`).catch(console.error);
        void this.jobScheduler.cancel(`reminder-${order.shortCode}`).catch(console.error);
      }
    } else {
      order.paymentExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
      const partialMsg = `⚠️ *Partial Transfer Received (${formatNaira(verified.amountPaidKobo)})*\n🧾 Order: *${order.shortCode}*\n💰 Total with ${order.shippingZoneName} delivery: *${formatNaira(order.totalAmountKobo)}*\n❗ *Remaining Balance Due: ${formatNaira(decision.remainingBalanceKobo)}*\n\nYour stock lock has been extended by 30 mins. Please transfer the remaining *${formatNaira(decision.remainingBalanceKobo)}* to *${order.accountNumber}* (${order.bankName}).`;

      this.appendChat({
        channel: "BUYER_SHOP_WA",
        sender: "CATERLOG_BOT",
        fromPhone: "CATERLOG",
        text: partialMsg,
      });
      this.appendChat({
        channel: "VENDOR_ADMIN_WA",
        sender: "CATERLOG_BOT",
        fromPhone: "CATERLOG",
        text: `⚠️ *Partial Payment on ${order.shortCode}:* Buyer transferred ${formatNaira(verified.amountPaidKobo)} of ${formatNaira(order.totalAmountKobo)}. Caterlog automatically prompted them for the remaining ${formatNaira(decision.remainingBalanceKobo)} balance.`,
      });
    }

    await this.persistNow("applyPayment", async () => {
      await this.persistence.recordPayment(order, verified);
      await this.persistence.saveOrder(order);
    });

    await this.broadcastStateChange();
    return {
      order,
      status: decision.nextStatus,
      remainingBalanceKobo: decision.remainingBalanceKobo,
      overpaidAmountKobo: decision.overpaidAmountKobo,
      applied: true,
    };
  }

  /**
   * Pushes the current inventory to the WhatsApp Business catalog.
   * Mock mode publishes to an in-memory catalog; live mode calls the Meta Graph API.
   */
  public async syncWhatsAppCatalog(options: {
    deleteMissing?: boolean;
  } = {}): Promise<CatalogSyncResult> {
    const result = await this.catalog.syncProducts(
      this.products.map((product) => ({
        skuCode: product.skuCode,
        name: product.name,
        description: product.description,
        basePriceKobo: product.basePriceKobo,
        stockAvailable: Math.max(0, product.stockTotal - product.stockReserved),
        primaryImageUrl: product.primaryImageUrl,
        category: product.category,
        brand: this.vendor.businessName,
      })),
      {
        deleteMissing: options.deleteMissing ?? true,
        existingSkus: this.products.map((product) => product.skuCode),
      }
    );

    const failureNote =
      result.failed.length > 0
        ? `\n⚠️ ${result.failed.length} item(s) failed: ${result.failed
            .map((failure) => `${failure.skuCode} (${failure.error})`)
            .join(", ")}`
        : "";
    this.appendChat({
      channel: "VENDOR_ADMIN_WA",
      sender: "CATERLOG_BOT",
      fromPhone: "CATERLOG",
      text: `🛍️ *WhatsApp Catalog Sync (${result.mode})*\nPublished ${result.upserted}/${result.attempted} product(s) to catalog ${result.catalogId ?? "(mock)"}.${failureNote}`,
    });

    await this.broadcastStateChange();
    return result;
  }


  /**
   * Expires an unpaid order reservation and releases its locked inventory back to available stock.
   */
  public async expireOrderReservation(shortCode: string): Promise<RuntimeOrder | undefined> {
    const ord = this.orders.find(
      (o) => o.shortCode.toUpperCase() === shortCode.trim().toUpperCase()
    );
    if (!ord || (ord.status !== "PENDING_PAYMENT" && ord.status !== "PARTIALLY_PAID")) {
      return undefined;
    }

    assertValidOrderTransition(ord.status, "EXPIRED");

    ord.status = "EXPIRED";
    ord.reservationReleased = true;

    if (ord.items && ord.items.length > 0) {
      for (const item of ord.items) {
        const prod = this.products.find((p) => p.id === item.productId);
        if (prod) {
          prod.stockReserved = Math.max(0, prod.stockReserved - item.quantity);
          if (item.variantId && prod.variants) {
            const v = prod.variants.find((vr) => vr.id === item.variantId);
            if (v) {
              v.stockReserved = Math.max(0, v.stockReserved - item.quantity);
            }
          }
          if (prod.variants && prod.variants.length > 0) {
            prod.stockReserved = prod.variants.reduce((sum, v) => sum + v.stockReserved, 0);
          }
          this.persistInBackground("releaseExpiredReservation", () => this.persistence.saveProduct(prod));
        }
      }
    } else {
      const prod = this.products.find((p) => p.id === ord.productId);
      if (prod) {
        prod.stockReserved = Math.max(0, prod.stockReserved - ord.quantity);
        if (ord.variantId || ord.variantSku) {
          const variant = prod.variants?.find(
            (v) => v.id === ord.variantId || v.skuCode === ord.variantSku
          );
          if (variant) {
            variant.stockReserved = Math.max(0, variant.stockReserved - ord.quantity);
          }
        }
        if (prod.variants && prod.variants.length > 0) {
          prod.stockReserved = prod.variants.reduce((sum, v) => sum + v.stockReserved, 0);
        }
        this.persistInBackground("releaseExpiredReservation", () => this.persistence.saveProduct(prod));
      }
    }

    this.appendChat({
      channel: "BUYER_SHOP_WA",
      sender: "CATERLOG_BOT",
      fromPhone: "CATERLOG",
      text: `⌛ *Reservation Expired (${ord.shortCode}):* The ${this.vendor.reservationTtlMinutes}-minute payment hold for *${ord.productName}* has expired and the reserved stock has been released.`,
    });

    if (this.jobScheduler) {
      void this.jobScheduler.cancel(`expiry-${ord.shortCode}`).catch(console.error);
      void this.jobScheduler.cancel(`reminder-${ord.shortCode}`).catch(console.error);
    }

    await this.persistNow("expireOrder", () => this.persistence.saveOrder(ord));

    await this.broadcastStateChange();
    return ord;
  }

  /**
   * Expires every unpaid/partially-paid reservation whose payment window has elapsed.
   * Intended to be called by a lightweight interval (the in-memory Stage 1 engine has
   * no durable queue yet; a Stage 2 worker will replace this).
   */
  public async expireOverdueOrders(now = new Date()): Promise<RuntimeOrder[]> {
    const overdue = this.orders.filter(
      (o) =>
        (o.status === "PENDING_PAYMENT" || o.status === "PARTIALLY_PAID") &&
        o.paymentExpiresAt <= now
    );
    const expired: RuntimeOrder[] = [];
    for (const order of overdue) {
      const result = await this.expireOrderReservation(order.shortCode);
      if (result) expired.push(result);
    }
    return expired;
  }

  /**
   * Sends an automated payment reminder to the buyer for an active pending or partially-paid order.
   */
  public async sendPaymentReminder(shortCode: string): Promise<RuntimeOrder | undefined> {
    const ord = this.orders.find(
      (o) => o.shortCode.toUpperCase() === shortCode.trim().toUpperCase()
    );
    if (!ord || (ord.status !== "PENDING_PAYMENT" && ord.status !== "PARTIALLY_PAID")) {
      return undefined;
    }

    const remainingKobo =
      ord.totalAmountKobo > ord.amountPaidKobo ? ord.totalAmountKobo - ord.amountPaidKobo : 0n;
    if (remainingKobo <= 0n) return undefined;

    const reminderText = [
      `⏰ *Payment Reminder — Order ${ord.shortCode}*`,
      `Your reserved items are currently being held, but your reservation is expiring soon.`,
      `💰 *Amount Remaining:* *${formatNaira(remainingKobo)}*`,
      `🏦 *Bank:* ${ord.bankName}`,
      `🔢 *Account No:* *${ord.accountNumber}*`,
      `_Transfer directly to this dedicated account to complete your order._`,
    ].join("\n");

    await this.whatsapp.sendTextMessage({
      toPhone: ord.customerPhone,
      text: reminderText,
      vendorPhoneId: this.vendor.whatsappPhoneId,
    });

    this.appendChat({
      channel: "BUYER_SHOP_WA",
      sender: "CATERLOG_BOT",
      fromPhone: "CATERLOG",
      text: reminderText,
    });

    this.appendChat({
      channel: "BUYER_SHOP_WA",
      sender: "CATERLOG_BOT",
      fromPhone: "CATERLOG",
      text: ord.accountNumber,
    });

    await this.broadcastStateChange();
    return ord;
  }

  // ---------------------------------------------------------
  // Shared Mutation Methods (Invoked by both WhatsApp & Web Dashboard)
  // ---------------------------------------------------------

  public updateSettings(input: {
    copilotMode?: DomainCopilotMode;
    copilotIdleSeconds?: number;
    reservationTtlMinutes?: number;
  }) {
    if (input.copilotMode) {
      if (!["COPILOT", "FULL_AUTO", "MANUAL"].includes(input.copilotMode)) {
        throw new Error(`Invalid Co-Pilot mode: ${input.copilotMode}`);
      }
      this.vendor.copilotMode = input.copilotMode;
    }
    if (input.copilotIdleSeconds !== undefined) {
      this.vendor.copilotIdleSeconds = clamp(input.copilotIdleSeconds, 5, 600);
    }
    if (input.reservationTtlMinutes !== undefined) {
      this.vendor.reservationTtlMinutes = clamp(input.reservationTtlMinutes, 5, 180);
    }
    this.persistInBackground("saveVendor", () => this.persistence.saveVendor(this.vendor));
    void this.broadcastStateChange();
    return this.vendor;
  }

  public updateProductStock(skuCode: string, stockTotal: number): RuntimeProduct | undefined {
    const prod = this.products.find((p) => p.skuCode.toUpperCase() === skuCode.toUpperCase());
    if (!prod) return undefined;
    if (!Number.isInteger(stockTotal) || stockTotal < 0) {
      throw new Error("Stock must be a whole number greater than or equal to 0.");
    }
    if (stockTotal < prod.stockReserved) {
      throw new Error(
        `Cannot set stock to ${stockTotal} for "${prod.name}" because ${prod.stockReserved} unit(s) are currently reserved by buyers.`
      );
    }
    prod.stockTotal = stockTotal;
    this.persistInBackground("saveProductStock", () => this.persistence.saveProduct(prod));
    void this.broadcastStateChange();
    return prod;
  }

  public addProduct(input: {
    skuCode?: string;
    name: string;
    description?: string;
    basePriceKobo: bigint;
    stockTotal: number;
    category?: string;
    primaryImageUrl?: string;
    imagePhash?: string;
    variants?: RuntimeProductVariant[];
  }): RuntimeProduct {
    const name = input.name?.trim() ?? "";
    if (!name) {
      throw new Error("Product name is required.");
    }
    if (input.basePriceKobo <= 0n) {
      throw new Error("Product price must be greater than ₦0.");
    }

    const calculatedStock =
      input.variants && input.variants.length > 0
        ? input.variants.reduce((acc, v) => acc + (v.stockTotal || 0), 0)
        : input.stockTotal;

    if (!Number.isInteger(calculatedStock) || calculatedStock < 0) {
      throw new Error("Stock must be a whole number greater than or equal to 0.");
    }

    const skuCode = (
      input.skuCode && input.skuCode.trim() !== ""
        ? input.skuCode.trim()
        : `ITEM-0${this.products.length + 1}`
    ).toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(skuCode)) {
      throw new Error(
        "SKU must be 2-32 characters using letters, numbers, hyphens or underscores."
      );
    }

    const resolvedImageUrl =
      input.primaryImageUrl && input.primaryImageUrl.trim() !== ""
        ? input.primaryImageUrl.trim()
        : getSmartFallbackImage(name, input.category);

    const resolvedPhash =
      input.imagePhash ??
      computeDeterministicImagePhash(`${skuCode}:${name}:${resolvedImageUrl.slice(0, 256)}`);

    const existing = this.products.find((p) => p.skuCode === skuCode);
    if (existing) {
      if (calculatedStock < existing.stockReserved) {
        throw new Error(
          `Cannot set stock to ${calculatedStock} for "${existing.name}" because ${existing.stockReserved} unit(s) are currently reserved by buyers.`
        );
      }
      existing.name = name;
      existing.basePriceKobo = input.basePriceKobo;
      existing.stockTotal = calculatedStock;
      if (input.description) existing.description = input.description.trim();
      if (input.category) existing.category = input.category.trim();
      if (input.primaryImageUrl) {
        existing.primaryImageUrl = resolvedImageUrl;
        existing.imagePhash = resolvedPhash;
      }
      if (input.variants) {
        existing.variants = input.variants;
      }
      this.persistInBackground("addProduct", () => this.persistence.saveProduct(existing));
      void this.broadcastStateChange();
      return existing;
    }

    const created: RuntimeProduct = {
      id: `prod-${Date.now()}`,
      skuCode,
      name,
      description: input.description?.trim() || `${name} — available via WhatsApp & Caterlog`,
      category: input.category?.trim() || "fashion",
      basePriceKobo: input.basePriceKobo,
      primaryImageUrl: resolvedImageUrl,
      imagePhash: resolvedPhash,
      stockTotal: calculatedStock,
      stockReserved: 0,
      variants: input.variants,
    };
    this.products.unshift(created);
    this.persistInBackground("addProduct", () => this.persistence.saveProduct(created));
    void this.broadcastStateChange();
    return created;
  }

  public updateProduct(skuCode: string, input: {
    name?: string;
    description?: string;
    category?: string;
    basePriceKobo?: bigint;
    stockTotal?: number;
    primaryImageUrl?: string;
    variants?: RuntimeProductVariant[];
  }): RuntimeProduct | undefined {
    const clean = skuCode.trim().toUpperCase();
    const existing = this.products.find((p) => p.skuCode.toUpperCase() === clean);
    if (!existing) return undefined;

    if (input.name) existing.name = input.name.trim();
    if (input.description !== undefined) existing.description = input.description.trim();
    if (input.category) existing.category = input.category.trim();
    if (input.basePriceKobo !== undefined && input.basePriceKobo > 0n) existing.basePriceKobo = input.basePriceKobo;
    if (input.primaryImageUrl) existing.primaryImageUrl = input.primaryImageUrl.trim();

    if (input.variants) {
      existing.variants = input.variants;
      existing.stockTotal = input.variants.reduce((sum, v) => sum + (v.stockTotal || 0), 0);
    } else if (input.stockTotal !== undefined) {
      existing.stockTotal = input.stockTotal;
    }

    this.persistInBackground("updateProduct", () => this.persistence.saveProduct(existing));
    void this.broadcastStateChange();
    return existing;
  }

  public deleteProduct(skuCode: string): boolean {
    const cleanSku = skuCode.trim().toUpperCase();
    const index = this.products.findIndex(
      (p) => p.skuCode.toUpperCase() === cleanSku
    );
    if (index === -1) {
      return false;
    }
    this.products.splice(index, 1);
    this.persistInBackground("deleteProduct", () => this.persistence.deleteProduct(cleanSku));

    // Remove from Meta WhatsApp Catalog in real-time
    void this.catalog.deleteProduct(cleanSku).catch((err) => {
      console.warn(`[caterlog:catalog] Real-time Meta catalog deletion for "${cleanSku}" failed:`, err);
    });

    void this.broadcastStateChange();
    return true;
  }

  public upsertShippingZone(name: string, feeKobo: bigint): RuntimeShippingZone {
    const cleanName = name?.trim() ?? "";
    if (!cleanName) {
      throw new Error("Shipping zone name is required.");
    }
    if (feeKobo < 0n) {
      throw new Error("Shipping fee cannot be negative.");
    }

    const existing = this.shippingZones.find(
      (z) => z.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (existing) {
      existing.feeKobo = feeKobo;
      existing.isActive = true;
      this.persistInBackground("saveShippingZone", () =>
        this.persistence.saveShippingZone(existing)
      );
      void this.broadcastStateChange();
      return existing;
    }
    const nextCode =
      this.shippingZones.reduce((max, z) => (z.code > max ? z.code : max), 0) + 1;
    const created: RuntimeShippingZone = {
      id: `sz-${Date.now()}`,
      code: nextCode,
      name: cleanName,
      feeKobo,
      isActive: true,
    };
    this.shippingZones.push(created);
    this.persistInBackground("saveShippingZone", () =>
      this.persistence.saveShippingZone(created)
    );
    void this.broadcastStateChange();
    return created;
  }

  public deleteShippingZone(code: number): RuntimeShippingZone | undefined {
    const target = this.shippingZones.find((z) => z.code === code && z.isActive);
    if (!target) return undefined;
    target.isActive = false;
    this.persistInBackground("deleteShippingZone", () =>
      this.persistence.saveShippingZone(target)
    );
    void this.broadcastStateChange();
    return target;
  }

  public upsertDiscount(input: {
    code: string;
    type: "PERCENTAGE" | "FLAT_KOBO";
    value: bigint;
  }): RuntimeDiscount {
    const cleanCode = input.code?.trim().toUpperCase() ?? "";
    if (!cleanCode) {
      throw new Error("Discount code cannot be empty.");
    }
    if (input.type !== "PERCENTAGE" && input.type !== "FLAT_KOBO") {
      throw new Error(`Unsupported discount type: ${input.type}`);
    }
    if (input.type === "PERCENTAGE" && (input.value <= 0n || input.value > 10000n)) {
      throw new Error("Percentage discounts must be between 0.01% and 100%.");
    }
    if (input.type === "FLAT_KOBO" && input.value <= 0n) {
      throw new Error("Flat discounts must be greater than ₦0.");
    }

    const existing = this.discounts.find((d) => d.code === cleanCode);
    if (existing) {
      existing.type = input.type;
      existing.value = input.value;
      existing.isActive = true;
      this.persistInBackground("saveDiscount", () => this.persistence.saveDiscount(existing));
      void this.broadcastStateChange();
      return existing;
    }
    const created: RuntimeDiscount = {
      id: `disc-${Date.now()}`,
      code: cleanCode,
      type: input.type,
      value: input.value,
      minOrderKobo: 0n,
      usedCount: 0,
      maxUses: 100,
      isActive: true,
    };
    this.discounts.unshift(created);
    this.persistInBackground("saveDiscount", () => this.persistence.saveDiscount(created));
    void this.broadcastStateChange();
    return created;
  }

  public deactivateDiscount(code: string): RuntimeDiscount | undefined {
    const target = this.discounts.find(
      (d) => d.code === code.trim().toUpperCase() && d.isActive
    );
    if (!target) return undefined;
    target.isActive = false;
    this.persistInBackground("deactivateDiscount", () =>
      this.persistence.saveDiscount(target)
    );
    void this.broadcastStateChange();
    return target;
  }

  public async dispatchOrder(
    shortCode: string,
    riderPhone?: string
  ): Promise<RuntimeOrder | undefined> {
    const ord = this.orders.find(
      (o) => o.shortCode.toUpperCase() === shortCode.trim().toUpperCase()
    );
    if (!ord) {
      return undefined;
    }

    assertValidOrderTransition(ord.status, "OUT_FOR_DELIVERY");

    ord.status = "OUT_FOR_DELIVERY";
    ord.riderPhone = riderPhone;
    ord.dispatchedAt = new Date();

    this.appendChat({
      channel: "BUYER_SHOP_WA",
      sender: "CATERLOG_BOT",
      fromPhone: "CATERLOG",
      text: `🚚 *Order ${ord.shortCode} is Out for Delivery!*\n📦 Item: *${ord.productName}*${
        riderPhone ? `\n📞 Dispatch Rider: *${riderPhone}*` : ""
      }`,
    });

    await this.persistNow("dispatchOrder", () => this.persistence.saveOrder(ord));

    await this.broadcastStateChange();
    return ord;
  }

  public getAnalyticsBreakdown(range: "today" | "week" | "month" = "month") {
    const now = new Date();
    const cutoff =
      range === "today"
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
        : range === "week"
          ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let paidOrdersCount = 0;
    let paidGrossKobo = 0n;
    let pendingOrdersCount = 0;
    let pendingAmountKobo = 0n;
    let shippingCollectedKobo = 0n;
    let discountsGivenKobo = 0n;
    let netProductRevenueKobo = 0n;

    for (const o of this.orders) {
      if (o.createdAt < cutoff) continue;
      if (o.status === "PAID" || o.status === "OUT_FOR_DELIVERY" || o.status === "FULFILLED") {
        paidOrdersCount += 1;
        paidGrossKobo += o.amountPaidKobo;
        shippingCollectedKobo += o.shippingFeeKobo;
        discountsGivenKobo += o.discountAmountKobo;
        netProductRevenueKobo +=
          o.subtotalKobo > o.discountAmountKobo ? o.subtotalKobo - o.discountAmountKobo : 0n;
      } else if (o.status === "PENDING_PAYMENT" || o.status === "PARTIALLY_PAID") {
        pendingOrdersCount += 1;
        pendingAmountKobo += o.totalAmountKobo - o.amountPaidKobo;
      }
    }

    return {
      paidOrdersCount,
      paidGrossKobo,
      pendingOrdersCount,
      pendingAmountKobo,
      shippingCollectedKobo,
      discountsGivenKobo,
      netProductRevenueKobo,
    };
  }

  public serializeState() {
    const b = this.getAnalyticsBreakdown();
    const activeBuyerSession = Array.from(this.buyerSessions.values())[0] ?? null;
    return {
      vendor: this.vendor,
      activeBuyerSession,
      analytics: {
        paidOrdersCount: b.paidOrdersCount,
        paidGrossNaira: koboToNaira(b.paidGrossKobo),
        paidGrossFormatted: formatNaira(b.paidGrossKobo),
        pendingOrdersCount: b.pendingOrdersCount,
        pendingAmountNaira: koboToNaira(b.pendingAmountKobo),
        pendingAmountFormatted: formatNaira(b.pendingAmountKobo),
        shippingCollectedFormatted: formatNaira(b.shippingCollectedKobo),
        discountsGivenFormatted: formatNaira(b.discountsGivenKobo),
        netProductRevenueFormatted: formatNaira(b.netProductRevenueKobo),
      },
      products: this.products.map((p) => ({
        ...p,
        basePriceNaira: koboToNaira(p.basePriceKobo),
        basePriceFormatted: formatNaira(p.basePriceKobo),
        availableStock: Math.max(0, p.stockTotal - p.stockReserved),
        variants: p.variants?.map((v) => ({
          id: v.id,
          name: v.name,
          sku: v.skuCode,
          skuCode: v.skuCode,
          priceNaira: v.priceKobo !== undefined ? koboToNaira(v.priceKobo) : koboToNaira(p.basePriceKobo),
          priceFormatted: v.priceKobo !== undefined ? formatNaira(v.priceKobo) : formatNaira(p.basePriceKobo),
          stock: v.stockTotal,
          stockTotal: v.stockTotal,
          stockReserved: v.stockReserved,
          availableStock: Math.max(0, v.stockTotal - v.stockReserved),
        })),
      })),
      shippingZones: this.shippingZones
        .filter((z) => z.isActive)
        .map((z) => ({
          ...z,
          feeNaira: koboToNaira(z.feeKobo),
          feeFormatted: formatNaira(z.feeKobo),
        })),
      discounts: this.discounts
        .filter((d) => d.isActive)
        .map((d) => ({
          ...d,
          valueRaw: d.value.toString(),
          label:
            d.type === "PERCENTAGE"
              ? `${Number(d.value) / 100}% OFF`
              : `${formatNaira(d.value)} OFF`,
        })),
      orders: this.orders.map((o) => ({
        ...o,
        items: o.items?.map((it) => ({
          ...it,
          unitPriceFormatted: formatNaira(it.unitPriceKobo),
          subtotalFormatted: formatNaira(it.subtotalKobo),
        })),
        subtotalFormatted: formatNaira(o.subtotalKobo),
        shippingFeeFormatted: formatNaira(o.shippingFeeKobo),
        discountAmountFormatted: formatNaira(o.discountAmountKobo),
        totalAmountNaira: koboToNaira(o.totalAmountKobo),
        totalAmountFormatted: formatNaira(o.totalAmountKobo),
        amountPaidNaira: koboToNaira(o.amountPaidKobo),
        amountPaidFormatted: formatNaira(o.amountPaidKobo),
        remainingBalanceNaira: koboToNaira(
          o.totalAmountKobo > o.amountPaidKobo ? o.totalAmountKobo - o.amountPaidKobo : 0n
        ),
        remainingBalanceFormatted: formatNaira(
          o.totalAmountKobo > o.amountPaidKobo ? o.totalAmountKobo - o.amountPaidKobo : 0n
        ),
        overpaidAmountFormatted: formatNaira(
          o.amountPaidKobo > o.totalAmountKobo ? o.amountPaidKobo - o.totalAmountKobo : 0n
        ),
      })),
      chatMessages: this.chatMessages.slice(-50),
      integrations: this.getIntegrationStatus(),
      catalogSync: {
        mode: this.catalog.getMode(),
        lastSyncedAt: this.catalog.getIntegrationStatus().lastSyncedAt,
        publishedItems: this.catalog.getIntegrationStatus().publishedItems,
      },
    };
  }

  private appendChat(msg: Omit<ChatThreadMessage, "id" | "timestamp">) {
    this.chatMessages.push({
      ...msg,
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date(),
    });
  }

  private async broadcastStateChange() {
    await this.eventBus.publish({
      eventType: "VENDOR_SETTINGS_UPDATED",
      vendorId: this.vendor.id,
      actorType: "SYSTEM_TIMER",
      entityType: "VENDOR",
      entityId: this.vendor.id,
      payload: {},
      occurredAt: new Date(),
    });
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
