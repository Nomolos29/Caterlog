import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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

function serializeSnapshot(snapshot: RuntimeSnapshot): string {
  return JSON.stringify(
    snapshot,
    (_key, value) => {
      if (typeof value === "bigint") {
        return { __bigint: value.toString() };
      }
      if (value instanceof Date) {
        return { __date: value.toISOString() };
      }
      return value;
    },
    2
  );
}

function deserializeSnapshot(json: string): RuntimeSnapshot {
  return JSON.parse(json, (_key, value) => {
    if (value && typeof value === "object") {
      if ("__bigint" in value && typeof (value as { __bigint: unknown }).__bigint === "string") {
        return BigInt((value as { __bigint: string }).__bigint);
      }
      if ("__date" in value && typeof (value as { __date: unknown }).__date === "string") {
        return new Date((value as { __date: string }).__date);
      }
    }
    return value;
  }) as RuntimeSnapshot;
}

/**
 * File-backed durable store for `DATA_MODE=memory`.
 *
 * Saves vendor catalog, stock counters, orders, and configuration to a local
 * JSON snapshot (`.caterlog-dev-state.json`) so development restarts, hot reloads,
 * and logins NEVER lose products or inventory.
 */
export class MemoryPersistenceStore implements PersistenceStore {
  public readonly mode = "memory" as const;
  private readonly filePath: string;
  private snapshot: RuntimeSnapshot | null = null;

  constructor(filePath?: string) {
    this.filePath = filePath ?? join(process.cwd(), ".caterlog-dev-state.json");
  }

  public async loadSnapshot(_vendorSlug: string): Promise<RuntimeSnapshot | null> {
    if (this.snapshot) return this.snapshot;

    if (existsSync(this.filePath)) {
      try {
        const raw = readFileSync(this.filePath, "utf-8");
        this.snapshot = deserializeSnapshot(raw);
        return this.snapshot;
      } catch (err) {
        console.warn(`[caterlog:memory-store] Could not parse ${this.filePath}, falling back to seed:`, err);
      }
    }
    return null;
  }

  public initSnapshot(snapshot: RuntimeSnapshot): void {
    this.snapshot = {
      vendor: { ...snapshot.vendor },
      products: snapshot.products.map((p) => ({ ...p })),
      shippingZones: snapshot.shippingZones.map((z) => ({ ...z })),
      discounts: snapshot.discounts.map((d) => ({ ...d })),
      orders: snapshot.orders.map((o) => ({ ...o })),
      processedTransactionRefs: [...snapshot.processedTransactionRefs],
    };
    this.flush();
  }

  public async saveVendor(vendor: RuntimeVendor): Promise<void> {
    if (!this.snapshot) return;
    this.snapshot.vendor = { ...vendor };
    this.flush();
  }

  public async saveProduct(product: RuntimeProduct): Promise<void> {
    if (!this.snapshot) return;
    const existingIdx = this.snapshot.products.findIndex(
      (p) => p.skuCode.toUpperCase() === product.skuCode.toUpperCase()
    );
    if (existingIdx >= 0) {
      this.snapshot.products[existingIdx] = { ...product };
    } else {
      this.snapshot.products.unshift({ ...product });
    }
    this.flush();
  }

  public async deleteProduct(skuCode: string): Promise<void> {
    if (!this.snapshot) return;
    const clean = skuCode.trim().toUpperCase();
    this.snapshot.products = this.snapshot.products.filter(
      (p) => p.skuCode.toUpperCase() !== clean
    );
    this.flush();
  }

  public async saveShippingZone(zone: RuntimeShippingZone): Promise<void> {
    if (!this.snapshot) return;
    const existingIdx = this.snapshot.shippingZones.findIndex((z) => z.code === zone.code);
    if (existingIdx >= 0) {
      this.snapshot.shippingZones[existingIdx] = { ...zone };
    } else {
      this.snapshot.shippingZones.push({ ...zone });
    }
    this.flush();
  }

  public async saveDiscount(discount: RuntimeDiscount): Promise<void> {
    if (!this.snapshot) return;
    const existingIdx = this.snapshot.discounts.findIndex(
      (d) => d.code.toUpperCase() === discount.code.toUpperCase()
    );
    if (existingIdx >= 0) {
      this.snapshot.discounts[existingIdx] = { ...discount };
    } else {
      this.snapshot.discounts.push({ ...discount });
    }
    this.flush();
  }

  public async createOrder(order: RuntimeOrder, product: RuntimeProduct): Promise<void> {
    if (!this.snapshot) return;
    this.snapshot.orders.unshift({ ...order });
    await this.saveProduct(product);
  }

  public async saveOrder(order: RuntimeOrder): Promise<void> {
    if (!this.snapshot) return;
    const existingIdx = this.snapshot.orders.findIndex((o) => o.id === order.id);
    if (existingIdx >= 0) {
      this.snapshot.orders[existingIdx] = { ...order };
    } else {
      this.snapshot.orders.unshift({ ...order });
    }
    this.flush();
  }

  public async recordPayment(
    order: RuntimeOrder,
    verified: ServerVerifiedPaymentRecord
  ): Promise<void> {
    if (!this.snapshot) return;
    if (verified.providerTransactionRef) {
      this.snapshot.processedTransactionRefs.push(verified.providerTransactionRef);
    }
    await this.saveOrder(order);
  }

  public async recordEvent(_event: PersistenceEvent): Promise<void> {}

  public async close(): Promise<void> {
    this.flush();
  }

  private flush(): void {
    if (!this.snapshot) return;
    try {
      const serialized = serializeSnapshot(this.snapshot);
      writeFileSync(this.filePath, serialized, "utf-8");
    } catch (err) {
      console.warn(`[caterlog:memory-store] Failed to flush state to ${this.filePath}:`, err);
    }
  }
}

export function createMemoryPersistence(filePath?: string): MemoryPersistenceStore {
  return new MemoryPersistenceStore(filePath);
}
