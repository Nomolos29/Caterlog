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
import { mediaStore } from "./media/media-store.ts";

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

/**
 * Generates a clean, consistent, sequential SKU (Content ID) for a product
 * based on category/name prefix (e.g. SHOE-03, BAG-02, FLASK-01, WEAR-01)
 * avoiding duplicates and inconsistent fallback codes.
 */
export function generateConsistentSku(
  name: string,
  category?: string,
  existingProducts: Array<{ skuCode: string }> = []
): string {
  const combined = `${name} ${category ?? ""}`.toUpperCase();
  let prefix = "ITEM";
  if (/HEEL|SHOE|BOOT|SNEAKER|SLIDE|SANDAL|FOOTWEAR/.test(combined)) {
    prefix = "SHOE";
  } else if (/BAG|TOTE|HANDBAG|PURSE|BACKPACK|CLUTCH/.test(combined)) {
    prefix = "BAG";
  } else if (/FLASK|BOTTLE|CUP|TUMBLER|MUG/.test(combined)) {
    prefix = "FLASK";
  } else if (/DRESS|SHIRT|GOWN|HOODIE|TOP|PANTS|SUIT|JACKET|WEAR|CLOTH/.test(combined)) {
    prefix = "WEAR";
  } else if (/FOOD|LUNCH|CAKE|SNACK|RICE|MEAL|KITCHEN/.test(combined)) {
    prefix = "FOOD";
  } else if (/COSMETIC|CREAM|LOTION|PERFUME|BEAUTY|SKIN/.test(combined)) {
    prefix = "GLOW";
  } else {
    const firstWord = name.trim().split(/\s+/)[0]?.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (firstWord && firstWord.length >= 3) {
      prefix = firstWord.slice(0, 6);
    }
  }

  const existingUpper = new Set(existingProducts.map((p) => p.skuCode.toUpperCase()));
  let index = 1;
  let candidate = `${prefix}-${String(index).padStart(2, "0")}`;
  while (existingUpper.has(candidate)) {
    index++;
    candidate = `${prefix}-${String(index).padStart(2, "0")}`;
  }
  return candidate;
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
    copilotMode: ((process.env.COPILOT_MODE as DomainCopilotMode) || "FULL_AUTO") as DomainCopilotMode,
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
    if (process.env.COPILOT_MODE) {
      this.vendor.copilotMode = process.env.COPILOT_MODE as DomainCopilotMode;
    } else if (!snapshot.vendor.copilotMode || snapshot.vendor.copilotMode === "COPILOT") {
      this.vendor.copilotMode = "FULL_AUTO";
    }
    if (snapshot.products && snapshot.products.length > 0) {
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
    }
    if (snapshot.shippingZones && snapshot.shippingZones.length > 0) {
      this.shippingZones = snapshot.shippingZones.map((zone) => ({ ...zone }));
    }
    if (snapshot.discounts && snapshot.discounts.length > 0) {
      this.discounts = snapshot.discounts.map((discount) => ({ ...discount }));
    }
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
   * Unified dispatcher: sends the message to WhatsApp Cloud API (with photos,
   * interactive buttons, or interactive lists) AND appends to the chat store
   * so the mobile phone experience matches the dashboard simulator identically.
   */
  public async dispatchWhatsAppAndRecordChat(params: {
    channel: "VENDOR_ADMIN_WA" | "BUYER_SHOP_WA";
    toPhone: string;
    text: string;
    imageUrl?: string;
    quickReplies?: QuickReplyOption[];
    sender?: "CATERLOG_BOT" | "VENDOR";
    headerText?: string;
    footerText?: string;
  }): Promise<void> {
    await this.whatsapp.sendWhatsAppMessage({
      toPhone: params.toPhone,
      text: params.text,
      imageUrl: params.imageUrl,
      quickReplies: params.quickReplies,
      headerText: params.headerText,
      footerText: params.footerText,
      vendorPhoneId: this.vendor.whatsappPhoneId,
    });

    this.appendChat({
      channel: params.channel,
      sender: params.sender ?? "CATERLOG_BOT",
      fromPhone: params.sender === "VENDOR" ? this.vendor.whatsappPhone : "CATERLOG",
      text: params.text,
      imageUrl: params.imageUrl,
      quickReplies: params.quickReplies,
    });
  }

  /**
   * Handles Vendor WhatsApp Keyword Commands (including attached product photos!).
   */
  public async handleVendorWhatsAppKeyword(
    rawText: string,
    attachedImageUrl?: string,
    attachedImagePhash?: string
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
          "• *sync* or *catalog sync* — Publish all items to WhatsApp Business Catalog",
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
          "",
          "🤝 *CUSTOMER ASSISTANCE & CO-PILOT SYNC*",
          "• *reply <message>* — Reply to customer asking for help",
          "• *reply <phone> <message>* — Reply to specific customer (e.g. `reply 7766 Size 40 is ready`)",
          "• *resume* — Hand customer back to AI Co-Pilot",
        ].join("\n");

        quickReplies = [
          { label: "📦 Products", replyText: "products" },
          { label: "🛍️ Sync Catalog", replyText: "sync catalog" },
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
          const skuCode = (
            cmd.skuCode ||
            generateConsistentSku(cmd.name, undefined, this.products)
          ).toUpperCase();

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
              skuCode: `${skuCode}-${suffix}`,
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
            skuCode,
            name: cmd.name,
            basePriceKobo: effectiveBasePrice,
            stockTotal: cmd.stockTotal,
            primaryImageUrl: attachedImageUrl,
            imagePhash: attachedImagePhash,
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

      case "VENDOR_ASSIST_REPLY": {
        const assistRes = await this.recordVendorManualReplyInBuyerThread(
          cmd.message,
          cmd.targetPhoneOrQuery
        );
        replyText = `💬 Delivered reply to *${assistRes.targetBuyerName}* (${assistRes.targetBuyerPhone}):\n"${cmd.message}"\n\n_Co-Pilot is paused for this customer so you can chat freely. Reply *resume* when done._`;
        quickReplies = [
          { label: "🤖 Resume Co-Pilot", replyText: "resume" },
          { label: "📦 View Stock", replyText: "stock" },
        ];
        break;
      }

      case "RESUME_COPILOT": {
        const resumed = await this.handleResumeCopilot(cmd.targetPhoneOrQuery);
        replyText = `🤖 *Co-Pilot Resumed* for *${resumed.targetBuyerName}* (${resumed.targetBuyerPhone}). Automated checkout and product inquiries are active again.`;
        quickReplies = [
          { label: "📊 Sales Summary", replyText: "sales" },
          { label: "📦 View Stock", replyText: "stock" },
        ];
        break;
      }

      case "SYNC_CATALOG": {
        try {
          const syncResult = await this.syncWhatsAppCatalog({
            deleteMissing: cmd.deleteMissing ?? true,
          });
          const failCount = syncResult.failed.length;
          const failDetail =
            failCount > 0
              ? `\n⚠️ ${failCount} product(s) failed:\n${syncResult.failed.map((f) => `• ${f.skuCode}: ${f.error}`).join("\n")}`
              : "";
          replyText = [
            `🛍️ *WhatsApp Business Catalog Synced!*`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `• Mode: *${syncResult.mode.toUpperCase()}*`,
            `• Catalog ID: *${syncResult.catalogId ?? "N/A"}*`,
            `• Total Attempted: *${syncResult.attempted}*`,
            `• Successfully Upserted: *${syncResult.upserted}*`,
            `• Deleted Out-of-Stock/Missing: *${syncResult.deleted}*`,
            failDetail,
          ]
            .filter(Boolean)
            .join("\n");
        } catch (err) {
          replyText = `⚠️ Failed to sync catalog: ${err instanceof Error ? err.message : String(err)}`;
        }
        quickReplies = [
          { label: "📦 View Products", replyText: "products" },
          { label: "📊 Sales", replyText: "sales" },
          { label: "🛠️ Help Menu", replyText: "help" },
        ];
        break;
      }

      case "UNKNOWN_COMMAND": {
        replyText = `❓ Unrecognized command "${cmd.rawInput}". Type *help* to see all Caterlog commands (or send *Name, #Price, stock Qty* to add a product).`;
        break;
      }
    }

    await this.dispatchWhatsAppAndRecordChat({
      channel: "VENDOR_ADMIN_WA",
      toPhone: this.vendor.whatsappPhone,
      text: replyText,
      quickReplies,
      headerText: "Caterlog Vendor Hub",
    });

    await this.broadcastStateChange();
    return { replyText, commandType: cmd.type };
  }

  /**
   * Records that the Vendor manually sent a customer assistance reply in the Buyer's WhatsApp thread.
   * Cancels any pending Co-Pilot idle timer and pauses Co-Pilot so vendor can assist freely!
   */
  public async recordVendorManualReplyInBuyerThread(
    text: string,
    buyerPhoneOrQuery?: string
  ): Promise<{
    targetBuyerPhone: string;
    targetBuyerName: string;
    delivered: boolean;
  }> {
    this.lastVendorReplyInBuyerThreadAt = new Date();
    const timer = this.activeCopilotTimers.get("buyer-thread");
    if (timer) {
      clearTimeout(timer);
      this.activeCopilotTimers.delete("buyer-thread");
    }

    let targetPhone = buyerPhoneOrQuery?.trim();
    let targetSession: BuyerConversationSession | undefined;

    if (targetPhone) {
      for (const [phone, sess] of this.buyerSessions.entries()) {
        if (phone === targetPhone || phone.endsWith(targetPhone)) {
          targetPhone = phone;
          targetSession = sess;
          break;
        }
      }
    }

    if (!targetSession) {
      const sessions = Array.from(this.buyerSessions.values());
      const needsAssist = sessions.find((s) => s.state === "NEEDS_ASSISTANCE");
      targetSession = needsAssist ?? sessions[0];
      if (targetSession) {
        targetPhone = targetSession.buyerPhone;
      }
    }

    if (!targetPhone) {
      const recentBuyerMsg = [...this.chatMessages]
        .reverse()
        .find((m) => m.channel === "BUYER_SHOP_WA" && m.sender === "BUYER");
      targetPhone = recentBuyerMsg?.fromPhone ?? "+2348099887766";
    }

    const buyerName = targetSession?.buyerName ?? "Customer";

    if (targetSession) {
      targetSession.state = "ASSISTING";
      targetSession.copilotPaused = true;
      targetSession.updatedAt = new Date();
    } else {
      this.buyerSessions.set(targetPhone, {
        buyerPhone: targetPhone,
        buyerName,
        state: "ASSISTING",
        copilotPaused: true,
        updatedAt: new Date(),
      });
    }

    const customerMessageText = [
      `👤 *${this.vendor.businessName} (Store Owner):*`,
      text,
      ``,
      `_Reply directly to chat with the store owner, or tap below to resume automated shopping._`,
    ].join("\n");

    await this.dispatchWhatsAppAndRecordChat({
      channel: "BUYER_SHOP_WA",
      toPhone: targetPhone,
      text: customerMessageText,
      sender: "VENDOR",
      quickReplies: [
        { label: "🛍️ Resume Co-Pilot", replyText: "resume" },
        { label: "🛒 View Cart", replyText: "cart" },
      ],
      headerText: "Store Owner Reply",
    });

    await this.dispatchWhatsAppAndRecordChat({
      channel: "VENDOR_ADMIN_WA",
      toPhone: this.vendor.whatsappPhone,
      text: `💬 Delivered your reply to *${buyerName}* (${targetPhone}):\n"${text}"\n\nCo-Pilot is paused for this customer so you can chat freely. Reply *resume* when done.`,
      quickReplies: [
        { label: "🤖 Hand Back to Co-Pilot", replyText: "resume" },
      ],
    });

    await this.broadcastStateChange();
    return {
      targetBuyerPhone: targetPhone,
      targetBuyerName: buyerName,
      delivered: true,
    };
  }

  public async handleResumeCopilot(buyerPhoneOrQuery?: string): Promise<{
    targetBuyerPhone: string;
    targetBuyerName: string;
  }> {
    let targetPhone = buyerPhoneOrQuery?.trim();
    let targetSession: BuyerConversationSession | undefined;

    if (targetPhone) {
      for (const [phone, sess] of this.buyerSessions.entries()) {
        if (phone === targetPhone || phone.endsWith(targetPhone)) {
          targetPhone = phone;
          targetSession = sess;
          break;
        }
      }
    }

    if (!targetSession) {
      const sessions = Array.from(this.buyerSessions.values());
      const assisting = sessions.find((s) => s.state === "ASSISTING" || s.copilotPaused);
      targetSession = assisting ?? sessions[0];
      if (targetSession) {
        targetPhone = targetSession.buyerPhone;
      }
    }

    if (!targetPhone) {
      targetPhone = "+2348099887766";
    }

    const buyerName = targetSession?.buyerName ?? "Customer";

    if (targetSession) {
      targetSession.copilotPaused = false;
      targetSession.state = "CART_ACTIVE";
      targetSession.updatedAt = new Date();
    }

    const resumeMsg = [
      `🤖 *${this.vendor.businessName} Sales Co-Pilot is back online!*`,
      `How else can I help you today? Reply with a product name, SKU, or *cart* anytime.`,
    ].join("\n");

    await this.dispatchWhatsAppAndRecordChat({
      channel: "BUYER_SHOP_WA",
      toPhone: targetPhone,
      text: resumeMsg,
      quickReplies: [
        { label: "🛍️ View Catalog", replyText: "catalog" },
        { label: "🛒 View Cart", replyText: "cart" },
      ],
      headerText: "Sales Co-Pilot Resumed",
    });

    await this.dispatchWhatsAppAndRecordChat({
      channel: "VENDOR_ADMIN_WA",
      toPhone: this.vendor.whatsappPhone,
      text: `🤖 *Co-Pilot Resumed* for *${buyerName}* (${targetPhone}). Automated checkout and product inquiries are active again.`,
      quickReplies: [
        { label: "📊 Sales Summary", replyText: "sales" },
        { label: "📦 View Stock", replyText: "stock" },
      ],
    });

    await this.broadcastStateChange();
    return {
      targetBuyerPhone: targetPhone,
      targetBuyerName: buyerName,
    };
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
    attachedImageUrl?: string;
    simulateFastForwardIdleTimer?: boolean;
  }): Promise<{
    copilotDecision: ReturnType<typeof evaluateCopilotAction>;
    step?: "PROMPTED_FOR_QUANTITY" | "PROMPTED_FOR_SHIPPING_ZONE" | "INVOICE_CREATED" | "OUT_OF_STOCK" | "UNMATCHED";
    createdOrder?: RuntimeOrder;
  }> {
    const buyerMessageTime = new Date();
    const matchedStatusProduct = params.quotedStatusImagePhash
      ? this.products.find(
          (p) => computePhashHammingDistance(p.imagePhash, params.quotedStatusImagePhash!) <= 8
        )
      : undefined;

    const chatImageUrl = params.attachedImageUrl || matchedStatusProduct?.primaryImageUrl;

    this.appendChat({
      channel: "BUYER_SHOP_WA",
      sender: "BUYER",
      fromPhone: params.buyerPhone,
      text: params.quotedStatusImagePhash
        ? `📸 [Replied to WhatsApp Status${matchedStatusProduct ? `: ${matchedStatusProduct.name}` : ""}] ${params.text || ""}`.trim()
        : params.text || (params.attachedImageUrl ? "📸 [Sent an image]" : ""),
      imageUrl: chatImageUrl,
    });

    const existingSession = this.buyerSessions.get(params.buyerPhone);
    const trimmed = params.text.trim().toLowerCase();

    // If Co-Pilot is paused for this buyer (vendor is actively assisting them):
    if (existingSession?.copilotPaused) {
      if (/^(?:resume|copilot(?:\s+on)?|back\s+to\s+shopping|shop|menu|catalog)$/i.test(trimmed)) {
        await this.handleResumeCopilot(params.buyerPhone);
        return {
          copilotDecision: {
            action: "RESPOND_IMMEDIATELY",
            reason: "Buyer manually resumed Sales Co-Pilot.",
          },
          step: "UNMATCHED",
        };
      }

      // Forward buyer's message to vendor without automated bot interruption
      await this.dispatchWhatsAppAndRecordChat({
        channel: "VENDOR_ADMIN_WA",
        toPhone: this.vendor.whatsappPhone,
        text: `💬 *[${params.buyerName ?? "Customer"} (${params.buyerPhone})]:*\n"${params.text}"\n\n_To reply, send: \`reply ${params.text}\` or reply from Dashboard._`,
        quickReplies: [
          { label: `💬 Reply to ${params.buyerName?.split(" ")[0] ?? "Customer"}`, replyText: `reply ${params.buyerPhone} ` },
          { label: "🤖 Resume Co-Pilot", replyText: "resume" },
        ],
      });

      await this.broadcastStateChange();
      return {
        copilotDecision: {
          action: "DO_NOTHING",
          reason: "Vendor is actively assisting customer; Co-Pilot paused.",
        },
      };
    }

    const decision = evaluateCopilotAction({
      copilotMode: this.vendor.copilotMode,
      copilotIdleSeconds: this.vendor.copilotIdleSeconds,
      sessionCopilotPaused: Boolean(existingSession?.copilotPaused),
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
        attachedImageUrl: params.attachedImageUrl,
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
          attachedImageUrl: params.attachedImageUrl,
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
    attachedImageUrl?: string;
  }): Promise<{
    step: "PROMPTED_FOR_QUANTITY" | "PROMPTED_FOR_SHIPPING_ZONE" | "INVOICE_CREATED" | "OUT_OF_STOCK" | "ORDER_TRACKED" | "UNMATCHED";
    createdOrder?: RuntimeOrder;
  }> {
    const activeZones = this.shippingZones.filter((z) => z.isActive);
    const existingSession = this.buyerSessions.get(params.buyerPhone);
    const trimmed = params.text.trim();

    // 0. Customer Assistance / Human Vendor Request
    const isAssistanceRequest =
      /\b(?:(?:talk|speak|chat)\s+(?:to|with)\s+(?:the\s+)?(?:store\s+)?(?:vendor|human|owner|seller|agent|person|support)|contact\s+(?:the\s+)?(?:store\s+)?(?:vendor|owner|support)|human\s+agent|talk\s+to\s+someone|customer\s+care|customer\s+support|need\s+(?:help|assistance)|help\s+me|assistance\s+please)\b/i.test(
        trimmed
      ) ||
      /^(?:help|support|agent|human|owner|vendor|assistance)$/i.test(
        trimmed.replace(/[?.!]/g, "").trim()
      );

    if (isAssistanceRequest) {
      this.buyerSessions.set(params.buyerPhone, {
        buyerPhone: params.buyerPhone,
        buyerName: params.buyerName,
        state: "NEEDS_ASSISTANCE",
        assistanceInquiry: trimmed,
        assistanceRequestedAt: new Date(),
        updatedAt: new Date(),
      });

      const buyerAck = [
        `🛎️ *Customer Assistance Request Received*`,
        ``,
        `I have alerted the store owner (*${this.vendor.businessName}*) to assist you directly! They will reply to you here shortly. 🕒`,
        ``,
        `_In the meantime, feel free to reply with any product name, SKU, or *cart* to continue shopping._`,
      ].join("\n");

      await this.dispatchWhatsAppAndRecordChat({
        channel: "BUYER_SHOP_WA",
        toPhone: params.buyerPhone,
        text: buyerAck,
        quickReplies: [
          { label: "🛍️ View Catalog", replyText: "catalog" },
          { label: "🛒 View Cart", replyText: "cart" },
        ],
        headerText: "Customer Support Alerted",
      });

      await this.dispatchWhatsAppAndRecordChat({
        channel: "VENDOR_ADMIN_WA",
        toPhone: this.vendor.whatsappPhone,
        text: [
          `🔔 *Customer Assistance Request*`,
          ``,
          `*Customer:* ${params.buyerName} (\`${params.buyerPhone}\`)`,
          `*Inquiry:* "${trimmed}"`,
          ``,
          `_To reply from WhatsApp:_`,
          `👉 \`reply ${trimmed.length > 20 ? trimmed.slice(0, 20) + "..." : trimmed}\` or \`reply ${params.buyerPhone} <Your reply>\``,
          ``,
          `_You can also answer directly from your Caterlog Web Dashboard._`,
        ].join("\n"),
        quickReplies: [
          {
            label: `💬 Reply to ${params.buyerName.split(" ")[0]}`,
            replyText: `reply ${params.buyerPhone} `,
          },
        ],
        headerText: "Customer Assistance",
      });

      await this.broadcastStateChange();
      return { step: "UNMATCHED" };
    }

    // 0b. Self-Service Order Status & Tracking (e.g. "track", "status", "track ORD-882", "where is my order")
    const isTrackingQuery =
      /^(?:track(?:_|\s+)?([A-Za-z0-9_-]+)?|status(?:\s+([A-Za-z0-9_-]+))?|order\s+status(?:\s+([A-Za-z0-9_-]+))?|where\s+is\s+my\s+order|my\s+orders?|check\s+order)$/i.test(
        trimmed
      );

    if (isTrackingQuery) {
      const codeMatch = trimmed.match(
        /^(?:track(?:_|\s+)?|status\s+|order\s+status\s+)([A-Za-z0-9_-]+)$/i
      );
      const rawCode = codeMatch ? codeMatch[1].trim() : "";
      const cleanCode = rawCode.toUpperCase().replace(/^#/, "");
      const searchCode = cleanCode ? (cleanCode.startsWith("ORD-") ? cleanCode : `ORD-${cleanCode}`) : "";

      const buyerOrders = this.orders
        .filter((o) => o.customerPhone === params.buyerPhone)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const matchingOrder =
        (searchCode ? this.orders.find((o) => o.shortCode.toUpperCase() === searchCode || o.id === rawCode) : undefined) ||
        buyerOrders[0];

      if (!matchingOrder) {
        const notFoundText = [
          `🔍 *Order Not Found*`,
          ``,
          rawCode
            ? `We couldn't find an order matching *"${rawCode}"*. Please double check your order number.`
            : `We couldn't find any recent orders linked to your phone number (\`${params.buyerPhone}\`).`,
          ``,
          `💡 Reply with *track <orderCode>* (e.g. \`track ORD-123\`) or reply *catalog* to browse our store!`,
        ].join("\n");

        await this.dispatchWhatsAppAndRecordChat({
          channel: "BUYER_SHOP_WA",
          toPhone: params.buyerPhone,
          text: notFoundText,
          quickReplies: [
            { label: "🛍️ View Catalog", replyText: "catalog" },
            { label: "💬 Talk to Support", replyText: "talk to vendor" },
          ],
          headerText: "Order Tracking",
        });
        await this.broadcastStateChange();
        return { step: "UNMATCHED" };
      }

      let statusHeadline = "";
      let statusExplanation = "";

      switch (matchingOrder.status) {
        case "PENDING_PAYMENT": {
          const balance = matchingOrder.totalAmountKobo - matchingOrder.amountPaidKobo;
          statusHeadline = "🟡 *AWAITING BANK TRANSFER*";
          statusExplanation = [
            `Your items are reserved! Please complete your transfer to finalize:`,
            `🏦 Bank: *${matchingOrder.bankName}*`,
            `🔢 Account: *${matchingOrder.accountNumber}*`,
            `👤 Name: *${matchingOrder.accountName}*`,
            `💰 Amount Due: *${formatNaira(balance)}*`,
          ].join("\n");
          break;
        }
        case "PARTIALLY_PAID": {
          const balance = matchingOrder.totalAmountKobo - matchingOrder.amountPaidKobo;
          statusHeadline = "🟠 *PARTIALLY PAID*";
          statusExplanation = [
            `We received *${formatNaira(matchingOrder.amountPaidKobo)}*.`,
            `Remaining balance: *${formatNaira(balance)}*`,
            `🔢 Account: *${matchingOrder.accountNumber}* (${matchingOrder.bankName})`,
          ].join("\n");
          break;
        }
        case "PAID":
        case "PROCESSING": {
          statusHeadline = "🟢 *PAYMENT VERIFIED & PREPARING*";
          statusExplanation = [
            `Your payment was received in full! We are packaging your items for dispatch.`,
            matchingOrder.deliveryAddress
              ? `🏠 Delivery Address: *${matchingOrder.deliveryAddress}*`
              : matchingOrder.shippingZoneName
                ? `🚚 Shipping Zone: *${matchingOrder.shippingZoneName}*`
                : "",
            `_You will receive another message as soon as your dispatch rider is on the way!_`,
          ].filter(Boolean).join("\n");
          break;
        }
        case "OUT_FOR_DELIVERY": {
          statusHeadline = "🚚 *OUT FOR DELIVERY*";
          statusExplanation = [
            `Your package is on the way!`,
            matchingOrder.riderPhone
              ? `📞 Dispatch Rider: *${matchingOrder.riderPhone}*`
              : `🛵 Couriered via local dispatch.`,
            matchingOrder.deliveryAddress
              ? `🏠 Delivering to: *${matchingOrder.deliveryAddress}*`
              : `🚚 Zone: *${matchingOrder.shippingZoneName}*`,
            `_Please keep your phone reachable so the rider can connect upon arrival._`,
          ].join("\n");
          break;
        }
        case "FULFILLED": {
          statusHeadline = "✅ *DELIVERED & COMPLETED*";
          statusExplanation = `This order was successfully delivered! Thank you for shopping with ${this.vendor.businessName}.`;
          break;
        }
        case "EXPIRED": {
          statusHeadline = "🛑 *ORDER EXPIRED*";
          statusExplanation = `The reservation window for this order has expired. Reply *catalog* to browse items and place a fresh order.`;
          break;
        }
        case "CANCELLED": {
          statusHeadline = "❌ *ORDER CANCELLED*";
          statusExplanation = `This order has been cancelled.`;
          break;
        }
        case "REFUNDED": {
          statusHeadline = "💸 *ORDER REFUNDED*";
          statusExplanation = `This order has been refunded.`;
          break;
        }
      }

      const itemSummary =
        matchingOrder.items && matchingOrder.items.length > 0
          ? matchingOrder.items.map((i) => `• ${i.productName} ×${i.quantity}`).join("\n")
          : `• ${matchingOrder.productName} ×${matchingOrder.quantity || 1}`;

      const trackingText = [
        `📦 *ORDER STATUS: #${matchingOrder.shortCode}*`,
        ``,
        statusHeadline,
        statusExplanation,
        ``,
        `🛍️ *Order Items:*`,
        itemSummary,
        ``,
        `💰 *Total:* *${formatNaira(matchingOrder.totalAmountKobo)}*`,
      ].join("\n");

      const quickReplies: QuickReplyOption[] = [];
      if (matchingOrder.status === "PENDING_PAYMENT" || matchingOrder.status === "PARTIALLY_PAID") {
        quickReplies.push({
          label: "💳 View Bank Account",
          replyText: matchingOrder.accountNumber,
        });
      } else if (matchingOrder.status === "PAID" && !matchingOrder.deliveryAddress) {
        quickReplies.push({
          label: "📍 Send Address",
          replyText: "send address",
        });
      }
      quickReplies.push({ label: "🛍️ View Catalog", replyText: "catalog" });
      quickReplies.push({ label: "💬 Talk to Support", replyText: "talk to vendor" });

      await this.dispatchWhatsAppAndRecordChat({
        channel: "BUYER_SHOP_WA",
        toPhone: params.buyerPhone,
        text: trackingText,
        quickReplies: quickReplies.slice(0, 3),
        headerText: `Order #${matchingOrder.shortCode}`,
      });
      await this.broadcastStateChange();
      return { step: "ORDER_TRACKED", createdOrder: matchingOrder };
    }

    // 1. Category Browse Commands (e.g. "category fashion", "more in fashion", "browse kitchen")
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
        await this.dispatchWhatsAppAndRecordChat({
          channel: "BUYER_SHOP_WA",
          toPhone: params.buyerPhone,
          text: noCatMsg,
        });
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

      await this.dispatchWhatsAppAndRecordChat({
        channel: "BUYER_SHOP_WA",
        toPhone: params.buyerPhone,
        text: catMsg,
        imageUrl: matchedProducts[0]?.primaryImageUrl,
        quickReplies,
        headerText: "Category Catalog",
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
      await this.dispatchWhatsAppAndRecordChat({
        channel: "BUYER_SHOP_WA",
        toPhone: params.buyerPhone,
        text: clearMsg,
      });
      await this.broadcastStateChange();
      return { step: "UNMATCHED" };
    }

    const currentCart = this.getBuyerCart(params.buyerPhone);

    if (isCartView) {
      if (currentCart.length === 0) {
        const emptyMsg = "🛒 Your cart is currently empty.\nReply with an item name or SKU (e.g. *SHOE-01*) to start shopping!";
        await this.dispatchWhatsAppAndRecordChat({
          channel: "BUYER_SHOP_WA",
          toPhone: params.buyerPhone,
          text: emptyMsg,
        });
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
        ...(activeZones.length > 0
          ? [
              {
                label: `⚡ Checkout Now (${activeZones[0].name})`,
                replyText: activeZones[0].name,
              },
            ]
          : [{ label: "⚡ Checkout Now", replyText: "checkout" }]),
        ...activeZones.slice(1, 3).map((z) => ({
          label: `🚚 ${z.code}. ${z.name} (${formatNaira(z.feeKobo)})`,
          replyText: z.name,
        })),
        { label: "🛍️ More Items", replyText: "catalog" },
        { label: "🗑️ Clear Cart", replyText: "clear cart" },
      ];

      await this.dispatchWhatsAppAndRecordChat({
        channel: "BUYER_SHOP_WA",
        toPhone: params.buyerPhone,
        text: cartMsg,
        quickReplies,
        headerText: "Your Shopping Cart",
      });
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

    // CASE A0: Buyer is in `AWAITING_DELIVERY_ADDRESS` and sending their delivery address!
    if (existingSession && existingSession.state === "AWAITING_DELIVERY_ADDRESS" && !explicitlyMentionedProduct) {
      const order =
        (existingSession.activeOrderId ? this.orders.find((o) => o.id === existingSession.activeOrderId) : undefined) ||
        this.orders.slice().reverse().find((o) => o.customerPhone === params.buyerPhone && o.status === "PAID");

      if (order) {
        order.deliveryAddress = params.text.trim();
        await this.persistNow("saveDeliveryAddress", () => this.persistence.saveOrder(order));

        existingSession.state = "CART_ACTIVE";
        existingSession.updatedAt = new Date();

        const itemDisplay = order.variantName
          ? `${order.productName} (${order.variantName})`
          : order.productName;

        const confirmMsg = [
          `✅ *Delivery Address Saved!*`,
          `🧾 Order: *${order.shortCode}*`,
          `📦 Item: *${itemDisplay}*`,
          `🏠 Address: *${order.deliveryAddress}*`,
          `🚚 Delivery Zone: *${order.shippingZoneName}*`,
          ``,
          `🏪 We are preparing your package! You will receive another notification once your dispatch rider is on the way.`,
        ].join("\n");

        const quickReplies: QuickReplyOption[] = [
          { label: "🛒 Keep Shopping", replyText: "catalog" },
          { label: "💬 Chat with Vendor", replyText: "talk to vendor" },
        ];

        await this.dispatchWhatsAppAndRecordChat({
          channel: "BUYER_SHOP_WA",
          toPhone: params.buyerPhone,
          text: confirmMsg,
          quickReplies,
          headerText: "Address Confirmed",
        });

        this.appendChat({
          channel: "VENDOR_ADMIN_WA",
          sender: "CATERLOG_BOT",
          fromPhone: "CATERLOG",
          text: `📍 *Delivery Address Provided for ${order.shortCode}:*\n👤 ${order.customerName} (${order.customerPhone})\n🏠 *${order.deliveryAddress}* (${order.shippingZoneName})\n\n_Reply \`dispatch ${order.shortCode} <riderPhone>\` when handed to rider._`,
        });

        await this.broadcastStateChange();
        return { step: "INVOICE_CREATED", createdOrder: order };
      }
    }

    // CASE A1: Buyer is in `AWAITING_VARIANT` and just replied to choose a variant!
    if (existingSession && existingSession.state === "AWAITING_VARIANT" && !explicitlyMentionedProduct) {
      const activeProd = this.products.find((p) => p.id === existingSession.activeProductId);
      if (activeProd && activeProd.variants && activeProd.variants.length > 0) {
        const { variant } = this.findProductAndVariantInBuyerMessage(params.text, undefined, activeProd);
        if (variant) {
          const vAvail = variant.stockTotal - variant.stockReserved;
          if (vAvail <= 0) {
            const outMsg = `⚠️ Sorry, *${activeProd.name} — ${variant.name}* is currently Sold Out. Please select another option:`;
            await this.dispatchWhatsAppAndRecordChat({
              channel: "BUYER_SHOP_WA",
              toPhone: params.buyerPhone,
              text: outMsg,
            });
            await this.broadcastStateChange();
            return { step: "OUT_OF_STOCK" };
          }

          const parsedQty = this.extractQuantityFromText(params.text, false);
          // If buyer did NOT specify an explicit quantity in this reply nor earlier in session:
          if (parsedQty === undefined && existingSession.quantity === undefined) {
            existingSession.activeVariantId = variant.id;
            existingSession.state = "AWAITING_QUANTITY";
            existingSession.updatedAt = new Date();

            const { text: promptText, quickReplies } = this.buildQuantityPrompt(activeProd, variant, vAvail);
            await this.dispatchWhatsAppAndRecordChat({
              channel: "BUYER_SHOP_WA",
              toPhone: params.buyerPhone,
              text: promptText,
              imageUrl: activeProd.primaryImageUrl,
              quickReplies,
              headerText: "Select Quantity",
            });
            await this.broadcastStateChange();
            return { step: "PROMPTED_FOR_QUANTITY" };
          }

          const reqQty = parsedQty ?? existingSession.quantity ?? 1;
          if (vAvail < reqQty) {
            const outMsg = `⚠️ Sorry, *${activeProd.name} — ${variant.name}* only has ${Math.max(0, vAvail)} unit(s) available (you requested ${reqQty}). Please select another option:`;
            await this.dispatchWhatsAppAndRecordChat({
              channel: "BUYER_SHOP_WA",
              toPhone: params.buyerPhone,
              text: outMsg,
            });
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
          existingSession.quantity = reqQty;
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

          await this.dispatchWhatsAppAndRecordChat({
            channel: "BUYER_SHOP_WA",
            toPhone: params.buyerPhone,
            text: promptText,
            imageUrl: activeProd.primaryImageUrl,
            quickReplies,
            headerText: "Delivery Zone",
          });
          await this.broadcastStateChange();
          return { step: "PROMPTED_FOR_SHIPPING_ZONE" };
        }
      }
    }

    // CASE A1.5: Buyer is in `AWAITING_QUANTITY` and just replied with unit quantity!
    if (existingSession && existingSession.state === "AWAITING_QUANTITY" && !explicitlyMentionedProduct) {
      const activeProd = this.products.find((p) => p.id === existingSession.activeProductId);
      if (activeProd) {
        const activeVariant = activeProd.variants?.find((v) => v.id === existingSession.activeVariantId);
        const available = activeVariant
          ? activeVariant.stockTotal - activeVariant.stockReserved
          : activeProd.stockTotal - activeProd.stockReserved;
        const itemLabel = activeVariant ? `${activeProd.name} — ${activeVariant.name}` : activeProd.name;

        const parsedQty = this.extractQuantityFromText(params.text, true);
        if (parsedQty !== undefined) {
          if (available < parsedQty) {
            const outMsg = `⚠️ Sorry, *${itemLabel}* only has ${Math.max(0, available)} unit(s) available (you requested ${parsedQty}). Please select a lower quantity:`;
            const { quickReplies } = this.buildQuantityPrompt(activeProd, activeVariant, Math.max(0, available));
            await this.dispatchWhatsAppAndRecordChat({
              channel: "BUYER_SHOP_WA",
              toPhone: params.buyerPhone,
              text: outMsg,
              quickReplies,
            });
            await this.broadcastStateChange();
            return { step: "OUT_OF_STOCK" };
          }

          // Add to buyer's cart!
          this.addToBuyerCart(params.buyerPhone, {
            productId: activeProd.id,
            productSku: activeProd.skuCode,
            productName: activeProd.name,
            variantId: activeVariant?.id,
            variantSku: activeVariant?.skuCode,
            variantName: activeVariant?.name,
            quantity: parsedQty,
            unitPriceKobo: activeVariant?.priceKobo ?? activeProd.basePriceKobo,
          });

          const updatedCart = this.getBuyerCart(params.buyerPhone);
          const cartTotalKobo = updatedCart.reduce((sum, item) => sum + item.unitPriceKobo * BigInt(item.quantity), 0n);

          existingSession.quantity = parsedQty;
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
            `✅ Added: *${itemLabel}* (×${parsedQty})`,
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
            ...(activeProd.category
              ? [{ label: `📂 More in ${activeProd.category}`, replyText: `category ${activeProd.category}` }]
              : []),
            { label: "🛒 View Cart", replyText: "cart" },
          ];

          await this.dispatchWhatsAppAndRecordChat({
            channel: "BUYER_SHOP_WA",
            toPhone: params.buyerPhone,
            text: promptText,
            imageUrl: activeProd.primaryImageUrl,
            quickReplies,
            headerText: "Delivery Zone",
          });
          await this.broadcastStateChange();
          return { step: "PROMPTED_FOR_SHIPPING_ZONE" };
        } else {
          // Buyer sent unrecognized input while awaiting quantity
          const rePrompt = `🔢 Please enter how many units of *${itemLabel}* you'd like (e.g. 1, 2, 3), or tap an option below:`;
          const { quickReplies } = this.buildQuantityPrompt(activeProd, activeVariant, Math.max(0, available));
          await this.dispatchWhatsAppAndRecordChat({
            channel: "BUYER_SHOP_WA",
            toPhone: params.buyerPhone,
            text: rePrompt,
            quickReplies,
            headerText: "Select Quantity",
          });
          await this.broadcastStateChange();
          return { step: "PROMPTED_FOR_QUANTITY" };
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

    // 3. Direct Checkout / Payment Command (e.g. "checkout", "pay", "pay now", "order now", "make payment")
    const isDirectCheckout =
      /^(?:checkout|pay|pay\s+now|make\s+payment|order\s+now|transfer|proceed\s+to\s+(?:checkout|payment)|buy\s+now)$/i.test(
        trimmed
      ) ||
      /^checkout\s+/i.test(trimmed);

    if (isDirectCheckout && !explicitlyMentionedProduct) {
      let cartToCheckout = this.getBuyerCart(params.buyerPhone);
      if (cartToCheckout.length === 0 && existingSession?.activeProductId) {
        const prod = this.products.find((p) => p.id === existingSession.activeProductId);
        if (prod) {
          const vr = prod.variants?.find((v) => v.id === existingSession.activeVariantId);
          cartToCheckout = [
            {
              productId: prod.id,
              productSku: prod.skuCode,
              productName: prod.name,
              variantId: vr?.id,
              variantSku: vr?.skuCode,
              variantName: vr?.name,
              quantity: existingSession.quantity ?? 1,
              unitPriceKobo: vr?.priceKobo ?? prod.basePriceKobo,
            },
          ];
        }
      }

      if (cartToCheckout.length > 0) {
        const effectiveZone =
          matchedZone ??
          (activeZones.length > 0 ? activeZones[0] : undefined);

        if (!effectiveZone) {
          const noZoneMsg = "⚠️ Please set up at least one delivery zone in Settings before checking out.";
          await this.dispatchWhatsAppAndRecordChat({
            channel: "BUYER_SHOP_WA",
            toPhone: params.buyerPhone,
            text: noZoneMsg,
          });
          await this.broadcastStateChange();
          return { step: "UNMATCHED" };
        }

        this.buyerSessions.delete(params.buyerPhone);
        const discountCode = mentionedDiscount?.code ?? existingSession?.discountCode;
        const order = await this.finalizeOrderAndSendVirtualAccount({
          buyerPhone: params.buyerPhone,
          buyerName: params.buyerName,
          cartItems: cartToCheckout,
          shippingZone: effectiveZone,
          discountCode,
        });
        this.clearBuyerCart(params.buyerPhone);
        return {
          step: order ? "INVOICE_CREATED" : "OUT_OF_STOCK",
          createdOrder: order,
        };
      } else {
        const emptyMsg =
          "🛒 Your shopping cart is empty!\nReply with an item name or SKU (e.g. *SHOE-01*) to browse items.";
        await this.dispatchWhatsAppAndRecordChat({
          channel: "BUYER_SHOP_WA",
          toPhone: params.buyerPhone,
          text: emptyMsg,
        });
        await this.broadcastStateChange();
        return { step: "UNMATCHED" };
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

      const quickReplies: QuickReplyOption[] = [
        ...this.products
          .filter((p) => p.stockTotal - p.stockReserved > 0)
          .slice(0, 4)
          .map((p) => ({
            label: `🛍️ ${p.skuCode}: ${p.name} (${formatNaira(p.basePriceKobo)})`,
            replyText: `I want ${p.skuCode}`,
          })),
        { label: "💬 Chat with Vendor", replyText: "talk to vendor" },
      ];

      await this.dispatchWhatsAppAndRecordChat({
        channel: "BUYER_SHOP_WA",
        toPhone: params.buyerPhone,
        text: menuMsg,
        quickReplies,
        headerText: "Store Catalog",
      });
      await this.broadcastStateChange();
      return { step: "UNMATCHED" };
    }

    const explicitQty = this.extractQuantityFromText(params.text, false);

    // Check if the buyer message expresses direct checkout or add-to-cart intent
    // (e.g. mentions a delivery zone or begins with "add", "buy", "order", "i want to buy", etc.)
    const isDirectPurchaseIntent =
      Boolean(matchedZone) ||
      (explicitQty !== undefined && explicitQty > 1) ||
      /^(?:add(?:\s+to\s+cart)?|buy|order|purchase|i\s+(?:want|need)|checkout|send\s+me|i'll\s+take)\b/i.test(trimmed);

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

      quickReplies.push({
        label: "💬 Chat with Vendor",
        replyText: "talk to vendor",
      });

      if (product.variants && product.variants.length > 0) {
        this.buyerSessions.set(params.buyerPhone, {
          buyerPhone: params.buyerPhone,
          buyerName: params.buyerName,
          activeProductId: product.id,
          quantity: explicitQty,
          discountCode: mentionedDiscount?.code,
          state: "AWAITING_VARIANT",
          updatedAt: new Date(),
        });
      }

      await this.dispatchWhatsAppAndRecordChat({
        channel: "BUYER_SHOP_WA",
        toPhone: params.buyerPhone,
        text: promptText,
        imageUrl: product.primaryImageUrl,
        quickReplies,
        headerText: product.name.slice(0, 60),
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
        quantity: explicitQty,
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

      await this.dispatchWhatsAppAndRecordChat({
        channel: "BUYER_SHOP_WA",
        toPhone: params.buyerPhone,
        text: promptText,
        imageUrl: product.primaryImageUrl,
        quickReplies,
        headerText: product.name.slice(0, 60),
      });

      await this.broadcastStateChange();
      return { step: "PROMPTED_FOR_SHIPPING_ZONE" };
    }

    // IF VARIANT WAS SPECIFIED OR SIMPLE PRODUCT:
    const available = variant
      ? variant.stockTotal - variant.stockReserved
      : product.stockTotal - product.stockReserved;

    const itemLabel = variant ? `${product.name} (${variant.name})` : product.name;

    if (available <= 0) {
      const soldOutMsg = `😔 Sorry, *${itemLabel}* is currently *Sold Out* (0 available).`;
      await this.dispatchWhatsAppAndRecordChat({
        channel: "BUYER_SHOP_WA",
        toPhone: params.buyerPhone,
        text: soldOutMsg,
      });
      await this.broadcastStateChange();
      return { step: "OUT_OF_STOCK" };
    }

    const hasKnownQty = explicitQty !== undefined || existingSession?.quantity !== undefined;

    // Prompt for quantity if buyer has not specified units and hasn't given an instant delivery zone checkout
    if (!hasKnownQty && !matchedZone) {
      this.buyerSessions.set(params.buyerPhone, {
        buyerPhone: params.buyerPhone,
        buyerName: params.buyerName,
        activeProductId: product.id,
        activeVariantId: variant?.id,
        discountCode: mentionedDiscount?.code ?? existingSession?.discountCode,
        state: "AWAITING_QUANTITY",
        updatedAt: new Date(),
      });

      const { text: promptText, quickReplies } = this.buildQuantityPrompt(product, variant, available);
      await this.dispatchWhatsAppAndRecordChat({
        channel: "BUYER_SHOP_WA",
        toPhone: params.buyerPhone,
        text: promptText,
        imageUrl: product.primaryImageUrl,
        quickReplies,
        headerText: "Select Quantity",
      });
      await this.broadcastStateChange();
      return { step: "PROMPTED_FOR_QUANTITY" };
    }

    const quantity = explicitQty ?? existingSession?.quantity ?? 1;

    if (available < quantity) {
      const soldOutMsg = `⚠️ Only *${available}* unit(s) of *${itemLabel}* left in stock (you requested ${quantity}).`;
      await this.dispatchWhatsAppAndRecordChat({
        channel: "BUYER_SHOP_WA",
        toPhone: params.buyerPhone,
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

    await this.dispatchWhatsAppAndRecordChat({
      channel: "BUYER_SHOP_WA",
      toPhone: params.buyerPhone,
      text: promptText,
      imageUrl: product.primaryImageUrl,
      quickReplies,
      headerText: "Delivery Options",
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
        await this.dispatchWhatsAppAndRecordChat({
          channel: "BUYER_SHOP_WA",
          toPhone: params.buyerPhone,
          text: outMsg,
        });
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
            { name: "payment-reminder", payload: { orderShortCode: newOrder.shortCode, minutesRemaining: 5 } },
            { jobId: `reminder-${newOrder.shortCode}`, delayMs: reminderDelayMs }
          )
          .catch((err) =>
            console.error(
              `[caterlog:jobs] Failed to schedule payment reminder for ${newOrder.shortCode}:`,
              err
            )
          );
      }

      // 2-Minute Final Urgent Warning
      if (delayMs > 2 * 60_000) {
        const reminder2MinDelayMs = Math.max(0, delayMs - 2 * 60_000);
        void this.jobScheduler
          .schedule(
            { name: "payment-reminder-2min", payload: { orderShortCode: newOrder.shortCode } },
            { jobId: `reminder-2min-${newOrder.shortCode}`, delayMs: reminder2MinDelayMs }
          )
          .catch((err) =>
            console.error(
              `[caterlog:jobs] Failed to schedule 2-minute payment reminder for ${newOrder.shortCode}:`,
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

  private buildQuantityPrompt(
    product: RuntimeProduct,
    variant: RuntimeVariant | undefined,
    availableStock: number
  ): { text: string; quickReplies: QuickReplyOption[] } {
    const itemLabel = variant ? `${product.name} — ${variant.name}` : product.name;
    const itemSku = variant ? variant.skuCode : product.skuCode;
    const unitPrice = variant?.priceKobo !== undefined ? variant.priceKobo : product.basePriceKobo;

    const promptText = [
      `🔢 *How many units of ${itemLabel} would you like?*`,
      `📦 Item: *${itemLabel}* (\`${itemSku}\`)`,
      `💰 Price per unit: *${formatNaira(unitPrice)}*`,
      `🟢 In Stock: *${availableStock} unit(s) available*`,
      ``,
      `_Reply with the number of units (e.g. *1*, *2*, *3*) or tap an option below:_`,
    ].join("\n");

    const candidates = [1, 2, 3, 5].filter((q) => q <= availableStock);
    if (candidates.length === 0 && availableStock > 0) {
      candidates.push(availableStock);
    }
    const uniqueQtys = Array.from(new Set(candidates)).slice(0, 4);
    const quickReplies: QuickReplyOption[] = uniqueQtys.map((q) => ({
      label: `${q} unit${q > 1 ? "s" : ""}`,
      replyText: `${q} unit${q > 1 ? "s" : ""}`,
    }));

    return { text: promptText, quickReplies };
  }

  private extractQuantityFromText(text: string, allowBareNumber = false): number | undefined {
    const trimmed = text.trim();

    // 0. Bare number or number + unit when allowBareNumber is true (e.g. in AWAITING_QUANTITY: "2", "3", "2 units")
    if (allowBareNumber) {
      const bareMatch = trimmed.match(/^(\d+)(?:\s*(?:units?|pcs?|pieces?|items?|pairs?|x|please|pls)?)?$/i);
      if (bareMatch?.[1]) {
        const parsed = Number.parseInt(bareMatch[1], 10);
        if (parsed >= 1 && parsed <= 999) return parsed;
      }
    }

    // 1. Direct unit matches: "2 units", "3 pcs", "1 piece", "4 items", "2 pairs"
    let match = trimmed.match(/(?<![\w-])(\d+)\s*(?:units?|pcs?|pieces?|items?|pairs?|x)\b/i);

    // 2. Matches like "x 2", "qty 3", "quantity: 4", "qty: 2"
    if (!match) {
      match = trimmed.match(/(?:x|qty|quantity)\s*[:=]?\s*(\d+)/i);
    }
    // 3. Matches like "2 pcs", "3 pairs", "4 units", "2 of ...", "3 shoes", "2 items"
    if (!match) {
      match = trimmed.match(/(?<![\w-])(\d+)\s*(?:pcs|pieces|pairs|units|items|bags|shoes|of\b)/i);
    }
    // 4. Matches like "I want 3", "need 2", "order 3", "buy 2", "send 4", "add 2"
    if (!match) {
      match = trimmed.match(/\b(?:want|need|order|buy|send|add|take|gimme)\s+(\d+)\b/i);
    }
    // 5. Matches like "2 size 39", "3 size 40"
    if (!match) {
      match = trimmed.match(/(?<![\w-])(\d+)\s+(?:size|variant|color|colour)\b/i);
    }
    // 6. Matches like "size 39 (2)", "size 39 x2", "size 39 - 2 units"
    if (!match) {
      match = trimmed.match(/(?:size|variant)\s+[a-zA-Z0-9_-]+\s*[\(\-x]\s*(\d+)/i);
    }
    // 7. Direct prefix like "3x" or "2*"
    if (!match) {
      match = trimmed.match(/(?<![\w-])(\d+)\s*(?:x|\*)\b/i);
    }
    // 8. If message begins with number followed by product/variant name, e.g. "2 SHOE-01" or "3 Zara"
    if (!match) {
      match = trimmed.match(/^(\d+)\s+[a-zA-Z]/i);
    }

    if (match?.[1]) {
      const parsed = Number.parseInt(match[1], 10);
      if (parsed >= 1 && parsed <= 999) return parsed;
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

    const wasExpired = order.status === "EXPIRED" || Boolean(order.reservationReleased);

    // If order was expired, verify whether physical stock is still available before reviving!
    let isOversoldOnLatePayment = false;
    if (wasExpired && decision.nextStatus === "PAID") {
      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          const prod = this.products.find((p) => p.id === item.productId);
          if (prod) {
            const avail = item.variantId && prod.variants
              ? (prod.variants.find((v) => v.id === item.variantId)?.stockTotal ?? 0)
              : prod.stockTotal;
            if (avail < item.quantity) {
              isOversoldOnLatePayment = true;
              break;
            }
          } else {
            isOversoldOnLatePayment = true;
            break;
          }
        }
      } else {
        const prod = this.products.find((p) => p.id === order.productId);
        if (prod) {
          const avail = (order.variantId || order.variantSku) && prod.variants
            ? (prod.variants.find((v) => v.id === order.variantId || v.skuCode === order.variantSku)?.stockTotal ?? 0)
            : prod.stockTotal;
          if (avail < order.quantity) {
            isOversoldOnLatePayment = true;
          }
        } else {
          isOversoldOnLatePayment = true;
        }
      }
    }

    if (decision.nextStatus === "PAID") {
      order.paidAt = new Date();

      if (isOversoldOnLatePayment) {
        order.reservationReleased = true; // stock could not be secured
        const itemDisplay = order.variantName
          ? `${order.productName} (${order.variantName})`
          : order.productName;

        const oversoldBuyerMsg = [
          `⚠️ *PAYMENT RECEIVED FOR EXPIRED ORDER (${order.shortCode})*`,
          ``,
          `We received your transfer of *${formatNaira(decision.newAmountPaidKobo)}*, but this reservation had already expired and *${itemDisplay}* is now *Sold Out*.`,
          ``,
          `🏪 *What happens next:*`,
          `Our store team has been alerted immediately. The vendor will contact you shortly to either provide an alternative or issue an instant refund to your bank account.`,
          ``,
          `_Reply *talk to vendor* if you'd like to chat with the store owner right away._`,
        ].join("\n");

        const oversoldVendorAlert = [
          `🚨 *ACTION REQUIRED: Late Transfer on Expired Order (${order.shortCode})*`,
          `Buyer *${order.customerName}* (${order.customerPhone}) transferred *${formatNaira(decision.newAmountPaidKobo)}*, but this reservation had already expired and the item is now *SOLD OUT*!`,
          ``,
          `⚠️ *Action Needed:* Please contact customer at ${order.customerPhone} to arrange an alternative product or issue a refund.`,
        ].join("\n");

        await this.dispatchWhatsAppAndRecordChat({
          channel: "BUYER_SHOP_WA",
          toPhone: order.customerPhone,
          text: oversoldBuyerMsg,
          quickReplies: [
            { label: "💬 Chat with Vendor", replyText: "talk to vendor" },
            { label: "🛒 View Catalog", replyText: "catalog" },
          ],
          headerText: "Order Expired — Item Sold Out",
        });

        this.appendChat({
          channel: "VENDOR_ADMIN_WA",
          sender: "CATERLOG_BOT",
          fromPhone: "CATERLOG",
          text: oversoldVendorAlert,
        });
      } else {
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

        order.reservationReleased = false;

        const overpayNote =
          decision.overpaidAmountKobo > 0n
            ? `\n💚 *Overpayment:* ${formatNaira(decision.overpaidAmountKobo)} extra was received. The vendor will refund or credit it.`
            : "";

        const itemDisplay = order.variantName
          ? `${order.productName} (${order.variantName})`
          : order.productName;

        const buyerReceipt = [
          `✅ *Payment Confirmed!* (${formatNaira(decision.newAmountPaidKobo)})`,
          `🧾 Receipt: *${order.shortCode}*`,
          `📦 Item: *${itemDisplay}* ×${order.quantity}`,
          `🚚 Delivery Zone: *${order.shippingZoneName}*`,
          `🏪 Vendor: *${this.vendor.businessName}*`,
          overpayNote,
          wasExpired ? "\n💚 *Late Payment Accepted:* Your transfer was received after expiry, but we had stock available and have secured your order!" : "",
          ``,
          `📍 *Where should the rider deliver your package?*`,
          `Please reply with your full street address, nearest landmark, and contact phone number (e.g. *14 Admiralty Way, Lekki Phase 1*):`,
        ].filter(Boolean).join("\n");

        const vendorAlert = [
          `🔔 *PAID ORDER ${order.shortCode}!*`,
          `💰 Verified Transfer: *${formatNaira(decision.newAmountPaidKobo)}* from ${verified.payerName ?? order.customerName}`,
          `📦 Item: *${itemDisplay}* ×${order.quantity} (Remaining available stock: ${product ? product.stockTotal - product.stockReserved : 0})`,
          wasExpired ? "💚 *Late Payment Revived:* Stock was available and order was restored!" : "",
          overpayNote,
          ``,
          `_Reply \`dispatch ${order.shortCode} <riderPhone>\` when handed to rider._`,
        ].filter(Boolean).join("\n");

        await this.dispatchWhatsAppAndRecordChat({
          channel: "BUYER_SHOP_WA",
          toPhone: order.customerPhone,
          text: buyerReceipt,
          headerText: "Payment Confirmed",
        });

        this.appendChat({
          channel: "VENDOR_ADMIN_WA",
          sender: "CATERLOG_BOT",
          fromPhone: "CATERLOG",
          text: vendorAlert,
        });

        // Set buyer session awaiting delivery address
        this.buyerSessions.set(order.customerPhone, {
          buyerPhone: order.customerPhone,
          buyerName: order.customerName,
          activeOrderId: order.id,
          state: "AWAITING_DELIVERY_ADDRESS",
          updatedAt: new Date(),
        });
      }

      if (this.jobScheduler) {
        void this.jobScheduler.cancel(`expiry-${order.shortCode}`).catch(console.error);
        void this.jobScheduler.cancel(`reminder-${order.shortCode}`).catch(console.error);
        void this.jobScheduler.cancel(`reminder-2min-${order.shortCode}`).catch(console.error);
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

      if (this.jobScheduler) {
        const extDelayMs = 30 * 60 * 1000;
        void this.jobScheduler.cancel(`expiry-${order.shortCode}`).catch(console.error);
        void this.jobScheduler.cancel(`reminder-${order.shortCode}`).catch(console.error);
        void this.jobScheduler.cancel(`reminder-2min-${order.shortCode}`).catch(console.error);

        void this.jobScheduler.schedule(
          { name: "order-expiry", payload: { orderShortCode: order.shortCode } },
          { jobId: `expiry-${order.shortCode}`, delayMs: extDelayMs }
        );
        void this.jobScheduler.schedule(
          { name: "payment-reminder", payload: { orderShortCode: order.shortCode, minutesRemaining: 5 } },
          { jobId: `reminder-${order.shortCode}`, delayMs: extDelayMs - 5 * 60_000 }
        );
        void this.jobScheduler.schedule(
          { name: "payment-reminder-2min", payload: { orderShortCode: order.shortCode } },
          { jobId: `reminder-2min-${order.shortCode}`, delayMs: extDelayMs - 2 * 60_000 }
        );
      }
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
    const apiBase = (process.env.API_BASE_URL || "http://localhost:4000").replace(/\/+$/, "");
    const isLocalApi = /localhost|127\.0\.0\.1/i.test(apiBase);

    const catalogInputs: CatalogProductInput[] = [];
    const allSkusToKeep: string[] = [];

    for (const product of this.products) {
      let resolvedImageUrl = product.primaryImageUrl?.trim() || "";

      // 1. If image is stored in MediaStore (relative /api/v1/media/... or localhost URL), resolve its public URL!
      const mediaMatch = resolvedImageUrl.match(/\/api\/v1\/media\/([^/?#]+)/);
      if (mediaMatch?.[1]) {
        try {
          const publicMediaUrl = await mediaStore.getPublicUrl(decodeURIComponent(mediaMatch[1]));
          if (publicMediaUrl) {
            resolvedImageUrl = publicMediaUrl;
          }
        } catch {
          // If public resolution fails, continue below
        }
      }

      // 2. If it is a relative path and apiBase is public, prefix it
      if (resolvedImageUrl.startsWith("/") && !isLocalApi) {
        resolvedImageUrl = `${apiBase}${resolvedImageUrl}`;
      }

      // 3. Only if missing, not http(s), or unresolvable localhost, fall back to smart contextual photo
      if (
        !resolvedImageUrl ||
        !/^https?:\/\//i.test(resolvedImageUrl) ||
        (isLocalApi && /localhost|127\.0\.0\.1/i.test(resolvedImageUrl))
      ) {
        resolvedImageUrl = getSmartFallbackImage(product.name, product.category);
      }

      catalogInputs.push({
        skuCode: product.skuCode,
        name: product.name,
        description: product.description,
        basePriceKobo: product.basePriceKobo,
        stockAvailable: Math.max(0, product.stockTotal - product.stockReserved),
        primaryImageUrl: resolvedImageUrl,
        category: product.category,
        brand: this.vendor.businessName,
      });
      allSkusToKeep.push(product.skuCode);

      // If product has variants, also sync each variant with item_group_id so Content IDs match
      if (product.variants && product.variants.length > 0) {
        for (const variant of product.variants) {
          catalogInputs.push({
            skuCode: variant.skuCode,
            name: `${product.name} - ${variant.name}`,
            description: `${product.name} (${variant.name}) — ${product.description}`,
            basePriceKobo: variant.priceKobo ?? product.basePriceKobo,
            stockAvailable: Math.max(0, variant.stockTotal - variant.stockReserved),
            primaryImageUrl: resolvedImageUrl,
            category: product.category,
            brand: this.vendor.businessName,
            itemGroupId: product.skuCode,
          });
          allSkusToKeep.push(variant.skuCode);
        }
      }
    }

    const result = await this.catalog.syncProducts(catalogInputs, {
      deleteMissing: options.deleteMissing ?? true,
      existingSkus: allSkusToKeep,
    });

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

    const itemDisplay = ord.variantName
      ? `${ord.productName} (${ord.variantName})`
      : ord.productName;

    const expiryNotice = [
      `🛑 *ORDER EXPIRED — DO NOT PAY (Order ${ord.shortCode})*`,
      ``,
      `The payment hold for *${itemDisplay}* has expired and the reserved stock has been released.`,
      ``,
      `⚠️ *PLEASE DO NOT TRANSFER FUNDS TO THIS ACCOUNT:*`,
      `🏦 *Bank:* ${ord.bankName}`,
      `🔢 *Account Number:* *${ord.accountNumber}*`,
      ``,
      `This virtual account is now deactivated for Order ${ord.shortCode}. Transfers sent to an expired account may fail or require manual reversal.`,
      ``,
      `_Want to re-order? Reply with the item name (e.g. *${ord.productSku}*) or tap an option below to start a fresh checkout:_`,
    ].join("\n");

    const quickReplies: QuickReplyOption[] = [
      { label: `🛍️ Re-order ${ord.productSku}`, replyText: `I want ${ord.productSku}` },
      { label: "🛒 View Catalog", replyText: "catalog" },
      { label: "💬 Chat with Vendor", replyText: "talk to vendor" },
    ];

    await this.dispatchWhatsAppAndRecordChat({
      channel: "BUYER_SHOP_WA",
      toPhone: ord.customerPhone,
      text: expiryNotice,
      quickReplies,
      headerText: "Order Expired — Do Not Pay",
    });

    this.appendChat({
      channel: "VENDOR_ADMIN_WA",
      sender: "CATERLOG_BOT",
      fromPhone: "CATERLOG",
      text: `⌛ *Reservation Expired (${ord.shortCode}):* Stock hold for *${itemDisplay}* expired without payment. Expiry notice sent to buyer (${ord.customerPhone}).`,
    });

    if (this.jobScheduler) {
      void this.jobScheduler.cancel(`expiry-${ord.shortCode}`).catch(console.error);
      void this.jobScheduler.cancel(`reminder-${ord.shortCode}`).catch(console.error);
      void this.jobScheduler.cancel(`reminder-2min-${ord.shortCode}`).catch(console.error);
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
   * Supports standard reminder (e.g. 5 mins left) and urgent countdown (2 mins left).
   */
  public async sendPaymentReminder(
    shortCode: string,
    minutesRemaining = 5
  ): Promise<RuntimeOrder | undefined> {
    const ord = this.orders.find(
      (o) => o.shortCode.toUpperCase() === shortCode.trim().toUpperCase()
    );
    if (!ord || (ord.status !== "PENDING_PAYMENT" && ord.status !== "PARTIALLY_PAID")) {
      return undefined;
    }

    const remainingKobo =
      ord.totalAmountKobo > ord.amountPaidKobo ? ord.totalAmountKobo - ord.amountPaidKobo : 0n;
    if (remainingKobo <= 0n) return undefined;

    const isUrgent2Min = minutesRemaining <= 2;
    const itemDisplay = ord.variantName
      ? `${ord.productName} (${ord.variantName})`
      : ord.productName;

    const reminderText = isUrgent2Min
      ? [
          `⚠️ *URGENT: 2 MINUTES LEFT — Order ${ord.shortCode}*`,
          `Your reservation for *${itemDisplay}* will expire in *2 minutes*!`,
          ``,
          `💰 *Amount Due:* *${formatNaira(remainingKobo)}*`,
          `🏦 *Bank:* ${ord.bankName}`,
          `🔢 *Account No:* *${ord.accountNumber}*`,
          ``,
          `⏰ *Please complete your bank transfer now.* Once the 2-minute countdown ends, your stock reservation will be released and this payment account will close.`,
        ].join("\n")
      : [
          `⏰ *Payment Reminder — Order ${ord.shortCode}*`,
          `Your reserved items are currently being held, but your reservation is expiring soon.`,
          `💰 *Amount Remaining:* *${formatNaira(remainingKobo)}*`,
          `🏦 *Bank:* ${ord.bankName}`,
          `🔢 *Account No:* *${ord.accountNumber}*`,
          `_Transfer directly to this dedicated account to complete your order._`,
        ].join("\n");

    const quickReplies: QuickReplyOption[] = [
      { label: "💳 Copy Account Number", replyText: ord.accountNumber },
      { label: "🛒 View Cart", replyText: "cart" },
      { label: "💬 Chat with Vendor", replyText: "talk to vendor" },
    ];

    await this.dispatchWhatsAppAndRecordChat({
      channel: "BUYER_SHOP_WA",
      toPhone: ord.customerPhone,
      text: reminderText,
      quickReplies,
      headerText: isUrgent2Min ? "⚠️ 2-Min Expiry Warning" : "Payment Reminder",
    });

    await this.dispatchWhatsAppAndRecordChat({
      channel: "BUYER_SHOP_WA",
      toPhone: ord.customerPhone,
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
        : generateConsistentSku(name, input.category, this.products)
    ).toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(skuCode)) {
      throw new Error(
        "SKU must be 2-32 characters using letters, numbers, hyphens or underscores."
      );
    }

    const normalizedVariants = input.variants?.map((v, i) => {
      const cleanVariantSku = v.skuCode?.toUpperCase() || "";
      const expectedPrefix = `${skuCode}-`;
      const finalVariantSku = cleanVariantSku.startsWith(expectedPrefix)
        ? cleanVariantSku
        : `${skuCode}-${(cleanVariantSku || v.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 6) || String(i + 1)).toUpperCase()}`;
      return {
        ...v,
        skuCode: finalVariantSku,
      };
    });

    const resolvedImageUrl =
      input.primaryImageUrl && input.primaryImageUrl.trim() !== ""
        ? input.primaryImageUrl.trim()
        : "";

    let resolvedPhash = input.imagePhash;
    if (!resolvedPhash && resolvedImageUrl) {
      const mediaMatch = resolvedImageUrl.match(/\/api\/v1\/media\/([^/?#]+)/);
      if (mediaMatch?.[1]) {
        const cached = mediaStore.getMedia(decodeURIComponent(mediaMatch[1]));
        if (cached) resolvedPhash = cached.phash;
      }
      if (!resolvedPhash) {
        resolvedPhash = computeDeterministicImagePhash(`${skuCode}:${name}:${resolvedImageUrl.slice(0, 256)}`);
      }
    }
    if (!resolvedPhash) {
      resolvedPhash = computeDeterministicImagePhash(`${skuCode}:${name}`);
    }

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
      if (input.primaryImageUrl !== undefined) {
        existing.primaryImageUrl = resolvedImageUrl;
        existing.imagePhash = resolvedPhash;
      }
      if (input.variants) {
        existing.variants = normalizedVariants;
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
      category: input.category?.trim() || "General",
      basePriceKobo: input.basePriceKobo,
      primaryImageUrl: resolvedImageUrl,
      imagePhash: resolvedPhash,
      stockTotal: calculatedStock,
      stockReserved: 0,
      variants: normalizedVariants,
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
    imagePhash?: string;
    variants?: RuntimeProductVariant[];
  }): RuntimeProduct | undefined {
    const clean = skuCode.trim().toUpperCase();
    const existing = this.products.find((p) => p.skuCode.toUpperCase() === clean);
    if (!existing) return undefined;

    if (input.name) existing.name = input.name.trim();
    if (input.description !== undefined) existing.description = input.description.trim();
    if (input.category) existing.category = input.category.trim();
    if (input.basePriceKobo !== undefined && input.basePriceKobo > 0n) existing.basePriceKobo = input.basePriceKobo;
    if (input.primaryImageUrl !== undefined) {
      existing.primaryImageUrl = input.primaryImageUrl.trim();
      if (input.imagePhash) {
        existing.imagePhash = input.imagePhash;
      } else if (existing.primaryImageUrl) {
        const mediaMatch = existing.primaryImageUrl.match(/\/api\/v1\/media\/([^/?#]+)/);
        if (mediaMatch?.[1]) {
          const cached = mediaStore.getMedia(decodeURIComponent(mediaMatch[1]));
          if (cached) existing.imagePhash = cached.phash;
        }
      }
    }

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

    if (ord.status !== "OUT_FOR_DELIVERY") {
      assertValidOrderTransition(ord.status, "OUT_FOR_DELIVERY");
      ord.status = "OUT_FOR_DELIVERY";
    }

    if (riderPhone) {
      ord.riderPhone = riderPhone.trim();
    }
    ord.dispatchedAt = ord.dispatchedAt || new Date();

    const itemSummary =
      ord.items && ord.items.length > 0
        ? ord.items.map((i) => `• ${i.productName} ×${i.quantity}`).join("\n")
        : `• ${ord.productName} ×${ord.quantity || 1}`;

    const addressNotice = ord.deliveryAddress
      ? `\n📍 *Delivery Address:* ${ord.deliveryAddress}`
      : ord.shippingZoneName
        ? `\n📍 *Delivery Zone:* ${ord.shippingZoneName}`
        : "";

    const riderNotice = ord.riderPhone
      ? `\n🛵 *Dispatch Rider:* *${ord.riderPhone}*\n_The rider will call you upon arrival._`
      : `\n🛵 *Your package has been handed to our dispatch courier.*`;

    const dispatchNotice = [
      `🚚 *ORDER OUT FOR DELIVERY!*`,
      ``,
      `Hello *${ord.customerName}*, your order *#${ord.shortCode}* is on its way to you!`,
      ``,
      `📦 *Package Contents:*`,
      itemSummary,
      addressNotice,
      riderNotice,
      ``,
      `💬 Reply *status* or *track* at any time to monitor your delivery.`,
    ].join("\n");

    await this.dispatchWhatsAppAndRecordChat({
      channel: "BUYER_SHOP_WA",
      toPhone: ord.customerPhone,
      text: dispatchNotice,
      quickReplies: [
        { label: "📍 Track Order", replyText: `track ${ord.shortCode}` },
        { label: "🛍️ View Catalog", replyText: "catalog" },
      ],
      headerText: "Order Dispatched",
    });

    this.appendChat({
      channel: "VENDOR_ADMIN_WA",
      sender: "CATERLOG_BOT",
      fromPhone: "CATERLOG",
      text: `🚚 Order *#${ord.shortCode}* marked Out for Delivery!${ord.riderPhone ? ` (Rider: ${ord.riderPhone})` : ""} Customer (${ord.customerPhone}) notified on WhatsApp.`,
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
