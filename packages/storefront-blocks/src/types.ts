import type { StorefrontConfig, StorefrontPresetDefinition } from "./presets";

export type StorefrontActivePage =
  | "home"
  | "shop"
  | "collections"
  | "about"
  | "checkout"
  | "track";

export type StudioSectionId =
  | "header"
  | "hero"
  | "shop-banner"
  | "trust-strip"
  | "category-bento"
  | "featured-products"
  | "promo-deal"
  | "catalog"
  | "brand-story"
  | "testimonials"
  | "newsletter"
  | "footer";

export interface StorefrontProductVariant {
  id: string;
  name: string;
  sku: string;
  priceNaira: number;
  priceFormatted?: string;
  stock: number;
  availableStock?: number;
}

export interface StorefrontProduct {
  id: string;
  skuCode: string;
  name: string;
  description: string;
  category: string;
  basePriceKobo: string;
  basePriceNaira: number;
  basePriceFormatted: string;
  primaryImageUrl: string;
  imagePhash?: string;
  stockTotal: number;
  stockReserved: number;
  availableStock: number;
  variants?: StorefrontProductVariant[];
  customFields?: Record<string, string>;
}

export interface StorefrontShippingZone {
  id: string;
  code: number;
  name: string;
  feeKobo: string;
  feeNaira: number;
  feeFormatted: string;
  isActive: boolean;
}

export interface StorefrontDiscount {
  id: string;
  code: string;
  type: "PERCENTAGE" | "FLAT_KOBO";
  value: string;
  minOrderKobo: string;
  valueRaw: string;
  label: string;
  usedCount: number;
  maxUses: number | null;
  expiresAt?: string;
  isActive: boolean;
}

export interface StorefrontOrderReceipt {
  shortCode: string;
  status: string;
  isPaid: boolean;
  paymentStamp: string;
  customerName: string;
  customerPhone: string;
  alternatePhone: string;
  deliveryAddress: string;
  deliveryLandmark: string;
  shippingZoneName: string;
  subtotalFormatted: string;
  shippingFeeFormatted: string;
  discountCode?: string | null;
  discountAmountFormatted: string;
  totalAmountNaira: number;
  totalAmountFormatted: string;
  amountPaidNaira: number;
  amountPaidFormatted: string;
  remainingBalanceNaira: number;
  remainingBalanceFormatted: string;
  accountNumber: string;
  bankName: string;
  accountName: string;
  invoiceReference: string;
  paymentExpiresAt: string;
  createdAt: string;
  paidAt?: string | null;
  dispatchedAt?: string | null;
}

export interface StorefrontVendorSummary {
  id: string;
  slug: string;
  businessName: string;
  role?: string;
  whatsappPhone: string;
  verificationStatus: "VERIFIED" | "PENDING" | "REJECTED";
  cacNumber?: string;
  instagramHandle?: string;
  facebookPageName?: string;
  baseState?: string;
  baseCity?: string;
  reservationTtlMinutes: number;
  subscriptionPlanId?: string;
}

export interface PublicStorefrontPayload {
  vendor: StorefrontVendorSummary;
  canUseFullWebsite: boolean;
  storefrontConfig: StorefrontConfig;
  presets: StorefrontPresetDefinition[];
  products: StorefrontProduct[];
  shippingZones: StorefrontShippingZone[];
  discounts: StorefrontDiscount[];
}
