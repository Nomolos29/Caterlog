import type {
  Discount,
  MonnifySimulationResult,
  Order,
  OrderWaybill,
  PublicOrderReceipt,
  VendorState,
  WhatsAppSimulationResult,
} from "./types";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"
).replace(/\/+$/, "");

/**
 * Normalizes image URLs so relative backend media endpoints (/api/v1/media/...)
 * resolve to the full API server address.
 */
export function resolveImageUrl(url?: string): string {
  if (!url) return "";
  if (url.startsWith("/api/v1/media/")) {
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
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
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `Request failed with HTTP ${response.status}`;
    throw new ApiError(response.status, message);
  }

  return data as T;
}

function jsonBody(value: unknown): RequestInit {
  return { body: JSON.stringify(value) };
}

export const api = {
  eventsUrl: `${API_BASE_URL}/api/v1/events`,

  ogCardUrl(sku: string, cacheBust?: number): string {
    const query = cacheBust ? `?t=${cacheBust}` : "";
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
  }): Promise<VendorState> {
    return request<VendorState>("/api/v1/vendor/discounts", {
      method: "POST",
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
    purpose: "LOGIN" | "SIGNUP" | "WITHDRAWAL" | "SETTINGS" = "LOGIN"
  ): Promise<{
    status: string;
    destinationPhone: string;
    purpose: string;
    expiresInSeconds: number;
    isNewVendor?: boolean;
  }> {
    return request("/api/v1/auth/request-otp", {
      method: "POST",
      ...jsonBody({ phone, purpose }),
    });
  },

  verifyOtp(input: {
    phone: string;
    code: string;
    purpose?: "LOGIN" | "SIGNUP" | "WITHDRAWAL" | "SETTINGS";
    businessName?: string;
    isExistingBusiness?: boolean;
    catalogSelection?: "mirror" | "custom";
  }): Promise<{
    authenticated: boolean;
    token?: string;
    vendor: VendorState["vendor"];
    state: VendorState;
  }> {
    return request("/api/v1/auth/verify-otp", {
      method: "POST",
      ...jsonBody(input),
    });
  },

  withdrawFunds(input: {
    amountNaira: number;
    bankName: string;
    accountNumber: string;
    securityCode: string;
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

  verifyMagicLinkToken(
    token: string
  ): Promise<{
    authenticated: boolean;
    vendor: VendorState["vendor"];
    state: VendorState;
  }> {
    return request("/api/v1/auth/verify", {
      method: "POST",
      ...jsonBody({ token }),
    });
  },

  onboardVendor(input: {
    phone: string;
    businessName: string;
    isExistingBusiness?: boolean;
    catalogSelection?: "mirror" | "custom";
    cacNumber?: string;
  }): Promise<{
    status: string;
    token: string;
    loginUrl?: string;
    vendor: VendorState["vendor"];
    state: VendorState;
  }> {
    return request("/api/v1/auth/onboard", {
      method: "POST",
      ...jsonBody(input),
    });
  },
};

export type { Order };
