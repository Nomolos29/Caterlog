/**
 * Hexagonal Ports (Interfaces for External Providers & Future Platform Layers)
 *
 * Principle 10.1, 10.2, 10.3:
 * The Commerce Core defines strict interfaces for external systems.
 * Concrete adapters (Monnify, WhatsApp Cloud API, KYC Providers, Next.js Storefront ISR)
 * implement these interfaces in `packages/integrations` or app layers.
 */

export interface CreateVirtualAccountInvoiceRequest {
  orderId: string;
  orderShortCode: string;
  vendorBusinessName: string;
  vendorSubAccountCode?: string | null;
  customerName?: string | null;
  customerPhone: string;
  expectedAmountKobo: bigint;
  expiresAt: Date;
}

export interface VirtualAccountInvoiceResult {
  provider: "MONNIFY";
  invoiceReference: string;
  accountNumber: string; // 10-digit NUBAN
  bankName: string;
  accountName: string;
  checkoutUrl?: string;
  expiresAt: Date;
}

export interface ServerVerifiedPaymentRecord {
  providerTransactionRef: string;
  paymentReference: string;
  invoiceReference: string;
  paymentStatus: "PAID" | "OVERPAID" | "PARTIALLY_PAID" | "PENDING" | "FAILED";
  amountPaidKobo: bigint;
  settlementAmountKobo?: bigint;
  payerName?: string;
  payerBankName?: string;
  paymentMethod: string;
  serverVerifiedAt: Date;
  rawResponse: Record<string, unknown>;
}

/**
 * Layer 1 Payment Port (Implemented by MonnifyAdapter in `packages/integrations`)
 */
export interface PaymentProviderPort {
  createDynamicVirtualAccount(
    req: CreateVirtualAccountInvoiceRequest
  ): Promise<VirtualAccountInvoiceResult>;

  /**
   * Principle 10.2: Never trust a webhook payload alone. Always verify server-to-server.
   */
  verifyTransactionServerToServer(
    providerTransactionRef: string
  ): Promise<ServerVerifiedPaymentRecord>;
}

/**
 * Layer 1 & 5 Messaging Port (Implemented by WhatsAppCloudAdapter in `packages/integrations`)
 */
export interface MessagingChannelPort {
  sendTextMessage(params: {
    toPhone: string;
    text: string;
    vendorPhoneId?: string | null;
  }): Promise<void>;

  /**
   * Sends the formatted invoice summary followed immediately by a second bubble
   * containing ONLY the 10-digit NUBAN account number for 1-tap mobile copying.
   */
  sendVirtualAccountInvoice(params: {
    toBuyerPhone: string;
    vendorBusinessName: string;
    isVendorVerified: boolean;
    orderShortCode: string;
    productSummary: string;
    totalAmountFormatted: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    expiresInMinutes: number;
    vendorPhoneId?: string | null;
  }): Promise<void>;
}

/**
 * Layer 2 Hook: Identity & Trust Port (BVN / NIN / NUBAN Account Name Matching)
 */
export interface IdentityVerificationPort {
  verifyVendorBankAndIdentity(params: {
    vendorId: string;
    bvnOrNin: string;
    bankCode: string;
    accountNumber: string;
  }): Promise<{
    matched: boolean;
    verifiedAccountName: string;
    identityHash: string; // SHA-256 hash stored for uniqueness; raw BVN/NIN discarded
  }>;
}

/**
 * Layer 3 & 5 Hook: Storefront & Multi-Channel Inventory Sync Port
 * When inventory or pricing changes via WhatsApp, this port notifies the Auto-Generated Website
 * and Meta Catalog without coupling Layer 1 to Next.js or Graph API internals.
 */
export interface MultiChannelSyncPort {
  onVendorCatalogUpdated(vendorId: string, productId?: string): Promise<void>;
}

