import crypto from "node:crypto";
import {
  koboToNaira,
  nairaToKobo,
  type CreateVirtualAccountInvoiceRequest,
  type PaymentProviderPort,
  type ServerVerifiedPaymentRecord,
  type VirtualAccountInvoiceResult,
} from "@caterlog/commerce-core";

export interface MonnifyAdapterConfig {
  baseUrl: string;
  apiKey: string;
  secretKey: string;
  contractCode: string;
  sandboxMock: boolean;
}

/**
 * Monnify Payment Provider Adapter (Implements `PaymentProviderPort` from `@caterlog/commerce-core`).
 *
 * Enforces Principle 10.2:
 * 1. Cryptographic HMAC-SHA512 webhook signature verification.
 * 2. Independent server-to-server `GET /api/v2/transactions/{ref}` verification before marking any order PAID.
 */
export class MonnifyPaymentAdapter implements PaymentProviderPort {
  /** In-memory sandbox ledger used when `MONNIFY_SANDBOX_MOCK=true` for local testing */
  private readonly mockTransactions = new Map<string, ServerVerifiedPaymentRecord>();
  private readonly config: MonnifyAdapterConfig;

  constructor(config: MonnifyAdapterConfig) {
    this.config = config;
  }

  /**
   * Verifies Monnify's `monnify-signature` header using HMAC-SHA512 over the raw request body.
   */
  public verifyWebhookSignature(rawBody: string | Buffer, signatureHeader?: string): boolean {
    if (!signatureHeader) return false;
    const computed = crypto
      .createHmac("sha512", this.config.secretKey)
      .update(rawBody)
      .digest("hex");
    const a = Buffer.from(computed, "utf8");
    const b = Buffer.from(signatureHeader.trim(), "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  /**
   * Computes a valid HMAC-SHA512 signature (useful for local webhook testing).
   */
  public signPayloadForTesting(rawBody: string): string {
    return crypto.createHmac("sha512", this.config.secretKey).update(rawBody).digest("hex");
  }

  /**
   * Registers a simulated bank transfer in Sandbox Mock mode so `verifyTransactionServerToServer`
   * can independently verify it during local end-to-end tests.
   */
  public seedMockVerifiedTransfer(record: ServerVerifiedPaymentRecord): void {
    this.mockTransactions.set(record.providerTransactionRef, record);
  }

  public async createDynamicVirtualAccount(
    req: CreateVirtualAccountInvoiceRequest
  ): Promise<VirtualAccountInvoiceResult> {
    const invoiceReference = `CAT_${req.orderShortCode.replace(/[^A-Z0-9]/gi, "")}_${Date.now()}`;

    if (this.config.sandboxMock) {
      // Generate a deterministic 10-digit NUBAN starting with "80" (Moniepoint style)
      const numericTail = String(Math.abs(this.hashString(invoiceReference))).padStart(8, "0").slice(0, 8);
      const accountNumber = `80${numericTail}`;
      return {
        provider: "MONNIFY",
        invoiceReference,
        accountNumber,
        bankName: "Moniepoint MFB",
        accountName: `CATERLOG / ${req.vendorBusinessName.toUpperCase().slice(0, 22)}`,
        checkoutUrl: `https://sandbox.monnify.com/checkout/${invoiceReference}`,
        expiresAt: req.expiresAt,
      };
    }

    const token = await this.getAccessToken();
    const response = await fetch(`${this.config.baseUrl}/api/v1/invoice/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: koboToNaira(req.expectedAmountKobo),
        invoiceReference,
        description: `Order ${req.orderShortCode} - ${req.vendorBusinessName}`,
        currencyCode: "NGN",
        contractCode: this.config.contractCode,
        customerEmail: `${req.customerPhone.replace(/\+/g, "")}@whatsapp.caterlog.store`,
        customerName: req.customerName ?? req.customerPhone,
        expiryDate: req.expiresAt.toISOString().replace("T", " ").slice(0, 19),
        ...(req.vendorSubAccountCode
          ? {
              incomeSplitConfig: [
                {
                  subAccountCode: req.vendorSubAccountCode,
                  feePercentage: 100,
                  splitPercentage: 98.5,
                  feeBearer: true,
                },
              ],
            }
          : {}),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Monnify invoice creation failed (${response.status}): ${errText}`);
    }

    const json = (await response.json()) as {
      requestSuccessful: boolean;
      responseBody: {
        invoiceReference: string;
        accountNumber: string;
        bankName: string;
        accountName: string;
        checkoutUrl: string;
      };
    };

    return {
      provider: "MONNIFY",
      invoiceReference: json.responseBody.invoiceReference,
      accountNumber: json.responseBody.accountNumber,
      bankName: json.responseBody.bankName,
      accountName: json.responseBody.accountName,
      checkoutUrl: json.responseBody.checkoutUrl,
      expiresAt: req.expiresAt,
    };
  }

  public async verifyTransactionServerToServer(
    providerTransactionRef: string
  ): Promise<ServerVerifiedPaymentRecord> {
    if (this.config.sandboxMock) {
      const mock = this.mockTransactions.get(providerTransactionRef);
      if (!mock) {
        throw new Error(
          `Sandbox mock transaction "${providerTransactionRef}" not found in server verification ledger.`
        );
      }
      return mock;
    }

    const token = await this.getAccessToken();
    const encodedRef = encodeURIComponent(providerTransactionRef);
    const response = await fetch(
      `${this.config.baseUrl}/api/v2/transactions/${encodedRef}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Monnify server verification failed (${response.status}): ${errText}`);
    }

    const json = (await response.json()) as {
      requestSuccessful: boolean;
      responseBody: {
        transactionReference: string;
        paymentReference: string;
        amountPaid: number;
        settlementAmount?: number;
        paymentStatus: "PAID" | "OVERPAID" | "PARTIALLY_PAID" | "PENDING" | "FAILED";
        paymentMethod: string;
        product?: { reference?: string };
        customer?: { name?: string };
        paymentSourceInformation?: Array<{ accountName?: string; bankCode?: string }>;
      };
    };

    const body = json.responseBody;
    const source = body.paymentSourceInformation?.[0];

    return {
      providerTransactionRef: body.transactionReference,
      paymentReference: body.paymentReference,
      invoiceReference: body.product?.reference ?? body.paymentReference,
      paymentStatus: body.paymentStatus,
      amountPaidKobo: nairaToKobo(body.amountPaid),
      settlementAmountKobo:
        body.settlementAmount !== undefined ? nairaToKobo(body.settlementAmount) : undefined,
      payerName: source?.accountName ?? body.customer?.name,
      payerBankName: source?.bankCode,
      paymentMethod: body.paymentMethod,
      serverVerifiedAt: new Date(),
      rawResponse: json as unknown as Record<string, unknown>,
    };
  }

  private async getAccessToken(): Promise<string> {
    const basic = Buffer.from(`${this.config.apiKey}:${this.config.secretKey}`).toString("base64");
    const response = await fetch(`${this.config.baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { Authorization: `Basic ${basic}` },
    });
    if (!response.ok) {
      throw new Error(`Monnify auth login failed with status ${response.status}`);
    }
    const data = (await response.json()) as {
      responseBody: { accessToken: string };
    };
    return data.responseBody.accessToken;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
}

