import type { ServerVerifiedPaymentRecord } from "@caterlog/commerce-core";
import type {
  RuntimeDiscount,
  RuntimeOrder,
  RuntimeProduct,
  RuntimeShippingZone,
  RuntimeSnapshot,
  RuntimeVendor,
} from "../runtime-types.ts";

export type DataMode = "memory" | "database";

export interface PersistenceEvent {
  eventType: string;
  actorType: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
}

/**
 * Write-through persistence contract used by the runtime engine.
 *
 * `memory` keeps the Stage 1 demo fully in-process; `database` hydrates the
 * engine from PostgreSQL and mirrors every mutation back to Prisma.
 */
export interface PersistenceStore {
  readonly mode: DataMode;

  /** Loads a vendor and its catalog/orders. Returns null when the vendor is missing. */
  loadSnapshot(vendorSlug: string): Promise<RuntimeSnapshot | null>;

  saveVendor(vendor: RuntimeVendor): Promise<void>;
  saveProduct(product: RuntimeProduct): Promise<void>;
  saveShippingZone(zone: RuntimeShippingZone): Promise<void>;
  saveDiscount(discount: RuntimeDiscount): Promise<void>;

  createOrder(order: RuntimeOrder, product: RuntimeProduct): Promise<void>;
  saveOrder(order: RuntimeOrder): Promise<void>;
  recordPayment(order: RuntimeOrder, verified: ServerVerifiedPaymentRecord): Promise<void>;

  recordEvent(event: PersistenceEvent): Promise<void>;
  close(): Promise<void>;
}
