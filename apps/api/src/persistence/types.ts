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
  RuntimeSupplierProfile,
  RuntimeTeamMember,
  RuntimeVendor,
  RuntimeVendorNotification,
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
  deleteProduct(skuCode: string): Promise<void>;
  saveShippingZone(zone: RuntimeShippingZone): Promise<void>;
  saveDiscount(discount: RuntimeDiscount): Promise<void>;

  createOrder(order: RuntimeOrder, product: RuntimeProduct): Promise<void>;
  saveOrder(order: RuntimeOrder): Promise<void>;
  recordPayment(order: RuntimeOrder, verified: ServerVerifiedPaymentRecord): Promise<void>;

  saveChatMessage?(message: ChatThreadMessage): Promise<void>;
  saveBuyerSession?(session: BuyerConversationSession): Promise<void>;
  deleteBuyerSession?(buyerPhone: string): Promise<void>;

  saveOtpVerification?(input: {
    phone: string;
    code: string;
    purpose: string;
    expiresAt: Date;
  }): Promise<void>;
  consumeOtpVerification?(input: {
    phone: string;
    code: string;
    purpose: string;
  }): Promise<boolean>;

  saveAuthSession?(input: {
    token: string;
    phone?: string;
    email?: string;
    expiresAt: Date;
  }): Promise<void>;
  consumeAuthSession?(token: string): Promise<{ phone?: string; email?: string } | null>;

  saveMarketBoostListing?(listing: RuntimeMarketBoostListing): Promise<void>;
  saveResellerMirror?(mirror: RuntimeResellerMirror): Promise<void>;
  saveSupplierProfile?(supplier: RuntimeSupplierProfile): Promise<void>;
  savePaymentLink?(link: RuntimePaymentLink): Promise<void>;
  deletePaymentLink?(slug: string): Promise<void>;
  savePayoutWithdrawal?(withdrawal: RuntimePayoutWithdrawal): Promise<void>;
  saveSettlementSplitRule?(rule: RuntimeSettlementSplitRule): Promise<void>;
  saveKycSubmission?(submission: RuntimeKycSubmission): Promise<void>;
  saveTeamMember?(member: RuntimeTeamMember): Promise<void>;
  deleteTeamMember?(idOrEmail: string): Promise<void>;
  saveNotification?(notification: RuntimeVendorNotification): Promise<void>;
  syncNotifications?(input: {
    readKeys?: string[];
    dismissedKeys?: string[];
    markAllRead?: boolean;
  }): Promise<void>;

  recordEvent(event: PersistenceEvent): Promise<void>;
  close(): Promise<void>;
}
