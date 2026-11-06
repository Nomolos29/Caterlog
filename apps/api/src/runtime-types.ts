import type { DomainCopilotMode, DomainOrderStatus } from "@caterlog/commerce-core";

/**
 * Runtime (HTTP/WhatsApp layer) view models.
 *
 * These mirror the domain/persistence models but stay transport-friendly:
 * money is bigint in kobo, dates are Date objects, and IDs are strings.
 */

export interface RuntimeVendor {
  id: string;
  slug: string;
  businessName: string;
  whatsappPhone: string;
  whatsappPhoneId: string;
  verificationStatus: "VERIFIED" | "PENDING" | "REJECTED";
  copilotMode: DomainCopilotMode;
  copilotIdleSeconds: number;
  reservationTtlMinutes: number;
}

export interface RuntimeProduct {
  id: string;
  skuCode: string;
  name: string;
  description: string;
  category: string;
  basePriceKobo: bigint;
  primaryImageUrl: string;
  imagePhash: string;
  stockTotal: number;
  stockReserved: number;
}

export interface RuntimeShippingZone {
  id: string;
  code: number;
  name: string;
  feeKobo: bigint;
  isActive: boolean;
}

export interface RuntimeDiscount {
  id: string;
  code: string;
  type: "PERCENTAGE" | "FLAT_KOBO";
  value: bigint;
  minOrderKobo: bigint;
  usedCount: number;
  maxUses: number | null;
  expiresAt?: Date;
  isActive: boolean;
}

export interface RuntimeOrder {
  id: string;
  shortCode: string;
  customerPhone: string;
  customerName: string;
  productId: string;
  productSku: string;
  productName: string;
  quantity: number;
  shippingZoneName: string;
  subtotalKobo: bigint;
  shippingFeeKobo: bigint;
  discountCode?: string;
  discountAmountKobo: bigint;
  totalAmountKobo: bigint;
  amountPaidKobo: bigint;
  overpaidAmountKobo?: bigint;
  status: DomainOrderStatus;
  invoiceReference: string;
  accountNumber: string;
  bankName: string;
  accountName: string;
  riderPhone?: string;
  reservationReleased?: boolean;
  paymentExpiresAt: Date;
  createdAt: Date;
  paidAt?: Date;
  dispatchedAt?: Date;
}

export interface QuickReplyOption {
  label: string;
  replyText: string;
}

export interface ChatThreadMessage {
  id: string;
  channel: "VENDOR_ADMIN_WA" | "BUYER_SHOP_WA";
  sender: "VENDOR" | "BUYER" | "CATERLOG_BOT";
  fromPhone: string;
  text: string;
  imageUrl?: string;
  quickReplies?: QuickReplyOption[];
  timestamp: Date;
}

export interface BuyerConversationSession {
  buyerPhone: string;
  buyerName: string;
  activeProductId: string;
  quantity: number;
  discountCode?: string;
  state: "AWAITING_SHIPPING_ZONE";
  updatedAt: Date;
}

export interface PaymentReconciliationResult {
  order: RuntimeOrder;
  status: "PAID" | "PARTIALLY_PAID" | "PENDING";
  remainingBalanceKobo: bigint;
  overpaidAmountKobo: bigint;
  /** False when the payment was a duplicate or has not settled yet. */
  applied: boolean;
}

export interface RuntimeSnapshot {
  vendor: RuntimeVendor;
  products: RuntimeProduct[];
  shippingZones: RuntimeShippingZone[];
  discounts: RuntimeDiscount[];
  orders: RuntimeOrder[];
  /** Provider transaction references already applied (durable idempotency). */
  processedTransactionRefs: string[];
}
