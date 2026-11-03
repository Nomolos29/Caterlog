import type { PrismaClient, Product } from "@caterlog/database";
import type { ActorSource, InMemoryDomainEventBus } from "../domain/events.ts";

/**
 * Computes Hamming distance between two 64-bit hex perceptual image hashes (`pHash`).
 * Used when a buyer swipes up on a vendor's WhatsApp Status photo and replies "I want this".
 */
export function computePhashHammingDistance(hashA: string, hashB: string): number {
  const cleanA = hashA.trim().toLowerCase();
  const cleanB = hashB.trim().toLowerCase();
  if (cleanA.length !== cleanB.length || cleanA.length === 0) {
    return 64;
  }
  try {
    let xor = BigInt(`0x${cleanA}`) ^ BigInt(`0x${cleanB}`);
    let distance = 0;
    while (xor > 0n) {
      distance += Number(xor & 1n);
      xor >>= 1n;
    }
    return distance;
  } catch {
    return 64;
  }
}

export class CatalogService {
  private readonly db: PrismaClient;
  private readonly eventBus: InMemoryDomainEventBus;

  constructor(db: PrismaClient, eventBus: InMemoryDomainEventBus) {
    this.db = db;
    this.eventBus = eventBus;
  }

  public async listProducts(vendorId: string): Promise<Product[]> {
    return this.db.product.findMany({
      where: { vendorId, isActive: true },
      orderBy: { createdAt: "desc" },
    });
  }

  public async findProductBySkuOrQuery(
    vendorId: string,
    query: string
  ): Promise<Product | null> {
    const cleaned = query.trim();
    const bySku = await this.db.product.findUnique({
      where: {
        vendorId_skuCode: {
          vendorId,
          skuCode: cleaned.toUpperCase(),
        },
      },
    });
    if (bySku) return bySku;

    return this.db.product.findFirst({
      where: {
        vendorId,
        isActive: true,
        name: { contains: cleaned, mode: "insensitive" },
      },
    });
  }

  /**
   * Matches an inbound WhatsApp Status quoted image pHash against the vendor's active catalog.
   */
  public async matchProductByStatusImagePhash(
    vendorId: string,
    incomingPhash: string,
    maxDistance = 8
  ): Promise<Product | null> {
    const candidates = await this.db.product.findMany({
      where: { vendorId, isActive: true, imagePhash: { not: null } },
    });

    let bestMatch: Product | null = null;
    let bestDistance = maxDistance + 1;

    for (const product of candidates) {
      if (!product.imagePhash) continue;
      const dist = computePhashHammingDistance(incomingPhash, product.imagePhash);
      if (dist <= maxDistance && dist < bestDistance) {
        bestDistance = dist;
        bestMatch = product;
      }
    }

    return bestMatch;
  }

  public async upsertProduct(
    vendorId: string,
    input: {
      skuCode?: string;
      name: string;
      description?: string;
      category?: string;
      basePriceKobo: bigint;
      stockTotal: number;
      primaryImageUrl?: string;
      imagePhash?: string;
    },
    actor: ActorSource
  ): Promise<Product> {
    const count = await this.db.product.count({ where: { vendorId } });
    const skuCode = (input.skuCode ?? `ITEM-${String(count + 1).padStart(2, "0")}`).toUpperCase();

    const product = await this.db.product.upsert({
      where: { vendorId_skuCode: { vendorId, skuCode } },
      update: {
        name: input.name,
        description: input.description,
        category: input.category,
        basePriceKobo: input.basePriceKobo,
        stockTotal: input.stockTotal,
        ...(input.primaryImageUrl ? { primaryImageUrl: input.primaryImageUrl } : {}),
        ...(input.imagePhash ? { imagePhash: input.imagePhash } : {}),
        isActive: true,
      },
      create: {
        vendorId,
        skuCode,
        name: input.name,
        description: input.description,
        category: input.category ?? "general",
        basePriceKobo: input.basePriceKobo,
        stockTotal: input.stockTotal,
        primaryImageUrl:
          input.primaryImageUrl ?? "https://placehold.co/800x800/111827/FFFFFF?text=Product",
        imagePhash: input.imagePhash,
      },
    });

    await this.recordAndPublishEvent({
      vendorId,
      actorType: actor,
      eventType: "INVENTORY_CHANGED",
      entityType: "PRODUCT",
      entityId: product.id,
      payload: {
        skuCode: product.skuCode,
        name: product.name,
        basePriceKobo: product.basePriceKobo.toString(),
        stockTotal: product.stockTotal,
        stockReserved: product.stockReserved,
      },
    });

    return product;
  }

  public async updateStock(
    vendorId: string,
    skuCode: string,
    newStockTotal: number,
    actor: ActorSource
  ): Promise<Product> {
    const normalizedSku = skuCode.trim().toUpperCase();
    const existing = await this.db.product.findUnique({
      where: { vendorId_skuCode: { vendorId, skuCode: normalizedSku } },
    });
    if (!existing) {
      throw new Error(`Product SKU "${normalizedSku}" not found.`);
    }
    if (newStockTotal < existing.stockReserved) {
      throw new Error(
        `Cannot set stock to ${newStockTotal} for "${existing.name}" because ${existing.stockReserved} unit(s) are currently reserved by buyers.`
      );
    }

    const product = await this.db.product.update({
      where: { vendorId_skuCode: { vendorId, skuCode: normalizedSku } },
      data: { stockTotal: Math.max(0, newStockTotal) },
    });

    await this.recordAndPublishEvent({
      vendorId,
      actorType: actor,
      eventType: "INVENTORY_CHANGED",
      entityType: "PRODUCT",
      entityId: product.id,
      payload: {
        skuCode: product.skuCode,
        stockTotal: product.stockTotal,
        stockReserved: product.stockReserved,
      },
    });

    return product;
  }

  private async recordAndPublishEvent(params: {
    vendorId: string;
    actorType: ActorSource;
    eventType: "INVENTORY_CHANGED";
    entityType: "PRODUCT";
    entityId: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.db.commerceEvent.create({
      data: {
        vendorId: params.vendorId,
        eventType: params.eventType,
        actorType: params.actorType,
        entityType: params.entityType,
        entityId: params.entityId,
        payload: params.payload as object,
      },
    });
    await this.eventBus.publish({
      ...params,
      occurredAt: new Date(),
    });
  }
}

