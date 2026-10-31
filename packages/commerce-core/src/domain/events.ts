/**
 * Cross-Layer Domain Event Bus
 *
 * Architectural Role:
 * Caterlog is built in 6 compounding layers. Instead of entangling Layer 1 (Chat Commerce)
 * with Layer 2 (Trust Reputation), Layer 3 (Auto-Generated Website Cache), Layer 5
 * (Multi-Channel Catalog Sync), or Layer 6 (Credit Underwriting Ledger), the core emits
 * strongly-typed Domain Events. Later layers subscribe to these events without modifying Layer 1.
 */

export type DomainEventType =
  | "ORDER_CREATED"
  | "PAYMENT_PARTIALLY_VERIFIED"
  | "PAYMENT_FULLY_VERIFIED"
  | "ORDER_DISPATCHED"
  | "ORDER_EXPIRED"
  | "INVENTORY_CHANGED"
  | "SHIPPING_ZONE_UPDATED"
  | "DISCOUNT_UPDATED"
  | "VENDOR_SETTINGS_UPDATED";

export type ActorSource =
  | "VENDOR_WA_KEYWORD"
  | "VENDOR_WEB_DASHBOARD"
  | "COPILOT_AUTO"
  | "WEBHOOK_VERIFIED"
  | "SYSTEM_TIMER";

export interface DomainEvent<TPayload = Record<string, unknown>> {
  readonly eventType: DomainEventType;
  readonly vendorId: string;
  readonly actorType: ActorSource;
  readonly entityType: "ORDER" | "PRODUCT" | "SHIPPING_ZONE" | "DISCOUNT" | "VENDOR";
  readonly entityId: string;
  readonly payload: TPayload;
  readonly occurredAt: Date;
}

export type DomainEventHandler<TPayload = Record<string, unknown>> = (
  event: DomainEvent<TPayload>
) => Promise<void> | void;

export class InMemoryDomainEventBus {
  private readonly handlers = new Map<DomainEventType | "*", DomainEventHandler[]>();

  /**
   * Subscribe a layer handler (e.g., Layer 3 Storefront ISR Revalidator or Layer 5 Meta Catalog Sync)
   * to specific domain events or "*" for the Layer 6 audit ledger.
   */
  public on<TPayload = Record<string, unknown>>(
    eventType: DomainEventType | "*",
    handler: DomainEventHandler<TPayload>
  ): void {
    const existing = this.handlers.get(eventType) ?? [];
    existing.push(handler as DomainEventHandler);
    this.handlers.set(eventType, existing);
  }

  public async publish<TPayload = Record<string, unknown>>(
    event: DomainEvent<TPayload>
  ): Promise<void> {
    const specificHandlers = this.handlers.get(event.eventType) ?? [];
    const wildcardHandlers = this.handlers.get("*") ?? [];
    for (const handler of [...specificHandlers, ...wildcardHandlers]) {
      await handler(event as DomainEvent);
    }
  }
}

