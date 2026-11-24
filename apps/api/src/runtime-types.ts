import type { DomainCopilotMode, DomainOrderStatus } from "@caterlog/commerce-core";

/**
 * Runtime (HTTP/WhatsApp layer) view models.
 *
 * These mirror the domain/persistence models but stay transport-friendly:
 * money is bigint in kobo, dates are Date objects, and IDs are strings.
 */

export interface PendingBankUpdate {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  requestedAt: Date;
  effectiveAt: Date;
  cancelTokenHash: string;
  requestorIp?: string;
}

export type StaffPermissionKey =
  | "canManageOrders"
  | "canManageInventory"
  | "canViewPayouts"
  | "canProcessRefunds"
  | "canOverrideCopilot"
  | "ownerOnly";

export interface StaffPermissions {
  canManageOrders: boolean;
  canManageInventory: boolean;
  canViewPayouts: boolean;
  canProcessRefunds: boolean;
  canOverrideCopilot: boolean;
}

export interface VendorSession {
  tokenHash: string;
  vendorSlug: string;
  phone?: string;
  email?: string;
  staffMemberId?: string;
  staffName?: string;
  staffRole: string;
  isOwner: boolean;
  permissions: StaffPermissions;
  createdAt: Date;
  expiresAt: Date;
  lastActiveAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export type SalesChannel =
  | "WHATSAPP"
  | "INSTAGRAM"
  | "FACEBOOK"
  | "PAYMENT_LINK"
  | "RESELLER_NETWORK"
  | "WEB_STOREFRONT";

export interface RuntimeVendor {
  id: string;
  slug: string;
  businessName: string;
  role?: "reseller" | "starter" | "growth" | "pro" | "vendor" | "supplier";
  whatsappPhone: string;
  whatsappPhoneId: string;
  verificationStatus: "VERIFIED" | "PENDING" | "REJECTED";
  copilotMode: DomainCopilotMode;
  copilotIdleSeconds: number;
  reservationTtlMinutes: number;
  bankCode?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  monnifySubAccountCode?: string;
  cacNumber?: string;
  tinNumber?: string;
  instagramHandle?: string;
  instagramConnected?: boolean;
  instagramBusinessId?: string;
  facebookPageName?: string;
  facebookPageId?: string;
  facebookConnected?: boolean;
  baseState?: string;
  baseCity?: string;

  // Layer 1 Security & Identity Lock Profile
  transactionPinHash?: string;
  pinFailedAttempts?: number;
  pinLockedUntil?: Date;
  pinSetAt?: Date;
  verifiedLegalName?: string;
  verifiedBvnHash?: string;
  isPayoutFrozen?: boolean;
  payoutFrozenUntil?: Date;
  pendingBankUpdate?: PendingBankUpdate | null;

  // Platform Subscription & Escrow Trust Tier
  subscription?: RuntimeSubscriptionInfo;
  trustTier?: RuntimeTrustTierInfo;
  invoices?: RuntimePlatformInvoice[];
  shipbubbleConfig?: RuntimeShipbubbleConfig;
  storefrontConfig?: Record<string, unknown>;
}

export interface RuntimeShipbubbleConfig {
  pickupAddress: string;
  pickupAddressCode?: number;
  pickupFormattedAddress?: string;
  pickupCity?: string;
  pickupState?: string;
  pickupPostalCode?: string;
  defaultCategoryId: number;
  defaultWeightPreset: "SMALL_BAG" | "SHOEBOX" | "CARTON" | "CUSTOM";
  customWeightKg: number;
  selectedCarriers: string[];
  autoBookOnPaid: boolean;
  liveCheckoutRatesEnabled: boolean;
}

export interface RuntimeCourierShipmentReceipt {
  provider: "shipbubble";
  receiptNumber: string;
  shipbubbleOrderId: string;
  requestToken?: string;
  courierId: string;
  courierName: string;
  courierEmail: string;
  courierPhone: string;
  courierImage?: string;
  serviceCode: string;
  serviceType: string;
  status: "pending" | "confirmed" | "picked_up" | "in_transit" | "completed" | "cancelled";
  trackingCode: string;
  trackingUrl: string;
  waybillDocumentUrl?: string;
  shippingFeeNaira: number;
  vatNaira: number;
  paymentType: string;
  paymentStatus: string;
  currency: string;
  packageWeightKg: number;
  packageAmountNaira: number;
  weightPreset?: "SMALL_BAG" | "SHOEBOX" | "CARTON" | "CUSTOM";
  boxName?: string;
  pickupEta?: string;
  deliveryEta?: string;
  shipFrom: {
    name: string;
    phone: string;
    email: string;
    address: string;
    latitude?: number;
    longitude?: number;
  };
  shipTo: {
    name: string;
    phone: string;
    email: string;
    address: string;
    latitude?: number;
    longitude?: number;
  };
  items: Array<{
    name: string;
    description: string;
    weight: number;
    amount: number;
    quantity: number;
    total: number;
  }>;
  autoBooked?: boolean;
  bookedAt: string;
  pickedUpAt?: string;
  inTransitAt?: string;
  deliveredAt?: string;
  message?: string;
}

export type SubscriptionPlanId =
  | "FREE"
  | "RESELLER"
  | "STARTER"
  | "GROWTH"
  | "PRO"
  | "SCALE";
export type BillingCycle = "MONTHLY" | "ANNUALLY";
export type TrustTierLevel = 0 | 1 | 2;

export interface RuntimeSubscriptionInfo {
  planId: SubscriptionPlanId;
  planName: string;
  billingCycle: BillingCycle;
  status: "ACTIVE" | "PAST_DUE" | "TRIALING" | "CANCELLED";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  priceNaira: number;
  priceUsd?: number;
  platformFeeBps: number;
  maxProducts: number;
  maxTeamSeats: number;
  copilotTier: "KEYWORD" | "FULL_AUTO" | "MULTI_AGENT";
  hasCustomDomain: boolean;
  hasResellerMirroring: boolean;
  hasPhashStatusMatching: boolean;
  hasMarketBoost?: boolean;
  hasConciergeShipping?: boolean;
  pickupStationEnabled?: boolean;
  scheduledPickupWindows?: string[];
  shieldedBuyerSupport?: boolean;
  paymentMethod?: {
    type: "CARD" | "DIRECT_DEBIT";
    brand?: string;
    last4?: string;
    bankName?: string;
    expiry?: string;
  };
}

export interface RuntimeTrustTierInfo {
  currentTier: TrustTierLevel;
  tierName: string;
  settlementSpeed: string;
  dailyPayoutLimitNaira: number;
  completedCleanOrders: number;
  requiredOrdersForNextTier: number;
  isKycVerified: boolean;
  isCacVerified: boolean;
  disputeRatePercent: number;
  canFastTrackLevel2: boolean;
}

export interface RuntimePlatformInvoice {
  id: string;
  invoiceNumber: string;
  description: string;
  amountNaira: number;
  status: "PAID" | "PENDING" | "FAILED";
  paidAt: string;
  pdfUrl?: string;
  planId?: SubscriptionPlanId;
}

export interface RuntimeWholesaleDiscountRule {
  id: string;
  name: string;
  discountType: "PERCENTAGE" | "FLAT_NAIRA";
  value: number; // percentage e.g. 10 (10%) or Naira e.g. 500
  scope: "ENTIRE_MIRROR_CATALOG" | "CATEGORY" | "SPECIFIC_PRODUCTS";
  targetCategories?: string[];
  targetProductSkus?: string[];
  resellerScope: "ALL_RESELLERS" | "SPECIFIC_RESELLERS";
  targetResellers?: string[];
  isActive: boolean;
  createdAt: string;
}

export interface RuntimeMarketBoostListing {
  id: string;
  vendorId: string;
  isPublished: boolean;
  businessName: string;
  category: string;
  baseState: string;
  baseCity: string;
  shippingScope: "LOCAL_STATE" | "SELECTED_STATES" | "NATIONWIDE";
  allowInterstate: boolean;
  coveredStates: string[];
  coveredLgas?: string[];
  description: string;
  moq: string;
  startingPriceKobo: bigint;
  fulfillmentMethod: string;
  deliveryNote: string;
  featuredTags: string[];
  mirroredCategories: string[];
  mirroredProductSkus: string[];
  wholesaleDiscountRules: RuntimeWholesaleDiscountRule[];
  subscriptionPlan: "STARTER" | "GROWTH" | "ENTERPRISE";
  updatedAt: Date;
}

export interface RuntimeSupplierCatalogProduct {
  sku: string;
  name: string;
  wholesalePriceNaira: number;
  suggestedRetailNaira: number;
  stock: number;
  moq: number;
  category: string;
}

export interface RuntimeSupplierProfile {
  id: string;
  slug: string;
  name: string;
  verified: boolean;
  cacNumber: string;
  category: string;
  location: string;
  state: string;
  shippingScope: "LOCAL_STATE" | "SELECTED_STATES" | "NATIONWIDE";
  allowInterstate: boolean;
  coveredStates: string[];
  coveredLgas?: string[];
  warehouseAddress: string;
  phone: string;
  whatsapp: string;
  rating: number;
  totalFulfilled: number;
  subAccountCode: string;
  leadTime: string;
  cutoffTime: string;
  wholesaleTerms: string[];
  catalogProducts: RuntimeSupplierCatalogProduct[];
}

export interface RuntimeResellerMirror {
  id: string;
  resellerVendorId: string;
  supplierId: string;
  supplierSlug?: string;
  supplierName?: string;
  mirroredProductSkus: string[];
  defaultMarkupBps: number;
  status: "ACTIVE" | "PAUSED";
  lastSyncedAt: Date;
}

export interface RuntimePaymentLink {
  id: string;
  slug: string;
  customerName?: string;
  customerPhone?: string;
  productSku?: string;
  description?: string;
  amountKobo: bigint;
  checkoutUrl: string;
  isActive: boolean;
  timesUsed: number;
  expiresAt?: Date;
  createdAt: Date;
}

export interface RuntimePayoutWithdrawal {
  id: string;
  reference: string;
  amountKobo: bigint;
  feeKobo: bigint;
  netAmountKobo: bigint;
  bankCode?: string;
  bankName: string;
  accountNumber: string;
  accountName?: string;
  status: "PENDING" | "DISPATCHED" | "SETTLED" | "FAILED";
  verifiedByOtp: boolean;
  createdAt: Date;
  settledAt?: Date;
}

export interface RuntimeSettlementSplitRule {
  id: string;
  name: string;
  supplierSubAccountCode?: string;
  supplierShareBps: number;
  resellerShareBps: number;
  platformFeeBps: number;
  isActive: boolean;
  updatedAt: Date;
}

export interface RuntimeKycSubmission {
  id: string;
  businessName: string;
  cacNumber: string;
  tinNumber?: string;
  businessAddress?: string;
  businessCategory?: string;
  bankCode: string;
  bankName?: string;
  accountNumber: string;
  resolvedAccountName: string;
  whatsappPhone?: string;
  instagramHandle?: string;
  cacDocumentUploaded: boolean;
  idDocumentUploaded: boolean;
  status: "UNVERIFIED" | "PENDING_REVIEW" | "VERIFIED" | "REJECTED";
  reviewerNotes?: string;
  submittedAt: Date;
  reviewedAt?: Date;
}

export interface RuntimeTeamMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  status: "Active" | "Invited" | "Suspended";
  canManageOrders: boolean;
  canManageInventory: boolean;
  canViewPayouts: boolean;
  canProcessRefunds: boolean;
  canOverrideCopilot: boolean;
  lastActiveAt?: Date;
  invitedAt: Date;
}

export interface RuntimeVendorNotification {
  id: string;
  notificationKey: string;
  title: string;
  message: string;
  category: "ORDERS" | "PAYOUTS" | "INVENTORY" | "COPILOT" | "SYSTEM";
  isRead: boolean;
  isDismissed: boolean;
  linkText?: string;
  targetView?: string;
  targetRef?: string;
  createdAt: Date;
  readAt?: Date;
}

export interface RuntimeCommerceEvent {
  id: string;
  eventType: string;
  actorType: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface RuntimeProductVariant {
  id: string;
  name: string; // e.g. "Size 39 / Gold" or "750ml / Matte Black"
  skuCode: string; // e.g. "SHOE-01-39" or "SKU-0895-BLK"
  priceKobo?: bigint; // Specific price for this variant (defaults to parent basePriceKobo)
  stockTotal: number;
  stockReserved: number;
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
  variants?: RuntimeProductVariant[];
  customFields?: Record<string, string>;
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

export interface RuntimeOrderItem {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  variantId?: string;
  variantSku?: string;
  variantName?: string;
  quantity: number;
  unitPriceKobo: bigint;
  subtotalKobo: bigint;
}

export interface RuntimeCartItem {
  productId: string;
  productSku: string;
  productName: string;
  variantId?: string;
  variantSku?: string;
  variantName?: string;
  quantity: number;
  unitPriceKobo: bigint;
}

export interface RuntimeOrder {
  id: string;
  shortCode: string;
  customerPhone: string;
  customerName: string;
  productId: string;
  productSku: string;
  productName: string;
  variantId?: string;
  variantSku?: string;
  variantName?: string;
  quantity: number;
  items?: RuntimeOrderItem[];
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
  deliveryAddress?: string;
  deliveryLandmark?: string;
  alternatePhone?: string;
  paymentTransactionRef?: string;
  refundReference?: string;
  refundedAmountKobo?: bigint;
  refundReason?: string;
  refundedAt?: Date;
  reservationReleased?: boolean;
  paymentExpiresAt: Date;
  createdAt: Date;
  paidAt?: Date;
  dispatchedAt?: Date;
  isDropship?: boolean;
  supplierSubAccountCode?: string;
  resellerSubAccountCode?: string;
  supplierShareKobo?: bigint;
  resellerShareKobo?: bigint;
  platformFeeKobo?: bigint;
  splitSettlementStatus?: "PENDING" | "SETTLED" | "NOT_APPLICABLE";
  salesChannel?: SalesChannel;
  courierShipment?: RuntimeCourierShipmentReceipt;
}

export interface QuickReplyOption {
  label: string;
  replyText: string;
}

export interface ChatThreadMessage {
  id: string;
  channel: "VENDOR_ADMIN_WA" | "BUYER_SHOP_WA";
  sourceChannel?: "WHATSAPP" | "INSTAGRAM" | "FACEBOOK";
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
  sourceChannel?: "WHATSAPP" | "INSTAGRAM" | "FACEBOOK";
  activeProductId?: string;
  activeVariantId?: string;
  activeOrderId?: string;
  quantity?: number;
  discountCode?: string;
  cart?: RuntimeCartItem[];
  state: "AWAITING_VARIANT" | "AWAITING_QUANTITY" | "AWAITING_SHIPPING_ZONE" | "AWAITING_DELIVERY_ADDRESS" | "CART_ACTIVE" | "NEEDS_ASSISTANCE" | "ASSISTING";
  assistanceInquiry?: string;
  assistanceRequestedAt?: Date;
  copilotPaused?: boolean;
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
  chatMessages?: ChatThreadMessage[];
  buyerSessions?: BuyerConversationSession[];
  marketBoostListing?: RuntimeMarketBoostListing | null;
  suppliers?: RuntimeSupplierProfile[];
  resellerMirrors?: RuntimeResellerMirror[];
  paymentLinks?: RuntimePaymentLink[];
  payoutWithdrawals?: RuntimePayoutWithdrawal[];
  settlementSplitRules?: RuntimeSettlementSplitRule[];
  kycSubmissions?: RuntimeKycSubmission[];
  teamMembers?: RuntimeTeamMember[];
  notifications?: RuntimeVendorNotification[];
  commerceEvents?: RuntimeCommerceEvent[];
  subscription?: RuntimeSubscriptionInfo;
  trustTier?: RuntimeTrustTierInfo;
  platformInvoices?: RuntimePlatformInvoice[];
}
