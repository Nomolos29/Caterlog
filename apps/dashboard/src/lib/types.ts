export type CopilotMode = "COPILOT" | "FULL_AUTO" | "MANUAL";

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

export interface QuickReplyOption {
  label: string;
  replyText: string;
}

export interface ChatMessage {
  id: string;
  channel: ChatChannel;
  sender: ChatSender;
  fromPhone: string;
  text: string;
  imageUrl?: string;
  quickReplies?: QuickReplyOption[];
  timestamp: string;
}

export interface Vendor {
  id: string;
  slug: string;
  businessName: string;
  whatsappPhone: string;
  whatsappPhoneId: string;
  verificationStatus: "VERIFIED" | "PENDING" | "REJECTED";
  copilotMode: CopilotMode;
  copilotIdleSeconds: number;
  reservationTtlMinutes: number;
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
  activeProductId?: string;
  activeVariantId?: string;
  activeOrderId?: string;
  quantity?: number;
  discountCode?: string;
  cart?: CartItemSession[];
  state: "AWAITING_VARIANT" | "AWAITING_QUANTITY" | "AWAITING_SHIPPING_ZONE" | "AWAITING_DELIVERY_ADDRESS" | "CART_ACTIVE" | "NEEDS_ASSISTANCE" | "ASSISTING";
  assistanceInquiry?: string;
  assistanceRequestedAt?: string;
  copilotPaused?: boolean;
  updatedAt: string;
}

export interface VendorState {

  vendor: Vendor;
  activeBuyerSession: BuyerSession | null;
  analytics: Analytics;
  products: Product[];
  shippingZones: ShippingZone[];
  discounts: Discount[];
  orders: Order[];
  chatMessages: ChatMessage[];
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

