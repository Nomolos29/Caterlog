import type { Discount, PrismaClient, ShippingZone } from "@caterlog/database";
import type { ActorSource, InMemoryDomainEventBus } from "../domain/events.ts";

export class ShippingDiscountService {
  private readonly db: PrismaClient;
  private readonly eventBus: InMemoryDomainEventBus;

  constructor(db: PrismaClient, eventBus: InMemoryDomainEventBus) {
    this.db = db;
    this.eventBus = eventBus;
  }

  public async listShippingZones(vendorId: string): Promise<ShippingZone[]> {
    return this.db.shippingZone.findMany({
      where: { vendorId, isActive: true },
      orderBy: { code: "asc" },
    });
  }

  public async upsertShippingZone(
    vendorId: string,
    name: string,
    feeKobo: bigint,
    actor: ActorSource
  ): Promise<ShippingZone> {
    const cleanName = name.trim();
    const existing = await this.db.shippingZone.findUnique({
      where: { vendorId_name: { vendorId, name: cleanName } },
    });

    let code = existing?.code;
    if (!code) {
      const maxZone = await this.db.shippingZone.findFirst({
        where: { vendorId },
        orderBy: { code: "desc" },
      });
      code = (maxZone?.code ?? 0) + 1;
    }

    const zone = await this.db.shippingZone.upsert({
      where: { vendorId_name: { vendorId, name: cleanName } },
      update: { feeKobo, isActive: true, code },
      create: { vendorId, code, name: cleanName, feeKobo, isActive: true },
    });

    await this.db.commerceEvent.create({
      data: {
        vendorId,
        eventType: "SHIPPING_ZONE_UPDATED",
        actorType: actor,
        entityType: "SHIPPING_ZONE",
        entityId: zone.id,
        payload: { code: zone.code, name: zone.name, feeKobo: zone.feeKobo.toString() },
      },
    });

    await this.eventBus.publish({
      eventType: "SHIPPING_ZONE_UPDATED",
      vendorId,
      actorType: actor,
      entityType: "SHIPPING_ZONE",
      entityId: zone.id,
      payload: { code: zone.code, name: zone.name, feeKobo: zone.feeKobo.toString() },
      occurredAt: new Date(),
    });

    return zone;
  }

  public async deleteShippingZoneByCode(
    vendorId: string,
    code: number,
    actor: ActorSource
  ): Promise<ShippingZone | null> {
    const target = await this.db.shippingZone.findFirst({
      where: { vendorId, code, isActive: true },
    });
    if (!target) return null;

    const updated = await this.db.shippingZone.update({
      where: { id: target.id },
      data: { isActive: false },
    });

    await this.eventBus.publish({
      eventType: "SHIPPING_ZONE_UPDATED",
      vendorId,
      actorType: actor,
      entityType: "SHIPPING_ZONE",
      entityId: updated.id,
      payload: { code: updated.code, name: updated.name, deleted: true },
      occurredAt: new Date(),
    });

    return updated;
  }

  public async listDiscounts(vendorId: string): Promise<Discount[]> {
    return this.db.discount.findMany({
      where: { vendorId, isActive: true },
      orderBy: { startsAt: "desc" },
    });
  }

  public async upsertDiscount(
    vendorId: string,
    input: {
      code: string;
      type: "PERCENTAGE" | "FLAT_KOBO";
      value: bigint;
      minOrderKobo?: bigint;
      maxUses?: number;
    },
    actor: ActorSource
  ): Promise<Discount> {
    const cleanCode = input.code.trim().toUpperCase();
    const discount = await this.db.discount.upsert({
      where: { vendorId_code: { vendorId, code: cleanCode } },
      update: {
        type: input.type,
        value: input.value,
        minOrderKobo: input.minOrderKobo ?? 0n,
        maxUses: input.maxUses,
        isActive: true,
      },
      create: {
        vendorId,
        code: cleanCode,
        type: input.type,
        value: input.value,
        minOrderKobo: input.minOrderKobo ?? 0n,
        maxUses: input.maxUses,
        isActive: true,
      },
    });

    await this.db.commerceEvent.create({
      data: {
        vendorId,
        eventType: "DISCOUNT_UPDATED",
        actorType: actor,
        entityType: "DISCOUNT",
        entityId: discount.id,
        payload: {
          code: discount.code,
          type: discount.type,
          value: discount.value.toString(),
          isActive: true,
        },
      },
    });

    await this.eventBus.publish({
      eventType: "DISCOUNT_UPDATED",
      vendorId,
      actorType: actor,
      entityType: "DISCOUNT",
      entityId: discount.id,
      payload: { code: discount.code, type: discount.type, value: discount.value.toString() },
      occurredAt: new Date(),
    });

    return discount;
  }

  public async deactivateDiscount(
    vendorId: string,
    code: string,
    actor: ActorSource
  ): Promise<Discount | null> {
    const cleanCode = code.trim().toUpperCase();
    const existing = await this.db.discount.findUnique({
      where: { vendorId_code: { vendorId, code: cleanCode } },
    });
    if (!existing) return null;

    const updated = await this.db.discount.update({
      where: { id: existing.id },
      data: { isActive: false },
    });

    await this.eventBus.publish({
      eventType: "DISCOUNT_UPDATED",
      vendorId,
      actorType: actor,
      entityType: "DISCOUNT",
      entityId: updated.id,
      payload: { code: updated.code, isActive: false },
      occurredAt: new Date(),
    });

    return updated;
  }
}

