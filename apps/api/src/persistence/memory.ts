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

/**
 * No-op store for `DATA_MODE=memory`.
 *
 * The engine itself already holds the demo state; every write intentionally
 * does nothing so local development needs no database at all.
 */
export class MemoryPersistenceStore implements PersistenceStore {
  public readonly mode = "memory" as const;

  public async loadSnapshot(_vendorSlug: string): Promise<RuntimeSnapshot | null> {
    return null;
  }

  public async saveVendor(_vendor: RuntimeVendor): Promise<void> {}
  public async saveProduct(_product: RuntimeProduct): Promise<void> {}
  public async saveShippingZone(_zone: RuntimeShippingZone): Promise<void> {}
  public async saveDiscount(_discount: RuntimeDiscount): Promise<void> {}
  public async createOrder(_order: RuntimeOrder, _product: RuntimeProduct): Promise<void> {}
  public async saveOrder(_order: RuntimeOrder): Promise<void> {}
  public async recordPayment(
    _order: RuntimeOrder,
    _verified: ServerVerifiedPaymentRecord
  ): Promise<void> {}
  public async recordEvent(_event: PersistenceEvent): Promise<void> {}
  public async close(): Promise<void> {}
}

export function createMemoryPersistence(): PersistenceStore {
  return new MemoryPersistenceStore();
}
