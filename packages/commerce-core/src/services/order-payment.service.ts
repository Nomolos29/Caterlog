import type {
  Order,
  OrderStatus,
  PaymentInvoice,
  PrismaClient,
  SalesChannel,
} from "@caterlog/database";
import { formatNaira } from "../domain/money.ts";
import type { ActorSource, InMemoryDomainEventBus } from "../domain/events.ts";
import {
  assertValidOrderTransition,
  computeDiscountKobo,
  computeOrderTotalKobo,
  evaluatePaymentReconciliation,
  type DomainOrderStatus,
} from "../domain/order-state-machine.ts";
import type { MessagingChannelPort, PaymentProviderPort } from "../ports/index.ts";

export interface CreateOrderInput {
  vendorId: string;
  customerPhone: string;
  customerName?: string;
  deliveryAddress?: string;
  productId: string;
  quantity: number;
  shippingZoneId?: string;
  discountCode?: string;
  channel?: SalesChannel;
}

export interface CreatedOrderWithInvoice {
  order: Order;
  invoice: PaymentInvoice;
  productName: string;
  remainingAvailableStock: number;
}

export class OrderPaymentService {
  private readonly db: PrismaClient;
  private readonly paymentPort: PaymentProviderPort;
  private readonly messagingPort: MessagingChannelPort;
  private readonly eventBus: InMemoryDomainEventBus;

  constructor(
    db: PrismaClient,
    paymentPort: PaymentProviderPort,
    messagingPort: MessagingChannelPort,
    eventBus: InMemoryDomainEventBus
  ) {
    this.db = db;
    this.paymentPort = paymentPort;
    this.messagingPort = messagingPort;
    this.eventBus = eventBus;
  }

  /**
   * Creates an order, atomically locks stock for `vendor.reservationTtlMinutes` (default 15m),
   * generates a Monnify Dynamic 10-digit NUBAN Virtual Account, and sends the invoice +
   * 1-tap copyable NUBAN bubble into the WhatsApp chat.
   */
  public async createOrderWithVirtualAccount(
    input: CreateOrderInput
  ): Promise<CreatedOrderWithInvoice> {
    if (input.quantity <= 0) {
      throw new Error("Order quantity must be at least 1.");
    }

    const vendor = await this.db.vendor.findUniqueOrThrow({
      where: { id: input.vendorId },
    });

    // Execute stock reservation and order creation inside an interactive ACID transaction
    const txResult = await this.db.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: input.productId, vendorId: vendor.id, isActive: true },
      });
      if (!product) {
        throw new Error("Product not found or inactive.");
      }

      const available = product.stockTotal - product.stockReserved;
      if (available < input.quantity) {
        throw new Error(
          `Insufficient stock for "${product.name}". Requested ${input.quantity}, available ${Math.max(0, available)}.`
        );
      }

      // Atomically increment reserved stock
      const updatedProduct = await tx.product.update({
        where: { id: product.id },
        data: { stockReserved: { increment: input.quantity } },
      });

      // Upsert Customer
      const customer = await tx.customer.upsert({
        where: {
          vendorId_whatsappPhone: {
            vendorId: vendor.id,
            whatsappPhone: input.customerPhone,
          },
        },
        update: {
          ...(input.customerName ? { name: input.customerName } : {}),
          ...(input.deliveryAddress ? { defaultAddress: input.deliveryAddress } : {}),
          ...(input.shippingZoneId ? { defaultZoneId: input.shippingZoneId } : {}),
        },
        create: {
          vendorId: vendor.id,
          whatsappPhone: input.customerPhone,
          name: input.customerName,
          defaultAddress: input.deliveryAddress,
          defaultZoneId: input.shippingZoneId,
        },
      });

      // Resolve Shipping Fee
      let shippingFeeKobo = 0n;
      let resolvedZoneId: string | undefined;
      if (input.shippingZoneId) {
        const zone = await tx.shippingZone.findFirst({
          where: { id: input.shippingZoneId, vendorId: vendor.id, isActive: true },
        });
        if (zone) {
          shippingFeeKobo = zone.feeKobo;
          resolvedZoneId = zone.id;
        }
      }

      const subtotalKobo = product.basePriceKobo * BigInt(input.quantity);

      // Resolve Discount Code
      let discountAmountKobo = 0n;
      let resolvedDiscountId: string | undefined;
      let resolvedDiscountCode: string | undefined;

      if (input.discountCode) {
        const cleanCode = input.discountCode.trim().toUpperCase();
        const discount = await tx.discount.findUnique({
          where: { vendorId_code: { vendorId: vendor.id, code: cleanCode } },
        });
        if (
          discount &&
          discount.isActive &&
          (!discount.expiresAt || discount.expiresAt > new Date()) &&
          (discount.maxUses === null || discount.usedCount < discount.maxUses)
        ) {
          discountAmountKobo = computeDiscountKobo({
            subtotalKobo,
            discountType: discount.type,
            discountValue: discount.value,
            minOrderKobo: discount.minOrderKobo,
          });
          if (discountAmountKobo > 0n) {
            resolvedDiscountId = discount.id;
            resolvedDiscountCode = discount.code;
            await tx.discount.update({
              where: { id: discount.id },
              data: { usedCount: { increment: 1 } },
            });
          }
        }
      }

      const pricing = computeOrderTotalKobo({
        subtotalKobo,
        shippingFeeKobo,
        discountAmountKobo,
      });

      const orderCount = await tx.order.count({ where: { vendorId: vendor.id } });
      const shortCode = `ORD-${900 + orderCount + 1}`;
      const expiresAt = new Date(Date.now() + vendor.reservationTtlMinutes * 60 * 1000);

      const order = await tx.order.create({
        data: {
          vendorId: vendor.id,
          customerId: customer.id,
          shortCode,
          channel: input.channel ?? "WHATSAPP_CHAT",
          status: "PENDING_PAYMENT",
          subtotalKobo: pricing.subtotalKobo,
          shippingZoneId: resolvedZoneId,
          shippingFeeKobo: pricing.shippingFeeKobo,
          discountId: resolvedDiscountId,
          discountCode: resolvedDiscountCode,
          discountAmountKobo: pricing.discountAmountKobo,
          totalAmountKobo: pricing.totalAmountKobo,
          amountPaidKobo: 0n,
          deliveryAddress: input.deliveryAddress ?? customer.defaultAddress,
          paymentExpiresAt: expiresAt,
          items: {
            create: {
              productId: product.id,
              productNameSnap: product.name,
              quantity: input.quantity,
              unitPriceKobo: product.basePriceKobo,
              lineTotalKobo: subtotalKobo,
            },
          },
          reservations: {
            create: {
              productId: product.id,
              quantity: input.quantity,
              status: "ACTIVE",
              expiresAt,
            },
          },
        },
      });

      return {
        order,
        product,
        customer,
        expiresAt,
        remainingAvailableStock: updatedProduct.stockTotal - updatedProduct.stockReserved,
      };
    });

    // Generate Dynamic Monnify Virtual Account (10-digit NUBAN)
    const virtualAccount = await this.paymentPort.createDynamicVirtualAccount({
      orderId: txResult.order.id,
      orderShortCode: txResult.order.shortCode,
      vendorBusinessName: vendor.businessName,
      vendorSubAccountCode: vendor.monnifySubAccountCode,
      customerName: txResult.customer.name,
      customerPhone: txResult.customer.whatsappPhone,
      expectedAmountKobo: txResult.order.totalAmountKobo,
      expiresAt: txResult.expiresAt,
    });

    const invoice = await this.db.paymentInvoice.create({
      data: {
        orderId: txResult.order.id,
        provider: virtualAccount.provider,
        invoiceReference: virtualAccount.invoiceReference,
        expectedAmountKobo: txResult.order.totalAmountKobo,
        accountNumber: virtualAccount.accountNumber,
        bankName: virtualAccount.bankName,
        accountName: virtualAccount.accountName,
        checkoutUrl: virtualAccount.checkoutUrl,
        status: "ACTIVE",
        expiresAt: virtualAccount.expiresAt,
      },
    });

    // Send formatted invoice + 1-tap copyable NUBAN bubble in WhatsApp
    await this.messagingPort.sendVirtualAccountInvoice({
      toBuyerPhone: txResult.customer.whatsappPhone,
      vendorBusinessName: vendor.businessName,
      isVendorVerified: vendor.verificationStatus === "VERIFIED",
      orderShortCode: txResult.order.shortCode,
      productSummary: `${txResult.product.name} (x${input.quantity})`,
      totalAmountFormatted: formatNaira(txResult.order.totalAmountKobo),
      bankName: invoice.bankName,
      accountNumber: invoice.accountNumber,
      accountName: invoice.accountName,
      expiresInMinutes: vendor.reservationTtlMinutes,
      vendorPhoneId: vendor.whatsappPhoneId,
    });

    await this.eventBus.publish({
      eventType: "ORDER_CREATED",
      vendorId: vendor.id,
      actorType: "COPILOT_AUTO",
      entityType: "ORDER",
      entityId: txResult.order.id,
      payload: {
        shortCode: txResult.order.shortCode,
        totalAmountKobo: txResult.order.totalAmountKobo.toString(),
        accountNumber: invoice.accountNumber,
      },
      occurredAt: new Date(),
    });

    return {
      order: txResult.order,
      invoice,
      productName: txResult.product.name,
      remainingAvailableStock: txResult.remainingAvailableStock,
    };
  }

  /**
   * Principle 10.2: Server-Verified Webhook Payment Reconciliation.
   * Calls PaymentProviderPort.verifyTransactionServerToServer before changing order state.
   */
  public async reconcileWebhookPayment(params: {
    providerTransactionRef: string;
    webhookSignatureValid: boolean;
  }): Promise<{
    order: Order;
    alreadyProcessed: boolean;
    reconciliationStatus: "PAID" | "PARTIALLY_PAID";
    remainingBalanceKobo: bigint;
  }> {
    if (!params.webhookSignatureValid) {
      throw new Error("Rejected webhook: Invalid cryptographic HMAC signature.");
    }

    // 1. Idempotency check: has this providerTransactionRef already been processed?
    const existingTx = await this.db.paymentTransaction.findUnique({
      where: { providerTransactionRef: params.providerTransactionRef },
      include: { invoice: { include: { order: true } } },
    });
    if (existingTx) {
      const ord = existingTx.invoice.order;
      return {
        order: ord,
        alreadyProcessed: true,
        reconciliationStatus: ord.status === "PARTIALLY_PAID" ? "PARTIALLY_PAID" : "PAID",
        remainingBalanceKobo:
          ord.totalAmountKobo > ord.amountPaidKobo ? ord.totalAmountKobo - ord.amountPaidKobo : 0n,
      };
    }

    // 2. Principle 10.2: Independent Server-to-Server Verification
    const verified = await this.paymentPort.verifyTransactionServerToServer(
      params.providerTransactionRef
    );

    if (
      verified.paymentStatus !== "PAID" &&
      verified.paymentStatus !== "OVERPAID" &&
      verified.paymentStatus !== "PARTIALLY_PAID"
    ) {
      throw new Error(
        `Server-to-server verification did not confirm payment. Status: ${verified.paymentStatus}`
      );
    }

    const invoice = await this.db.paymentInvoice.findUnique({
      where: { invoiceReference: verified.invoiceReference },
      include: {
        order: {
          include: {
            vendor: true,
            customer: true,
            items: true,
            reservations: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new Error(`PaymentInvoice not found for reference: ${verified.invoiceReference}`);
    }

    const order = invoice.order;
    const decision = evaluatePaymentReconciliation({
      totalAmountKobo: order.totalAmountKobo,
      previousAmountPaidKobo: order.amountPaidKobo,
      verifiedIncomingKobo: verified.amountPaidKobo,
    });

    assertValidOrderTransition(
      order.status as DomainOrderStatus,
      decision.nextStatus
    );

    // 3. Apply ACID state transition, stock consumption, and transaction logging
    const updatedOrder = await this.db.$transaction(async (tx) => {
      await tx.paymentTransaction.create({
        data: {
          invoiceId: invoice.id,
          providerTransactionRef: verified.providerTransactionRef,
          paymentReference: verified.paymentReference,
          amountPaidKobo: verified.amountPaidKobo,
          settlementAmountKobo: verified.settlementAmountKobo,
          payerName: verified.payerName,
          payerBankName: verified.payerBankName,
          paymentMethod: verified.paymentMethod,
          webhookSignatureValid: true,
          serverVerifiedAt: verified.serverVerifiedAt,
          rawVerificationJson: verified.rawResponse as object,
        },
      });

      if (decision.nextStatus === "PAID") {
        await tx.paymentInvoice.update({
          where: { id: invoice.id },
          data: { status: "PAID" },
        });

        // Consume active stock reservations and permanently decrement product stockTotal
        for (const resv of order.reservations) {
          if (resv.status === "ACTIVE") {
            await tx.stockReservation.update({
              where: { id: resv.id },
              data: { status: "CONSUMED" },
            });
            await tx.product.update({
              where: { id: resv.productId },
              data: {
                stockTotal: { decrement: resv.quantity },
                stockReserved: { decrement: resv.quantity },
              },
            });
          }
        }

        await tx.customer.update({
          where: { id: order.customerId },
          data: {
            totalOrdersCount: { increment: 1 },
            lifetimeSpendKobo: { increment: decision.newAmountPaidKobo },
            lastOrderAt: new Date(),
          },
        });

        return tx.order.update({
          where: { id: order.id },
          data: {
            status: "PAID",
            amountPaidKobo: decision.newAmountPaidKobo,
            paidAt: new Date(),
          },
        });
      } else {
        // PARTIALLY_PAID: Extend stock reservation hold by +30 mins so buyer can send balance
        const extendedExpiry = new Date(Date.now() + 30 * 60 * 1000);
        await tx.stockReservation.updateMany({
          where: { orderId: order.id, status: "ACTIVE" },
          data: { expiresAt: extendedExpiry },
        });

        return tx.order.update({
          where: { id: order.id },
          data: {
            status: "PARTIALLY_PAID",
            amountPaidKobo: decision.newAmountPaidKobo,
            paymentExpiresAt: extendedExpiry,
          },
        });
      }
    });

    // 4. Push automated WhatsApp updates into both Buyer and Vendor threads
    if (decision.nextStatus === "PAID") {
      await this.messagingPort.sendTextMessage({
        toPhone: order.customer.whatsappPhone,
        vendorPhoneId: order.vendor.whatsappPhoneId,
        text: `✅ *Payment Confirmed!* (${formatNaira(decision.newAmountPaidKobo)})\n🧾 Receipt: *${order.shortCode}*\n🏪 Vendor: *${order.vendor.businessName}*\n\nYour order is now being packed for dispatch!`,
      });

      await this.messagingPort.sendTextMessage({
        toPhone: order.vendor.whatsappPhone,
        vendorPhoneId: order.vendor.whatsappPhoneId,
        text: `🔔 *PAID ORDER ${order.shortCode}!*\n💰 Received: *${formatNaira(decision.newAmountPaidKobo)}* from ${verified.payerName ?? order.customer.whatsappPhone}\n📦 Item: ${order.items.map((i) => `${i.productNameSnap} x${i.quantity}`).join(", ")}\n\nReply *dispatch ${order.shortCode} <riderPhone>* when handed to rider.`,
      });

      await this.eventBus.publish({
        eventType: "PAYMENT_FULLY_VERIFIED",
        vendorId: order.vendorId,
        actorType: "WEBHOOK_VERIFIED",
        entityType: "ORDER",
        entityId: order.id,
        payload: {
          shortCode: order.shortCode,
          amountPaidKobo: decision.newAmountPaidKobo.toString(),
        },
        occurredAt: new Date(),
      });
    } else {
      await this.messagingPort.sendTextMessage({
        toPhone: order.customer.whatsappPhone,
        vendorPhoneId: order.vendor.whatsappPhoneId,
        text: `⚠️ *Partial Payment Received (${formatNaira(verified.amountPaidKobo)})*\n🧾 Order: *${order.shortCode}*\n💰 Total Due: *${formatNaira(order.totalAmountKobo)}*\n❗ *Remaining Balance: ${formatNaira(decision.remainingBalanceKobo)}*\n\nYour item lock has been extended by 30 mins. Please transfer the remaining *${formatNaira(decision.remainingBalanceKobo)}* to *${invoice.accountNumber}* (${invoice.bankName}) to complete your order.`,
      });

      await this.eventBus.publish({
        eventType: "PAYMENT_PARTIALLY_VERIFIED",
        vendorId: order.vendorId,
        actorType: "WEBHOOK_VERIFIED",
        entityType: "ORDER",
        entityId: order.id,
        payload: {
          shortCode: order.shortCode,
          amountPaidKobo: decision.newAmountPaidKobo.toString(),
          remainingBalanceKobo: decision.remainingBalanceKobo.toString(),
        },
        occurredAt: new Date(),
      });
    }

    return {
      order: updatedOrder,
      alreadyProcessed: false,
      reconciliationStatus: decision.nextStatus,
      remainingBalanceKobo: decision.remainingBalanceKobo,
    };
  }

  /**
   * Releases reserved stock when the vendor's configured reservation TTL (default 15 mins) expires.
   */
  public async expireUnpaidOrderReservation(orderId: string): Promise<Order | null> {
    const order = await this.db.order.findUnique({
      where: { id: orderId },
      include: { reservations: true, invoices: true },
    });
    if (!order || order.status !== "PENDING_PAYMENT") {
      return null;
    }

    const updated = await this.db.$transaction(async (tx) => {
      for (const resv of order.reservations) {
        if (resv.status === "ACTIVE") {
          await tx.stockReservation.update({
            where: { id: resv.id },
            data: { status: "RELEASED" },
          });
          await tx.product.update({
            where: { id: resv.productId },
            data: { stockReserved: { decrement: resv.quantity } },
          });
        }
      }

      await tx.paymentInvoice.updateMany({
        where: { orderId: order.id, status: "ACTIVE" },
        data: { status: "EXPIRED" },
      });

      return tx.order.update({
        where: { id: order.id },
        data: { status: "EXPIRED" },
      });
    });

    await this.eventBus.publish({
      eventType: "ORDER_EXPIRED",
      vendorId: order.vendorId,
      actorType: "SYSTEM_TIMER",
      entityType: "ORDER",
      entityId: order.id,
      payload: { shortCode: order.shortCode },
      occurredAt: new Date(),
    });

    return updated;
  }

  public async listOrdersByStatus(
    vendorId: string,
    status?: OrderStatus
  ) {
    return this.db.order.findMany({
      where: {
        vendorId,
        ...(status ? { status } : {}),
      },
      include: {
        customer: true,
        items: true,
        invoices: true,
        shippingZone: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  public async markOrderDispatched(
    vendorId: string,
    shortCode: string,
    riderPhone: string | undefined,
    actor: ActorSource
  ): Promise<Order> {
    const normalizedCode = shortCode.trim().toUpperCase();
    const order = await this.db.order.findUnique({
      where: { vendorId_shortCode: { vendorId, shortCode: normalizedCode } },
      include: { customer: true, vendor: true },
    });
    if (!order) {
      throw new Error(`Order ${normalizedCode} not found.`);
    }

    assertValidOrderTransition(order.status as DomainOrderStatus, "OUT_FOR_DELIVERY");

    const updated = await this.db.order.update({
      where: { id: order.id },
      data: {
        status: "OUT_FOR_DELIVERY",
        riderPhone: riderPhone ?? order.riderPhone,
        dispatchedAt: new Date(),
      },
    });

    await this.messagingPort.sendTextMessage({
      toPhone: order.customer.whatsappPhone,
      vendorPhoneId: order.vendor.whatsappPhoneId,
      text: `🚚 *Order ${order.shortCode} is Out for Delivery!*\n🏪 Vendor: *${order.vendor.businessName}*${
        riderPhone ? `\n📞 Dispatch Rider: *${riderPhone}*` : ""
      }`,
    });

    await this.eventBus.publish({
      eventType: "ORDER_DISPATCHED",
      vendorId,
      actorType: actor,
      entityType: "ORDER",
      entityId: order.id,
      payload: { shortCode: order.shortCode, riderPhone },
      occurredAt: new Date(),
    });

    return updated;
  }
}

