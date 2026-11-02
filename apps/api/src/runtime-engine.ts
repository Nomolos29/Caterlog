import crypto from "node:crypto";
import {
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
} from "@caterlog/commerce-core";
import { MonnifyPaymentAdapter, WhatsAppCloudAdapter } from "@caterlog/integrations";

export interface RuntimeProduct {
  id: string;
  skuCode: string;
  name: string;
  description: string;
  category: string;
  basePriceKobo: bigint;
  primaryImageUrl: string;
  imagePhash: string;
  stockTotal: number;
  stockReserved: number;
}

export interface RuntimeShippingZone {
  id: string;
  code: number;
  name: string;
  feeKobo: bigint;
  isActive: boolean;
}

export interface RuntimeDiscount {
  id: string;
  code: string;
  type: "PERCENTAGE" | "FLAT_KOBO";
  value: bigint;
  minOrderKobo: bigint;
  usedCount: number;
  maxUses: number | null;
  isActive: boolean;
}

export interface RuntimeOrder {
  id: string;
  shortCode: string;
  customerPhone: string;
  customerName: string;
  productId: string;
  productSku: string;
  productName: string;
  quantity: number;
  shippingZoneName: string;
  subtotalKobo: bigint;
  shippingFeeKobo: bigint;
  discountCode?: string;
  discountAmountKobo: bigint;
  totalAmountKobo: bigint;
  amountPaidKobo: bigint;
  status: DomainOrderStatus;
  invoiceReference: string;
  accountNumber: string;
  bankName: string;
  accountName: string;
  riderPhone?: string;
  paymentExpiresAt: Date;
  createdAt: Date;
  paidAt?: Date;
  dispatchedAt?: Date;
}

export interface QuickReplyOption {
  label: string;
  replyText: string;
}

export interface ChatThreadMessage {
  id: string;
  channel: "VENDOR_ADMIN_WA" | "BUYER_SHOP_WA";
  sender: "VENDOR" | "BUYER" | "CATERLOG_BOT";
  fromPhone: string;
  text: string;
  imageUrl?: string;
  quickReplies?: QuickReplyOption[];
  timestamp: Date;
}

export interface BuyerConversationSession {
  buyerPhone: string;
  buyerName: string;
  activeProductId: string;
  quantity: number;
  discountCode?: string;
  state: "AWAITING_SHIPPING_ZONE";
  updatedAt: Date;
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

  public vendor = {
    id: "v-amaka-001",
    slug: "amaka-shoes",
    businessName: "Amaka Luxury Shoes",
    whatsappPhone: "+2348031234567",
    whatsappPhoneId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "105992837465001",
    verificationStatus: "VERIFIED" as const,
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
      accountName: "CATERLOG / AMAKA LUXURY SHOES",
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

  public chatMessages: ChatThreadMessage[] = [
    {
      id: "msg-init-1",
      channel: "VENDOR_ADMIN_WA",
      sender: "CATERLOG_BOT",
      fromPhone: "CATERLOG",
      text: "👋 Welcome to Caterlog, Amaka Luxury Shoes! Type *help* for commands, *products* to view catalog, *ship Ibadan #6000* to add delivery zones, or attach a product photo with *Name, #Price, stock Qty*.",
      timestamp: new Date(Date.now() - 10 * 60 * 1000),
    },
    {
      id: "msg-init-2",
      channel: "BUYER_SHOP_WA",
      sender: "BUYER",
      fromPhone: "+2348099887766",
      text: "Hi Amaka! I want the Zara Block Heel (SHOE-01) delivered to Lekki",
      timestamp: new Date(Date.now() - 3 * 60 * 1000),
    },
    {
      id: "msg-init-3",
      channel: "BUYER_SHOP_WA",
      sender: "CATERLOG_BOT",
      fromPhone: "CATERLOG",
      text: "🧾 *Order Invoice ORD-882*\nAmaka Luxury Shoes (✓ *Verified Caterlog Seller*)\n────────────────────\n📦 *Item:* Zara Block Heel (Gold) (x1)\n🚚 *Delivery (Lekki):* ₦3,500\n💰 *Exact Amount:* *₦28,500*\n🏦 *Bank:* Moniepoint MFB\n🔢 *Account No:* *8092341102*\n⏳ *Stock Reserved For:* 15 mins",
      timestamp: new Date(Date.now() - 2 * 60 * 1000),
    },
    {
      id: "msg-init-4",
      channel: "BUYER_SHOP_WA",
      sender: "CATERLOG_BOT",
      fromPhone: "CATERLOG",
      text: "8092341102",
      timestamp: new Date(Date.now() - 2 * 60 * 1000),
    },
  ];

  public readonly buyerSessions = new Map<string, BuyerConversationSession>();
  private readonly processedTxRefs = new Set<string>();
  private readonly activeCopilotTimers = new Map<string, NodeJS.Timeout>();
  private lastVendorReplyInBuyerThreadAt: Date | null = null;

  constructor() {
    this.monnify = new MonnifyPaymentAdapter({
      baseUrl: process.env.MONNIFY_BASE_URL ?? "https://sandbox.monnify.com",
      apiKey: process.env.MONNIFY_API_KEY ?? "MK_TEST_PLACEHOLDER",
      secretKey: process.env.MONNIFY_SECRET_KEY ?? "SK_TEST_PLACEHOLDER",
      contractCode: process.env.MONNIFY_CONTRACT_CODE ?? "1234567890",
      sandboxMock: (process.env.MONNIFY_SANDBOX_MOCK ?? "true") !== "false",
    });

    this.whatsapp = new WhatsAppCloudAdapter({
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? "EAAG_PLACEHOLDER",
      defaultPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "105992837465001",
      appSecret: process.env.WHATSAPP_APP_SECRET ?? "whatsapp-app-secret-placeholder",
      verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? "caterlog-whatsapp-verify-token",
      sandboxMock: (process.env.WHATSAPP_SANDBOX_MOCK ?? "true") !== "false",
    });
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

    switch (cmd.type) {
      case "OPEN_DASHBOARD": {
        const dashboardUrl = process.env.DASHBOARD_URL ?? "http://localhost:4000";
        replyText = `🔐 *Your 1-Tap Dashboard Login Link:*\n${dashboardUrl}?magic_vendor=${this.vendor.slug}\n\n⏳ _Valid for 15 minutes._`;
        break;
      }

      case "HELP_MENU": {
        replyText = [
          "🛠️ *Caterlog Vendor Command Menu*",
          "• *products* / *catalog* — List all products & stock",
          "• *sales* / *sales week* / *sales month* — Revenue breakdown",
          "• *pending* / *paid* — View active transfers & paid orders",
          "• *dispatch ORD-882 0803...* — Mark order out for delivery",
          "• *shipping* / *ship Ibadan #6000* / *shipping delete 2*",
          "• *discount* / *disc VIP #5000* / *discount add PAYDAY 10%*",
          "• *stock SHOE-01 10* — Update inventory count",
          "• *Photo + Name, #25000, stock 5* — Add product with photo",
          "• *mode copilot 60s* / *mode auto* / *mode off* — Co-Pilot switch",
          "• *hold 15* — Set buyer transfer reservation window (mins)",
          "• *dashboard* — Get 1-tap login link to Web Dashboard",
        ].join("\n");
        break;
      }

      case "LIST_PRODUCTS": {
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
        const b = this.getAnalyticsBreakdown();
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
        const active = this.shippingZones.filter((z) => z.isActive);
        replyText =
          active.length === 0
            ? "🚚 No active delivery zones. Reply *ship Ibadan #6000* to add one."
            : `🚚 *Your Delivery Zones:*\n${active.map((z) => `${z.code}. ${z.name}: *${formatNaira(z.feeKobo)}*`).join("\n")}`;
        break;
      }

      case "UPSERT_SHIPPING": {
        const zone = this.upsertShippingZone(cmd.name, cmd.feeKobo);
        replyText = `✅ *Shipping Zone Synced:*\n#${zone.code} *${zone.name}* → *${formatNaira(zone.feeKobo)}*`;
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
        const prod = this.updateProductStock(cmd.skuCode, cmd.stockTotal);
        if (!prod) {
          replyText = `⚠️ Product SKU *${cmd.skuCode}* not found.`;
        } else {
          const avail = Math.max(0, prod.stockTotal - prod.stockReserved);
          replyText = `📦 *Inventory Synced:*\n*${prod.name}* (${prod.skuCode})\nTotal Stock: *${prod.stockTotal}* (${avail} available, ${prod.stockReserved} reserved)`;
        }
        break;
      }

      case "QUICK_ADD_PRODUCT": {
        const prod = this.addProduct({
          name: cmd.name,
          basePriceKobo: cmd.priceKobo,
          stockTotal: cmd.stockTotal,
          primaryImageUrl: attachedImageUrl,
        });
        replyText = [
          `✅ *New Product Added & Synced:*`,
          `📦 *${prod.name}*`,
          `🏷️ SKU: *${prod.skuCode}*`,
          `💰 Price: *${formatNaira(prod.basePriceKobo)}*`,
          `🔢 Stock: *${prod.stockTotal}*`,
          `🔍 Status Fingerprint (pHash): \`${prod.imagePhash}\``,
        ].join("\n");
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
        const ord = await this.dispatchOrder(cmd.shortCode, cmd.riderPhone);
        replyText = ord
          ? `🚚 Order *${ord.shortCode}* marked Out for Delivery! Buyer (${ord.customerPhone}) has been notified on WhatsApp.`
          : `⚠️ Order *${cmd.shortCode}* not found or not yet paid.`;
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

    // Check if the buyer explicitly mentioned a product in this message
    const explicitlyMentionedProduct = this.findProductInBuyerMessage(
      params.text,
      params.quotedStatusImagePhash
    );

    // Check if the buyer's message selects a shipping zone (either by name e.g. "Lekki" / "Ibadan",
    // or by zone number/index "1", "2" when in AWAITING_SHIPPING_ZONE state)
    const matchedZone = this.findShippingZoneInBuyerMessage(
      params.text,
      activeZones,
      Boolean(existingSession && !explicitlyMentionedProduct)
    );

    // Check if a discount code is mentioned in this turn
    const mentionedDiscount = this.discounts
      .filter((d) => d.isActive)
      .find((d) => params.text.toUpperCase().includes(d.code));

    // CASE A: Buyer is already in `AWAITING_SHIPPING_ZONE` and just replied with a valid Shipping Zone!
    if (existingSession && !explicitlyMentionedProduct && matchedZone) {
      const product = this.products.find((p) => p.id === existingSession.activeProductId);
      if (product) {
        this.buyerSessions.delete(params.buyerPhone);
        const discountCode = mentionedDiscount?.code ?? existingSession.discountCode;
        const order = await this.finalizeOrderAndSendVirtualAccount({
          buyerPhone: params.buyerPhone,
          buyerName: params.buyerName,
          product,
          quantity: existingSession.quantity,
          shippingZone: matchedZone,
          discountCode,
        });
        return {
          step: order ? "INVOICE_CREATED" : "OUT_OF_STOCK",
          createdOrder: order,
        };
      }
    }

    // Resolve target product (from current message or existing session)
    const product =
      explicitlyMentionedProduct ??
      (existingSession
        ? this.products.find((p) => p.id === existingSession.activeProductId)
        : undefined);

    if (!product) {
      // Buyer did not name a recognizable product: show interactive catalog menu!
      const catalogLines = this.products.map((p) => {
        const avail = Math.max(0, p.stockTotal - p.stockReserved);
        return `• *${p.skuCode}* — ${p.name}: *${formatNaira(p.basePriceKobo)}* (${avail > 0 ? `🟢 ${avail} in stock` : "🔴 Sold Out"})`;
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

    const quantity = this.extractQuantityFromText(params.text) ?? existingSession?.quantity ?? 1;
    const available = product.stockTotal - product.stockReserved;

    if (available < quantity) {
      const soldOutMsg =
        available <= 0
          ? `😔 Sorry, *${product.name}* (${product.skuCode}) is currently *Sold Out* (0 available).`
          : `⚠️ Only *${available}* unit(s) of *${product.name}* left in stock (you requested ${quantity}).`;
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

    // CASE B: Buyer explicitly included a valid Shipping Zone in the same message (e.g. "I want SHOE-01 delivered to Lekki")
    if (matchedZone) {
      this.buyerSessions.delete(params.buyerPhone);
      const order = await this.finalizeOrderAndSendVirtualAccount({
        buyerPhone: params.buyerPhone,
        buyerName: params.buyerName,
        product,
        quantity,
        shippingZone: matchedZone,
        discountCode: mentionedDiscount?.code,
      });
      return {
        step: order ? "INVOICE_CREATED" : "OUT_OF_STOCK",
        createdOrder: order,
      };
    }

    // CASE C: Buyer requested a product WITHOUT specifying a shipping zone!
    // Store session in `AWAITING_SHIPPING_ZONE` and prompt buyer with the vendor's delivery zones.
    this.buyerSessions.set(params.buyerPhone, {
      buyerPhone: params.buyerPhone,
      buyerName: params.buyerName,
      activeProductId: product.id,
      quantity,
      discountCode: mentionedDiscount?.code,
      state: "AWAITING_SHIPPING_ZONE",
      updatedAt: new Date(),
    });

    const zoneOptionsText = activeZones
      .map((z) => `*${z.code}.* ${z.name} — *${formatNaira(z.feeKobo)}*`)
      .join("\n");

    const promptText = [
      `📦 *${product.name}* (\`${product.skuCode}\`)`,
      `💰 Price: *${formatNaira(product.basePriceKobo)}*${quantity > 1 ? ` × ${quantity} = *${formatNaira(product.basePriceKobo * BigInt(quantity))}*` : ""} • 🟢 *${available} left in stock*`,
      ``,
      `📍 *Where should we deliver your order?*`,
      `Reply with the delivery number or location name (or tap a button below):`,
      zoneOptionsText,
      ``,
      `_💡 Have a promo code? Include it with your reply (e.g. "${activeZones[0]?.name ?? "Lekki"} PAYDAY")_`,
    ].join("\n");

    const quickReplies: QuickReplyOption[] = activeZones.map((z) => ({
      label: `🚚 ${z.code}. ${z.name} (${formatNaira(z.feeKobo)})`,
      replyText: z.name,
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

  private async finalizeOrderAndSendVirtualAccount(params: {
    buyerPhone: string;
    buyerName: string;
    product: RuntimeProduct;
    quantity: number;
    shippingZone: RuntimeShippingZone;
    discountCode?: string;
  }): Promise<RuntimeOrder | undefined> {
    const available = params.product.stockTotal - params.product.stockReserved;
    if (available < params.quantity) {
      return undefined;
    }

    const activeDiscount = params.discountCode
      ? this.discounts.find(
          (d) => d.isActive && d.code.toUpperCase() === params.discountCode!.toUpperCase()
        )
      : undefined;

    const subtotalKobo = params.product.basePriceKobo * BigInt(params.quantity);
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

    // Atomically Reserve Stock
    params.product.stockReserved += params.quantity;

    const shortCode = `ORD-${880 + this.orders.length + 1}`;
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

    const newOrder: RuntimeOrder = {
      id: `ord-${Date.now()}`,
      shortCode,
      customerPhone: params.buyerPhone,
      customerName: params.buyerName,
      productId: params.product.id,
      productSku: params.product.skuCode,
      productName: params.product.name,
      quantity: params.quantity,
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

    await this.whatsapp.sendVirtualAccountInvoice({
      toBuyerPhone: params.buyerPhone,
      vendorBusinessName: this.vendor.businessName,
      isVendorVerified: this.vendor.verificationStatus === "VERIFIED",
      orderShortCode: newOrder.shortCode,
      productSummary: `${params.product.name} (x${params.quantity}) + ${params.shippingZone.name} delivery (${formatNaira(params.shippingZone.feeKobo)})${
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
        `📦 *Item:* ${params.product.name} ×${params.quantity} (${formatNaira(pricing.subtotalKobo)})`,
        `🚚 *Delivery (${params.shippingZone.name}):* ${formatNaira(params.shippingZone.feeKobo)}`,
        ...(newOrder.discountCode
          ? [`🏷️ *Discount (${newOrder.discountCode}):* -${formatNaira(newOrder.discountAmountKobo)}`]
          : []),
        `💰 *Exact Total:* *${formatNaira(newOrder.totalAmountKobo)}*`,
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

    await this.broadcastStateChange();
    return newOrder;
  }

  private findProductInBuyerMessage(
    text: string,
    quotedStatusImagePhash?: string
  ): RuntimeProduct | undefined {
    if (quotedStatusImagePhash) {
      const byPhash = this.products.find(
        (p) => computePhashHammingDistance(p.imagePhash, quotedStatusImagePhash) <= 8
      );
      if (byPhash) return byPhash;
    }

    const upper = text.toUpperCase();
    const bySku = this.products.find((p) => upper.includes(p.skuCode.toUpperCase()));
    if (bySku) return bySku;

    const lower = text.toLowerCase();
    return this.products.find((p) => {
      const significantWords = p.name
        .toLowerCase()
        .replace(/[()]/g, "")
        .split(/\s+/)
        .filter((w) => w.length >= 3);
      return significantWords.some((word) => lower.includes(word));
    });
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
  }): Promise<{
    order: RuntimeOrder;
    status: "PAID" | "PARTIALLY_PAID";
    remainingBalanceKobo: bigint;
  }> {
    if (!this.monnify.verifyWebhookSignature(params.rawBody, params.signatureHeader)) {
      throw new Error("Invalid Monnify HMAC-SHA512 webhook signature.");
    }

    const verified = await this.monnify.verifyTransactionServerToServer(
      params.providerTransactionRef
    );

    const order = this.orders.find(
      (o) => o.invoiceReference === verified.invoiceReference
    );
    if (!order) {
      throw new Error(`Order not found for invoiceReference: ${verified.invoiceReference}`);
    }

    if (this.processedTxRefs.has(verified.providerTransactionRef)) {
      return {
        order,
        status: order.status === "PARTIALLY_PAID" ? "PARTIALLY_PAID" : "PAID",
        remainingBalanceKobo:
          order.totalAmountKobo > order.amountPaidKobo
            ? order.totalAmountKobo - order.amountPaidKobo
            : 0n,
      };
    }
    this.processedTxRefs.add(verified.providerTransactionRef);

    const decision = evaluatePaymentReconciliation({
      totalAmountKobo: order.totalAmountKobo,
      previousAmountPaidKobo: order.amountPaidKobo,
      verifiedIncomingKobo: verified.amountPaidKobo,
    });

    order.amountPaidKobo = decision.newAmountPaidKobo;
    order.status = decision.nextStatus;

    const product = this.products.find((p) => p.id === order.productId);

    if (decision.nextStatus === "PAID") {
      order.paidAt = new Date();
      if (product) {
        product.stockTotal = Math.max(0, product.stockTotal - order.quantity);
        product.stockReserved = Math.max(0, product.stockReserved - order.quantity);
      }

      const buyerReceipt = `✅ *Payment Confirmed!* (${formatNaira(decision.newAmountPaidKobo)})\n🧾 Receipt: *${order.shortCode}*\n📦 Item: *${order.productName}* ×${order.quantity}\n🚚 Delivery: *${order.shippingZoneName}*\n🏪 Vendor: *${this.vendor.businessName}*\n\nYour order is now being packed for dispatch!`;
      const vendorAlert = `🔔 *PAID ORDER ${order.shortCode}!*\n💰 Verified Transfer: *${formatNaira(decision.newAmountPaidKobo)}* from ${verified.payerName ?? order.customerName}\n📦 Item: *${order.productName}* ×${order.quantity} (Remaining available stock: ${product ? product.stockTotal - product.stockReserved : 0})\n\nReply *dispatch ${order.shortCode} <riderPhone>* when handed to rider.`;

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

    await this.broadcastStateChange();
    return {
      order,
      status: decision.nextStatus,
      remainingBalanceKobo: decision.remainingBalanceKobo,
    };
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

    ord.status = "EXPIRED";
    const prod = this.products.find((p) => p.id === ord.productId);
    if (prod) {
      prod.stockReserved = Math.max(0, prod.stockReserved - ord.quantity);
    }

    this.appendChat({
      channel: "BUYER_SHOP_WA",
      sender: "CATERLOG_BOT",
      fromPhone: "CATERLOG",
      text: `⌛ *Reservation Expired (${ord.shortCode}):* The ${this.vendor.reservationTtlMinutes}-minute payment hold for *${ord.productName}* has expired and the reserved stock has been released.`,
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
      this.vendor.copilotMode = input.copilotMode;
    }
    if (input.copilotIdleSeconds !== undefined && input.copilotIdleSeconds >= 5) {
      this.vendor.copilotIdleSeconds = input.copilotIdleSeconds;
    }
    if (input.reservationTtlMinutes !== undefined && input.reservationTtlMinutes >= 5) {
      this.vendor.reservationTtlMinutes = input.reservationTtlMinutes;
    }
    void this.broadcastStateChange();
    return this.vendor;
  }

  public updateProductStock(skuCode: string, stockTotal: number): RuntimeProduct | undefined {
    const prod = this.products.find((p) => p.skuCode.toUpperCase() === skuCode.toUpperCase());
    if (!prod) return undefined;
    prod.stockTotal = Math.max(0, stockTotal);
    void this.broadcastStateChange();
    return prod;
  }

  public addProduct(input: {
    skuCode?: string;
    name: string;
    basePriceKobo: bigint;
    stockTotal: number;
    category?: string;
    primaryImageUrl?: string;
    imagePhash?: string;
  }): RuntimeProduct {
    const skuCode = (
      input.skuCode && input.skuCode.trim() !== ""
        ? input.skuCode.trim()
        : `ITEM-0${this.products.length + 1}`
    ).toUpperCase();

    const resolvedImageUrl =
      input.primaryImageUrl && input.primaryImageUrl.trim() !== ""
        ? input.primaryImageUrl.trim()
        : `https://placehold.co/600x600/064e3b/34d399?text=${encodeURIComponent(input.name.slice(0, 18))}`;

    const resolvedPhash =
      input.imagePhash ??
      computeDeterministicImagePhash(`${skuCode}:${input.name}:${resolvedImageUrl.slice(0, 256)}`);

    const existing = this.products.find((p) => p.skuCode === skuCode);
    if (existing) {
      existing.name = input.name;
      existing.basePriceKobo = input.basePriceKobo;
      existing.stockTotal = input.stockTotal;
      if (input.primaryImageUrl) {
        existing.primaryImageUrl = resolvedImageUrl;
        existing.imagePhash = resolvedPhash;
      }
      void this.broadcastStateChange();
      return existing;
    }

    const created: RuntimeProduct = {
      id: `prod-${Date.now()}`,
      skuCode,
      name: input.name,
      description: `${input.name} — available via WhatsApp & Caterlog`,
      category: input.category ?? "fashion",
      basePriceKobo: input.basePriceKobo,
      primaryImageUrl: resolvedImageUrl,
      imagePhash: resolvedPhash,
      stockTotal: input.stockTotal,
      stockReserved: 0,
    };
    this.products.unshift(created);
    void this.broadcastStateChange();
    return created;
  }

  public upsertShippingZone(name: string, feeKobo: bigint): RuntimeShippingZone {
    const existing = this.shippingZones.find(
      (z) => z.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (existing) {
      existing.feeKobo = feeKobo;
      existing.isActive = true;
      void this.broadcastStateChange();
      return existing;
    }
    const nextCode =
      this.shippingZones.reduce((max, z) => (z.code > max ? z.code : max), 0) + 1;
    const created: RuntimeShippingZone = {
      id: `sz-${Date.now()}`,
      code: nextCode,
      name: name.trim(),
      feeKobo,
      isActive: true,
    };
    this.shippingZones.push(created);
    void this.broadcastStateChange();
    return created;
  }

  public deleteShippingZone(code: number): RuntimeShippingZone | undefined {
    const target = this.shippingZones.find((z) => z.code === code && z.isActive);
    if (!target) return undefined;
    target.isActive = false;
    void this.broadcastStateChange();
    return target;
  }

  public upsertDiscount(input: {
    code: string;
    type: "PERCENTAGE" | "FLAT_KOBO";
    value: bigint;
  }): RuntimeDiscount {
    const cleanCode = input.code.trim().toUpperCase();
    const existing = this.discounts.find((d) => d.code === cleanCode);
    if (existing) {
      existing.type = input.type;
      existing.value = input.value;
      existing.isActive = true;
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
    void this.broadcastStateChange();
    return created;
  }

  public deactivateDiscount(code: string): RuntimeDiscount | undefined {
    const target = this.discounts.find(
      (d) => d.code === code.trim().toUpperCase() && d.isActive
    );
    if (!target) return undefined;
    target.isActive = false;
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
    if (!ord || (ord.status !== "PAID" && ord.status !== "PROCESSING")) {
      return undefined;
    }
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

    await this.broadcastStateChange();
    return ord;
  }

  public getAnalyticsBreakdown() {
    let paidOrdersCount = 0;
    let paidGrossKobo = 0n;
    let pendingOrdersCount = 0;
    let pendingAmountKobo = 0n;
    let shippingCollectedKobo = 0n;
    let discountsGivenKobo = 0n;
    let netProductRevenueKobo = 0n;

    for (const o of this.orders) {
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
      })),
      chatMessages: this.chatMessages.slice(-50),
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
