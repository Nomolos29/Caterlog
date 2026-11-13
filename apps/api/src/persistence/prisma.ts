import {
  CopilotMode,
  DiscountType,
  OrderStatus as PrismaOrderStatus,
  Prisma,
  prisma,
  SalesChannel,
  VerificationStatus,
} from "@caterlog/database";
import type { ServerVerifiedPaymentRecord } from "@caterlog/commerce-core";
import type {
  RuntimeDiscount,
  RuntimeOrder,
  RuntimeProduct,
  RuntimeShippingZone,
  RuntimeSnapshot,
  RuntimeVendor,
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
  reservationReleased: boolean;
  paymentExpiresAt: Date | null;
  createdAt: Date;
  paidAt: Date | null;
  dispatchedAt: Date | null;
  customer: { whatsappPhone: string; name: string | null };
  shippingZone: { name: string } | null;
  items: Array<{
    productId: string;
    productNameSnap: string;
    quantity: number;
    product: { skuCode: string };
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

  public async loadSnapshot(_vendorSlug: string): Promise<RuntimeSnapshot | null> {
    const vendor = await prisma.vendor.findUnique({
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
            items: { include: { product: true } },
            invoices: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
      },
    });

    if (!vendor) return null;
    this.vendorId = vendor.id;

    const processed = await prisma.paymentTransaction.findMany({
      where: { invoice: { order: { vendorId: vendor.id } } },
      select: { providerTransactionRef: true },
    });

    return {
      vendor: {
        id: vendor.id,
        slug: vendor.slug,
        businessName: vendor.businessName,
        whatsappPhone: vendor.whatsappPhone,
        whatsappPhoneId: vendor.whatsappPhoneId ?? "",
        verificationStatus: mapVerificationStatus(vendor.verificationStatus),
        copilotMode: vendor.copilotMode,
        copilotIdleSeconds: vendor.copilotIdleSeconds,
        reservationTtlMinutes: vendor.reservationTtlMinutes,
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
    };
  }

  public async saveVendor(vendor: RuntimeVendor): Promise<void> {
    const vendorId = await this.requireVendorId();
    await prisma.vendor.update({
      where: { id: vendorId },
      data: {
        businessName: vendor.businessName,
        whatsappPhone: vendor.whatsappPhone,
        whatsappPhoneId: vendor.whatsappPhoneId || null,
        copilotMode: vendor.copilotMode as CopilotMode,
        copilotIdleSeconds: vendor.copilotIdleSeconds,
        reservationTtlMinutes: vendor.reservationTtlMinutes,
        verificationStatus: mapRuntimeVerificationStatus(vendor.verificationStatus),
      },
    });
  }

  public async saveProduct(product: RuntimeProduct): Promise<void> {
    const vendorId = await this.requireVendorId();
    const skuCode = product.skuCode.toUpperCase();
    const data = {
      name: product.name,
      description: product.description || null,
      category: product.category || null,
      basePriceKobo: product.basePriceKobo,
      primaryImageUrl:
        product.primaryImageUrl || "https://placehold.co/600x600?text=Product",
      imagePhash: product.imagePhash || null,
      stockTotal: product.stockTotal,
      stockReserved: product.stockReserved,
      isActive: true,
    };

    const upserted = await prisma.product.upsert({
      where: { vendorId_skuCode: { vendorId, skuCode } },
      create: { vendorId, skuCode, ...data },
      update: data,
    });

    if (product.variants && product.variants.length > 0) {
      for (const v of product.variants) {
        const skuSuffix = v.skuCode.startsWith(`${skuCode}-`)
          ? v.skuCode.slice(skuCode.length + 1)
          : v.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toUpperCase() || "VAR";

        await prisma.productVariant.upsert({
          where: {
            productId_skuSuffix: {
              productId: upserted.id,
              skuSuffix,
            },
          },
          create: {
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
      }
    }
  }

  public async deleteProduct(skuCode: string): Promise<void> {
    const vendorId = await this.requireVendorId();
    await prisma.product.updateMany({
      where: { vendorId, skuCode: skuCode.toUpperCase() },
      data: { isActive: false },
    });
  }

  public async saveShippingZone(zone: RuntimeShippingZone): Promise<void> {
    const vendorId = await this.requireVendorId();
    const data = {
      code: zone.code,
      feeKobo: zone.feeKobo,
      isActive: zone.isActive,
    };
    await prisma.shippingZone.upsert({
      where: { vendorId_name: { vendorId, name: zone.name } },
      create: { vendorId, name: zone.name, ...data },
      update: data,
    });
  }

  public async saveDiscount(discount: RuntimeDiscount): Promise<void> {
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
    await prisma.discount.upsert({
      where: { vendorId_code: { vendorId, code: discount.code } },
      create: { vendorId, code: discount.code, ...data },
      update: data,
    });
  }

  public async createOrder(order: RuntimeOrder, product: RuntimeProduct): Promise<void> {
    const vendorId = await this.requireVendorId();
    const skuCode = (order.productSku || product.skuCode).toUpperCase();

    await prisma.$transaction(async (tx) => {
      const dbProduct = await tx.product.findUnique({
        where: { vendorId_skuCode: { vendorId, skuCode } },
      });
      if (!dbProduct) {
        throw new Error(
          `Cannot persist order ${order.shortCode}: product SKU "${skuCode}" is not in the database.`
        );
      }

      const customer = await tx.customer.upsert({
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
      });

      const zone = order.shippingZoneName
        ? await tx.shippingZone.findUnique({
            where: { vendorId_name: { vendorId, name: order.shippingZoneName } },
          })
        : null;
      const discount = order.discountCode
        ? await tx.discount.findUnique({
            where: { vendorId_code: { vendorId, code: order.discountCode } },
          })
        : null;

      const status = order.status as PrismaOrderStatus;
      const isAlreadyPaid = status === "PAID";

      if (!isAlreadyPaid) {
        await tx.product.update({
          where: { id: dbProduct.id },
          data: { stockReserved: { increment: order.quantity } },
        });
      }

      await tx.order.create({
        data: {
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
          paymentExpiresAt: order.paymentExpiresAt,
          paidAt: order.paidAt ?? null,
          dispatchedAt: order.dispatchedAt ?? null,
          createdAt: order.createdAt,
          items: {
            create: {
              productId: dbProduct.id,
              productNameSnap: order.productName,
              quantity: order.quantity,
              unitPriceKobo: order.subtotalKobo / BigInt(order.quantity),
              lineTotalKobo: order.subtotalKobo,
            },
          },
          reservations: {
            create: {
              productId: dbProduct.id,
              quantity: order.quantity,
              status: isAlreadyPaid ? "CONSUMED" : "ACTIVE",
              expiresAt: order.paymentExpiresAt,
            },
          },
          invoices: {
            create: {
              provider: "MONNIFY",
              invoiceReference: order.invoiceReference,
              expectedAmountKobo: order.totalAmountKobo,
              accountNumber: order.accountNumber,
              bankName: order.bankName,
              accountName: order.accountName,
              status: isAlreadyPaid ? "PAID" : "ACTIVE",
              expiresAt: order.paymentExpiresAt,
            },
          },
        },
      });

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
            productSku: skuCode,
            quantity: order.quantity,
          },
        },
      });
    });
  }

  public async saveOrder(order: RuntimeOrder): Promise<void> {
    const vendorId = await this.requireVendorId();
    const existing = await prisma.order.findUnique({
      where: { vendorId_shortCode: { vendorId, shortCode: order.shortCode } },
      include: { items: true, reservations: true },
    });
    if (!existing) {
      throw new Error(
        `Cannot update order ${order.shortCode}: it does not exist in the database.`
      );
    }

    const wasPaid = existing.status === "PAID";
    const wasExpired = existing.reservationReleased;

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: existing.id },
        data: {
          status: order.status as PrismaOrderStatus,
          amountPaidKobo: order.amountPaidKobo,
          overpaidAmountKobo: order.overpaidAmountKobo ?? 0n,
          riderPhone: order.riderPhone ?? null,
          deliveryAddress: order.deliveryAddress ?? null,
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

      const item = existing.items[0];
      const activeReservation = existing.reservations.find(
        (reservation) => reservation.status === "ACTIVE"
      );

      if (!wasPaid && order.status === "PAID" && item) {
        // Late payments arrive after the reservation was released: only reduce
        // stockTotal then, never stockReserved twice.
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockTotal: { decrement: item.quantity },
            ...(activeReservation
              ? { stockReserved: { decrement: item.quantity } }
              : {}),
          },
        });
        if (activeReservation) {
          await tx.stockReservation.update({
            where: { id: activeReservation.id },
            data: { status: "CONSUMED" },
          });
        }
      } else if (!wasExpired && order.status === "EXPIRED") {
        if (item) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stockReserved: { decrement: item.quantity } },
          });
        }
        if (activeReservation) {
          await tx.stockReservation.update({
            where: { id: activeReservation.id },
            data: { status: "RELEASED" },
          });
        }
      }
    });
  }

  public async recordPayment(
    order: RuntimeOrder,
    verified: ServerVerifiedPaymentRecord
  ): Promise<void> {
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
  }

  public async recordEvent(event: PersistenceEvent): Promise<void> {
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
  }

  public async close(): Promise<void> {
    await prisma.$disconnect();
  }

  private mapOrder(order: DbOrderRow): RuntimeOrder {
    const item = order.items[0];
    const invoice = order.invoices[0];
    return {
      id: order.id,
      shortCode: order.shortCode,
      customerPhone: order.customer.whatsappPhone,
      customerName: order.customer.name ?? order.customer.whatsappPhone,
      productId: item?.productId ?? "",
      productSku: item?.product.skuCode ?? "",
      productName: item?.productNameSnap ?? "",
      quantity: item?.quantity ?? 1,
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
