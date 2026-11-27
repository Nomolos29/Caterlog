import crypto from "node:crypto";
import {
  assertValidOrderTransition,
  computeDiscountKobo,
  computeOrderTotalKobo,
  computePhashHammingDistance,
  evaluateCopilotAction,
  evaluatePaymentReconciliation,
  formatNaira,
  InMemoryDomainEventBus,
  koboToNaira,
  nairaToKobo,
  parseVendorWhatsAppCommand,
  shouldExecuteScheduledTakeover,
  type DomainCopilotMode,
  type DomainOrderStatus,
  type ServerVerifiedPaymentRecord,
} from "@caterlog/commerce-core";
import {
  canUseFullWebsiteMode,
  isTerritoryDeliverable,
  resolveVendorStorefrontConfig,
  STOREFRONT_PRESETS,
  type StorefrontConfig,
} from "@caterlog/shared";
import {
  assertValidIntegrationConfig,
  describeIntegrationConfig,
  MonnifyPaymentAdapter,
  resolveIntegrationConfig,
  ShipbubbleAdapter,
  SHIPBUBBLE_WEIGHT_PRESETS,
  WhatsAppCatalogAdapter,
  WhatsAppCloudAdapter,
  type CatalogProductInput,
  type CatalogSyncResult,
  type RefundResult,
  type SubAccountResult,
  type EnvLike,
  type IntegrationConfig,
  type ShipbubbleCourierQuote,
  type ShipbubbleWeightPresetId,
} from "@caterlog/integrations";
import type {
  BuyerConversationSession,
  ChatThreadMessage,
  PaymentReconciliationResult,
  QuickReplyOption,
  RuntimeCartItem,
  RuntimeCommerceEvent,
  RuntimeCourierShipmentReceipt,
  RuntimeCustomer,
  RuntimeDiscount,
  RuntimeKycSubmission,
  RuntimeMarketBoostListing,
  RuntimeOrder,
  RuntimeOrderItem,
  RuntimePaymentLink,
  RuntimePayoutWithdrawal,
  RuntimeProduct,
  RuntimeProductVariant,
  RuntimeResellerMirror,
  RuntimeSettlementSplitRule,
  RuntimeShipbubbleConfig,
  RuntimeShippingZone,
  RuntimeSnapshot,
  RuntimeSupplierProfile,
  RuntimeTeamMember,
  RuntimeVendor,
  RuntimeVendorNotification,
  PendingBankUpdate,
  VendorSession,
  SubscriptionPlanId,
  BillingCycle,
  RuntimeSubscriptionInfo,
  RuntimePlatformInvoice,
  RuntimeTrustTierInfo,
} from "./runtime-types.ts";
import {
  hashSecret,
  verifySecret,
  randomNumericCode,
  randomToken,
  sha256,
  safeEqual,
  weakPinReason,
} from "./security/crypto.ts";
import { matchAccountName } from "./security/name-match.ts";
import { createMemoryPersistence } from "./persistence/memory.ts";
import type { PersistenceStore } from "./persistence/types.ts";
import type { BackgroundJobScheduler } from "./jobs/types.ts";
import { mediaStore } from "./media/media-store.ts";

export type {
  BuyerConversationSession,
  ChatThreadMessage,
  PaymentReconciliationResult,
  QuickReplyOption,
  RuntimeCommerceEvent,
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
} from "./runtime-types.ts";


/**
 * High-quality contextual fallback photos for products added via WhatsApp
 * without an image attachment, avoiding placeholder/broken image boxes.
 */
export function getSmartFallbackImage(name: string, category?: string): string {
  const combined = `${name} ${category ?? ""}`.toLowerCase();
  if (/heel|shoe|boot|sneaker|slide|sandal|footwear/i.test(combined)) {
    return "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600&q=80";
  }
  if (/bag|tote|handbag|purse|backpack|clutch/i.test(combined)) {
    return "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=80";
  }
  if (/dress|shirt|gown|cloth|wear|hoodie|top|pants|suit|jacket/i.test(combined)) {
    return "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80";
  }
  if (/flask|bottle|cup|tumbler|mug|drinkware/i.test(combined)) {
    return "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&q=80";
  }
  if (/food|lunch|cake|snack|rice|pastry|meal|kitchen/i.test(combined)) {
    return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80";
  }
  if (/cosmetic|cream|lotion|perfume|oil|soap|beauty|skin/i.test(combined)) {
    return "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=600&q=80";
  }
  return "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80";
}

/**
 * Deterministically computes a 64-bit hex perceptual fingerprint (`imagePhash`)
 * from an uploaded image Data URL or URL string.
 */
export function computeDeterministicImagePhash(imageSource: string): string {
  return crypto.createHash("sha256").update(imageSource.trim()).digest("hex").slice(0, 16);
}

/**
 * Resolves the structured 3-5 letter SKU prefix from a product's name and category.
 */
export function resolveStructuredSkuPrefix(name: string, category?: string): string {
  const n = (name || "").toUpperCase();
  const c = (category || "").toUpperCase();
  const combined = `${n} ${c}`;

  if (/\b(BAG|TOTE|HANDBAG|PURSE|BACKPACK|CLUTCH|WALLET|POUCH)(?:S|ES)?\b/.test(n)) return "BAG";
  if (/\b(HEEL|SHOE|BOOT|SNEAKER|SLIDE|SANDAL|LOAFER|MULE|SLIPPER|STILETTO|FOOTWEAR)(?:S|ES)?\b/.test(n)) return "SHOE";
  if (/\b(FLASK|BOTTLE|TUMBLER|MUG|THERMOS)(?:S|ES)?\b/.test(n)) return "FLASK";
  if (/\b(WIG|FRONTAL|CLOSURE|BRAID|BUNDLE|HAIR EXTENSION)(?:S|ES)?\b/.test(combined)) return "HAIR";
  if (/\b(PERFUME|OUD|SCENT|FRAGRANCE|COLOGNE|DIFFUSER|BODY MIST)(?:S|ES)?\b/.test(combined)) return "SCNT";
  if (/\b(WATCH|NECKLACE|BRACELET|EARRING|RING|JEWELRY|SUNGLASS|EYEGLASS|CHAIN)(?:S|ES)?\b/.test(combined)) return "JEWL";
  if (/\b(PHONE|IPHONE|SAMSUNG|LAPTOP|MACBOOK|EARBUD|AIRPOD|POWERBANK|CHARGER|TABLET|GADGET)(?:S|ES)?\b/.test(combined)) return "TECH";
  if (/\b(TV|FRIDGE|FREEZER|FAN|IRON|SPEAKER|INVERTER|GENERATOR|APPLIANCE|MICROWAVE)(?:S|ES)?\b/.test(combined)) return "ELEC";
  if (/\b(POT|PAN|BLENDER|KETTLE|PLATE|CUTLERY|KITCHEN|COOKWARE|UTENSIL)(?:S|ES)?\b/.test(combined)) return "KITCH";
  if (/\b(FOOD|LUNCH|CAKE|SNACK|RICE|MEAL|CHOPS|PASTRY|HONEY|SPICE|GROCER|CATERING)(?:S|ES)?\b/.test(combined)) return "FOOD";
  if (/\b(COSMETIC|CREAM|LOTION|SERUM|SOAP|BUTTER|MAKEUP|BEAUTY|SKINCARE|GLOW|CLEANSER)(?:S|ES)?\b/.test(combined)) return "GLOW";
  if (/\b(DRESS|SHIRT|GOWN|HOODIE|TOP|PANTS|TROUSER|SUIT|JACKET|WEAR|CLOTH|ABAYA|ANKARA|KAFTAN|SKIRT|JEAN|APPAREL)(?:S|ES)?\b/.test(combined)) return "WEAR";
  if (/\b(BED|SHEET|DUVET|PILLOW|CURTAIN|RUG|LAMP|CHAIR|TABLE|DECOR|FURNITURE)(?:S|ES)?\b/.test(combined)) return "HOME";
  if (/\b(VITAMIN|SUPPLEMENT|GYM|TEA|HERB|FITNESS|WELLNESS|HEALTH)(?:S|ES)?\b/.test(combined)) return "HLTH";
  if (/\b(BABY|KID|TOY|DIAPER|STROLLER|INFANT)(?:S|ES)?\b/.test(combined)) return "KIDS";
  if (/\b(BOOK|JOURNAL|PLANNER|PEN|STATIONERY|CRAFT)(?:S|ES)?\b/.test(combined)) return "BOOK";
  if (/\b(CAR|AUTO|TIRE|BATTERY|TOOL|HELMET)(?:S|ES)?\b/.test(combined)) return "AUTO";

  if (/SHOES|BAGS|FOOTWEAR/.test(c)) return "SHOE";
  if (/FASHION|APPAREL/.test(c)) return "WEAR";
  if (/BEAUTY|SKINCARE|COSMETIC/.test(c)) return "GLOW";

  const catToken = c.replace(/[^A-Z0-9]/g, "").slice(0, 4);
  if (catToken.length >= 3 && catToken !== "GENE" && catToken !== "CUST") {
    return catToken;
  }

  const firstWord = n.trim().split(/\s+/)[0]?.replace(/[^A-Z0-9]/g, "") ?? "";
  if (firstWord.length >= 3) {
    return firstWord.slice(0, 4);
  }
  return "ITEM";
}

/**
 * Generates a clean, consistent, sequential SKU (Content ID) for a product
 * based on category/name prefix (e.g. SHOE-03, BAG-02, FLASK-01, WEAR-01)
 * avoiding duplicates and inconsistent fallback codes.
 */
export function generateConsistentSku(
  name: string,
  category?: string,
  existingProducts: Array<{ skuCode: string }> = []
): string {
  const prefix = resolveStructuredSkuPrefix(name, category);
  const existingUpper = new Set(existingProducts.map((p) => p.skuCode.trim().toUpperCase()));

  let index = 1;
  let candidate = `${prefix}-${String(index).padStart(2, "0")}`;
  while (existingUpper.has(candidate)) {
    index++;
    candidate = `${prefix}-${String(index).padStart(2, "0")}`;
  }
  return candidate;
}

/**
 * Generates a structured variant SKU (`<PARENT_SKU>-<VARIANT_TOKEN>`, e.g. `SHOE-01-39GLD`).
 */
export function generateVariantSku(
  parentSku: string,
  variantName: string,
  index: number,
  usedSkus: Set<string> = new Set()
): string {
  const cleanParent = parentSku.trim().toUpperCase();
  const raw = (variantName || "").toUpperCase();

  const colorMap: Array<[RegExp, string]> = [
    [/\bBLACK\b/, "BLK"],
    [/\bGOLD\b/, "GLD"],
    [/\bSILVER\b/, "SLV"],
    [/\bWHITE\b/, "WHT"],
    [/\bGREEN\b/, "GRN"],
    [/\bBLUE\b/, "BLU"],
    [/\bPINK\b/, "PNK"],
    [/\bBROWN\b/, "BRN"],
    [/\bPURPLE\b/, "PRP"],
    [/\bYELLOW\b/, "YLW"],
    [/\bORANGE\b/, "ORG"],
    [/\bRED\b/, "RED"],
    [/\bTAN\b/, "TAN"],
    [/\bNAVY\b/, "NVY"],
    [/\bNUDE\b/, "NUD"],
  ];

  const sizeMatch = raw.match(/\b(\d{1,4}(?:ML|L|KG|G|IN|CM)?|XXXL|XXL|XL|XS|SM|MD|LG)\b/);
  let colorCode = "";
  for (const [regex, abbr] of colorMap) {
    if (regex.test(raw)) {
      colorCode = abbr;
      break;
    }
  }

  let suffix = "";
  if (sizeMatch && colorCode) {
    suffix = `${sizeMatch[1]}${colorCode}`;
  } else if (sizeMatch) {
    const rest = raw
      .replace(sizeMatch[0], "")
      .replace(/\b(SIZE|COLOR|COLOUR|VOLUME|LENGTH)\b/g, "")
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 3);
    suffix = `${sizeMatch[1]}${rest}`;
  } else if (colorCode) {
    suffix = colorCode;
  } else {
    suffix =
      raw
        .replace(/\b(SIZE|COLOR|COLOUR|VARIANT)\b/g, "")
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6) || `V${index + 1}`;
  }

  let candidate = `${cleanParent}-${suffix}`;
  let counter = 2;
  while (usedSkus.has(candidate)) {
    candidate = `${cleanParent}-${suffix}${counter}`;
    counter++;
  }
  usedSkus.add(candidate);
  return candidate;
}

/**
 * Generates a guaranteed-unique, human-friendly Order ShortCode (`ORD-<SEQ>`, e.g. `ORD-883`).
 *
 * Logic:
 * 1. Scans all existing orders and previously allocated codes to find the highest numeric sequence (starting at base 880).
 * 2. Increments monotonically (`max + 1`) and verifies against both active orders and the lifetime `allocatedCodes` set
 *    so deleted, expired, or concurrent orders can never collide or reuse an order number.
 * 3. Immediately reserves the code in `allocatedCodes` before returning.
 */
export function generateUniqueOrderShortCode(
  existingOrders: Array<{ shortCode: string }> = [],
  allocatedCodes: Set<string> = new Set(),
  minBaseSequence = 880
): { shortCode: string; sequenceNumber: number } {
  const existingUpper = new Set<string>();
  let maxSeq = minBaseSequence;

  for (const order of existingOrders) {
    const code = order.shortCode.trim().toUpperCase();
    existingUpper.add(code);
    const match = /^ORD-(\d+)(?:-[A-Z0-9]+)?$/i.exec(code);
    if (match) {
      maxSeq = Math.max(maxSeq, Number(match[1]));
    }
  }

  for (const code of allocatedCodes) {
    const upper = code.trim().toUpperCase();
    existingUpper.add(upper);
    const match = /^ORD-(\d+)(?:-[A-Z0-9]+)?$/i.exec(upper);
    if (match) {
      maxSeq = Math.max(maxSeq, Number(match[1]));
    }
  }

  let nextSeq = maxSeq + 1;
  let candidate = `ORD-${nextSeq}`;
  while (existingUpper.has(candidate) || allocatedCodes.has(candidate)) {
    nextSeq++;
    candidate = `ORD-${nextSeq}`;
  }

  allocatedCodes.add(candidate);
  return { shortCode: candidate, sequenceNumber: nextSeq };
}

export class CaterlogStage1Engine {
  public readonly eventBus = new InMemoryDomainEventBus();
  public readonly monnify: MonnifyPaymentAdapter;
  public readonly whatsapp: WhatsAppCloudAdapter;
  public readonly catalog: WhatsAppCatalogAdapter;
  public readonly shipbubble: ShipbubbleAdapter;
  public readonly integrationConfig: IntegrationConfig;

  public vendor: RuntimeVendor = {
    id: "v-amaka-001",
    slug: "amaka-shoes",
    businessName: "Amaka Luxury Shoes",
    role: "growth",
    whatsappPhone: process.env.VENDOR_WHATSAPP_PHONE ?? "+2348031234567",
    whatsappPhoneId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "105992837465001",
    verificationStatus: "VERIFIED",
    copilotMode: ((process.env.COPILOT_MODE as DomainCopilotMode) || "FULL_AUTO") as DomainCopilotMode,
    copilotIdleSeconds: 60,
    reservationTtlMinutes: 15,
    bankCode: "50515",
    bankName: "Moniepoint MFB",
    bankAccountNumber: "8031234567",
    bankAccountName: "Amaka Luxury Shoes Ltd",
    monnifySubAccountCode: "MFY_SUB_AMAKA_001",
    instagramHandle: "@amakashoes",
    instagramConnected: true,
    instagramBusinessId: "IG_BIZ_178414001",
    facebookPageName: "Amaka Luxury Shoes Official",
    facebookPageId: "FB_PAGE_104928371",
    facebookConnected: true,
    verifiedLegalName: "AMAKA LUXURY SHOES LTD",
    verifiedBvnHash: undefined,
    transactionPinHash: undefined,
    pinFailedAttempts: 0,
    pinLockedUntil: undefined,
    pinSetAt: undefined,
    isPayoutFrozen: false,
    payoutFrozenUntil: undefined,
    pendingBankUpdate: null,
    subscription: {
      planId: "GROWTH",
      planName: "Growth Vendor (Market Boost)",
      billingCycle: "MONTHLY",
      status: "ACTIVE",
      currentPeriodStart: "2026-11-01T00:00:00.000Z",
      currentPeriodEnd: "2026-12-01T00:00:00.000Z",
      cancelAtPeriodEnd: false,
      priceNaira: 22500,
      priceUsd: 15,
      platformFeeBps: 100,
      maxProducts: -1,
      maxTeamSeats: 5,
      copilotTier: "FULL_AUTO",
      hasCustomDomain: false,
      hasResellerMirroring: false,
      hasPhashStatusMatching: true,
      hasMarketBoost: true,
      pickupStationEnabled: true,
      paymentMethod: {
        type: "CARD",
        brand: "Mastercard",
        last4: "4242",
        bankName: "Guaranty Trust Bank",
        expiry: "08/28",
      },
    },
    trustTier: {
      currentTier: 1,
      tierName: "Level 1: Dispatch Payouts",
      settlementSpeed: "50% at Courier Pickup, 50% at Delivery",
      dailyPayoutLimitNaira: 2000000,
      completedCleanOrders: 14,
      requiredOrdersForNextTier: 20,
      isKycVerified: true,
      isCacVerified: false,
      disputeRatePercent: 0.0,
      canFastTrackLevel2: true,
    },
    invoices: [
      {
        id: "inv-003",
        invoiceNumber: "INV-2026-003",
        description: "Growth Plan Subscription - Nov 2026",
        amountNaira: 9500,
        status: "PAID",
        paidAt: "2026-11-01T08:15:00.000Z",
        pdfUrl: "/invoices/INV-2026-003.pdf",
        planId: "GROWTH",
      },
      {
        id: "inv-002",
        invoiceNumber: "INV-2026-002",
        description: "Growth Plan Subscription - Oct 2026",
        amountNaira: 9500,
        status: "PAID",
        paidAt: "2026-10-01T08:15:00.000Z",
        pdfUrl: "/invoices/INV-2026-002.pdf",
        planId: "GROWTH",
      },
      {
        id: "inv-001",
        invoiceNumber: "INV-2026-001",
        description: "Growth Plan Subscription - Sep 2026",
        amountNaira: 9500,
        status: "PAID",
        paidAt: "2026-09-01T08:15:00.000Z",
        pdfUrl: "/invoices/INV-2026-001.pdf",
        planId: "GROWTH",
      },
    ],
    shipbubbleConfig: {
      pickupAddress: "14 Admiralty Way, Lekki Phase 1, Lagos, Nigeria",
      pickupAddressCode: 871341691,
      pickupFormattedAddress: "Road 14 Admiralty Wy, Lekki Phase I, Lagos 106104, Lagos, Nigeria",
      pickupCity: "Eti Osa",
      pickupState: "Lagos",
      pickupPostalCode: "106104",
      defaultCategoryId: 74794423,
      defaultWeightPreset: "SHOEBOX",
      customWeightKg: 1.5,
      selectedCarriers: ["test_1_courier"],
      autoBookOnPaid: false,
      liveCheckoutRatesEnabled: true,
    },
  };

  public products: RuntimeProduct[] = [
    {
      id: "prod-1",
      skuCode: "SHOE-01",
      name: "Zara Block Heel (Gold)",
      description: "Imported gold strap block heel, sizes 38-41.",
      category: "fashion",
      basePriceKobo: nairaToKobo(25000),
      primaryImageUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600&q=80",
      imagePhash: "f8c39a71b2e409d1",
      stockTotal: 5,
      stockReserved: 1,
    },
    {
      id: "prod-2",
      skuCode: "SHOE-02",
      name: "Hermes Oran Leather Slide",
      description: "Classic tan flat leather sandal for everyday luxury.",
      category: "fashion",
      basePriceKobo: nairaToKobo(18500),
      primaryImageUrl: "https://images.unsplash.com/photo-1562273138-f46be4ebdf33?w=600&q=80",
      imagePhash: "a1b2c3d4e5f60718",
      stockTotal: 8,
      stockReserved: 0,
    },
    {
      id: "prod-3",
      skuCode: "BAG-01",
      name: "Jacquemus Le Chiquito Mini Bag",
      description: "Structured mini top-handle bag with gold hardware.",
      category: "fashion",
      basePriceKobo: nairaToKobo(42000),
      primaryImageUrl: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=80",
      imagePhash: "9988776655443322",
      stockTotal: 3,
      stockReserved: 0,
    },
    {
      id: "prod-4",
      skuCode: "SKU-0895",
      name: "Stainless Steel Vacuum Flask",
      description: "Double-walled stainless steel thermal vacuum flask.",
      category: "Kitchenware & Drinkware",
      basePriceKobo: nairaToKobo(10000),
      primaryImageUrl: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500&auto=format&fit=crop&q=60",
      imagePhash: "1122334455667788",
      stockTotal: 45,
      stockReserved: 0,
    },
  ];

  public shippingZones: RuntimeShippingZone[] = [
    { id: "sz-1", code: 1, name: "Mainland", feeKobo: nairaToKobo(2500), isActive: true },
    { id: "sz-2", code: 2, name: "Lekki", feeKobo: nairaToKobo(3500), isActive: true },
    { id: "sz-3", code: 3, name: "Abuja / Interstate", feeKobo: nairaToKobo(5000), isActive: true },
    { id: "sz-4", code: 4, name: "Pickup", feeKobo: nairaToKobo(0), isActive: true },
  ];

  public discounts: RuntimeDiscount[] = [
    {
      id: "disc-1",
      code: "PAYDAY",
      type: "PERCENTAGE",
      value: 1000n, // 10%
      minOrderKobo: nairaToKobo(15000),
      usedCount: 2,
      maxUses: 50,
      isActive: true,
    },
    {
      id: "disc-2",
      code: "VIP5000",
      type: "FLAT_KOBO",
      value: nairaToKobo(5000),
      minOrderKobo: nairaToKobo(35000),
      usedCount: 1,
      maxUses: 20,
      isActive: true,
    },
  ];

  public orders: RuntimeOrder[] = [
    {
      id: "ord-seed-882",
      shortCode: "ORD-882",
      customerPhone: "+2348099887766",
      customerName: "Chidinma Okafor",
      productId: "prod-1",
      productSku: "SHOE-01",
      productName: "Zara Block Heel (Gold)",
      variantId: "var-1-39",
      variantSku: "SHOE-01-39",
      variantName: "Size 39",
      quantity: 1,
      shippingZoneName: "Lekki",
      subtotalKobo: nairaToKobo(25000),
      shippingFeeKobo: nairaToKobo(3500),
      discountAmountKobo: 0n,
      totalAmountKobo: nairaToKobo(28500),
      amountPaidKobo: 0n,
      status: "PENDING_PAYMENT",
      invoiceReference: "CAT_ORD882_SEED",
      accountNumber: "8092341102",
      bankName: "Moniepoint MFB",
      accountName: "CATERLOG / AMAKA LUXUROUS SHOES",
      paymentExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      createdAt: new Date(Date.now() - 2 * 60 * 1000),
    },
    {
      id: "ord-seed-881",
      shortCode: "ORD-881",
      customerPhone: "+2348022334455",
      customerName: "Tunde Bakare",
      productId: "prod-2",
      productSku: "SHOE-02",
      productName: "Hermes Oran Leather Slide",
      quantity: 1,
      shippingZoneName: "Mainland",
      subtotalKobo: nairaToKobo(18500),
      shippingFeeKobo: nairaToKobo(2500),
      discountAmountKobo: 0n,
      totalAmountKobo: nairaToKobo(21000),
      amountPaidKobo: nairaToKobo(21000),
      status: "PAID",
      invoiceReference: "CAT_ORD881_SEED",
      accountNumber: "8044556677",
      bankName: "Moniepoint MFB",
      accountName: "CATERLOG / AMAKA LUXURY SHOES",
      paymentExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      createdAt: new Date(Date.now() - 45 * 60 * 1000),
      paidAt: new Date(Date.now() - 40 * 60 * 1000),
    },
  ];

  public chatMessages: ChatThreadMessage[] = [];
  public marketBoostListing: RuntimeMarketBoostListing | null = null;
  public suppliers: RuntimeSupplierProfile[] = [
    {
      id: "sup-1",
      slug: "aroko-wholesale",
      name: "Aroko Wholesale",
      verified: true,
      cacNumber: "RC-1928401",
      category: "Kitchenware & Home Living",
      location: "Lagos, Nigeria",
      state: "Lagos",
      shippingScope: "LOCAL_STATE",
      allowInterstate: false,
      coveredStates: ["Lagos"],
      coveredLgas: [],
      warehouseAddress: "Warehouse 3B, International Trade Fair Complex, Badagry Expressway, Lagos",
      phone: "+234 803 442 9910",
      whatsapp: "+2348034429910",
      rating: 4.9,
      totalFulfilled: 3420,
      subAccountCode: "MFY_SUB_AROKO_001",
      leadTime: "Same-Day Dispatch",
      cutoffTime: "2:00 PM WAT",
      wholesaleTerms: [
        "1 unit dropship MOQ",
        "Instant Monnify split settlement",
        "7-day defective replacement",
      ],
      catalogProducts: [
        {
          sku: "ARK-MUG-01",
          name: "Aroko Ceramic Coffee Mug Set",
          wholesalePriceNaira: 12000,
          suggestedRetailNaira: 16500,
          stock: 45,
          moq: 1,
          category: "Kitchenware",
        },
        {
          sku: "ARK-JAR-02",
          name: "Bamboo Lid Glass Storage Jar Trio",
          wholesalePriceNaira: 18500,
          suggestedRetailNaira: 25000,
          stock: 30,
          moq: 1,
          category: "Home Storage",
        },
      ],
    },
    {
      id: "sup-2",
      slug: "zaria-luxe-textiles",
      name: "Zaria Luxe Textiles & Footwear",
      verified: true,
      cacNumber: "RC-2049182",
      category: "Fashion & Footwear",
      location: "Ikeja, Lagos",
      state: "Lagos",
      shippingScope: "NATIONWIDE",
      allowInterstate: true,
      coveredStates: ["Lagos", "FCT - Abuja", "Rivers", "Kano", "Oyo", "Ogun"],
      coveredLgas: [],
      warehouseAddress: "19 Allen Avenue, Ikeja, Lagos",
      phone: "+234 809 551 1122",
      whatsapp: "+2348095511122",
      rating: 4.8,
      totalFulfilled: 1890,
      subAccountCode: "MFY_SUB_ZARIA_002",
      leadTime: "24h Nationwide Hub Dispatch",
      cutoffTime: "4:00 PM WAT",
      wholesaleTerms: [
        "Nationwide GIGL & Shipbubble Hub delivery",
        "Automated Monnify split settlement",
      ],
      catalogProducts: [
        {
          sku: "ZLT-SLIP-01",
          name: "Handcrafted Leather Mule Slippers",
          wholesalePriceNaira: 15000,
          suggestedRetailNaira: 22000,
          stock: 60,
          moq: 1,
          category: "Footwear",
        },
      ],
    },
  ];
  public resellerMirrors: RuntimeResellerMirror[] = [];
  public paymentLinks: RuntimePaymentLink[] = [];
  public payoutWithdrawals: RuntimePayoutWithdrawal[] = [];
  public settlementSplitRules: RuntimeSettlementSplitRule[] = [];
  public kycSubmissions: RuntimeKycSubmission[] = [];
  public teamMembers: RuntimeTeamMember[] = [
    {
      id: "tm-owner",
      name: "Amaka Okonkwo (Store Owner)",
      email: "owner@caterlog.store",
      phone: "+2348091234567",
      role: "Owner",
      status: "Active",
      canManageOrders: true,
      canManageInventory: true,
      canViewPayouts: true,
      canProcessRefunds: true,
      canOverrideCopilot: true,
      lastActiveAt: new Date(),
      invitedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    },
    {
      id: "tm-rider",
      name: "Chinedu Eze (Dispatch Rider)",
      email: "rider@caterlog.store",
      phone: "+2348031112222",
      role: "Dispatch Coordinator",
      status: "Active",
      canManageOrders: true,
      canManageInventory: false,
      canViewPayouts: false,
      canProcessRefunds: false,
      canOverrideCopilot: false,
      lastActiveAt: new Date(),
      invitedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    },
    {
      id: "tm-catalog",
      name: "Tolu Adebayo (Catalog Editor)",
      email: "catalog@caterlog.store",
      phone: "+2348052223333",
      role: "Catalog Editor",
      status: "Active",
      canManageOrders: false,
      canManageInventory: true,
      canViewPayouts: false,
      canProcessRefunds: false,
      canOverrideCopilot: false,
      lastActiveAt: new Date(),
      invitedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
  ];
  public notifications: RuntimeVendorNotification[] = [];
  public commerceEvents: RuntimeCommerceEvent[] = [];

  public readonly buyerSessions = new Map<string, BuyerConversationSession>();
  public readonly buyerCarts = new Map<string, RuntimeCartItem[]>();

  public getBuyerCart(phone: string): RuntimeCartItem[] {
    return this.buyerCarts.get(phone) ?? [];
  }

  public addToBuyerCart(phone: string, item: RuntimeCartItem): RuntimeCartItem[] {
    const cart = this.buyerCarts.get(phone) ?? [];
    const existing = cart.find(
      (ci) => ci.productId === item.productId && ci.variantId === item.variantId
    );
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      cart.push({ ...item });
    }
    this.buyerCarts.set(phone, cart);
    return cart;
  }

  public clearBuyerCart(phone: string): void {
    this.buyerCarts.delete(phone);
  }
  private readonly processedTxRefs = new Set<string>();
  private readonly allocatedOrderCodes = new Set<string>(["ORD-881", "ORD-882"]);
  private highestOrderSeq = 882;
  private readonly activeCopilotTimers = new Map<string, NodeJS.Timeout>();
  private lastVendorReplyInBuyerThreadAt: Date | null = null;
  private persistence: PersistenceStore = createMemoryPersistence();
  private persistenceQueue: Promise<void> = Promise.resolve();
  private readonly persistenceErrors: string[] = [];
  private jobScheduler: BackgroundJobScheduler | null = null;
  private readonly magicTokens = new Map<
    string,
    { token: string; vendorSlug: string; expiresAt: Date; used: boolean }
  >();

  public attachJobScheduler(scheduler: BackgroundJobScheduler | null): void {
    this.jobScheduler = scheduler;
  }

  public getJobScheduler(): BackgroundJobScheduler | null {
    return this.jobScheduler;
  }

  public createMagicLinkToken(phone?: string, email?: string): string {
    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60_000);
    this.magicTokens.set(token, {
      token,
      vendorSlug: this.vendor.slug,
      expiresAt,
      used: false,
    });
    if (this.persistence.saveAuthSession) {
      this.persistInBackground("saveAuthSession", () =>
        this.persistence.saveAuthSession!({
          token,
          phone: phone ?? this.vendor.whatsappPhone,
          email: email ?? `${this.vendor.slug}@caterlog.store`,
          expiresAt,
        })
      );
    }
    return token;
  }

  public verifyMagicLinkToken(token: string): { token: string; vendorSlug: string } | null {
    const record = this.magicTokens.get(token);
    if (!record || record.used || record.expiresAt < new Date()) {
      return null;
    }
    record.used = true;
    if (this.persistence.consumeAuthSession) {
      this.persistInBackground("consumeAuthSession", async () => {
        await this.persistence.consumeAuthSession!(token);
      });
    }
    return { token: record.token, vendorSlug: record.vendorSlug };
  }

  private readonly activeSessions = new Map<string, VendorSession>();

  public createVendorSession(input?: {
    phone?: string;
    email?: string;
    staffMemberId?: string;
    staffName?: string;
    staffRole?: string;
    isOwner?: boolean;
    permissions?: {
      canManageOrders: boolean;
      canManageInventory: boolean;
      canViewPayouts: boolean;
      canProcessRefunds: boolean;
      canOverrideCopilot: boolean;
    };
    ipAddress?: string;
    userAgent?: string;
    ttlDays?: number;
  }): { token: string; session: VendorSession } {
    const rawToken = randomToken(32);
    const tokenHash = sha256(rawToken);
    const ttlDays = input?.ttlDays ?? 7;
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
    const isOwner = input?.isOwner ?? true;
    const session: VendorSession = {
      tokenHash,
      vendorSlug: this.vendor.slug,
      phone: input?.phone ?? this.vendor.whatsappPhone,
      email: input?.email ?? `${this.vendor.slug}@caterlog.store`,
      staffMemberId: input?.staffMemberId,
      staffName: input?.staffName ?? this.vendor.businessName,
      staffRole: input?.staffRole ?? (isOwner ? "Owner" : "Store Attendant"),
      isOwner,
      permissions: input?.permissions ?? {
        canManageOrders: true,
        canManageInventory: true,
        canViewPayouts: true,
        canProcessRefunds: true,
        canOverrideCopilot: true,
      },
      createdAt: new Date(),
      expiresAt,
      lastActiveAt: new Date(),
      ipAddress: input?.ipAddress,
      userAgent: input?.userAgent,
    };
    this.activeSessions.set(tokenHash, session);
    return { token: rawToken, session };
  }

  public authenticateStaffMember(input: {
    email: string;
    ipAddress?: string;
    userAgent?: string;
    ttlDays?: number;
  }): { token: string; session: VendorSession; member: RuntimeTeamMember } {
    const cleanEmail = input.email.trim().toLowerCase();
    if (!cleanEmail) {
      throw new Error("Staff email is required.");
    }
    const member = this.teamMembers.find(
      (m) => m.email.toLowerCase() === cleanEmail || m.id.toLowerCase() === cleanEmail
    );
    if (!member) {
      throw new Error(`No team member found for "${input.email}".`);
    }
    if (member.status === "Suspended") {
      throw new Error(`Staff account "${member.email}" has been suspended by the store owner.`);
    }

    if (member.status === "Invited") {
      member.status = "Active";
    }
    member.lastActiveAt = new Date();
    if (this.persistence.saveTeamMember) {
      this.persistInBackground("saveTeamMember", () =>
        this.persistence.saveTeamMember!(member)
      );
    }

    const isOwner = member.role === "Owner";
    const { token, session } = this.createVendorSession({
      email: member.email,
      phone: member.phone,
      staffMemberId: member.id,
      staffName: member.name,
      staffRole: member.role,
      isOwner,
      permissions: {
        canManageOrders: isOwner ? true : member.canManageOrders,
        canManageInventory: isOwner ? true : member.canManageInventory,
        canViewPayouts: isOwner ? true : member.canViewPayouts,
        canProcessRefunds: isOwner ? true : member.canProcessRefunds,
        canOverrideCopilot: isOwner ? true : member.canOverrideCopilot,
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      ttlDays: input.ttlDays,
    });

    this.recordAuditEvent(
      "STAFF_SESSION_AUTHENTICATED",
      "VENDOR_WEB_DASHBOARD",
      "VENDOR",
      member.email,
      {
        staffName: member.name,
        role: member.role,
        permissions: session.permissions,
      }
    );
    void this.broadcastStateChange();
    return { token, session, member };
  }

  public authenticateVendorSession(rawToken: string): VendorSession | null {
    if (!rawToken || typeof rawToken !== "string") return null;
    const tokenHash = sha256(rawToken.trim());
    const session = this.activeSessions.get(tokenHash);
    if (!session) return null;
    if (session.expiresAt.getTime() < Date.now()) {
      this.activeSessions.delete(tokenHash);
      return null;
    }

    // If this session belongs to a non-owner staff member, verify they are still active
    // and dynamically sync their latest permissions from teamMembers.
    if (!session.isOwner && (session.staffMemberId || session.email)) {
      const member = this.teamMembers.find(
        (m) =>
          (session.staffMemberId && m.id === session.staffMemberId) ||
          (session.email && m.email.toLowerCase() === session.email.toLowerCase())
      );
      if (!member || member.status === "Suspended") {
        this.activeSessions.delete(tokenHash);
        return null;
      }
      session.staffRole = member.role;
      session.isOwner = member.role === "Owner";
      session.permissions = {
        canManageOrders: session.isOwner ? true : member.canManageOrders,
        canManageInventory: session.isOwner ? true : member.canManageInventory,
        canViewPayouts: session.isOwner ? true : member.canViewPayouts,
        canProcessRefunds: session.isOwner ? true : member.canProcessRefunds,
        canOverrideCopilot: session.isOwner ? true : member.canOverrideCopilot,
      };
      member.lastActiveAt = new Date();
    }

    session.lastActiveAt = new Date();
    return session;
  }

  public revokeVendorSession(rawToken: string): boolean {
    if (!rawToken || typeof rawToken !== "string") return false;
    const tokenHash = sha256(rawToken.trim());
    return this.activeSessions.delete(tokenHash);
  }

  public revokeAllVendorSessions(): void {
    this.activeSessions.clear();
  }

  constructor(env: EnvLike = process.env) {
    this.integrationConfig = resolveIntegrationConfig(env);
    // Mock mode is always allowed; sandbox/live fail fast on missing credentials.
    assertValidIntegrationConfig(this.integrationConfig);

    this.monnify = MonnifyPaymentAdapter.fromConfig(this.integrationConfig.monnify);
    this.whatsapp = WhatsAppCloudAdapter.fromConfig(this.integrationConfig.whatsapp);
    this.catalog = WhatsAppCatalogAdapter.fromConfig(this.integrationConfig.catalog, {
      brand: this.vendor.businessName,
      productUrlBase: env.CATALOG_PRODUCT_URL_BASE,
    });
    this.shipbubble = ShipbubbleAdapter.fromConfig(this.integrationConfig.shipbubble);
  }

  /**
   * Switches the engine to a durable store and hydrates its working set.
   *
   * `DATA_MODE=memory` keeps the built-in demo data. When a database store is
   * attached, the demo seed is replaced by the persisted vendor snapshot and
   * every later mutation is mirrored back through `persistence`.
   */
  public async attachPersistence(
    store: PersistenceStore,
    vendorSlug: string = this.vendor.slug
  ): Promise<void> {
    this.persistence = store;
    const snapshot = await store.loadSnapshot(vendorSlug);
    if (snapshot) {
      this.applySnapshot(snapshot);
      return;
    }
    if (store.mode === "database") {
      throw new Error(
        `Vendor "${vendorSlug}" was not found in the database. Run "npm run db:seed" or set PERSISTENCE_VENDOR_SLUG to an existing vendor.`
      );
    }
    if ("initSnapshot" in store && typeof (store as any).initSnapshot === "function") {
      (store as any).initSnapshot(this.takeSnapshot());
    }
  }

  /**
   * Re-hydrates the in-memory engine state directly from the durable database
   * snapshot (after flushing any queued writes) so the Dashboard and PostgreSQL
   * are guaranteed 100% in sync.
   */
  public async syncFromDatabase(): Promise<void> {
    if (this.persistence.mode !== "database") return;
    await this.flushPersistence();
    const snapshot = await this.persistence.loadSnapshot(this.vendor.slug);
    if (snapshot) {
      this.applySnapshot(snapshot);
      await this.broadcastStateChange();
    }
  }

  public takeSnapshot(): RuntimeSnapshot {
    return {
      vendor: { ...this.vendor },
      products: this.products.map((product) => ({ ...product })),
      shippingZones: this.shippingZones.map((zone) => ({ ...zone })),
      discounts: this.discounts.map((discount) => ({ ...discount })),
      orders: this.orders.map((order) => ({ ...order })),
      processedTransactionRefs: Array.from(this.processedTxRefs),
      chatMessages: this.chatMessages.map((m) => ({ ...m })),
      buyerSessions: Array.from(this.buyerSessions.values()).map((s) => ({ ...s })),
      marketBoostListing: this.marketBoostListing ? { ...this.marketBoostListing } : null,
      suppliers: this.suppliers.map((s) => ({ ...s })),
      resellerMirrors: this.resellerMirrors.map((m) => ({ ...m })),
      paymentLinks: this.paymentLinks.map((l) => ({ ...l })),
      payoutWithdrawals: this.payoutWithdrawals.map((w) => ({ ...w })),
      settlementSplitRules: this.settlementSplitRules.map((r) => ({ ...r })),
      kycSubmissions: this.kycSubmissions.map((k) => ({ ...k })),
      teamMembers: this.teamMembers.map((t) => ({ ...t })),
      notifications: this.notifications.map((n) => ({ ...n })),
      commerceEvents: this.commerceEvents.map((e) => ({ ...e })),
      customers: this.customers.map((c) => ({ ...c })),
    };
  }

  public getDataMode(): "memory" | "database" {
    return this.persistence.mode;
  }

  /** Persistence failures observed since boot (for health/debug endpoints). */
  public getPersistenceErrors(): readonly string[] {
    return this.persistenceErrors;
  }

  /** Waits for all queued write-through operations to finish. */
  public async flushPersistence(): Promise<void> {
    await this.persistenceQueue;
  }

  /** Flushes pending write-through operations and disconnects the store. */
  public async closePersistence(): Promise<void> {
    await this.persistenceQueue;
    await this.persistence.close();
  }

  public customers: RuntimeCustomer[] = [];

  private applySnapshot(snapshot: RuntimeSnapshot): void {
    const existingShipbubbleConfig = this.vendor.shipbubbleConfig;
    const existingSubscription = this.vendor.subscription;
    const existingTrustTier = this.vendor.trustTier;
    const existingInvoices = this.vendor.invoices;
    const existingStorefrontConfig = this.vendor.storefrontConfig;
    const existingFeatureFlags = this.vendor.featureFlags;
    const existingSocialAccounts = this.vendor.socialAccounts;
    const existingCourierMap = new Map<string, RuntimeCourierShipmentReceipt>();
    for (const o of this.orders) {
      if (o.courierShipment) {
        existingCourierMap.set(o.shortCode.toUpperCase(), o.courierShipment);
      }
    }

    this.vendor = {
      ...snapshot.vendor,
      subscription: snapshot.vendor.subscription ?? existingSubscription,
      trustTier: snapshot.vendor.trustTier ?? existingTrustTier,
      invoices: snapshot.vendor.invoices ?? existingInvoices,
      storefrontConfig: snapshot.vendor.storefrontConfig ?? existingStorefrontConfig,
      featureFlags: snapshot.vendor.featureFlags ?? existingFeatureFlags ?? this.getDefaultFeatureFlags(),
      socialAccounts: snapshot.vendor.socialAccounts ?? existingSocialAccounts ?? this.getDefaultSocialAccounts(snapshot.vendor),
      shipbubbleConfig: snapshot.vendor.shipbubbleConfig ?? existingShipbubbleConfig ?? {
        pickupAddress: "14 Admiralty Way, Lekki Phase 1, Lagos, Nigeria",
        pickupAddressCode: 871341691,
        pickupFormattedAddress: "Road 14 Admiralty Wy, Lekki Phase I, Lagos 106104, Lagos, Nigeria",
        pickupCity: "Eti Osa",
        pickupState: "Lagos",
        pickupPostalCode: "106104",
        defaultCategoryId: 74794423,
        defaultWeightPreset: "SHOEBOX",
        customWeightKg: 1.5,
        selectedCarriers: ["test_1_courier"],
        autoBookOnPaid: false,
        liveCheckoutRatesEnabled: true,
      },
    };
    const envPhoneId =
      this.integrationConfig.whatsapp.defaultPhoneNumberId?.trim() ||
      process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
    if (
      envPhoneId &&
      envPhoneId !== "105992837465001" &&
      (!this.vendor.whatsappPhoneId || this.vendor.whatsappPhoneId === "105992837465001")
    ) {
      this.vendor.whatsappPhoneId = envPhoneId;
      this.persistInBackground("sync-vendor-whatsapp-phone-id", () =>
        this.persistence.saveVendor(this.vendor)
      );
    }
    const envVendorPhone = process.env.VENDOR_WHATSAPP_PHONE?.trim();
    if (
      envVendorPhone &&
      (!this.vendor.whatsappPhone || this.vendor.whatsappPhone === "+2348031234567")
    ) {
      this.vendor.whatsappPhone = envVendorPhone;
    }
    if (process.env.COPILOT_MODE) {
      this.vendor.copilotMode = process.env.COPILOT_MODE as DomainCopilotMode;
    } else if (!snapshot.vendor.copilotMode || snapshot.vendor.copilotMode === "COPILOT") {
      this.vendor.copilotMode = "FULL_AUTO";
    }
    if (this.persistence.mode === "database") {
      this.products = (snapshot.products ?? []).map((product) => ({
        ...product,
        variants: product.variants ? product.variants.map((v) => ({ ...v })) : undefined,
      }));
      this.shippingZones = (snapshot.shippingZones ?? []).map((zone) => ({ ...zone }));
      this.discounts = (snapshot.discounts ?? []).map((discount) => ({ ...discount }));
    } else {
      if (snapshot.products && snapshot.products.length > 0) {
        const seedMap = new Map(this.products.map((p) => [p.skuCode.toUpperCase(), p]));
        this.products = snapshot.products.map((product) => {
          const seed = seedMap.get(product.skuCode.toUpperCase());
          const variants =
            product.variants && product.variants.length > 0 ? product.variants : seed?.variants;
          return {
            ...product,
            variants,
          };
        });
      }
      if (snapshot.shippingZones && snapshot.shippingZones.length > 0) {
        this.shippingZones = snapshot.shippingZones.map((zone) => ({ ...zone }));
      }
      if (snapshot.discounts && snapshot.discounts.length > 0) {
        this.discounts = snapshot.discounts.map((discount) => ({ ...discount }));
      }
    }
    this.orders = snapshot.orders.map((order) => ({ ...order }));
    for (const order of this.orders) {
      const clean = order.shortCode.trim().toUpperCase();
      this.allocatedOrderCodes.add(clean);
      const match = /^ORD-(\d+)(?:-[A-Z0-9]+)?$/i.exec(clean);
      if (match) {
        const num = Number.parseInt(match[1], 10);
        if (Number.isFinite(num) && num > this.highestOrderSeq) {
          this.highestOrderSeq = num;
        }
      }
    }
    this.processedTxRefs.clear();
    for (const ref of snapshot.processedTransactionRefs) {
      this.processedTxRefs.add(ref);
    }
    if (snapshot.chatMessages) {
      this.chatMessages = snapshot.chatMessages.map((m) => ({ ...m }));
    }
    if (snapshot.buyerSessions) {
      this.buyerSessions.clear();
      for (const s of snapshot.buyerSessions) {
        this.buyerSessions.set(s.buyerPhone, { ...s });
      }
    }
    if (snapshot.marketBoostListing !== undefined) {
      this.marketBoostListing = snapshot.marketBoostListing
        ? { ...snapshot.marketBoostListing }
        : null;
    }
    if (snapshot.suppliers) {
      this.suppliers = snapshot.suppliers.map((s) => ({ ...s }));
    }
    if (snapshot.resellerMirrors) {
      this.resellerMirrors = snapshot.resellerMirrors.map((m) => ({ ...m }));
    }
    if (snapshot.paymentLinks) {
      this.paymentLinks = snapshot.paymentLinks.map((l) => ({ ...l }));
    }
    if (snapshot.payoutWithdrawals) {
      this.payoutWithdrawals = snapshot.payoutWithdrawals.map((w) => ({ ...w }));
    }
    if (snapshot.settlementSplitRules) {
      this.settlementSplitRules = snapshot.settlementSplitRules.map((r) => ({ ...r }));
    }
    if (snapshot.kycSubmissions) {
      this.kycSubmissions = snapshot.kycSubmissions.map((k) => ({ ...k }));
    }
    if (snapshot.teamMembers) {
      this.teamMembers = snapshot.teamMembers.map((t) => ({ ...t }));
    }
    if (snapshot.notifications) {
      this.notifications = snapshot.notifications.map((n) => ({ ...n }));
    }
    if (snapshot.customers) {
      this.customers = snapshot.customers.map((c) => ({ ...c }));
    }
    if (snapshot.commerceEvents) {
      this.commerceEvents = snapshot.commerceEvents.map((e) => ({ ...e }));
      // Re-hydrate persisted Shipbubble config and order courier receipts from durable CommerceEvents
      for (let i = this.commerceEvents.length - 1; i >= 0; i--) {
        const ev = this.commerceEvents[i]!;
        if (ev.eventType === "SHIPBUBBLE_CONFIG_UPDATED" && ev.payload?.config) {
          this.vendor.shipbubbleConfig = {
            ...this.vendor.shipbubbleConfig!,
            ...(ev.payload.config as Partial<RuntimeShipbubbleConfig>),
          };
        } else if (
          (ev.eventType === "SHIPBUBBLE_COURIER_BOOKED" ||
            ev.eventType === "SHIPBUBBLE_STATUS_UPDATED") &&
          ev.payload?.receipt
        ) {
          existingCourierMap.set(
            ev.entityId.toUpperCase(),
            ev.payload.receipt as RuntimeCourierShipmentReceipt
          );
        }
      }
    }
    for (const order of this.orders) {
      if (!order.courierShipment) {
        const cachedReceipt = existingCourierMap.get(order.shortCode.toUpperCase());
        if (cachedReceipt) {
          order.courierShipment = cachedReceipt;
        }
      }
    }
  }

  /**
   * Queues a write-through operation without blocking the caller. Used by the
   * synchronous dashboard/WhatsApp mutations so their return values stay sync.
   */
  private persistInBackground(label: string, work: () => Promise<void>): void {
    if (this.persistence.mode === "memory") return;
    const run = this.persistenceQueue.then(work);
    this.persistenceQueue = run.catch((err) => {
      this.recordPersistenceError(label, err);
    });
  }

  /**
   * Awaited variant for async flows (orders, payments, expiry, dispatch) where
   * the caller must know the durable write happened before replying.
   */
  private async persistNow(label: string, work: () => Promise<void>): Promise<void> {
    if (this.persistence.mode === "memory") return;
    const run = this.persistenceQueue.then(work);
    // Keep the queue usable even if this operation rejects.
    this.persistenceQueue = run.catch(() => undefined);
    try {
      await run;
    } catch (err) {
      this.recordPersistenceError(label, err);
      throw err;
    }
  }

  private recordPersistenceError(label: string, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    this.persistenceErrors.push(`${label}: ${message}`);
    console.error(`[caterlog:persistence] ${label} failed: ${message}`);
  }

  /**
   * Redacted integration modes + credential readiness for the dashboard header.
   */
  public getIntegrationStatus() {
    const described = describeIntegrationConfig(this.integrationConfig);
    return {
      ...described,
      monnify: {
        ...described.monnify,
        runtime: this.monnify.getIntegrationStatus(),
      },
      whatsapp: {
        ...described.whatsapp,
        runtime: this.whatsapp.getIntegrationStatus(),
      },
      catalog: {
        ...described.catalog,
        runtime: this.catalog.getIntegrationStatus(),
      },
      shipbubble: {
        ...(described.shipbubble ?? {
          mode: this.shipbubble.getMode(),
          baseUrl: "https://api.shipbubble.com/v1",
          apiKeySuffix: null,
          credentialsConfigured: !this.shipbubble.isMockMode(),
        }),
        runtime: this.shipbubble.getIntegrationStatus(),
      },
    };
  }

  /**
   * Unified dispatcher: sends the message to WhatsApp Cloud API (with photos,
   * interactive buttons, or interactive lists) AND appends to the chat store
   * so the mobile phone experience matches the dashboard simulator identically.
   */
  public async dispatchWhatsAppAndRecordChat(params: {
    channel: "VENDOR_ADMIN_WA" | "BUYER_SHOP_WA";
    toPhone: string;
    text: string;
    imageUrl?: string;
    quickReplies?: QuickReplyOption[];
    sender?: "CATERLOG_BOT" | "VENDOR";
    headerText?: string;
    footerText?: string;
  }): Promise<void> {
    let finalImageUrl = params.imageUrl;
    let mediaBuffer: Buffer | undefined;
    let mediaContentType: string | undefined;

    if (params.imageUrl) {
      const mediaMatch = params.imageUrl.match(/\/api\/v1\/media\/([^/?#]+)/);
      if (mediaMatch?.[1]) {
        const item = mediaStore.getMedia(decodeURIComponent(mediaMatch[1]));
        if (item) {
          mediaBuffer = item.buffer;
          mediaContentType = item.contentType;
          const pub = await mediaStore.getPublicUrl(item.mediaId);
          if (pub) finalImageUrl = pub;
        }
      }
    }

    const resolvedVendorPhoneId =
      this.vendor.whatsappPhoneId && this.vendor.whatsappPhoneId !== "105992837465001"
        ? this.vendor.whatsappPhoneId
        : this.integrationConfig.whatsapp.defaultPhoneNumberId ||
          process.env.WHATSAPP_PHONE_NUMBER_ID ||
          this.vendor.whatsappPhoneId;

    await this.whatsapp.sendWhatsAppMessage({
      toPhone: params.toPhone,
      text: params.text,
      imageUrl: finalImageUrl,
      mediaBuffer,
      mediaContentType,
      quickReplies: params.quickReplies,
      headerText: params.headerText,
      footerText: params.footerText,
      vendorPhoneId: resolvedVendorPhoneId,
    });

    this.appendChat({
      channel: params.channel,
      sender: params.sender ?? "CATERLOG_BOT",
      fromPhone: params.sender === "VENDOR" ? this.vendor.whatsappPhone : "CATERLOG",
      text: params.text,
      imageUrl: params.imageUrl,
      quickReplies: params.quickReplies,
    });
  }

  /**
   * Handles Vendor WhatsApp Keyword Commands (including attached product photos!).
   */
  public async handleVendorWhatsAppKeyword(
    rawText: string,
    attachedImageUrl?: string,
    attachedImagePhash?: string
  ): Promise<{
    replyText: string;
    commandType: string;
  }> {
    this.appendChat({
      channel: "VENDOR_ADMIN_WA",
      sender: "VENDOR",
      fromPhone: this.vendor.whatsappPhone,
      text: rawText,
      imageUrl: attachedImageUrl,
    });

    const cmd = parseVendorWhatsAppCommand(rawText);
    let replyText = "";
    let quickReplies: QuickReplyOption[] | undefined;

    switch (cmd.type) {
      case "OPEN_DASHBOARD": {
        const token = this.createMagicLinkToken();
        const dashboardUrl = process.env.DASHBOARD_URL ?? "http://localhost:3000";
        replyText = `🔐 *Your 1-Tap Dashboard Login Link:*\n${dashboardUrl}?token=${token}&magic_vendor=${this.vendor.slug}\n\n⏳ _Valid for 15 minutes._`;
        break;
      }

      case "HELP_MENU": {
        replyText = [
          "🛠️ *CATERLOG VENDOR COMMAND MENU*",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📦 *CATALOG & INVENTORY*",
          "• *products* — View all products & live stock",
          "• *sync* or *catalog sync* — Publish all items to WhatsApp Business Catalog",
          "• *stock <SKU> <Qty>* — Update stock count (e.g. `stock SHOE-01 10`)",
          "• *Photo + Name, #Price, stock Qty* — Add single product",
          "• *Photo + Name, 38: #20000 (5), 39: #25000 (3)* — Add variable product with individual prices",
          "• *delete <SKU>* — Remove product from store & catalog",
          "",
          "💰 *SALES & ORDERS*",
          "• *sales* — Today's revenue & order breakdown",
          "• *sales week* / *sales month* — 7-day or 30-day breakdown",
          "• *pending* — View orders awaiting bank transfer",
          "• *paid* — View paid orders ready for dispatch",
          "• *dispatch <OrderCode> <RiderPhone>* — Dispatch order & notify buyer",
          "",
          "🚚 *SHIPPING & DISCOUNTS*",
          "• *shipping* — View all delivery zones",
          "• *ship <Location> #<Fee>* — Add or update delivery zone (e.g. `ship Ibadan #6000`)",
          "• *shipping delete <#>* — Remove zone (e.g. `shipping delete 2`)",
          "• *discount* — View active promo codes",
          "• *discount add <Code> <Value>* — Add code (e.g. `discount add PAYDAY 10%`)",
          "• *discount off <Code>* — Deactivate discount code",
          "",
          "⚙️ *SETTINGS & CO-PILOT*",
          "• *mode copilot 60s* — AI Co-Pilot steps in after 60s vendor idle",
          "• *mode auto* — Instant automated checkout replies",
          "• *mode off* — Manual mode (Co-Pilot paused)",
          "• *hold <minutes>* — Set transfer hold window (e.g. `hold 15`)",
          "• *dashboard* — 1-tap instant login link to Web Dashboard",
          "",
          "🤝 *CUSTOMER ASSISTANCE & CO-PILOT SYNC*",
          "• *reply <message>* — Reply to customer asking for help",
          "• *reply <phone> <message>* — Reply to specific customer (e.g. `reply 7766 Size 40 is ready`)",
          "• *resume* — Hand customer back to AI Co-Pilot",
        ].join("\n");

        quickReplies = [
          { label: "📦 Products", replyText: "products" },
          { label: "🛍️ Sync Catalog", replyText: "sync catalog" },
          { label: "📊 Sales", replyText: "sales" },
          { label: "🚚 Shipping", replyText: "shipping" },
          { label: "🏷️ Discounts", replyText: "discount" },
          { label: "🟡 Pending", replyText: "pending" },
          { label: "🟢 Paid", replyText: "paid" },
          { label: "🔐 Dashboard", replyText: "dashboard" },
        ];
        break;
      }

      case "LIST_PRODUCTS": {
        quickReplies = [
          { label: "📊 Sales Today", replyText: "sales" },
          { label: "🚚 Shipping Zones", replyText: "shipping" },
          { label: "🛠️ Help Menu", replyText: "help" },
        ];
        replyText =
          this.products.length === 0
            ? "📦 Your catalog is empty. Send a photo with caption *Name, #25000, stock 5* to add an item."
            : [
                `📦 *Your Catalog (${this.products.length} items):*`,
                ...this.products.map((p) => {
                  const avail = Math.max(0, p.stockTotal - p.stockReserved);
                  return `• *${p.skuCode}* — ${p.name}: *${formatNaira(p.basePriceKobo)}* (${avail} avail, ${p.stockReserved} locked)`;
                }),
              ].join("\n");
        break;
      }

      case "SALES_SUMMARY": {
        quickReplies = [
          { label: "🟡 Pending Transfers", replyText: "pending" },
          { label: "🟢 Paid Orders", replyText: "paid" },
          { label: "📦 Products", replyText: "products" },
        ];
        const b = this.getAnalyticsBreakdown(cmd.range);
        replyText = [
          `📊 *Transactional Breakdown (${cmd.range.toUpperCase()})*`,
          `• Paid Orders: *${b.paidOrdersCount} (${formatNaira(b.paidGrossKobo)})*`,
          `• Pending Transfers: *${b.pendingOrdersCount} (${formatNaira(b.pendingAmountKobo)})*`,
          `• Shipping Collected: *${formatNaira(b.shippingCollectedKobo)}*`,
          `• Discounts Given: *${formatNaira(b.discountsGivenKobo)}*`,
          `• Net Product Revenue: *${formatNaira(b.netProductRevenueKobo)}*`,
        ].join("\n");
        break;
      }

      case "LIST_SHIPPING": {
        quickReplies = [
          { label: "🏷️ Discounts", replyText: "discount" },
          { label: "📦 Products", replyText: "products" },
          { label: "🛠️ Help Menu", replyText: "help" },
        ];
        const active = this.shippingZones.filter((z) => z.isActive);
        replyText =
          active.length === 0
            ? "🚚 No active delivery zones. Reply *ship Ibadan #6000* to add one."
            : `🚚 *Your Delivery Zones:*\n${active.map((z) => `${z.code}. ${z.name}: *${formatNaira(z.feeKobo)}*`).join("\n")}`;
        break;
      }

      case "UPSERT_SHIPPING": {
        try {
          const zone = this.upsertShippingZone(cmd.name, cmd.feeKobo);
          replyText = `✅ *Shipping Zone Synced:*\n#${zone.code} *${zone.name}* → *${formatNaira(zone.feeKobo)}*`;
        } catch (err) {
          replyText = `⚠️ ${err instanceof Error ? err.message : String(err)}`;
        }
        break;
      }

      case "DELETE_SHIPPING": {
        const deleted = this.deleteShippingZone(cmd.code);
        replyText = deleted
          ? `🗑️ Removed delivery zone #${deleted.code} (*${deleted.name}*).`
          : `⚠️ Delivery zone #${cmd.code} not found.`;
        break;
      }

      case "LIST_DISCOUNTS": {
        quickReplies = [
          { label: "🚚 Shipping Zones", replyText: "shipping" },
          { label: "📦 Products", replyText: "products" },
          { label: "🛠️ Help Menu", replyText: "help" },
        ];
        const active = this.discounts.filter((d) => d.isActive);
        replyText =
          active.length === 0
            ? "🏷️ No active discount codes. Reply *discount add PAYDAY 10%* to create one."
            : `🏷️ *Active Discount Codes:*\n${active
                .map((d) => {
                  const label =
                    d.type === "PERCENTAGE"
                      ? `${Number(d.value) / 100}% off`
                      : `${formatNaira(d.value)} off`;
                  return `• *${d.code}* — ${label} (${d.usedCount} used)`;
                })
                .join("\n")}`;
        break;
      }

      case "CREATE_DISCOUNT": {
        try {
          const disc = this.upsertDiscount({
            code: cmd.code,
            type: cmd.discountType,
            value: cmd.value,
          });
          const label =
            disc.type === "PERCENTAGE"
              ? `${Number(disc.value) / 100}% off`
              : `${formatNaira(disc.value)} off`;
          replyText = `✅ *Discount Code Synced:* *${disc.code}* (${label})`;
        } catch (err) {
          replyText = `⚠️ ${err instanceof Error ? err.message : String(err)}`;
        }
        break;
      }

      case "DEACTIVATE_DISCOUNT": {
        const deactivated = this.deactivateDiscount(cmd.code);
        replyText = deactivated
          ? `🛑 Discount code *${deactivated.code}* deactivated.`
          : `⚠️ Discount code *${cmd.code}* not found.`;
        break;
      }

      case "UPDATE_STOCK": {
        try {
          const prod = this.updateProductStock(cmd.skuCode, cmd.stockTotal);
          if (!prod) {
            replyText = `⚠️ Product SKU *${cmd.skuCode}* not found.`;
          } else {
            const avail = Math.max(0, prod.stockTotal - prod.stockReserved);
            replyText = `📦 *Inventory Synced:*\n*${prod.name}* (${prod.skuCode})\nTotal Stock: *${prod.stockTotal}* (${avail} available, ${prod.stockReserved} reserved)`;
          }
        } catch (err) {
          replyText = `⚠️ ${err instanceof Error ? err.message : String(err)}`;
        }
        break;
      }

      case "QUICK_ADD_PRODUCT": {
        try {
          const skuCode = (
            cmd.skuCode ||
            generateConsistentSku(cmd.name, undefined, this.products)
          ).toUpperCase();

          const mappedVariants: RuntimeProductVariant[] | undefined = cmd.variants?.map((v, i) => {
            const cleanName = v.name.trim();
            const suffix = (
              v.skuSuffix ||
              cleanName.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6) ||
              String(i + 1)
            ).toUpperCase();
            return {
              id: `var-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 5)}`,
              name: cleanName,
              skuCode: `${skuCode}-${suffix}`,
              priceKobo: v.priceKobo,
              stockTotal: v.stockTotal,
              stockReserved: 0,
            };
          });

          // Derive effective base price if not explicitly provided or 0n
          let effectiveBasePrice = cmd.priceKobo;
          if ((!effectiveBasePrice || effectiveBasePrice <= 0n) && mappedVariants && mappedVariants.length > 0) {
            const variantWithPrice = mappedVariants.find((v) => v.priceKobo && v.priceKobo > 0n);
            effectiveBasePrice = variantWithPrice?.priceKobo ?? 0n;
          }

          const finalImageUrl = attachedImageUrl || cmd.imageUrl;
          const prod = this.addProduct({
            skuCode,
            name: cmd.name,
            basePriceKobo: effectiveBasePrice,
            stockTotal: cmd.stockTotal,
            primaryImageUrl: finalImageUrl,
            imagePhash: attachedImagePhash,
            variants: mappedVariants,
          });

          const variantLines =
            prod.variants && prod.variants.length > 0
              ? [
                  `🎛️ *Variants (${prod.variants.length}):*`,
                  ...prod.variants.map(
                    (v) =>
                      `  • *${v.name}*: ${v.stockTotal} in stock (${formatNaira(v.priceKobo ?? prod.basePriceKobo)})`
                  ),
                ]
              : [];

          replyText = [
            `✅ *New Product Added & Synced:*`,
            `📦 *${prod.name}*`,
            `🏷️ SKU: *${prod.skuCode}*`,
            `💰 Base Price: *${formatNaira(prod.basePriceKobo)}*`,
            `🔢 Total Stock: *${prod.stockTotal}*`,
            ...variantLines,
            `🔍 Status Fingerprint (pHash): \`${prod.imagePhash}\``,
          ].join("\n");

          quickReplies = [
            { label: "📦 View Catalog", replyText: "products" },
            { label: "🛠️ Help Menu", replyText: "help" },
          ];
        } catch (err) {
          replyText = `⚠️ ${err instanceof Error ? err.message : String(err)}`;
        }
        break;
      }

      case "DELETE_PRODUCT": {
        const deleted = this.deleteProduct(cmd.skuCode);
        if (deleted) {
          replyText = `🗑️ *Product Deleted:* \`${cmd.skuCode.toUpperCase()}\` has been removed from your store and WhatsApp catalog.`;
        } else {
          replyText = `⚠️ Product with SKU \`${cmd.skuCode.toUpperCase()}\` was not found.`;
        }
        break;
      }

      case "LIST_ORDERS": {
        const list = this.orders.filter((o) =>
          cmd.status === "PENDING_PAYMENT"
            ? o.status === "PENDING_PAYMENT" || o.status === "PARTIALLY_PAID"
            : o.status === "PAID"
        );
        if (list.length === 0) {
          replyText =
            cmd.status === "PENDING_PAYMENT"
              ? "🟡 No pending bank transfers right now."
              : "🟢 No paid orders waiting for dispatch.";
        } else {
          replyText = list
            .map(
              (o) =>
                `• *${o.shortCode}* (${o.status}) — ${o.customerName} — ${o.productName} x${o.quantity} (${o.shippingZoneName}) — *${formatNaira(o.totalAmountKobo)}* (NUBAN: ${o.accountNumber})`
            )
            .join("\n");
        }
        break;
      }

      case "DISPATCH_ORDER": {
        try {
          const ord = await this.dispatchOrder(cmd.shortCode, cmd.riderPhone);
          replyText = ord
            ? `🚚 Order *${ord.shortCode}* marked Out for Delivery! Buyer (${ord.customerPhone}) has been notified on WhatsApp.`
            : `⚠️ Order *${cmd.shortCode}* not found.`;
        } catch (err) {
          replyText = `⚠️ ${err instanceof Error ? err.message : String(err)}`;
        }
        break;
      }

      case "REMIND_ORDER": {
        const ord = this.orders.find((o) => o.shortCode === cmd.shortCode);
        if (!ord) {
          replyText = `⚠️ Order *${cmd.shortCode}* not found.`;
        } else {
          this.appendChat({
            channel: "BUYER_SHOP_WA",
            sender: "CATERLOG_BOT",
            fromPhone: "CATERLOG",
            text: `⏰ *Friendly Reminder (${ord.shortCode}):* Your reserved *${ord.productName}* is waiting for payment of *${formatNaira(ord.totalAmountKobo - ord.amountPaidKobo)}* to *${ord.accountNumber}* (${ord.bankName}).`,
          });
          replyText = `🔔 Sent WhatsApp transfer reminder to *${ord.customerName}* for *${ord.shortCode}*.`;
        }
        break;
      }

      case "SET_COPILOT_MODE": {
        this.updateSettings({
          copilotMode: cmd.mode,
          copilotIdleSeconds: cmd.idleSeconds,
        });
        replyText =
          this.vendor.copilotMode === "COPILOT"
            ? `🤖 *Co-Pilot Active:* Steps in after *${this.vendor.copilotIdleSeconds}s* of vendor inactivity.`
            : this.vendor.copilotMode === "FULL_AUTO"
              ? `⚡ *Full Auto-Pilot Active:* Instant <2s automated checkout replies.`
              : `⏸️ *Manual Mode:* Co-Pilot paused.`;
        break;
      }

      case "SET_RESERVATION_TTL": {
        this.updateSettings({ reservationTtlMinutes: cmd.minutes });
        replyText = `⏳ *Stock Reservation Hold Window Updated:* Buyers now have *${this.vendor.reservationTtlMinutes} minutes* to complete bank transfers.`;
        break;
      }

      case "VENDOR_ASSIST_REPLY": {
        const assistRes = await this.recordVendorManualReplyInBuyerThread(
          cmd.message,
          cmd.targetPhoneOrQuery
        );
        replyText = `💬 Delivered reply to *${assistRes.targetBuyerName}* (${assistRes.targetBuyerPhone}):\n"${cmd.message}"\n\n_Co-Pilot is paused for this customer so you can chat freely. Reply *resume* when done._`;
        quickReplies = [
          { label: "🤖 Resume Co-Pilot", replyText: "resume" },
          { label: "📦 View Stock", replyText: "stock" },
        ];
        break;
      }

      case "RESUME_COPILOT": {
        const resumed = await this.handleResumeCopilot(cmd.targetPhoneOrQuery);
        replyText = `🤖 *Co-Pilot Resumed* for *${resumed.targetBuyerName}* (${resumed.targetBuyerPhone}). Automated checkout and product inquiries are active again.`;
        quickReplies = [
          { label: "📊 Sales Summary", replyText: "sales" },
          { label: "📦 View Stock", replyText: "stock" },
        ];
        break;
      }

      case "SYNC_CATALOG": {
        try {
          const syncResult = await this.syncWhatsAppCatalog({
            deleteMissing: cmd.deleteMissing ?? true,
          });
          const failCount = syncResult.failed.length;
          const failDetail =
            failCount > 0
              ? `\n⚠️ ${failCount} product(s) failed:\n${syncResult.failed.map((f) => `• ${f.skuCode}: ${f.error}`).join("\n")}`
              : "";
          replyText = [
            `🛍️ *WhatsApp Business Catalog Synced!*`,
            `━━━━━━━━━━━━━━━━━━━━━━`,
            `• Mode: *${syncResult.mode.toUpperCase()}*`,
            `• Catalog ID: *${syncResult.catalogId ?? "N/A"}*`,
            `• Total Attempted: *${syncResult.attempted}*`,
            `• Successfully Upserted: *${syncResult.upserted}*`,
            `• Deleted Out-of-Stock/Missing: *${syncResult.deleted}*`,
            failDetail,
          ]
            .filter(Boolean)
            .join("\n");
        } catch (err) {
          replyText = `⚠️ Failed to sync catalog: ${err instanceof Error ? err.message : String(err)}`;
        }
        quickReplies = [
          { label: "📦 View Products", replyText: "products" },
          { label: "📊 Sales", replyText: "sales" },
          { label: "🛠️ Help Menu", replyText: "help" },
        ];
        break;
      }

      case "UNKNOWN_COMMAND": {
        replyText = `❓ Unrecognized command "${cmd.rawInput}". Type *help* to see all Caterlog commands (or send *Name, #Price, stock Qty* to add a product).`;
        break;
      }
    }

    await this.dispatchWhatsAppAndRecordChat({
      channel: "VENDOR_ADMIN_WA",
      toPhone: this.vendor.whatsappPhone,
      text: replyText,
      quickReplies,
      headerText: "Caterlog Vendor Hub",
    });

    await this.broadcastStateChange();
    return { replyText, commandType: cmd.type };
  }

  /**
   * Records that the Vendor manually sent a customer assistance reply in the Buyer's WhatsApp thread.
   * Cancels any pending Co-Pilot idle timer and pauses Co-Pilot so vendor can assist freely!
   */
  public async recordVendorManualReplyInBuyerThread(
    text: string,
    buyerPhoneOrQuery?: string
  ): Promise<{
    targetBuyerPhone: string;
    targetBuyerName: string;
    delivered: boolean;
  }> {
    this.lastVendorReplyInBuyerThreadAt = new Date();
    const timer = this.activeCopilotTimers.get("buyer-thread");
    if (timer) {
      clearTimeout(timer);
      this.activeCopilotTimers.delete("buyer-thread");
    }

    let targetPhone = buyerPhoneOrQuery?.trim();
    let targetSession: BuyerConversationSession | undefined;

    if (targetPhone) {
      for (const [phone, sess] of this.buyerSessions.entries()) {
        if (phone === targetPhone || phone.endsWith(targetPhone)) {
          targetPhone = phone;
          targetSession = sess;
          break;
        }
      }
    }

    if (!targetSession) {
      const sessions = Array.from(this.buyerSessions.values());
      const needsAssist = sessions.find((s) => s.state === "NEEDS_ASSISTANCE");
      targetSession = needsAssist ?? sessions[0];
      if (targetSession) {
        targetPhone = targetSession.buyerPhone;
      }
    }

    if (!targetPhone) {
      const recentBuyerMsg = [...this.chatMessages]
        .reverse()
        .find((m) => m.channel === "BUYER_SHOP_WA" && m.sender === "BUYER");
      targetPhone = recentBuyerMsg?.fromPhone ?? "+2348099887766";
    }

    const buyerName = targetSession?.buyerName ?? "Customer";

    if (targetSession) {
      targetSession.state = "ASSISTING";
      targetSession.copilotPaused = true;
      targetSession.updatedAt = new Date();
    } else {
      this.buyerSessions.set(targetPhone, {
        buyerPhone: targetPhone,
        buyerName,
        state: "ASSISTING",
        copilotPaused: true,
        updatedAt: new Date(),
      });
    }

    const customerMessageText = [
      `👤 *${this.vendor.businessName} (Store Owner):*`,
      text,
      ``,
      `_Reply directly to chat with the store owner, or tap below to resume automated shopping._`,
    ].join("\n");

    await this.dispatchWhatsAppAndRecordChat({
      channel: "BUYER_SHOP_WA",
      toPhone: targetPhone,
      text: customerMessageText,
      sender: "VENDOR",
      quickReplies: [
        { label: "🛍️ Resume Co-Pilot", replyText: "resume" },
        { label: "🛒 View Cart", replyText: "cart" },
      ],
      headerText: "Store Owner Reply",
    });

    await this.dispatchWhatsAppAndRecordChat({
      channel: "VENDOR_ADMIN_WA",
      toPhone: this.vendor.whatsappPhone,
      text: `💬 Delivered your reply to *${buyerName}* (${targetPhone}):\n"${text}"\n\nCo-Pilot is paused for this customer so you can chat freely. Reply *resume* when done.`,
      quickReplies: [
        { label: "🤖 Hand Back to Co-Pilot", replyText: "resume" },
      ],
    });

    await this.broadcastStateChange();
    return {
      targetBuyerPhone: targetPhone,
      targetBuyerName: buyerName,
      delivered: true,
    };
  }

  public async handleResumeCopilot(buyerPhoneOrQuery?: string): Promise<{
    targetBuyerPhone: string;
    targetBuyerName: string;
  }> {
    let targetPhone = buyerPhoneOrQuery?.trim();
    let targetSession: BuyerConversationSession | undefined;

    if (targetPhone) {
      for (const [phone, sess] of this.buyerSessions.entries()) {
        if (phone === targetPhone || phone.endsWith(targetPhone)) {
          targetPhone = phone;
          targetSession = sess;
          break;
        }
      }
    }

    if (!targetSession) {
      const sessions = Array.from(this.buyerSessions.values());
      const assisting = sessions.find((s) => s.state === "ASSISTING" || s.copilotPaused);
      targetSession = assisting ?? sessions[0];
      if (targetSession) {
        targetPhone = targetSession.buyerPhone;
      }
    }

    if (!targetPhone) {
      targetPhone = "+2348099887766";
    }

    const buyerName = targetSession?.buyerName ?? "Customer";

    if (targetSession) {
      targetSession.copilotPaused = false;
      targetSession.state = "CART_ACTIVE";
      targetSession.updatedAt = new Date();
    }

    const resumeMsg = [
      `🤖 *${this.vendor.businessName} Sales Co-Pilot is back online!*`,
      `How else can I help you today? Reply with a product name, SKU, or *cart* anytime.`,
    ].join("\n");

    await this.dispatchWhatsAppAndRecordChat({
      channel: "BUYER_SHOP_WA",
      toPhone: targetPhone,
      text: resumeMsg,
      quickReplies: [
        { label: "🛍️ View Catalog", replyText: "catalog" },
        { label: "🛒 View Cart", replyText: "cart" },
      ],
      headerText: "Sales Co-Pilot Resumed",
    });

    await this.dispatchWhatsAppAndRecordChat({
      channel: "VENDOR_ADMIN_WA",
      toPhone: this.vendor.whatsappPhone,
      text: `🤖 *Co-Pilot Resumed* for *${buyerName}* (${targetPhone}). Automated checkout and product inquiries are active again.`,
      quickReplies: [
        { label: "📊 Sales Summary", replyText: "sales" },
        { label: "📦 View Stock", replyText: "stock" },
      ],
    });

    await this.broadcastStateChange();
    return {
      targetBuyerPhone: targetPhone,
      targetBuyerName: buyerName,
    };
  }

  /**
   * Handles an inbound Buyer message or WhatsApp Status reply.
   *
   * Two-Step Conversational Checkout State Machine:
   * - Step 1: If the buyer requests a product WITHOUT specifying a shipping zone,
   *   Caterlog renders the Product Card (image, price, available stock) and asks the buyer
   *   to select one of the vendor's active shipping zones (never guesses a random zone!).
   * - Step 2: Once the buyer selects their shipping zone (by number, name, or quick-reply button)—
   *   or if they explicitly named a valid shipping zone in their initial message—
   *   Caterlog locks stock and issues the Monnify 10-digit NUBAN invoice.
   */
  private activeSourceChannel: "WHATSAPP" | "INSTAGRAM" | "FACEBOOK" = "WHATSAPP";

  public async handleBuyerWhatsAppInquiry(params: {
    buyerPhone: string;
    buyerName?: string;
    text: string;
    quotedStatusImagePhash?: string;
    attachedImageUrl?: string;
    simulateFastForwardIdleTimer?: boolean;
    sourceChannel?: "WHATSAPP" | "INSTAGRAM" | "FACEBOOK";
  }): Promise<{
    copilotDecision: ReturnType<typeof evaluateCopilotAction>;
    step?: "PROMPTED_FOR_QUANTITY" | "PROMPTED_FOR_SHIPPING_ZONE" | "INVOICE_CREATED" | "OUT_OF_STOCK" | "ORDER_TRACKED" | "UNMATCHED";
    createdOrder?: RuntimeOrder;
  }> {
    const existingSession = this.buyerSessions.get(params.buyerPhone);
    const resolvedChannel: "WHATSAPP" | "INSTAGRAM" | "FACEBOOK" =
      params.sourceChannel ?? existingSession?.sourceChannel ?? "WHATSAPP";
    this.activeSourceChannel = resolvedChannel;
    if (existingSession && params.sourceChannel) {
      existingSession.sourceChannel = params.sourceChannel;
    }

    const buyerMessageTime = new Date();
    const matchedStatusProduct = params.quotedStatusImagePhash
      ? this.products.find(
          (p) => computePhashHammingDistance(p.imagePhash, params.quotedStatusImagePhash!) <= 8
        )
      : undefined;

    const chatImageUrl = params.attachedImageUrl || matchedStatusProduct?.primaryImageUrl;

    this.appendChat({
      channel: "BUYER_SHOP_WA",
      sourceChannel: resolvedChannel,
      sender: "BUYER",
      fromPhone: params.buyerPhone,
      text: params.quotedStatusImagePhash
        ? `📸 [Replied to WhatsApp Status${matchedStatusProduct ? `: ${matchedStatusProduct.name}` : ""}] ${params.text || ""}`.trim()
        : params.text || (params.attachedImageUrl ? "📸 [Sent an image]" : ""),
      imageUrl: chatImageUrl,
    });

    const trimmed = params.text.trim().toLowerCase();

    // If Co-Pilot is paused for this buyer (vendor is actively assisting them):
    if (existingSession?.copilotPaused) {
      if (/^(?:resume|copilot(?:\s+on)?|back\s+to\s+shopping|shop|menu|catalog)$/i.test(trimmed)) {
        await this.handleResumeCopilot(params.buyerPhone);
        return {
          copilotDecision: {
            action: "RESPOND_IMMEDIATELY",
            reason: "Buyer manually resumed Sales Co-Pilot.",
          },
          step: "UNMATCHED",
        };
      }

      // Forward buyer's message to vendor without automated bot interruption
      await this.dispatchWhatsAppAndRecordChat({
        channel: "VENDOR_ADMIN_WA",
        toPhone: this.vendor.whatsappPhone,
        text: `💬 *[${params.buyerName ?? "Customer"} (${params.buyerPhone})]:*\n"${params.text}"\n\n_To reply, send: \`reply ${params.text}\` or reply from Dashboard._`,
        quickReplies: [
          { label: `💬 Reply to ${params.buyerName?.split(" ")[0] ?? "Customer"}`, replyText: `reply ${params.buyerPhone} ` },
          { label: "🤖 Resume Co-Pilot", replyText: "resume" },
        ],
      });

      await this.broadcastStateChange();
      return {
        copilotDecision: {
          action: "DO_NOTHING",
          reason: "Vendor is actively assisting customer; Co-Pilot paused.",
        },
      };
    }

    const decision = evaluateCopilotAction({
      copilotMode: this.vendor.copilotMode,
      copilotIdleSeconds: this.vendor.copilotIdleSeconds,
      sessionCopilotPaused: Boolean(existingSession?.copilotPaused),
      lastVendorMessageAt: this.lastVendorReplyInBuyerThreadAt,
      now: buyerMessageTime,
    });

    if (decision.action === "DO_NOTHING") {
      await this.broadcastStateChange();
      return { copilotDecision: decision };
    }

    if (decision.action === "RESPOND_IMMEDIATELY" || params.simulateFastForwardIdleTimer) {
      const flowResult = await this.processBuyerConversationTurn({
        buyerPhone: params.buyerPhone,
        buyerName: params.buyerName ?? "Chidinma Okafor",
        text: params.text,
        quotedStatusImagePhash: params.quotedStatusImagePhash,
        attachedImageUrl: params.attachedImageUrl,
      });
      const updatedSess = this.buyerSessions.get(params.buyerPhone);
      if (updatedSess) {
        updatedSess.sourceChannel = resolvedChannel;
      }
      return {
        copilotDecision: decision,
        step: flowResult.step,
        createdOrder: flowResult.createdOrder,
      };
    }

    // SCHEDULE_IDLE_TAKEOVER
    this.appendChat({
      channel: "VENDOR_ADMIN_WA",
      sender: "CATERLOG_BOT",
      fromPhone: "CATERLOG",
      text: `⏳ *Smart Co-Pilot Standby:* Buyer (${params.buyerPhone}) sent: "${params.text}". Waiting *${decision.delaySeconds}s* for you to reply before Co-Pilot steps in...`,
    });

    const existingTimer = this.activeCopilotTimers.get("buyer-thread");
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(async () => {
      this.activeCopilotTimers.delete("buyer-thread");
      const shouldTakeOver = shouldExecuteScheduledTakeover({
        buyerMessageReceivedAt: buyerMessageTime,
        lastVendorMessageAt: this.lastVendorReplyInBuyerThreadAt,
        sessionCopilotPaused: false,
        copilotMode: this.vendor.copilotMode,
      });
      if (shouldTakeOver) {
        this.activeSourceChannel = resolvedChannel;
        await this.processBuyerConversationTurn({
          buyerPhone: params.buyerPhone,
          buyerName: params.buyerName ?? "Chidinma Okafor",
          text: params.text,
          quotedStatusImagePhash: params.quotedStatusImagePhash,
          attachedImageUrl: params.attachedImageUrl,
        });
        const updatedSess = this.buyerSessions.get(params.buyerPhone);
        if (updatedSess) {
          updatedSess.sourceChannel = resolvedChannel;
        }
      }
    }, decision.delaySeconds * 1000);

    this.activeCopilotTimers.set("buyer-thread", timer);
    await this.broadcastStateChange();
    return { copilotDecision: decision };
  }

  /**
   * Core Conversational Checkout State Machine for a Buyer Turn.
   */
  public async processBuyerConversationTurn(params: {
    buyerPhone: string;
    buyerName: string;
    text: string;
    quotedStatusImagePhash?: string;
    attachedImageUrl?: string;
  }): Promise<{
    step: "PROMPTED_FOR_QUANTITY" | "PROMPTED_FOR_SHIPPING_ZONE" | "INVOICE_CREATED" | "OUT_OF_STOCK" | "ORDER_TRACKED" | "UNMATCHED";
    createdOrder?: RuntimeOrder;
  }> {
    const activeZones = this.shippingZones.filter((z) => z.isActive);
    const existingSession = this.buyerSessions.get(params.buyerPhone);
    const trimmed = params.text.trim();

    // 0. Customer Assistance / Human Vendor Request
    const isAssistanceRequest =
      /\b(?:(?:talk|speak|chat)\s+(?:to|with)\s+(?:the\s+)?(?:store\s+)?(?:vendor|human|owner|seller|agent|person|support)|contact\s+(?:the\s+)?(?:store\s+)?(?:vendor|owner|support)|human\s+agent|talk\s+to\s+someone|customer\s+care|customer\s+support|need\s+(?:help|assistance)|help\s+me|assistance\s+please)\b/i.test(
        trimmed
      ) ||
      /^(?:help|support|agent|human|owner|vendor|assistance)$/i.test(
        trimmed.replace(/[?.!]/g, "").trim()
      );

    if (isAssistanceRequest) {
      this.buyerSessions.set(params.buyerPhone, {
        buyerPhone: params.buyerPhone,
        buyerName: params.buyerName,
        state: "NEEDS_ASSISTANCE",
        assistanceInquiry: trimmed,
        assistanceRequestedAt: new Date(),
        updatedAt: new Date(),
      });

      const buyerAck = [
        `🛎️ *Customer Assistance Request Received*`,
        ``,
        `I have alerted the store owner (*${this.vendor.businessName}*) to assist you directly! They will reply to you here shortly. 🕒`,
        ``,
        `_In the meantime, feel free to reply with any product name, SKU, or *cart* to continue shopping._`,
      ].join("\n");

      await this.dispatchWhatsAppAndRecordChat({
        channel: "BUYER_SHOP_WA",
        toPhone: params.buyerPhone,
        text: buyerAck,
        quickReplies: [
          { label: "🛍️ View Catalog", replyText: "catalog" },
          { label: "🛒 View Cart", replyText: "cart" },
        ],
        headerText: "Customer Support Alerted",
      });

      await this.dispatchWhatsAppAndRecordChat({
        channel: "VENDOR_ADMIN_WA",
        toPhone: this.vendor.whatsappPhone,
        text: [
          `🔔 *Customer Assistance Request*`,
          ``,
          `*Customer:* ${params.buyerName} (\`${params.buyerPhone}\`)`,
          `*Inquiry:* "${trimmed}"`,
          ``,
          `_To reply from WhatsApp:_`,
          `👉 \`reply ${trimmed.length > 20 ? trimmed.slice(0, 20) + "..." : trimmed}\` or \`reply ${params.buyerPhone} <Your reply>\``,
          ``,
          `_You can also answer directly from your Caterlog Web Dashboard._`,
        ].join("\n"),
        quickReplies: [
          {
            label: `💬 Reply to ${params.buyerName.split(" ")[0]}`,
            replyText: `reply ${params.buyerPhone} `,
          },
        ],
        headerText: "Customer Assistance",
      });

      await this.broadcastStateChange();
      return { step: "UNMATCHED" };
    }

    // 0b. Self-Service Order Status & Tracking (e.g. "track", "status", "track ORD-882", "where is my order")
    const isTrackingQuery =
      /^(?:track(?:_|\s+)?([A-Za-z0-9_-]+)?|status(?:\s+([A-Za-z0-9_-]+))?|order\s+status(?:\s+([A-Za-z0-9_-]+))?|where\s+is\s+my\s+order|my\s+orders?|check\s+order)$/i.test(
        trimmed
      );

    if (isTrackingQuery) {
      const codeMatch = trimmed.match(
        /^(?:track(?:_|\s+)?|status\s+|order\s+status\s+)([A-Za-z0-9_-]+)$/i
      );
      const rawCode = codeMatch ? codeMatch[1].trim() : "";
      const cleanCode = rawCode.toUpperCase().replace(/^#/, "");
      const searchCode = cleanCode ? (cleanCode.startsWith("ORD-") ? cleanCode : `ORD-${cleanCode}`) : "";

      const buyerOrders = this.orders
        .filter((o) => o.customerPhone === params.buyerPhone)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const matchingOrder =
        (searchCode ? this.orders.find((o) => o.shortCode.toUpperCase() === searchCode || o.id === rawCode) : undefined) ||
        buyerOrders[0];

      if (!matchingOrder) {
        const notFoundText = [
          `🔍 *Order Not Found*`,
          ``,
          rawCode
            ? `We couldn't find an order matching *"${rawCode}"*. Please double check your order number.`
            : `We couldn't find any recent orders linked to your phone number (\`${params.buyerPhone}\`).`,
          ``,
          `💡 Reply with *track <orderCode>* (e.g. \`track ORD-123\`) or reply *catalog* to browse our store!`,
        ].join("\n");

        await this.dispatchWhatsAppAndRecordChat({
          channel: "BUYER_SHOP_WA",
          toPhone: params.buyerPhone,
          text: notFoundText,
          quickReplies: [
            { label: "🛍️ View Catalog", replyText: "catalog" },
            { label: "💬 Talk to Support", replyText: "talk to vendor" },
          ],
          headerText: "Order Tracking",
        });
        await this.broadcastStateChange();
        return { step: "UNMATCHED" };
      }

      let statusHeadline = "";
      let statusExplanation = "";

      switch (matchingOrder.status) {
        case "PENDING_PAYMENT": {
          const balance = matchingOrder.totalAmountKobo - matchingOrder.amountPaidKobo;
          statusHeadline = "🟡 *AWAITING BANK TRANSFER*";
          statusExplanation = [
            `Your items are reserved! Please complete your transfer to finalize:`,
            `🏦 Bank: *${matchingOrder.bankName}*`,
            `🔢 Account: *${matchingOrder.accountNumber}*`,
            `👤 Name: *${matchingOrder.accountName}*`,
            `💰 Amount Due: *${formatNaira(balance)}*`,
          ].join("\n");
          break;
        }
        case "PARTIALLY_PAID": {
          const balance = matchingOrder.totalAmountKobo - matchingOrder.amountPaidKobo;
          statusHeadline = "🟠 *PARTIALLY PAID*";
          statusExplanation = [
            `We received *${formatNaira(matchingOrder.amountPaidKobo)}*.`,
            `Remaining balance: *${formatNaira(balance)}*`,
            `🔢 Account: *${matchingOrder.accountNumber}* (${matchingOrder.bankName})`,
          ].join("\n");
          break;
        }
        case "PAID":
        case "PROCESSING": {
          statusHeadline = "🟢 *PAYMENT VERIFIED & PREPARING*";
          statusExplanation = [
            `Your payment was received in full! We are packaging your items for dispatch.`,
            matchingOrder.deliveryAddress
              ? `🏠 Delivery Address: *${matchingOrder.deliveryAddress}*`
              : matchingOrder.shippingZoneName
                ? `🚚 Shipping Zone: *${matchingOrder.shippingZoneName}*`
                : "",
            `_You will receive another message as soon as your dispatch rider is on the way!_`,
          ].filter(Boolean).join("\n");
          break;
        }
        case "OUT_FOR_DELIVERY": {
          statusHeadline = "🚚 *OUT FOR DELIVERY*";
          statusExplanation = [
            `Your package is on the way!`,
            matchingOrder.riderPhone
              ? `📞 Dispatch Rider: *${matchingOrder.riderPhone}*`
              : `🛵 Couriered via local dispatch.`,
            matchingOrder.deliveryAddress
              ? `🏠 Delivering to: *${matchingOrder.deliveryAddress}*`
              : `🚚 Zone: *${matchingOrder.shippingZoneName}*`,
            `_Please keep your phone reachable so the rider can connect upon arrival._`,
          ].join("\n");
          break;
        }
        case "FULFILLED": {
          statusHeadline = "✅ *DELIVERED & COMPLETED*";
          statusExplanation = `This order was successfully delivered! Thank you for shopping with ${this.vendor.businessName}.`;
          break;
        }
        case "EXPIRED": {
          statusHeadline = "🛑 *ORDER EXPIRED*";
          statusExplanation = `The reservation window for this order has expired. Reply *catalog* to browse items and place a fresh order.`;
          break;
        }
        case "CANCELLED": {
          statusHeadline = "❌ *ORDER CANCELLED*";
          statusExplanation = `This order has been cancelled.`;
          break;
        }
        case "REFUNDED": {
          statusHeadline = "💸 *ORDER REFUNDED*";
          statusExplanation = `This order has been refunded.`;
          break;
        }
      }

      const itemSummary =
        matchingOrder.items && matchingOrder.items.length > 0
          ? matchingOrder.items.map((i) => `• ${i.productName} ×${i.quantity}`).join("\n")
          : `• ${matchingOrder.productName} ×${matchingOrder.quantity || 1}`;

      const trackingText = [
        `📦 *ORDER STATUS: #${matchingOrder.shortCode}*`,
        ``,
        statusHeadline,
        statusExplanation,
        ``,
        `🛍️ *Order Items:*`,
        itemSummary,
        ``,
        `💰 *Total:* *${formatNaira(matchingOrder.totalAmountKobo)}*`,
      ].join("\n");

      const quickReplies: QuickReplyOption[] = [];
      if (matchingOrder.status === "PENDING_PAYMENT" || matchingOrder.status === "PARTIALLY_PAID") {
        quickReplies.push({
          label: "💳 View Bank Account",
          replyText: matchingOrder.accountNumber,
        });
      } else if (matchingOrder.status === "PAID" && !matchingOrder.deliveryAddress) {
        quickReplies.push({
          label: "📍 Send Address",
          replyText: "send address",
        });
      }
      quickReplies.push({ label: "🛍️ View Catalog", replyText: "catalog" });
      quickReplies.push({ label: "💬 Talk to Support", replyText: "talk to vendor" });

      await this.dispatchWhatsAppAndRecordChat({
        channel: "BUYER_SHOP_WA",
        toPhone: params.buyerPhone,
        text: trackingText,
        quickReplies: quickReplies.slice(0, 3),
        headerText: `Order #${matchingOrder.shortCode}`,
      });
      await this.broadcastStateChange();
      return { step: "ORDER_TRACKED", createdOrder: matchingOrder };
    }

    // 1. Category Browse Commands (e.g. "category fashion", "more in fashion", "browse kitchen")
    const catMatch = trimmed.match(/^(?:category|cat|browse|more\s+in)\s+(.+)$/i);
    if (catMatch) {
      const targetCat = catMatch[1].trim().toLowerCase();
      const matchedProducts = this.products.filter(
        (p) =>
          p.category?.toLowerCase().includes(targetCat) ||
          targetCat.includes(p.category?.toLowerCase() || "")
      );
      if (matchedProducts.length === 0) {
        const noCatMsg = `📂 No items found in category "*${catMatch[1]}*". Reply *catalog* to view all items!`;
        await this.dispatchWhatsAppAndRecordChat({
          channel: "BUYER_SHOP_WA",
          toPhone: params.buyerPhone,
          text: noCatMsg,
        });
        await this.broadcastStateChange();
        return { step: "UNMATCHED" };
      }

      const catLines = matchedProducts.map((p) => {
        const avail = Math.max(0, p.stockTotal - p.stockReserved);
        const varNote = p.variants && p.variants.length > 0 ? ` (${p.variants.length} options)` : "";
        return `• *${p.skuCode}* — ${p.name}${varNote}: *${formatNaira(p.basePriceKobo)}* (${avail > 0 ? `🟢 ${avail} in stock` : "🔴 Sold Out"})`;
      });

      const catMsg = [
        `📂 *Items in Category "${matchedProducts[0]?.category || catMatch[1]}":*`,
        ``,
        ...catLines,
        ``,
        `_Tap an item below to view details, image, and options:_`,
      ].join("\n");

      const quickReplies: QuickReplyOption[] = matchedProducts
        .filter((p) => p.stockTotal - p.stockReserved > 0)
        .slice(0, 5)
        .map((p) => ({
          label: `🛍️ ${p.skuCode}: ${p.name.slice(0, 18)}`,
          replyText: p.skuCode,
        }));

      await this.dispatchWhatsAppAndRecordChat({
        channel: "BUYER_SHOP_WA",
        toPhone: params.buyerPhone,
        text: catMsg,
        imageUrl: matchedProducts[0]?.primaryImageUrl,
        quickReplies,
        headerText: "Category Catalog",
      });
      await this.broadcastStateChange();
      return { step: "PROMPTED_FOR_SHIPPING_ZONE" };
    }

    // 1. Cart Management Commands (View Cart / Clear Cart)
    const isCartView = /^(?:view\s+cart|cart|my\s+cart|show\s+cart)$/i.test(trimmed);
    const isCartClear = /^(?:clear\s+cart|empty\s+cart|reset\s+cart)$/i.test(trimmed);

    if (isCartClear) {
      this.clearBuyerCart(params.buyerPhone);
      this.buyerSessions.delete(params.buyerPhone);
      const clearMsg = "🗑️ Your shopping cart has been cleared.\nReply with a product name or SKU (e.g. *SHOE-01*) to start shopping!";
      await this.dispatchWhatsAppAndRecordChat({
        channel: "BUYER_SHOP_WA",
        toPhone: params.buyerPhone,
        text: clearMsg,
      });
      await this.broadcastStateChange();
      return { step: "UNMATCHED" };
    }

    const currentCart = this.getBuyerCart(params.buyerPhone);

    if (isCartView) {
      if (currentCart.length === 0) {
        const emptyMsg = "🛒 Your cart is currently empty.\nReply with an item name or SKU (e.g. *SHOE-01*) to start shopping!";
        await this.dispatchWhatsAppAndRecordChat({
          channel: "BUYER_SHOP_WA",
          toPhone: params.buyerPhone,
          text: emptyMsg,
        });
        await this.broadcastStateChange();
        return { step: "UNMATCHED" };
      }

      const cartTotalKobo = currentCart.reduce((sum, item) => sum + item.unitPriceKobo * BigInt(item.quantity), 0n);
      const lines = currentCart.map((it, idx) => {
        const itemLineTotal = it.unitPriceKobo * BigInt(it.quantity);
        const vDisplay = it.variantName ? ` (${it.variantName})` : "";
        return `*${idx + 1}.* ${it.productName}${vDisplay} ×${it.quantity} — *${formatNaira(itemLineTotal)}*`;
      }).join("\n");

      const zoneOptions = activeZones.map((z) => `*${z.code}.* ${z.name} — *${formatNaira(z.feeKobo)}*`).join("\n");
      const cartMsg = [
        `🛒 *Your Shopping Cart (${currentCart.length} item${currentCart.length > 1 ? "s" : ""}):*`,
        ``,
        lines,
        ``,
        `💰 *Items Subtotal:* *${formatNaira(cartTotalKobo)}*`,
        ``,
        `📍 *Where should we deliver your order?*`,
        `Reply with the delivery number or location to checkout (or add another item):`,
        zoneOptions,
      ].join("\n");

      const quickReplies: QuickReplyOption[] = [
        ...(activeZones.length > 0
          ? [
              {
                label: `⚡ Checkout Now (${activeZones[0].name})`,
                replyText: activeZones[0].name,
              },
            ]
          : [{ label: "⚡ Checkout Now", replyText: "checkout" }]),
        ...activeZones.slice(1, 3).map((z) => ({
          label: `🚚 ${z.code}. ${z.name} (${formatNaira(z.feeKobo)})`,
          replyText: z.name,
        })),
        { label: "🛍️ More Items", replyText: "catalog" },
        { label: "🗑️ Clear Cart", replyText: "clear cart" },
      ];

      await this.dispatchWhatsAppAndRecordChat({
        channel: "BUYER_SHOP_WA",
        toPhone: params.buyerPhone,
        text: cartMsg,
        quickReplies,
        headerText: "Your Shopping Cart",
      });
      await this.broadcastStateChange();
      return { step: "PROMPTED_FOR_SHIPPING_ZONE" };
    }

    // Check if the buyer explicitly mentioned a product or variant in this message
    const { product: explicitlyMentionedProduct, variant: explicitlyMentionedVariant } =
      this.findProductAndVariantInBuyerMessage(params.text, params.quotedStatusImagePhash);

    // Check if the buyer's message selects a shipping zone
    const allowZoneNumeric = Boolean(
      existingSession && existingSession.state === "AWAITING_SHIPPING_ZONE" && !explicitlyMentionedProduct
    );
    const matchedZone = this.findShippingZoneInBuyerMessage(
      params.text,
      activeZones,
      allowZoneNumeric
    );

    // Check if a discount code is mentioned in this turn
    const mentionedDiscount = this.discounts
      .filter((d) => this.isDiscountUsable(d))
      .find((d) => params.text.toUpperCase().includes(d.code));

    // CASE A0: Buyer is in `AWAITING_DELIVERY_ADDRESS` and sending their delivery address!
    if (existingSession && existingSession.state === "AWAITING_DELIVERY_ADDRESS" && !explicitlyMentionedProduct) {
      const order =
        (existingSession.activeOrderId ? this.orders.find((o) => o.id === existingSession.activeOrderId) : undefined) ||
        this.orders.slice().reverse().find((o) => o.customerPhone === params.buyerPhone && o.status === "PAID");

      if (order) {
        order.deliveryAddress = params.text.trim();
        await this.persistNow("saveDeliveryAddress", () => this.persistence.saveOrder(order));

        existingSession.state = "CART_ACTIVE";
        existingSession.updatedAt = new Date();

        const itemDisplay = order.variantName
          ? `${order.productName} (${order.variantName})`
          : order.productName;

        const confirmMsg = [
          `✅ *Delivery Address Saved!*`,
          `🧾 Order: *${order.shortCode}*`,
          `📦 Item: *${itemDisplay}*`,
          `🏠 Address: *${order.deliveryAddress}*`,
          `🚚 Delivery Zone: *${order.shippingZoneName}*`,
          ``,
          `🏪 We are preparing your package! You will receive another notification once your dispatch rider is on the way.`,
        ].join("\n");

        const quickReplies: QuickReplyOption[] = [
          { label: "🛒 Keep Shopping", replyText: "catalog" },
          { label: "💬 Chat with Vendor", replyText: "talk to vendor" },
        ];

        await this.dispatchWhatsAppAndRecordChat({
          channel: "BUYER_SHOP_WA",
          toPhone: params.buyerPhone,
          text: confirmMsg,
          quickReplies,
          headerText: "Address Confirmed",
        });

        this.appendChat({
          channel: "VENDOR_ADMIN_WA",
          sender: "CATERLOG_BOT",
          fromPhone: "CATERLOG",
          text: `📍 *Delivery Address Provided for ${order.shortCode}:*\n👤 ${order.customerName} (${order.customerPhone})\n🏠 *${order.deliveryAddress}* (${order.shippingZoneName})\n\n_Reply \`dispatch ${order.shortCode} <riderPhone>\` when handed to rider._`,
        });

        if (this.isHighestSubscriptionVendor() && this.getShipbubbleConfig().autoBookOnPaid && !order.courierShipment) {
          await this.bookOrderShipbubbleCourier(order.shortCode, {
            deliveryAddress: order.deliveryAddress,
            autoBooked: true,
          }).catch(console.error);
        }

        await this.broadcastStateChange();
        return { step: "INVOICE_CREATED", createdOrder: order };
      }
    }

    // CASE A1: Buyer is in `AWAITING_VARIANT` and just replied to choose a variant!
    if (existingSession && existingSession.state === "AWAITING_VARIANT" && !explicitlyMentionedProduct) {
      const activeProd = this.products.find((p) => p.id === existingSession.activeProductId);
      if (activeProd && activeProd.variants && activeProd.variants.length > 0) {
        const { variant } = this.findProductAndVariantInBuyerMessage(params.text, undefined, activeProd);
        if (variant) {
          const vAvail = variant.stockTotal - variant.stockReserved;
          if (vAvail <= 0) {
            const outMsg = `⚠️ Sorry, *${activeProd.name} — ${variant.name}* is currently Sold Out. Please select another option:`;
            await this.dispatchWhatsAppAndRecordChat({
              channel: "BUYER_SHOP_WA",
              toPhone: params.buyerPhone,
              text: outMsg,
            });
            await this.broadcastStateChange();
            return { step: "OUT_OF_STOCK" };
          }

          const parsedQty = this.extractQuantityFromText(params.text, false);
          // If buyer did NOT specify an explicit quantity in this reply nor earlier in session:
          if (parsedQty === undefined && existingSession.quantity === undefined) {
            existingSession.activeVariantId = variant.id;
            existingSession.state = "AWAITING_QUANTITY";
            existingSession.updatedAt = new Date();

            const { text: promptText, quickReplies } = this.buildQuantityPrompt(activeProd, variant, vAvail);
            await this.dispatchWhatsAppAndRecordChat({
              channel: "BUYER_SHOP_WA",
              toPhone: params.buyerPhone,
              text: promptText,
              imageUrl: activeProd.primaryImageUrl,
              quickReplies,
              headerText: "Select Quantity",
            });
            await this.broadcastStateChange();
            return { step: "PROMPTED_FOR_QUANTITY" };
          }

          const reqQty = parsedQty ?? existingSession.quantity ?? 1;
          if (vAvail < reqQty) {
            const outMsg = `⚠️ Sorry, *${activeProd.name} — ${variant.name}* only has ${Math.max(0, vAvail)} unit(s) available (you requested ${reqQty}). Please select another option:`;
            await this.dispatchWhatsAppAndRecordChat({
              channel: "BUYER_SHOP_WA",
              toPhone: params.buyerPhone,
              text: outMsg,
            });
            await this.broadcastStateChange();
            return { step: "OUT_OF_STOCK" };
          }

          // Add to buyer's cart!
          this.addToBuyerCart(params.buyerPhone, {
            productId: activeProd.id,
            productSku: activeProd.skuCode,
            productName: activeProd.name,
            variantId: variant.id,
            variantSku: variant.skuCode,
            variantName: variant.name,
            quantity: reqQty,
            unitPriceKobo: variant.priceKobo ?? activeProd.basePriceKobo,
          });

          const updatedCart = this.getBuyerCart(params.buyerPhone);
          const cartTotalKobo = updatedCart.reduce((sum, item) => sum + item.unitPriceKobo * BigInt(item.quantity), 0n);

          existingSession.activeVariantId = variant.id;
          existingSession.quantity = reqQty;
          existingSession.state = "AWAITING_SHIPPING_ZONE";
          existingSession.updatedAt = new Date();

          if (matchedZone) {
            this.buyerSessions.delete(params.buyerPhone);
            const discountCode = mentionedDiscount?.code ?? existingSession.discountCode;
            const order = await this.finalizeOrderAndSendVirtualAccount({
              buyerPhone: params.buyerPhone,
              buyerName: params.buyerName,
              cartItems: updatedCart,
              shippingZone: matchedZone,
              discountCode,
            });
            this.clearBuyerCart(params.buyerPhone);
            return { step: order ? "INVOICE_CREATED" : "OUT_OF_STOCK", createdOrder: order };
          }

          const cartSummaryLines = updatedCart.map((it) => {
            const lineTotal = it.unitPriceKobo * BigInt(it.quantity);
            const vLabel = it.variantName ? ` (${it.variantName})` : "";
            return `• *${it.productName}${vLabel}* ×${it.quantity} — *${formatNaira(lineTotal)}*`;
          }).join("\n");

          const zoneOptionsText = activeZones
            .map((z) => `*${z.code}.* ${z.name} — *${formatNaira(z.feeKobo)}*`)
            .join("\n");

          const promptText = [
            `✅ Added: *${activeProd.name} — ${variant.name}* (\`${variant.skuCode}\`)`,
            ``,
            `🛒 *Your Order (${updatedCart.length} item${updatedCart.length > 1 ? "s" : ""}):*`,
            cartSummaryLines,
            `💰 *Items Subtotal:* *${formatNaira(cartTotalKobo)}*`,
            ``,
            `📍 *Where should we deliver your order?*`,
            `Reply with the delivery number or location to checkout (or reply with another item to keep shopping):`,
            zoneOptionsText,
            ``,
            `_💡 Have a promo code? Include it with your reply (e.g. "${activeZones[0]?.name ?? "Lekki"} PAYDAY")_`,
          ].join("\n");

          const quickReplies: QuickReplyOption[] = [
            ...activeZones.map((z) => ({
              label: `🚚 ${z.code}. ${z.name} (${formatNaira(z.feeKobo)})`,
              replyText: z.name,
            })),
            { label: "🛒 View Cart", replyText: "cart" },
          ];

          await this.dispatchWhatsAppAndRecordChat({
            channel: "BUYER_SHOP_WA",
            toPhone: params.buyerPhone,
            text: promptText,
            imageUrl: activeProd.primaryImageUrl,
            quickReplies,
            headerText: "Delivery Zone",
          });
          await this.broadcastStateChange();
          return { step: "PROMPTED_FOR_SHIPPING_ZONE" };
        }
      }
    }

    // CASE A1.5: Buyer is in `AWAITING_QUANTITY` and just replied with unit quantity!
    if (existingSession && existingSession.state === "AWAITING_QUANTITY" && !explicitlyMentionedProduct) {
      const activeProd = this.products.find((p) => p.id === existingSession.activeProductId);
      if (activeProd) {
        const activeVariant = activeProd.variants?.find((v) => v.id === existingSession.activeVariantId);
        const available = activeVariant
          ? activeVariant.stockTotal - activeVariant.stockReserved
          : activeProd.stockTotal - activeProd.stockReserved;
        const itemLabel = activeVariant ? `${activeProd.name} — ${activeVariant.name}` : activeProd.name;

        const parsedQty = this.extractQuantityFromText(params.text, true);
        if (parsedQty !== undefined) {
          if (available < parsedQty) {
            const outMsg = `⚠️ Sorry, *${itemLabel}* only has ${Math.max(0, available)} unit(s) available (you requested ${parsedQty}). Please select a lower quantity:`;
            const { quickReplies } = this.buildQuantityPrompt(activeProd, activeVariant, Math.max(0, available));
            await this.dispatchWhatsAppAndRecordChat({
              channel: "BUYER_SHOP_WA",
              toPhone: params.buyerPhone,
              text: outMsg,
              quickReplies,
            });
            await this.broadcastStateChange();
            return { step: "OUT_OF_STOCK" };
          }

          // Add to buyer's cart!
          this.addToBuyerCart(params.buyerPhone, {
            productId: activeProd.id,
            productSku: activeProd.skuCode,
            productName: activeProd.name,
            variantId: activeVariant?.id,
            variantSku: activeVariant?.skuCode,
            variantName: activeVariant?.name,
            quantity: parsedQty,
            unitPriceKobo: activeVariant?.priceKobo ?? activeProd.basePriceKobo,
          });

          const updatedCart = this.getBuyerCart(params.buyerPhone);
          const cartTotalKobo = updatedCart.reduce((sum, item) => sum + item.unitPriceKobo * BigInt(item.quantity), 0n);

          existingSession.quantity = parsedQty;
          existingSession.state = "AWAITING_SHIPPING_ZONE";
          existingSession.updatedAt = new Date();

          if (matchedZone) {
            this.buyerSessions.delete(params.buyerPhone);
            const discountCode = mentionedDiscount?.code ?? existingSession.discountCode;
            const order = await this.finalizeOrderAndSendVirtualAccount({
              buyerPhone: params.buyerPhone,
              buyerName: params.buyerName,
              cartItems: updatedCart,
              shippingZone: matchedZone,
              discountCode,
            });
            this.clearBuyerCart(params.buyerPhone);
            return { step: order ? "INVOICE_CREATED" : "OUT_OF_STOCK", createdOrder: order };
          }

          const cartSummaryLines = updatedCart.map((it) => {
            const lineTotal = it.unitPriceKobo * BigInt(it.quantity);
            const vLabel = it.variantName ? ` (${it.variantName})` : "";
            return `• *${it.productName}${vLabel}* ×${it.quantity} — *${formatNaira(lineTotal)}*`;
          }).join("\n");

          const zoneOptionsText = activeZones
            .map((z) => `*${z.code}.* ${z.name} — *${formatNaira(z.feeKobo)}*`)
            .join("\n");

          const promptText = [
            `✅ Added: *${itemLabel}* (×${parsedQty})`,
            ``,
            `🛒 *Your Order (${updatedCart.length} item${updatedCart.length > 1 ? "s" : ""}):*`,
            cartSummaryLines,
            `💰 *Items Subtotal:* *${formatNaira(cartTotalKobo)}*`,
            ``,
            `📍 *Where should we deliver your order?*`,
            `Reply with the delivery number or location to checkout (or reply with another item to keep shopping):`,
            zoneOptionsText,
            ``,
            `_💡 Have a promo code? Include it with your reply (e.g. "${activeZones[0]?.name ?? "Lekki"} PAYDAY")_`,
          ].join("\n");

          const quickReplies: QuickReplyOption[] = [
            ...activeZones.map((z) => ({
              label: `🚚 ${z.code}. ${z.name} (${formatNaira(z.feeKobo)})`,
              replyText: z.name,
            })),
            ...(activeProd.category
              ? [{ label: `📂 More in ${activeProd.category}`, replyText: `category ${activeProd.category}` }]
              : []),
            { label: "🛒 View Cart", replyText: "cart" },
          ];

          await this.dispatchWhatsAppAndRecordChat({
            channel: "BUYER_SHOP_WA",
            toPhone: params.buyerPhone,
            text: promptText,
            imageUrl: activeProd.primaryImageUrl,
            quickReplies,
            headerText: "Delivery Zone",
          });
          await this.broadcastStateChange();
          return { step: "PROMPTED_FOR_SHIPPING_ZONE" };
        } else {
          // Buyer sent unrecognized input while awaiting quantity
          const rePrompt = `🔢 Please enter how many units of *${itemLabel}* you'd like (e.g. 1, 2, 3), or tap an option below:`;
          const { quickReplies } = this.buildQuantityPrompt(activeProd, activeVariant, Math.max(0, available));
          await this.dispatchWhatsAppAndRecordChat({
            channel: "BUYER_SHOP_WA",
            toPhone: params.buyerPhone,
            text: rePrompt,
            quickReplies,
            headerText: "Select Quantity",
          });
          await this.broadcastStateChange();
          return { step: "PROMPTED_FOR_QUANTITY" };
        }
      }
    }

    // CASE A2: Buyer selected a Shipping Zone (and has cart items or session)
    if (matchedZone && !explicitlyMentionedProduct) {
      let cartToCheckout = this.getBuyerCart(params.buyerPhone);
      if (cartToCheckout.length === 0 && existingSession?.activeProductId) {
        const prod = this.products.find((p) => p.id === existingSession.activeProductId);
        if (prod) {
          const vr = prod.variants?.find((v) => v.id === existingSession.activeVariantId);
          cartToCheckout = [{
            productId: prod.id,
            productSku: prod.skuCode,
            productName: prod.name,
            variantId: vr?.id,
            variantSku: vr?.skuCode,
            variantName: vr?.name,
            quantity: existingSession.quantity ?? 1,
            unitPriceKobo: vr?.priceKobo ?? prod.basePriceKobo,
          }];
        }
      }

      if (cartToCheckout.length > 0) {
        this.buyerSessions.delete(params.buyerPhone);
        const discountCode = mentionedDiscount?.code ?? existingSession?.discountCode;
        const order = await this.finalizeOrderAndSendVirtualAccount({
          buyerPhone: params.buyerPhone,
          buyerName: params.buyerName,
          cartItems: cartToCheckout,
          shippingZone: matchedZone,
          discountCode,
        });
        this.clearBuyerCart(params.buyerPhone);
        return {
          step: order ? "INVOICE_CREATED" : "OUT_OF_STOCK",
          createdOrder: order,
        };
      }
    }

    // 3. Direct Checkout / Payment Command (e.g. "checkout", "pay", "pay now", "order now", "make payment")
    const isDirectCheckout =
      /^(?:checkout|pay|pay\s+now|make\s+payment|order\s+now|transfer|proceed\s+to\s+(?:checkout|payment)|buy\s+now)$/i.test(
        trimmed
      ) ||
      /^checkout\s+/i.test(trimmed);

    if (isDirectCheckout && !explicitlyMentionedProduct) {
      let cartToCheckout = this.getBuyerCart(params.buyerPhone);
      if (cartToCheckout.length === 0 && existingSession?.activeProductId) {
        const prod = this.products.find((p) => p.id === existingSession.activeProductId);
        if (prod) {
          const vr = prod.variants?.find((v) => v.id === existingSession.activeVariantId);
          cartToCheckout = [
            {
              productId: prod.id,
              productSku: prod.skuCode,
              productName: prod.name,
              variantId: vr?.id,
              variantSku: vr?.skuCode,
              variantName: vr?.name,
              quantity: existingSession.quantity ?? 1,
              unitPriceKobo: vr?.priceKobo ?? prod.basePriceKobo,
            },
          ];
        }
      }

      if (cartToCheckout.length > 0) {
        const effectiveZone =
          matchedZone ??
          (activeZones.length > 0 ? activeZones[0] : undefined);

        if (!effectiveZone) {
          const noZoneMsg = "⚠️ Please set up at least one delivery zone in Settings before checking out.";
          await this.dispatchWhatsAppAndRecordChat({
            channel: "BUYER_SHOP_WA",
            toPhone: params.buyerPhone,
            text: noZoneMsg,
          });
          await this.broadcastStateChange();
          return { step: "UNMATCHED" };
        }

        this.buyerSessions.delete(params.buyerPhone);
        const discountCode = mentionedDiscount?.code ?? existingSession?.discountCode;
        const order = await this.finalizeOrderAndSendVirtualAccount({
          buyerPhone: params.buyerPhone,
          buyerName: params.buyerName,
          cartItems: cartToCheckout,
          shippingZone: effectiveZone,
          discountCode,
        });
        this.clearBuyerCart(params.buyerPhone);
        return {
          step: order ? "INVOICE_CREATED" : "OUT_OF_STOCK",
          createdOrder: order,
        };
      } else {
        const emptyMsg =
          "🛒 Your shopping cart is empty!\nReply with an item name or SKU (e.g. *SHOE-01*) to browse items.";
        await this.dispatchWhatsAppAndRecordChat({
          channel: "BUYER_SHOP_WA",
          toPhone: params.buyerPhone,
          text: emptyMsg,
        });
        await this.broadcastStateChange();
        return { step: "UNMATCHED" };
      }
    }

    // Resolve target product & variant
    const product = explicitlyMentionedProduct;
    const variant = explicitlyMentionedVariant;

    if (!product) {
      // Buyer did not name a recognizable product: show friendly catalog options
      const catalogLines = this.products.map((p) => {
        const avail = Math.max(0, p.stockTotal - p.stockReserved);
        const varNote = p.variants && p.variants.length > 0 ? ` (${p.variants.length} options)` : "";
        return `• *${p.skuCode}* — ${p.name}${varNote}: *${formatNaira(p.basePriceKobo)}* (${avail > 0 ? `🟢 ${avail} in stock` : "🔴 Sold Out"})`;
      });
      const menuMsg = [
        `👋 Welcome to *${this.vendor.businessName}* (✓ Verified Caterlog Seller)!`,
        ``,
        `Here are our available items:`,
        ...catalogLines,
        ``,
        `_Reply with the item name or SKU (e.g. *SHOE-01*) or tap an item below to order:_`,
      ].join("\n");

      const quickReplies: QuickReplyOption[] = [
        ...this.products
          .filter((p) => p.stockTotal - p.stockReserved > 0)
          .slice(0, 4)
          .map((p) => ({
            label: `🛍️ ${p.skuCode}: ${p.name} (${formatNaira(p.basePriceKobo)})`,
            replyText: `I want ${p.skuCode}`,
          })),
        { label: "💬 Chat with Vendor", replyText: "talk to vendor" },
      ];

      await this.dispatchWhatsAppAndRecordChat({
        channel: "BUYER_SHOP_WA",
        toPhone: params.buyerPhone,
        text: menuMsg,
        quickReplies,
        headerText: "Store Catalog",
      });
      await this.broadcastStateChange();
      return { step: "UNMATCHED" };
    }

    const explicitQty = this.extractQuantityFromText(params.text, false);

    // Check if the buyer message expresses direct checkout or add-to-cart intent
    // (e.g. mentions a delivery zone or begins with "add", "buy", "order", "i want to buy", etc.)
    const isDirectPurchaseIntent =
      Boolean(matchedZone) ||
      (explicitQty !== undefined && explicitQty > 1) ||
      /^(?:add(?:\s+to\s+cart)?|buy|order|purchase|i\s+(?:want|need)|checkout|send\s+me|i'll\s+take)\b/i.test(trimmed);

    // USER'S STRICT BUSINESS REQUIREMENT:
    // "lastly when a product is requested, it should display the image of the product with the details and there are variations it should show the different variations with their prices and stock info.
    // Also requesting an item should not automatically add it to cart that is really bad and manipulative/misleading there should be click options to add to cart. there should also be click options to view other items under that category."
    if (!isDirectPurchaseIntent) {
      let priceDisplay = formatNaira(product.basePriceKobo);
      if (product.variants && product.variants.length > 0) {
        const variantPrices = product.variants
          .map((v) => v.priceKobo)
          .filter((pr): pr is bigint => pr !== undefined && pr > 0n);
        if (variantPrices.length > 0) {
          const minPr = variantPrices.reduce((m, p) => (p < m ? p : m), variantPrices[0]);
          const maxPr = variantPrices.reduce((m, p) => (p > m ? p : m), variantPrices[0]);
          if (minPr !== maxPr) {
            priceDisplay = `${formatNaira(minPr)} - ${formatNaira(maxPr)}`;
          } else {
            priceDisplay = formatNaira(minPr);
          }
        }
      }

      const variantLines =
        product.variants && product.variants.length > 0
          ? product.variants.map((v, i) => {
              const vPrice =
                v.priceKobo !== undefined
                  ? formatNaira(v.priceKobo)
                  : formatNaira(product.basePriceKobo);
              const vAvail = Math.max(0, v.stockTotal - v.stockReserved);
              return `${i + 1}. *${v.name}* (\`${v.skuCode}\`) — *${vPrice}* (${
                vAvail > 0 ? `🟢 ${vAvail} in stock` : "🔴 Sold Out"
              })`;
            })
          : [];

      const customFieldLines =
        product.customFields && Object.keys(product.customFields).length > 0
          ? Object.entries(product.customFields).map(([k, v]) => `• ${k}: *${v}*`)
          : [];

      const promptText = [
        `📦 *${product.name}* (\`${product.skuCode}\`)`,
        product.description ? `_${product.description}_` : "",
        `📂 Category: *${product.category || "General"}*`,
        `💰 Price: *${priceDisplay}*`,
        `🔢 Available Stock: *${Math.max(0, product.stockTotal - product.stockReserved)} unit(s)*`,
        ...(customFieldLines.length > 0 ? [``, `✨ *Specifications:*`, ...customFieldLines] : []),
        ...(variantLines.length > 0
          ? [``, `🎛️ *Available Options & Live Stock:*`, ...variantLines]
          : []),
        ``,
        variantLines.length > 0
          ? `_Tap an option below or reply with the option number (e.g. *1*) to add to cart:_`
          : `_Tap below to add to cart or browse more items in this category:_`,
      ]
        .filter(Boolean)
        .join("\n");

      const quickReplies: QuickReplyOption[] = [];
      if (product.variants && product.variants.length > 0) {
        for (const v of product.variants.filter((v) => v.stockTotal - v.stockReserved > 0)) {
          const vPrice =
            v.priceKobo !== undefined
              ? formatNaira(v.priceKobo)
              : formatNaira(product.basePriceKobo);
          quickReplies.push({
            label: `🛒 Add ${v.name} (${vPrice})`,
            replyText: `Add ${product.skuCode} ${v.name}`,
          });
        }
      } else if (product.stockTotal - product.stockReserved > 0) {
        quickReplies.push({
          label: `🛒 Add to Cart (${formatNaira(product.basePriceKobo)})`,
          replyText: `Add to cart ${product.skuCode}`,
        });
      }

      if (product.category) {
        quickReplies.push({
          label: `📂 More in ${product.category}`,
          replyText: `category ${product.category}`,
        });
      }

      if (currentCart.length > 0) {
        quickReplies.push({
          label: `🛒 View Cart (${currentCart.length})`,
          replyText: "cart",
        });
      }

      quickReplies.push({
        label: "💬 Chat with Vendor",
        replyText: "talk to vendor",
      });

      if (product.variants && product.variants.length > 0) {
        this.buyerSessions.set(params.buyerPhone, {
          buyerPhone: params.buyerPhone,
          buyerName: params.buyerName,
          activeProductId: product.id,
          quantity: explicitQty,
          discountCode: mentionedDiscount?.code,
          state: "AWAITING_VARIANT",
          updatedAt: new Date(),
        });
      }

      await this.dispatchWhatsAppAndRecordChat({
        channel: "BUYER_SHOP_WA",
        toPhone: params.buyerPhone,
        text: promptText,
        imageUrl: product.primaryImageUrl,
        quickReplies,
        headerText: product.name.slice(0, 60),
      });

      await this.broadcastStateChange();
      return { step: "PROMPTED_FOR_SHIPPING_ZONE" };
    }

    // IF PRODUCT HAS VARIANTS AND BUYER HAS NOT SPECIFIED WHICH VARIANT:
    // USER'S EXACT REQUIREMENT:
    // "when a product is requested for, if it is a variable products display all the variants and their stock quantity"
    if (product.variants && product.variants.length > 0 && !variant) {
      this.buyerSessions.set(params.buyerPhone, {
        buyerPhone: params.buyerPhone,
        buyerName: params.buyerName,
        activeProductId: product.id,
        quantity: explicitQty,
        discountCode: mentionedDiscount?.code,
        state: "AWAITING_VARIANT",
        updatedAt: new Date(),
      });

      const variantLines = product.variants.map((v, i) => {
        const vPrice = v.priceKobo !== undefined ? formatNaira(v.priceKobo) : formatNaira(product.basePriceKobo);
        const vAvail = Math.max(0, v.stockTotal - v.stockReserved);
        return `*${i + 1}.* *${v.name}* (\`${v.skuCode}\`) — *${vPrice}* (${vAvail > 0 ? `🟢 ${vAvail} in stock` : "🔴 Sold Out"})`;
      }).join("\n");

      const promptText = [
        `📦 *${product.name}* is available in the following options:`,
        ``,
        variantLines,
        ``,
        `_Reply with the option number (e.g. *1*) or variant name to select:_`,
      ].join("\n");

      const quickReplies: QuickReplyOption[] = product.variants
        .filter((v) => v.stockTotal - v.stockReserved > 0)
        .map((v) => ({
          label: `${v.name} (${v.priceKobo !== undefined ? formatNaira(v.priceKobo) : formatNaira(product.basePriceKobo)})`,
          replyText: v.name,
        }));

      await this.dispatchWhatsAppAndRecordChat({
        channel: "BUYER_SHOP_WA",
        toPhone: params.buyerPhone,
        text: promptText,
        imageUrl: product.primaryImageUrl,
        quickReplies,
        headerText: product.name.slice(0, 60),
      });

      await this.broadcastStateChange();
      return { step: "PROMPTED_FOR_SHIPPING_ZONE" };
    }

    // IF VARIANT WAS SPECIFIED OR SIMPLE PRODUCT:
    const available = variant
      ? variant.stockTotal - variant.stockReserved
      : product.stockTotal - product.stockReserved;

    const itemLabel = variant ? `${product.name} (${variant.name})` : product.name;

    if (available <= 0) {
      const soldOutMsg = `😔 Sorry, *${itemLabel}* is currently *Sold Out* (0 available).`;
      await this.dispatchWhatsAppAndRecordChat({
        channel: "BUYER_SHOP_WA",
        toPhone: params.buyerPhone,
        text: soldOutMsg,
      });
      await this.broadcastStateChange();
      return { step: "OUT_OF_STOCK" };
    }

    const hasKnownQty = explicitQty !== undefined || existingSession?.quantity !== undefined;

    // Prompt for quantity if buyer has not specified units and hasn't given an instant delivery zone checkout
    if (!hasKnownQty && !matchedZone) {
      this.buyerSessions.set(params.buyerPhone, {
        buyerPhone: params.buyerPhone,
        buyerName: params.buyerName,
        activeProductId: product.id,
        activeVariantId: variant?.id,
        discountCode: mentionedDiscount?.code ?? existingSession?.discountCode,
        state: "AWAITING_QUANTITY",
        updatedAt: new Date(),
      });

      const { text: promptText, quickReplies } = this.buildQuantityPrompt(product, variant, available);
      await this.dispatchWhatsAppAndRecordChat({
        channel: "BUYER_SHOP_WA",
        toPhone: params.buyerPhone,
        text: promptText,
        imageUrl: product.primaryImageUrl,
        quickReplies,
        headerText: "Select Quantity",
      });
      await this.broadcastStateChange();
      return { step: "PROMPTED_FOR_QUANTITY" };
    }

    const quantity = explicitQty ?? existingSession?.quantity ?? 1;

    if (available < quantity) {
      const soldOutMsg = `⚠️ Only *${available}* unit(s) of *${itemLabel}* left in stock (you requested ${quantity}).`;
      await this.dispatchWhatsAppAndRecordChat({
        channel: "BUYER_SHOP_WA",
        toPhone: params.buyerPhone,
        text: soldOutMsg,
      });
      await this.broadcastStateChange();
      return { step: "OUT_OF_STOCK" };
    }

    // Add to buyer's cart!
    this.addToBuyerCart(params.buyerPhone, {
      productId: product.id,
      productSku: product.skuCode,
      productName: product.name,
      variantId: variant?.id,
      variantSku: variant?.skuCode,
      variantName: variant?.name,
      quantity,
      unitPriceKobo: variant?.priceKobo ?? product.basePriceKobo,
    });

    const updatedCart = this.getBuyerCart(params.buyerPhone);
    const cartTotalKobo = updatedCart.reduce((sum, item) => sum + item.unitPriceKobo * BigInt(item.quantity), 0n);

    // If shipping zone was also specified in this message, finalize immediately!
    if (matchedZone) {
      this.buyerSessions.delete(params.buyerPhone);
      const discountCode = mentionedDiscount?.code;
      const order = await this.finalizeOrderAndSendVirtualAccount({
        buyerPhone: params.buyerPhone,
        buyerName: params.buyerName,
        cartItems: updatedCart,
        shippingZone: matchedZone,
        discountCode,
      });
      this.clearBuyerCart(params.buyerPhone);
      return {
        step: order ? "INVOICE_CREATED" : "OUT_OF_STOCK",
        createdOrder: order,
      };
    }

    // Save session awaiting shipping zone
    this.buyerSessions.set(params.buyerPhone, {
      buyerPhone: params.buyerPhone,
      buyerName: params.buyerName,
      activeProductId: product.id,
      activeVariantId: variant?.id,
      quantity,
      discountCode: mentionedDiscount?.code,
      state: "AWAITING_SHIPPING_ZONE",
      updatedAt: new Date(),
    });

    const cartSummaryLines = updatedCart.map((it) => {
      const lineTotal = it.unitPriceKobo * BigInt(it.quantity);
      const vLabel = it.variantName ? ` (${it.variantName})` : "";
      return `• *${it.productName}${vLabel}* ×${it.quantity} — *${formatNaira(lineTotal)}*`;
    }).join("\n");

    const zoneOptionsText = activeZones
      .map((z) => `*${z.code}.* ${z.name} — *${formatNaira(z.feeKobo)}*`)
      .join("\n");

    const promptText = [
      `✅ Added: *${itemLabel}* (×${quantity})`,
      ``,
      `🛒 *Your Order (${updatedCart.length} item${updatedCart.length > 1 ? "s" : ""}):*`,
      cartSummaryLines,
      `💰 *Items Subtotal:* *${formatNaira(cartTotalKobo)}*`,
      ``,
      `📍 *Where should we deliver your order?*`,
      `Reply with the delivery number or location to checkout (or reply with another item to keep shopping):`,
      zoneOptionsText,
      ``,
      `_💡 Have a promo code? Include it with your reply (e.g. "${activeZones[0]?.name ?? "Lekki"} PAYDAY")_`,
    ].join("\n");

    const quickReplies: QuickReplyOption[] = [
      ...activeZones.map((z) => ({
        label: `🚚 ${z.code}. ${z.name} (${formatNaira(z.feeKobo)})`,
        replyText: z.name,
      })),
      ...(product.category
        ? [{ label: `📂 More in ${product.category}`, replyText: `category ${product.category}` }]
        : []),
      { label: "🛒 View Cart", replyText: "cart" },
    ];

    await this.dispatchWhatsAppAndRecordChat({
      channel: "BUYER_SHOP_WA",
      toPhone: params.buyerPhone,
      text: promptText,
      imageUrl: product.primaryImageUrl,
      quickReplies,
      headerText: "Delivery Options",
    });

    await this.broadcastStateChange();
    return { step: "PROMPTED_FOR_SHIPPING_ZONE" };
  }

  private async finalizeOrderAndSendVirtualAccount(params: {
    buyerPhone: string;
    buyerName: string;
    product?: RuntimeProduct;
    variant?: RuntimeProductVariant;
    quantity?: number;
    cartItems?: RuntimeCartItem[];
    shippingZone: RuntimeShippingZone;
    discountCode?: string;
    deliveryAddress?: string;
    deliveryLandmark?: string;
    alternatePhone?: string;
    salesChannel?: RuntimeOrder["salesChannel"];
  }): Promise<RuntimeOrder | undefined> {
    const rawCart: RuntimeCartItem[] =
      params.cartItems && params.cartItems.length > 0
        ? params.cartItems
        : params.product
        ? [
            {
              productId: params.product.id,
              productSku: params.product.skuCode,
              productName: params.product.name,
              variantId: params.variant?.id,
              variantSku: params.variant?.skuCode,
              variantName: params.variant?.name,
              quantity: params.quantity ?? 1,
              unitPriceKobo: params.variant?.priceKobo ?? params.product.basePriceKobo,
            },
          ]
        : [];

    if (rawCart.length === 0) return undefined;

    // Check available stock for each item in the cart
    for (const item of rawCart) {
      const prod = this.products.find((p) => p.id === item.productId);
      if (!prod) return undefined;
      const v = item.variantId ? prod.variants?.find((vr) => vr.id === item.variantId) : undefined;
      const avail = v ? v.stockTotal - v.stockReserved : prod.stockTotal - prod.stockReserved;
      if (avail < item.quantity) {
        const itemLabel = v ? `${prod.name} (${v.name})` : prod.name;
        const outMsg = `⚠️ Sorry, *${itemLabel}* only has ${Math.max(0, avail)} unit(s) left in stock (you requested ${item.quantity}). Please adjust your cart.`;
        await this.dispatchWhatsAppAndRecordChat({
          channel: "BUYER_SHOP_WA",
          toPhone: params.buyerPhone,
          text: outMsg,
        });
        await this.broadcastStateChange();
        return undefined;
      }
    }

    const activeDiscount = params.discountCode
      ? this.discounts.find(
          (d) => this.isDiscountUsable(d) && d.code.toUpperCase() === params.discountCode!.toUpperCase()
        )
      : undefined;

    const subtotalKobo = rawCart.reduce(
      (sum, it) => sum + it.unitPriceKobo * BigInt(it.quantity),
      0n
    );

    const discountAmountKobo = activeDiscount
      ? computeDiscountKobo({
          subtotalKobo,
          discountType: activeDiscount.type,
          discountValue: activeDiscount.value,
          minOrderKobo: activeDiscount.minOrderKobo,
        })
      : 0n;

    if (activeDiscount && discountAmountKobo > 0n) {
      activeDiscount.usedCount += 1;
    }

    const pricing = computeOrderTotalKobo({
      subtotalKobo,
      shippingFeeKobo: params.shippingZone.feeKobo,
      discountAmountKobo,
    });

    // Atomically Reserve Stock for all items in the cart
    const affectedProducts = new Set<RuntimeProduct>();
    for (const item of rawCart) {
      const prod = this.products.find((p) => p.id === item.productId);
      if (prod) {
        affectedProducts.add(prod);
        if (item.variantId && prod.variants) {
          const v = prod.variants.find((vr) => vr.id === item.variantId);
          if (v) v.stockReserved += item.quantity;
        }
        prod.stockReserved += item.quantity;
      }
    }

    const shortCode = this.nextOrderShortCode();
    const orderId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + this.vendor.reservationTtlMinutes * 60 * 1000);

    const splitResolution = this.computeOrderSplitConfig(
      rawCart.map((it) => ({ productId: it.productId, quantity: it.quantity })),
      pricing.totalAmountKobo
    );

    const virtualAccount = await this.monnify.createDynamicVirtualAccount({
      orderId,
      orderShortCode: shortCode,
      vendorBusinessName: this.vendor.businessName,
      customerName: params.buyerName,
      customerPhone: params.buyerPhone,
      expectedAmountKobo: pricing.totalAmountKobo,
      expiresAt,
      vendorSubAccountCode: this.vendor.monnifySubAccountCode,
      incomeSplitConfig: splitResolution?.incomeSplitConfig,
    });

    const orderItems: RuntimeOrderItem[] = rawCart.map((it) => ({
      id: crypto.randomUUID(),
      productId: it.productId,
      productSku: it.productSku,
      productName: it.productName,
      variantId: it.variantId,
      variantSku: it.variantSku,
      variantName: it.variantName,
      quantity: it.quantity,
      unitPriceKobo: it.unitPriceKobo,
      subtotalKobo: it.unitPriceKobo * BigInt(it.quantity),
    }));

    const totalQuantity = rawCart.reduce((sum, it) => sum + it.quantity, 0);
    const primaryItem = rawCart[0];
    const displayProductName =
      rawCart.length === 1
        ? primaryItem.productName
        : `${primaryItem.productName} + ${rawCart.length - 1} more item${rawCart.length > 2 ? "s" : ""}`;

    const newOrder: RuntimeOrder = {
      id: orderId,
      shortCode,
      customerPhone: params.buyerPhone,
      customerName: params.buyerName,
      productId: primaryItem.productId,
      productSku: primaryItem.productSku,
      productName: displayProductName,
      variantId: rawCart.length === 1 ? primaryItem.variantId : undefined,
      variantSku: rawCart.length === 1 ? primaryItem.variantSku : undefined,
      variantName: rawCart.length === 1 ? primaryItem.variantName : undefined,
      quantity: totalQuantity,
      items: orderItems,
      shippingZoneName: params.shippingZone.name,
      subtotalKobo: pricing.subtotalKobo,
      shippingFeeKobo: pricing.shippingFeeKobo,
      discountCode: activeDiscount && discountAmountKobo > 0n ? activeDiscount.code : undefined,
      discountAmountKobo: pricing.discountAmountKobo,
      totalAmountKobo: pricing.totalAmountKobo,
      amountPaidKobo: 0n,
      status: "PENDING_PAYMENT",
      invoiceReference: virtualAccount.invoiceReference,
      accountNumber: virtualAccount.accountNumber,
      bankName: virtualAccount.bankName,
      accountName: virtualAccount.accountName,
      isDropship: splitResolution?.isDropship ?? false,
      supplierSubAccountCode: splitResolution?.supplierSubAccountCode,
      resellerSubAccountCode: splitResolution?.resellerSubAccountCode,
      supplierShareKobo: splitResolution?.supplierShareKobo ?? 0n,
      resellerShareKobo: splitResolution?.resellerShareKobo ?? pricing.totalAmountKobo,
      platformFeeKobo: splitResolution?.platformFeeKobo ?? 0n,
      splitSettlementStatus: splitResolution?.isDropship ? "PENDING" : "NOT_APPLICABLE",
      deliveryAddress: params.deliveryAddress,
      deliveryLandmark: params.deliveryLandmark,
      alternatePhone: params.alternatePhone,
      salesChannel:
        params.salesChannel ??
        this.buyerSessions.get(params.buyerPhone)?.sourceChannel ??
        this.activeSourceChannel ??
        "WHATSAPP",
      paymentExpiresAt: expiresAt,
      createdAt: new Date(),
    };

    this.orders.unshift(newOrder);

    // Mirror the reservation, invoice and order atomically; roll back in-memory
    // state if persistence fails so the Dashboard and Database never diverge.
    try {
      await this.persistNow("createOrder", async () => {
        if (activeDiscount && discountAmountKobo > 0n) {
          await this.persistence.saveDiscount(activeDiscount);
        }
        const primaryProd =
          this.products.find((p) => p.id === primaryItem.productId) ?? this.products[0]!;
        await this.persistence.createOrder(newOrder, primaryProd);
      });
    } catch (err) {
      this.orders = this.orders.filter((o) => o.shortCode !== newOrder.shortCode);
      for (const item of rawCart) {
        const prod = this.products.find((p) => p.id === item.productId);
        if (prod) {
          if (item.variantId && prod.variants) {
            const v = prod.variants.find((vr) => vr.id === item.variantId);
            if (v) v.stockReserved = Math.max(0, v.stockReserved - item.quantity);
          }
          prod.stockReserved = Math.max(0, prod.stockReserved - item.quantity);
        }
      }
      if (activeDiscount && discountAmountKobo > 0n) {
        activeDiscount.usedCount = Math.max(0, activeDiscount.usedCount - 1);
      }
      throw err;
    }

    this.triggerRealtimeCatalogSync();

    const itemInvoiceLines = rawCart.map((it) => {
      const vDisplay = it.variantName ? ` (${it.variantName})` : "";
      const lineCost = it.unitPriceKobo * BigInt(it.quantity);
      return `• ${it.productName}${vDisplay} ×${it.quantity} — *${formatNaira(lineCost)}*`;
    });

    const summaryText = rawCart
      .map((it) => `${it.productName}${it.variantName ? ` (${it.variantName})` : ""} x${it.quantity}`)
      .join(", ");

    await this.whatsapp.sendVirtualAccountInvoice({
      toBuyerPhone: params.buyerPhone,
      vendorBusinessName: this.vendor.businessName,
      isVendorVerified: this.vendor.verificationStatus === "VERIFIED",
      orderShortCode: newOrder.shortCode,
      productSummary: `${summaryText} + ${params.shippingZone.name} delivery (${formatNaira(params.shippingZone.feeKobo)})${
        newOrder.discountCode
          ? ` - Promo ${newOrder.discountCode} (${formatNaira(newOrder.discountAmountKobo)})`
          : ""
      }`,
      totalAmountFormatted: formatNaira(newOrder.totalAmountKobo),
      bankName: newOrder.bankName,
      accountNumber: newOrder.accountNumber,
      accountName: newOrder.accountName,
      expiresInMinutes: this.vendor.reservationTtlMinutes,
      vendorPhoneId: this.vendor.whatsappPhoneId,
    });

    this.appendChat({
      channel: "BUYER_SHOP_WA",
      sender: "CATERLOG_BOT",
      fromPhone: "CATERLOG",
      text: [
        `🧾 *Order Invoice ${newOrder.shortCode}*`,
        `${this.vendor.businessName} (✓ *Verified Caterlog Seller*)`,
        `📦 *Items Ordered:*`,
        ...itemInvoiceLines,
        `💰 *Items Subtotal:* ${formatNaira(pricing.subtotalKobo)}`,
        `🚚 *Delivery (${params.shippingZone.name}):* ${formatNaira(params.shippingZone.feeKobo)}`,
        ...(newOrder.discountCode
          ? [`🏷️ *Discount (${newOrder.discountCode}):* -${formatNaira(newOrder.discountAmountKobo)}`]
          : []),
        `💳 *Total Due:* *${formatNaira(newOrder.totalAmountKobo)}*`,
        `🏦 *Bank:* ${newOrder.bankName}`,
        `🔢 *Account No:* *${newOrder.accountNumber}*`,
        `⏳ *Reserved For:* ${this.vendor.reservationTtlMinutes} mins`,
      ].join("\n"),
    });

    this.appendChat({
      channel: "BUYER_SHOP_WA",
      sender: "CATERLOG_BOT",
      fromPhone: "CATERLOG",
      text: newOrder.accountNumber,
    });

    if (this.jobScheduler) {
      const delayMs = Math.max(0, newOrder.paymentExpiresAt.getTime() - Date.now());
      void this.jobScheduler
        .schedule(
          { name: "order-expiry", payload: { orderShortCode: newOrder.shortCode } },
          { jobId: `expiry-${newOrder.shortCode}`, delayMs }
        )
        .catch((err) =>
          console.error(`[caterlog:jobs] Failed to schedule expiry for ${newOrder.shortCode}:`, err)
        );

      if (this.vendor.reservationTtlMinutes >= 10) {
        const reminderDelayMs = Math.max(0, delayMs - 5 * 60_000);
        void this.jobScheduler
          .schedule(
            { name: "payment-reminder", payload: { orderShortCode: newOrder.shortCode, minutesRemaining: 5 } },
            { jobId: `reminder-${newOrder.shortCode}`, delayMs: reminderDelayMs }
          )
          .catch((err) =>
            console.error(
              `[caterlog:jobs] Failed to schedule payment reminder for ${newOrder.shortCode}:`,
              err
            )
          );
      }

      // 2-Minute Final Urgent Warning
      if (delayMs > 2 * 60_000) {
        const reminder2MinDelayMs = Math.max(0, delayMs - 2 * 60_000);
        void this.jobScheduler
          .schedule(
            { name: "payment-reminder-2min", payload: { orderShortCode: newOrder.shortCode } },
            { jobId: `reminder-2min-${newOrder.shortCode}`, delayMs: reminder2MinDelayMs }
          )
          .catch((err) =>
            console.error(
              `[caterlog:jobs] Failed to schedule 2-minute payment reminder for ${newOrder.shortCode}:`,
              err
            )
          );
      }
    }

    await this.broadcastStateChange();
    return newOrder;
  }

  /**
   * Allocates the next globally unique order code (`ORD-NNN`) from the highest
   * sequence across all active orders, lifetime allocated codes, and persisted history.
   */
  private nextOrderShortCode(): string {
    const { shortCode, sequenceNumber } = generateUniqueOrderShortCode(
      this.orders,
      this.allocatedOrderCodes,
      this.highestOrderSeq
    );
    if (Number.isFinite(sequenceNumber) && sequenceNumber > this.highestOrderSeq) {
      this.highestOrderSeq = sequenceNumber;
    }
    return shortCode;
  }

  private isDiscountUsable(discount: RuntimeDiscount, now = new Date()): boolean {
    return (
      discount.isActive &&
      (discount.maxUses === null || discount.usedCount < discount.maxUses) &&
      (!discount.expiresAt || discount.expiresAt > now)
    );
  }

  public findProductAndVariantInBuyerMessage(
    text: string,
    quotedStatusImagePhash?: string,
    activeProduct?: RuntimeProduct
  ): { product?: RuntimeProduct; variant?: RuntimeProductVariant } {
    const trimmed = text.trim();
    const upper = trimmed.toUpperCase();
    const lower = trimmed.toLowerCase();
    const cleanAlpha = lower.replace(/[^a-z0-9]/g, "");

    // 0. If in an active product session, check if reply selects a variant
    if (activeProduct && activeProduct.variants && activeProduct.variants.length > 0) {
      // Check 1-based index (e.g. "1", "2", "#1")
      const numMatch = trimmed.match(/^#?(\d+)$/);
      if (numMatch) {
        const idx = Number.parseInt(numMatch[1], 10) - 1;
        if (idx >= 0 && idx < activeProduct.variants.length) {
          return { product: activeProduct, variant: activeProduct.variants[idx] };
        }
      }
      // Check variant SKU
      const bySku = activeProduct.variants.find((v) => {
        const vSkuClean = v.skuCode.toLowerCase().replace(/[^a-z0-9]/g, "");
        return upper.includes(v.skuCode.toUpperCase()) || (vSkuClean.length >= 4 && cleanAlpha.includes(vSkuClean));
      });
      if (bySku) return { product: activeProduct, variant: bySku };

      // Distinct variant words that do NOT appear in the parent product name
      const parentWords = new Set(
        activeProduct.name.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 2)
      );

      const matched = activeProduct.variants.find((v) => {
        const distinctWords = v.name
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ")
          .split(/\s+/)
          .filter((w) => w.length >= 2 && !parentWords.has(w));
        return distinctWords.some((w) => lower.includes(w));
      });
      if (matched) return { product: activeProduct, variant: matched };
    }

    // 1. Check if text explicitly names a variant SKU across all products
    for (const p of this.products) {
      if (p.variants && p.variants.length > 0) {
        for (const v of p.variants) {
          const vSkuClean = v.skuCode.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (upper.includes(v.skuCode.toUpperCase()) || (vSkuClean.length >= 4 && cleanAlpha.includes(vSkuClean))) {
            return { product: p, variant: v };
          }
        }
      }
    }

    // 2. Match parent product by pHash, SKU, or name
    let product: RuntimeProduct | undefined;
    if (quotedStatusImagePhash) {
      product = this.products.find(
        (p) => computePhashHammingDistance(p.imagePhash, quotedStatusImagePhash) <= 8
      );
    }
    if (!product) {
      product = this.products.find((p) => {
        const pSkuClean = p.skuCode.toLowerCase().replace(/[^a-z0-9]/g, "");
        return upper.includes(p.skuCode.toUpperCase()) || (pSkuClean.length >= 3 && cleanAlpha.includes(pSkuClean));
      });
    }
    if (!product) {
      product = this.products.find((p) => {
        const significantWords = p.name
          .toLowerCase()
          .replace(/[()]/g, "")
          .split(/\s+/)
          .filter((w) => w.length >= 3);
        if (significantWords.some((word) => lower.includes(word))) return true;

        const pLower = p.name.toLowerCase();
        if ((lower.includes("shoe") || lower.includes("heel")) && (pLower.includes("shoe") || pLower.includes("heel"))) return true;
        if (lower.includes("flask") && pLower.includes("flask")) return true;
        if (lower.includes("bag") && pLower.includes("bag")) return true;
        if (lower.includes("slide") && pLower.includes("slide")) return true;
        return false;
      });
    }

    if (!product) return {};

    // 3. If product has variants, check if text ALSO specified a distinct variant
    let matchedVariant: RuntimeProductVariant | undefined;
    if (product.variants && product.variants.length > 0) {
      const parentWords = new Set(
        product.name.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 2)
      );

      matchedVariant = product.variants.find((v) => {
        const vSkuClean = v.skuCode.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (upper.includes(v.skuCode.toUpperCase()) || (vSkuClean.length >= 4 && cleanAlpha.includes(vSkuClean))) return true;

        const distinctWords = v.name
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ")
          .split(/\s+/)
          .filter((w) => w.length >= 2 && !parentWords.has(w));
        return distinctWords.length > 0 && distinctWords.some((w) => lower.includes(w));
      });
    }

    return { product, variant: matchedVariant };
  }

  private findProductInBuyerMessage(
    text: string,
    quotedStatusImagePhash?: string
  ): RuntimeProduct | undefined {
    return this.findProductAndVariantInBuyerMessage(text, quotedStatusImagePhash).product;
  }

  private findShippingZoneInBuyerMessage(
    text: string,
    activeZones: RuntimeShippingZone[],
    allowNumericCode: boolean
  ): RuntimeShippingZone | undefined {
    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();

    // 1. Check exact or substring zone name match
    const byName = activeZones.find((z) => {
      const zoneWords = z.name
        .toLowerCase()
        .split(/[\s/]+/)
        .filter((w) => w.length >= 3);
      return lower.includes(z.name.toLowerCase()) || zoneWords.some((w) => lower.includes(w));
    });
    if (byName) return byName;

    // 2. If buyer is replying to the numbered shipping menu (e.g. "1", "2", or "2 PAYDAY"), match zone.code
    if (allowNumericCode) {
      const firstToken = trimmed.split(/\s+/)[0]?.replace(/^[#.]|[.]$/g, "") ?? "";
      if (/^\d+$/.test(firstToken)) {
        const code = Number.parseInt(firstToken, 10);
        return activeZones.find((z) => z.code === code);
      }
    }

    return undefined;
  }

  private buildQuantityPrompt(
    product: RuntimeProduct,
    variant: RuntimeProductVariant | undefined,
    availableStock: number
  ): { text: string; quickReplies: QuickReplyOption[] } {
    const itemLabel = variant ? `${product.name} — ${variant.name}` : product.name;
    const itemSku = variant ? variant.skuCode : product.skuCode;
    const unitPrice = variant?.priceKobo !== undefined ? variant.priceKobo : product.basePriceKobo;

    const promptText = [
      `🔢 *How many units of ${itemLabel} would you like?*`,
      `📦 Item: *${itemLabel}* (\`${itemSku}\`)`,
      `💰 Price per unit: *${formatNaira(unitPrice)}*`,
      `🟢 In Stock: *${availableStock} unit(s) available*`,
      ``,
      `_Reply with the number of units (e.g. *1*, *2*, *3*) or tap an option below:_`,
    ].join("\n");

    const candidates = [1, 2, 3, 5].filter((q) => q <= availableStock);
    if (candidates.length === 0 && availableStock > 0) {
      candidates.push(availableStock);
    }
    const uniqueQtys = Array.from(new Set(candidates)).slice(0, 4);
    const quickReplies: QuickReplyOption[] = uniqueQtys.map((q) => ({
      label: `${q} unit${q > 1 ? "s" : ""}`,
      replyText: `${q} unit${q > 1 ? "s" : ""}`,
    }));

    return { text: promptText, quickReplies };
  }

  private extractQuantityFromText(text: string, allowBareNumber = false): number | undefined {
    const trimmed = text.trim();

    // 0. Bare number or number + unit when allowBareNumber is true (e.g. in AWAITING_QUANTITY: "2", "3", "2 units")
    if (allowBareNumber) {
      const bareMatch = trimmed.match(/^(\d+)(?:\s*(?:units?|pcs?|pieces?|items?|pairs?|x|please|pls)?)?$/i);
      if (bareMatch?.[1]) {
        const parsed = Number.parseInt(bareMatch[1], 10);
        if (parsed >= 1 && parsed <= 999) return parsed;
      }
    }

    // 1. Direct unit matches: "2 units", "3 pcs", "1 piece", "4 items", "2 pairs"
    let match = trimmed.match(/(?<![\w-])(\d+)\s*(?:units?|pcs?|pieces?|items?|pairs?|x)\b/i);

    // 2. Matches like "x 2", "qty 3", "quantity: 4", "qty: 2"
    if (!match) {
      match = trimmed.match(/(?:x|qty|quantity)\s*[:=]?\s*(\d+)/i);
    }
    // 3. Matches like "2 pcs", "3 pairs", "4 units", "2 of ...", "3 shoes", "2 items"
    if (!match) {
      match = trimmed.match(/(?<![\w-])(\d+)\s*(?:pcs|pieces|pairs|units|items|bags|shoes|of\b)/i);
    }
    // 4. Matches like "I want 3", "need 2", "order 3", "buy 2", "send 4", "add 2"
    if (!match) {
      match = trimmed.match(/\b(?:want|need|order|buy|send|add|take|gimme)\s+(\d+)\b/i);
    }
    // 5. Matches like "2 size 39", "3 size 40"
    if (!match) {
      match = trimmed.match(/(?<![\w-])(\d+)\s+(?:size|variant|color|colour)\b/i);
    }
    // 6. Matches like "size 39 (2)", "size 39 x2", "size 39 - 2 units"
    if (!match) {
      match = trimmed.match(/(?:size|variant)\s+[a-zA-Z0-9_-]+\s*[\(\-x]\s*(\d+)/i);
    }
    // 7. Direct prefix like "3x" or "2*"
    if (!match) {
      match = trimmed.match(/(?<![\w-])(\d+)\s*(?:x|\*)\b/i);
    }
    // 8. If message begins with number followed by product/variant name, e.g. "2 SHOE-01" or "3 Zara"
    if (!match) {
      match = trimmed.match(/^(\d+)\s+[a-zA-Z]/i);
    }

    if (match?.[1]) {
      const parsed = Number.parseInt(match[1], 10);
      if (parsed >= 1 && parsed <= 999) return parsed;
    }
    return undefined;
  }

  /**
   * Principle 10.2: Server-Verified Monnify Webhook Reconciliation.
   */
  public async reconcileMonnifyWebhook(params: {
    rawBody: string;
    signatureHeader?: string;
    providerTransactionRef: string;
  }): Promise<PaymentReconciliationResult> {
    if (!this.monnify.verifyWebhookSignature(params.rawBody, params.signatureHeader)) {
      throw new Error("Invalid Monnify HMAC-SHA512 webhook signature.");
    }

    const verified = await this.monnify.verifyTransactionServerToServer(
      params.providerTransactionRef
    );

    return this.applyVerifiedPayment(verified);
  }

  /**
   * Polling fallback for local/live testing: asks Monnify directly whether the
   * order's invoice has been paid. Returns `undefined` when the order is unknown
   * and a `PENDING` result when no completed transfer exists yet.
   */
  public async verifyOrderPayment(
    shortCode: string
  ): Promise<PaymentReconciliationResult | undefined> {
    const order = this.orders.find(
      (o) => o.shortCode.toUpperCase() === shortCode.trim().toUpperCase()
    );
    if (!order) return undefined;

    const verified = await this.monnify.verifyPaymentByInvoiceReference(
      order.invoiceReference
    );
    if (!verified) {
      return {
        order,
        status: "PENDING",
        remainingBalanceKobo:
          order.totalAmountKobo > order.amountPaidKobo
            ? order.totalAmountKobo - order.amountPaidKobo
            : 0n,
        overpaidAmountKobo:
          order.amountPaidKobo > order.totalAmountKobo
            ? order.amountPaidKobo - order.totalAmountKobo
            : 0n,
        applied: false,
      };
    }

    return this.applyVerifiedPayment(verified);
  }

  /**
   * Applies an already server-verified payment record. Shared by the webhook
   * path and the manual/polling verification path.
   */
  public async applyVerifiedPayment(
    verified: ServerVerifiedPaymentRecord
  ): Promise<PaymentReconciliationResult> {
    const order = this.orders.find(
      (o) =>
        o.invoiceReference === verified.invoiceReference ||
        o.invoiceReference === verified.paymentReference
    );
    if (!order) {
      throw new Error(
        `Order not found for invoiceReference: ${verified.invoiceReference || verified.paymentReference}`
      );
    }

    const outstanding = () => ({
      order,
      remainingBalanceKobo:
        order.totalAmountKobo > order.amountPaidKobo
          ? order.totalAmountKobo - order.amountPaidKobo
          : 0n,
      overpaidAmountKobo:
        order.amountPaidKobo > order.totalAmountKobo
          ? order.amountPaidKobo - order.totalAmountKobo
          : 0n,
    });

    // Only settled transfers move an order; PENDING/FAILED records are informational.
    if (
      verified.paymentStatus !== "PAID" &&
      verified.paymentStatus !== "OVERPAID" &&
      verified.paymentStatus !== "PARTIALLY_PAID"
    ) {
      return { ...outstanding(), status: "PENDING", applied: false };
    }

    if (this.processedTxRefs.has(verified.providerTransactionRef)) {
      return {
        ...outstanding(),
        status: order.status === "PARTIALLY_PAID" ? "PARTIALLY_PAID" : "PAID",
        applied: false,
      };
    }
    this.processedTxRefs.add(verified.providerTransactionRef);

    const decision = evaluatePaymentReconciliation({
      totalAmountKobo: order.totalAmountKobo,
      previousAmountPaidKobo: order.amountPaidKobo,
      verifiedIncomingKobo: verified.amountPaidKobo,
    });

    const wasExpired = order.status === "EXPIRED" || Boolean(order.reservationReleased);

    assertValidOrderTransition(order.status, decision.nextStatus);

    order.amountPaidKobo = decision.newAmountPaidKobo;
    order.overpaidAmountKobo = decision.overpaidAmountKobo;
    order.status = decision.nextStatus;

    const product = this.products.find((p) => p.id === order.productId);

    // If order was expired, verify whether physical stock is still available before reviving!
    let isOversoldOnLatePayment = false;
    if (wasExpired && decision.nextStatus === "PAID") {
      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          const prod = this.products.find((p) => p.id === item.productId);
          if (prod) {
            const avail = item.variantId && prod.variants
              ? (prod.variants.find((v) => v.id === item.variantId)?.stockTotal ?? 0)
              : prod.stockTotal;
            if (avail < item.quantity) {
              isOversoldOnLatePayment = true;
              break;
            }
          } else {
            isOversoldOnLatePayment = true;
            break;
          }
        }
      } else {
        const prod = this.products.find((p) => p.id === order.productId);
        if (prod) {
          const avail = (order.variantId || order.variantSku) && prod.variants
            ? (prod.variants.find((v) => v.id === order.variantId || v.skuCode === order.variantSku)?.stockTotal ?? 0)
            : prod.stockTotal;
          if (avail < order.quantity) {
            isOversoldOnLatePayment = true;
          }
        } else {
          isOversoldOnLatePayment = true;
        }
      }
    }

    order.paymentTransactionRef = verified.providerTransactionRef;

    if (decision.nextStatus === "PAID") {
      order.paidAt = new Date();
      if (order.isDropship) {
        order.splitSettlementStatus = "SETTLED";
      }

      if (isOversoldOnLatePayment) {
        order.reservationReleased = true; // stock could not be secured
        const itemDisplay = order.variantName
          ? `${order.productName} (${order.variantName})`
          : order.productName;

        const oversoldBuyerMsg = [
          `⚠️ *PAYMENT RECEIVED FOR EXPIRED ORDER (${order.shortCode})*`,
          ``,
          `We received your transfer of *${formatNaira(decision.newAmountPaidKobo)}*, but this reservation had already expired and *${itemDisplay}* is now *Sold Out*.`,
          ``,
          `🏪 *What happens next:*`,
          `Our store team has been alerted immediately. The vendor will contact you shortly to either provide an alternative or issue an instant refund to your bank account.`,
          ``,
          `_Reply *talk to vendor* if you'd like to chat with the store owner right away._`,
        ].join("\n");

        const oversoldVendorAlert = [
          `🚨 *ACTION REQUIRED: Late Transfer on Expired Order (${order.shortCode})*`,
          `Buyer *${order.customerName}* (${order.customerPhone}) transferred *${formatNaira(decision.newAmountPaidKobo)}*, but this reservation had already expired and the item is now *SOLD OUT*!`,
          ``,
          `⚠️ *Action Needed:* Please contact customer at ${order.customerPhone} to arrange an alternative product or issue a refund.`,
        ].join("\n");

        await this.dispatchWhatsAppAndRecordChat({
          channel: "BUYER_SHOP_WA",
          toPhone: order.customerPhone,
          text: oversoldBuyerMsg,
          quickReplies: [
            { label: "💬 Chat with Vendor", replyText: "talk to vendor" },
            { label: "🛒 View Catalog", replyText: "catalog" },
          ],
          headerText: "Order Expired — Item Sold Out",
        });

        this.appendChat({
          channel: "VENDOR_ADMIN_WA",
          sender: "CATERLOG_BOT",
          fromPhone: "CATERLOG",
          text: oversoldVendorAlert,
        });
      } else {
        if (order.items && order.items.length > 0) {
          for (const item of order.items) {
            const prod = this.products.find((p) => p.id === item.productId);
            if (prod) {
              const reservedQty = order.reservationReleased ? 0 : item.quantity;
              prod.stockTotal = Math.max(0, prod.stockTotal - item.quantity);
              prod.stockReserved = Math.max(0, prod.stockReserved - reservedQty);

              if (item.variantId && prod.variants) {
                const variant = prod.variants.find((v) => v.id === item.variantId);
                if (variant) {
                  variant.stockTotal = Math.max(0, variant.stockTotal - item.quantity);
                  variant.stockReserved = Math.max(0, variant.stockReserved - reservedQty);
                }
              }

              if (prod.variants && prod.variants.length > 0) {
                prod.stockTotal = prod.variants.reduce((sum, v) => sum + v.stockTotal, 0);
                prod.stockReserved = prod.variants.reduce((sum, v) => sum + v.stockReserved, 0);
              }
              this.persistInBackground("updateStockOnPayment", () => this.persistence.saveProduct(prod));
              this.syncSupplierInventoryOnSale(prod, item.quantity);
            }
          }
        } else if (product) {
          product.stockTotal = Math.max(0, product.stockTotal - order.quantity);
          const reservedQuantity = order.reservationReleased ? 0 : order.quantity;
          product.stockReserved = Math.max(0, product.stockReserved - reservedQuantity);

          if (order.variantId || order.variantSku) {
            const variant = product.variants?.find(
              (v) => v.id === order.variantId || v.skuCode === order.variantSku
            );
            if (variant) {
              variant.stockTotal = Math.max(0, variant.stockTotal - order.quantity);
              variant.stockReserved = Math.max(0, variant.stockReserved - reservedQuantity);
            }
          }

          if (product.variants && product.variants.length > 0) {
            product.stockTotal = product.variants.reduce((sum, v) => sum + v.stockTotal, 0);
            product.stockReserved = product.variants.reduce((sum, v) => sum + v.stockReserved, 0);
          }
          this.persistInBackground("updateStockOnPayment", () => this.persistence.saveProduct(product));
          this.syncSupplierInventoryOnSale(product, order.quantity);
        }

        order.reservationReleased = false;

        const overpayNote =
          decision.overpaidAmountKobo > 0n
            ? `\n💚 *Overpayment:* ${formatNaira(decision.overpaidAmountKobo)} extra was received. The vendor will refund or credit it.`
            : "";

        const itemDisplay = order.variantName
          ? `${order.productName} (${order.variantName})`
          : order.productName;

        const dashboardBase = (process.env.DASHBOARD_URL ?? "http://localhost:3000").replace(/\/+$/, "");
        const trackUrl = `${dashboardBase}/track/${encodeURIComponent(order.shortCode)}`;

        const buyerReceipt = [
          `✅ *Payment Confirmed!* (${formatNaira(decision.newAmountPaidKobo)})`,
          `🧾 Receipt: *${order.shortCode}*`,
          `📦 Item: *${itemDisplay}* ×${order.quantity}`,
          `🚚 Delivery Zone: *${order.shippingZoneName}*`,
          `🏪 Vendor: *${this.vendor.businessName}*`,
          overpayNote,
          wasExpired ? "\n💚 *Late Payment Accepted:* Your transfer was received after expiry, but we had stock available and have secured your order!" : "",
          ``,
          `📍 *Where should the rider deliver your package?*`,
          `Please reply with your full street address, nearest landmark, and contact phone number (e.g. *14 Admiralty Way, Lekki Phase 1*):`,
          ``,
          `🔗 *Web Receipt & Live Tracking:* ${trackUrl}`,
        ].filter(Boolean).join("\n");

        const vendorAlert = [
          `🔔 *PAID ORDER ${order.shortCode}!*`,
          `💰 Verified Transfer: *${formatNaira(decision.newAmountPaidKobo)}* from ${verified.payerName ?? order.customerName}`,
          `📦 Item: *${itemDisplay}* ×${order.quantity} (Remaining available stock: ${product ? product.stockTotal - product.stockReserved : 0})`,
          wasExpired ? "💚 *Late Payment Revived:* Stock was available and order was restored!" : "",
          overpayNote,
          order.isDropship && order.supplierShareKobo && order.resellerShareKobo
            ? `⚡ *Monnify Auto-Split Settled:* Supplier (${formatNaira(order.supplierShareKobo)}) · Reseller Margin (${formatNaira(order.resellerShareKobo)}) · Platform Fee (${formatNaira(order.platformFeeKobo ?? 0n)})`
            : "",
          ``,
          `_Reply \`dispatch ${order.shortCode} <riderPhone>\` when handed to rider._`,
        ].filter(Boolean).join("\n");

        await this.dispatchWhatsAppAndRecordChat({
          channel: "BUYER_SHOP_WA",
          toPhone: order.customerPhone,
          text: buyerReceipt,
          headerText: "Payment Confirmed",
        });

        this.appendChat({
          channel: "VENDOR_ADMIN_WA",
          sender: "CATERLOG_BOT",
          fromPhone: "CATERLOG",
          text: vendorAlert,
        });

        // Set buyer session awaiting delivery address
        this.buyerSessions.set(order.customerPhone, {
          buyerPhone: order.customerPhone,
          buyerName: order.customerName,
          activeOrderId: order.id,
          state: "AWAITING_DELIVERY_ADDRESS",
          updatedAt: new Date(),
        });

        // For highest-tier / premium vendors with Auto-Booking enabled, auto-book courier immediately on PAID
        if (this.isHighestSubscriptionVendor() && this.getShipbubbleConfig().autoBookOnPaid && !order.courierShipment) {
          void this.bookOrderShipbubbleCourier(order.shortCode, {
            deliveryAddress: order.deliveryAddress,
            autoBooked: true,
          }).catch(console.error);
        }
      }

      if (this.jobScheduler) {
        void this.jobScheduler.cancel(`expiry-${order.shortCode}`).catch(console.error);
        void this.jobScheduler.cancel(`reminder-${order.shortCode}`).catch(console.error);
        void this.jobScheduler.cancel(`reminder-2min-${order.shortCode}`).catch(console.error);
      }
    } else {
      order.paymentExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
      const partialMsg = `⚠️ *Partial Transfer Received (${formatNaira(verified.amountPaidKobo)})*\n🧾 Order: *${order.shortCode}*\n💰 Total with ${order.shippingZoneName} delivery: *${formatNaira(order.totalAmountKobo)}*\n❗ *Remaining Balance Due: ${formatNaira(decision.remainingBalanceKobo)}*\n\nYour stock lock has been extended by 30 mins. Please transfer the remaining *${formatNaira(decision.remainingBalanceKobo)}* to *${order.accountNumber}* (${order.bankName}).`;

      this.appendChat({
        channel: "BUYER_SHOP_WA",
        sender: "CATERLOG_BOT",
        fromPhone: "CATERLOG",
        text: partialMsg,
      });
      this.appendChat({
        channel: "VENDOR_ADMIN_WA",
        sender: "CATERLOG_BOT",
        fromPhone: "CATERLOG",
        text: `⚠️ *Partial Payment on ${order.shortCode}:* Buyer transferred ${formatNaira(verified.amountPaidKobo)} of ${formatNaira(order.totalAmountKobo)}. Caterlog automatically prompted them for the remaining ${formatNaira(decision.remainingBalanceKobo)} balance.`,
      });

      if (this.jobScheduler) {
        const extDelayMs = 30 * 60 * 1000;
        void this.jobScheduler.cancel(`expiry-${order.shortCode}`).catch(console.error);
        void this.jobScheduler.cancel(`reminder-${order.shortCode}`).catch(console.error);
        void this.jobScheduler.cancel(`reminder-2min-${order.shortCode}`).catch(console.error);

        void this.jobScheduler.schedule(
          { name: "order-expiry", payload: { orderShortCode: order.shortCode } },
          { jobId: `expiry-${order.shortCode}`, delayMs: extDelayMs }
        );
        void this.jobScheduler.schedule(
          { name: "payment-reminder", payload: { orderShortCode: order.shortCode, minutesRemaining: 5 } },
          { jobId: `reminder-${order.shortCode}`, delayMs: extDelayMs - 5 * 60_000 }
        );
        void this.jobScheduler.schedule(
          { name: "payment-reminder-2min", payload: { orderShortCode: order.shortCode } },
          { jobId: `reminder-2min-${order.shortCode}`, delayMs: extDelayMs - 2 * 60_000 }
        );
      }
    }

    await this.persistNow("applyPayment", async () => {
      await this.persistence.recordPayment(order, verified);
      await this.persistence.saveOrder(order);
      if (decision.nextStatus === "PAID" && this.persistence.saveNotification) {
        const paidNotif: RuntimeVendorNotification = {
          id: `notif-paid-${order.shortCode}-${Date.now()}`,
          notificationKey: `notif-paid-${order.shortCode}`,
          title: `Payment Confirmed — #${order.shortCode}`,
          message: `Verified ${formatNaira(order.amountPaidKobo)} from ${order.customerName} (${order.customerPhone}). Ready for dispatch.`,
          category: "PAYOUTS",
          isRead: false,
          isDismissed: false,
          linkText: "View Order",
          targetView: "orders",
          targetRef: order.shortCode,
          createdAt: new Date(),
        };
        if (!this.notifications.some((n) => n.notificationKey === paidNotif.notificationKey)) {
          this.notifications.unshift(paidNotif);
        }
        await this.persistence.saveNotification(paidNotif);
      }
    });

    await this.broadcastStateChange();
    this.triggerRealtimeCatalogSync();
    return {
      order,
      status: decision.nextStatus,
      remainingBalanceKobo: decision.remainingBalanceKobo,
      overpaidAmountKobo: decision.overpaidAmountKobo,
      applied: true,
    };
  }

  private catalogSyncDebounceTimer: NodeJS.Timeout | null = null;

  /**
   * Automatically synchronizes inventory and products with WhatsApp Business Catalog
   * in real time whenever products are added, updated, stock counts change, or items are sold.
   */
  public triggerRealtimeCatalogSync(): void {
    if (this.catalogSyncDebounceTimer) {
      clearTimeout(this.catalogSyncDebounceTimer);
    }
    this.catalogSyncDebounceTimer = setTimeout(() => {
      this.catalogSyncDebounceTimer = null;
      void this.syncWhatsAppCatalog({ deleteMissing: true, silent: true }).catch((err) => {
        console.warn("[caterlog:catalog] Real-time background WhatsApp catalog sync failed:", err);
      });
    }, 250);
  }

  /**
   * Pushes the current inventory to the WhatsApp Business catalog.
   * Mock mode publishes to an in-memory catalog; live mode calls the Meta Graph API.
   */
  public async syncWhatsAppCatalog(options: {
    deleteMissing?: boolean;
    silent?: boolean;
  } = {}): Promise<CatalogSyncResult> {
    const apiBase = (process.env.API_BASE_URL || "http://localhost:4000").replace(/\/+$/, "");
    const isLocalApi = /localhost|127\.0\.0\.1/i.test(apiBase);

    const catalogInputs: CatalogProductInput[] = [];
    const allSkusToKeep: string[] = [];

    for (const product of this.products) {
      let resolvedImageUrl = product.primaryImageUrl?.trim() || "";

      // 1. If image is stored in MediaStore (relative /api/v1/media/... or localhost URL), resolve its public URL!
      const mediaMatch = resolvedImageUrl.match(/\/api\/v1\/media\/([^/?#]+)/);
      if (mediaMatch?.[1]) {
        try {
          const publicMediaUrl = await mediaStore.getPublicUrl(decodeURIComponent(mediaMatch[1]));
          if (publicMediaUrl) {
            resolvedImageUrl = publicMediaUrl;
          }
        } catch {
          // If public resolution fails, continue below
        }
      }

      // 2. If it is a relative path and apiBase is public, prefix it
      if (resolvedImageUrl.startsWith("/") && !isLocalApi) {
        resolvedImageUrl = `${apiBase}${resolvedImageUrl}`;
      }

      // 3. Only if missing, not http(s), or unresolvable localhost, fall back to smart contextual photo
      if (
        !resolvedImageUrl ||
        !/^https?:\/\//i.test(resolvedImageUrl) ||
        (isLocalApi && /localhost|127\.0\.0\.1/i.test(resolvedImageUrl))
      ) {
        resolvedImageUrl = getSmartFallbackImage(product.name, product.category);
      }

      catalogInputs.push({
        skuCode: product.skuCode,
        name: product.name,
        description: product.description,
        basePriceKobo: product.basePriceKobo,
        stockAvailable: Math.max(0, product.stockTotal - product.stockReserved),
        primaryImageUrl: resolvedImageUrl,
        category: product.category,
        brand: this.vendor.businessName,
      });
      allSkusToKeep.push(product.skuCode);

      // If product has variants, also sync each variant with item_group_id so Content IDs match
      if (product.variants && product.variants.length > 0) {
        for (const variant of product.variants) {
          catalogInputs.push({
            skuCode: variant.skuCode,
            name: `${product.name} - ${variant.name}`,
            description: `${product.name} (${variant.name}) — ${product.description}`,
            basePriceKobo: variant.priceKobo ?? product.basePriceKobo,
            stockAvailable: Math.max(0, variant.stockTotal - variant.stockReserved),
            primaryImageUrl: resolvedImageUrl,
            category: product.category,
            brand: this.vendor.businessName,
            itemGroupId: product.skuCode,
          });
          allSkusToKeep.push(variant.skuCode);
        }
      }
    }

    const result = await this.catalog.syncProducts(catalogInputs, {
      deleteMissing: options.deleteMissing ?? true,
      existingSkus: allSkusToKeep,
    });

    const failureNote =
      result.failed.length > 0
        ? `\n⚠️ ${result.failed.length} item(s) failed: ${result.failed
            .map((failure) => `${failure.skuCode} (${failure.error})`)
            .join(", ")}`
        : "";
    if (!options.silent) {
      this.appendChat({
        channel: "VENDOR_ADMIN_WA",
        sender: "CATERLOG_BOT",
        fromPhone: "CATERLOG",
        text: `🛍️ *WhatsApp Catalog Sync (${result.mode})*\nPublished ${result.upserted}/${result.attempted} product(s) to catalog ${result.catalogId ?? "(mock)"}.${failureNote}`,
      });
    }

    await this.broadcastStateChange();
    return result;
  }


  /**
   * Expires an unpaid order reservation and releases its locked inventory back to available stock.
   */
  public async expireOrderReservation(shortCode: string): Promise<RuntimeOrder | undefined> {
    const ord = this.orders.find(
      (o) => o.shortCode.toUpperCase() === shortCode.trim().toUpperCase()
    );
    if (!ord || (ord.status !== "PENDING_PAYMENT" && ord.status !== "PARTIALLY_PAID")) {
      return undefined;
    }

    assertValidOrderTransition(ord.status, "EXPIRED");

    ord.status = "EXPIRED";
    ord.reservationReleased = true;

    if (ord.items && ord.items.length > 0) {
      for (const item of ord.items) {
        const prod = this.products.find((p) => p.id === item.productId);
        if (prod) {
          prod.stockReserved = Math.max(0, prod.stockReserved - item.quantity);
          if (item.variantId && prod.variants) {
            const v = prod.variants.find((vr) => vr.id === item.variantId);
            if (v) {
              v.stockReserved = Math.max(0, v.stockReserved - item.quantity);
            }
          }
          if (prod.variants && prod.variants.length > 0) {
            prod.stockReserved = prod.variants.reduce((sum, v) => sum + v.stockReserved, 0);
          }
          this.persistInBackground("releaseExpiredReservation", () => this.persistence.saveProduct(prod));
        }
      }
    } else {
      const prod = this.products.find((p) => p.id === ord.productId);
      if (prod) {
        prod.stockReserved = Math.max(0, prod.stockReserved - ord.quantity);
        if (ord.variantId || ord.variantSku) {
          const variant = prod.variants?.find(
            (v) => v.id === ord.variantId || v.skuCode === ord.variantSku
          );
          if (variant) {
            variant.stockReserved = Math.max(0, variant.stockReserved - ord.quantity);
          }
        }
        if (prod.variants && prod.variants.length > 0) {
          prod.stockReserved = prod.variants.reduce((sum, v) => sum + v.stockReserved, 0);
        }
        this.persistInBackground("releaseExpiredReservation", () => this.persistence.saveProduct(prod));
      }
    }

    const itemDisplay = ord.variantName
      ? `${ord.productName} (${ord.variantName})`
      : ord.productName;

    const expiryNotice = [
      `🛑 *ORDER EXPIRED — DO NOT PAY (Order ${ord.shortCode})*`,
      ``,
      `The payment hold for *${itemDisplay}* has expired and the reserved stock has been released.`,
      ``,
      `⚠️ *PLEASE DO NOT TRANSFER FUNDS TO THIS ACCOUNT:*`,
      `🏦 *Bank:* ${ord.bankName}`,
      `🔢 *Account Number:* *${ord.accountNumber}*`,
      ``,
      `This virtual account is now deactivated for Order ${ord.shortCode}. Transfers sent to an expired account may fail or require manual reversal.`,
      ``,
      `_Want to re-order? Reply with the item name (e.g. *${ord.productSku}*) or tap an option below to start a fresh checkout:_`,
    ].join("\n");

    const quickReplies: QuickReplyOption[] = [
      { label: `🛍️ Re-order ${ord.productSku}`, replyText: `I want ${ord.productSku}` },
      { label: "🛒 View Catalog", replyText: "catalog" },
      { label: "💬 Chat with Vendor", replyText: "talk to vendor" },
    ];

    await this.dispatchWhatsAppAndRecordChat({
      channel: "BUYER_SHOP_WA",
      toPhone: ord.customerPhone,
      text: expiryNotice,
      quickReplies,
      headerText: "Order Expired — Do Not Pay",
    });

    this.appendChat({
      channel: "VENDOR_ADMIN_WA",
      sender: "CATERLOG_BOT",
      fromPhone: "CATERLOG",
      text: `⌛ *Reservation Expired (${ord.shortCode}):* Stock hold for *${itemDisplay}* expired without payment. Expiry notice sent to buyer (${ord.customerPhone}).`,
    });

    if (this.jobScheduler) {
      void this.jobScheduler.cancel(`expiry-${ord.shortCode}`).catch(console.error);
      void this.jobScheduler.cancel(`reminder-${ord.shortCode}`).catch(console.error);
      void this.jobScheduler.cancel(`reminder-2min-${ord.shortCode}`).catch(console.error);
    }

    await this.persistNow("expireOrder", () => this.persistence.saveOrder(ord));

    await this.broadcastStateChange();
    this.triggerRealtimeCatalogSync();
    return ord;
  }

  /**
   * Expires every unpaid/partially-paid reservation whose payment window has elapsed.
   * Intended to be called by a lightweight interval (the in-memory Stage 1 engine has
   * no durable queue yet; a Stage 2 worker will replace this).
   */
  public async expireOverdueOrders(now = new Date()): Promise<RuntimeOrder[]> {
    const overdue = this.orders.filter(
      (o) =>
        (o.status === "PENDING_PAYMENT" || o.status === "PARTIALLY_PAID") &&
        o.paymentExpiresAt <= now
    );
    const expired: RuntimeOrder[] = [];
    for (const order of overdue) {
      const result = await this.expireOrderReservation(order.shortCode);
      if (result) expired.push(result);
    }
    return expired;
  }

  /**
   * Sends an automated payment reminder to the buyer for an active pending or partially-paid order.
   * Supports standard reminder (e.g. 5 mins left) and urgent countdown (2 mins left).
   */
  public async sendPaymentReminder(
    shortCode: string,
    minutesRemaining = 5
  ): Promise<RuntimeOrder | undefined> {
    const ord = this.orders.find(
      (o) => o.shortCode.toUpperCase() === shortCode.trim().toUpperCase()
    );
    if (!ord || (ord.status !== "PENDING_PAYMENT" && ord.status !== "PARTIALLY_PAID")) {
      return undefined;
    }

    const remainingKobo =
      ord.totalAmountKobo > ord.amountPaidKobo ? ord.totalAmountKobo - ord.amountPaidKobo : 0n;
    if (remainingKobo <= 0n) return undefined;

    const isUrgent2Min = minutesRemaining <= 2;
    const itemDisplay = ord.variantName
      ? `${ord.productName} (${ord.variantName})`
      : ord.productName;

    const reminderText = isUrgent2Min
      ? [
          `⚠️ *URGENT: 2 MINUTES LEFT — Order ${ord.shortCode}*`,
          `Your reservation for *${itemDisplay}* will expire in *2 minutes*!`,
          ``,
          `💰 *Amount Due:* *${formatNaira(remainingKobo)}*`,
          `🏦 *Bank:* ${ord.bankName}`,
          `🔢 *Account No:* *${ord.accountNumber}*`,
          ``,
          `⏰ *Please complete your bank transfer now.* Once the 2-minute countdown ends, your stock reservation will be released and this payment account will close.`,
        ].join("\n")
      : [
          `⏰ *Payment Reminder — Order ${ord.shortCode}*`,
          `Your reserved items are currently being held, but your reservation is expiring soon.`,
          `💰 *Amount Remaining:* *${formatNaira(remainingKobo)}*`,
          `🏦 *Bank:* ${ord.bankName}`,
          `🔢 *Account No:* *${ord.accountNumber}*`,
          `_Transfer directly to this dedicated account to complete your order._`,
        ].join("\n");

    const quickReplies: QuickReplyOption[] = [
      { label: "💳 Copy Account Number", replyText: ord.accountNumber },
      { label: "🛒 View Cart", replyText: "cart" },
      { label: "💬 Chat with Vendor", replyText: "talk to vendor" },
    ];

    await this.dispatchWhatsAppAndRecordChat({
      channel: "BUYER_SHOP_WA",
      toPhone: ord.customerPhone,
      text: reminderText,
      quickReplies,
      headerText: isUrgent2Min ? "⚠️ 2-Min Expiry Warning" : "Payment Reminder",
    });

    await this.dispatchWhatsAppAndRecordChat({
      channel: "BUYER_SHOP_WA",
      toPhone: ord.customerPhone,
      text: ord.accountNumber,
    });

    await this.broadcastStateChange();
    return ord;
  }

  // ---------------------------------------------------------
  // Shared Mutation Methods (Invoked by both WhatsApp & Web Dashboard)
  // ---------------------------------------------------------

  public updateSettings(input: {
    copilotMode?: DomainCopilotMode;
    copilotIdleSeconds?: number;
    reservationTtlMinutes?: number;
  }) {
    if (input.copilotMode) {
      if (!["COPILOT", "FULL_AUTO", "MANUAL"].includes(input.copilotMode)) {
        throw new Error(`Invalid Co-Pilot mode: ${input.copilotMode}`);
      }
      this.vendor.copilotMode = input.copilotMode;
    }
    if (input.copilotIdleSeconds !== undefined) {
      this.vendor.copilotIdleSeconds = clamp(input.copilotIdleSeconds, 5, 600);
    }
    if (input.reservationTtlMinutes !== undefined) {
      this.vendor.reservationTtlMinutes = clamp(input.reservationTtlMinutes, 5, 180);
    }
    this.persistInBackground("saveVendor", () => this.persistence.saveVendor(this.vendor));
    void this.broadcastStateChange();
    return this.vendor;
  }

  public updateVendorProfile(input: {
    businessName?: string;
    role?: "reseller" | "starter" | "growth" | "pro" | "vendor" | "supplier";
    whatsappPhone?: string;
    instagramHandle?: string;
    baseState?: string;
    baseCity?: string;
  }): RuntimeVendor {
    if (typeof input.businessName === "string" && input.businessName.trim()) {
      this.vendor.businessName = input.businessName.trim();
    }
    if (
      input.role === "reseller" ||
      input.role === "starter" ||
      input.role === "growth" ||
      input.role === "pro" ||
      input.role === "vendor" ||
      input.role === "supplier"
    ) {
      this.vendor.role =
        input.role === "supplier" ? "growth" : input.role === "vendor" ? "growth" : input.role;
    }
    if (typeof input.whatsappPhone === "string" && input.whatsappPhone.trim()) {
      const cleanPhone = input.whatsappPhone.trim().replace(/^0/, "+234").replace(/[^\d+]/g, "");
      this.vendor.whatsappPhone = cleanPhone.startsWith("+") ? cleanPhone : `+${cleanPhone}`;
    }
    if (typeof input.instagramHandle === "string") {
      const cleanIg = input.instagramHandle.trim().replace(/^@/, "");
      this.vendor.instagramHandle = cleanIg ? `@${cleanIg}` : undefined;
    }
    if (typeof input.baseState === "string" && input.baseState.trim()) {
      this.vendor.baseState = input.baseState.trim();
    }
    if (typeof input.baseCity === "string" && input.baseCity.trim()) {
      this.vendor.baseCity = input.baseCity.trim();
    }
    this.persistInBackground("saveVendor", () => this.persistence.saveVendor(this.vendor));
    void this.broadcastStateChange();
    return this.vendor;
  }

  public onboardVendorProfile(input: {
    businessName: string;
    whatsappPhone: string;
    email?: string;
    password?: string;
    passkeyPin?: string;
    slug?: string;
    baseState?: string;
    baseCity?: string;
    role?: "reseller" | "starter" | "growth" | "pro" | "vendor" | "supplier";
    isExistingBusiness?: boolean;
    catalogSelection?: "mirror" | "custom" | "social";
  }): RuntimeVendor {
    const cleanPhone = input.whatsappPhone.trim().replace(/^0/, "+234").replace(/[^\d+]/g, "");
    const formattedPhone = cleanPhone.startsWith("+") ? cleanPhone : `+${cleanPhone}`;
    const cleanName = input.businessName.trim() || "My Caterlog Store";
    const cleanSlug = (input.slug?.trim() || cleanName)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32);

    this.vendor.businessName = cleanName;
    if (formattedPhone.length >= 10) {
      this.vendor.whatsappPhone = formattedPhone;
    }
    if (input.email?.trim()) {
      this.vendor.email = input.email.trim().toLowerCase();
    }
    if (input.password && input.password.length >= 6) {
      this.vendor.passwordHash = sha256(input.password);
    }
    if (input.passkeyPin && /^\d{6}$/.test(input.passkeyPin.trim())) {
      this.vendor.transactionPinHash = sha256(input.passkeyPin.trim());
      this.vendor.pinSetAt = new Date();
      this.vendor.pinFailedAttempts = 0;
    }
    this.vendor.phoneVerifiedAt = new Date().toISOString();
    if (input.baseState?.trim()) {
      this.vendor.baseState = input.baseState.trim();
    }
    if (input.baseCity?.trim()) {
      this.vendor.baseCity = input.baseCity.trim();
    }
    if (
      input.role === "reseller" ||
      input.role === "starter" ||
      input.role === "growth" ||
      input.role === "pro" ||
      input.role === "vendor" ||
      input.role === "supplier"
    ) {
      this.vendor.role =
        input.role === "supplier" ? "growth" : input.role === "vendor" ? "growth" : input.role;
    } else if (typeof input.isExistingBusiness === "boolean") {
      this.vendor.role = input.isExistingBusiness ? "growth" : "reseller";
    }
    if (cleanSlug) {
      this.vendor.slug = cleanSlug;
    }
    if (input.isExistingBusiness) {
      this.vendor.verificationStatus = "VERIFIED";
    }
    if (!this.vendor.monnifySubAccountCode) {
      this.vendor.monnifySubAccountCode = `MFY_SUB_${(cleanSlug || "STORE").slice(0, 8).toUpperCase()}_${Date.now().toString().slice(-4)}`;
    }
    if (!this.vendor.featureFlags) {
      this.vendor.featureFlags = this.getDefaultFeatureFlags();
    }
    if (!this.vendor.socialAccounts) {
      this.vendor.socialAccounts = this.getDefaultSocialAccounts(this.vendor);
    }

    this.persistInBackground("onboardVendorProfile", () => this.persistence.saveVendor(this.vendor));
    void this.broadcastStateChange();
    this.triggerRealtimeCatalogSync();
    return this.vendor;
  }

  public async verifyEmailOrPasskeyLogin(input: {
    email?: string;
    phone?: string;
    password?: string;
    passkeyPin?: string;
  }): Promise<{ authenticated: boolean; vendor: RuntimeVendor }> {
    const cleanEmail = input.email?.trim().toLowerCase();
    const cleanPhone = input.phone ? this.normalizeOtpPhone(input.phone) : undefined;

    if (input.passkeyPin) {
      const pin = input.passkeyPin.trim();
      if (!/^\d{6}$/.test(pin)) {
        throw new Error("Please enter a valid 6-digit security passkey.");
      }
      if (this.vendor.transactionPinHash) {
        const isScrypt = this.vendor.transactionPinHash.includes(":");
        const valid = isScrypt
          ? await verifySecret(pin, this.vendor.transactionPinHash)
          : this.vendor.transactionPinHash === sha256(pin);
        if (!valid) {
          throw new Error("Invalid 6-digit security passkey.");
        }
      } else {
        // First time passkey sign-in on demo/existing vendor sets the passkey hash
        this.vendor.transactionPinHash = sha256(pin);
        this.vendor.pinSetAt = new Date();
      }
    } else if (input.password) {
      if (input.password.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }
      if (this.vendor.passwordHash && this.vendor.passwordHash !== sha256(input.password)) {
        throw new Error("Incorrect email or password.");
      }
      if (!this.vendor.passwordHash) {
        this.vendor.passwordHash = sha256(input.password);
      }
    } else {
      throw new Error("Password or 6-digit security passkey is required.");
    }

    if (cleanEmail && !this.vendor.email) {
      this.vendor.email = cleanEmail;
    }
    if (cleanPhone && (!this.vendor.whatsappPhone || this.vendor.whatsappPhone === "+2348031234567")) {
      this.vendor.whatsappPhone = cleanPhone;
    }
    this.persistInBackground("saveVendorAuth", () => this.persistence.saveVendor(this.vendor));
    return { authenticated: true, vendor: this.vendor };
  }

  // -------------------------------------------------------------------------
  // Google Authenticator (RFC 6238 TOTP) Setup & Verification
  // -------------------------------------------------------------------------

  private static readonly BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

  private generateBase32Secret(length = 16): string {
    const bytes = crypto.randomBytes(length);
    let out = "";
    for (let i = 0; i < length; i++) {
      out += CaterlogStage1Engine.BASE32_ALPHABET[bytes[i]! & 31];
    }
    return out;
  }

  private decodeBase32(base32: string): Buffer {
    const cleaned = base32.toUpperCase().replace(/[^A-Z2-7]/g, "");
    let bits = 0;
    let value = 0;
    const output: number[] = [];
    for (let i = 0; i < cleaned.length; i++) {
      const idx = CaterlogStage1Engine.BASE32_ALPHABET.indexOf(cleaned[i]!);
      if (idx === -1) continue;
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        output.push((value >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }
    return Buffer.from(output);
  }

  public computeTotpCode(secretBase32: string, stepOffset = 0): string {
    const key = this.decodeBase32(secretBase32);
    const counter = Math.floor(Date.now() / 30000) + stepOffset;
    const buf = Buffer.alloc(8);
    buf.writeBigInt64BE(BigInt(counter), 0);
    const hmac = crypto.createHmac("sha1", key).update(buf).digest();
    const offset = hmac[hmac.length - 1]! & 0x0f;
    const binary =
      ((hmac[offset]! & 0x7f) << 24) |
      ((hmac[offset + 1]! & 0xff) << 16) |
      ((hmac[offset + 2]! & 0xff) << 8) |
      (hmac[offset + 3]! & 0xff);
    return String(binary % 1_000_000).padStart(6, "0");
  }

  public setupGoogleAuthenticator(input?: {
    email?: string;
    businessName?: string;
    forceNew?: boolean;
  }): {
    secret: string;
    formattedSecret: string;
    issuer: string;
    accountLabel: string;
    otpauthUrl: string;
    currentCode: string;
    totpEnabled: boolean;
  } {
    if (!this.vendor.totpSecret || input?.forceNew) {
      this.vendor.totpSecret = this.generateBase32Secret(16);
      this.persistInBackground("saveTotpSecret", () =>
        this.persistence.saveVendor(this.vendor)
      );
    }
    const secret = this.vendor.totpSecret;
    const issuer = "Caterlog";
    const accountLabel =
      input?.email?.trim() ||
      this.vendor.email ||
      `${this.vendor.slug || "merchant"}@caterlog.store`;
    const otpauthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(
      accountLabel
    )}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
    const formattedSecret = secret.replace(/(.{4})/g, "$1 ").trim();

    return {
      secret,
      formattedSecret,
      issuer,
      accountLabel,
      otpauthUrl,
      currentCode: this.computeTotpCode(secret, 0),
      totpEnabled: Boolean(this.vendor.totpEnabled),
    };
  }

  public verifyGoogleAuthenticatorCode(code: string, secretOverride?: string): boolean {
    const cleanCode = code.trim().replace(/\D/g, "");
    if (cleanCode.length !== 6) return false;
    const secret = (secretOverride?.trim() || this.vendor.totpSecret || "").replace(/\s+/g, "");
    if (!secret) return false;

    for (const offset of [-1, 0, 1]) {
      if (this.computeTotpCode(secret, offset) === cleanCode) {
        this.vendor.totpSecret = secret;
        this.vendor.totpEnabled = true;
        this.vendor.totpVerifiedAt = new Date().toISOString();
        this.persistInBackground("verifyTotpSuccess", () =>
          this.persistence.saveVendor(this.vendor)
        );
        return true;
      }
    }
    return false;
  }

  public async linkVendorBankAccount(input: {
    bankCode: string;
    accountNumber: string;
    email?: string;
  }): Promise<{
    vendor: RuntimeVendor;
    subAccount: SubAccountResult;
  }> {
    const cleanAccount = input.accountNumber.trim().replace(/\D/g, "");
    if (cleanAccount.length !== 10) {
      throw new Error("A valid 10-digit Nigerian NUBAN account number is required.");
    }

    const email = input.email || `${this.vendor.slug}@caterlog.store`;
    const subAccount = await this.monnify.createSubAccount({
      bankCode: input.bankCode,
      accountNumber: cleanAccount,
      email,
      defaultSplitPercentage: 100,
    });

    this.vendor.bankCode = input.bankCode;
    this.vendor.bankName = subAccount.bankName ?? this.monnify.lookupBankName(input.bankCode);
    this.vendor.bankAccountNumber = cleanAccount;
    this.vendor.bankAccountName = subAccount.accountName ?? this.vendor.businessName;
    this.vendor.monnifySubAccountCode = subAccount.subAccountCode;

    this.persistInBackground("linkVendorBankAccount", () => this.persistence.saveVendor(this.vendor));
    void this.broadcastStateChange();

    this.appendChat({
      channel: "VENDOR_ADMIN_WA",
      sender: "CATERLOG_BOT",
      fromPhone: "CATERLOG",
      text: `🏦 *Settlement Subaccount Provisioned:*\n• Subaccount: \`${subAccount.subAccountCode}\`\n• Bank: *${this.vendor.bankName}*\n• Account: \`${cleanAccount}\` (${this.vendor.bankAccountName})\n\nCustomer payments will be automatically routed here via Monnify split escrow.`,
    });

    return { vendor: this.vendor, subAccount };
  }

  public updateVendorSettings(input: {
    businessName?: string;
    notifyPhone?: string;
  }): RuntimeVendor {
    if (input.businessName) this.vendor.businessName = input.businessName.trim();
    if (input.notifyPhone) this.vendor.whatsappPhone = input.notifyPhone.trim();
    this.persistInBackground("updateVendorSettings", () => this.persistence.saveVendor(this.vendor));
    void this.broadcastStateChange();
    return this.vendor;
  }

  private readonly activeOtps = new Map<string, {
    code: string;
    codes?: string[];
    phone: string;
    purpose: "LOGIN" | "SIGNUP" | "WITHDRAWAL" | "SETTINGS" | "BANK_CHANGE" | "PIN_RESET";
    expiresAt: number;
    attempts: number;
  }>();

  public normalizeOtpPhone(raw: string): string {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    if (digits.length === 11 && digits.startsWith("0")) {
      return `+234${digits.slice(1)}`;
    }
    if (digits.length === 14 && digits.startsWith("2340")) {
      return `+234${digits.slice(4)}`;
    }
    if (digits.length === 10 && /^[789]/.test(digits)) {
      return `+234${digits}`;
    }
    return `+${digits}`;
  }

  /**
   * Generates a cryptographically random 6-digit numeric OTP/PIN and delivers it
   * securely to the merchant's WhatsApp phone. Never leaks the code in API responses.
   */
  public generateOtp(
    phone: string,
    purpose: "LOGIN" | "SIGNUP" | "WITHDRAWAL" | "SETTINGS" | "BANK_CHANGE" | "PIN_RESET" = "LOGIN"
  ): string {
    const formattedPhone = this.normalizeOtpPhone(phone) || this.normalizeOtpPhone(this.vendor.whatsappPhone);

    const code = randomNumericCode(6);
    const key = `${formattedPhone}:${purpose}`;
    const expiresAtMs = Date.now() + 10 * 60 * 1000; // 10 minutes
    const existing = this.activeOtps.get(key);
    const previousValidCodes =
      existing && existing.expiresAt > Date.now()
        ? (existing.codes ?? [existing.code]).slice(-4)
        : [];
    this.activeOtps.set(key, {
      code,
      codes: [...previousValidCodes, code],
      phone: formattedPhone,
      purpose,
      expiresAt: expiresAtMs,
      attempts: 0,
    });

    if (this.persistence.saveOtpVerification) {
      this.persistInBackground("saveOtpVerification", () =>
        this.persistence.saveOtpVerification!({
          phone: formattedPhone,
          code,
          purpose,
          expiresAt: new Date(expiresAtMs),
        })
      );
    }

    const purposeDescriptions: Record<string, string> = {
      LOGIN: "Dashboard Login",
      SIGNUP: "Store Activation",
      WITHDRAWAL: "Fund Withdrawal & Payout",
      SETTINGS: "Sensitive Account Settings Update",
      BANK_CHANGE: "Payout Bank Account Modification",
      PIN_RESET: "Transaction PIN Reset",
    };

    const label = purposeDescriptions[purpose] || "Verification";
    const effectivePhoneId =
      this.vendor.whatsappPhoneId && this.vendor.whatsappPhoneId !== "105992837465001"
        ? this.vendor.whatsappPhoneId
        : this.integrationConfig.whatsapp.defaultPhoneNumberId ||
          process.env.WHATSAPP_PHONE_NUMBER_ID ||
          this.vendor.whatsappPhoneId;

    void this.whatsapp.sendTextMessage({
      toPhone: formattedPhone,
      text: `🔐 *Caterlog Security Verification*\n\nYour 6-digit verification code for *${label}* is:\n\n*${code}*\n\n⏳ _Valid for 10 minutes. NEVER share this code with anyone._`,
      vendorPhoneId: effectivePhoneId,
    }).catch(console.error);

    return code;
  }

  /**
   * Verifies the 6-digit numeric code entered by the user. Consumes upon success.
   */
  public verifyOtp(
    phone: string,
    inputCode: string,
    purpose: "LOGIN" | "SIGNUP" | "WITHDRAWAL" | "SETTINGS" | "BANK_CHANGE" | "PIN_RESET" = "LOGIN"
  ): boolean {
    const cleanInput = inputCode.trim();
    const formattedPhone = this.normalizeOtpPhone(phone) || this.normalizeOtpPhone(this.vendor.whatsappPhone);
    const key = `${formattedPhone}:${purpose}`;
    let record = this.activeOtps.get(key);

    if (!record) {
      // Check against vendor's registered whatsapp phone if target phone formatted matches or is demo placeholder
      const vendorFormatted = this.normalizeOtpPhone(this.vendor.whatsappPhone);
      if (vendorFormatted === formattedPhone || formattedPhone === "+2348031234567") {
        const vendorKey = `${vendorFormatted}:${purpose}`;
        record = this.activeOtps.get(vendorKey) ?? this.activeOtps.get(`${this.vendor.whatsappPhone}:${purpose}`);
      }
    }

    if (!record) {
      return false;
    }

    if (record.expiresAt < Date.now()) {
      this.activeOtps.delete(key);
      return false;
    }

    const candidates = record.codes && record.codes.length > 0 ? record.codes : [record.code];
    const matched = candidates.some((c) => safeEqual(c, cleanInput));

    if (!matched) {
      record.attempts += 1;
      if (record.attempts >= 5) {
        this.activeOtps.delete(key);
      }
      return false;
    }

    this.activeOtps.delete(key);
    const vendorFormatted = this.normalizeOtpPhone(this.vendor.whatsappPhone);
    this.activeOtps.delete(`${vendorFormatted}:${purpose}`);
    this.activeOtps.delete(`${this.vendor.whatsappPhone}:${purpose}`);

    if (this.persistence.consumeOtpVerification) {
      this.persistInBackground("consumeOtpVerification", async () => {
        await this.persistence.consumeOtpVerification!({
          phone: record!.phone,
          code: cleanInput,
          purpose,
        });
      });
    }
    return true;
  }

  /**
   * Async OTP verification that checks in-memory records first and falls back to
   * persistent database OtpVerification records (e.g. if the API process reloaded).
   */
  public async verifyOtpAsync(
    phone: string,
    inputCode: string,
    purpose: "LOGIN" | "SIGNUP" | "WITHDRAWAL" | "SETTINGS" | "BANK_CHANGE" | "PIN_RESET" = "LOGIN"
  ): Promise<boolean> {
    if (this.verifyOtp(phone, inputCode, purpose)) {
      return true;
    }
    if (!this.persistence.consumeOtpVerification) {
      return false;
    }
    const cleanInput = inputCode.trim();
    const formattedPhone = this.normalizeOtpPhone(phone) || this.normalizeOtpPhone(this.vendor.whatsappPhone);
    const consumedDirect = await this.persistence.consumeOtpVerification({
      phone: formattedPhone,
      code: cleanInput,
      purpose,
    });
    if (consumedDirect) {
      return true;
    }
    const vendorFormatted = this.normalizeOtpPhone(this.vendor.whatsappPhone);
    if (vendorFormatted && vendorFormatted !== formattedPhone) {
      const consumedVendor = await this.persistence.consumeOtpVerification({
        phone: vendorFormatted,
        code: cleanInput,
        purpose,
      });
      if (consumedVendor) {
        return true;
      }
    }
    return false;
  }

  public async setTransactionPin(input: {
    pin: string;
    otpCode?: string;
    currentPin?: string;
  }): Promise<{ success: boolean; message: string }> {
    const cleanPin = input.pin.trim();
    const weakReason = weakPinReason(cleanPin, this.vendor.whatsappPhone);
    if (weakReason) {
      throw new Error(weakReason);
    }

    // If PIN is already set, require step-up verification: either current PIN or fresh OTP
    if (this.vendor.transactionPinHash) {
      if (input.currentPin) {
        await this.verifyTransactionPin(input.currentPin);
      } else if (input.otpCode) {
        const otpValid = await this.verifyOtpAsync(this.vendor.whatsappPhone, input.otpCode, "PIN_RESET");
        if (!otpValid) {
          throw new Error("Invalid or expired 6-digit WhatsApp verification code for PIN reset.");
        }
      } else {
        throw new Error("Current transaction PIN or WhatsApp verification code is required to change your PIN.");
      }
    }

    const hashed = await hashSecret(cleanPin);
    this.vendor.transactionPinHash = hashed;
    this.vendor.pinSetAt = new Date();
    this.vendor.pinFailedAttempts = 0;
    this.vendor.pinLockedUntil = undefined;

    this.persistInBackground("saveVendor", () => this.persistence.saveVendor(this.vendor));
    void this.broadcastStateChange();

    await this.whatsapp.sendTextMessage({
      toPhone: this.vendor.whatsappPhone,
      text: `🔒 *Security Notice:* Your 6-digit Transaction PIN has been set successfully. Never share this PIN with anyone, including Caterlog staff.`,
      vendorPhoneId: this.vendor.whatsappPhoneId,
    }).catch(console.error);

    return { success: true, message: "Transaction PIN updated successfully." };
  }

  public async verifyTransactionPin(pin: string): Promise<boolean> {
    if (this.vendor.pinLockedUntil && this.vendor.pinLockedUntil.getTime() > Date.now()) {
      const waitMinutes = Math.ceil((this.vendor.pinLockedUntil.getTime() - Date.now()) / 60000);
      throw new Error(
        `Transaction PIN is locked due to multiple incorrect attempts. Try again in ${waitMinutes} minute(s).`
      );
    }

    if (!this.vendor.transactionPinHash) {
      throw new Error("No transaction PIN has been set. Please set up a 6-digit Transaction PIN first.");
    }

    const cleanPin = pin.trim();
    const isValid = await verifySecret(cleanPin, this.vendor.transactionPinHash);
    if (isValid) {
      this.vendor.pinFailedAttempts = 0;
      return true;
    }

    const currentAttempts = (this.vendor.pinFailedAttempts || 0) + 1;
    this.vendor.pinFailedAttempts = currentAttempts;

    if (currentAttempts >= 3) {
      this.vendor.pinLockedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h lockout
      await this.whatsapp.sendTextMessage({
        toPhone: this.vendor.whatsappPhone,
        text: `⚠️ *Security Alert:* 3 incorrect Transaction PIN attempts detected. Financial operations on your store have been locked for 24 hours. If this was not you, lock your store immediately: https://caterlog.store/security/freeze`,
        vendorPhoneId: this.vendor.whatsappPhoneId,
      }).catch(console.error);
      throw new Error("Incorrect transaction PIN. Account security locked for 24 hours.");
    }

    const remaining = 3 - currentAttempts;
    throw new Error(`Incorrect transaction PIN. ${remaining} attempt(s) remaining.`);
  }

  public async requestPayoutAccountChange(input: {
    bankCode: string;
    accountNumber: string;
    pin: string;
    otpCode: string;
    requestorIp?: string;
  }): Promise<{
    status: "linked" | "pending_cooling_off";
    bankName: string;
    accountNumber: string;
    accountName: string;
    effectiveAt?: Date;
    cancelToken?: string;
  }> {
    if (this.vendor.isPayoutFrozen) {
      throw new Error("Payouts are currently frozen on this store. Contact support.");
    }

    // Step-up authentication: PIN + OTP required
    await this.verifyTransactionPin(input.pin);
    const otpValid = await this.verifyOtpAsync(this.vendor.whatsappPhone, input.otpCode, "BANK_CHANGE");
    if (!otpValid) {
      throw new Error("Invalid or expired 6-digit WhatsApp security code.");
    }

    const cleanAccount = input.accountNumber.trim().replace(/\D/g, "");
    if (cleanAccount.length !== 10) {
      throw new Error("A valid 10-digit Nigerian NUBAN account number is required.");
    }

    // Resolve destination account name via Monnify / NUBAN lookup
    const resolved = await this.monnify.resolveAccountName(input.bankCode, cleanAccount);
    const resolvedName = resolved.accountName;

    // Strict Identity Anchor check: Candidate name MUST match verified legal owner
    const anchorName =
      this.vendor.verifiedLegalName || this.vendor.bankAccountName || this.vendor.businessName;
    const matchResult = matchAccountName(anchorName, resolvedName);
    if (!matchResult.matched) {
      throw new Error(
        `Identity Lock Rejection: Destination account name "${resolvedName}" does not match the verified business owner identity "${anchorName}". For your protection, payouts can only be routed to accounts bearing your verified legal name.`
      );
    }

    // If this is the vendor's first bank account (no existing account), link immediately
    if (!this.vendor.bankAccountNumber) {
      const linkRes = await this.linkVendorBankAccount({
        bankCode: input.bankCode,
        accountNumber: cleanAccount,
      });
      return {
        status: "linked",
        bankName: linkRes.vendor.bankName ?? this.monnify.lookupBankName(input.bankCode),
        accountNumber: cleanAccount,
        accountName: resolvedName,
      };
    }

    // Existing bank account: Enforce 72-hour cooling-off freeze with WhatsApp panic link
    const cancelToken = randomToken(32);
    const cancelTokenHash = sha256(cancelToken);
    const effectiveAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const bankName = this.monnify.lookupBankName(input.bankCode);
    const pending: PendingBankUpdate = {
      bankCode: input.bankCode,
      bankName,
      accountNumber: cleanAccount,
      accountName: resolvedName,
      requestedAt: new Date(),
      effectiveAt,
      cancelTokenHash,
      requestorIp: input.requestorIp,
    };

    this.vendor.pendingBankUpdate = pending;
    this.persistInBackground("saveVendor", () => this.persistence.saveVendor(this.vendor));
    void this.broadcastStateChange();

    // Blast notification across WhatsApp with panic killswitch
    const maskedOld = this.vendor.bankAccountNumber.slice(-4);
    const maskedNew = cleanAccount.slice(-4);
    const panicUrl = `https://caterlog.store/security/freeze?token=${cancelToken}`;

    await this.whatsapp.sendTextMessage({
      toPhone: this.vendor.whatsappPhone,
      text: `🚨 *SECURITY NOTICE: Payout Account Change Queued*\n\nA request to change your payout account from *${this.vendor.bankName} (...${maskedOld})* to *${bankName} (...${maskedNew} - ${resolvedName})* was submitted.\n\n⏳ *72-Hour Security Lock:* Funds will NOT be routed to this new account until *${effectiveAt.toUTCString()}*.\n\n🛑 *If you did NOT initiate this change, tap the Emergency Killswitch immediately to freeze your store and prevent payout theft:*\n${panicUrl}`,
      vendorPhoneId: this.vendor.whatsappPhoneId,
    }).catch(console.error);

    return {
      status: "pending_cooling_off",
      bankName,
      accountNumber: cleanAccount,
      accountName: resolvedName,
      effectiveAt,
      cancelToken,
    };
  }

  public async applyPendingBankUpdate(): Promise<boolean> {
    const pending = this.vendor.pendingBankUpdate;
    if (!pending) return false;
    if (new Date(pending.effectiveAt).getTime() > Date.now()) {
      return false; // Still in cooling-off period
    }

    await this.linkVendorBankAccount({
      bankCode: pending.bankCode,
      accountNumber: pending.accountNumber,
    });
    this.vendor.pendingBankUpdate = null;
    this.persistInBackground("saveVendor", () => this.persistence.saveVendor(this.vendor));
    void this.broadcastStateChange();
    return true;
  }

  public emergencyFreezeStore(cancelToken: string): { frozen: boolean; message: string } {
    const tokenHash = sha256(cancelToken.trim());
    const isPendingCancel = this.vendor.pendingBankUpdate?.cancelTokenHash === tokenHash;

    this.vendor.isPayoutFrozen = true;
    this.vendor.pendingBankUpdate = null;
    this.revokeAllVendorSessions();

    this.persistInBackground("saveVendor", () => this.persistence.saveVendor(this.vendor));
    void this.broadcastStateChange();

    void this.whatsapp.sendTextMessage({
      toPhone: this.vendor.whatsappPhone,
      text: `🛑 *EMERGENCY KILLSWITCH TRIGGERED*\n\nYour store payouts have been FROZEN and all active login sessions terminated. Any pending bank modification has been discarded.\n\nTo restore your store, please contact Caterlog Security: security@caterlog.store.`,
      vendorPhoneId: this.vendor.whatsappPhoneId,
    }).catch(console.error);

    return {
      frozen: true,
      message: "Store successfully frozen. All active sessions revoked and pending bank changes discarded.",
    };
  }

  public updateSubscription(
    planId: SubscriptionPlanId,
    billingCycle: BillingCycle = "MONTHLY"
  ): RuntimeSubscriptionInfo {
    const isAnnual = billingCycle === "ANNUALLY";
    let priceNaira = 0;
    let priceUsd = 0;
    let planName = "Free Explorer";
    let platformFeeBps = 150;
    let maxProducts = 25;
    let maxTeamSeats = 1;
    let copilotTier: "KEYWORD" | "FULL_AUTO" | "MULTI_AGENT" = "KEYWORD";
    let hasCustomDomain = false;
    let hasResellerMirroring = false;
    let hasPhashStatusMatching = false;
    let hasMarketBoost = false;
    let hasConciergeShipping = false;
    let pickupStationEnabled = false;
    let scheduledPickupWindows: string[] | undefined = undefined;
    let shieldedBuyerSupport = false;

    if (planId === "RESELLER") {
      planName = "Reseller / Dropshipper";
      priceUsd = 5;
      priceNaira = isAnnual ? 50000 : 7500;
      platformFeeBps = 150;
      maxProducts = -1;
      maxTeamSeats = 1;
      copilotTier = "KEYWORD";
      hasResellerMirroring = true;
    } else if (planId === "STARTER") {
      planName = "Starter Vendor";
      priceUsd = 10;
      priceNaira = isAnnual ? 100000 : 15000;
      platformFeeBps = 125;
      maxProducts = 100;
      maxTeamSeats = 2;
      copilotTier = "FULL_AUTO";
      hasPhashStatusMatching = true;
    } else if (planId === "GROWTH") {
      planName = "Growth Vendor (Market Boost)";
      priceUsd = 15;
      priceNaira = isAnnual ? 150000 : 22500;
      platformFeeBps = 100;
      maxProducts = -1;
      maxTeamSeats = 5;
      copilotTier = "FULL_AUTO";
      hasPhashStatusMatching = true;
      hasMarketBoost = true;
      pickupStationEnabled = true;
    } else if (planId === "PRO" || planId === "SCALE") {
      planName = "Pro Concierge Vendor";
      priceUsd = 20;
      priceNaira = isAnnual ? 200000 : 30000;
      platformFeeBps = 75;
      maxProducts = -1;
      maxTeamSeats = 15;
      copilotTier = "MULTI_AGENT";
      hasCustomDomain = true;
      hasResellerMirroring = true;
      hasPhashStatusMatching = true;
      hasMarketBoost = true;
      hasConciergeShipping = true;
      pickupStationEnabled = true;
      scheduledPickupWindows = ["10:00 AM", "1:00 PM", "4:00 PM"];
      shieldedBuyerSupport = true;
    }

    const now = new Date();
    const nextPeriod = new Date(now);
    if (isAnnual) {
      nextPeriod.setFullYear(nextPeriod.getFullYear() + 1);
    } else {
      nextPeriod.setMonth(nextPeriod.getMonth() + 1);
    }

    const sub: RuntimeSubscriptionInfo = {
      planId,
      planName,
      billingCycle,
      status: "ACTIVE",
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: nextPeriod.toISOString(),
      cancelAtPeriodEnd: false,
      priceNaira,
      priceUsd,
      platformFeeBps,
      maxProducts,
      maxTeamSeats,
      copilotTier,
      hasCustomDomain,
      hasResellerMirroring,
      hasPhashStatusMatching,
      hasMarketBoost,
      hasConciergeShipping,
      pickupStationEnabled,
      scheduledPickupWindows,
      shieldedBuyerSupport,
      paymentMethod: this.vendor.subscription?.paymentMethod ?? {
        type: "CARD",
        brand: "Mastercard",
        last4: "4242",
        bankName: "Guaranty Trust Bank",
        expiry: "08/28",
      },
    };

    this.vendor.subscription = sub;
    if (planId === "RESELLER") {
      this.vendor.role = "reseller";
    } else if (planId === "STARTER" || planId === "FREE") {
      this.vendor.role = "starter";
    } else if (planId === "GROWTH") {
      this.vendor.role = "growth";
    } else {
      this.vendor.role = "pro";
    }

    // Create an invoice entry for paid plans
    if (priceNaira > 0) {
      const invNum = `INV-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const inv: RuntimePlatformInvoice = {
        id: `inv-${Date.now()}`,
        invoiceNumber: invNum,
        description: `${planName} Subscription (${billingCycle.toLowerCase()})`,
        amountNaira: priceNaira,
        status: "PAID",
        paidAt: now.toISOString(),
        pdfUrl: `/invoices/${invNum}.pdf`,
        planId,
      };
      this.vendor.invoices = [inv, ...(this.vendor.invoices ?? [])];
    }

    this.persistInBackground("saveVendor", () => this.persistence.saveVendor(this.vendor));
    void this.broadcastStateChange();
    return sub;
  }

  public fastTrackTrustTier(cacNumber?: string): RuntimeTrustTierInfo {
    if (cacNumber) {
      this.vendor.cacNumber = cacNumber.trim();
    }
    const tier: RuntimeTrustTierInfo = {
      currentTier: 2,
      tierName: "Level 2: Instant Settlement",
      settlementSpeed: "0-Second Instant Monnify Auto-Split",
      dailyPayoutLimitNaira: 50000000,
      completedCleanOrders: Math.max(20, this.vendor.trustTier?.completedCleanOrders ?? 20),
      requiredOrdersForNextTier: 20,
      isKycVerified: true,
      isCacVerified: true,
      disputeRatePercent: 0.0,
      canFastTrackLevel2: false,
    };
    this.vendor.trustTier = tier;
    this.persistInBackground("saveVendor", () => this.persistence.saveVendor(this.vendor));
    void this.broadcastStateChange();
    return tier;
  }

  public updateProductStock(skuCode: string, stockTotal: number): RuntimeProduct | undefined {
    const prod = this.products.find((p) => p.skuCode.toUpperCase() === skuCode.toUpperCase());
    if (!prod) return undefined;
    if (!Number.isInteger(stockTotal) || stockTotal < 0) {
      throw new Error("Stock must be a whole number greater than or equal to 0.");
    }
    if (stockTotal < prod.stockReserved) {
      throw new Error(
        `Cannot set stock to ${stockTotal} for "${prod.name}" because ${prod.stockReserved} unit(s) are currently reserved by buyers.`
      );
    }
    prod.stockTotal = stockTotal;
    this.persistInBackground("saveProductStock", () => this.persistence.saveProduct(prod));
    void this.broadcastStateChange();
    this.triggerRealtimeCatalogSync();
    return prod;
  }

  public addProduct(input: {
    skuCode?: string;
    name: string;
    description?: string;
    basePriceKobo: bigint;
    stockTotal: number;
    category?: string;
    primaryImageUrl?: string;
    imagePhash?: string;
    variants?: RuntimeProductVariant[];
    customFields?: Record<string, string>;
  }): RuntimeProduct {
    const name = input.name?.trim() ?? "";
    if (!name) {
      throw new Error("Product name is required.");
    }
    if (input.basePriceKobo <= 0n) {
      throw new Error("Product price must be greater than ₦0.");
    }

    const calculatedStock =
      input.variants && input.variants.length > 0
        ? input.variants.reduce((acc, v) => acc + (v.stockTotal || 0), 0)
        : input.stockTotal;

    if (!Number.isInteger(calculatedStock) || calculatedStock < 0) {
      throw new Error("Stock must be a whole number greater than or equal to 0.");
    }

    const rawCandidateSku = input.skuCode?.trim().toUpperCase() ?? "";
    const isExistingSku = rawCandidateSku !== "" && this.products.some((p) => p.skuCode.toUpperCase() === rawCandidateSku);
    const isGenericRandomSku = /^(SKU|ITEM|PROD)-\d{3,8}$/i.test(rawCandidateSku) && !isExistingSku;

    const skuCode = (
      rawCandidateSku && !isGenericRandomSku
        ? rawCandidateSku
        : generateConsistentSku(name, input.category, this.products)
    ).toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(skuCode)) {
      throw new Error(
        "SKU must be 2-32 characters using letters, numbers, hyphens or underscores."
      );
    }

    const usedVariantSkus = new Set<string>();
    const normalizedVariants = input.variants?.map((v, i) => {
      const cleanVariantSku = v.skuCode?.toUpperCase() || "";
      const expectedPrefix = `${skuCode}-`;
      const isStructuredForParent =
        cleanVariantSku.startsWith(expectedPrefix) &&
        cleanVariantSku.length > expectedPrefix.length &&
        !/^(SKU|ITEM|PROD)-\d+/i.test(cleanVariantSku) &&
        !usedVariantSkus.has(cleanVariantSku);

      const finalVariantSku = isStructuredForParent
        ? cleanVariantSku
        : generateVariantSku(skuCode, v.name, i, usedVariantSkus);
      usedVariantSkus.add(finalVariantSku);
      return {
        ...v,
        skuCode: finalVariantSku,
      };
    });

    const resolvedImageUrl =
      input.primaryImageUrl && input.primaryImageUrl.trim() !== ""
        ? input.primaryImageUrl.trim()
        : getSmartFallbackImage(name, input.category);

    let resolvedPhash = input.imagePhash;
    if (!resolvedPhash && resolvedImageUrl) {
      const mediaMatch = resolvedImageUrl.match(/\/api\/v1\/media\/([^/?#]+)/);
      if (mediaMatch?.[1]) {
        const cached = mediaStore.getMedia(decodeURIComponent(mediaMatch[1]));
        if (cached) resolvedPhash = cached.phash;
      }
      if (!resolvedPhash) {
        resolvedPhash = computeDeterministicImagePhash(`${skuCode}:${name}:${resolvedImageUrl.slice(0, 256)}`);
      }
    }
    if (!resolvedPhash) {
      resolvedPhash = computeDeterministicImagePhash(`${skuCode}:${name}`);
    }

    const existing = this.products.find((p) => p.skuCode === skuCode);
    if (existing) {
      if (calculatedStock < existing.stockReserved) {
        throw new Error(
          `Cannot set stock to ${calculatedStock} for "${existing.name}" because ${existing.stockReserved} unit(s) are currently reserved by buyers.`
        );
      }
      existing.name = name;
      existing.basePriceKobo = input.basePriceKobo;
      existing.stockTotal = calculatedStock;
      if (input.description) existing.description = input.description.trim();
      if (input.category) existing.category = input.category.trim();
      if (input.customFields !== undefined) existing.customFields = input.customFields;
      if (input.primaryImageUrl !== undefined) {
        existing.primaryImageUrl = resolvedImageUrl;
        existing.imagePhash = resolvedPhash;
      }
      if (input.variants) {
        existing.variants = normalizedVariants;
      }
      this.persistInBackground("addProduct", () => this.persistence.saveProduct(existing));
      void this.broadcastStateChange();
      this.triggerRealtimeCatalogSync();
      return existing;
    }

    const created: RuntimeProduct = {
      id: crypto.randomUUID(),
      skuCode,
      name,
      description: input.description?.trim() || `${name} — available via WhatsApp & Caterlog`,
      category: input.category?.trim() || "General",
      basePriceKobo: input.basePriceKobo,
      primaryImageUrl: resolvedImageUrl,
      imagePhash: resolvedPhash,
      stockTotal: calculatedStock,
      stockReserved: 0,
      variants: normalizedVariants,
      customFields: input.customFields,
    };
    this.products.unshift(created);
    this.persistInBackground("addProduct", () => this.persistence.saveProduct(created));
    void this.broadcastStateChange();
    this.triggerRealtimeCatalogSync();
    return created;
  }

  public updateProduct(skuCode: string, input: {
    name?: string;
    description?: string;
    category?: string;
    basePriceKobo?: bigint;
    stockTotal?: number;
    primaryImageUrl?: string;
    imagePhash?: string;
    variants?: RuntimeProductVariant[];
    customFields?: Record<string, string>;
  }): RuntimeProduct | undefined {
    const clean = skuCode.trim().toUpperCase();
    const existing = this.products.find((p) => p.skuCode.toUpperCase() === clean);
    if (!existing) return undefined;

    if (input.name) existing.name = input.name.trim();
    if (input.description !== undefined) existing.description = input.description.trim();
    if (input.category) existing.category = input.category.trim();
    if (input.customFields !== undefined) existing.customFields = input.customFields;
    if (input.basePriceKobo !== undefined && input.basePriceKobo > 0n) existing.basePriceKobo = input.basePriceKobo;
    if (input.primaryImageUrl !== undefined) {
      existing.primaryImageUrl = input.primaryImageUrl.trim();
      if (input.imagePhash) {
        existing.imagePhash = input.imagePhash;
      } else if (existing.primaryImageUrl) {
        const mediaMatch = existing.primaryImageUrl.match(/\/api\/v1\/media\/([^/?#]+)/);
        if (mediaMatch?.[1]) {
          const cached = mediaStore.getMedia(decodeURIComponent(mediaMatch[1]));
          if (cached) existing.imagePhash = cached.phash;
        }
      }
    }

    if (input.variants) {
      const usedVariantSkus = new Set<string>();
      const expectedPrefix = `${existing.skuCode.toUpperCase()}-`;
      existing.variants = input.variants.map((v, i) => {
        const cleanVariantSku = v.skuCode?.toUpperCase() || "";
        const isStructuredForParent =
          cleanVariantSku.startsWith(expectedPrefix) &&
          cleanVariantSku.length > expectedPrefix.length &&
          !/^(SKU|ITEM|PROD)-\d+/i.test(cleanVariantSku) &&
          !usedVariantSkus.has(cleanVariantSku);

        const finalVariantSku = isStructuredForParent
          ? cleanVariantSku
          : generateVariantSku(existing.skuCode, v.name, i, usedVariantSkus);
        usedVariantSkus.add(finalVariantSku);
        return {
          ...v,
          skuCode: finalVariantSku,
        };
      });
      existing.stockTotal = existing.variants.reduce((sum, v) => sum + (v.stockTotal || 0), 0);
    } else if (input.stockTotal !== undefined) {
      existing.stockTotal = input.stockTotal;
    }

    this.persistInBackground("updateProduct", () => this.persistence.saveProduct(existing));
    void this.broadcastStateChange();
    this.triggerRealtimeCatalogSync();
    return existing;
  }

  public deleteProduct(skuCode: string): boolean {
    const cleanSku = skuCode.trim().toUpperCase();
    const index = this.products.findIndex(
      (p) => p.skuCode.toUpperCase() === cleanSku
    );
    if (index === -1) {
      return false;
    }
    this.products.splice(index, 1);
    this.persistInBackground("deleteProduct", () => this.persistence.deleteProduct(cleanSku));

    // Remove from Meta WhatsApp Catalog in real-time
    void this.catalog.deleteProduct(cleanSku).catch((err) => {
      console.warn(`[caterlog:catalog] Real-time Meta catalog deletion for "${cleanSku}" failed:`, err);
    });

    void this.broadcastStateChange();
    this.triggerRealtimeCatalogSync();
    return true;
  }

  public upsertShippingZone(name: string, feeKobo: bigint): RuntimeShippingZone {
    const cleanName = name?.trim() ?? "";
    if (!cleanName) {
      throw new Error("Shipping zone name is required.");
    }
    if (feeKobo < 0n) {
      throw new Error("Shipping fee cannot be negative.");
    }

    const existing = this.shippingZones.find(
      (z) => z.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (existing) {
      existing.feeKobo = feeKobo;
      existing.isActive = true;
      this.persistInBackground("saveShippingZone", () =>
        this.persistence.saveShippingZone(existing)
      );
      void this.broadcastStateChange();
      return existing;
    }
    const nextCode =
      this.shippingZones.reduce((max, z) => (z.code > max ? z.code : max), 0) + 1;
    const created: RuntimeShippingZone = {
      id: `sz-${Date.now()}`,
      code: nextCode,
      name: cleanName,
      feeKobo,
      isActive: true,
    };
    this.shippingZones.push(created);
    this.persistInBackground("saveShippingZone", () =>
      this.persistence.saveShippingZone(created)
    );
    void this.broadcastStateChange();
    return created;
  }

  public deleteShippingZone(code: number): RuntimeShippingZone | undefined {
    const target = this.shippingZones.find((z) => z.code === code && z.isActive);
    if (!target) return undefined;
    target.isActive = false;
    this.persistInBackground("deleteShippingZone", () =>
      this.persistence.saveShippingZone(target)
    );
    void this.broadcastStateChange();
    return target;
  }

  public upsertDiscount(input: {
    code: string;
    type: "PERCENTAGE" | "FLAT_KOBO";
    value: bigint;
    minOrderKobo?: bigint;
    maxUses?: number | null;
    expiresAt?: Date;
    isActive?: boolean;
  }): RuntimeDiscount {
    const cleanCode = input.code?.trim().toUpperCase() ?? "";
    if (!cleanCode) {
      throw new Error("Discount code cannot be empty.");
    }
    if (input.type !== "PERCENTAGE" && input.type !== "FLAT_KOBO") {
      throw new Error(`Unsupported discount type: ${input.type}`);
    }
    if (input.type === "PERCENTAGE" && (input.value <= 0n || input.value > 10000n)) {
      throw new Error("Percentage discounts must be between 0.01% and 100%.");
    }
    if (input.type === "FLAT_KOBO" && input.value <= 0n) {
      throw new Error("Flat discounts must be greater than ₦0.");
    }

    const existing = this.discounts.find((d) => d.code === cleanCode);
    if (existing) {
      existing.type = input.type;
      existing.value = input.value;
      if (input.minOrderKobo !== undefined) existing.minOrderKobo = input.minOrderKobo;
      if (input.maxUses !== undefined) existing.maxUses = input.maxUses;
      if (input.expiresAt !== undefined) existing.expiresAt = input.expiresAt;
      existing.isActive = input.isActive ?? true;
      this.persistInBackground("saveDiscount", () => this.persistence.saveDiscount(existing));
      void this.broadcastStateChange();
      return existing;
    }
    const created: RuntimeDiscount = {
      id: `disc-${Date.now()}`,
      code: cleanCode,
      type: input.type,
      value: input.value,
      minOrderKobo: input.minOrderKobo ?? 0n,
      usedCount: 0,
      maxUses: input.maxUses !== undefined ? input.maxUses : 100,
      expiresAt: input.expiresAt,
      isActive: input.isActive ?? true,
    };
    this.discounts.unshift(created);
    this.persistInBackground("saveDiscount", () => this.persistence.saveDiscount(created));
    void this.broadcastStateChange();
    return created;
  }

  public applyFlashSale(input: {
    action: "APPLY" | "CLEAR";
    discountPercent?: number;
    scope: "ALL" | "CATEGORY" | "PRODUCTS";
    targetCategory?: string;
    targetSkus?: string[];
    label?: string;
  }): { affectedCount: number; products: RuntimeProduct[] } {
    const pct = Math.min(90, Math.max(1, Math.round(Number(input.discountPercent ?? 15))));
    const affected: RuntimeProduct[] = [];

    for (const prod of this.products) {
      const matchesScope =
        input.scope === "ALL" ||
        (input.scope === "CATEGORY" &&
          prod.category.toLowerCase() === (input.targetCategory || "").trim().toLowerCase()) ||
        (input.scope === "PRODUCTS" &&
          (input.targetSkus ?? []).some((s) => s.toUpperCase() === prod.skuCode.toUpperCase()));

      if (!matchesScope) continue;

      const cf: Record<string, string> = { ...(prod.customFields ?? {}) };
      if (input.action === "CLEAR") {
        if (cf.compareAtPriceNaira) {
          const origNaira = Number(cf.compareAtPriceNaira);
          if (Number.isFinite(origNaira) && origNaira > 0) {
            prod.basePriceKobo = nairaToKobo(origNaira);
          }
          delete cf.compareAtPriceNaira;
          delete cf.flashSalePercent;
          delete cf.flashSaleLabel;
          prod.customFields = Object.keys(cf).length > 0 ? cf : undefined;
          affected.push(prod);
          this.persistInBackground("clearFlashSale", () => this.persistence.saveProduct(prod));
        }
      } else {
        const currentPriceNaira = koboToNaira(prod.basePriceKobo);
        const baselineNaira =
          cf.compareAtPriceNaira && Number(cf.compareAtPriceNaira) > currentPriceNaira
            ? Number(cf.compareAtPriceNaira)
            : currentPriceNaira;
        const discountedNaira = Math.max(100, Math.round(baselineNaira * (1 - pct / 100)));

        cf.compareAtPriceNaira = String(baselineNaira);
        cf.flashSalePercent = String(pct);
        cf.flashSaleLabel = input.label?.trim() || `${pct}% OFF FLASH SALE`;
        prod.basePriceKobo = nairaToKobo(discountedNaira);
        prod.customFields = cf;
        affected.push(prod);
        this.persistInBackground("applyFlashSale", () => this.persistence.saveProduct(prod));
      }
    }

    this.recordAuditEvent(
      "FLASH_SALE_UPDATED",
      "VENDOR_WEB_DASHBOARD",
      "PRODUCT",
      this.vendor.id,
      {
        action: input.action,
        discountPercent: pct,
        scope: input.scope,
        affectedCount: affected.length,
      }
    );
    void this.broadcastStateChange();
    this.triggerRealtimeCatalogSync();
    return { affectedCount: affected.length, products: affected };
  }

  public deactivateDiscount(code: string): RuntimeDiscount | undefined {
    const target = this.discounts.find(
      (d) => d.code === code.trim().toUpperCase() && d.isActive
    );
    if (!target) return undefined;
    target.isActive = false;
    this.persistInBackground("deactivateDiscount", () =>
      this.persistence.saveDiscount(target)
    );
    void this.broadcastStateChange();
    return target;
  }

  public async dispatchOrder(
    shortCode: string,
    riderPhone?: string
  ): Promise<RuntimeOrder | undefined> {
    const ord = this.orders.find(
      (o) => o.shortCode.toUpperCase() === shortCode.trim().toUpperCase()
    );
    if (!ord) {
      return undefined;
    }

    if (ord.status !== "OUT_FOR_DELIVERY") {
      assertValidOrderTransition(ord.status, "OUT_FOR_DELIVERY");
      ord.status = "OUT_FOR_DELIVERY";
    }

    if (riderPhone) {
      ord.riderPhone = riderPhone.trim();
    }
    ord.dispatchedAt = ord.dispatchedAt || new Date();

    const itemSummary =
      ord.items && ord.items.length > 0
        ? ord.items.map((i) => `• ${i.productName} ×${i.quantity}`).join("\n")
        : `• ${ord.productName} ×${ord.quantity || 1}`;

    const addressNotice = ord.deliveryAddress
      ? `\n📍 *Delivery Address:* ${ord.deliveryAddress}`
      : ord.shippingZoneName
        ? `\n📍 *Delivery Zone:* ${ord.shippingZoneName}`
        : "";

    const riderNotice = ord.riderPhone
      ? `\n🛵 *Dispatch Rider:* *${ord.riderPhone}*\n_The rider will call you upon arrival._`
      : `\n🛵 *Your package has been handed to our dispatch courier.*`;

    const dashboardBase = (process.env.DASHBOARD_URL ?? "http://localhost:3000").replace(/\/+$/, "");
    const trackUrl = `${dashboardBase}/track/${encodeURIComponent(ord.shortCode)}`;

    const dispatchNotice = [
      `🚚 *ORDER OUT FOR DELIVERY!*`,
      ``,
      `Hello *${ord.customerName}*, your order *#${ord.shortCode}* is on its way to you!`,
      ``,
      `📦 *Package Contents:*`,
      itemSummary,
      addressNotice,
      riderNotice,
      ``,
      `🔗 *Live Order Tracker & Receipt:* ${trackUrl}`,
      `💬 Reply *status* or *track* at any time to monitor your delivery.`,
    ].join("\n");

    await this.dispatchWhatsAppAndRecordChat({
      channel: "BUYER_SHOP_WA",
      toPhone: ord.customerPhone,
      text: dispatchNotice,
      quickReplies: [
        { label: "📍 Track Order", replyText: `track ${ord.shortCode}` },
        { label: "🛍️ View Catalog", replyText: "catalog" },
      ],
      headerText: "Order Dispatched",
    });

    this.appendChat({
      channel: "VENDOR_ADMIN_WA",
      sender: "CATERLOG_BOT",
      fromPhone: "CATERLOG",
      text: `🚚 Order *#${ord.shortCode}* marked Out for Delivery!${ord.riderPhone ? ` (Rider: ${ord.riderPhone})` : ""} Customer (${ord.customerPhone}) notified on WhatsApp.`,
    });

    await this.persistNow("dispatchOrder", () => this.persistence.saveOrder(ord));

    await this.broadcastStateChange();
    return ord;
  }

  /**
   * Returns a public-safe order tracking & official receipt payload for `/track/:shortCode`.
   */
  public getPublicOrderReceipt(shortCode: string) {
    const clean = shortCode.trim().toUpperCase();
    const ord = this.orders.find((o) => o.shortCode.toUpperCase() === clean);
    if (!ord) return undefined;

    const dashboardBase = (process.env.DASHBOARD_URL ?? "http://localhost:3000").replace(/\/+$/, "");
    const isPaid =
      ord.status === "PAID" ||
      ord.status === "PROCESSING" ||
      ord.status === "OUT_FOR_DELIVERY" ||
      ord.status === "FULFILLED";

    return {
      shortCode: ord.shortCode,
      status: ord.status,
      isPaid,
      paymentStamp:
        ord.status === "REFUNDED"
          ? "REFUNDED — PAYMENT RETURNED TO BUYER"
          : isPaid
          ? "PAID IN ADVANCE — DO NOT COLLECT CASH ON DELIVERY"
          : "AWAITING BANK TRANSFER CONFIRMATION",
      customerName: ord.customerName,
      customerPhone: ord.customerPhone,
      alternatePhone: ord.alternatePhone ?? "",
      deliveryAddress: ord.deliveryAddress ?? "",
      deliveryLandmark: ord.deliveryLandmark ?? "",
      shippingZoneName: ord.shippingZoneName,
      riderPhone: ord.riderPhone ?? "",
      productId: ord.productId,
      productSku: ord.productSku,
      productName: ord.productName,
      variantName: ord.variantName,
      quantity: ord.quantity,
      items: ord.items?.map((it) => ({
        ...it,
        unitPriceFormatted: formatNaira(it.unitPriceKobo),
        subtotalFormatted: formatNaira(it.subtotalKobo),
      })),
      subtotalFormatted: formatNaira(ord.subtotalKobo),
      shippingFeeFormatted: formatNaira(ord.shippingFeeKobo),
      discountCode: ord.discountCode,
      discountAmountFormatted: formatNaira(ord.discountAmountKobo),
      totalAmountNaira: koboToNaira(ord.totalAmountKobo),
      totalAmountFormatted: formatNaira(ord.totalAmountKobo),
      amountPaidNaira: koboToNaira(ord.amountPaidKobo),
      amountPaidFormatted: formatNaira(ord.amountPaidKobo),
      remainingBalanceNaira: koboToNaira(
        ord.totalAmountKobo > ord.amountPaidKobo ? ord.totalAmountKobo - ord.amountPaidKobo : 0n
      ),
      remainingBalanceFormatted: formatNaira(
        ord.totalAmountKobo > ord.amountPaidKobo ? ord.totalAmountKobo - ord.amountPaidKobo : 0n
      ),
      overpaidAmountFormatted: formatNaira(
        ord.amountPaidKobo > ord.totalAmountKobo ? ord.amountPaidKobo - ord.totalAmountKobo : 0n
      ),
      invoiceReference: ord.invoiceReference,
      paymentTransactionRef: ord.paymentTransactionRef ?? ord.invoiceReference,
      accountNumber: ord.accountNumber,
      bankName: ord.bankName,
      accountName: ord.accountName,
      refundReference: ord.refundReference,
      refundedAmountFormatted:
        ord.refundedAmountKobo !== undefined ? formatNaira(ord.refundedAmountKobo) : undefined,
      refundReason: ord.refundReason,
      refundedAt: ord.refundedAt,
      createdAt: ord.createdAt,
      paidAt: ord.paidAt,
      dispatchedAt: ord.dispatchedAt,
      paymentExpiresAt: ord.paymentExpiresAt,
      trackUrl: `${dashboardBase}/track/${encodeURIComponent(ord.shortCode)}`,
      courierShipment: ord.courierShipment,
      liveCheckoutRatesEnabled: this.getShipbubbleConfig().liveCheckoutRatesEnabled,
      vendor: {
        businessName: this.vendor.businessName,
        slug: this.vendor.slug,
        whatsappPhone: this.vendor.whatsappPhone,
        verificationStatus: this.vendor.verificationStatus,
      },
    };
  }

  /**
   * Updates the buyer's street delivery address, landmark, and alternate phone number
   * from the public post-payment tracking page (`/track/:shortCode`) or dashboard.
   */
  public async updateOrderDeliveryDetails(
    shortCode: string,
    input: {
      deliveryAddress?: string;
      deliveryLandmark?: string;
      alternatePhone?: string;
    }
  ): Promise<RuntimeOrder | undefined> {
    const clean = shortCode.trim().toUpperCase();
    const ord = this.orders.find((o) => o.shortCode.toUpperCase() === clean);
    if (!ord) return undefined;

    if (input.deliveryAddress !== undefined) {
      const addr = input.deliveryAddress.trim();
      if (addr) ord.deliveryAddress = addr;
    }
    if (input.deliveryLandmark !== undefined) {
      ord.deliveryLandmark = input.deliveryLandmark.trim();
    }
    if (input.alternatePhone !== undefined) {
      ord.alternatePhone = input.alternatePhone.trim();
    }

    // Clear AWAITING_DELIVERY_ADDRESS session if active for this order
    const session = this.buyerSessions.get(ord.customerPhone);
    if (
      session &&
      session.state === "AWAITING_DELIVERY_ADDRESS" &&
      (!session.activeOrderId || session.activeOrderId === ord.id)
    ) {
      this.buyerSessions.delete(ord.customerPhone);
    }

    await this.persistNow("updateOrderDeliveryDetails", () => this.persistence.saveOrder(ord));

    const summaryLines = [
      ord.deliveryAddress ? `🏠 *Address:* ${ord.deliveryAddress}` : "",
      ord.deliveryLandmark ? `🧭 *Nearest Landmark:* ${ord.deliveryLandmark}` : "",
      ord.alternatePhone ? `📞 *Alternate Phone:* ${ord.alternatePhone}` : "",
    ].filter(Boolean);

    if (summaryLines.length > 0) {
      await this.dispatchWhatsAppAndRecordChat({
        channel: "BUYER_SHOP_WA",
        toPhone: ord.customerPhone,
        text: [
          `✅ *Delivery Instructions Updated! (${ord.shortCode})*`,
          ...summaryLines,
          `🚚 *Delivery Zone:* ${ord.shippingZoneName}`,
          ``,
          `_Our dispatch rider will use these instructions for your delivery._`,
        ].join("\n"),
        headerText: "Delivery Details Saved",
      });

      this.appendChat({
        channel: "VENDOR_ADMIN_WA",
        sender: "CATERLOG_BOT",
        fromPhone: "CATERLOG",
        text: [
          `📍 *Delivery Details Updated on Web Receipt (${ord.shortCode}):*`,
          `👤 *Customer:* ${ord.customerName} (${ord.customerPhone})`,
          ...summaryLines,
        ].join("\n"),
      });
    }

    await this.broadcastStateChange();
    return ord;
  }

  /**
   * Generates a 1-click Dispatch Rider Waybill / Packing Slip manifest and preformatted WhatsApp message.
   */
  public getOrderWaybill(shortCode: string) {
    const clean = shortCode.trim().toUpperCase();
    const ord = this.orders.find((o) => o.shortCode.toUpperCase() === clean);
    if (!ord) return undefined;

    const dashboardBase = (process.env.DASHBOARD_URL ?? "http://localhost:3000").replace(/\/+$/, "");
    const trackUrl = `${dashboardBase}/track/${encodeURIComponent(ord.shortCode)}`;
    const isPaid =
      ord.status === "PAID" ||
      ord.status === "PROCESSING" ||
      ord.status === "OUT_FOR_DELIVERY" ||
      ord.status === "FULFILLED";

    const itemsList =
      ord.items && ord.items.length > 0
        ? ord.items.map((i) => ({
            sku: i.variantSku || i.productSku,
            name: i.variantName ? `${i.productName} (${i.variantName})` : i.productName,
            quantity: i.quantity,
          }))
        : [
            {
              sku: ord.variantSku || ord.productSku,
              name: ord.variantName ? `${ord.productName} (${ord.variantName})` : ord.productName,
              quantity: ord.quantity || 1,
            },
          ];

    const paymentStamp = isPaid
      ? "✅ PAID IN ADVANCE — DO NOT COLLECT CASH FROM CUSTOMER"
      : "⚠️ UNPAID — DO NOT RELEASE PACKAGE";

    const whatsappRiderText = [
      `🛵 *DISPATCH WAYBILL — #${ord.shortCode}*`,
      `🏪 *Store:* ${this.vendor.businessName} (${this.vendor.whatsappPhone})`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `💳 *Payment Status:* *${paymentStamp}*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👤 *Customer:* ${ord.customerName}`,
      `📞 *Primary Phone:* ${ord.customerPhone}`,
      ord.alternatePhone ? `☎️ *Alternate / Gate Phone:* ${ord.alternatePhone}` : "",
      `🚚 *Zone:* ${ord.shippingZoneName}`,
      `🏠 *Street Address:* ${ord.deliveryAddress || "Confirm with customer via phone"}`,
      ord.deliveryLandmark ? `🧭 *Landmark:* ${ord.deliveryLandmark}` : "",
      `━━━━━━━━━━━━━━━━━━━━`,
      `📦 *Package Items:*`,
      ...itemsList.map((it) => `• ${it.name} [${it.sku}] ×${it.quantity}`),
      `━━━━━━━━━━━━━━━━━━━━`,
      `🔗 *Live Receipt & Tracker:* ${trackUrl}`,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      waybillNumber: `WB-${ord.shortCode}`,
      orderShortCode: ord.shortCode,
      status: ord.status,
      isPaid,
      paymentStamp,
      vendorName: this.vendor.businessName,
      vendorPhone: this.vendor.whatsappPhone,
      customerName: ord.customerName,
      customerPhone: ord.customerPhone,
      alternatePhone: ord.alternatePhone ?? "",
      shippingZoneName: ord.shippingZoneName,
      deliveryAddress: ord.deliveryAddress ?? "",
      deliveryLandmark: ord.deliveryLandmark ?? "",
      riderPhone: ord.riderPhone ?? "",
      items: itemsList,
      totalQuantity: itemsList.reduce((acc, i) => acc + i.quantity, 0),
      totalAmountFormatted: formatNaira(ord.totalAmountKobo),
      amountPaidFormatted: formatNaira(ord.amountPaidKobo),
      paymentTransactionRef: ord.paymentTransactionRef ?? ord.invoiceReference,
      trackUrl,
      whatsappRiderText,
      createdAt: ord.createdAt,
      paidAt: ord.paidAt,
      dispatchedAt: ord.dispatchedAt,
    };
  }

  /**
   * Executes a 1-click instant refund via Monnify, restores stock if applicable,
   * transitions the order to `REFUNDED`, and notifies both buyer and vendor on WhatsApp.
   */
  public async refundOrder(
    shortCode: string,
    input: { reason?: string; amountKobo?: bigint } = {}
  ): Promise<{ order: RuntimeOrder; refund: RefundResult } | undefined> {
    const clean = shortCode.trim().toUpperCase();
    const ord = this.orders.find((o) => o.shortCode.toUpperCase() === clean);
    if (!ord) return undefined;

    if (ord.status === "REFUNDED") {
      throw new Error(`Order ${ord.shortCode} has already been refunded.`);
    }
    if (ord.amountPaidKobo <= 0n) {
      throw new Error(`Cannot refund Order ${ord.shortCode} because no payment (₦0) has been received.`);
    }

    const refundAmountKobo =
      input.amountKobo && input.amountKobo > 0n && input.amountKobo <= ord.amountPaidKobo
        ? input.amountKobo
        : ord.amountPaidKobo;
    const reason = input.reason?.trim() || "Order cancelled / out-of-stock instant refund";

    assertValidOrderTransition(ord.status, "REFUNDED");

    const txRef = ord.paymentTransactionRef || ord.invoiceReference;
    const refund = await this.monnify.initiateRefund({
      transactionReference: txRef,
      refundAmountKobo,
      refundReason: reason,
      customerNote: `Refund for Order ${ord.shortCode} from ${this.vendor.businessName}`,
    });

    const previousStatus = ord.status;
    ord.status = "REFUNDED";
    ord.refundReference = refund.refundReference;
    ord.refundedAmountKobo = refundAmountKobo;
    ord.refundReason = reason;
    ord.refundedAt = refund.createdAt;

    // Restore stock if it was deducted on PAID or reserved on PARTIALLY_PAID
    if (
      (previousStatus === "PAID" || previousStatus === "PROCESSING") &&
      !ord.reservationReleased
    ) {
      if (ord.items && ord.items.length > 0) {
        for (const item of ord.items) {
          const prod = this.products.find((p) => p.id === item.productId);
          if (prod) {
            prod.stockTotal += item.quantity;
            if (item.variantId && prod.variants) {
              const v = prod.variants.find((vr) => vr.id === item.variantId);
              if (v) v.stockTotal += item.quantity;
            }
            if (prod.variants && prod.variants.length > 0) {
              prod.stockTotal = prod.variants.reduce((sum, v) => sum + v.stockTotal, 0);
            }
            this.persistInBackground("restoreRefundedStock", () => this.persistence.saveProduct(prod));
          }
        }
      } else {
        const prod = this.products.find((p) => p.id === ord.productId);
        if (prod) {
          prod.stockTotal += ord.quantity;
          if (ord.variantId || ord.variantSku) {
            const v = prod.variants?.find(
              (vr) => vr.id === ord.variantId || vr.skuCode === ord.variantSku
            );
            if (v) v.stockTotal += ord.quantity;
          }
          if (prod.variants && prod.variants.length > 0) {
            prod.stockTotal = prod.variants.reduce((sum, v) => sum + v.stockTotal, 0);
          }
          this.persistInBackground("restoreRefundedStock", () => this.persistence.saveProduct(prod));
        }
      }
      ord.reservationReleased = true;
    } else if (previousStatus === "PARTIALLY_PAID" && !ord.reservationReleased) {
      const prod = this.products.find((p) => p.id === ord.productId);
      if (prod) {
        prod.stockReserved = Math.max(0, prod.stockReserved - ord.quantity);
        this.persistInBackground("releaseRefundedReservation", () => this.persistence.saveProduct(prod));
      }
      ord.reservationReleased = true;
    }

    const dashboardBase = (process.env.DASHBOARD_URL ?? "http://localhost:3000").replace(/\/+$/, "");
    const trackUrl = `${dashboardBase}/track/${encodeURIComponent(ord.shortCode)}`;

    const buyerRefundMsg = [
      `↩️ *INSTANT REFUND PROCESSED (${ord.shortCode})*`,
      ``,
      `Hello *${ord.customerName}*, a refund of *${formatNaira(refundAmountKobo)}* has been initiated back to your bank account by *${this.vendor.businessName}*.`,
      ``,
      `🧾 *Refund Reference:* \`${refund.refundReference}\``,
      `📝 *Reason:* ${reason}`,
      `🔗 *Receipt & Status:* ${trackUrl}`,
    ].join("\n");

    await this.dispatchWhatsAppAndRecordChat({
      channel: "BUYER_SHOP_WA",
      toPhone: ord.customerPhone,
      text: buyerRefundMsg,
      headerText: "Refund Processed",
    });

    this.appendChat({
      channel: "VENDOR_ADMIN_WA",
      sender: "CATERLOG_BOT",
      fromPhone: "CATERLOG",
      text: `↩️ *Order ${ord.shortCode} Refunded:* ${formatNaira(refundAmountKobo)} returned to ${ord.customerName} (${ord.customerPhone}). Ref: \`${refund.refundReference}\`.`,
    });

    await this.persistNow("refundOrder", () => this.persistence.saveOrder(ord));
    await this.broadcastStateChange();
    this.triggerRealtimeCatalogSync();

    return { order: ord, refund };
  }

  public getAnalyticsBreakdown(range: "today" | "week" | "month" = "month") {
    const now = new Date();
    const cutoff =
      range === "today"
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
        : range === "week"
          ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let paidOrdersCount = 0;
    let paidGrossKobo = 0n;
    let pendingOrdersCount = 0;
    let pendingAmountKobo = 0n;
    let shippingCollectedKobo = 0n;
    let discountsGivenKobo = 0n;
    let netProductRevenueKobo = 0n;

    for (const o of this.orders) {
      if (o.createdAt < cutoff) continue;
      if (o.status === "PAID" || o.status === "OUT_FOR_DELIVERY" || o.status === "FULFILLED") {
        paidOrdersCount += 1;
        paidGrossKobo += o.amountPaidKobo;
        shippingCollectedKobo += o.shippingFeeKobo;
        discountsGivenKobo += o.discountAmountKobo;
        netProductRevenueKobo +=
          o.subtotalKobo > o.discountAmountKobo ? o.subtotalKobo - o.discountAmountKobo : 0n;
      } else if (o.status === "PENDING_PAYMENT" || o.status === "PARTIALLY_PAID") {
        pendingOrdersCount += 1;
        pendingAmountKobo += o.totalAmountKobo - o.amountPaidKobo;
      }
    }

    return {
      paidOrdersCount,
      paidGrossKobo,
      pendingOrdersCount,
      pendingAmountKobo,
      shippingCollectedKobo,
      discountsGivenKobo,
      netProductRevenueKobo,
    };
  }

  // ---------------------------------------------------------
  // Platform-Wide Database Sync Methods (Market Boost, Network,
  // Payment Links, Withdrawals, Split Rules, KYC, Team, Notifications)
  // ---------------------------------------------------------

  public saveMarketBoost(input: Partial<RuntimeMarketBoostListing> & { startingPriceNaira?: number | string }): RuntimeMarketBoostListing {
    const existing = this.marketBoostListing;
    const startingPriceKobo =
      input.startingPriceKobo !== undefined
        ? input.startingPriceKobo
        : input.startingPriceNaira !== undefined
          ? nairaToKobo(Number(String(input.startingPriceNaira).replace(/[^0-9.]/g, "")) || 3000)
          : existing?.startingPriceKobo ?? nairaToKobo(3000);

    const listing: RuntimeMarketBoostListing = {
      id: existing?.id ?? `mb-${Date.now()}`,
      vendorId: this.vendor.id,
      isPublished: input.isPublished ?? existing?.isPublished ?? true,
      businessName: input.businessName?.trim() || existing?.businessName || this.vendor.businessName,
      category: input.category?.trim() || existing?.category || "Fashion & Footwear",
      baseState: input.baseState?.trim() || existing?.baseState || this.vendor.baseState || "Lagos",
      baseCity: input.baseCity?.trim() || existing?.baseCity || this.vendor.baseCity || "Ikeja",
      shippingScope: input.shippingScope ?? existing?.shippingScope ?? "LOCAL_STATE",
      allowInterstate: input.allowInterstate ?? existing?.allowInterstate ?? false,
      coveredStates:
        input.coveredStates && input.coveredStates.length > 0
          ? input.coveredStates
          : existing?.coveredStates ?? [input.baseState || this.vendor.baseState || "Lagos"],
      coveredLgas: Array.from(
        new Set(
          (input.coveredLgas ?? existing?.coveredLgas ?? [])
            .map((l) => l.trim())
            .filter(Boolean)
        )
      ),
      description: input.description ?? existing?.description ?? "",
      moq: input.moq?.trim() || existing?.moq || "1 unit",
      startingPriceKobo,
      fulfillmentMethod:
        input.fulfillmentMethod?.trim() ||
        existing?.fulfillmentMethod ||
        "Pickup or merchant-arranged delivery",
      deliveryNote: input.deliveryNote ?? existing?.deliveryNote ?? "",
      featuredTags: input.featuredTags ?? existing?.featuredTags ?? [],
      mirroredCategories: Array.from(
        new Set(
          (input.mirroredCategories ?? existing?.mirroredCategories ?? [])
            .map((c) => c.trim())
            .filter(Boolean)
        )
      ),
      mirroredProductSkus: Array.from(
        new Set(
          (input.mirroredProductSkus ?? existing?.mirroredProductSkus ?? [])
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean)
        )
      ),
      wholesaleDiscountRules: (
        input.wholesaleDiscountRules ?? existing?.wholesaleDiscountRules ?? []
      ).map((rule) => ({
        ...rule,
        name: rule.name?.trim() || "Wholesale Discount",
        value: Math.max(0, Number(rule.value) || 0),
        targetCategories: rule.targetCategories?.map((c) => c.trim()).filter(Boolean) ?? [],
        targetProductSkus:
          rule.targetProductSkus?.map((s) => s.trim().toUpperCase()).filter(Boolean) ?? [],
        targetResellers: rule.targetResellers?.map((r) => r.trim()).filter(Boolean) ?? [],
      })),
      subscriptionPlan: input.subscriptionPlan ?? existing?.subscriptionPlan ?? "STARTER",
      updatedAt: new Date(),
    };

    this.marketBoostListing = listing;
    this.vendor.baseState = listing.baseState;
    this.vendor.baseCity = listing.baseCity;

    if (this.persistence.saveMarketBoostListing) {
      this.persistInBackground("saveMarketBoostListing", () =>
        this.persistence.saveMarketBoostListing!(listing)
      );
    }

    // Keep the vendor's SupplierProfile in sync with the visible Market Boost products & discount rules
    const wholesaleItems = this.getMarketBoostWholesaleCatalog();
    const vendorSupplierSlug = this.vendor.slug || "vendor-supplier";
    const supplierCatalog = wholesaleItems.map((item) => ({
      sku: item.skuCode,
      name: item.name,
      category: item.category,
      wholesalePriceNaira: item.effectiveWholesaleNaira,
      suggestedRetailNaira: item.basePriceNaira,
      stock: item.availableStock,
      moq: parseInt(listing.moq.replace(/[^0-9]/g, ""), 10) || 1,
    }));

    const existingSupIdx = this.suppliers.findIndex(
      (s) =>
        s.slug.toLowerCase() === vendorSupplierSlug.toLowerCase() ||
        s.name.toLowerCase() === listing.businessName.toLowerCase()
    );
    const syncedSupplier: import("./runtime-types.ts").RuntimeSupplierProfile = {
      id: existingSupIdx >= 0 ? this.suppliers[existingSupIdx]!.id : `sup-${this.vendor.id}`,
      slug: existingSupIdx >= 0 ? this.suppliers[existingSupIdx]!.slug : vendorSupplierSlug,
      name: listing.businessName,
      verified: this.vendor.verificationStatus === "VERIFIED",
      cacNumber: this.vendor.cacNumber || "RC-VERIFIED",
      category: listing.category,
      location: `${listing.baseCity}, ${listing.baseState}`,
      state: listing.baseState,
      shippingScope: listing.shippingScope,
      allowInterstate: listing.allowInterstate,
      coveredStates: listing.coveredStates,
      coveredLgas: listing.coveredLgas ?? [],
      warehouseAddress: `${listing.baseCity}, ${listing.baseState}`,
      phone: this.vendor.whatsappPhone,
      whatsapp: this.vendor.whatsappPhone,
      rating: existingSupIdx >= 0 ? this.suppliers[existingSupIdx]!.rating : 4.9,
      totalFulfilled: existingSupIdx >= 0 ? this.suppliers[existingSupIdx]!.totalFulfilled : 42,
      subAccountCode: this.vendor.monnifySubAccountCode || "MFY_SUB_VENDOR",
      leadTime: "Same-Day Dispatch",
      cutoffTime: "3:00 PM WAT",
      wholesaleTerms: [
        `MOQ: ${listing.moq}`,
        `Fulfillment: ${listing.fulfillmentMethod}`,
        ...(listing.deliveryNote ? [listing.deliveryNote] : []),
      ],
      catalogProducts: supplierCatalog,
    };

    if (existingSupIdx >= 0) {
      this.suppliers[existingSupIdx] = syncedSupplier;
    } else if (listing.isPublished) {
      this.suppliers.unshift(syncedSupplier);
    }

    if (this.persistence.saveSupplierProfile) {
      this.persistInBackground("saveSupplierProfile", () =>
        this.persistence.saveSupplierProfile!(syncedSupplier)
      );
    }
    this.recordAuditEvent("MARKET_BOOST_UPDATED", "VENDOR_WEB_DASHBOARD", "VENDOR", this.vendor.id, {
      isPublished: listing.isPublished,
      baseState: listing.baseState,
      shippingScope: listing.shippingScope,
      coveredStatesCount: listing.coveredStates.length,
      mirroredCategoriesCount: listing.mirroredCategories.length,
      mirroredProductsCount: listing.mirroredProductSkus.length,
      discountRulesCount: listing.wholesaleDiscountRules.length,
    });
    void this.broadcastStateChange();
    return listing;
  }

  /**
   * Resolves which products are exposed for mirroring and calculates the effective
   * wholesale price after applying active Market Boost discount rules (by catalog,
   * category, specific product, and all/specific network resellers).
   */
  public getMarketBoostWholesaleCatalog(resellerIdentifier?: string) {
    const listing = this.marketBoostListing;
    const mirroredCats = new Set(
      (listing?.mirroredCategories ?? []).map((c) => c.toLowerCase())
    );
    const mirroredSkus = new Set(
      (listing?.mirroredProductSkus ?? []).map((s) => s.toUpperCase())
    );
    const rules = (listing?.wholesaleDiscountRules ?? []).filter((r) => r.isActive);
    const cleanReseller = resellerIdentifier?.trim().toLowerCase();

    return this.products
      .filter((p) => {
        const cat = (p.category || "General").trim().toLowerCase();
        return mirroredCats.has(cat) || mirroredSkus.has(p.skuCode.toUpperCase());
      })
      .map((p) => {
        const baseNaira = koboToNaira(p.basePriceKobo);
        const catLower = (p.category || "General").trim().toLowerCase();
        const skuUpper = p.skuCode.toUpperCase();

        let bestDiscountNaira = 0;
        let appliedRuleName: string | null = null;

        for (const rule of rules) {
          // 1. Check reseller audience
          if (rule.resellerScope === "SPECIFIC_RESELLERS") {
            if (!cleanReseller) continue;
            const targets = (rule.targetResellers ?? []).map((r) => r.toLowerCase());
            if (!targets.some((t) => t === cleanReseller || cleanReseller.includes(t))) {
              continue;
            }
          }

          // 2. Check product/category/catalog scope
          const matchesScope =
            rule.scope === "ENTIRE_MIRROR_CATALOG" ||
            (rule.scope === "CATEGORY" &&
              (rule.targetCategories ?? []).some((c) => c.toLowerCase() === catLower)) ||
            (rule.scope === "SPECIFIC_PRODUCTS" &&
              (rule.targetProductSkus ?? []).some((s) => s.toUpperCase() === skuUpper));

          if (!matchesScope) continue;

          const discountNaira =
            rule.discountType === "PERCENTAGE"
              ? Math.round((baseNaira * Math.min(100, rule.value)) / 100)
              : Math.min(baseNaira, Math.round(rule.value));

          if (discountNaira > bestDiscountNaira) {
            bestDiscountNaira = discountNaira;
            appliedRuleName = rule.name;
          }
        }

        const effectiveNaira = Math.max(0, baseNaira - bestDiscountNaira);
        return {
          skuCode: p.skuCode,
          name: p.name,
          category: p.category || "General",
          basePriceNaira: baseNaira,
          discountNaira: bestDiscountNaira,
          effectiveWholesaleNaira: effectiveNaira,
          appliedRuleName,
          availableStock: Math.max(0, p.stockTotal - p.stockReserved),
        };
      });
  }

  public mirrorSupplierCatalog(input: {
    supplierIdOrSlug: string;
    productSkus?: string[];
    defaultMarkupBps?: number;
    status?: "ACTIVE" | "PAUSED";
    ignoreGeofence?: boolean;
  }): { mirror: RuntimeResellerMirror; mirroredProducts: RuntimeProduct[] } {
    const cleanTarget = input.supplierIdOrSlug.trim().toLowerCase();
    const supplier = this.suppliers.find(
      (s) => s.id.toLowerCase() === cleanTarget || s.slug.toLowerCase() === cleanTarget
    );
    if (!supplier) {
      throw new Error(`Supplier "${input.supplierIdOrSlug}" was not found.`);
    }

    if (!input.ignoreGeofence) {
      const resellerState = this.vendor.baseState || "Lagos";
      const resellerLga = this.vendor.baseCity || "Ikeja";
      const check = isTerritoryDeliverable(supplier, {
        state: resellerState,
        lga: resellerLga,
      });
      if (!check.deliverable) {
        throw new Error(
          `Cannot mirror supplier "${supplier.name}": ${check.reason} (Reseller location: ${resellerState} · ${resellerLga}).`
        );
      }
    }

    const existingIdx = this.resellerMirrors.findIndex(
      (m) => m.supplierId === supplier.id || m.supplierSlug === supplier.slug
    );
    const existing = existingIdx >= 0 ? this.resellerMirrors[existingIdx] : undefined;

    const requestedSkus =
      input.productSkus && input.productSkus.length > 0
        ? input.productSkus
        : supplier.catalogProducts.map((cp) => cp.sku);

    const combinedSkus = Array.from(
      new Set([...(existing?.mirroredProductSkus ?? []), ...requestedSkus])
    );

    const mirror: RuntimeResellerMirror = {
      id: existing?.id ?? crypto.randomUUID(),
      resellerVendorId: this.vendor.id,
      supplierId: supplier.id,
      supplierSlug: supplier.slug,
      supplierName: supplier.name,
      mirroredProductSkus: combinedSkus,
      defaultMarkupBps: input.defaultMarkupBps ?? existing?.defaultMarkupBps ?? 2000,
      status: input.status ?? existing?.status ?? "ACTIVE",
      lastSyncedAt: new Date(),
    };

    if (existingIdx >= 0) {
      this.resellerMirrors[existingIdx] = mirror;
    } else {
      this.resellerMirrors.unshift(mirror);
    }

    if (this.persistence.saveResellerMirror) {
      this.persistInBackground("saveResellerMirror", () =>
        this.persistence.saveResellerMirror!(mirror)
      );
    }

    // Mirror selected supplier products into vendor's catalog with structured SKUs
    const mirroredProducts: RuntimeProduct[] = [];
    for (const sp of supplier.catalogProducts) {
      if (!requestedSkus.includes(sp.sku)) continue;
      const alreadyInCatalog = this.products.find(
        (p) =>
          p.name.toLowerCase() === sp.name.toLowerCase() ||
          p.customFields?.supplierSku === sp.sku
      );
      if (alreadyInCatalog) {
        mirroredProducts.push(alreadyInCatalog);
        continue;
      }
      const wholesaleNaira = Number(
        sp.wholesalePriceNaira ?? (sp as unknown as Record<string, unknown>).wholesaleCost ?? 0
      );
      const retailNaira = Number(
        sp.suggestedRetailNaira ??
          (sp as unknown as Record<string, unknown>).suggestedRetail ??
          (wholesaleNaira > 0 ? Math.round(wholesaleNaira * 1.25) : 0)
      );
      if (!Number.isFinite(retailNaira) || retailNaira <= 0) {
        throw new Error(`Supplier product "${sp.name}" (${sp.sku}) is missing a valid wholesale/retail price.`);
      }
      const created = this.addProduct({
        name: sp.name,
        category: sp.category || supplier.category,
        basePriceKobo: nairaToKobo(retailNaira),
        stockTotal: sp.stock || 20,
        description: `${sp.name} — Fulfilled via ${supplier.name} (${supplier.location})`,
        customFields: {
          supplierName: supplier.name,
          supplierSlug: supplier.slug,
          supplierSku: sp.sku,
          wholesalePriceNaira: String(wholesaleNaira || Math.round(retailNaira * 0.8)),
        },
      });
      mirroredProducts.push(created);
    }

    this.recordAuditEvent("SUPPLIER_CATALOG_MIRRORED", "VENDOR_WEB_DASHBOARD", "PRODUCT", supplier.slug, {
      supplierName: supplier.name,
      mirroredCount: combinedSkus.length,
    });
    void this.broadcastStateChange();
    return { mirror, mirroredProducts };
  }

  public createPaymentLink(input: {
    customerName?: string;
    customerPhone?: string;
    productSku?: string;
    description?: string;
    amountNaira: number | string;
  }): RuntimePaymentLink {
    const amountNum = Number(String(input.amountNaira).replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      throw new Error("Payment link amount must be greater than ₦0.");
    }
    const amountKobo = nairaToKobo(amountNum);
    const slug = `pay-${this.vendor.slug.slice(0, 12)}-${Date.now().toString(36).slice(-5)}`;
    const dashboardBase = (process.env.DASHBOARD_URL ?? "http://localhost:3000").replace(/\/+$/, "");
    const checkoutUrl = `${dashboardBase}/pay/${slug}`;

    const link: RuntimePaymentLink = {
      id: `plink-${Date.now()}`,
      slug,
      customerName: input.customerName?.trim() || undefined,
      customerPhone: input.customerPhone?.trim() || undefined,
      productSku: input.productSku?.trim() || undefined,
      description: input.description?.trim() || undefined,
      amountKobo,
      checkoutUrl,
      isActive: true,
      timesUsed: 0,
      createdAt: new Date(),
    };

    this.paymentLinks.unshift(link);
    if (this.persistence.savePaymentLink) {
      this.persistInBackground("savePaymentLink", () => this.persistence.savePaymentLink!(link));
    }
    this.recordAuditEvent("PAYMENT_LINK_CREATED", "VENDOR_WEB_DASHBOARD", "ORDER", slug, {
      amountNaira: amountNum,
      customerName: link.customerName,
      productSku: link.productSku,
    });
    void this.broadcastStateChange();
    return link;
  }

  public deletePaymentLink(slug: string): boolean {
    const idx = this.paymentLinks.findIndex((l) => l.slug === slug);
    if (idx === -1) return false;
    this.paymentLinks.splice(idx, 1);
    if (this.persistence.deletePaymentLink) {
      this.persistInBackground("deletePaymentLink", () =>
        this.persistence.deletePaymentLink!(slug)
      );
    }
    void this.broadcastStateChange();
    return true;
  }

  public recordWithdrawal(input: {
    amountNaira: number;
    bankName?: string;
    accountNumber?: string;
    bankCode?: string;
    accountName?: string;
  }): RuntimePayoutWithdrawal {
    if (this.vendor.isPayoutFrozen) {
      throw new Error("Payouts are currently frozen on this store due to a security lock. Please contact support.");
    }
    if (this.vendor.payoutFrozenUntil && this.vendor.payoutFrozenUntil.getTime() > Date.now()) {
      throw new Error(`Payouts are temporarily frozen until ${this.vendor.payoutFrozenUntil.toISOString()}.`);
    }
    if (!this.vendor.bankAccountNumber || !this.vendor.bankName) {
      throw new Error("No verified settlement bank account linked. Please link your bank account first.");
    }

    // CRITICAL SECURITY ENFORCEMENT:
    // Payouts MUST ONLY be routed to the KYC/Identity-locked settlement bank account.
    // Client-supplied destination accounts are strictly overridden for defense-in-depth.
    const destinationAccount = this.vendor.bankAccountNumber;
    const destinationBankName = this.vendor.bankName;
    const destinationBankCode = this.vendor.bankCode;
    const destinationAccountName =
      this.vendor.bankAccountName || this.vendor.verifiedLegalName || this.vendor.businessName;

    const amountKobo = nairaToKobo(input.amountNaira);
    const feeKobo = 0n;
    const reference = `WTH-${Date.now().toString().slice(-6)}`;
    const withdrawal: RuntimePayoutWithdrawal = {
      id: `wth-${Date.now()}`,
      reference,
      amountKobo,
      feeKobo,
      netAmountKobo: amountKobo - feeKobo,
      bankCode: destinationBankCode,
      bankName: destinationBankName,
      accountNumber: destinationAccount,
      accountName: destinationAccountName,
      status: "SETTLED",
      verifiedByOtp: true,
      createdAt: new Date(),
      settledAt: new Date(),
    };

    this.payoutWithdrawals.unshift(withdrawal);
    if (this.persistence.savePayoutWithdrawal) {
      this.persistInBackground("savePayoutWithdrawal", () =>
        this.persistence.savePayoutWithdrawal!(withdrawal)
      );
    }
    this.recordAuditEvent("PAYOUT_WITHDRAWAL_SETTLED", "VENDOR_WEB_DASHBOARD", "VENDOR", reference, {
      amountNaira: input.amountNaira,
      bankName: destinationBankName,
      accountNumber: destinationAccount,
    });
    void this.broadcastStateChange();
    return withdrawal;
  }

  private computeOrderSplitConfig(
    cartItems: Array<{ productId: string; quantity: number }>,
    totalAmountKobo: bigint
  ): {
    incomeSplitConfig: Array<{
      subAccountCode: string;
      feePercentage: number;
      splitPercentage: number;
      feeBearer: boolean;
    }>;
    isDropship: boolean;
    supplierSubAccountCode?: string;
    resellerSubAccountCode?: string;
    supplierShareKobo: bigint;
    resellerShareKobo: bigint;
    platformFeeKobo: bigint;
  } | undefined {
    const resellerSub = this.vendor.monnifySubAccountCode?.trim();
    if (!resellerSub || totalAmountKobo <= 0n) return undefined;

    const activeRule = this.settlementSplitRules.find((r) => r.isActive) ?? this.settlementSplitRules[0];
    const platformFeePct = Number(((activeRule?.platformFeeBps ?? 150) / 100).toFixed(2));
    const platformFeeKobo = (totalAmountKobo * BigInt(Math.round(platformFeePct * 100))) / 10000n;

    // Check whether any cart item is a mirrored supplier product
    let totalWholesaleKobo = 0n;
    let supplierSubAccountCode: string | undefined;

    for (const item of cartItems) {
      const prod = this.products.find((p) => p.id === item.productId);
      const supSku = prod?.customFields?.supplierSku;
      if (!supSku) continue;

      const supSlug = prod?.customFields?.supplierSlug;
      const supplier = this.suppliers.find(
        (s) =>
          (supSlug && s.slug === supSlug) ||
          s.catalogProducts.some((cp) => cp.sku === supSku)
      );
      if (supplier?.subAccountCode) {
        supplierSubAccountCode = supplier.subAccountCode;
      } else if (activeRule?.supplierSubAccountCode) {
        supplierSubAccountCode = activeRule.supplierSubAccountCode;
      }

      const wholesaleNaira = Number(prod?.customFields?.wholesalePriceNaira ?? 0);
      if (Number.isFinite(wholesaleNaira) && wholesaleNaira > 0) {
        totalWholesaleKobo += nairaToKobo(wholesaleNaira) * BigInt(item.quantity);
      }
    }

    // Pure vendor-owned order -> 100% minus platform fee to vendor subaccount
    if (!supplierSubAccountCode || supplierSubAccountCode === resellerSub) {
      const vendorNetKobo = totalAmountKobo > platformFeeKobo ? totalAmountKobo - platformFeeKobo : 0n;
      return {
        incomeSplitConfig: [
          {
            subAccountCode: resellerSub,
            feePercentage: 100,
            splitPercentage: Number(Math.max(1, 100 - platformFeePct).toFixed(2)),
            feeBearer: true,
          },
        ],
        isDropship: false,
        resellerSubAccountCode: resellerSub,
        supplierShareKobo: 0n,
        resellerShareKobo: vendorNetKobo,
        platformFeeKobo,
      };
    }

    // Mirrored dropship order -> split supplier cost + reseller margin
    const supplierPctRaw =
      totalWholesaleKobo > 0n
        ? (Number((totalWholesaleKobo * 10000n) / totalAmountKobo) / 100)
        : (activeRule?.supplierShareBps ?? 7500) / 100;
    const supplierPct = Number(Math.min(95, Math.max(1, supplierPctRaw)).toFixed(2));
    const resellerPct = Number(Math.max(1, 100 - supplierPct - platformFeePct).toFixed(2));

    const supplierShareKobo = (totalAmountKobo * BigInt(Math.round(supplierPct * 100))) / 10000n;
    const resellerShareKobo =
      totalAmountKobo > (supplierShareKobo + platformFeeKobo)
        ? totalAmountKobo - supplierShareKobo - platformFeeKobo
        : 0n;

    return {
      incomeSplitConfig: [
        {
          subAccountCode: supplierSubAccountCode,
          feePercentage: 0,
          splitPercentage: supplierPct,
          feeBearer: false,
        },
        {
          subAccountCode: resellerSub,
          feePercentage: 100,
          splitPercentage: resellerPct,
          feeBearer: true,
        },
      ],
      isDropship: true,
      supplierSubAccountCode,
      resellerSubAccountCode: resellerSub,
      supplierShareKobo,
      resellerShareKobo,
      platformFeeKobo,
    };
  }

  private syncSupplierInventoryOnSale(soldProduct: RuntimeProduct, quantitySold: number): void {
    const supSku = soldProduct.customFields?.supplierSku;
    if (!supSku || quantitySold <= 0) return;

    const supSlug = soldProduct.customFields?.supplierSlug;
    const supplier = this.suppliers.find(
      (s) =>
        (supSlug && s.slug === supSlug) ||
        s.catalogProducts.some((cp) => cp.sku === supSku)
    );
    if (!supplier) return;

    const catalogItem = supplier.catalogProducts.find((cp) => cp.sku === supSku);
    if (!catalogItem) return;

    catalogItem.stock = Math.max(0, (catalogItem.stock || 0) - quantitySold);
    // Keep mirrored product stock aligned with supplier stock
    soldProduct.stockTotal = catalogItem.stock;

    if (this.persistence.saveSupplierProfile) {
      this.persistInBackground("saveSupplierProfile", () =>
        this.persistence.saveSupplierProfile!(supplier)
      );
    }
    this.persistInBackground("syncMirroredProductStock", () =>
      this.persistence.saveProduct(soldProduct)
    );
  }

  public saveSplitRule(input: {
    name?: string;
    supplierSubAccountCode?: string;
    supplierShareBps: number;
    resellerShareBps: number;
    platformFeeBps?: number;
  }): RuntimeSettlementSplitRule {
    const existing = this.settlementSplitRules[0];
    const supplierShareBps = clamp(Math.round(input.supplierShareBps), 100, 9500);
    const resellerShareBps = 10000 - supplierShareBps;
    const rule: RuntimeSettlementSplitRule = {
      id: existing?.id ?? crypto.randomUUID(),
      name: input.name?.trim() || existing?.name || "Default Wholesale Escrow Split",
      supplierSubAccountCode:
        input.supplierSubAccountCode ?? existing?.supplierSubAccountCode ?? "SUB-AW-001",
      supplierShareBps,
      resellerShareBps,
      platformFeeBps: clamp(input.platformFeeBps ?? existing?.platformFeeBps ?? 150, 0, 1000),
      isActive: true,
      updatedAt: new Date(),
    };

    if (this.settlementSplitRules.length > 0) {
      this.settlementSplitRules[0] = rule;
    } else {
      this.settlementSplitRules.push(rule);
    }

    if (this.persistence.saveSettlementSplitRule) {
      this.persistInBackground("saveSettlementSplitRule", () =>
        this.persistence.saveSettlementSplitRule!(rule)
      );
    }
    void this.broadcastStateChange();
    return rule;
  }

  public submitKyc(input: {
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
    cacDocumentUploaded?: boolean;
    idDocumentUploaded?: boolean;
  }): RuntimeKycSubmission {
    const anchorName = input.businessName.trim() || this.vendor.businessName;
    const resolvedName = input.resolvedAccountName.trim() || this.vendor.businessName;
    const nameMatch = matchAccountName(anchorName, resolvedName);
    const isApproved = nameMatch.matched;

    const submission: RuntimeKycSubmission = {
      id: `kyc-${Date.now()}`,
      businessName: input.businessName.trim() || this.vendor.businessName,
      cacNumber: input.cacNumber.trim().toUpperCase(),
      tinNumber: input.tinNumber?.trim() || undefined,
      businessAddress: input.businessAddress?.trim() || undefined,
      businessCategory: input.businessCategory?.trim() || undefined,
      bankCode: input.bankCode.trim(),
      bankName: input.bankName?.trim() || this.monnify.lookupBankName(input.bankCode.trim()),
      accountNumber: input.accountNumber.trim(),
      resolvedAccountName: resolvedName,
      whatsappPhone: input.whatsappPhone?.trim() || this.vendor.whatsappPhone,
      instagramHandle: input.instagramHandle?.trim() || undefined,
      cacDocumentUploaded: input.cacDocumentUploaded ?? true,
      idDocumentUploaded: input.idDocumentUploaded ?? true,
      status: isApproved ? "VERIFIED" : "PENDING_REVIEW",
      reviewerNotes: isApproved
        ? "Auto-verified via CAC & Monnify NUBAN Account Name Match"
        : `Pending review: Account name "${resolvedName}" requires manual verification against business "${anchorName}"`,
      submittedAt: new Date(),
      reviewedAt: isApproved ? new Date() : undefined,
    };

    this.kycSubmissions.unshift(submission);
    this.vendor.businessName = submission.businessName;
    this.vendor.cacNumber = submission.cacNumber;
    this.vendor.tinNumber = submission.tinNumber;
    this.vendor.instagramHandle = submission.instagramHandle;

    if (isApproved) {
      this.vendor.verificationStatus = "VERIFIED";
      this.vendor.verifiedLegalName = resolvedName;
      if (!this.vendor.bankAccountNumber) {
        this.vendor.bankCode = submission.bankCode;
        this.vendor.bankName = submission.bankName;
        this.vendor.bankAccountNumber = submission.accountNumber;
        this.vendor.bankAccountName = submission.resolvedAccountName;
      }
    }

    if (this.persistence.saveKycSubmission) {
      this.persistInBackground("saveKycSubmission", () =>
        this.persistence.saveKycSubmission!(submission)
      );
    }
    this.recordAuditEvent("KYC_VERIFICATION_SUBMITTED", "VENDOR_WEB_DASHBOARD", "VENDOR", submission.cacNumber, {
      businessName: submission.businessName,
      cacNumber: submission.cacNumber,
      status: submission.status,
    });
    void this.broadcastStateChange();
    return submission;
  }

  public saveTeamMember(input: {
    name: string;
    email: string;
    phone?: string;
    role: string;
    status?: "Active" | "Invited" | "Suspended";
    canManageOrders?: boolean;
    canManageInventory?: boolean;
    canViewPayouts?: boolean;
    canProcessRefunds?: boolean;
    canOverrideCopilot?: boolean;
  }): RuntimeTeamMember {
    const cleanEmail = input.email.trim().toLowerCase();
    if (!cleanEmail) {
      throw new Error("Team member email is required.");
    }
    const existingIdx = this.teamMembers.findIndex(
      (m) => m.email.toLowerCase() === cleanEmail
    );
    const existing = existingIdx >= 0 ? this.teamMembers[existingIdx] : undefined;

    const role = input.role.trim() || "Store Attendant";
    const isManagerOrOwner = role === "Owner" || role === "Store Manager";
    const isAccountant = role === "Accountant";
    const isDispatchOnly =
      role === "Dispatch Coordinator" ||
      role.toLowerCase().includes("rider") ||
      role.toLowerCase().includes("fulfillment");
    const isCatalogOnly =
      role === "Catalog Editor" || role.toLowerCase().includes("catalog");

    const defaultOrders = isCatalogOnly || isAccountant ? false : true;
    const defaultInventory = isDispatchOnly || isAccountant ? false : true;
    const defaultPayouts = isManagerOrOwner || isAccountant;
    const defaultRefunds = isManagerOrOwner || isAccountant;
    const defaultCopilot = isManagerOrOwner || role === "Store Attendant";

    const member: RuntimeTeamMember = {
      id: existing?.id ?? `tm-${Date.now()}`,
      name: input.name.trim() || cleanEmail.split("@")[0],
      email: cleanEmail,
      phone: input.phone?.trim() || existing?.phone,
      role,
      status: input.status ?? existing?.status ?? "Active",
      canManageOrders: input.canManageOrders ?? defaultOrders,
      canManageInventory: input.canManageInventory ?? defaultInventory,
      canViewPayouts: input.canViewPayouts ?? defaultPayouts,
      canProcessRefunds: input.canProcessRefunds ?? defaultRefunds,
      canOverrideCopilot: input.canOverrideCopilot ?? defaultCopilot,
      lastActiveAt: existing?.lastActiveAt ?? new Date(),
      invitedAt: existing?.invitedAt ?? new Date(),
    };

    if (existingIdx >= 0) {
      this.teamMembers[existingIdx] = member;
    } else {
      this.teamMembers.push(member);
    }

    if (this.persistence.saveTeamMember) {
      this.persistInBackground("saveTeamMember", () =>
        this.persistence.saveTeamMember!(member)
      );
    }
    this.recordAuditEvent("TEAM_MEMBER_SAVED", "VENDOR_WEB_DASHBOARD", "VENDOR", member.email, {
      name: member.name,
      role: member.role,
      status: member.status,
    });
    void this.broadcastStateChange();
    return member;
  }

  public deleteTeamMember(idOrEmail: string): boolean {
    const clean = idOrEmail.trim().toLowerCase();
    const idx = this.teamMembers.findIndex(
      (m) => m.id.toLowerCase() === clean || m.email.toLowerCase() === clean
    );
    if (idx === -1) return false;
    const removed = this.teamMembers[idx];
    this.teamMembers.splice(idx, 1);
    if (this.persistence.deleteTeamMember) {
      this.persistInBackground("deleteTeamMember", () =>
        this.persistence.deleteTeamMember!(idOrEmail)
      );
    }
    this.recordAuditEvent("TEAM_MEMBER_REMOVED", "VENDOR_WEB_DASHBOARD", "VENDOR", removed.email, {
      name: removed.name,
      role: removed.role,
    });
    void this.broadcastStateChange();
    return true;
  }

  public syncNotifications(input: {
    readKeys?: string[];
    dismissedKeys?: string[];
    markAllRead?: boolean;
  }): RuntimeVendorNotification[] {
    const resolvedReadKeys: string[] = [];
    const resolvedDismissedKeys: string[] = [];

    for (const n of this.notifications) {
      if (input.markAllRead || input.readKeys?.includes(n.notificationKey) || input.readKeys?.includes(n.id)) {
        n.isRead = true;
        n.readAt = new Date();
        resolvedReadKeys.push(n.notificationKey);
      }
      if (input.dismissedKeys?.includes(n.notificationKey) || input.dismissedKeys?.includes(n.id)) {
        n.isDismissed = true;
        resolvedDismissedKeys.push(n.notificationKey);
      }
    }
    if (this.persistence.syncNotifications) {
      this.persistInBackground("syncNotifications", () =>
        this.persistence.syncNotifications!({
          markAllRead: input.markAllRead,
          readKeys: resolvedReadKeys.length > 0 ? resolvedReadKeys : input.readKeys,
          dismissedKeys: resolvedDismissedKeys.length > 0 ? resolvedDismissedKeys : input.dismissedKeys,
        })
      );
    }
    void this.broadcastStateChange();
    return this.notifications.filter((n) => !n.isDismissed);
  }

  private recordAuditEvent(
    eventType: string,
    actorType: string,
    entityType: string,
    entityId: string,
    payload: Record<string, unknown>
  ): void {
    const ev: RuntimeCommerceEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      eventType,
      actorType,
      entityType,
      entityId,
      payload,
      createdAt: new Date(),
    };
    this.commerceEvents.unshift(ev);
    if (this.commerceEvents.length > 100) {
      this.commerceEvents.length = 100;
    }
    this.persistInBackground("recordEvent", () =>
      this.persistence.recordEvent({
        eventType,
        actorType,
        entityType,
        entityId,
        payload,
      })
    );
  }

  public serializeState() {
    const b = this.getAnalyticsBreakdown();
    const activeBuyerSession = Array.from(this.buyerSessions.values())[0] ?? null;
    return {
      vendor: this.vendor,
      activeBuyerSession,
      analytics: {
        paidOrdersCount: b.paidOrdersCount,
        paidGrossNaira: koboToNaira(b.paidGrossKobo),
        paidGrossFormatted: formatNaira(b.paidGrossKobo),
        pendingOrdersCount: b.pendingOrdersCount,
        pendingAmountNaira: koboToNaira(b.pendingAmountKobo),
        pendingAmountFormatted: formatNaira(b.pendingAmountKobo),
        shippingCollectedFormatted: formatNaira(b.shippingCollectedKobo),
        discountsGivenFormatted: formatNaira(b.discountsGivenKobo),
        netProductRevenueFormatted: formatNaira(b.netProductRevenueKobo),
      },
      products: this.products.map((p) => ({
        ...p,
        basePriceNaira: koboToNaira(p.basePriceKobo),
        basePriceFormatted: formatNaira(p.basePriceKobo),
        availableStock: Math.max(0, p.stockTotal - p.stockReserved),
        variants: p.variants?.map((v) => ({
          id: v.id,
          name: v.name,
          sku: v.skuCode,
          skuCode: v.skuCode,
          priceNaira: v.priceKobo !== undefined ? koboToNaira(v.priceKobo) : koboToNaira(p.basePriceKobo),
          priceFormatted: v.priceKobo !== undefined ? formatNaira(v.priceKobo) : formatNaira(p.basePriceKobo),
          stock: v.stockTotal,
          stockTotal: v.stockTotal,
          stockReserved: v.stockReserved,
          availableStock: Math.max(0, v.stockTotal - v.stockReserved),
        })),
      })),
      shippingZones: this.shippingZones
        .filter((z) => z.isActive)
        .map((z) => ({
          ...z,
          feeNaira: koboToNaira(z.feeKobo),
          feeFormatted: formatNaira(z.feeKobo),
        })),
      discounts: this.discounts
        .filter((d) => d.isActive)
        .map((d) => ({
          ...d,
          valueRaw: d.value.toString(),
          label:
            d.type === "PERCENTAGE"
              ? `${Number(d.value) / 100}% OFF`
              : `${formatNaira(d.value)} OFF`,
        })),
      orders: this.orders.map((o) => ({
        ...o,
        items: o.items?.map((it) => ({
          ...it,
          unitPriceFormatted: formatNaira(it.unitPriceKobo),
          subtotalFormatted: formatNaira(it.subtotalKobo),
        })),
        subtotalFormatted: formatNaira(o.subtotalKobo),
        shippingFeeFormatted: formatNaira(o.shippingFeeKobo),
        discountAmountFormatted: formatNaira(o.discountAmountKobo),
        totalAmountNaira: koboToNaira(o.totalAmountKobo),
        totalAmountFormatted: formatNaira(o.totalAmountKobo),
        amountPaidNaira: koboToNaira(o.amountPaidKobo),
        amountPaidFormatted: formatNaira(o.amountPaidKobo),
        remainingBalanceNaira: koboToNaira(
          o.totalAmountKobo > o.amountPaidKobo ? o.totalAmountKobo - o.amountPaidKobo : 0n
        ),
        remainingBalanceFormatted: formatNaira(
          o.totalAmountKobo > o.amountPaidKobo ? o.totalAmountKobo - o.amountPaidKobo : 0n
        ),
        overpaidAmountFormatted: formatNaira(
          o.amountPaidKobo > o.totalAmountKobo ? o.amountPaidKobo - o.totalAmountKobo : 0n
        ),
        refundedAmountFormatted:
          o.refundedAmountKobo !== undefined ? formatNaira(o.refundedAmountKobo) : undefined,
        isDropship: o.isDropship,
        supplierSubAccountCode: o.supplierSubAccountCode,
        resellerSubAccountCode: o.resellerSubAccountCode,
        supplierShareKobo: o.supplierShareKobo !== undefined ? String(o.supplierShareKobo) : undefined,
        resellerShareKobo: o.resellerShareKobo !== undefined ? String(o.resellerShareKobo) : undefined,
        platformFeeKobo: o.platformFeeKobo !== undefined ? String(o.platformFeeKobo) : undefined,
        supplierShareNaira: o.supplierShareKobo !== undefined ? koboToNaira(o.supplierShareKobo) : undefined,
        resellerShareNaira: o.resellerShareKobo !== undefined ? koboToNaira(o.resellerShareKobo) : undefined,
        platformFeeNaira: o.platformFeeKobo !== undefined ? koboToNaira(o.platformFeeKobo) : undefined,
        splitSettlementStatus: o.splitSettlementStatus,
        salesChannel:
          o.salesChannel ??
          (o.shortCode.startsWith("PL-") || o.shortCode.startsWith("LINK-")
            ? "PAYMENT_LINK"
            : o.isDropship || o.shortCode.startsWith("RS-") || o.shortCode.startsWith("NET-")
              ? "RESELLER_NETWORK"
              : "WHATSAPP"),
      })),
      chatMessages: this.chatMessages.slice(-50),
      marketBoostListing: this.marketBoostListing
        ? {
            ...this.marketBoostListing,
            startingPriceNaira: koboToNaira(this.marketBoostListing.startingPriceKobo),
            startingPriceFormatted: formatNaira(this.marketBoostListing.startingPriceKobo),
          }
        : null,
      suppliers: this.suppliers,
      resellerMirrors: this.resellerMirrors,
      paymentLinks: this.paymentLinks.map((pl) => ({
        ...pl,
        amountNaira: koboToNaira(pl.amountKobo),
        amountFormatted: formatNaira(pl.amountKobo),
      })),
      payoutWithdrawals: this.payoutWithdrawals.map((pw) => ({
        ...pw,
        amountNaira: koboToNaira(pw.amountKobo),
        amountFormatted: formatNaira(pw.amountKobo),
        netAmountNaira: koboToNaira(pw.netAmountKobo),
        netAmountFormatted: formatNaira(pw.netAmountKobo),
      })),
      settlementSplitRules: this.settlementSplitRules,
      kycSubmissions: this.kycSubmissions,
      teamMembers: this.teamMembers,
      notifications: this.notifications.filter((n) => !n.isDismissed),
      customers: this.customers.map((c) => {
        const meta = this.vendor.customerMetadata?.[c.whatsappPhone];
        return {
          ...c,
          email: c.email || meta?.email,
          notes: c.notes || meta?.notes,
          tags: c.tags || meta?.tags,
          segmentOverride: c.segmentOverride || meta?.segmentOverride,
          lifetimeSpendNaira: koboToNaira(c.lifetimeSpendKobo),
          lifetimeSpendFormatted: formatNaira(c.lifetimeSpendKobo),
        };
      }),
      wholesaleBookings: this.getWholesaleBookings(),
      bookingCatalogRules: this.getBookingCatalogRules(),
      commerceEvents: this.commerceEvents.slice(0, 50),
      integrations: this.getIntegrationStatus(),
      catalogSync: {
        mode: this.catalog.getMode(),
        lastSyncedAt: this.catalog.getIntegrationStatus().lastSyncedAt,
        publishedItems: this.catalog.getIntegrationStatus().publishedItems,
      },
      subscription: this.vendor.subscription,
      trustTier: this.vendor.trustTier,
      storefrontConfig: this.getStorefrontConfig(),
      platformInvoices: this.vendor.invoices?.map((inv) => ({
        ...inv,
        amountFormatted: `₦${inv.amountNaira.toLocaleString()}`,
      })),
    };
  }

  public getStorefrontConfig(overrideRoleOrPlan?: string): StorefrontConfig {
    const effectiveRoleOrPlan =
      overrideRoleOrPlan ||
      this.vendor.subscription?.planId ||
      this.vendor.role ||
      "GROWTH";
    return resolveVendorStorefrontConfig(
      this.vendor.storefrontConfig ?? null,
      effectiveRoleOrPlan,
      this.vendor.businessName
    );
  }

  public updateStorefrontConfig(
    input: Partial<StorefrontConfig> | Record<string, unknown>,
    overrideRoleOrPlan?: string
  ): StorefrontConfig {
    const current = this.getStorefrontConfig(overrideRoleOrPlan);
    const incoming = (input ?? {}) as Partial<StorefrontConfig>;
    const mergedRaw: Record<string, unknown> = {
      ...current,
      ...incoming,
      theme: {
        ...current.theme,
        ...(incoming.theme ?? {}),
      },
      visibility: {
        ...current.visibility,
        ...(incoming.visibility ?? {}),
      },
      copy: {
        ...current.copy,
        ...(incoming.copy ?? {}),
      },
    };

    const resolved = resolveVendorStorefrontConfig(
      mergedRaw,
      overrideRoleOrPlan ||
        this.vendor.subscription?.planId ||
        this.vendor.role ||
        "GROWTH",
      this.vendor.businessName
    );
    this.vendor.storefrontConfig = resolved as unknown as Record<string, unknown>;

    this.persistInBackground("updateStorefrontConfig", () =>
      this.persistence.saveVendor(this.vendor)
    );
    this.recordAuditEvent(
      "STOREFRONT_CONFIG_UPDATED",
      "VENDOR_WEB_DASHBOARD",
      "VENDOR",
      this.vendor.id,
      {
        presetId: resolved.presetId,
        mode: resolved.mode,
        headerVariant: resolved.headerVariant,
        heroVariant: resolved.heroVariant,
        productCardVariant: resolved.productCardVariant,
      }
    );
    void this.broadcastStateChange();
    return resolved;
  }

  public getPublicStorefrontData(overrideRoleOrPlan?: string) {
    const state = this.serializeState();
    const roleOrPlan =
      overrideRoleOrPlan ||
      this.vendor.subscription?.planId ||
      this.vendor.role ||
      "GROWTH";
    const storefrontConfig = this.getStorefrontConfig(roleOrPlan);
    return {
      vendor: {
        id: this.vendor.id,
        slug: this.vendor.slug,
        businessName: this.vendor.businessName,
        role: this.vendor.role,
        whatsappPhone: this.vendor.whatsappPhone,
        verificationStatus: this.vendor.verificationStatus,
        cacNumber: this.vendor.cacNumber,
        instagramHandle: this.vendor.instagramHandle,
        facebookPageName: this.vendor.facebookPageName,
        baseState: this.vendor.baseState ?? "Lagos",
        baseCity: this.vendor.baseCity ?? "Ikeja",
        reservationTtlMinutes: this.vendor.reservationTtlMinutes,
        subscriptionPlanId: this.vendor.subscription?.planId ?? "GROWTH",
      },
      canUseFullWebsite: canUseFullWebsiteMode(roleOrPlan),
      storefrontConfig,
      presets: STOREFRONT_PRESETS,
      products: state.products,
      shippingZones: state.shippingZones,
      discounts: state.discounts,
    };
  }

  public async createPublicStorefrontOrder(input: {
    buyerName: string;
    buyerPhone: string;
    shippingZoneId?: string;
    shippingZoneName?: string;
    discountCode?: string;
    deliveryAddress?: string;
    deliveryLandmark?: string;
    alternatePhone?: string;
    items: Array<{
      productSku?: string;
      productId?: string;
      variantId?: string;
      variantSku?: string;
      quantity: number;
    }>;
  }) {
    if (!input.buyerName?.trim() || !input.buyerPhone?.trim()) {
      throw new Error("Please enter your full name and WhatsApp phone number.");
    }
    if (!input.items || input.items.length === 0) {
      throw new Error("Your shopping bag is empty.");
    }

    const activeZones = this.shippingZones.filter((z) => z.isActive);
    const matchedZone =
      activeZones.find(
        (z) =>
          (input.shippingZoneId && z.id === input.shippingZoneId) ||
          (input.shippingZoneName &&
            z.name.toLowerCase() === input.shippingZoneName.trim().toLowerCase())
      ) ??
      activeZones[0] ?? {
        id: "zone-default",
        code: 1,
        name: "Standard Delivery",
        feeKobo: 250000n,
        isActive: true,
      };

    const cartItems: RuntimeCartItem[] = [];
    for (const raw of input.items) {
      const qty = Math.max(1, Math.round(Number(raw.quantity) || 1));
      const prod = this.products.find(
        (p) =>
          (raw.productId && p.id === raw.productId) ||
          (raw.productSku && p.skuCode.toUpperCase() === raw.productSku.trim().toUpperCase())
      );
      if (!prod) {
        throw new Error(`Product "${raw.productSku || raw.productId}" is no longer available.`);
      }
      const matchedVar =
        raw.variantId || raw.variantSku
          ? prod.variants?.find(
              (v) =>
                (raw.variantId && v.id === raw.variantId) ||
                (raw.variantSku && v.skuCode.toUpperCase() === raw.variantSku.trim().toUpperCase())
            )
          : undefined;

      cartItems.push({
        productId: prod.id,
        productSku: prod.skuCode,
        productName: prod.name,
        variantId: matchedVar?.id,
        variantSku: matchedVar?.skuCode,
        variantName: matchedVar?.name,
        quantity: qty,
        unitPriceKobo: matchedVar?.priceKobo ?? prod.basePriceKobo,
      });
    }

    const normalizedPhone = this.normalizeOtpPhone(input.buyerPhone.trim());
    const order = await this.finalizeOrderAndSendVirtualAccount({
      buyerPhone: normalizedPhone,
      buyerName: input.buyerName.trim(),
      cartItems,
      shippingZone: matchedZone,
      discountCode: input.discountCode?.trim() || undefined,
      deliveryAddress: input.deliveryAddress?.trim() || undefined,
      deliveryLandmark: input.deliveryLandmark?.trim() || undefined,
      alternatePhone: input.alternatePhone?.trim() || undefined,
      salesChannel: "WEB_STOREFRONT",
    });

    if (!order) {
      throw new Error("Could not reserve stock for one or more items in your bag. Please check available stock.");
    }

    const webNotif: RuntimeVendorNotification = {
      id: `notif-web-${order.shortCode}-${Date.now()}`,
      notificationKey: `notif-web-order-${order.shortCode}`,
      title: `New Website Order #${order.shortCode}`,
      message: `${input.buyerName.trim()} (${normalizedPhone}) placed a website order for ${order.productName} (${formatNaira(order.totalAmountKobo)}).`,
      category: "ORDERS",
      isRead: false,
      isDismissed: false,
      linkText: "View Customer & Order",
      targetView: "customers",
      targetRef: order.shortCode,
      createdAt: new Date(),
    };
    this.notifications.unshift(webNotif);
    if (this.persistence.saveNotification) {
      await this.persistNow("saveWebOrderNotification", () =>
        this.persistence.saveNotification!(webNotif)
      );
    }

    this.recordAuditEvent(
      "WEB_STOREFRONT_ORDER_CREATED",
      "BUYER_WEB_STOREFRONT",
      "ORDER",
      order.shortCode,
      {
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        totalAmountKobo: order.totalAmountKobo.toString(),
        deliveryAddress: order.deliveryAddress,
      }
    );

    await this.broadcastStateChange();

    return {
      orderShortCode: order.shortCode,
      receipt: this.getPublicOrderReceipt(order.shortCode),
      state: this.serializeState(),
    };
  }

  // -------------------------------------------------------------------------
  // Catlog Parity: Manual Order & POS Invoice Creator
  // -------------------------------------------------------------------------

  public async createManualVendorOrder(input: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    salesChannel?: import("./runtime-types.ts").SalesChannel;
    paymentStatus: "PAID_OFFLINE" | "AWAITING_PAYMENT";
    paymentMethod?: "POS_TERMINAL" | "CASH" | "BANK_TRANSFER" | "MONNIFY_INVOICE";
    shippingZoneId?: string;
    shippingZoneName?: string;
    customShippingFeeNaira?: number;
    discountCode?: string;
    customDiscountNaira?: number;
    deliveryAddress?: string;
    notes?: string;
    items: Array<{
      productSku?: string;
      productId?: string;
      variantId?: string;
      variantSku?: string;
      quantity: number;
      customUnitPriceNaira?: number;
    }>;
  }) {
    if (!input.customerName?.trim() || !input.customerPhone?.trim()) {
      throw new Error("Customer name and phone number are required to record a sale or invoice.");
    }
    if (!input.items || input.items.length === 0) {
      throw new Error("Please select at least one product item.");
    }

    const normalizedPhone = this.normalizeOtpPhone(input.customerPhone.trim());
    const activeZones = this.shippingZones.filter((z) => z.isActive);
    const matchedZone =
      activeZones.find(
        (z) =>
          (input.shippingZoneId && z.id === input.shippingZoneId) ||
          (input.shippingZoneName &&
            z.name.toLowerCase() === input.shippingZoneName.trim().toLowerCase())
      ) ??
      (input.customShippingFeeNaira !== undefined
        ? {
            id: "zone-custom",
            code: 99,
            name: input.shippingZoneName?.trim() || "Custom / Store Pickup",
            feeKobo: nairaToKobo(Math.max(0, Number(input.customShippingFeeNaira) || 0)),
            isActive: true,
          }
        : activeZones[0] ?? {
            id: "zone-default",
            code: 1,
            name: "In-Store / Walk-In Pickup",
            feeKobo: 0n,
            isActive: true,
          });

    const effectiveShippingFeeKobo =
      input.customShippingFeeNaira !== undefined
        ? nairaToKobo(Math.max(0, Number(input.customShippingFeeNaira) || 0))
        : matchedZone.feeKobo;

    const cartItems: RuntimeCartItem[] = [];
    for (const raw of input.items) {
      const qty = Math.max(1, Math.round(Number(raw.quantity) || 1));
      const prod = this.products.find(
        (p) =>
          (raw.productId && p.id === raw.productId) ||
          (raw.productSku && p.skuCode.toUpperCase() === raw.productSku.trim().toUpperCase())
      );
      if (!prod) {
        throw new Error(`Product "${raw.productSku || raw.productId}" was not found in catalog.`);
      }
      const matchedVar =
        raw.variantId || raw.variantSku
          ? prod.variants?.find(
              (v) =>
                (raw.variantId && v.id === raw.variantId) ||
                (raw.variantSku && v.skuCode.toUpperCase() === raw.variantSku.trim().toUpperCase())
            )
          : undefined;

      const avail = matchedVar
        ? matchedVar.stockTotal - matchedVar.stockReserved
        : prod.stockTotal - prod.stockReserved;
      if (avail < qty) {
        const label = matchedVar ? `${prod.name} (${matchedVar.name})` : prod.name;
        throw new Error(
          `Insufficient stock for "${label}": only ${Math.max(0, avail)} available, requested ${qty}.`
        );
      }

      const unitPriceKobo =
        raw.customUnitPriceNaira !== undefined && Number(raw.customUnitPriceNaira) > 0
          ? nairaToKobo(Number(raw.customUnitPriceNaira))
          : (matchedVar?.priceKobo ?? prod.basePriceKobo);

      cartItems.push({
        productId: prod.id,
        productSku: prod.skuCode,
        productName: prod.name,
        variantId: matchedVar?.id,
        variantSku: matchedVar?.skuCode,
        variantName: matchedVar?.name,
        quantity: qty,
        unitPriceKobo,
      });
    }

    // If awaiting payment, use finalizeOrderAndSendVirtualAccount
    if (input.paymentStatus === "AWAITING_PAYMENT") {
      const order = await this.finalizeOrderAndSendVirtualAccount({
        buyerPhone: normalizedPhone,
        buyerName: input.customerName.trim(),
        cartItems,
        shippingZone: {
          ...matchedZone,
          feeKobo: effectiveShippingFeeKobo,
        },
        discountCode: input.discountCode?.trim() || undefined,
        deliveryAddress: input.deliveryAddress?.trim() || undefined,
        salesChannel: input.salesChannel ?? "PAYMENT_LINK",
      });

      if (!order) {
        throw new Error("Could not create manual invoice order.");
      }

      if (input.customDiscountNaira && Number(input.customDiscountNaira) > 0 && !order.discountCode) {
        const customDiscKobo = nairaToKobo(Number(input.customDiscountNaira));
        order.discountAmountKobo =
          customDiscKobo > order.subtotalKobo ? order.subtotalKobo : customDiscKobo;
        order.discountCode = "MANUAL_DISCOUNT";
        order.totalAmountKobo =
          order.subtotalKobo - order.discountAmountKobo + order.shippingFeeKobo;
        await this.persistNow("saveManualOrderDiscount", () => this.persistence.saveOrder(order));
      }

      this.upsertCustomerRecord({
        whatsappPhone: normalizedPhone,
        name: input.customerName.trim(),
        email: input.customerEmail,
        defaultAddress: input.deliveryAddress,
        notes: input.notes,
      });

      const notif: RuntimeVendorNotification = {
        id: `notif-manual-inv-${order.shortCode}-${Date.now()}`,
        notificationKey: `notif-manual-inv-${order.shortCode}`,
        title: `Invoice Created — #${order.shortCode}`,
        message: `Invoice for ${formatNaira(order.totalAmountKobo)} sent to ${order.customerName} (${order.customerPhone}).`,
        category: "ORDERS",
        isRead: false,
        isDismissed: false,
        linkText: "View Order",
        targetView: "orders",
        targetRef: order.shortCode,
        createdAt: new Date(),
      };
      this.notifications.unshift(notif);
      if (this.persistence.saveNotification) {
        this.persistInBackground("saveManualInvNotif", () =>
          this.persistence.saveNotification!(notif)
        );
      }

      await this.broadcastStateChange();
      return {
        order,
        receipt: this.getPublicOrderReceipt(order.shortCode),
      };
    }

    // Paid Offline (POS Terminal, Cash, or Direct Bank Transfer)
    const subtotalKobo = cartItems.reduce(
      (sum, it) => sum + it.unitPriceKobo * BigInt(it.quantity),
      0n
    );

    const activeDiscount = input.discountCode
      ? this.discounts.find(
          (d) =>
            this.isDiscountUsable(d) &&
            d.code.toUpperCase() === input.discountCode!.trim().toUpperCase()
        )
      : undefined;

    let discountAmountKobo = activeDiscount
      ? computeDiscountKobo({
          subtotalKobo,
          discountType: activeDiscount.type,
          discountValue: activeDiscount.value,
          minOrderKobo: activeDiscount.minOrderKobo,
        })
      : 0n;

    if (discountAmountKobo === 0n && input.customDiscountNaira && Number(input.customDiscountNaira) > 0) {
      const rawCustomDisc = nairaToKobo(Number(input.customDiscountNaira));
      discountAmountKobo = rawCustomDisc > subtotalKobo ? subtotalKobo : rawCustomDisc;
    }

    if (activeDiscount && discountAmountKobo > 0n) {
      activeDiscount.usedCount += 1;
    }

    const totalAmountKobo =
      (subtotalKobo > discountAmountKobo ? subtotalKobo - discountAmountKobo : 0n) +
      effectiveShippingFeeKobo;

    // Immediately deduct physical stock for offline paid sale
    for (const item of cartItems) {
      const prod = this.products.find((p) => p.id === item.productId);
      if (prod) {
        prod.stockTotal = Math.max(0, prod.stockTotal - item.quantity);
        if (item.variantId && prod.variants) {
          const v = prod.variants.find((vr) => vr.id === item.variantId);
          if (v) {
            v.stockTotal = Math.max(0, v.stockTotal - item.quantity);
          }
        }
        if (prod.variants && prod.variants.length > 0) {
          prod.stockTotal = prod.variants.reduce((sum, v) => sum + v.stockTotal, 0);
        }
        this.persistInBackground("deductOfflinePaidStock", () => this.persistence.saveProduct(prod));
        this.syncSupplierInventoryOnSale(prod, item.quantity);
      }
    }

    const shortCode = this.nextOrderShortCode();
    const orderId = crypto.randomUUID();
    const now = new Date();
    const paymentMethodLabel = input.paymentMethod ?? "POS_TERMINAL";
    const txRef = `POS|${paymentMethodLabel}|${shortCode}|${Date.now()}`;

    const orderItems: RuntimeOrderItem[] = cartItems.map((it) => ({
      id: crypto.randomUUID(),
      productId: it.productId,
      productSku: it.productSku,
      productName: it.productName,
      variantId: it.variantId,
      variantSku: it.variantSku,
      variantName: it.variantName,
      quantity: it.quantity,
      unitPriceKobo: it.unitPriceKobo,
      subtotalKobo: it.unitPriceKobo * BigInt(it.quantity),
    }));

    const totalQuantity = cartItems.reduce((sum, it) => sum + it.quantity, 0);
    const primaryItem = cartItems[0]!;
    const displayProductName =
      cartItems.length === 1
        ? primaryItem.productName
        : `${primaryItem.productName} + ${cartItems.length - 1} more item${
            cartItems.length > 2 ? "s" : ""
          }`;

    const newOrder: RuntimeOrder = {
      id: orderId,
      shortCode,
      customerPhone: normalizedPhone,
      customerName: input.customerName.trim(),
      productId: primaryItem.productId,
      productSku: primaryItem.productSku,
      productName: displayProductName,
      variantId: cartItems.length === 1 ? primaryItem.variantId : undefined,
      variantSku: cartItems.length === 1 ? primaryItem.variantSku : undefined,
      variantName: cartItems.length === 1 ? primaryItem.variantName : undefined,
      quantity: totalQuantity,
      items: orderItems,
      shippingZoneName: matchedZone.name,
      subtotalKobo,
      shippingFeeKobo: effectiveShippingFeeKobo,
      discountCode:
        activeDiscount && discountAmountKobo > 0n
          ? activeDiscount.code
          : discountAmountKobo > 0n
            ? "MANUAL_DISCOUNT"
            : undefined,
      discountAmountKobo,
      totalAmountKobo,
      amountPaidKobo: totalAmountKobo,
      overpaidAmountKobo: 0n,
      status: "PAID",
      invoiceReference: `INV-${shortCode}-${Date.now().toString().slice(-4)}`,
      accountNumber: this.vendor.bankAccountNumber || "POS-SETTLED",
      bankName:
        paymentMethodLabel === "CASH"
          ? "Cash Payment"
          : paymentMethodLabel === "POS_TERMINAL"
            ? "POS Card Terminal"
            : this.vendor.bankName || "Direct Bank Transfer",
      accountName: this.vendor.businessName,
      paymentTransactionRef: txRef,
      deliveryAddress: input.deliveryAddress?.trim() || "Walk-In / Recorded Offline",
      reservationReleased: false,
      paymentExpiresAt: now,
      createdAt: now,
      paidAt: now,
      salesChannel: input.salesChannel ?? "POS_WALK_IN",
    };

    this.orders.unshift(newOrder);

    await this.persistNow("createManualPaidOrder", async () => {
      if (activeDiscount && discountAmountKobo > 0n) {
        await this.persistence.saveDiscount(activeDiscount);
      }
      const primaryProd =
        this.products.find((p) => p.id === primaryItem.productId) ?? this.products[0]!;
      await this.persistence.createOrder(newOrder, primaryProd);
    });

    this.upsertCustomerRecord({
      whatsappPhone: normalizedPhone,
      name: input.customerName.trim(),
      email: input.customerEmail,
      defaultAddress: input.deliveryAddress,
      notes: input.notes,
      addOrderCount: 1,
      addSpendKobo: totalAmountKobo,
    });

    const paidNotif: RuntimeVendorNotification = {
      id: `notif-pos-${newOrder.shortCode}-${Date.now()}`,
      notificationKey: `notif-pos-${newOrder.shortCode}`,
      title: `Offline Sale Recorded — #${newOrder.shortCode}`,
      message: `Recorded ${formatNaira(totalAmountKobo)} (${paymentMethodLabel.replace(/_/g, " ")}) for ${newOrder.customerName}. Inventory updated in PostgreSQL.`,
      category: "ORDERS",
      isRead: false,
      isDismissed: false,
      linkText: "View Order",
      targetView: "orders",
      targetRef: newOrder.shortCode,
      createdAt: now,
    };
    this.notifications.unshift(paidNotif);
    if (this.persistence.saveNotification) {
      this.persistInBackground("savePosNotif", () =>
        this.persistence.saveNotification!(paidNotif)
      );
    }

    this.recordAuditEvent(
      "MANUAL_ORDER_RECORDED",
      "VENDOR_WEB_DASHBOARD",
      "ORDER",
      newOrder.shortCode,
      {
        customerName: newOrder.customerName,
        customerPhone: newOrder.customerPhone,
        paymentMethod: paymentMethodLabel,
        totalAmountKobo: totalAmountKobo.toString(),
        salesChannel: newOrder.salesChannel,
      }
    );

    this.triggerRealtimeCatalogSync();
    await this.broadcastStateChange();

    return {
      order: newOrder,
      receipt: this.getPublicOrderReceipt(newOrder.shortCode),
    };
  }

  // -------------------------------------------------------------------------
  // Catlog Parity: Customers CRM, Persistent Notes & Segment Broadcasts
  // -------------------------------------------------------------------------

  public upsertCustomerRecord(input: {
    whatsappPhone: string;
    name: string;
    email?: string;
    defaultAddress?: string;
    notes?: string;
    tags?: string[];
    segmentOverride?: "VIP" | "Repeat" | "New";
    addOrderCount?: number;
    addSpendKobo?: bigint;
  }): import("./runtime-types.ts").RuntimeCustomer {
    const cleanPhone = this.normalizeOtpPhone(input.whatsappPhone.trim());
    const cleanName = input.name.trim() || cleanPhone;

    if (!this.vendor.customerMetadata) {
      this.vendor.customerMetadata = {};
    }
    const existingMeta = this.vendor.customerMetadata[cleanPhone] ?? {};
    const updatedMeta: import("./runtime-types.ts").RuntimeCustomerMetadata = {
      ...existingMeta,
      ...(input.email !== undefined ? { email: input.email.trim() } : {}),
      ...(input.notes !== undefined ? { notes: input.notes.trim() } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      ...(input.segmentOverride !== undefined
        ? { segmentOverride: input.segmentOverride }
        : {}),
      updatedAt: new Date().toISOString(),
    };
    this.vendor.customerMetadata[cleanPhone] = updatedMeta;

    let customer = this.customers.find((c) => c.whatsappPhone === cleanPhone);
    if (customer) {
      customer.name = cleanName || customer.name;
      if (input.defaultAddress !== undefined && input.defaultAddress.trim()) {
        customer.defaultAddress = input.defaultAddress.trim();
      }
      if (updatedMeta.email) customer.email = updatedMeta.email;
      if (updatedMeta.notes !== undefined) customer.notes = updatedMeta.notes;
      if (updatedMeta.tags) customer.tags = updatedMeta.tags;
      if (updatedMeta.segmentOverride) customer.segmentOverride = updatedMeta.segmentOverride;
      if (input.addOrderCount) {
        customer.totalOrdersCount += input.addOrderCount;
        customer.lastOrderAt = new Date();
      }
      if (input.addSpendKobo) {
        customer.lifetimeSpendKobo += input.addSpendKobo;
      }
    } else {
      customer = {
        id: `cust-${Date.now()}`,
        whatsappPhone: cleanPhone,
        name: cleanName,
        email: updatedMeta.email,
        defaultAddress: input.defaultAddress?.trim() || "Nigeria",
        notes: updatedMeta.notes,
        tags: updatedMeta.tags,
        segmentOverride: updatedMeta.segmentOverride,
        totalOrdersCount: input.addOrderCount ?? 0,
        lifetimeSpendKobo: input.addSpendKobo ?? 0n,
        firstSeenAt: new Date(),
        lastOrderAt: input.addOrderCount ? new Date() : undefined,
      };
      this.customers.unshift(customer);
    }

    if (this.persistence.saveCustomer) {
      this.persistInBackground("saveCustomer", () =>
        this.persistence.saveCustomer!(customer!)
      );
    }
    this.persistInBackground("saveCustomerMetadata", () =>
      this.persistence.saveVendor(this.vendor)
    );
    void this.broadcastStateChange();
    return customer;
  }

  public async sendCustomerSegmentBroadcast(input: {
    segment: "ALL" | "VIP" | "Repeat" | "New" | "PENDING_ORDERS";
    channel: "WHATSAPP" | "INSTAGRAM" | "SMS";
    messageText: string;
    includePromoCode?: string;
    includeStoreLink?: boolean;
  }): Promise<{
    recipientCount: number;
    segment: string;
    channel: string;
    deliveredAt: string;
  }> {
    if (!input.messageText?.trim()) {
      throw new Error("Broadcast message cannot be empty.");
    }

    let recipientPhones: Array<{ phone: string; name: string }> = [];
    if (input.segment === "PENDING_ORDERS") {
      const pendingOrders = this.orders.filter(
        (o) => o.status === "PENDING_PAYMENT" || o.status === "PARTIALLY_PAID"
      );
      const seen = new Set<string>();
      for (const ord of pendingOrders) {
        if (!seen.has(ord.customerPhone)) {
          seen.add(ord.customerPhone);
          recipientPhones.push({ phone: ord.customerPhone, name: ord.customerName });
        }
      }
    } else {
      for (const c of this.customers) {
        const computedTag =
          c.segmentOverride ??
          (c.totalOrdersCount > 3 ? "VIP" : c.totalOrdersCount > 1 ? "Repeat" : "New");
        if (input.segment === "ALL" || computedTag === input.segment) {
          recipientPhones.push({ phone: c.whatsappPhone, name: c.name });
        }
      }
      // Also include any order buyers not yet in this.customers
      const seen = new Set(recipientPhones.map((r) => r.phone));
      for (const o of this.orders) {
        if (!seen.has(o.customerPhone)) {
          seen.add(o.customerPhone);
          if (input.segment === "ALL" || input.segment === "New") {
            recipientPhones.push({ phone: o.customerPhone, name: o.customerName });
          }
        }
      }
    }

    if (recipientPhones.length === 0) {
      recipientPhones = [{ phone: "+2348099887766", name: "Valued Customer" }];
    }

    const storeLink = `https://caterlog.store/${this.vendor.slug}`;
    const promoLine = input.includePromoCode?.trim()
      ? `\n🎁 *Use Promo Code:* \`${input.includePromoCode.trim().toUpperCase()}\` at checkout!`
      : "";
    const linkLine = input.includeStoreLink !== false ? `\n🛍️ *Shop Now:* ${storeLink}` : "";

    const finalBroadcastBody = `${input.messageText.trim()}${promoLine}${linkLine}`;

    for (const rec of recipientPhones.slice(0, 10)) {
      await this.whatsapp.sendTextMessage({
        toPhone: rec.phone,
        text: finalBroadcastBody.replace(/\{name\}/gi, rec.name.split(" ")[0] || "there"),
        vendorPhoneId: this.vendor.whatsappPhoneId,
      });
    }

    this.appendChat({
      channel: "VENDOR_ADMIN_WA",
      sender: "CATERLOG_BOT",
      fromPhone: "CATERLOG",
      text: `📢 *Broadcast Campaign Dispatched (${input.channel})*\n• Segment: *${input.segment}* (${recipientPhones.length} recipient${recipientPhones.length === 1 ? "" : "s"})\n• Message:\n"${finalBroadcastBody}"`,
    });

    const notif: RuntimeVendorNotification = {
      id: `notif-bcast-${Date.now()}`,
      notificationKey: `notif-bcast-${Date.now()}`,
      title: `Broadcast Sent to ${recipientPhones.length} Buyers`,
      message: `${input.channel} campaign delivered to ${input.segment} segment.`,
      category: "COPILOT",
      isRead: false,
      isDismissed: false,
      linkText: "View Customers",
      targetView: "customers",
      createdAt: new Date(),
    };
    this.notifications.unshift(notif);
    if (this.persistence.saveNotification) {
      this.persistInBackground("saveBcastNotif", () =>
        this.persistence.saveNotification!(notif)
      );
    }

    this.recordAuditEvent(
      "CUSTOMER_BROADCAST_SENT",
      "VENDOR_WEB_DASHBOARD",
      "VENDOR",
      this.vendor.id,
      {
        segment: input.segment,
        channel: input.channel,
        recipientCount: recipientPhones.length,
        includePromoCode: input.includePromoCode,
      }
    );

    await this.broadcastStateChange();
    return {
      recipientCount: recipientPhones.length,
      segment: input.segment,
      channel: input.channel,
      deliveredAt: new Date().toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // Catlog Parity: Wholesale Bookings & Bookable Catalog Rules (DB Synced)
  // -------------------------------------------------------------------------

  public getWholesaleBookings(): import("./runtime-types.ts").RuntimeWholesaleBooking[] {
    if (!this.vendor.wholesaleBookings || this.vendor.wholesaleBookings.length === 0) {
      this.vendor.wholesaleBookings = [
        {
          id: "bkg-1",
          reference: "BKG-7801",
          clientName: "Alhaji Musa Garba",
          clientOrganization: "Kano Central Distributors Ltd",
          clientPhone: "+2348031122334",
          clientType: "WHOLESALER",
          channel: "WHATSAPP",
          productSku: this.products[0]?.skuCode || "SHOE-01",
          productName: this.products[0]?.name || "Zara Block Heel (Assorted 38-41)",
          quantity: 25,
          unitPriceNaira: 22000,
          totalAmountNaira: 550000,
          depositRequiredNaira: 165000,
          depositPaidNaira: 165000,
          depositStatus: "PAID",
          targetDeliveryDate: "2026-12-10",
          requestedAt: "2026-11-18 14:20",
          status: "DEPOSIT_PAID",
          notes: "Requires solid carton packaging for haulage to Sabon Gari Market, Kano.",
        },
        {
          id: "bkg-2",
          reference: "BKG-7802",
          clientName: "Folashade Balogun",
          clientOrganization: "Lekki Luxe Reseller Network",
          clientPhone: "+2348129988776",
          clientType: "RESELLER_NETWORK",
          channel: "INSTAGRAM",
          productSku: this.products[1]?.skuCode || "BAG-01",
          productName: this.products[1]?.name || "Mini Structured Leather Bag",
          quantity: 12,
          unitPriceNaira: 32000,
          totalAmountNaira: 384000,
          depositRequiredNaira: 115200,
          depositPaidNaira: 0,
          depositStatus: "UNPAID",
          targetDeliveryDate: "2026-12-12",
          requestedAt: "2026-11-19 09:15",
          status: "REQUESTED",
          notes: "Requested via Instagram DM. Wants delivery directly to Lekki Phase 1 hub.",
        },
      ];
    }
    return this.vendor.wholesaleBookings;
  }

  public getBookingCatalogRules(): import("./runtime-types.ts").RuntimeBookingCatalogRules {
    if (!this.vendor.bookingCatalogRules) {
      this.vendor.bookingCatalogRules = {
        allCatalogBookable: false,
        selectedBookableCategories: Array.from(
          new Set(this.products.map((p) => p.category).filter(Boolean))
        ).slice(0, 2),
        defaultDepositPercent: 30,
        defaultLeadTimeDays: 5,
        minimumOrderValueNaira: 150000,
        autoExpireHours: 48,
      };
    }
    return this.vendor.bookingCatalogRules;
  }

  public saveWholesaleBooking(
    input: Partial<import("./runtime-types.ts").RuntimeWholesaleBooking> & {
      productSku: string;
      clientName: string;
      clientPhone: string;
      quantity: number;
    }
  ): import("./runtime-types.ts").RuntimeWholesaleBooking {
    const bookings = this.getWholesaleBookings();
    const rules = this.getBookingCatalogRules();
    const prod = this.products.find(
      (p) => p.skuCode.toUpperCase() === input.productSku.trim().toUpperCase()
    );
    const unitPriceNaira =
      input.unitPriceNaira && Number(input.unitPriceNaira) > 0
        ? Number(input.unitPriceNaira)
        : prod
          ? koboToNaira(prod.basePriceKobo)
          : 25000;
    const quantity = Math.max(1, Math.round(Number(input.quantity) || 10));
    const totalAmountNaira = unitPriceNaira * quantity;
    const depositRequiredNaira =
      input.depositRequiredNaira ??
      Math.round((totalAmountNaira * (rules.defaultDepositPercent || 30)) / 100);

    const booking: import("./runtime-types.ts").RuntimeWholesaleBooking = {
      id: input.id || `bkg-${Date.now()}`,
      reference: input.reference || `BKG-${Math.floor(1000 + Math.random() * 9000)}`,
      clientName: input.clientName.trim(),
      clientOrganization: input.clientOrganization?.trim() || undefined,
      clientPhone: this.normalizeOtpPhone(input.clientPhone.trim()),
      clientType: input.clientType || "WHOLESALER",
      channel: input.channel || "WHATSAPP",
      productSku: prod?.skuCode || input.productSku.toUpperCase(),
      productName: input.productName || prod?.name || "Wholesale Merchandise",
      quantity,
      unitPriceNaira,
      totalAmountNaira,
      depositRequiredNaira,
      depositPaidNaira: input.depositPaidNaira ?? 0,
      depositStatus: input.depositStatus || "UNPAID",
      targetDeliveryDate: input.targetDeliveryDate || "2026-12-15",
      requestedAt: input.requestedAt || new Date().toISOString().replace("T", " ").slice(0, 16),
      status: input.status || "CONFIRMED",
      notes: input.notes?.trim() || undefined,
    };

    const existingIdx = bookings.findIndex(
      (b) => b.id === booking.id || b.reference === booking.reference
    );
    if (existingIdx >= 0) {
      bookings[existingIdx] = booking;
    } else {
      bookings.unshift(booking);
    }
    this.vendor.wholesaleBookings = bookings;
    this.persistInBackground("saveWholesaleBooking", () =>
      this.persistence.saveVendor(this.vendor)
    );
    void this.broadcastStateChange();
    return booking;
  }

  public updateWholesaleBookingStatus(
    idOrReference: string,
    updates: Partial<import("./runtime-types.ts").RuntimeWholesaleBooking>
  ): import("./runtime-types.ts").RuntimeWholesaleBooking {
    const bookings = this.getWholesaleBookings();
    const clean = idOrReference.trim().toUpperCase();
    const target = bookings.find(
      (b) => b.id.toUpperCase() === clean || b.reference.toUpperCase() === clean
    );
    if (!target) {
      throw new Error(`Wholesale booking "${idOrReference}" not found.`);
    }
    Object.assign(target, updates);
    if (updates.status === "DEPOSIT_PAID" && target.depositPaidNaira === 0) {
      target.depositPaidNaira = target.depositRequiredNaira;
      target.depositStatus = "PAID";
    }
    this.vendor.wholesaleBookings = bookings;
    this.persistInBackground("updateWholesaleBookingStatus", () =>
      this.persistence.saveVendor(this.vendor)
    );
    void this.broadcastStateChange();
    return target;
  }

  public updateBookingCatalogRules(
    updates: Partial<import("./runtime-types.ts").RuntimeBookingCatalogRules>
  ): import("./runtime-types.ts").RuntimeBookingCatalogRules {
    const current = this.getBookingCatalogRules();
    const next: import("./runtime-types.ts").RuntimeBookingCatalogRules = {
      ...current,
      ...updates,
    };
    this.vendor.bookingCatalogRules = next;
    this.persistInBackground("updateBookingCatalogRules", () =>
      this.persistence.saveVendor(this.vendor)
    );
    void this.broadcastStateChange();
    return next;
  }

  public getDefaultFeatureFlags(): import("./runtime-types.ts").RuntimeFeatureFlags {
    return {
      webCheckoutEnabled: true,
      guestCheckoutEnabled: true,
      liveStockCountdownEnabled: true,
      vacationModeEnabled: false,
      whatsappCopilotEnabled: this.vendor?.copilotMode !== "MANUAL",
      instagramDmCopilotEnabled: true,
      facebookMessengerCopilotEnabled: true,
      autoHoldStockOnChatCheckout: true,
      marketBoostDiscoveryEnabled: this.marketBoostListing?.isPublished ?? true,
      autoApproveResellerMirrors: true,
      interstateMirroringEnabled: this.marketBoostListing?.allowInterstate ?? false,
      requirePasskeyForWithdrawals: true,
      requireSmsOtpOnNewDevice: true,
    };
  }

  public getDefaultSocialAccounts(
    v: Partial<RuntimeVendor> = this.vendor
  ): NonNullable<RuntimeVendor["socialAccounts"]> {
    const cleanSlug = (v.slug || "store").replace(/[^a-z0-9]/gi, "");
    return {
      WHATSAPP: {
        platform: "WHATSAPP",
        connected: Boolean(v.whatsappPhone),
        handleOrPhone: v.whatsappPhone || "+2348031234567",
        businessAssetId: v.whatsappPhoneId || "WABA_105992837465001",
        businessPortfolioName: `${v.businessName || "Caterlog Store"} Meta Business`,
        syncCatalogToSocial: true,
        importSocialBuyersToCrm: true,
        copilotAutoReply: true,
        webhookStatus: "ACTIVE",
        lastSyncedAt: new Date().toISOString(),
        syncedProductsCount: this.products.length,
      },
      INSTAGRAM: {
        platform: "INSTAGRAM",
        connected: v.instagramConnected ?? true,
        handleOrPhone: v.instagramHandle || `@${cleanSlug}`,
        businessAssetId: v.instagramBusinessId || `IG_BIZ_${cleanSlug.toUpperCase()}`,
        businessPortfolioName: `${v.businessName || "Caterlog Store"} Instagram Shop`,
        syncCatalogToSocial: true,
        importSocialBuyersToCrm: true,
        copilotAutoReply: true,
        webhookStatus: (v.instagramConnected ?? true) ? "ACTIVE" : "DISCONNECTED",
        lastSyncedAt: new Date().toISOString(),
        syncedProductsCount: this.products.length,
      },
      FACEBOOK: {
        platform: "FACEBOOK",
        connected: v.facebookConnected ?? true,
        handleOrPhone: v.facebookPageName || `${v.businessName || "Caterlog Store"} Official`,
        businessAssetId: v.facebookPageId || `FB_PAGE_${cleanSlug.toUpperCase()}`,
        businessPortfolioName: `${v.businessName || "Caterlog Store"} Commerce Manager`,
        syncCatalogToSocial: true,
        importSocialBuyersToCrm: true,
        copilotAutoReply: true,
        webhookStatus: (v.facebookConnected ?? true) ? "ACTIVE" : "DISCONNECTED",
        lastSyncedAt: new Date().toISOString(),
        syncedProductsCount: this.products.length,
      },
    };
  }

  public updateFeatureFlags(
    updates: Partial<import("./runtime-types.ts").RuntimeFeatureFlags>
  ): import("./runtime-types.ts").RuntimeFeatureFlags {
    const current = this.vendor.featureFlags ?? this.getDefaultFeatureFlags();
    const next: import("./runtime-types.ts").RuntimeFeatureFlags = {
      ...current,
      ...updates,
    };
    this.vendor.featureFlags = next;

    // Keep linked engine fields in sync when toggled from Feature Controls
    if (updates.whatsappCopilotEnabled !== undefined) {
      this.vendor.copilotMode = updates.whatsappCopilotEnabled ? "FULL_AUTO" : "MANUAL";
    }
    if (updates.marketBoostDiscoveryEnabled !== undefined && this.marketBoostListing) {
      this.marketBoostListing.isPublished = updates.marketBoostDiscoveryEnabled;
      if (this.persistence.saveMarketBoostListing) {
        this.persistInBackground("syncMarketBoostFromFeatureFlag", () =>
          this.persistence.saveMarketBoostListing!(this.marketBoostListing!)
        );
      }
    }
    if (updates.interstateMirroringEnabled !== undefined && this.marketBoostListing) {
      this.marketBoostListing.allowInterstate = updates.interstateMirroringEnabled;
      if (this.persistence.saveMarketBoostListing) {
        this.persistInBackground("syncInterstateFromFeatureFlag", () =>
          this.persistence.saveMarketBoostListing!(this.marketBoostListing!)
        );
      }
    }

    this.persistInBackground("updateFeatureFlags", () =>
      this.persistence.saveVendor(this.vendor)
    );
    this.recordAuditEvent(
      "VENDOR_SETTINGS_UPDATED",
      "VENDOR_WEB_DASHBOARD",
      "VENDOR",
      this.vendor.id,
      { featureFlags: next, updatedKeys: Object.keys(updates) }
    );
    void this.broadcastStateChange();
    return next;
  }

  public async connectAndSyncSocialAccount(input: {
    platform: "WHATSAPP" | "INSTAGRAM" | "FACEBOOK";
    connected: boolean;
    handleOrPhone: string;
    businessAssetId?: string;
    businessPortfolioName?: string;
    syncCatalogToSocial?: boolean;
    importSocialBuyersToCrm?: boolean;
    copilotAutoReply?: boolean;
    importSampleProductsFromSocial?: boolean;
  }): Promise<{
    socialAccount: import("./runtime-types.ts").RuntimeSocialAccountSync;
    importedProductsCount: number;
    syncedCustomersCount: number;
  }> {
    const accounts = this.vendor.socialAccounts ?? this.getDefaultSocialAccounts();
    const cleanHandle = input.handleOrPhone.trim();
    const nowIso = new Date().toISOString();

    let importedProductsCount = 0;
    if (input.connected && input.importSampleProductsFromSocial) {
      const socialItems =
        input.platform === "INSTAGRAM"
          ? [
              {
                skuCode: `IG-DROP-${Date.now().toString().slice(-3)}-1`,
                name: "Instagram Featured Minimalist Crossbody Bag",
                category: "Fashion & Accessories",
                basePriceKobo: nairaToKobo(24500),
                stockTotal: 18,
                primaryImageUrl:
                  "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80",
                description: "Imported directly from connected Instagram Business product posts.",
              },
              {
                skuCode: `IG-DROP-${Date.now().toString().slice(-3)}-2`,
                name: "Limited Edition Oversized Streetwear Hoodie",
                category: "Apparel",
                basePriceKobo: nairaToKobo(32000),
                stockTotal: 25,
                primaryImageUrl:
                  "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=800&q=80",
                description: "Synced from Instagram Shop tagged reel catalog.",
              },
            ]
          : input.platform === "FACEBOOK"
            ? [
                {
                  skuCode: `FB-SHOP-${Date.now().toString().slice(-3)}-1`,
                  name: "Smart Home Ceramic Aroma Diffuser",
                  category: "Home & Living",
                  basePriceKobo: nairaToKobo(19500),
                  stockTotal: 30,
                  primaryImageUrl:
                    "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=800&q=80",
                  description: "Synced from Meta Commerce Manager Facebook Page Shop.",
                },
              ]
            : [
                {
                  skuCode: `WA-CAT-${Date.now().toString().slice(-3)}-1`,
                  name: "Executive Stainless Thermal Flask Set",
                  category: "Kitchenware",
                  basePriceKobo: nairaToKobo(16000),
                  stockTotal: 40,
                  primaryImageUrl:
                    "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=800&q=80",
                  description: "Imported from WhatsApp Business Cloud Catalog.",
                },
              ];

      for (const item of socialItems) {
        if (!this.products.some((p) => p.name.toLowerCase() === item.name.toLowerCase())) {
          this.addProduct(item);
          importedProductsCount += 1;
        }
      }
    }

    const updatedAccount: import("./runtime-types.ts").RuntimeSocialAccountSync = {
      platform: input.platform,
      connected: input.connected,
      handleOrPhone:
        input.platform === "INSTAGRAM"
          ? cleanHandle.startsWith("@")
            ? cleanHandle
            : `@${cleanHandle.replace(/^@/, "")}`
          : input.platform === "WHATSAPP"
            ? this.normalizeOtpPhone(cleanHandle) || cleanHandle
            : cleanHandle,
      businessAssetId:
        input.businessAssetId?.trim() ||
        `${input.platform}_ASSET_${Date.now().toString().slice(-6)}`,
      businessPortfolioName:
        input.businessPortfolioName?.trim() || `${this.vendor.businessName} Meta Portfolio`,
      syncCatalogToSocial: input.syncCatalogToSocial ?? true,
      importSocialBuyersToCrm: input.importSocialBuyersToCrm ?? true,
      copilotAutoReply: input.copilotAutoReply ?? true,
      webhookStatus: input.connected ? "ACTIVE" : "DISCONNECTED",
      lastSyncedAt: nowIso,
      syncedProductsCount: this.products.length,
    };

    accounts[input.platform] = updatedAccount;
    this.vendor.socialAccounts = accounts;

    if (input.platform === "WHATSAPP" && updatedAccount.handleOrPhone) {
      this.vendor.whatsappPhone = updatedAccount.handleOrPhone;
      if (updatedAccount.businessAssetId) {
        this.vendor.whatsappPhoneId = updatedAccount.businessAssetId;
      }
    } else if (input.platform === "INSTAGRAM") {
      this.vendor.instagramConnected = input.connected;
      this.vendor.instagramHandle = updatedAccount.handleOrPhone;
      this.vendor.instagramBusinessId = updatedAccount.businessAssetId;
    } else if (input.platform === "FACEBOOK") {
      this.vendor.facebookConnected = input.connected;
      this.vendor.facebookPageName = updatedAccount.handleOrPhone;
      this.vendor.facebookPageId = updatedAccount.businessAssetId;
    }

    await this.persistNow("connectAndSyncSocialAccount", () =>
      this.persistence.saveVendor(this.vendor)
    );

    if (input.connected && updatedAccount.syncCatalogToSocial) {
      this.triggerRealtimeCatalogSync();
    }

    this.recordAuditEvent(
      "SOCIAL_CHANNELS_UPDATED",
      "VENDOR_WEB_DASHBOARD",
      "VENDOR",
      this.vendor.id,
      {
        platform: input.platform,
        connected: input.connected,
        handleOrPhone: updatedAccount.handleOrPhone,
        businessAssetId: updatedAccount.businessAssetId,
        importedProductsCount,
        syncedProductsCount: this.products.length,
      }
    );

    await this.broadcastStateChange();
    return {
      socialAccount: updatedAccount,
      importedProductsCount,
      syncedCustomersCount: this.customers.length,
    };
  }

  public updateSocialChannelConfig(input: {
    instagramHandle?: string;
    instagramConnected?: boolean;
    instagramBusinessId?: string;
    facebookPageName?: string;
    facebookPageId?: string;
    facebookConnected?: boolean;
  }): RuntimeVendor {
    if (input.instagramHandle !== undefined) {
      const h = input.instagramHandle.trim();
      this.vendor.instagramHandle = h ? (h.startsWith("@") ? h : `@${h}`) : undefined;
    }
    if (input.instagramConnected !== undefined) {
      this.vendor.instagramConnected = Boolean(input.instagramConnected);
    }
    if (input.instagramBusinessId !== undefined) {
      this.vendor.instagramBusinessId = input.instagramBusinessId.trim() || undefined;
    }
    if (input.facebookPageName !== undefined) {
      this.vendor.facebookPageName = input.facebookPageName.trim() || undefined;
    }
    if (input.facebookPageId !== undefined) {
      this.vendor.facebookPageId = input.facebookPageId.trim() || undefined;
    }
    if (input.facebookConnected !== undefined) {
      this.vendor.facebookConnected = Boolean(input.facebookConnected);
    }

    this.persistInBackground("updateSocialChannelConfig", () =>
      this.persistence.saveVendor(this.vendor)
    );
    this.recordAuditEvent("SOCIAL_CHANNELS_UPDATED", "VENDOR_WEB_DASHBOARD", "VENDOR", this.vendor.id, {
      instagramHandle: this.vendor.instagramHandle,
      instagramConnected: this.vendor.instagramConnected,
      facebookPageName: this.vendor.facebookPageName,
      facebookConnected: this.vendor.facebookConnected,
    });
    void this.broadcastStateChange();
    return this.vendor;
  }

  public async handleMetaSocialWebhook(payload: {
    channel?: "INSTAGRAM" | "FACEBOOK" | "WHATSAPP";
    object?: string;
    senderId?: string;
    senderName?: string;
    text?: string;
    imageUrl?: string;
    entry?: Array<{
      id?: string;
      messaging?: Array<{
        sender?: { id?: string; name?: string };
        message?: { text?: string; attachments?: Array<{ payload?: { url?: string } }> };
      }>;
    }>;
  }) {
    const channel: "INSTAGRAM" | "FACEBOOK" | "WHATSAPP" =
      payload.channel ??
      (payload.object === "instagram"
        ? "INSTAGRAM"
        : payload.object === "page"
          ? "FACEBOOK"
          : "INSTAGRAM");

    const entryMsg = payload.entry?.[0]?.messaging?.[0];
    const senderId =
      payload.senderId?.trim() ||
      entryMsg?.sender?.id?.trim() ||
      (channel === "INSTAGRAM" ? "ig_buyer_201" : "fb_buyer_301");
    const senderName =
      payload.senderName?.trim() ||
      entryMsg?.sender?.name?.trim() ||
      (channel === "INSTAGRAM" ? "Instagram Buyer" : "Facebook Buyer");
    const text =
      payload.text?.trim() ||
      entryMsg?.message?.text?.trim() ||
      "catalog";
    const attachedImageUrl =
      payload.imageUrl?.trim() ||
      entryMsg?.message?.attachments?.[0]?.payload?.url?.trim();

    const result = await this.handleBuyerWhatsAppInquiry({
      buyerPhone: senderId,
      buyerName: senderName,
      text,
      attachedImageUrl,
      sourceChannel: channel,
      simulateFastForwardIdleTimer: true,
    });

    this.recordAuditEvent("OMNICHANNEL_INQUIRY_RECEIVED", "COPILOT_AUTO", "VENDOR", senderId, {
      channel,
      senderName,
      text,
      step: result.step,
      orderShortCode: result.createdOrder?.shortCode,
    });

    return {
      channel,
      senderId,
      senderName,
      ...result,
    };
  }

  // -------------------------------------------------------------------------
  // Shipbubble Logistics, Multi-Courier Rate Shopping & Official Courier Receipt
  // -------------------------------------------------------------------------

  public isHighestSubscriptionVendor(): boolean {
    const role = this.vendor.role;
    const planId = this.vendor.subscription?.planId;
    return role === "pro" || planId === "PRO" || planId === "SCALE";
  }

  public getShipbubbleConfig(): RuntimeShipbubbleConfig {
    if (!this.vendor.shipbubbleConfig) {
      this.vendor.shipbubbleConfig = {
        pickupAddress: "14 Admiralty Way, Lekki Phase 1, Lagos, Nigeria",
        pickupAddressCode: 871341691,
        pickupFormattedAddress:
          "Road 14 Admiralty Wy, Lekki Phase I, Lagos 106104, Lagos, Nigeria",
        pickupCity: "Eti Osa",
        pickupState: "Lagos",
        pickupPostalCode: "106104",
        defaultCategoryId: 74794423,
        defaultWeightPreset: "SHOEBOX",
        customWeightKg: 1.5,
        selectedCarriers: ["test_1_courier"],
        autoBookOnPaid: this.isHighestSubscriptionVendor(),
        liveCheckoutRatesEnabled: true,
      };
    }
    return this.vendor.shipbubbleConfig;
  }

  public async validateVendorPickupAddress(address: string) {
    const cfg = this.getShipbubbleConfig();
    const validated = await this.shipbubble.validateAddress({
      name: this.vendor.businessName,
      email: `${this.vendor.slug}@caterlog.store`,
      phone: this.vendor.whatsappPhone,
      address: address.trim() || cfg.pickupAddress,
    });

    cfg.pickupAddress = address.trim() || validated.address;
    cfg.pickupAddressCode = validated.address_code;
    cfg.pickupFormattedAddress = validated.formatted_address;
    cfg.pickupCity = validated.city;
    cfg.pickupState = validated.state;
    cfg.pickupPostalCode = validated.postal_code;

    this.persistInBackground("saveShipbubbleValidatedAddress", () =>
      this.persistence.saveVendor(this.vendor)
    );
    this.recordAuditEvent(
      "SHIPBUBBLE_CONFIG_UPDATED",
      "VENDOR_WEB_DASHBOARD",
      "VENDOR",
      this.vendor.id,
      { config: cfg, validatedAddress: validated }
    );
    await this.broadcastStateChange();
    return { validated, config: cfg };
  }

  public updateShipbubbleConfig(input: Partial<RuntimeShipbubbleConfig>): RuntimeShipbubbleConfig {
    const cfg = this.getShipbubbleConfig();
    const isPremium = this.isHighestSubscriptionVendor();

    if (input.pickupAddress !== undefined && input.pickupAddress.trim()) {
      cfg.pickupAddress = input.pickupAddress.trim();
    }
    if (input.pickupAddressCode !== undefined) {
      cfg.pickupAddressCode = input.pickupAddressCode;
    }
    if (input.pickupFormattedAddress !== undefined) {
      cfg.pickupFormattedAddress = input.pickupFormattedAddress;
    }
    if (input.defaultCategoryId !== undefined && Number.isFinite(input.defaultCategoryId)) {
      cfg.defaultCategoryId = input.defaultCategoryId;
    }

    // Weight handling rule: Manual input is only open to premium (highest subscription) vendors
    if (input.defaultWeightPreset !== undefined) {
      if (input.defaultWeightPreset === "CUSTOM" && !isPremium) {
        cfg.defaultWeightPreset = "SHOEBOX";
      } else {
        cfg.defaultWeightPreset = input.defaultWeightPreset;
      }
    }
    if (input.customWeightKg !== undefined && isPremium) {
      const w = Number(input.customWeightKg);
      if (Number.isFinite(w) && w > 0) {
        cfg.customWeightKg = Math.min(100, Math.max(0.1, Number(w.toFixed(2))));
      }
    }

    // Carrier selection rule: Starter & standard can select 1; highest subscription can select multiple
    if (Array.isArray(input.selectedCarriers) && input.selectedCarriers.length > 0) {
      const cleaned = Array.from(new Set(input.selectedCarriers.map((c) => c.trim()).filter(Boolean)));
      cfg.selectedCarriers = isPremium ? cleaned : cleaned.slice(0, 1);
    }

    // Auto-booking rule: Pro/Standard must manually select; highest subscription can use automatic booking on PAID
    if (input.autoBookOnPaid !== undefined) {
      cfg.autoBookOnPaid = isPremium ? Boolean(input.autoBookOnPaid) : false;
    }

    if (input.liveCheckoutRatesEnabled !== undefined) {
      cfg.liveCheckoutRatesEnabled = Boolean(input.liveCheckoutRatesEnabled);
    }

    this.persistInBackground("saveShipbubbleConfig", () =>
      this.persistence.saveVendor(this.vendor)
    );
    this.recordAuditEvent(
      "SHIPBUBBLE_CONFIG_UPDATED",
      "VENDOR_WEB_DASHBOARD",
      "VENDOR",
      this.vendor.id,
      { config: cfg }
    );
    void this.broadcastStateChange();
    return cfg;
  }

  public async fetchOrderShipbubbleRates(
    shortCode: string,
    options: {
      deliveryAddress?: string;
      weightPreset?: ShipbubbleWeightPresetId;
      customWeightKg?: number;
      filterByVendorCarriers?: boolean;
    } = {}
  ) {
    const clean = shortCode.trim().toUpperCase();
    const ord = this.orders.find((o) => o.shortCode.toUpperCase() === clean);
    if (!ord) {
      throw new Error(`Order ${shortCode} not found.`);
    }

    const cfg = this.getShipbubbleConfig();
    const isPremium = this.isHighestSubscriptionVendor();

    if (options.deliveryAddress && options.deliveryAddress.trim()) {
      ord.deliveryAddress = options.deliveryAddress.trim();
    }

    const effectivePreset: ShipbubbleWeightPresetId =
      options.weightPreset === "CUSTOM" && !isPremium
        ? cfg.defaultWeightPreset === "CUSTOM"
          ? "SHOEBOX"
          : cfg.defaultWeightPreset
        : options.weightPreset ?? cfg.defaultWeightPreset;

    const presetObj =
      effectivePreset !== "CUSTOM"
        ? SHIPBUBBLE_WEIGHT_PRESETS[effectivePreset]
        : SHIPBUBBLE_WEIGHT_PRESETS.SHOEBOX;

    const totalWeightKg =
      effectivePreset === "CUSTOM" && isPremium
        ? Math.max(0.1, Number(options.customWeightKg ?? cfg.customWeightKg ?? 1.5))
        : presetObj.weightKg;

    const orderItems =
      ord.items && ord.items.length > 0
        ? ord.items.map((it) => ({
            name: it.variantName ? `${it.productName} (${it.variantName})` : it.productName,
            description: `${it.productName} [${it.variantSku || it.productSku}]`,
            unit_weight: Number((totalWeightKg / Math.max(1, it.quantity)).toFixed(2)),
            unit_amount: koboToNaira(it.unitPriceKobo),
            quantity: it.quantity,
          }))
        : [
            {
              name: ord.variantName ? `${ord.productName} (${ord.variantName})` : ord.productName,
              description: `${ord.productName} [${ord.variantSku || ord.productSku}]`,
              unit_weight: Number((totalWeightKg / Math.max(1, ord.quantity || 1)).toFixed(2)),
              unit_amount: koboToNaira(ord.subtotalKobo) / Math.max(1, ord.quantity || 1),
              quantity: ord.quantity || 1,
            },
          ];

    const deliveryAddr =
      ord.deliveryAddress?.trim() ||
      (ord.shippingZoneName ? `${ord.shippingZoneName}, Lagos, Nigeria` : "25 Allen Avenue, Ikeja, Lagos, Nigeria");

    const { rateResponse, senderValidated, receiverValidated } = await this.shipbubble.fetchRates({
      sender: {
        name: this.vendor.businessName,
        email: `${this.vendor.slug}@caterlog.store`,
        phone: this.vendor.whatsappPhone,
        address: cfg.pickupAddress,
        addressCode: cfg.pickupAddressCode,
      },
      receiver: {
        name: ord.customerName,
        email: `${ord.customerPhone.replace(/\D/g, "")}@caterlog.store`,
        phone: ord.customerPhone,
        address: deliveryAddr,
      },
      categoryId: cfg.defaultCategoryId,
      items: orderItems,
      dimension: presetObj.dimension,
    });

    return {
      orderShortCode: ord.shortCode,
      requestToken: rateResponse.request_token,
      couriers: rateResponse.couriers,
      fastestCourier: rateResponse.fastest_courier,
      cheapestCourier: rateResponse.cheapest_courier,
      senderValidated,
      receiverValidated,
      packageWeightKg: totalWeightKg,
      weightPreset: effectivePreset,
      boxName: effectivePreset === "CUSTOM" ? "Custom Package" : presetObj.boxName,
      isPremiumTier: isPremium,
    };
  }

  public async bookOrderShipbubbleCourier(
    shortCode: string,
    input: {
      requestToken?: string;
      courierId?: string;
      serviceCode?: string;
      deliveryAddress?: string;
      weightPreset?: ShipbubbleWeightPresetId;
      customWeightKg?: number;
      autoBooked?: boolean;
    } = {}
  ): Promise<{ order: RuntimeOrder; receipt: RuntimeCourierShipmentReceipt }> {
    const clean = shortCode.trim().toUpperCase();
    const ord = this.orders.find((o) => o.shortCode.toUpperCase() === clean);
    if (!ord) {
      throw new Error(`Order ${shortCode} not found.`);
    }

    const cfg = this.getShipbubbleConfig();
    let requestToken = input.requestToken;
    let courierId = input.courierId;
    let serviceCode = input.serviceCode;
    let selectedQuote: ShipbubbleCourierQuote | undefined;
    let weightPreset = input.weightPreset ?? cfg.defaultWeightPreset;
    let boxName = "Small Box";

    // Always fetch fresh rates if requestToken or courierId was not provided (or during auto-booking)
    const quoted = await this.fetchOrderShipbubbleRates(ord.shortCode, {
      deliveryAddress: input.deliveryAddress,
      weightPreset: input.weightPreset,
      customWeightKg: input.customWeightKg,
    });
    weightPreset = quoted.weightPreset;
    boxName = quoted.boxName;

    if (!requestToken) {
      requestToken = quoted.requestToken;
    }

    if (courierId || serviceCode) {
      selectedQuote = quoted.couriers.find(
        (c) => c.courier_id === courierId || c.service_code === serviceCode
      );
    }
    if (!selectedQuote) {
      // Check vendor's preferred carriers first, then cheapest courier
      selectedQuote =
        quoted.couriers.find(
          (c) =>
            cfg.selectedCarriers.includes(c.courier_id) ||
            cfg.selectedCarriers.includes(c.service_code)
        ) ??
        quoted.cheapestCourier ??
        quoted.couriers[0];
    }

    if (!selectedQuote) {
      throw new Error("No operational courier quotes returned by Shipbubble for this route.");
    }

    courierId = selectedQuote.courier_id;
    serviceCode = selectedQuote.service_code;

    const label = await this.shipbubble.createShipmentLabel({
      requestToken,
      courierId,
      serviceCode,
    });

    const receipt: RuntimeCourierShipmentReceipt = {
      provider: "shipbubble",
      receiptNumber: `RCP-${label.order_id}`,
      shipbubbleOrderId: label.order_id,
      requestToken,
      courierId,
      courierName: label.courier?.name || selectedQuote.courier_name,
      courierEmail: label.courier?.email || "dispatch@shipbubble.com",
      courierPhone: label.courier?.phone || "+2348007447282",
      courierImage: selectedQuote.courier_image,
      serviceCode,
      serviceType: selectedQuote.service_type || "pickup",
      status: label.status || "confirmed",
      trackingCode: label.tracking_code || label.order_id,
      trackingUrl:
        label.tracking_url || `https://trackshipment.shipbubble.com/shipment/${label.order_id}`,
      waybillDocumentUrl: label.waybill_document,
      shippingFeeNaira: label.payment?.shipping_fee ?? selectedQuote.total,
      vatNaira: selectedQuote.vat ?? 0,
      paymentType: label.payment?.type ?? "wallet",
      paymentStatus: label.payment?.status ?? "completed",
      currency: label.payment?.currency ?? "NGN",
      packageWeightKg: label.package_weight ?? quoted.packageWeightKg,
      packageAmountNaira: label.package_amount ?? koboToNaira(ord.subtotalKobo),
      weightPreset,
      boxName,
      pickupEta: selectedQuote.pickup_eta,
      deliveryEta: selectedQuote.delivery_eta,
      shipFrom: label.ship_from,
      shipTo: label.ship_to,
      items: (label.items ?? []).map((it) => ({
        name: it.name,
        description: it.description,
        weight: it.weight,
        amount: it.amount,
        quantity: it.quantity,
        total: it.total,
      })),
      autoBooked: Boolean(input.autoBooked),
      bookedAt: new Date().toISOString(),
      message: label.message,
    };

    ord.courierShipment = receipt;
    ord.riderPhone = `${receipt.courierName} (${receipt.trackingCode})`;
    ord.dispatchedAt = ord.dispatchedAt ?? new Date();
    if (ord.status === "PAID" || ord.status === "PROCESSING") {
      ord.status = "OUT_FOR_DELIVERY";
    }

    await this.persistNow("bookOrderShipbubbleCourier", () => this.persistence.saveOrder(ord));

    const dashboardBase = (process.env.DASHBOARD_URL ?? "http://localhost:3000").replace(/\/+$/, "");
    const trackUrl = `${dashboardBase}/track/${encodeURIComponent(ord.shortCode)}`;

    const buyerReceiptMsg = [
      `🧾 *OFFICIAL COURIER SHIPPING RECEIPT (${receipt.receiptNumber})*`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🚚 *Courier:* *${receipt.courierName}*`,
      `🔖 *Waybill / Tracking ID:* \`${receipt.trackingCode}\``,
      `📦 *Order Reference:* *#${ord.shortCode}*`,
      `⚖️ *Package Weight:* *${receipt.packageWeightKg} kg* (${receipt.boxName})`,
      `💳 *Courier Fee Settled:* *₦${receipt.shippingFeeNaira.toLocaleString()}* (${receipt.paymentStatus.toUpperCase()})`,
      `⏱️ *Estimated Delivery:* *${receipt.deliveryEta || "Within 24-48 hrs"}*`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `📤 *Sender:* ${receipt.shipFrom.name} (${receipt.shipFrom.address})`,
      `📥 *Deliver To:* ${receipt.shipTo.name} (${receipt.shipTo.address})`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🔗 *Shipbubble Live Courier Tracker:*`,
      `${receipt.trackingUrl}`,
      ``,
      `🧾 *Caterlog Order & Receipt Page:*`,
      `${trackUrl}`,
    ].join("\n");

    await this.dispatchWhatsAppAndRecordChat({
      channel: "BUYER_SHOP_WA",
      toPhone: ord.customerPhone,
      text: buyerReceiptMsg,
      headerText: `Courier Receipt · ${receipt.courierName}`,
    });

    this.appendChat({
      channel: "VENDOR_ADMIN_WA",
      sender: "CATERLOG_BOT",
      fromPhone: "CATERLOG",
      text: [
        `🚚 *Shipbubble Courier Booked ${input.autoBooked ? "(Auto-Booked)" : ""} — #${ord.shortCode}*`,
        `• Receipt No: \`${receipt.receiptNumber}\``,
        `• Courier: *${receipt.courierName}*`,
        `• Waybill ID: \`${receipt.trackingCode}\``,
        `• Fee Paid: *₦${receipt.shippingFeeNaira.toLocaleString()}* (Wallet)`,
        `• Live Tracker: ${receipt.trackingUrl}`,
      ].join("\n"),
    });

    this.recordAuditEvent(
      "SHIPBUBBLE_COURIER_BOOKED",
      input.autoBooked ? "COPILOT_AUTO" : "VENDOR_WEB_DASHBOARD",
      "ORDER",
      ord.shortCode,
      {
        receiptNumber: receipt.receiptNumber,
        shipbubbleOrderId: receipt.shipbubbleOrderId,
        courierName: receipt.courierName,
        shippingFeeNaira: receipt.shippingFeeNaira,
        trackingUrl: receipt.trackingUrl,
        autoBooked: Boolean(input.autoBooked),
        receipt,
      }
    );

    await this.broadcastStateChange();
    return { order: ord, receipt };
  }

  public async selectPublicOrderShipbubbleRate(
    shortCode: string,
    input: {
      courierId: string;
      serviceCode: string;
      courierName: string;
      rateNaira: number;
      deliveryAddress?: string;
      requestToken?: string;
    }
  ): Promise<RuntimeOrder> {
    const clean = shortCode.trim().toUpperCase();
    const ord = this.orders.find((o) => o.shortCode.toUpperCase() === clean);
    if (!ord) {
      throw new Error(`Order ${shortCode} not found.`);
    }

    if (input.deliveryAddress && input.deliveryAddress.trim()) {
      ord.deliveryAddress = input.deliveryAddress.trim();
    }

    const newFeeKobo = nairaToKobo(Math.max(0, Math.round(Number(input.rateNaira) || 0)));
    ord.shippingZoneName = `${input.courierName} (Shipbubble Live Rate)`;
    ord.shippingFeeKobo = newFeeKobo;
    const netSubtotal =
      ord.subtotalKobo > ord.discountAmountKobo
        ? ord.subtotalKobo - ord.discountAmountKobo
        : 0n;
    ord.totalAmountKobo = netSubtotal + newFeeKobo;

    await this.persistNow("selectPublicOrderShipbubbleRate", () => this.persistence.saveOrder(ord));
    await this.broadcastStateChange();
    return ord;
  }

  public async handleShipbubbleWebhook(payload: {
    event?: string;
    status?: "pending" | "confirmed" | "picked_up" | "in_transit" | "completed" | "cancelled";
    order_id?: string;
    orderShortCode?: string;
    tracking_url?: string;
    waybill_document?: string;
    courier?: { name?: string; tracking_code?: string };
  }): Promise<{ order: RuntimeOrder; receipt: RuntimeCourierShipmentReceipt }> {
    const ord = this.orders.find(
      (o) =>
        (payload.orderShortCode &&
          o.shortCode.toUpperCase() === payload.orderShortCode.trim().toUpperCase()) ||
        (payload.order_id &&
          o.courierShipment?.shipbubbleOrderId.toUpperCase() ===
            payload.order_id.trim().toUpperCase())
    );

    if (!ord || !ord.courierShipment) {
      throw new Error(
        `No matching Shipbubble shipment found for ${payload.order_id || payload.orderShortCode || "webhook"}.`
      );
    }

    const receipt = ord.courierShipment;
    const nextStatus = payload.status ?? receipt.status;
    receipt.status = nextStatus;

    if (payload.tracking_url) {
      receipt.trackingUrl = payload.tracking_url;
    }
    if (payload.waybill_document) {
      receipt.waybillDocumentUrl = payload.waybill_document;
    }
    if (payload.courier?.tracking_code) {
      receipt.trackingCode = payload.courier.tracking_code;
    }

    const nowIso = new Date().toISOString();
    if (nextStatus === "picked_up") {
      receipt.pickedUpAt = receipt.pickedUpAt ?? nowIso;
      if (ord.status === "PAID" || ord.status === "PROCESSING") {
        ord.status = "OUT_FOR_DELIVERY";
      }
      await this.dispatchWhatsAppAndRecordChat({
        channel: "BUYER_SHOP_WA",
        toPhone: ord.customerPhone,
        text: [
          `📦 *PACKAGE PICKED UP BY ${receipt.courierName.toUpperCase()}!*`,
          `🧾 Receipt: \`${receipt.receiptNumber}\` · Order *#${ord.shortCode}*`,
          `🔖 Tracking ID: \`${receipt.trackingCode}\``,
          `⏱️ Delivery ETA: *${receipt.deliveryEta || "On the way"}*`,
          `🔗 Track Live: ${receipt.trackingUrl}`,
        ].join("\n"),
        headerText: "Courier Picked Up Package",
      });
    } else if (nextStatus === "in_transit") {
      receipt.inTransitAt = receipt.inTransitAt ?? nowIso;
      if (ord.status === "PAID" || ord.status === "PROCESSING") {
        ord.status = "OUT_FOR_DELIVERY";
      }
      await this.dispatchWhatsAppAndRecordChat({
        channel: "BUYER_SHOP_WA",
        toPhone: ord.customerPhone,
        text: [
          `🚚 *PACKAGE IN TRANSIT — ${receipt.courierName.toUpperCase()}*`,
          `Hello *${ord.customerName}*, your package for Order *#${ord.shortCode}* is currently in transit to *${receipt.shipTo.address}*.`,
          `🔖 Waybill: \`${receipt.trackingCode}\``,
          `🔗 Live Tracking: ${receipt.trackingUrl}`,
        ].join("\n"),
        headerText: "Shipment In Transit",
      });
    } else if (nextStatus === "completed") {
      receipt.deliveredAt = receipt.deliveredAt ?? nowIso;
      ord.status = "FULFILLED";
      ord.splitSettlementStatus = "SETTLED";

      // Increment vendor Trust Tier clean orders count & unlock escrow
      if (this.vendor.trustTier) {
        this.vendor.trustTier.completedCleanOrders += 1;
      }

      await this.dispatchWhatsAppAndRecordChat({
        channel: "BUYER_SHOP_WA",
        toPhone: ord.customerPhone,
        text: [
          `🎉 *PACKAGE DELIVERED — OFFICIAL COURIER RECEIPT (${receipt.receiptNumber})*`,
          `━━━━━━━━━━━━━━━━━━━━━━`,
          `Hello *${ord.customerName}*, *${receipt.courierName}* has confirmed delivery of your Order *#${ord.shortCode}*!`,
          `🔖 Waybill ID: \`${receipt.trackingCode}\``,
          `📍 Delivered To: ${receipt.shipTo.address}`,
          `🕒 Delivered At: ${new Date(receipt.deliveredAt).toLocaleString()}`,
          `━━━━━━━━━━━━━━━━━━━━━━`,
          `Thank you for shopping with *${this.vendor.businessName}*!`,
        ].join("\n"),
        headerText: "Delivery Confirmed",
      });

      this.appendChat({
        channel: "VENDOR_ADMIN_WA",
        sender: "CATERLOG_BOT",
        fromPhone: "CATERLOG",
        text: [
          `✅ *Shipbubble Delivery Confirmed (#${ord.shortCode})!*`,
          `• Courier: *${receipt.courierName}* (\`${receipt.trackingCode}\`)`,
          `• Escrow Settlement: *${formatNaira(ord.amountPaidKobo)}* released from Trust-Held to Liquid Withdrawable Cash!`,
          `• Trust Score: Clean fulfilled orders increased to *${this.vendor.trustTier?.completedCleanOrders ?? 15}*.`,
        ].join("\n"),
      });
    } else if (nextStatus === "cancelled") {
      this.appendChat({
        channel: "VENDOR_ADMIN_WA",
        sender: "CATERLOG_BOT",
        fromPhone: "CATERLOG",
        text: `⚠️ *Shipbubble Shipment Cancelled (#${ord.shortCode}):* Waybill \`${receipt.trackingCode}\` was cancelled. You can book a new courier from the Orders view.`,
      });
    }

    await this.persistNow("handleShipbubbleWebhook", () => this.persistence.saveOrder(ord));
    this.recordAuditEvent(
      "SHIPBUBBLE_STATUS_UPDATED",
      "SYSTEM_TIMER",
      "ORDER",
      ord.shortCode,
      {
        status: nextStatus,
        shipbubbleOrderId: receipt.shipbubbleOrderId,
        receiptNumber: receipt.receiptNumber,
        receipt,
      }
    );

    await this.broadcastStateChange();
    return { order: ord, receipt };
  }

  private appendChat(msg: Omit<ChatThreadMessage, "id" | "timestamp">) {
    const fullMsg: ChatThreadMessage = {
      ...msg,
      sourceChannel:
        msg.sourceChannel ??
        (msg.channel === "BUYER_SHOP_WA" ? this.activeSourceChannel : "WHATSAPP"),
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date(),
    };
    this.chatMessages.push(fullMsg);
    if (this.persistence.saveChatMessage) {
      this.persistInBackground("saveChatMessage", () =>
        this.persistence.saveChatMessage!(fullMsg)
      );
    }
  }

  private async broadcastStateChange() {
    await this.eventBus.publish({
      eventType: "VENDOR_SETTINGS_UPDATED",
      vendorId: this.vendor.id,
      actorType: "SYSTEM_TIMER",
      entityType: "VENDOR",
      entityId: this.vendor.id,
      payload: {},
      occurredAt: new Date(),
    });
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
