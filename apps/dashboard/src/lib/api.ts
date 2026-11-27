import type {
  CourierShipmentReceipt,
  Discount,
  KycSubmissionItem,
  MarketBoostListing,
  MonnifySimulationResult,
  Order,
  OrderWaybill,
  PaymentLinkItem,
  PublicOrderReceipt,
  ResellerMirror,
  SettlementSplitRuleItem,
  ShipbubbleCourierQuoteItem,
  ShipbubbleVendorConfig,
  TeamMemberItem,
  VendorState,
  WhatsAppSimulationResult,
  SubscriptionInfo,
  SubscriptionPlanId,
  BillingCycle,
  TrustTierInfo,
  PlatformRole,
  SupplierProfile,
} from "./types";

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    // If an explicit external domain is configured (e.g. production API), use it:
    const configured = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (configured && !configured.includes("localhost") && !configured.includes("127.0.0.1")) {
      return configured.replace(/\/+$/, "");
    }
    // In local dev/browser, return empty string so requests are same-origin and proxied
    // by Next.js rewrites to the API server, eliminating CORS and port-binding mismatches.
    return "";
  }
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:4000").replace(/\/+$/, "");
}

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:4000"
).replace(/\/+$/, "");

/**
 * Normalizes image URLs so relative backend media endpoints (/api/v1/media/...)
 * resolve reliably both through Next.js rewrites and direct API paths.
 */
export function resolveImageUrl(url?: string): string {
  if (!url) return "";
  if (url.startsWith("/api/v1/media/")) {
    if (typeof window !== "undefined") {
      return url;
    }
    return `${API_BASE_URL}${url}`;
  }
  return url;
}

export class ApiError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getStoredSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("caterlog_session_token");
}

export function setStoredSessionToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem("caterlog_session_token", token);
  } else {
    localStorage.removeItem("caterlog_session_token");
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredSessionToken();
  const baseUrl = getApiBaseUrl();
  const primaryUrl = path.startsWith("http") ? path : `${baseUrl}${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init?.headers ?? {}),
  };

  try {
    const response = await fetch(primaryUrl, {
      ...init,
      headers,
      credentials: "include",
      cache: "no-store",
    });

    const raw = await response.text();
    let data: unknown = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = raw;
    }

    if (!response.ok) {
      if (response.status === 401 && typeof window !== "undefined") {
        setStoredSessionToken(null);
      }
      const message =
        data && typeof data === "object" && "error" in data
          ? String((data as { error: unknown }).error)
          : `Request failed with HTTP ${response.status}`;
      throw new ApiError(response.status, message);
    }

    return data as T;
  } catch (err) {
    // Local-dev only: if same-origin relative fetch failed, retry the API directly on :4000.
    // On deployed hosts this URL does not exist (and would only add misleading mixed-content errors).
    const isLocalHost =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    if (isLocalHost && !path.startsWith("http")) {
      try {
        const fallbackUrl = `http://${window.location.hostname}:4000${path}`;
        const fallbackResponse = await fetch(fallbackUrl, {
          ...init,
          headers,
          credentials: "include",
          cache: "no-store",
        });
        if (fallbackResponse.ok) {
          const rawFallback = await fallbackResponse.text();
          try {
            return (rawFallback ? JSON.parse(rawFallback) : null) as T;
          } catch {
            return rawFallback as T;
          }
        }
      } catch {
        // preserve original error
      }
    }
    throw err;
  }
}

function jsonBody(value: unknown): RequestInit {
  return { body: JSON.stringify(value) };
}

export const api = {
  get eventsUrl(): string {
    if (typeof window !== "undefined") {
      const configured = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (configured) {
        return `${configured.replace(/\/+$/, "")}/api/v1/events`;
      }
      const host = window.location.hostname;
      return host === "localhost" || host === "127.0.0.1"
        ? `http://${host}:4000/api/v1/events`
        : "/api/v1/events";
    }
    return `${API_BASE_URL}/api/v1/events`;
  },

  ogCardUrl(sku: string, cacheBust?: number): string {
    const query = cacheBust ? `?t=${cacheBust}` : "";
    if (typeof window !== "undefined") {
      return `/og/product/${encodeURIComponent(sku)}${query}`;
    }
    return `${API_BASE_URL}/og/product/${encodeURIComponent(sku)}${query}`;
  },

  getState(): Promise<VendorState> {
    return request<VendorState>("/api/v1/vendor/state");
  },

  updateSettings(input: {
    copilotMode?: VendorState["vendor"]["copilotMode"];
    copilotIdleSeconds?: number;
    reservationTtlMinutes?: number;
  }): Promise<VendorState> {
    return request<VendorState>("/api/v1/vendor/settings", {
      method: "PATCH",
      ...jsonBody(input),
    });
  },

  updateProfile(input: {
    businessName?: string;
    role?: PlatformRole | "vendor" | "supplier";
    whatsappPhone?: string;
    instagramHandle?: string;
    baseState?: string;
    baseCity?: string;
  }): Promise<VendorState> {
    return request<VendorState>("/api/v1/vendor/profile", {
      method: "PATCH",
      ...jsonBody(input),
    });
  },

  updateSocialChannels(input: {
    instagramHandle?: string;
    instagramConnected?: boolean;
    instagramBusinessId?: string;
    facebookPageName?: string;
    facebookPageId?: string;
    facebookConnected?: boolean;
  }): Promise<VendorState> {
    return request<VendorState>("/api/v1/vendor/channels", {
      method: "PATCH",
      ...jsonBody(input),
    });
  },

  addProduct(input: {
    skuCode?: string;
    name: string;
    description?: string;
    priceNaira: number | string;
    stockTotal?: number;
    category?: string;
    customFields?: Record<string, string>;
    primaryImageUrl?: string;
    variants?: any[];
  }): Promise<VendorState> {
    return request<VendorState>("/api/v1/vendor/products", {
      method: "POST",
      ...jsonBody(input),
    });
  },

  updateProduct(
    skuCode: string,
    input: {
      name?: string;
      description?: string;
      category?: string;
      customFields?: Record<string, string>;
      priceNaira?: number | string;
      stockTotal?: number;
      primaryImageUrl?: string;
      variants?: any[];
    }
  ): Promise<VendorState> {
    return request<VendorState>(`/api/v1/vendor/products/${encodeURIComponent(skuCode)}`, {
      method: "PUT",
      ...jsonBody(input),
    });
  },

  linkBankAccount(input: {
    bankCode: string;
    accountNumber: string;
    email?: string;
  }): Promise<{
    status: string;
    subAccountCode: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    state: VendorState;
  }> {
    return request("/api/v1/vendor/bank", {
      method: "POST",
      ...jsonBody(input),
    });
  },

  updateStock(skuCode: string, stockTotal: number): Promise<VendorState> {
    return request<VendorState>(
      `/api/v1/vendor/products/${encodeURIComponent(skuCode)}/stock`,
      { method: "PATCH", ...jsonBody({ stockTotal }) }
    );
  },

  deleteProduct(skuCode: string): Promise<VendorState> {
    return request<VendorState>(
      `/api/v1/vendor/products/${encodeURIComponent(skuCode)}`,
      { method: "DELETE" }
    );
  },

  addShippingZone(name: string, feeNaira: number | string): Promise<VendorState> {
    return request<VendorState>("/api/v1/vendor/shipping-zones", {
      method: "POST",
      ...jsonBody({ name, feeNaira }),
    });
  },

  deleteShippingZone(code: number): Promise<VendorState> {
    return request<VendorState>(`/api/v1/vendor/shipping-zones/${code}`, {
      method: "DELETE",
    });
  },

  addDiscount(input: {
    code: string;
    type: Discount["type"];
    value: number;
    minOrderNaira?: number;
    maxUses?: number | null;
    expiresAt?: string;
  }): Promise<VendorState> {
    return request<VendorState>("/api/v1/vendor/discounts", {
      method: "POST",
      ...jsonBody(input),
    });
  },

  applyFlashSale(input: {
    action: "APPLY" | "CLEAR";
    discountPercent?: number;
    scope: "ALL" | "CATEGORY" | "PRODUCTS";
    targetCategory?: string;
    targetSkus?: string[];
    label?: string;
  }): Promise<{ status: string; affectedCount: number; state: VendorState }> {
    return request("/api/v1/vendor/products/flash-sale", {
      method: "POST",
      ...jsonBody(input),
    });
  },

  createManualOrder(input: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    salesChannel?: import("./types").SalesChannel;
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
  }): Promise<{
    status: string;
    order: Order;
    receipt: PublicOrderReceipt;
    state: VendorState;
  }> {
    return request("/api/v1/vendor/orders/manual", {
      method: "POST",
      ...jsonBody(input),
    });
  },

  upsertCustomer(input: {
    whatsappPhone: string;
    name: string;
    email?: string;
    defaultAddress?: string;
    notes?: string;
    tags?: string[];
    segmentOverride?: "VIP" | "Repeat" | "New";
  }): Promise<{
    status: string;
    customer: import("./types").CustomerRecordItem;
    state: VendorState;
  }> {
    return request("/api/v1/vendor/customers", {
      method: "POST",
      ...jsonBody(input),
    });
  },

  sendCustomerBroadcast(input: {
    segment: "ALL" | "VIP" | "Repeat" | "New" | "PENDING_ORDERS";
    channel: "WHATSAPP" | "INSTAGRAM" | "SMS";
    messageText: string;
    includePromoCode?: string;
    includeStoreLink?: boolean;
  }): Promise<{
    status: string;
    recipientCount: number;
    segment: string;
    channel: string;
    deliveredAt: string;
    state: VendorState;
  }> {
    return request("/api/v1/vendor/customers/broadcast", {
      method: "POST",
      ...jsonBody(input),
    });
  },

  saveWholesaleBooking(
    input: Partial<import("./types").WholesaleBookingItem> & {
      productSku: string;
      clientName: string;
      clientPhone: string;
      quantity: number;
    }
  ): Promise<{
    status: string;
    booking: import("./types").WholesaleBookingItem;
    state: VendorState;
  }> {
    return request("/api/v1/vendor/bookings", {
      method: "POST",
      ...jsonBody(input),
    });
  },

  updateWholesaleBookingStatus(
    idOrRef: string,
    input: Partial<import("./types").WholesaleBookingItem>
  ): Promise<{
    status: string;
    booking: import("./types").WholesaleBookingItem;
    state: VendorState;
  }> {
    return request(`/api/v1/vendor/bookings/${encodeURIComponent(idOrRef)}`, {
      method: "PATCH",
      ...jsonBody(input),
    });
  },

  updateBookingCatalogRules(
    input: Partial<import("./types").BookingCatalogRules>
  ): Promise<{
    status: string;
    rules: import("./types").BookingCatalogRules;
    state: VendorState;
  }> {
    return request("/api/v1/vendor/bookings/rules", {
      method: "PATCH",
      ...jsonBody(input),
    });
  },

  deleteDiscount(code: string): Promise<VendorState> {
    return request<VendorState>(
      `/api/v1/vendor/discounts/${encodeURIComponent(code)}`,
      { method: "DELETE" }
    );
  },

  dispatchOrder(shortCode: string, riderPhone?: string): Promise<VendorState> {
    return request<VendorState>(
      `/api/v1/vendor/orders/${encodeURIComponent(shortCode)}/dispatch`,
      { method: "POST", ...jsonBody({ riderPhone }) }
    );
  },

  expireOrder(shortCode: string): Promise<VendorState> {
    return request<VendorState>(
      `/api/v1/vendor/orders/${encodeURIComponent(shortCode)}/expire`,
      { method: "POST", ...jsonBody({}) }
    );
  },

  getOrderWaybill(shortCode: string): Promise<{ waybill: OrderWaybill }> {
    return request<{ waybill: OrderWaybill }>(
      `/api/v1/vendor/orders/${encodeURIComponent(shortCode)}/waybill`
    );
  },

  refundOrder(
    shortCode: string,
    input: { reason?: string; amountNaira?: number | string } = {}
  ): Promise<{
    status: string;
    refundReference: string;
    refundAmountFormatted: string;
    refundStatus: string;
    state: VendorState;
  }> {
    return request(
      `/api/v1/vendor/orders/${encodeURIComponent(shortCode)}/refund`,
      { method: "POST", ...jsonBody(input) }
    );
  },

  getPublicOrderReceipt(shortCode: string): Promise<{ receipt: PublicOrderReceipt }> {
    return request<{ receipt: PublicOrderReceipt }>(
      `/api/v1/public/orders/${encodeURIComponent(shortCode)}`
    );
  },

  updatePublicOrderDelivery(
    shortCode: string,
    input: {
      deliveryAddress?: string;
      deliveryLandmark?: string;
      alternatePhone?: string;
    }
  ): Promise<{ status: string; receipt: PublicOrderReceipt }> {
    return request<{ status: string; receipt: PublicOrderReceipt }>(
      `/api/v1/public/orders/${encodeURIComponent(shortCode)}/delivery`,
      { method: "PATCH", ...jsonBody(input) }
    );
  },

  simulateTransfer(
    orderShortCode: string,
    amountNaira: number,
    payerName?: string
  ): Promise<MonnifySimulationResult> {
    return request<MonnifySimulationResult>("/api/v1/simulate/monnify-transfer", {
      method: "POST",
      ...jsonBody({ orderShortCode, amountNaira, payerName }),
    });
  },

  simulateWhatsApp(input: {
    role: "VENDOR_KEYWORD" | "BUYER_INQUIRY" | "VENDOR_MANUAL_BUYER_REPLY";
    text: string;
    attachedImageUrl?: string;
    buyerPhone?: string;
    buyerName?: string;
    quotedStatusImagePhash?: string;
    simulateFastForwardIdleTimer?: boolean;
    sourceChannel?: "WHATSAPP" | "INSTAGRAM" | "FACEBOOK";
  }): Promise<WhatsAppSimulationResult> {
    return request<WhatsAppSimulationResult>("/api/v1/simulate/whatsapp", {
      method: "POST",
      ...jsonBody(input),
    });
  },

  syncWhatsAppCatalog(deleteMissing = true): Promise<{
    result: {
      attempted: number;
      upserted: number;
      deleted: number;
      failed: Array<{ skuCode: string; error: string }>;
      mode: "mock" | "live";
      catalogId: string | null;
    };
    state: VendorState;
  }> {
    return request<{
      result: {
        attempted: number;
        upserted: number;
        deleted: number;
        failed: Array<{ skuCode: string; error: string }>;
        mode: "mock" | "live";
        catalogId: string | null;
      };
      state: VendorState;
    }>("/api/v1/vendor/catalog/sync", {
      method: "POST",
      ...jsonBody({ deleteMissing }),
    });
  },

  requestOtp(
    phone: string,
    purpose: "LOGIN" | "SIGNUP" | "WITHDRAWAL" | "SETTINGS" | "BANK_CHANGE" | "PIN_RESET" = "LOGIN"
  ): Promise<{
    status: string;
    destinationPhone: string;
    purpose: string;
    expiresInSeconds: number;
    isNewVendor?: boolean;
    devCode?: string;
  }> {
    return request("/api/v1/auth/request-otp", {
      method: "POST",
      ...jsonBody({ phone, purpose }),
    });
  },

  async verifyOtp(input: {
    phone: string;
    code: string;
    purpose?: "LOGIN" | "SIGNUP" | "WITHDRAWAL" | "SETTINGS" | "BANK_CHANGE" | "PIN_RESET";
    businessName?: string;
    role?: PlatformRole | "vendor" | "supplier";
    isExistingBusiness?: boolean;
    catalogSelection?: "mirror" | "custom";
  }): Promise<{
    authenticated: boolean;
    token?: string;
    sessionToken?: string;
    vendor: VendorState["vendor"];
    state: VendorState;
  }> {
    const res = await request<{
      authenticated: boolean;
      token?: string;
      sessionToken?: string;
      vendor: VendorState["vendor"];
      state: VendorState;
    }>("/api/v1/auth/verify-otp", {
      method: "POST",
      ...jsonBody(input),
    });
    if (res.token) {
      setStoredSessionToken(res.token);
    }
    return res;
  },

  async requestDemoSession(): Promise<{
    authenticated: boolean;
    token?: string;
    sessionToken?: string;
    vendor: VendorState["vendor"];
    state: VendorState;
  }> {
    const res = await request<{
      authenticated: boolean;
      token?: string;
      sessionToken?: string;
      vendor: VendorState["vendor"];
      state: VendorState;
    }>("/api/v1/auth/demo-session", {
      method: "POST",
    });
    if (res.token) {
      setStoredSessionToken(res.token);
    }
    return res;
  },

  async setupTransactionPin(input: {
    pin: string;
    otpCode?: string;
    currentPin?: string;
  }): Promise<{ status: string; message: string; state: VendorState }> {
    return request("/api/v1/auth/pin/setup", {
      method: "POST",
      ...jsonBody(input),
    });
  },

  async verifyTransactionPin(pin: string): Promise<{ status: string; valid: boolean }> {
    return request("/api/v1/auth/pin/verify", {
      method: "POST",
      ...jsonBody({ pin }),
    });
  },

  async requestBankChange(input: {
    bankCode: string;
    accountNumber: string;
    pin: string;
    otpCode: string;
  }): Promise<{
    status: "linked" | "pending_cooling_off";
    bankName: string;
    accountNumber: string;
    accountName: string;
    effectiveAt?: string;
    cancelToken?: string;
    state: VendorState;
  }> {
    return request("/api/v1/vendor/bank/request-change", {
      method: "POST",
      ...jsonBody(input),
    });
  },

  async applyPendingBankUpdate(): Promise<{ applied: boolean; state: VendorState }> {
    return request("/api/v1/vendor/bank/apply-pending", {
      method: "POST",
    });
  },

  async emergencyFreezeStore(token: string): Promise<{ status: string; message: string; state: VendorState }> {
    return request("/api/v1/security/freeze", {
      method: "POST",
      ...jsonBody({ token }),
    });
  },

  withdrawFunds(input: {
    amountNaira: number;
    bankName?: string;
    accountNumber?: string;
    securityCode?: string;
    pin?: string;
  }): Promise<{
    status: string;
    amountNaira: number;
    bankName: string;
    accountNumber: string;
    reference: string;
    message: string;
    state?: VendorState;
  }> {
    return request("/api/v1/vendor/withdraw", {
      method: "POST",
      ...jsonBody(input),
    });
  },

  updateSecureSettings(input: {
    securityCode: string;
    businessName?: string;
    notifyPhone?: string;
  }): Promise<{
    status: string;
    vendor: VendorState["vendor"];
    state: VendorState;
    message: string;
  }> {
    return request("/api/v1/vendor/settings/secure", {
      method: "POST",
      ...jsonBody(input),
    });
  },

  requestWhatsAppOtp(
    phone: string,
    isSignup = false
  ): Promise<{
    status: string;
    destinationPhone: string;
    expiresInSeconds: number;
    token?: string;
    loginUrl?: string;
    isNewVendor?: boolean;
  }> {
    return request("/api/v1/auth/whatsapp-otp", {
      method: "POST",
      ...jsonBody({ phone, isSignup }),
    });
  },

  async verifyMagicLinkToken(
    token: string
  ): Promise<{
    authenticated: boolean;
    token?: string;
    sessionToken?: string;
    vendor: VendorState["vendor"];
    state: VendorState;
  }> {
    const res = await request<{
      authenticated: boolean;
      token?: string;
      sessionToken?: string;
      vendor: VendorState["vendor"];
      state: VendorState;
    }>("/api/v1/auth/verify", {
      method: "POST",
      ...jsonBody({ token }),
    });
    if (res.token) {
      setStoredSessionToken(res.token);
    }
    return res;
  },

  async onboardVendor(input: {
    phone?: string;
    businessName: string;
    email?: string;
    password?: string;
    passkeyPin?: string;
    slug?: string;
    baseState?: string;
    baseCity?: string;
    role?: PlatformRole | "vendor" | "supplier";
    isExistingBusiness?: boolean;
    catalogSelection?: "mirror" | "custom" | "social";
    cacNumber?: string;
    skipOtp?: boolean;
  }): Promise<{
    status: string;
    token?: string;
    sessionToken?: string;
    loginUrl?: string;
    vendor: VendorState["vendor"];
    state: VendorState;
  }> {
    const res = await request<{
      status: string;
      token?: string;
      sessionToken?: string;
      loginUrl?: string;
      vendor: VendorState["vendor"];
      state: VendorState;
    }>("/api/v1/auth/onboard", {
      method: "POST",
      ...jsonBody(input),
    });
    if (res.token) {
      setStoredSessionToken(res.token);
    }
    return res;
  },

  getNeonStatus(): Promise<Record<string, unknown>> {
    return request("/api/v1/neon/status");
  },

  sealRealtimeQuery(
    table: "orders" | "products",
    vendorId: string,
    limit = 50
  ): Promise<{
    table: string;
    vendorId: string;
    realtimeUrl: string;
    sealed: unknown;
  }> {
    return request("/api/v1/neon/realtime/seal", {
      method: "POST",
      ...jsonBody({ table, vendorId, limit }),
    });
  },

  saveMarketBoost(
    input: Omit<Partial<MarketBoostListing>, "startingPriceNaira"> & {
      startingPriceNaira?: number | string;
    }
  ): Promise<{ status: string; listing: MarketBoostListing; state: VendorState }> {
    return request("/api/v1/vendor/market-boost", {
      method: "PUT",
      ...jsonBody(input),
    });
  },

  mirrorSupplierCatalog(input: {
    supplierIdOrSlug: string;
    productSkus?: string[];
    defaultMarkupBps?: number;
    status?: "ACTIVE" | "PAUSED";
    ignoreGeofence?: boolean;
  }): Promise<{
    status: string;
    mirror: ResellerMirror;
    mirroredProductsCount: number;
    state: VendorState;
  }> {
    return request("/api/v1/vendor/network/mirror", {
      method: "POST",
      ...jsonBody(input),
    });
  },

  getWholesaleSuppliers(params?: {
    state?: string;
    lga?: string;
    category?: string;
    deliverableOnly?: boolean;
  }): Promise<{
    status: string;
    territory: { state: string; lga?: string };
    total: number;
    suppliers: Array<SupplierProfile & { geofence: { deliverable: boolean; reason: string; scope: string } }>;
  }> {
    const query = new URLSearchParams();
    if (params?.state) query.set("state", params.state);
    if (params?.lga) query.set("lga", params.lga);
    if (params?.category) query.set("category", params.category);
    if (params?.deliverableOnly) query.set("deliverableOnly", "true");
    const qs = query.toString();
    return request(`/api/v1/vendor/network/suppliers${qs ? `?${qs}` : ""}`);
  },

  createPaymentLink(input: {
    customerName?: string;
    customerPhone?: string;
    productSku?: string;
    description?: string;
    amountNaira: number | string;
  }): Promise<{ status: string; link: PaymentLinkItem; state: VendorState }> {
    return request("/api/v1/vendor/payment-links", {
      method: "POST",
      ...jsonBody(input),
    });
  },

  deletePaymentLink(slug: string): Promise<VendorState> {
    return request<VendorState>(`/api/v1/vendor/payment-links/${encodeURIComponent(slug)}`, {
      method: "DELETE",
    });
  },

  saveSplitRule(input: {
    name?: string;
    supplierSubAccountCode?: string;
    supplierShareBps: number;
    resellerShareBps: number;
    platformFeeBps?: number;
  }): Promise<{ status: string; rule: SettlementSplitRuleItem; state: VendorState }> {
    return request("/api/v1/vendor/split-rules", {
      method: "PUT",
      ...jsonBody(input),
    });
  },

  submitKyc(input: {
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
  }): Promise<{ status: string; submission: KycSubmissionItem; state: VendorState }> {
    return request("/api/v1/vendor/kyc", {
      method: "POST",
      ...jsonBody(input),
    });
  },

  saveTeamMember(input: {
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
  }): Promise<{ status: string; member: TeamMemberItem; state: VendorState }> {
    return request("/api/v1/vendor/team", {
      method: "POST",
      ...jsonBody(input),
    });
  },

  deleteTeamMember(idOrEmail: string): Promise<VendorState> {
    return request<VendorState>(`/api/v1/vendor/team/${encodeURIComponent(idOrEmail)}`, {
      method: "DELETE",
    });
  },

  async staffLogin(email: string): Promise<{
    authenticated: boolean;
    token: string;
    session: {
      email?: string;
      staffMemberId?: string;
      staffName?: string;
      staffRole: string;
      isOwner: boolean;
      permissions: {
        canManageOrders: boolean;
        canManageInventory: boolean;
        canViewPayouts: boolean;
        canProcessRefunds: boolean;
        canOverrideCopilot: boolean;
      };
    };
    member: TeamMemberItem;
    state: VendorState;
  }> {
    const res = await request<{
      authenticated: boolean;
      token: string;
      session: {
        email?: string;
        staffMemberId?: string;
        staffName?: string;
        staffRole: string;
        isOwner: boolean;
        permissions: {
          canManageOrders: boolean;
          canManageInventory: boolean;
          canViewPayouts: boolean;
          canProcessRefunds: boolean;
          canOverrideCopilot: boolean;
        };
      };
      member: TeamMemberItem;
      state: VendorState;
    }>("/api/v1/auth/staff-login", {
      method: "POST",
      ...jsonBody({ email }),
    });
    if (res.token) {
      setStoredSessionToken(res.token);
    }
    return res;
  },

  getCurrentSession(): Promise<{
    authenticated: boolean;
    session: {
      email?: string;
      staffMemberId?: string;
      staffName?: string;
      staffRole: string;
      isOwner: boolean;
      permissions: {
        canManageOrders: boolean;
        canManageInventory: boolean;
        canViewPayouts: boolean;
        canProcessRefunds: boolean;
        canOverrideCopilot: boolean;
      };
    } | null;
  }> {
    return request("/api/v1/auth/session");
  },

  syncNotifications(input: {
    readKeys?: string[];
    dismissedKeys?: string[];
    markAllRead?: boolean;
  }): Promise<VendorState> {
    return request<VendorState>("/api/v1/vendor/notifications/sync", {
      method: "POST",
      ...jsonBody(input),
    });
  },

  upgradeSubscription(input: {
    planId: SubscriptionPlanId;
    billingCycle?: BillingCycle;
  }): Promise<{ status: string; subscription: SubscriptionInfo; state: VendorState }> {
    return request("/api/v1/vendor/subscription/upgrade", {
      method: "POST",
      ...jsonBody(input),
    });
  },

  fastTrackTrustTier(input?: {
    cacNumber?: string;
  }): Promise<{ status: string; trustTier: TrustTierInfo; state: VendorState }> {
    return request("/api/v1/vendor/trust-tier/fast-track", {
      method: "POST",
      ...jsonBody(input ?? {}),
    });
  },

  getShipbubbleCouriers(): Promise<{
    mode: "mock" | "sandbox" | "live";
    couriers: Array<{
      name: string;
      service_code: string;
      pin_image: string;
      origin_country: string;
      international: boolean;
      domestic: boolean;
      on_demand: boolean;
      status: string;
    }>;
    wallet: { currency: string; balance: number };
    config: ShipbubbleVendorConfig;
    isHighestTier: boolean;
  }> {
    return request("/api/v1/vendor/shipbubble/couriers");
  },

  validateShipbubblePickupAddress(address: string): Promise<{
    validated: {
      address_code: number;
      formatted_address: string;
      city: string;
      state: string;
      postal_code: string;
    };
    config: ShipbubbleVendorConfig;
    state: VendorState;
  }> {
    return request("/api/v1/vendor/shipbubble/validate-address", {
      method: "POST",
      ...jsonBody({ address }),
    });
  },

  updateShipbubbleConfig(
    input: Partial<ShipbubbleVendorConfig>
  ): Promise<{ config: ShipbubbleVendorConfig; state: VendorState }> {
    return request("/api/v1/vendor/shipbubble/config", {
      method: "PATCH",
      ...jsonBody(input),
    });
  },

  fetchOrderShipbubbleRates(
    shortCode: string,
    input: {
      deliveryAddress?: string;
      weightPreset?: "SMALL_BAG" | "SHOEBOX" | "CARTON" | "CUSTOM";
      customWeightKg?: number;
    } = {}
  ): Promise<{
    orderShortCode: string;
    requestToken: string;
    couriers: ShipbubbleCourierQuoteItem[];
    fastestCourier: ShipbubbleCourierQuoteItem | null;
    cheapestCourier: ShipbubbleCourierQuoteItem | null;
    packageWeightKg: number;
    weightPreset: "SMALL_BAG" | "SHOEBOX" | "CARTON" | "CUSTOM";
    boxName: string;
    isPremiumTier: boolean;
  }> {
    return request(`/api/v1/vendor/orders/${encodeURIComponent(shortCode)}/shipbubble/rates`, {
      method: "POST",
      ...jsonBody(input),
    });
  },

  bookOrderShipbubbleCourier(
    shortCode: string,
    input: {
      requestToken?: string;
      courierId?: string;
      serviceCode?: string;
      deliveryAddress?: string;
      weightPreset?: "SMALL_BAG" | "SHOEBOX" | "CARTON" | "CUSTOM";
      customWeightKg?: number;
    }
  ): Promise<{
    status: string;
    receipt: CourierShipmentReceipt;
    state: VendorState;
  }> {
    return request(`/api/v1/vendor/orders/${encodeURIComponent(shortCode)}/shipbubble/book`, {
      method: "POST",
      ...jsonBody(input),
    });
  },

  simulateOrderShipbubbleStatus(
    shortCode: string,
    status: "pending" | "confirmed" | "picked_up" | "in_transit" | "completed" | "cancelled"
  ): Promise<{
    status: string;
    receipt: CourierShipmentReceipt;
    state: VendorState;
  }> {
    return request(
      `/api/v1/vendor/orders/${encodeURIComponent(shortCode)}/shipbubble/simulate-status`,
      {
        method: "POST",
        ...jsonBody({ status }),
      }
    );
  },

  fetchPublicOrderShipbubbleRates(
    shortCode: string,
    deliveryAddress?: string
  ): Promise<{
    orderShortCode: string;
    requestToken: string;
    couriers: ShipbubbleCourierQuoteItem[];
    fastestCourier: ShipbubbleCourierQuoteItem | null;
    cheapestCourier: ShipbubbleCourierQuoteItem | null;
    packageWeightKg: number;
    boxName: string;
  }> {
    return request(`/api/v1/public/orders/${encodeURIComponent(shortCode)}/shipbubble/rates`, {
      method: "POST",
      ...jsonBody({ deliveryAddress }),
    });
  },

  selectPublicOrderShipbubbleRate(
    shortCode: string,
    input: {
      courierId: string;
      serviceCode: string;
      courierName: string;
      rateNaira: number;
      deliveryAddress?: string;
      requestToken?: string;
    }
  ): Promise<{
    status: string;
    receipt: PublicOrderReceipt;
  }> {
    return request(`/api/v1/public/orders/${encodeURIComponent(shortCode)}/shipbubble/select-rate`, {
      method: "POST",
      ...jsonBody(input),
    });
  },

  getPublicStorefront(
    slug?: string,
    tierOverride?: string
  ): Promise<{
    vendor: {
      id: string;
      slug: string;
      businessName: string;
      role?: PlatformRole;
      whatsappPhone: string;
      verificationStatus: "VERIFIED" | "PENDING" | "REJECTED";
      cacNumber?: string;
      instagramHandle?: string;
      facebookPageName?: string;
      baseState: string;
      baseCity: string;
      reservationTtlMinutes: number;
      subscriptionPlanId: string;
    };
    canUseFullWebsite: boolean;
    storefrontConfig: import("./storefront-presets").StorefrontConfig;
    presets: import("./storefront-presets").StorefrontPresetDefinition[];
    products: import("./types").Product[];
    shippingZones: import("./types").ShippingZone[];
    discounts: import("./types").Discount[];
  }> {
    const slugSegment = slug ? `/${encodeURIComponent(slug)}` : "";
    const query = tierOverride ? `?tier=${encodeURIComponent(tierOverride)}` : "";
    return request(`/api/v1/public/storefront${slugSegment}${query}`);
  },

  createPublicStorefrontOrder(
    input: {
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
    },
    slug?: string
  ): Promise<{
    status: "created";
    orderShortCode: string;
    receipt: PublicOrderReceipt;
  }> {
    const slugSegment = slug ? `/${encodeURIComponent(slug)}` : "";
    return request(`/api/v1/public/storefront${slugSegment}/checkout`, {
      method: "POST",
      ...jsonBody(input),
    });
  },

  saveStorefrontConfig(
    config: Partial<import("./storefront-presets").StorefrontConfig>,
    roleOrPlan?: string
  ): Promise<{
    status: "saved";
    storefrontConfig: import("./storefront-presets").StorefrontConfig;
    state: VendorState;
  }> {
    return request(`/api/v1/vendor/storefront`, {
      method: "PUT",
      ...jsonBody({ config, roleOrPlan }),
    });
  },

  async loginWithCredentials(input: {
    email?: string;
    phone?: string;
    password?: string;
    passkeyPin?: string;
  }): Promise<{
    authenticated: boolean;
    token: string;
    vendor: VendorState["vendor"];
    state: VendorState;
  }> {
    const res = await request<{
      authenticated: boolean;
      token: string;
      vendor: VendorState["vendor"];
      state: VendorState;
    }>("/api/v1/auth/login", {
      method: "POST",
      ...jsonBody(input),
    });
    if (res.token) {
      setStoredSessionToken(res.token);
    }
    return res;
  },

  syncSocialAccount(input: {
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
    status: string;
    socialAccount: import("./types").SocialAccountSync;
    importedProductsCount: number;
    syncedCustomersCount: number;
    state: VendorState;
  }> {
    return request("/api/v1/vendor/social-accounts/sync", {
      method: "POST",
      ...jsonBody(input),
    });
  },

  updateFeatureFlags(
    input: Partial<import("./types").VendorFeatureFlags>
  ): Promise<{
    status: string;
    featureFlags: import("./types").VendorFeatureFlags;
    state: VendorState;
  }> {
    return request("/api/v1/vendor/features", {
      method: "PATCH",
      ...jsonBody(input),
    });
  },

  setupGoogleAuthenticator(input?: {
    email?: string;
    businessName?: string;
    forceNew?: boolean;
  }): Promise<{
    status: string;
    secret: string;
    formattedSecret: string;
    issuer: string;
    accountLabel: string;
    otpauthUrl: string;
    currentCode: string;
    totpEnabled: boolean;
  }> {
    return request("/api/v1/auth/totp/setup", {
      method: "POST",
      ...jsonBody(input ?? {}),
    });
  },

  async verifyGoogleAuthenticator(input: {
    code: string;
    secret?: string;
    email?: string;
    purpose?: "LOGIN" | "SIGNUP" | "SETTINGS";
  }): Promise<{
    verified: boolean;
    authenticated?: boolean;
    token?: string;
    totpEnabled?: boolean;
    vendor?: VendorState["vendor"];
    state: VendorState;
  }> {
    const res = await request<{
      verified: boolean;
      authenticated?: boolean;
      token?: string;
      totpEnabled?: boolean;
      vendor?: VendorState["vendor"];
      state: VendorState;
    }>("/api/v1/auth/totp/verify", {
      method: "POST",
      ...jsonBody(input),
    });
    if (res.token) {
      setStoredSessionToken(res.token);
    }
    return res;
  },
};

export type { Order };
