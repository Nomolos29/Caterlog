export type CopilotMode = "COPILOT" | "FULL_AUTO" | "MANUAL";

export type SubscriptionPlanId =
  | "FREE"
  | "RESELLER"
  | "STARTER"
  | "GROWTH"
  | "PRO"
  | "SCALE";
export type BillingCycle = "MONTHLY" | "ANNUALLY";
export type TrustTierLevel = 0 | 1 | 2;

export interface SubscriptionInfo {
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

export interface TrustTierInfo {
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

export interface PlatformInvoiceItem {
  id: string;
  invoiceNumber: string;
  description: string;
  amountNaira: number;
  amountFormatted: string;
  status: "PAID" | "PENDING" | "FAILED";
  paidAt: string;
  pdfUrl?: string;
  planId?: SubscriptionPlanId;
}

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PARTIALLY_PAID"
  | "PAID"
  | "PROCESSING"
  | "OUT_FOR_DELIVERY"
  | "FULFILLED"
  | "EXPIRED"
  | "CANCELLED"
  | "REFUNDED";

export type ChatChannel = "VENDOR_ADMIN_WA" | "BUYER_SHOP_WA";
export type ChatSender = "VENDOR" | "BUYER" | "CATERLOG_BOT";
export type SalesChannel =
  | "WHATSAPP"
  | "INSTAGRAM"
  | "FACEBOOK"
  | "PAYMENT_LINK"
  | "RESELLER_NETWORK"
  | "WEB_STOREFRONT"
  | "POS_WALK_IN"
  | "MANUAL_DM";

export type BookingStatus =
  | "REQUESTED"
  | "CONFIRMED"
  | "DEPOSIT_PENDING"
  | "DEPOSIT_PAID"
  | "READY_FOR_DISPATCH"
  | "FULFILLED"
  | "CANCELLED";

export interface WholesaleBookingItem {
  id: string;
  reference: string;
  clientName: string;
  clientOrganization?: string;
  clientPhone: string;
  clientType: "WHOLESALER" | "RESELLER_NETWORK" | "RETAIL_CHAIN" | "VIP_BUYER" | "CORPORATE";
  channel: "WHATSAPP" | "INSTAGRAM" | "FACEBOOK" | "PORTAL";
  productSku: string;
  productName: string;
  quantity: number;
  unitPriceNaira: number;
  totalAmountNaira: number;
  depositRequiredNaira: number;
  depositPaidNaira: number;
  depositStatus: "UNPAID" | "PARTIAL" | "PAID";
  targetDeliveryDate: string;
  requestedAt: string;
  status: BookingStatus;
  notes?: string;
}

export interface BookingCatalogRules {
  allCatalogBookable: boolean;
  selectedBookableCategories: string[];
  defaultDepositPercent: number;
  defaultLeadTimeDays: number;
  minimumOrderValueNaira: number;
  autoExpireHours: number;
}

export interface QuickReplyOption {
  label: string;
  replyText: string;
}

export interface ChatMessage {
  id: string;
  channel: ChatChannel;
  sourceChannel?: "WHATSAPP" | "INSTAGRAM" | "FACEBOOK";
  sender: ChatSender;
  fromPhone: string;
  text: string;
  imageUrl?: string;
  quickReplies?: QuickReplyOption[];
  timestamp: string;
}

export type PlatformRole = "reseller" | "starter" | "growth" | "pro";

export function isResellerRole(role?: string): boolean {
  return role === "reseller";
}

export function isVendorRole(role?: string): boolean {
  return (
    role === "starter" ||
    role === "growth" ||
    role === "pro" ||
    role === "vendor" ||
    role === "supplier"
  );
}

export function roleToPlanId(role: PlatformRole): SubscriptionPlanId {
  switch (role) {
    case "reseller":
      return "RESELLER";
    case "starter":
      return "STARTER";
    case "growth":
      return "GROWTH";
    case "pro":
      return "PRO";
  }
}

export function planIdToRole(planId?: string): PlatformRole {
  switch (planId) {
    case "RESELLER":
      return "reseller";
    case "STARTER":
    case "FREE":
      return "starter";
    case "PRO":
    case "SCALE":
    case "ENTERPRISE":
      return "pro";
    case "GROWTH":
    default:
      return "growth";
  }
}

export interface SocialAccountSync {
  platform: "WHATSAPP" | "INSTAGRAM" | "FACEBOOK";
  connected: boolean;
  handleOrPhone: string;
  businessAssetId?: string;
  businessPortfolioName?: string;
  syncCatalogToSocial: boolean;
  importSocialBuyersToCrm: boolean;
  copilotAutoReply: boolean;
  webhookStatus: "ACTIVE" | "PENDING" | "DISCONNECTED";
  lastSyncedAt?: string;
  syncedProductsCount?: number;
}

export interface VendorFeatureFlags {
  webCheckoutEnabled: boolean;
  guestCheckoutEnabled: boolean;
  liveStockCountdownEnabled: boolean;
  vacationModeEnabled: boolean;
  whatsappCopilotEnabled: boolean;
  instagramDmCopilotEnabled: boolean;
  facebookMessengerCopilotEnabled: boolean;
  autoHoldStockOnChatCheckout: boolean;
  marketBoostDiscoveryEnabled: boolean;
  autoApproveResellerMirrors: boolean;
  interstateMirroringEnabled: boolean;
  requirePasskeyForWithdrawals: boolean;
  requireSmsOtpOnNewDevice: boolean;
}

export interface Vendor {
  id: string;
  slug: string;
  businessName: string;
  email?: string;
  phoneVerifiedAt?: string;
  totpEnabled?: boolean;
  totpVerifiedAt?: string;
  role?: PlatformRole;
  whatsappPhone: string;
  whatsappPhoneId: string;
  verificationStatus: "VERIFIED" | "PENDING" | "REJECTED";
  copilotMode: CopilotMode;
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
  verifiedLegalName?: string;
  isPayoutFrozen?: boolean;
  payoutFrozenUntil?: string;
  pendingBankUpdate?: PendingBankUpdateInfo | null;
  subscription?: SubscriptionInfo;
  trustTier?: TrustTierInfo;
  platformInvoices?: PlatformInvoiceItem[];
  shipbubbleConfig?: ShipbubbleVendorConfig;
  storefrontConfig?: import("./storefront-presets").StorefrontConfig;
  featureFlags?: VendorFeatureFlags;
  socialAccounts?: {
    WHATSAPP?: SocialAccountSync;
    INSTAGRAM?: SocialAccountSync;
    FACEBOOK?: SocialAccountSync;
  };
}

export interface ShipbubbleVendorConfig {
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

export interface ShipbubbleCourierQuoteItem {
  courier_id: string;
  courier_name: string;
  courier_image: string;
  service_code: string;
  service_type: string;
  waybill: boolean;
  on_demand: boolean;
  is_cod_available: boolean;
  ratings: number;
  votes: number;
  pickup_eta: string;
  delivery_eta: string;
  currency: string;
  vat: number;
  total: number;
  discount?: {
    percentage: number;
    symbol: string;
    discounted: number;
  };
  tracking?: {
    bars: number;
    label: string;
  };
}

export interface CourierShipmentReceipt {
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

export interface PendingBankUpdateInfo {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  requestedAt: string;
  effectiveAt: string;
  cancelTokenHash?: string;
  requestorIp?: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  priceNaira: number;
  priceFormatted?: string;
  stock: number;
  availableStock?: number;
}

export interface Product {
  id: string;
  skuCode: string;
  name: string;
  description: string;
  category: string;
  /** BigInt serialized as a decimal string by the API. */
  basePriceKobo: string;
  basePriceNaira: number;
  basePriceFormatted: string;
  primaryImageUrl: string;
  imagePhash: string;
  stockTotal: number;
  stockReserved: number;
  availableStock: number;
  variants?: ProductVariant[];
  customFields?: Record<string, string>;
}

export interface ShippingZone {
  id: string;
  code: number;
  name: string;
  /** BigInt serialized as a decimal string by the API. */
  feeKobo: string;
  feeNaira: number;
  feeFormatted: string;
  isActive: boolean;
}

export interface Discount {
  id: string;
  code: string;
  type: "PERCENTAGE" | "FLAT_KOBO";
  /** BigInt serialized as a decimal string by the API. */
  value: string;
  /** BigInt serialized as a decimal string by the API. */
  minOrderKobo: string;
  valueRaw: string;
  label: string;
  usedCount: number;
  maxUses: number | null;
  expiresAt?: string;
  isActive: boolean;
}

export interface OrderItemRecord {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  variantId?: string;
  variantSku?: string;
  variantName?: string;
  quantity: number;
  unitPriceKobo: string;
  unitPriceFormatted?: string;
  subtotalKobo: string;
  subtotalFormatted?: string;
}

export interface Order {
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
  items?: OrderItemRecord[];
  shippingZoneName: string;
  /** BigInt serialized as a decimal string by the API. */
  subtotalKobo: string;
  /** BigInt serialized as a decimal string by the API. */
  shippingFeeKobo: string;
  discountCode?: string;
  /** BigInt serialized as a decimal string by the API. */
  discountAmountKobo: string;
  /** BigInt serialized as a decimal string by the API. */
  totalAmountKobo: string;
  /** BigInt serialized as a decimal string by the API. */
  amountPaidKobo: string;
  /** BigInt serialized as a decimal string by the API. */
  overpaidAmountKobo?: string;
  status: OrderStatus;
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
  refundedAmountFormatted?: string;
  refundReason?: string;
  refundedAt?: string;
  reservationReleased?: boolean;
  paymentExpiresAt: string;
  createdAt: string;
  paidAt?: string;
  dispatchedAt?: string;
  subtotalFormatted: string;
  shippingFeeFormatted: string;
  discountAmountFormatted: string;
  totalAmountNaira: number;
  totalAmountFormatted: string;
  amountPaidNaira: number;
  amountPaidFormatted: string;
  remainingBalanceNaira: number;
  remainingBalanceFormatted: string;
  overpaidAmountFormatted: string;
  isDropship?: boolean;
  supplierSubAccountCode?: string;
  resellerSubAccountCode?: string;
  supplierShareKobo?: string;
  resellerShareKobo?: string;
  platformFeeKobo?: string;
  supplierShareNaira?: number;
  resellerShareNaira?: number;
  platformFeeNaira?: number;
  splitSettlementStatus?: "PENDING" | "SETTLED" | "NOT_APPLICABLE";
  salesChannel?: SalesChannel;
  courierShipment?: CourierShipmentReceipt;
}

export interface PublicOrderReceipt {
  shortCode: string;
  status: OrderStatus;
  isPaid: boolean;
  paymentStamp: string;
  customerName: string;
  customerPhone: string;
  alternatePhone: string;
  deliveryAddress: string;
  deliveryLandmark: string;
  shippingZoneName: string;
  riderPhone: string;
  productId: string;
  productSku: string;
  productName: string;
  variantName?: string;
  quantity: number;
  items?: OrderItemRecord[];
  subtotalFormatted: string;
  shippingFeeFormatted: string;
  discountCode?: string;
  discountAmountFormatted: string;
  totalAmountNaira: number;
  totalAmountFormatted: string;
  amountPaidNaira: number;
  amountPaidFormatted: string;
  remainingBalanceNaira: number;
  remainingBalanceFormatted: string;
  overpaidAmountFormatted: string;
  invoiceReference: string;
  paymentTransactionRef: string;
  accountNumber: string;
  bankName: string;
  accountName: string;
  refundReference?: string;
  refundedAmountFormatted?: string;
  refundReason?: string;
  refundedAt?: string;
  createdAt: string;
  paidAt?: string;
  dispatchedAt?: string;
  paymentExpiresAt: string;
  trackUrl: string;
  courierShipment?: CourierShipmentReceipt;
  liveCheckoutRatesEnabled?: boolean;
  vendor: {
    businessName: string;
    slug: string;
    whatsappPhone: string;
    verificationStatus: "VERIFIED" | "PENDING" | "REJECTED";
  };
}

export interface OrderWaybill {
  waybillNumber: string;
  orderShortCode: string;
  status: OrderStatus;
  isPaid: boolean;
  paymentStamp: string;
  vendorName: string;
  vendorPhone: string;
  customerName: string;
  customerPhone: string;
  alternatePhone: string;
  shippingZoneName: string;
  deliveryAddress: string;
  deliveryLandmark: string;
  riderPhone: string;
  items: Array<{ sku: string; name: string; quantity: number }>;
  totalQuantity: number;
  totalAmountFormatted: string;
  amountPaidFormatted: string;
  paymentTransactionRef: string;
  trackUrl: string;
  whatsappRiderText: string;
  createdAt: string;
  paidAt?: string;
  dispatchedAt?: string;
}

export interface Analytics {
  paidOrdersCount: number;
  paidGrossNaira: number;
  paidGrossFormatted: string;
  pendingOrdersCount: number;
  pendingAmountNaira: number;
  pendingAmountFormatted: string;
  shippingCollectedFormatted: string;
  discountsGivenFormatted: string;
  netProductRevenueFormatted: string;
}

export interface CartItemSession {
  productId: string;
  productSku: string;
  productName: string;
  variantId?: string;
  variantSku?: string;
  variantName?: string;
  quantity: number;
  unitPriceNaira?: number;
}

export interface BuyerSession {
  buyerPhone: string;
  buyerName: string;
  sourceChannel?: "WHATSAPP" | "INSTAGRAM" | "FACEBOOK";
  activeProductId?: string;
  activeVariantId?: string;
  activeOrderId?: string;
  quantity?: number;
  discountCode?: string;
  cart?: CartItemSession[];
  state:
    | "AWAITING_VARIANT"
    | "AWAITING_QUANTITY"
    | "AWAITING_SHIPPING_ZONE"
    | "AWAITING_DELIVERY_ADDRESS"
    | "CART_ACTIVE"
    | "NEEDS_ASSISTANCE"
    | "ASSISTING";
  assistanceInquiry?: string;
  assistanceRequestedAt?: string;
  copilotPaused?: boolean;
  updatedAt: string;
}

export interface WholesaleDiscountRule {
  id: string;
  name: string;
  discountType: "PERCENTAGE" | "FLAT_NAIRA";
  value: number;
  scope: "ENTIRE_MIRROR_CATALOG" | "CATEGORY" | "SPECIFIC_PRODUCTS";
  targetCategories?: string[];
  targetProductSkus?: string[];
  resellerScope: "ALL_RESELLERS" | "SPECIFIC_RESELLERS";
  targetResellers?: string[];
  isActive: boolean;
  createdAt: string;
}

export interface MarketBoostListing {
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
  startingPriceKobo: string;
  startingPriceNaira?: number;
  startingPriceFormatted?: string;
  fulfillmentMethod: string;
  deliveryNote: string;
  featuredTags: string[];
  mirroredCategories: string[];
  mirroredProductSkus: string[];
  wholesaleDiscountRules: WholesaleDiscountRule[];
  subscriptionPlan: "STARTER" | "GROWTH" | "ENTERPRISE";
  updatedAt: string;
}

export interface SupplierCatalogProduct {
  sku: string;
  name: string;
  wholesalePriceNaira: number;
  suggestedRetailNaira: number;
  stock: number;
  moq: number;
  category: string;
}

export interface SupplierProfile {
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
  catalogProducts: SupplierCatalogProduct[];
}

export interface ResellerMirror {
  id: string;
  resellerVendorId: string;
  supplierId: string;
  supplierSlug?: string;
  supplierName?: string;
  mirroredProductSkus: string[];
  defaultMarkupBps: number;
  status: "ACTIVE" | "PAUSED";
  lastSyncedAt: string;
}

export interface PaymentLinkItem {
  id: string;
  slug: string;
  customerName?: string;
  customerPhone?: string;
  productSku?: string;
  description?: string;
  amountKobo: string;
  amountNaira?: number;
  amountFormatted?: string;
  checkoutUrl: string;
  isActive: boolean;
  timesUsed: number;
  expiresAt?: string;
  createdAt: string;
}

export interface PayoutWithdrawalItem {
  id: string;
  reference: string;
  amountKobo: string;
  amountNaira?: number;
  amountFormatted?: string;
  feeKobo: string;
  netAmountKobo: string;
  netAmountNaira?: number;
  netAmountFormatted?: string;
  bankCode?: string;
  bankName: string;
  accountNumber: string;
  accountName?: string;
  status: "PENDING" | "DISPATCHED" | "SETTLED" | "FAILED";
  verifiedByOtp: boolean;
  createdAt: string;
  settledAt?: string;
}

export interface SettlementSplitRuleItem {
  id: string;
  name: string;
  supplierSubAccountCode?: string;
  supplierShareBps: number;
  resellerShareBps: number;
  platformFeeBps: number;
  isActive: boolean;
  updatedAt: string;
}

export interface KycSubmissionItem {
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
  submittedAt: string;
  reviewedAt?: string;
}

export interface TeamMemberItem {
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
  lastActiveAt?: string;
  invitedAt: string;
}

export interface VendorNotificationItem {
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
  createdAt: string;
  readAt?: string;
}

export interface CommerceEventItem {
  id: string;
  eventType: string;
  actorType: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface CustomerRecordItem {
  id: string;
  whatsappPhone: string;
  name: string;
  email?: string;
  defaultAddress?: string;
  notes?: string;
  tags?: string[];
  segmentOverride?: "VIP" | "Repeat" | "New";
  totalOrdersCount: number;
  lifetimeSpendKobo: string;
  lifetimeSpendNaira: number;
  lifetimeSpendFormatted: string;
  firstSeenAt: string;
  lastOrderAt?: string;
}

export interface VendorState {
  vendor: Vendor;
  activeBuyerSession: BuyerSession | null;
  analytics: Analytics;
  products: Product[];
  shippingZones: ShippingZone[];
  discounts: Discount[];
  orders: Order[];
  customers?: CustomerRecordItem[];
  wholesaleBookings?: WholesaleBookingItem[];
  bookingCatalogRules?: BookingCatalogRules;
  chatMessages: ChatMessage[];
  marketBoostListing?: MarketBoostListing | null;
  suppliers?: SupplierProfile[];
  resellerMirrors?: ResellerMirror[];
  paymentLinks?: PaymentLinkItem[];
  payoutWithdrawals?: PayoutWithdrawalItem[];
  settlementSplitRules?: SettlementSplitRuleItem[];
  kycSubmissions?: KycSubmissionItem[];
  teamMembers?: TeamMemberItem[];
  notifications?: VendorNotificationItem[];
  commerceEvents?: CommerceEventItem[];
  subscription?: SubscriptionInfo;
  trustTier?: TrustTierInfo;
  platformInvoices?: PlatformInvoiceItem[];
  storefrontConfig?: import("./storefront-presets").StorefrontConfig;
}

export interface WhatsAppSimulationResult {
  replyText?: string;
  commandType?: string;
  state: VendorState;
}

export interface MonnifySimulationResult {
  reconciliationStatus: "PAID" | "PARTIALLY_PAID";
  remainingBalanceKobo: string;
  state: VendorState;
}

export type ProductItem = Product;
export type OrderItem = Order;
export type VendorProfile = Vendor;
export type ShippingZoneItem = ShippingZone;
export type DiscountItem = Discount;
export type ChatMessageItem = ChatMessage;
export type VendorAnalytics = Analytics;
