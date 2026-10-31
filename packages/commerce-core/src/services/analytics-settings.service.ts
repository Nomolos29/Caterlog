import type { CopilotMode, PrismaClient, Vendor } from "@caterlog/database";
import type { ActorSource, InMemoryDomainEventBus } from "../domain/events.ts";
import type { DomainCopilotMode } from "../domain/copilot-policy.ts";

export interface TransactionalBreakdown {
  range: "today" | "week" | "month";
  paidOrdersCount: number;
  paidGrossKobo: bigint;
  pendingOrdersCount: number;
  pendingAmountKobo: bigint;
  shippingCollectedKobo: bigint;
  discountsGivenKobo: bigint;
  netProductRevenueKobo: bigint;
}

export class AnalyticsSettingsService {
  private readonly db: PrismaClient;
  private readonly eventBus: InMemoryDomainEventBus;

  constructor(db: PrismaClient, eventBus: InMemoryDomainEventBus) {
    this.db = db;
    this.eventBus = eventBus;
  }

  public async getTransactionalBreakdown(
    vendorId: string,
    range: "today" | "week" | "month"
  ): Promise<TransactionalBreakdown> {
    const now = new Date();
    const startDate = new Date(now);
    if (range === "today") {
      startDate.setHours(0, 0, 0, 0);
    } else if (range === "week") {
      startDate.setDate(now.getDate() - 7);
    } else {
      startDate.setDate(now.getDate() - 30);
    }

    const orders = await this.db.order.findMany({
      where: {
        vendorId,
        createdAt: { gte: startDate },
      },
    });

    let paidOrdersCount = 0;
    let paidGrossKobo = 0n;
    let pendingOrdersCount = 0;
    let pendingAmountKobo = 0n;
    let shippingCollectedKobo = 0n;
    let discountsGivenKobo = 0n;
    let netProductRevenueKobo = 0n;

    for (const ord of orders) {
      if (
        ord.status === "PAID" ||
        ord.status === "PROCESSING" ||
        ord.status === "OUT_FOR_DELIVERY" ||
        ord.status === "FULFILLED"
      ) {
        paidOrdersCount += 1;
        paidGrossKobo += ord.amountPaidKobo;
        shippingCollectedKobo += ord.shippingFeeKobo;
        discountsGivenKobo += ord.discountAmountKobo;
        const net =
          ord.subtotalKobo > ord.discountAmountKobo
            ? ord.subtotalKobo - ord.discountAmountKobo
            : 0n;
        netProductRevenueKobo += net;
      } else if (ord.status === "PENDING_PAYMENT" || ord.status === "PARTIALLY_PAID") {
        pendingOrdersCount += 1;
        pendingAmountKobo += ord.totalAmountKobo - ord.amountPaidKobo;
      }
    }

    return {
      range,
      paidOrdersCount,
      paidGrossKobo,
      pendingOrdersCount,
      pendingAmountKobo,
      shippingCollectedKobo,
      discountsGivenKobo,
      netProductRevenueKobo,
    };
  }

  public async updateCopilotSettings(
    vendorId: string,
    params: { mode: DomainCopilotMode; idleSeconds?: number },
    actor: ActorSource
  ): Promise<Vendor> {
    const vendor = await this.db.vendor.update({
      where: { id: vendorId },
      data: {
        copilotMode: params.mode as CopilotMode,
        ...(params.idleSeconds !== undefined
          ? { copilotIdleSeconds: Math.max(5, params.idleSeconds) }
          : {}),
      },
    });

    await this.db.commerceEvent.create({
      data: {
        vendorId,
        eventType: "VENDOR_SETTINGS_UPDATED",
        actorType: actor,
        entityType: "VENDOR",
        entityId: vendor.id,
        payload: {
          copilotMode: vendor.copilotMode,
          copilotIdleSeconds: vendor.copilotIdleSeconds,
        },
      },
    });

    await this.eventBus.publish({
      eventType: "VENDOR_SETTINGS_UPDATED",
      vendorId,
      actorType: actor,
      entityType: "VENDOR",
      entityId: vendor.id,
      payload: {
        copilotMode: vendor.copilotMode,
        copilotIdleSeconds: vendor.copilotIdleSeconds,
      },
      occurredAt: new Date(),
    });

    return vendor;
  }

  public async updateReservationTtl(
    vendorId: string,
    minutes: number,
    actor: ActorSource
  ): Promise<Vendor> {
    const clamped = Math.min(180, Math.max(5, minutes));
    const vendor = await this.db.vendor.update({
      where: { id: vendorId },
      data: { reservationTtlMinutes: clamped },
    });

    await this.db.commerceEvent.create({
      data: {
        vendorId,
        eventType: "VENDOR_SETTINGS_UPDATED",
        actorType: actor,
        entityType: "VENDOR",
        entityId: vendor.id,
        payload: { reservationTtlMinutes: vendor.reservationTtlMinutes },
      },
    });

    await this.eventBus.publish({
      eventType: "VENDOR_SETTINGS_UPDATED",
      vendorId,
      actorType: actor,
      entityType: "VENDOR",
      entityId: vendor.id,
      payload: { reservationTtlMinutes: vendor.reservationTtlMinutes },
      occurredAt: new Date(),
    });

    return vendor;
  }
}

