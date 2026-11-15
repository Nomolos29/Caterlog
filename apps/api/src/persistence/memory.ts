import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ServerVerifiedPaymentRecord } from "@caterlog/commerce-core";
import type {
  BuyerConversationSession,
  ChatThreadMessage,
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
  RuntimeTeamMember,
  RuntimeVendor,
  RuntimeVendorNotification,
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
      chatMessages: snapshot.chatMessages ? [...snapshot.chatMessages] : [],
      buyerSessions: snapshot.buyerSessions ? [...snapshot.buyerSessions] : [],
      marketBoostListing: snapshot.marketBoostListing ? { ...snapshot.marketBoostListing } : null,
      suppliers: snapshot.suppliers ? [...snapshot.suppliers] : [],
      resellerMirrors: snapshot.resellerMirrors ? [...snapshot.resellerMirrors] : [],
      paymentLinks: snapshot.paymentLinks ? [...snapshot.paymentLinks] : [],
      payoutWithdrawals: snapshot.payoutWithdrawals ? [...snapshot.payoutWithdrawals] : [],
      settlementSplitRules: snapshot.settlementSplitRules ? [...snapshot.settlementSplitRules] : [],
      kycSubmissions: snapshot.kycSubmissions ? [...snapshot.kycSubmissions] : [],
      teamMembers: snapshot.teamMembers ? [...snapshot.teamMembers] : [],
      notifications: snapshot.notifications ? [...snapshot.notifications] : [],
      commerceEvents: snapshot.commerceEvents ? [...snapshot.commerceEvents] : [],
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

  public async recordEvent(event: PersistenceEvent): Promise<void> {
    if (!this.snapshot) return;
    if (!this.snapshot.commerceEvents) this.snapshot.commerceEvents = [];
    this.snapshot.commerceEvents.unshift({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      eventType: event.eventType,
      actorType: event.actorType,
      entityType: event.entityType,
      entityId: event.entityId,
      payload: event.payload,
      createdAt: new Date(),
    });
    this.flush();
  }

  public async saveChatMessage(message: ChatThreadMessage): Promise<void> {
    if (!this.snapshot) return;
    if (!this.snapshot.chatMessages) this.snapshot.chatMessages = [];
    if (!this.snapshot.chatMessages.some((m) => m.id === message.id)) {
      this.snapshot.chatMessages.push({ ...message });
      this.flush();
    }
  }

  public async saveBuyerSession(session: BuyerConversationSession): Promise<void> {
    if (!this.snapshot) return;
    if (!this.snapshot.buyerSessions) this.snapshot.buyerSessions = [];
    const idx = this.snapshot.buyerSessions.findIndex((s) => s.buyerPhone === session.buyerPhone);
    if (idx >= 0) {
      this.snapshot.buyerSessions[idx] = { ...session };
    } else {
      this.snapshot.buyerSessions.push({ ...session });
    }
    this.flush();
  }

  public async deleteBuyerSession(buyerPhone: string): Promise<void> {
    if (!this.snapshot?.buyerSessions) return;
    this.snapshot.buyerSessions = this.snapshot.buyerSessions.filter(
      (s) => s.buyerPhone !== buyerPhone
    );
    this.flush();
  }

  public async saveMarketBoostListing(listing: RuntimeMarketBoostListing): Promise<void> {
    if (!this.snapshot) return;
    this.snapshot.marketBoostListing = { ...listing };
    this.flush();
  }

  public async saveResellerMirror(mirror: RuntimeResellerMirror): Promise<void> {
    if (!this.snapshot) return;
    if (!this.snapshot.resellerMirrors) this.snapshot.resellerMirrors = [];
    const idx = this.snapshot.resellerMirrors.findIndex(
      (m) => m.supplierId === mirror.supplierId || m.id === mirror.id
    );
    if (idx >= 0) {
      this.snapshot.resellerMirrors[idx] = { ...mirror };
    } else {
      this.snapshot.resellerMirrors.unshift({ ...mirror });
    }
    this.flush();
  }

  public async saveSupplierProfile(supplier: import("../runtime-types.ts").RuntimeSupplierProfile): Promise<void> {
    if (!this.snapshot) return;
    if (!this.snapshot.suppliers) this.snapshot.suppliers = [];
    const idx = this.snapshot.suppliers.findIndex(
      (s) => s.id === supplier.id || s.slug === supplier.slug
    );
    if (idx >= 0) {
      this.snapshot.suppliers[idx] = { ...supplier };
    } else {
      this.snapshot.suppliers.push({ ...supplier });
    }
    this.flush();
  }

  public async savePaymentLink(link: RuntimePaymentLink): Promise<void> {
    if (!this.snapshot) return;
    if (!this.snapshot.paymentLinks) this.snapshot.paymentLinks = [];
    const idx = this.snapshot.paymentLinks.findIndex((l) => l.slug === link.slug);
    if (idx >= 0) {
      this.snapshot.paymentLinks[idx] = { ...link };
    } else {
      this.snapshot.paymentLinks.unshift({ ...link });
    }
    this.flush();
  }

  public async deletePaymentLink(slug: string): Promise<void> {
    if (!this.snapshot?.paymentLinks) return;
    this.snapshot.paymentLinks = this.snapshot.paymentLinks.filter((l) => l.slug !== slug);
    this.flush();
  }

  public async savePayoutWithdrawal(withdrawal: RuntimePayoutWithdrawal): Promise<void> {
    if (!this.snapshot) return;
    if (!this.snapshot.payoutWithdrawals) this.snapshot.payoutWithdrawals = [];
    this.snapshot.payoutWithdrawals.unshift({ ...withdrawal });
    this.flush();
  }

  public async saveSettlementSplitRule(rule: RuntimeSettlementSplitRule): Promise<void> {
    if (!this.snapshot) return;
    if (!this.snapshot.settlementSplitRules) this.snapshot.settlementSplitRules = [];
    const idx = this.snapshot.settlementSplitRules.findIndex((r) => r.id === rule.id);
    if (idx >= 0) {
      this.snapshot.settlementSplitRules[idx] = { ...rule };
    } else {
      this.snapshot.settlementSplitRules.unshift({ ...rule });
    }
    this.flush();
  }

  public async saveKycSubmission(submission: RuntimeKycSubmission): Promise<void> {
    if (!this.snapshot) return;
    if (!this.snapshot.kycSubmissions) this.snapshot.kycSubmissions = [];
    this.snapshot.kycSubmissions.unshift({ ...submission });
    this.flush();
  }

  public async saveTeamMember(member: RuntimeTeamMember): Promise<void> {
    if (!this.snapshot) return;
    if (!this.snapshot.teamMembers) this.snapshot.teamMembers = [];
    const idx = this.snapshot.teamMembers.findIndex(
      (m) => m.id === member.id || m.email.toLowerCase() === member.email.toLowerCase()
    );
    if (idx >= 0) {
      this.snapshot.teamMembers[idx] = { ...member };
    } else {
      this.snapshot.teamMembers.push({ ...member });
    }
    this.flush();
  }

  public async deleteTeamMember(idOrEmail: string): Promise<void> {
    if (!this.snapshot?.teamMembers) return;
    this.snapshot.teamMembers = this.snapshot.teamMembers.filter(
      (m) => m.id !== idOrEmail && m.email.toLowerCase() !== idOrEmail.toLowerCase()
    );
    this.flush();
  }

  public async saveNotification(notification: RuntimeVendorNotification): Promise<void> {
    if (!this.snapshot) return;
    if (!this.snapshot.notifications) this.snapshot.notifications = [];
    const idx = this.snapshot.notifications.findIndex(
      (n) => n.notificationKey === notification.notificationKey
    );
    if (idx >= 0) {
      this.snapshot.notifications[idx] = { ...notification };
    } else {
      this.snapshot.notifications.unshift({ ...notification });
    }
    this.flush();
  }

  public async syncNotifications(input: {
    readKeys?: string[];
    dismissedKeys?: string[];
    markAllRead?: boolean;
  }): Promise<void> {
    if (!this.snapshot?.notifications) return;
    for (const n of this.snapshot.notifications) {
      if (input.markAllRead || input.readKeys?.includes(n.notificationKey)) {
        n.isRead = true;
        n.readAt = new Date();
      }
      if (input.dismissedKeys?.includes(n.notificationKey)) {
        n.isDismissed = true;
      }
    }
    this.flush();
  }

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
