import {
  CopilotMode,
  DiscountType,
  getNeonPgPool,
  OrderStatus as PrismaOrderStatus,
  Prisma,
  prisma,
  SalesChannel,
  VerificationStatus,
} from "@caterlog/database";
import type { ServerVerifiedPaymentRecord } from "@caterlog/commerce-core";
import type {
  BuyerConversationSession,
  ChatThreadMessage,
  QuickReplyOption,
  RuntimeCartItem,
  RuntimeDiscount,
  RuntimeKycSubmission,
  RuntimeMarketBoostListing,
  RuntimeOrder,
  RuntimePaymentLink,
  RuntimePayoutWithdrawal,
  RuntimeProduct,
  RuntimeResellerMirror,
  RuntimeSettlementSplitRule,
  RuntimeShippingZone,
  RuntimeSnapshot,
  RuntimeSupplierCatalogProduct,
  RuntimeTeamMember,
  RuntimeVendor,
  RuntimeVendorNotification,
} from "../runtime-types.ts";
import type { PersistenceEvent, PersistenceStore } from "./types.ts";

/** Minimal structural shape of the joined rows the mapper needs. */
interface DbOrderRow {
  id: string;
  shortCode: string;
  subtotalKobo: bigint;
  shippingFeeKobo: bigint;
  discountCode: string | null;
  discountAmountKobo: bigint;
  totalAmountKobo: bigint;
  amountPaidKobo: bigint;
  overpaidAmountKobo: bigint;
  status: string;
  riderPhone: string | null;
  deliveryAddress: string | null;
  deliveryLandmark: string | null;
  alternatePhone: string | null;
  paymentTransactionRef: string | null;
  refundReference: string | null;
  refundedAmountKobo: bigint | null;
  refundReason: string | null;
  refundedAt: Date | null;
  reservationReleased: boolean;
  paymentExpiresAt: Date | null;
  createdAt: Date;
  paidAt: Date | null;
  dispatchedAt: Date | null;
  customer: { whatsappPhone: string; name: string | null };
  shippingZone: { name: string } | null;
  items: Array<{
    id: string;
    productId: string;
    variantId: string | null;
    productNameSnap: string;
    quantity: number;
    unitPriceKobo: bigint;
    lineTotalKobo: bigint;
    product: { skuCode: string };
    variant: { id: string; name: string; skuSuffix: string } | null;
  }>;
  invoices: Array<{
    invoiceReference: string;
    accountNumber: string;
    bankName: string;
    accountName: string;
  }>;
}

/**
 * PostgreSQL persistence for `DATA_MODE=database`.
 *
 * The runtime engine keeps an in-memory working set for fast domain logic; this
 * store hydrates it at boot and mirrors each mutation inside a Prisma
 * transaction so stock counters, orders, invoices and payment proofs stay durable.
 */
export class PrismaPersistenceStore implements PersistenceStore {
  public readonly mode = "database" as const;
  private vendorId: string | null = null;
  private readonly vendorSlug: string;

  constructor(vendorSlug: string) {
    this.vendorSlug = vendorSlug;
  }

  private async withRetry<T>(label: string, operation: () => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        return await operation();
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        const code = (err as { code?: string })?.code ?? "";
        const isTransient =
          code === "P1001" ||
          code === "P1002" ||
          code === "P1008" ||
          code === "P1017" ||
          code === "P2024" ||
          code === "P2028" ||
          /Can't reach database server|Closed|timed out|expired transaction|Connection terminated|ECONNRESET/i.test(
            msg
          );
        if (!isTransient || attempt === 4) {
          throw err;
        }
        console.warn(
          `[caterlog:persistence] Transient DB error in ${label} (attempt ${attempt}/4, code=${code || "none"}), retrying...`
        );
        try {
          await getNeonPgPool().query("SELECT 1");
        } catch {
          // Ignore warmup error and wait before next attempt
        }
        await new Promise((r) => setTimeout(r, 600 * attempt));
      }
    }
    throw lastErr;
  }

  private async fetchVendorSnapshotRow() {
    return prisma.vendor.findUnique({
      where: { slug: this.vendorSlug },
      include: {
        products: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
          include: { variants: true },
        },
        shippingZones: { where: { isActive: true }, orderBy: { code: "asc" } },
        discounts: { where: { isActive: true }, orderBy: { startsAt: "desc" } },
        orders: {
          orderBy: { createdAt: "desc" },
          take: 200,
          include: {
            customer: true,
            shippingZone: true,
            items: { include: { product: true, variant: true } },
            invoices: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
        chatMessages: {
          orderBy: { createdAt: "asc" },
          take: 200,
        },
        chatSessions: {
          orderBy: { updatedAt: "desc" },
          take: 50,
        },
        marketBoostListing: true,
        resellerMirrors: {
          include: { supplier: true },
          orderBy: { lastSyncedAt: "desc" },
        },
        paymentLinks: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
          take: 100,
        },
        payoutWithdrawals: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        settlementSplitRules: {
          orderBy: { updatedAt: "desc" },
        },
        kycSubmissions: {
          orderBy: { submittedAt: "desc" },
          take: 10,
        },
        teamMembers: {
          orderBy: { invitedAt: "asc" },
        },
        notifications: {
          where: { isDismissed: false },
          orderBy: { createdAt: "desc" },
          take: 100,
        },
        commerceEvents: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });
  }

  public async loadSnapshot(_vendorSlug: string): Promise<RuntimeSnapshot | null> {
    // Wake up Neon serverless compute via pg Pool (ipv4first, 30s timeout) before Prisma query
    try {
      await getNeonPgPool().query("SELECT 1");
    } catch {
      // Proceed to Prisma retry loop
    }

    let vendor: Awaited<ReturnType<typeof this.fetchVendorSnapshotRow>> = null;
    let processed: Array<{ providerTransactionRef: string }> = [];
    let allSuppliers: Awaited<ReturnType<typeof prisma.supplierProfile.findMany>> = [];
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        // Purge any legacy soft-deleted (`isActive = false`) products that have no order history
        // so the PostgreSQL `Product` table count matches the active Dashboard catalog 1-to-1.
        await prisma.product.deleteMany({
          where: {
            isActive: false,
            orderItems: { none: {} },
            reservations: { none: {} },
          },
        });
        vendor = await this.fetchVendorSnapshotRow();
        if (vendor) {
          processed = await prisma.paymentTransaction.findMany({
            where: { invoice: { order: { vendorId: vendor.id } } },
            select: { providerTransactionRef: true },
          });
          allSuppliers = await prisma.supplierProfile.findMany({
            orderBy: { rating: "desc" },
          });
        }
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
    if (lastErr) throw lastErr;

    if (!vendor) return null;
    this.vendorId = vendor.id;

    return {
      vendor: {
        id: vendor.id,
        slug: vendor.slug,
        businessName: vendor.businessName,
        role: (vendor.role === "supplier" ? "supplier" : "reseller") as "reseller" | "supplier",
        whatsappPhone: vendor.whatsappPhone,
        whatsappPhoneId: vendor.whatsappPhoneId ?? "",
        verificationStatus: mapVerificationStatus(vendor.verificationStatus),
        copilotMode: vendor.copilotMode,
        copilotIdleSeconds: vendor.copilotIdleSeconds,
        reservationTtlMinutes: vendor.reservationTtlMinutes,
        bankCode: vendor.settlementBankCode ?? undefined,
        bankName: vendor.settlementBankName ?? undefined,
        bankAccountNumber: vendor.settlementAccountNum ?? undefined,
        bankAccountName: vendor.settlementAccountName ?? undefined,
        monnifySubAccountCode: vendor.monnifySubAccountCode ?? undefined,
        cacNumber: vendor.cacNumber ?? undefined,
        tinNumber: vendor.tinNumber ?? undefined,
        instagramHandle: vendor.instagramHandle ?? undefined,
        baseState: vendor.baseState ?? "Lagos",
        baseCity: vendor.baseCity ?? "Ikeja",
      },
      products: vendor.products.map((product) => ({
        id: product.id,
        skuCode: product.skuCode,
        name: product.name,
        description: product.description ?? "",
        category: product.category ?? "",
        basePriceKobo: product.basePriceKobo,
        primaryImageUrl: product.primaryImageUrl,
        imagePhash: product.imagePhash ?? "",
        stockTotal: product.stockTotal,
        stockReserved: product.stockReserved,
        customFields:
          product.customFields && typeof product.customFields === "object" && !Array.isArray(product.customFields)
            ? (product.customFields as Record<string, string>)
            : undefined,
        variants: product.variants?.map((v) => ({
          id: v.id,
          name: v.name,
          skuCode: `${product.skuCode}-${v.skuSuffix}`,
          priceKobo: v.priceKobo ?? undefined,
          stockTotal: v.stockTotal,
          stockReserved: v.stockReserved,
        })),
      })),
      shippingZones: vendor.shippingZones.map((zone) => ({
        id: zone.id,
        code: zone.code,
        name: zone.name,
        feeKobo: zone.feeKobo,
        isActive: zone.isActive,
      })),
      discounts: vendor.discounts.map((discount) => ({
        id: discount.id,
        code: discount.code,
        type: discount.type,
        value: discount.value,
        minOrderKobo: discount.minOrderKobo,
        usedCount: discount.usedCount,
        maxUses: discount.maxUses,
        expiresAt: discount.expiresAt ?? undefined,
        isActive: discount.isActive,
      })),
      orders: vendor.orders.map((order) => this.mapOrder(order)),
      processedTransactionRefs: processed.map((row) => row.providerTransactionRef),
      chatMessages: vendor.chatMessages.map((msg) => ({
        id: msg.id,
        channel: (msg.channel === "VENDOR_ADMIN_WA" ? "VENDOR_ADMIN_WA" : "BUYER_SHOP_WA") as ChatThreadMessage["channel"],
        sender: (msg.sender === "VENDOR" || msg.sender === "BUYER" ? msg.sender : "CATERLOG_BOT") as ChatThreadMessage["sender"],
        fromPhone: msg.fromPhone,
        text: msg.text,
        imageUrl: msg.imageUrl ?? undefined,
        quickReplies: Array.isArray(msg.quickReplies)
          ? (msg.quickReplies as unknown as QuickReplyOption[])
          : undefined,
        timestamp: msg.createdAt,
      })),
      buyerSessions: vendor.chatSessions
        .filter((s) => s.conversationState !== "IDLE")
        .map((s) => ({
          buyerPhone: s.buyerWhatsappPhone,
          buyerName: s.buyerName ?? s.buyerWhatsappPhone,
          activeProductId: s.activeProductId ?? undefined,
          activeVariantId: s.activeVariantId ?? undefined,
          activeOrderId: s.activeOrderId ?? undefined,
          quantity: s.quantity ?? undefined,
          discountCode: s.discountCode ?? undefined,
          cart: Array.isArray(s.cartItems) ? (s.cartItems as unknown as RuntimeCartItem[]) : undefined,
          state: (s.conversationState as BuyerConversationSession["state"]) || "AWAITING_QUANTITY",
          assistanceInquiry: s.assistanceInquiry ?? undefined,
          assistanceRequestedAt: s.assistanceRequestedAt ?? undefined,
          copilotPaused: s.copilotPaused,
          updatedAt: s.updatedAt,
        })),
      marketBoostListing: vendor.marketBoostListing
        ? {
            id: vendor.marketBoostListing.id,
            vendorId: vendor.marketBoostListing.vendorId,
            isPublished: vendor.marketBoostListing.isPublished,
            businessName: vendor.marketBoostListing.businessName,
            category: vendor.marketBoostListing.category,
            baseState: vendor.marketBoostListing.baseState,
            baseCity: vendor.marketBoostListing.baseCity,
            shippingScope: (vendor.marketBoostListing.shippingScope as RuntimeMarketBoostListing["shippingScope"]) || "LOCAL_STATE",
            allowInterstate: vendor.marketBoostListing.allowInterstate,
            coveredStates: Array.isArray(vendor.marketBoostListing.coveredStates)
              ? (vendor.marketBoostListing.coveredStates as string[])
              : [vendor.marketBoostListing.baseState],
            description: vendor.marketBoostListing.description ?? "",
            moq: vendor.marketBoostListing.moq,
            startingPriceKobo: vendor.marketBoostListing.startingPriceKobo,
            fulfillmentMethod: vendor.marketBoostListing.fulfillmentMethod,
            deliveryNote: vendor.marketBoostListing.deliveryNote ?? "",
            featuredTags: Array.isArray(vendor.marketBoostListing.featuredTags)
              ? (vendor.marketBoostListing.featuredTags as string[])
              : [],
            mirroredCategories: Array.isArray((vendor.marketBoostListing as any).mirroredCategories)
              ? ((vendor.marketBoostListing as any).mirroredCategories as string[])
              : [],
            mirroredProductSkus: Array.isArray((vendor.marketBoostListing as any).mirroredProductSkus)
              ? ((vendor.marketBoostListing as any).mirroredProductSkus as string[])
              : [],
            wholesaleDiscountRules: Array.isArray((vendor.marketBoostListing as any).wholesaleDiscountRules)
              ? ((vendor.marketBoostListing as any).wholesaleDiscountRules as RuntimeMarketBoostListing["wholesaleDiscountRules"])
              : [],
            subscriptionPlan: (vendor.marketBoostListing.subscriptionPlan as RuntimeMarketBoostListing["subscriptionPlan"]) || "STARTER",
            updatedAt: vendor.marketBoostListing.updatedAt,
          }
        : null,
      suppliers: allSuppliers.map((sup) => ({
        id: sup.id,
        slug: sup.slug,
        name: sup.name,
        verified: sup.verified,
        cacNumber: sup.cacNumber ?? "",
        category: sup.category,
        location: sup.location,
        state: sup.state,
        shippingScope: (sup.shippingScope as "LOCAL_STATE" | "SELECTED_STATES" | "NATIONWIDE") || "LOCAL_STATE",
        allowInterstate: sup.allowInterstate,
        coveredStates: Array.isArray(sup.coveredStates) ? (sup.coveredStates as string[]) : [sup.state],
        warehouseAddress: sup.warehouseAddress ?? sup.location,
        phone: sup.phone,
        whatsapp: sup.whatsapp,
        rating: sup.rating,
        totalFulfilled: sup.totalFulfilled,
        subAccountCode: sup.subAccountCode ?? "",
        leadTime: sup.leadTime ?? "Same-Day Dispatch",
        cutoffTime: sup.cutoffTime ?? "3:00 PM WAT",
        wholesaleTerms: Array.isArray(sup.wholesaleTerms) ? (sup.wholesaleTerms as string[]) : [],
        catalogProducts: Array.isArray(sup.catalogProducts)
          ? (sup.catalogProducts as unknown as RuntimeSupplierCatalogProduct[])
          : [],
      })),
      resellerMirrors: vendor.resellerMirrors.map((m) => ({
        id: m.id,
        resellerVendorId: m.resellerVendorId,
        supplierId: m.supplierId,
        supplierSlug: m.supplier?.slug,
        supplierName: m.supplier?.name,
        mirroredProductSkus: Array.isArray(m.mirroredProductSkus)
          ? (m.mirroredProductSkus as string[])
          : [],
        defaultMarkupBps: m.defaultMarkupBps,
        status: (m.status === "PAUSED" ? "PAUSED" : "ACTIVE") as "ACTIVE" | "PAUSED",
        lastSyncedAt: m.lastSyncedAt,
      })),
      paymentLinks: vendor.paymentLinks.map((pl) => ({
        id: pl.id,
        slug: pl.slug,
        customerName: pl.customerName ?? undefined,
        customerPhone: pl.customerPhone ?? undefined,
        productSku: pl.productSku ?? undefined,
        description: pl.description ?? undefined,
        amountKobo: pl.amountKobo,
        checkoutUrl: pl.checkoutUrl,
        isActive: pl.isActive,
        timesUsed: pl.timesUsed,
        expiresAt: pl.expiresAt ?? undefined,
        createdAt: pl.createdAt,
      })),
      payoutWithdrawals: vendor.payoutWithdrawals.map((pw) => ({
        id: pw.id,
        reference: pw.reference,
        amountKobo: pw.amountKobo,
        feeKobo: pw.feeKobo,
        netAmountKobo: pw.netAmountKobo,
        bankCode: pw.bankCode ?? undefined,
        bankName: pw.bankName,
        accountNumber: pw.accountNumber,
        accountName: pw.accountName ?? undefined,
        status: (pw.status as RuntimePayoutWithdrawal["status"]) || "DISPATCHED",
        verifiedByOtp: pw.verifiedByOtp,
        createdAt: pw.createdAt,
        settledAt: pw.settledAt ?? undefined,
      })),
      settlementSplitRules: vendor.settlementSplitRules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        supplierSubAccountCode: rule.supplierSubAccountCode ?? undefined,
        supplierShareBps: rule.supplierShareBps,
        resellerShareBps: rule.resellerShareBps,
        platformFeeBps: rule.platformFeeBps,
        isActive: rule.isActive,
        updatedAt: rule.updatedAt,
      })),
      kycSubmissions: vendor.kycSubmissions.map((kyc) => ({
        id: kyc.id,
        businessName: kyc.businessName,
        cacNumber: kyc.cacNumber,
        tinNumber: kyc.tinNumber ?? undefined,
        businessAddress: kyc.businessAddress ?? undefined,
        businessCategory: kyc.businessCategory ?? undefined,
        bankCode: kyc.bankCode,
        bankName: kyc.bankName ?? undefined,
        accountNumber: kyc.accountNumber,
        resolvedAccountName: kyc.resolvedAccountName,
        whatsappPhone: kyc.whatsappPhone ?? undefined,
        instagramHandle: kyc.instagramHandle ?? undefined,
        cacDocumentUploaded: kyc.cacDocumentUploaded,
        idDocumentUploaded: kyc.idDocumentUploaded,
        status: kyc.status as RuntimeKycSubmission["status"],
        reviewerNotes: kyc.reviewerNotes ?? undefined,
        submittedAt: kyc.submittedAt,
        reviewedAt: kyc.reviewedAt ?? undefined,
      })),
      teamMembers: vendor.teamMembers.map((tm) => ({
        id: tm.id,
        name: tm.name,
        email: tm.email,
        phone: tm.phone ?? undefined,
        role: tm.role,
        status: (tm.status as RuntimeTeamMember["status"]) || "Active",
        canManageOrders: tm.canManageOrders,
        canManageInventory: tm.canManageInventory,
        canViewPayouts: tm.canViewPayouts,
        canProcessRefunds: tm.canProcessRefunds,
        canOverrideCopilot: tm.canOverrideCopilot,
        lastActiveAt: tm.lastActiveAt ?? undefined,
        invitedAt: tm.invitedAt,
      })),
      notifications: vendor.notifications.map((n) => ({
        id: n.id,
        notificationKey: n.notificationKey,
        title: n.title,
        message: n.message,
        category: (n.category as RuntimeVendorNotification["category"]) || "ORDERS",
        isRead: n.isRead,
        isDismissed: n.isDismissed,
        linkText: n.linkText ?? undefined,
        targetView: n.targetView ?? undefined,
        targetRef: n.targetRef ?? undefined,
        createdAt: n.createdAt,
        readAt: n.readAt ?? undefined,
      })),
      commerceEvents: vendor.commerceEvents.map((ev) => ({
        id: ev.id,
        eventType: ev.eventType,
        actorType: ev.actorType,
        entityType: ev.entityType,
        entityId: ev.entityId,
        payload:
          ev.payload && typeof ev.payload === "object" && !Array.isArray(ev.payload)
            ? (ev.payload as Record<string, unknown>)
            : {},
        createdAt: ev.createdAt,
      })),
    };
  }

  public async saveVendor(vendor: RuntimeVendor): Promise<void> {
    await this.withRetry("saveVendor", async () => {
      const vendorId = await this.requireVendorId();
      await prisma.vendor.update({
        where: { id: vendorId },
        data: {
          businessName: vendor.businessName,
          role: vendor.role === "supplier" ? "supplier" : "reseller",
          whatsappPhone: vendor.whatsappPhone,
          whatsappPhoneId: vendor.whatsappPhoneId || null,
          copilotMode: vendor.copilotMode as CopilotMode,
          copilotIdleSeconds: vendor.copilotIdleSeconds,
          reservationTtlMinutes: vendor.reservationTtlMinutes,
          verificationStatus: mapRuntimeVerificationStatus(vendor.verificationStatus),
          settlementBankCode: vendor.bankCode || null,
          settlementBankName: vendor.bankName || null,
          settlementAccountNum: vendor.bankAccountNumber || null,
          settlementAccountName: vendor.bankAccountName || null,
          monnifySubAccountCode: vendor.monnifySubAccountCode || null,
          cacNumber: vendor.cacNumber || null,
          tinNumber: vendor.tinNumber || null,
          instagramHandle: vendor.instagramHandle || null,
          baseState: vendor.baseState || "Lagos",
          baseCity: vendor.baseCity || "Ikeja",
        },
      });
    });
  }

  public async saveProduct(product: RuntimeProduct): Promise<void> {
    await this.withRetry("saveProduct", async () => {
      const vendorId = await this.requireVendorId();
      const skuCode = product.skuCode.toUpperCase();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        product.id
      );
      const data = {
        name: product.name,
        description: product.description || null,
        category: product.category || null,
        basePriceKobo: product.basePriceKobo,
        primaryImageUrl:
          product.primaryImageUrl || "https://placehold.co/600x600?text=Product",
        imagePhash: product.imagePhash || null,
        customFields: product.customFields ? toJson(product.customFields) : Prisma.JsonNull,
        stockTotal: product.stockTotal,
        stockReserved: product.stockReserved,
        isActive: true,
      };

      const upserted = await prisma.product.upsert({
        where: { vendorId_skuCode: { vendorId, skuCode } },
        create: { ...(isUuid ? { id: product.id } : {}), vendorId, skuCode, ...data },
        update: data,
      });
      product.id = upserted.id;

      if (product.variants && product.variants.length > 0) {
        const activeSuffixes: string[] = [];
        for (const v of product.variants) {
          const skuSuffix = v.skuCode.startsWith(`${skuCode}-`)
            ? v.skuCode.slice(skuCode.length + 1)
            : v.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toUpperCase() || "VAR";
          activeSuffixes.push(skuSuffix);
          const isVarUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            v.id
          );

          const upsertedVar = await prisma.productVariant.upsert({
            where: {
              productId_skuSuffix: {
                productId: upserted.id,
                skuSuffix,
              },
            },
            create: {
              ...(isVarUuid ? { id: v.id } : {}),
              productId: upserted.id,
              name: v.name,
              skuSuffix,
              priceKobo: v.priceKobo ?? null,
              stockTotal: v.stockTotal,
              stockReserved: v.stockReserved,
            },
            update: {
              name: v.name,
              priceKobo: v.priceKobo ?? null,
              stockTotal: v.stockTotal,
              stockReserved: v.stockReserved,
            },
          });
          v.id = upsertedVar.id;
        }

        await prisma.productVariant.deleteMany({
          where: {
            productId: upserted.id,
            skuSuffix: { notIn: activeSuffixes },
          },
        });
      } else {
        await prisma.productVariant.deleteMany({
          where: { productId: upserted.id },
        });
      }
    });
  }

  public async deleteProduct(skuCode: string): Promise<void> {
    await this.withRetry("deleteProduct", async () => {
      const vendorId = await this.requireVendorId();
      const targetSku = skuCode.toUpperCase();
      const existing = await prisma.product.findUnique({
        where: { vendorId_skuCode: { vendorId, skuCode: targetSku } },
        include: {
          _count: {
            select: { orderItems: true, reservations: true },
          },
        },
      });
      if (!existing) return;

      if (existing._count.orderItems === 0 && existing._count.reservations === 0) {
        // Hard-delete from PostgreSQL so the database table and Dashboard match 1-to-1
        await prisma.product.delete({
          where: { id: existing.id },
        });
      } else {
        // If historical orders reference this product, clear its reservations/items or mark inactive
        await prisma.stockReservation.deleteMany({ where: { productId: existing.id } });
        await prisma.orderItem.deleteMany({ where: { productId: existing.id } });
        await prisma.product.delete({
          where: { id: existing.id },
        });
      }
    });
  }

  public async saveShippingZone(zone: RuntimeShippingZone): Promise<void> {
    await this.withRetry("saveShippingZone", async () => {
      const vendorId = await this.requireVendorId();
      const data = {
        code: zone.code,
        feeKobo: zone.feeKobo,
        isActive: zone.isActive,
      };
      const upserted = await prisma.shippingZone.upsert({
        where: { vendorId_name: { vendorId, name: zone.name } },
        create: { vendorId, name: zone.name, ...data },
        update: data,
      });
      zone.id = upserted.id;
    });
  }

  public async saveDiscount(discount: RuntimeDiscount): Promise<void> {
    await this.withRetry("saveDiscount", async () => {
      const vendorId = await this.requireVendorId();
      const data = {
        type:
          discount.type === "PERCENTAGE"
            ? DiscountType.PERCENTAGE
            : DiscountType.FLAT_KOBO,
        value: discount.value,
        minOrderKobo: discount.minOrderKobo,
        maxUses: discount.maxUses,
        usedCount: discount.usedCount,
        expiresAt: discount.expiresAt ?? null,
        isActive: discount.isActive,
      };
      const upserted = await prisma.discount.upsert({
        where: { vendorId_code: { vendorId, code: discount.code } },
        create: { vendorId, code: discount.code, ...data },
        update: data,
      });
      discount.id = upserted.id;
    });
  }

  public async createOrder(order: RuntimeOrder, product: RuntimeProduct): Promise<void> {
    await this.withRetry("createOrder", async () => {
      const vendorId = await this.requireVendorId();
      const rawItems =
        order.items && order.items.length > 0
          ? order.items
          : [
              {
                id: `item-${Date.now()}-0`,
                productId: order.productId || product.id,
                productSku: (order.productSku || product.skuCode).toUpperCase(),
                productName: order.productName || product.name,
                variantId: order.variantId,
                variantSku: order.variantSku,
                variantName: order.variantName,
                quantity: order.quantity,
                unitPriceKobo:
                  order.quantity > 0
                    ? order.subtotalKobo / BigInt(order.quantity)
                    : order.subtotalKobo,
                subtotalKobo: order.subtotalKobo,
              },
            ];

      const neededSkus = Array.from(
        new Set(rawItems.map((it) => (it.productSku || product.skuCode).toUpperCase()))
      );

      await prisma.$transaction(
        async (tx) => {
          // Idempotency guard if createOrder is retried after a transient connection drop
          const alreadyCreated = await tx.order.findUnique({
            where: { vendorId_shortCode: { vendorId, shortCode: order.shortCode } },
            select: { id: true },
          });
          if (alreadyCreated) {
            order.id = alreadyCreated.id;
            return;
          }

          const [dbProducts, customer, zone, discount] = await Promise.all([
            tx.product.findMany({
              where: { vendorId, skuCode: { in: neededSkus } },
              include: { variants: true },
            }),
            tx.customer.upsert({
              where: {
                vendorId_whatsappPhone: {
                  vendorId,
                  whatsappPhone: order.customerPhone,
                },
              },
              create: {
                vendorId,
                whatsappPhone: order.customerPhone,
                name: order.customerName,
                totalOrdersCount: 1,
                lifetimeSpendKobo: 0n,
                lastOrderAt: order.createdAt,
              },
              update: {
                name: order.customerName,
                lastOrderAt: order.createdAt,
              },
            }),
            order.shippingZoneName
              ? tx.shippingZone.findUnique({
                  where: { vendorId_name: { vendorId, name: order.shippingZoneName } },
                })
              : Promise.resolve(null),
            order.discountCode
              ? tx.discount.findUnique({
                  where: { vendorId_code: { vendorId, code: order.discountCode } },
                })
              : Promise.resolve(null),
          ]);

          const productBySku = new Map(
            dbProducts.map((p) => [p.skuCode.toUpperCase(), p])
          );

          for (const sku of neededSkus) {
            if (!productBySku.has(sku)) {
              throw new Error(
                `Cannot persist order ${order.shortCode}: product SKU "${sku}" is not in the database.`
              );
            }
          }

          const status = order.status as PrismaOrderStatus;
          const isAlreadyPaid = status === "PAID";
          const isAlreadyReleased = Boolean(order.reservationReleased || status === "EXPIRED");

          const orderItemsCreate: Array<{
            productId: string;
            variantId: string | null;
            productNameSnap: string;
            quantity: number;
            unitPriceKobo: bigint;
            lineTotalKobo: bigint;
          }> = [];
          const reservationsCreate: Array<{
            productId: string;
            variantId: string | null;
            quantity: number;
            status: "CONSUMED" | "RELEASED" | "ACTIVE";
            expiresAt: Date;
          }> = [];

          for (const it of rawItems) {
            const sku = (it.productSku || product.skuCode).toUpperCase();
            const dbProd = productBySku.get(sku)!;
            let matchedVariantId: string | null = null;
            if (it.variantSku || it.variantName || it.variantId) {
              const matchedVar = dbProd.variants.find(
                (v) =>
                  v.id === it.variantId ||
                  `${dbProd.skuCode.toUpperCase()}-${v.skuSuffix.toUpperCase()}` ===
                    (it.variantSku || "").toUpperCase() ||
                  v.name.toLowerCase() === (it.variantName || "").toLowerCase()
              );
              if (matchedVar) {
                matchedVariantId = matchedVar.id;
              }
            }

            if (!isAlreadyPaid && !isAlreadyReleased) {
              await tx.product.update({
                where: { id: dbProd.id },
                data: { stockReserved: { increment: it.quantity } },
              });
              if (matchedVariantId) {
                await tx.productVariant.update({
                  where: { id: matchedVariantId },
                  data: { stockReserved: { increment: it.quantity } },
                });
              }
            }

            orderItemsCreate.push({
              productId: dbProd.id,
              variantId: matchedVariantId,
              productNameSnap: it.productName || order.productName,
              quantity: it.quantity,
              unitPriceKobo: it.unitPriceKobo,
              lineTotalKobo: it.subtotalKobo,
            });

            reservationsCreate.push({
              productId: dbProd.id,
              variantId: matchedVariantId,
              quantity: it.quantity,
              status: isAlreadyPaid
                ? "CONSUMED"
                : isAlreadyReleased
                  ? "RELEASED"
                  : "ACTIVE",
              expiresAt: order.paymentExpiresAt,
            });
          }

          const isOrderUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            order.id
          );

          const createdOrder = await tx.order.create({
            data: {
              ...(isOrderUuid ? { id: order.id } : {}),
              vendorId,
              customerId: customer.id,
              shortCode: order.shortCode,
              channel: SalesChannel.WHATSAPP_CHAT,
              status,
              subtotalKobo: order.subtotalKobo,
              shippingZoneId: zone?.id ?? null,
              shippingFeeKobo: order.shippingFeeKobo,
              discountId: discount?.id ?? null,
              discountCode: order.discountCode ?? null,
              discountAmountKobo: order.discountAmountKobo,
              totalAmountKobo: order.totalAmountKobo,
              amountPaidKobo: order.amountPaidKobo,
              overpaidAmountKobo: order.overpaidAmountKobo ?? 0n,
              reservationReleased: order.reservationReleased ?? false,
              riderPhone: order.riderPhone ?? null,
              deliveryAddress: order.deliveryAddress ?? null,
              deliveryLandmark: order.deliveryLandmark ?? null,
              alternatePhone: order.alternatePhone ?? null,
              paymentTransactionRef: order.paymentTransactionRef ?? null,
              refundReference: order.refundReference ?? null,
              refundedAmountKobo: order.refundedAmountKobo ?? null,
              refundReason: order.refundReason ?? null,
              refundedAt: order.refundedAt ?? null,
              paymentExpiresAt: order.paymentExpiresAt,
              paidAt: order.paidAt ?? null,
              dispatchedAt: order.dispatchedAt ?? null,
              createdAt: order.createdAt,
              items: {
                create: orderItemsCreate,
              },
              reservations: {
                create: reservationsCreate,
              },
              invoices: {
                create: {
                  provider: "MONNIFY",
                  invoiceReference: order.invoiceReference,
                  expectedAmountKobo: order.totalAmountKobo,
                  accountNumber: order.accountNumber,
                  bankName: order.bankName,
                  accountName: order.accountName,
                  status: isAlreadyPaid
                    ? "PAID"
                    : status === "EXPIRED"
                      ? "EXPIRED"
                      : "ACTIVE",
                  expiresAt: order.paymentExpiresAt,
                },
              },
            },
          });

          order.id = createdOrder.id;

          await tx.commerceEvent.create({
            data: {
              vendorId,
              eventType: "ORDER_CREATED",
              actorType: "COPILOT_AUTO",
              entityType: "ORDER",
              entityId: order.shortCode,
              payload: {
                shortCode: order.shortCode,
                totalAmountKobo: order.totalAmountKobo.toString(),
                productSku: neededSkus.join(","),
                quantity: order.quantity,
              },
            },
          });
        },
        { maxWait: 15000, timeout: 30000 }
      );
    });
  }

  public async saveOrder(order: RuntimeOrder): Promise<void> {
    await this.withRetry("saveOrder", async () => {
      const vendorId = await this.requireVendorId();
      const existing = await prisma.order.findUnique({
        where: { vendorId_shortCode: { vendorId, shortCode: order.shortCode } },
        include: { items: true, reservations: true },
      });
      if (!existing) {
        // Self-heal if an earlier createOrder timed out before persisting
        await this.createOrder(order, {
          id: order.productId,
          skuCode: order.productSku,
          name: order.productName,
          description: "",
          category: "General",
          basePriceKobo:
            order.quantity > 0
              ? order.subtotalKobo / BigInt(order.quantity)
              : order.subtotalKobo,
          primaryImageUrl: "",
          imagePhash: "",
          stockTotal: order.quantity,
          stockReserved: 0,
        });
        return;
      }

      const wasPaid = existing.status === "PAID";
      const wasExpired = existing.reservationReleased;

      await prisma.$transaction(
        async (tx) => {
          await tx.order.update({
            where: { id: existing.id },
            data: {
              status: order.status as PrismaOrderStatus,
              amountPaidKobo: order.amountPaidKobo,
              overpaidAmountKobo: order.overpaidAmountKobo ?? 0n,
              riderPhone: order.riderPhone ?? null,
              deliveryAddress: order.deliveryAddress ?? null,
              deliveryLandmark: order.deliveryLandmark ?? null,
              alternatePhone: order.alternatePhone ?? null,
              paymentTransactionRef: order.paymentTransactionRef ?? null,
              refundReference: order.refundReference ?? null,
              refundedAmountKobo: order.refundedAmountKobo ?? null,
              refundReason: order.refundReason ?? null,
              refundedAt: order.refundedAt ?? null,
              paymentExpiresAt: order.paymentExpiresAt,
              paidAt: order.paidAt ?? null,
              dispatchedAt: order.dispatchedAt ?? null,
              reservationReleased: order.reservationReleased ?? false,
            },
          });

          await tx.paymentInvoice.updateMany({
            where: { orderId: existing.id },
            data: {
              status:
                order.status === "PAID"
                  ? "PAID"
                  : order.status === "EXPIRED"
                    ? "EXPIRED"
                    : "ACTIVE",
            },
          });

          const activeReservations = existing.reservations.filter(
            (reservation) => reservation.status === "ACTIVE"
          );

          if (!wasPaid && order.status === "PAID") {
            for (const item of existing.items) {
              const hasActiveRes = activeReservations.some(
                (r) => r.productId === item.productId
              );
              await tx.product.update({
                where: { id: item.productId },
                data: {
                  stockTotal: { decrement: item.quantity },
                  ...(hasActiveRes
                    ? { stockReserved: { decrement: item.quantity } }
                    : {}),
                },
              });
              if (item.variantId) {
                await tx.productVariant.update({
                  where: { id: item.variantId },
                  data: {
                    stockTotal: { decrement: item.quantity },
                    ...(hasActiveRes
                      ? { stockReserved: { decrement: item.quantity } }
                      : {}),
                  },
                });
              }
            }
            if (activeReservations.length > 0) {
              await tx.stockReservation.updateMany({
                where: { id: { in: activeReservations.map((r) => r.id) } },
                data: { status: "CONSUMED" },
              });
            }
          } else if (!wasExpired && order.status === "EXPIRED") {
            for (const item of existing.items) {
              await tx.product.update({
                where: { id: item.productId },
                data: { stockReserved: { decrement: item.quantity } },
              });
              if (item.variantId) {
                await tx.productVariant.update({
                  where: { id: item.variantId },
                  data: { stockReserved: { decrement: item.quantity } },
                });
              }
            }
            if (activeReservations.length > 0) {
              await tx.stockReservation.updateMany({
                where: { id: { in: activeReservations.map((r) => r.id) } },
                data: { status: "RELEASED" },
              });
            }
          }

          if (order.status === "REFUNDED" && order.refundReference) {
            await tx.orderRefund.upsert({
              where: { refundReference: order.refundReference },
              update: {
                amountKobo: order.refundedAmountKobo ?? order.amountPaidKobo,
                reason: order.refundReason ?? null,
                status: "COMPLETED",
                completedAt: order.refundedAt ?? new Date(),
              },
              create: {
                orderId: existing.id,
                vendorId,
                refundReference: order.refundReference,
                amountKobo: order.refundedAmountKobo ?? order.amountPaidKobo,
                reason: order.refundReason ?? null,
                status: "COMPLETED",
                restoredStock: true,
                completedAt: order.refundedAt ?? new Date(),
              },
            });
          }
        },
        { maxWait: 15000, timeout: 30000 }
      );
    });
  }

  public async recordPayment(
    order: RuntimeOrder,
    verified: ServerVerifiedPaymentRecord
  ): Promise<void> {
    await this.withRetry("recordPayment", async () => {
      const invoice = await prisma.paymentInvoice.findUnique({
        where: { invoiceReference: order.invoiceReference },
      });
      if (!invoice) {
        throw new Error(
          `Cannot record payment: invoice "${order.invoiceReference}" is missing.`
        );
      }

      try {
        await prisma.paymentTransaction.create({
          data: {
            invoiceId: invoice.id,
            providerTransactionRef: verified.providerTransactionRef,
            paymentReference: verified.paymentReference,
            amountPaidKobo: verified.amountPaidKobo,
            settlementAmountKobo: verified.settlementAmountKobo ?? null,
            payerName: verified.payerName ?? null,
            payerBankName: verified.payerBankName ?? null,
            paymentMethod: verified.paymentMethod,
            webhookSignatureValid: true,
            serverVerifiedAt: verified.serverVerifiedAt,
            rawVerificationJson: toJson(verified.rawResponse),
          },
        });
      } catch (err) {
        // Unique providerTransactionRef is the durable idempotency guarantee.
        if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
          throw err;
        }
      }

      await prisma.paymentInvoice.update({
        where: { id: invoice.id },
        data: {
          status:
            order.status === "PAID"
              ? "PAID"
              : order.status === "EXPIRED"
                ? "EXPIRED"
                : "ACTIVE",
        },
      });
    });
  }

  public async recordEvent(event: PersistenceEvent): Promise<void> {
    await this.withRetry("recordEvent", async () => {
      const vendorId = await this.requireVendorId();
      await prisma.commerceEvent.create({
        data: {
          vendorId,
          eventType: event.eventType,
          actorType: event.actorType,
          entityType: event.entityType,
          entityId: event.entityId,
          payload: toJson(event.payload),
        },
      });
    });
  }

  public async saveChatMessage(message: ChatThreadMessage): Promise<void> {
    await this.withRetry("saveChatMessage", async () => {
      const vendorId = await this.requireVendorId();
      await prisma.chatMessage.create({
        data: {
          vendorId,
          channel: message.channel,
          sender: message.sender,
          fromPhone: message.fromPhone,
          text: message.text,
          imageUrl: message.imageUrl ?? null,
          quickReplies: message.quickReplies ? toJson(message.quickReplies) : Prisma.JsonNull,
          createdAt: message.timestamp,
        },
      });
    });
  }

  public async saveBuyerSession(session: BuyerConversationSession): Promise<void> {
    await this.withRetry("saveBuyerSession", async () => {
      const vendorId = await this.requireVendorId();
      const isUuid = (val?: string) =>
        Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

      const data = {
        buyerName: session.buyerName || null,
        copilotPaused: session.copilotPaused ?? false,
        activeProductId: isUuid(session.activeProductId) ? session.activeProductId! : null,
        activeVariantId: isUuid(session.activeVariantId) ? session.activeVariantId! : null,
        activeOrderId: isUuid(session.activeOrderId) ? session.activeOrderId! : null,
        quantity: session.quantity ?? null,
        discountCode: session.discountCode ?? null,
        cartItems: session.cart ? toJson(session.cart) : Prisma.JsonNull,
        conversationState: session.state,
        assistanceInquiry: session.assistanceInquiry ?? null,
        assistanceRequestedAt: session.assistanceRequestedAt ?? null,
        lastBuyerMessageAt: session.updatedAt,
      };

      await prisma.chatSession.upsert({
        where: {
          vendorId_buyerWhatsappPhone: {
            vendorId,
            buyerWhatsappPhone: session.buyerPhone,
          },
        },
        create: {
          vendorId,
          buyerWhatsappPhone: session.buyerPhone,
          ...data,
        },
        update: data,
      });
    });
  }

  public async deleteBuyerSession(buyerPhone: string): Promise<void> {
    const vendorId = await this.requireVendorId();
    await prisma.chatSession.updateMany({
      where: { vendorId, buyerWhatsappPhone: buyerPhone },
      data: {
        conversationState: "IDLE",
        activeProductId: null,
        activeVariantId: null,
        activeOrderId: null,
        quantity: null,
        discountCode: null,
        cartItems: Prisma.JsonNull,
        assistanceInquiry: null,
      },
    });
  }

  public async saveOtpVerification(input: {
    phone: string;
    code: string;
    purpose: string;
    expiresAt: Date;
  }): Promise<void> {
    const vendorId = await this.requireVendorId();
    await prisma.otpVerification.create({
      data: {
        vendorId,
        phone: input.phone,
        code: input.code,
        purpose: input.purpose,
        expiresAt: input.expiresAt,
      },
    });
  }

  public async consumeOtpVerification(input: {
    phone: string;
    code: string;
    purpose: string;
  }): Promise<boolean> {
    const record = await prisma.otpVerification.findFirst({
      where: {
        phone: input.phone,
        code: input.code,
        purpose: input.purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!record) return false;
    await prisma.otpVerification.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
    return true;
  }

  public async saveAuthSession(input: {
    token: string;
    phone?: string;
    email?: string;
    expiresAt: Date;
  }): Promise<void> {
    const vendorId = await this.requireVendorId();
    await prisma.vendorAuthSession.upsert({
      where: { token: input.token },
      create: {
        vendorId,
        token: input.token,
        phone: input.phone ?? null,
        email: input.email ?? null,
        expiresAt: input.expiresAt,
      },
      update: {
        phone: input.phone ?? null,
        email: input.email ?? null,
        expiresAt: input.expiresAt,
      },
    });
  }

  public async consumeAuthSession(
    token: string
  ): Promise<{ phone?: string; email?: string } | null> {
    const record = await prisma.vendorAuthSession.findUnique({
      where: { token },
    });
    if (!record || record.expiresAt < new Date()) return null;
    await prisma.vendorAuthSession.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    return {
      phone: record.phone ?? undefined,
      email: record.email ?? undefined,
    };
  }

  public async saveMarketBoostListing(listing: RuntimeMarketBoostListing): Promise<void> {
    await this.withRetry("saveMarketBoostListing", async () => {
      const vendorId = await this.requireVendorId();
      const data = {
        isPublished: listing.isPublished,
        businessName: listing.businessName,
        category: listing.category,
        baseState: listing.baseState,
        baseCity: listing.baseCity,
        shippingScope: listing.shippingScope,
        allowInterstate: listing.allowInterstate,
        coveredStates: toJson(listing.coveredStates),
        description: listing.description || null,
        moq: listing.moq,
        startingPriceKobo: listing.startingPriceKobo,
        fulfillmentMethod: listing.fulfillmentMethod,
        deliveryNote: listing.deliveryNote || null,
        featuredTags: toJson(listing.featuredTags),
        mirroredCategories: toJson(listing.mirroredCategories ?? []),
        mirroredProductSkus: toJson(listing.mirroredProductSkus ?? []),
        wholesaleDiscountRules: toJson(listing.wholesaleDiscountRules ?? []),
        subscriptionPlan: listing.subscriptionPlan,
      };

      await prisma.$transaction([
        prisma.marketBoostListing.upsert({
          where: { vendorId },
          create: { vendorId, ...data },
          update: data,
        }),
        prisma.vendor.update({
          where: { id: vendorId },
          data: {
            baseState: listing.baseState,
            baseCity: listing.baseCity,
          },
        }),
      ]);
    });
  }

  public async saveResellerMirror(mirror: RuntimeResellerMirror): Promise<void> {
    const vendorId = await this.requireVendorId();
    let supplierId = mirror.supplierId;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      supplierId
    );
    if (!isUuid) {
      const sup = await prisma.supplierProfile.findUnique({
        where: { slug: mirror.supplierSlug || supplierId },
      });
      if (!sup) return;
      supplierId = sup.id;
    }

    await prisma.resellerCatalogMirror.upsert({
      where: {
        resellerVendorId_supplierId: {
          resellerVendorId: vendorId,
          supplierId,
        },
      },
      create: {
        resellerVendorId: vendorId,
        supplierId,
        mirroredProductSkus: toJson(mirror.mirroredProductSkus),
        defaultMarkupBps: mirror.defaultMarkupBps,
        status: mirror.status,
        lastSyncedAt: mirror.lastSyncedAt,
      },
      update: {
        mirroredProductSkus: toJson(mirror.mirroredProductSkus),
        defaultMarkupBps: mirror.defaultMarkupBps,
        status: mirror.status,
        lastSyncedAt: mirror.lastSyncedAt,
      },
    });
  }

  public async saveSupplierProfile(supplier: import("../runtime-types.ts").RuntimeSupplierProfile): Promise<void> {
    await prisma.supplierProfile.updateMany({
      where: {
        OR: [{ id: supplier.id }, { slug: supplier.slug }],
      },
      data: {
        catalogProducts: toJson(supplier.catalogProducts),
      },
    });
  }

  public async savePaymentLink(link: RuntimePaymentLink): Promise<void> {
    const vendorId = await this.requireVendorId();
    const data = {
      customerName: link.customerName || null,
      customerPhone: link.customerPhone || null,
      productSku: link.productSku || null,
      description: link.description || null,
      amountKobo: link.amountKobo,
      checkoutUrl: link.checkoutUrl,
      isActive: link.isActive,
      timesUsed: link.timesUsed,
      expiresAt: link.expiresAt ?? null,
    };

    await prisma.paymentLink.upsert({
      where: { slug: link.slug },
      create: { vendorId, slug: link.slug, ...data },
      update: data,
    });
  }

  public async deletePaymentLink(slug: string): Promise<void> {
    const vendorId = await this.requireVendorId();
    await prisma.paymentLink.updateMany({
      where: { vendorId, slug },
      data: { isActive: false },
    });
  }

  public async savePayoutWithdrawal(withdrawal: RuntimePayoutWithdrawal): Promise<void> {
    const vendorId = await this.requireVendorId();
    const data = {
      amountKobo: withdrawal.amountKobo,
      feeKobo: withdrawal.feeKobo,
      netAmountKobo: withdrawal.netAmountKobo,
      bankCode: withdrawal.bankCode || null,
      bankName: withdrawal.bankName,
      accountNumber: withdrawal.accountNumber,
      accountName: withdrawal.accountName || null,
      status: withdrawal.status,
      verifiedByOtp: withdrawal.verifiedByOtp,
      settledAt: withdrawal.settledAt ?? null,
    };

    await prisma.payoutWithdrawal.upsert({
      where: { reference: withdrawal.reference },
      create: { vendorId, reference: withdrawal.reference, ...data },
      update: data,
    });
  }

  public async saveSettlementSplitRule(rule: RuntimeSettlementSplitRule): Promise<void> {
    const vendorId = await this.requireVendorId();
    const existing = await prisma.settlementSplitRule.findFirst({
      where: { vendorId },
      orderBy: { createdAt: "asc" },
    });

    if (existing) {
      await prisma.settlementSplitRule.update({
        where: { id: existing.id },
        data: {
          name: rule.name,
          supplierSubAccountCode: rule.supplierSubAccountCode || null,
          supplierShareBps: rule.supplierShareBps,
          resellerShareBps: rule.resellerShareBps,
          platformFeeBps: rule.platformFeeBps,
          isActive: rule.isActive,
        },
      });
    } else {
      await prisma.settlementSplitRule.create({
        data: {
          vendorId,
          name: rule.name,
          supplierSubAccountCode: rule.supplierSubAccountCode || null,
          supplierShareBps: rule.supplierShareBps,
          resellerShareBps: rule.resellerShareBps,
          platformFeeBps: rule.platformFeeBps,
          isActive: rule.isActive,
        },
      });
    }
  }

  public async saveKycSubmission(submission: RuntimeKycSubmission): Promise<void> {
    const vendorId = await this.requireVendorId();
    const prismaStatus =
      submission.status === "VERIFIED"
        ? VerificationStatus.VERIFIED
        : submission.status === "REJECTED"
          ? VerificationStatus.REJECTED
          : VerificationStatus.PENDING_REVIEW;

    await prisma.$transaction([
      prisma.vendorKycSubmission.create({
        data: {
          vendorId,
          businessName: submission.businessName,
          cacNumber: submission.cacNumber,
          tinNumber: submission.tinNumber || null,
          businessAddress: submission.businessAddress || null,
          businessCategory: submission.businessCategory || null,
          bankCode: submission.bankCode,
          bankName: submission.bankName || null,
          accountNumber: submission.accountNumber,
          resolvedAccountName: submission.resolvedAccountName,
          whatsappPhone: submission.whatsappPhone || null,
          instagramHandle: submission.instagramHandle || null,
          cacDocumentUploaded: submission.cacDocumentUploaded,
          idDocumentUploaded: submission.idDocumentUploaded,
          status: prismaStatus,
          reviewerNotes: submission.reviewerNotes || null,
          submittedAt: submission.submittedAt,
          reviewedAt: submission.reviewedAt ?? null,
        },
      }),
      prisma.vendorConsent.create({
        data: {
          vendorId,
          consentType: "KYC_VERIFICATION",
          policyVersion: "v1.0",
          granted: true,
          channel: "WEB_DASHBOARD",
          ipOrPhoneRef: submission.whatsappPhone || "WEB_DASHBOARD",
        },
      }),
      prisma.vendor.update({
        where: { id: vendorId },
        data: {
          businessName: submission.businessName,
          cacNumber: submission.cacNumber,
          tinNumber: submission.tinNumber || null,
          instagramHandle: submission.instagramHandle || null,
          settlementBankCode: submission.bankCode,
          settlementBankName: submission.bankName || null,
          settlementAccountNum: submission.accountNumber,
          settlementAccountName: submission.resolvedAccountName,
          verificationStatus: prismaStatus,
        },
      }),
    ]);
  }

  public async saveTeamMember(member: RuntimeTeamMember): Promise<void> {
    const vendorId = await this.requireVendorId();
    const email = member.email.trim().toLowerCase();
    const data = {
      name: member.name,
      phone: member.phone || null,
      role: member.role,
      status: member.status,
      canManageOrders: member.canManageOrders,
      canManageInventory: member.canManageInventory,
      canViewPayouts: member.canViewPayouts,
      canProcessRefunds: member.canProcessRefunds,
      canOverrideCopilot: member.canOverrideCopilot,
      lastActiveAt: member.lastActiveAt ?? null,
    };

    await prisma.teamMember.upsert({
      where: { vendorId_email: { vendorId, email } },
      create: { vendorId, email, ...data, invitedAt: member.invitedAt },
      update: data,
    });
  }

  public async deleteTeamMember(idOrEmail: string): Promise<void> {
    const vendorId = await this.requireVendorId();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      idOrEmail
    );
    await prisma.teamMember.deleteMany({
      where: isUuid
        ? { vendorId, id: idOrEmail }
        : { vendorId, email: idOrEmail.trim().toLowerCase() },
    });
  }

  public async saveNotification(notification: RuntimeVendorNotification): Promise<void> {
    const vendorId = await this.requireVendorId();
    const data = {
      title: notification.title,
      message: notification.message,
      category: notification.category,
      isRead: notification.isRead,
      isDismissed: notification.isDismissed,
      linkText: notification.linkText || null,
      targetView: notification.targetView || null,
      targetRef: notification.targetRef || null,
      readAt: notification.readAt ?? null,
    };

    await prisma.vendorNotification.upsert({
      where: {
        vendorId_notificationKey: {
          vendorId,
          notificationKey: notification.notificationKey,
        },
      },
      create: {
        vendorId,
        notificationKey: notification.notificationKey,
        ...data,
      },
      update: data,
    });
  }

  public async syncNotifications(input: {
    readKeys?: string[];
    dismissedKeys?: string[];
    markAllRead?: boolean;
  }): Promise<void> {
    const vendorId = await this.requireVendorId();
    if (input.markAllRead) {
      await prisma.vendorNotification.updateMany({
        where: { vendorId, isRead: false },
        data: { isRead: true, readAt: new Date() },
      });
    } else if (input.readKeys && input.readKeys.length > 0) {
      await prisma.vendorNotification.updateMany({
        where: { vendorId, notificationKey: { in: input.readKeys } },
        data: { isRead: true, readAt: new Date() },
      });
    }
    if (input.dismissedKeys && input.dismissedKeys.length > 0) {
      await prisma.vendorNotification.updateMany({
        where: { vendorId, notificationKey: { in: input.dismissedKeys } },
        data: { isDismissed: true },
      });
    }
  }

  public async close(): Promise<void> {
    await prisma.$disconnect();
  }

  private mapOrder(order: DbOrderRow): RuntimeOrder {
    const item = order.items[0];
    const invoice = order.invoices[0];
    const mappedItems = order.items.map((it) => ({
      id: it.id,
      productId: it.productId,
      productSku: it.product.skuCode,
      productName: it.productNameSnap,
      variantId: it.variantId ?? undefined,
      variantSku: it.variant
        ? `${it.product.skuCode}-${it.variant.skuSuffix}`
        : undefined,
      variantName: it.variant?.name ?? undefined,
      quantity: it.quantity,
      unitPriceKobo: it.unitPriceKobo,
      subtotalKobo: it.lineTotalKobo,
    }));
    const totalQuantity =
      mappedItems.length > 0
        ? mappedItems.reduce((sum, it) => sum + it.quantity, 0)
        : 1;
    const displayProductName =
      mappedItems.length <= 1
        ? (item?.productNameSnap ?? "")
        : `${item?.productNameSnap ?? ""} + ${mappedItems.length - 1} more item${mappedItems.length > 2 ? "s" : ""}`;

    return {
      id: order.id,
      shortCode: order.shortCode,
      customerPhone: order.customer.whatsappPhone,
      customerName: order.customer.name ?? order.customer.whatsappPhone,
      productId: item?.productId ?? "",
      productSku: item?.product.skuCode ?? "",
      productName: displayProductName,
      variantId: mappedItems.length === 1 ? mappedItems[0]?.variantId : undefined,
      variantSku: mappedItems.length === 1 ? mappedItems[0]?.variantSku : undefined,
      variantName: mappedItems.length === 1 ? mappedItems[0]?.variantName : undefined,
      quantity: totalQuantity,
      items: mappedItems,
      shippingZoneName: order.shippingZone?.name ?? "",
      subtotalKobo: order.subtotalKobo,
      shippingFeeKobo: order.shippingFeeKobo,
      discountCode: order.discountCode ?? undefined,
      discountAmountKobo: order.discountAmountKobo,
      totalAmountKobo: order.totalAmountKobo,
      amountPaidKobo: order.amountPaidKobo,
      overpaidAmountKobo: order.overpaidAmountKobo,
      status: order.status as RuntimeOrder["status"],
      invoiceReference: invoice?.invoiceReference ?? "",
      accountNumber: invoice?.accountNumber ?? "",
      bankName: invoice?.bankName ?? "",
      accountName: invoice?.accountName ?? "",
      riderPhone: order.riderPhone ?? undefined,
      deliveryAddress: order.deliveryAddress ?? undefined,
      deliveryLandmark: order.deliveryLandmark ?? undefined,
      alternatePhone: order.alternatePhone ?? undefined,
      paymentTransactionRef: order.paymentTransactionRef ?? undefined,
      refundReference: order.refundReference ?? undefined,
      refundedAmountKobo: order.refundedAmountKobo ?? undefined,
      refundReason: order.refundReason ?? undefined,
      refundedAt: order.refundedAt ?? undefined,
      reservationReleased: order.reservationReleased,
      paymentExpiresAt: order.paymentExpiresAt ?? order.createdAt,
      createdAt: order.createdAt,
      paidAt: order.paidAt ?? undefined,
      dispatchedAt: order.dispatchedAt ?? undefined,
    };
  }

  private async requireVendorId(): Promise<string> {
    if (this.vendorId) return this.vendorId;
    const vendor = await prisma.vendor.findUnique({
      where: { slug: this.vendorSlug },
      select: { id: true },
    });
    if (!vendor) {
      throw new Error(
        `Vendor "${this.vendorSlug}" was not found. Run "npm run db:seed" or set PERSISTENCE_VENDOR_SLUG.`
      );
    }
    this.vendorId = vendor.id;
    return vendor.id;
  }
}

export function createPrismaPersistence(vendorSlug: string): PersistenceStore {
  return new PrismaPersistenceStore(vendorSlug);
}

function mapVerificationStatus(
  status: VerificationStatus
): RuntimeVendor["verificationStatus"] {
  if (status === VerificationStatus.VERIFIED) return "VERIFIED";
  if (status === VerificationStatus.REJECTED) return "REJECTED";
  return "PENDING";
}

function mapRuntimeVerificationStatus(
  status: RuntimeVendor["verificationStatus"]
): VerificationStatus {
  if (status === "VERIFIED") return VerificationStatus.VERIFIED;
  if (status === "REJECTED") return VerificationStatus.REJECTED;
  return VerificationStatus.PENDING_REVIEW;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}
