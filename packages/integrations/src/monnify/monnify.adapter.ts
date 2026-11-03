import crypto from "node:crypto";
import {
  koboToNaira,
  nairaToKobo,
  type CreateVirtualAccountInvoiceRequest,
  type PaymentProviderPort,
  type ServerVerifiedPaymentRecord,
  type VirtualAccountInvoiceResult,
} from "@caterlog/commerce-core";
import {
  MONNIFY_LIVE_BASE_URL,
  MONNIFY_SANDBOX_BASE_URL,
  DEFAULT_REQUEST_TIMEOUT_MS,
  type IntegrationMode,
  type MonnifyIntegrationConfig,
} from "../config.ts";

export interface MonnifyAdapterConfig {
  baseUrl?: string;
  apiKey: string;
  secretKey: string;
  contractCode: string;
  /** Explicit mode. Takes precedence over the legacy `sandboxMock` flag. */
  mode?: IntegrationMode;
  /** Legacy flag retained for existing call sites: `true` means local mock. */
  sandboxMock?: boolean;
  requestTimeoutMs?: number;
  redirectUrl?: string;
  paymentMethods?: string;
}

/** Raw shape of most Monnify `responseBody` transaction payloads. */
interface MonnifyTransactionBody {
  transactionReference?: string;
  paymentReference?: string;
  amountPaid?: number;
  settlementAmount?: number;
  paymentStatus?: string;
  paymentMethod?: string;
  product?: { reference?: string };
  customer?: { name?: string };
  paymentSourceInformation?: Array<{ accountName?: string; bankCode?: string }>;
}

interface MonnifyEnvelope<T> {
  requestSuccessful?: boolean;
  responseMessage?: string;
  responseCode?: string;
  responseBody?: T;
}

/**
 * Monnify Payment Provider Adapter (Implements `PaymentProviderPort` from `@caterlog/commerce-core`).
 *
 * Enforces Principle 10.2:
 * 1. Cryptographic HMAC-SHA512 webhook signature verification.
 * 2. Independent server-to-server transaction verification before marking any order PAID.
 *
 * Modes:
 * - `mock`    — deterministic invoices + in-memory verification ledger, no network.
 * - `sandbox` — real Monnify sandbox (`sandbox.monnify.com`) with `MK_TEST_*` keys.
 * - `live`    — production Monnify (`api.monnify.com`).
 */
export class MonnifyPaymentAdapter implements PaymentProviderPort {
  /** In-memory ledger used only in `mock` mode for local end-to-end testing. */
  private readonly mockTransactions = new Map<string, ServerVerifiedPaymentRecord>();
  private readonly mode: IntegrationMode;
  private readonly config: Required<
    Pick<MonnifyAdapterConfig, "baseUrl" | "apiKey" | "secretKey" | "contractCode" | "requestTimeoutMs">
  > &
    Pick<MonnifyAdapterConfig, "redirectUrl" | "paymentMethods">;

  private tokenCache: { value: string; expiresAtMs: number } | null = null;

  constructor(config: MonnifyAdapterConfig) {
    this.mode = resolveAdapterMode(config);
    const fallbackBaseUrl =
      this.mode === "live" ? MONNIFY_LIVE_BASE_URL : MONNIFY_SANDBOX_BASE_URL;
    this.config = {
      baseUrl: (config.baseUrl ?? fallbackBaseUrl).replace(/\/+$/, ""),
      apiKey: config.apiKey,
      secretKey: config.secretKey,
      contractCode: config.contractCode,
      requestTimeoutMs: config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
      redirectUrl: config.redirectUrl,
      paymentMethods: config.paymentMethods,
    };
  }

  /** Builds an adapter from the resolved environment config. */
  public static fromConfig(config: MonnifyIntegrationConfig): MonnifyPaymentAdapter {
    return new MonnifyPaymentAdapter({
      mode: config.mode,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      secretKey: config.secretKey,
      contractCode: config.contractCode,
      requestTimeoutMs: config.requestTimeoutMs,
      redirectUrl: config.redirectUrl,
      paymentMethods: config.paymentMethods,
    });
  }

  public getMode(): IntegrationMode {
    return this.mode;
  }

  public isMockMode(): boolean {
    return this.mode === "mock";
  }

  /**
   * Dashboard-safe integration status (never exposes secrets or the full token).
   */
  public getIntegrationStatus() {
    return {
      provider: "MONNIFY" as const,
      mode: this.mode,
      baseUrl: this.config.baseUrl,
      contractCodeSuffix:
        this.config.contractCode.length > 4
          ? `…${this.config.contractCode.slice(-4)}`
          : null,
      credentialsConfigured:
        Boolean(this.config.apiKey) && Boolean(this.config.secretKey),
      tokenCached: this.tokenCache !== null && this.tokenCache.expiresAtMs > Date.now(),
    };
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
   * Registers a simulated bank transfer in mock mode so `verifyTransactionServerToServer`
   * can independently verify it during local end-to-end tests.
   */
  public seedMockVerifiedTransfer(record: ServerVerifiedPaymentRecord): void {
    if (!this.isMockMode()) {
      throw new Error(
        "seedMockVerifiedTransfer is only available in MONNIFY_MODE=mock. Use Monnify's sandbox Bank Simulator for sandbox transfers."
      );
    }
    this.mockTransactions.set(record.providerTransactionRef, record);
  }

  public async createDynamicVirtualAccount(
    req: CreateVirtualAccountInvoiceRequest
  ): Promise<VirtualAccountInvoiceResult> {
    const invoiceReference = `CAT_${req.orderShortCode.replace(/[^A-Z0-9]/gi, "")}_${Date.now()}`;

    if (this.isMockMode()) {
      // Deterministic 10-digit NUBAN starting with "80" (Moniepoint style)
      const numericTail = String(Math.abs(this.hashString(invoiceReference)))
        .padStart(8, "0")
        .slice(0, 8);
      return {
        provider: "MONNIFY",
        invoiceReference,
        accountNumber: `80${numericTail}`,
        bankName: "Moniepoint MFB",
        accountName: `CATERLOG / ${req.vendorBusinessName.toUpperCase().slice(0, 22)}`,
        checkoutUrl: `https://sandbox.monnify.com/checkout/${invoiceReference}`,
        expiresAt: req.expiresAt,
      };
    }

    const token = await this.getAccessToken();
    const json = await this.request<{
      invoiceReference?: string;
      accountNumber?: string;
      bankName?: string;
      accountName?: string;
      checkoutUrl?: string;
    }>("/api/v1/invoice/create", {
      method: "POST",
      token,
      body: {
        amount: koboToNaira(req.expectedAmountKobo),
        invoiceReference,
        description: `Order ${req.orderShortCode} - ${req.vendorBusinessName}`,
        currencyCode: "NGN",
        contractCode: this.config.contractCode,
        customerEmail: `${req.customerPhone.replace(/\+/g, "")}@whatsapp.caterlog.store`,
        customerName: req.customerName ?? req.customerPhone,
        expiryDate: req.expiresAt.toISOString().replace("T", " ").slice(0, 19),
        ...(this.config.redirectUrl ? { redirectUrl: this.config.redirectUrl } : {}),
        ...(this.config.paymentMethods
          ? {
              paymentMethods: this.config.paymentMethods
                .split(",")
                .map((method) => method.trim())
                .filter(Boolean),
            }
          : {}),
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
      },
    });

    const body = json.responseBody;
    if (!body?.invoiceReference || !body.accountNumber) {
      throw new Error(
        `Monnify invoice creation returned an incomplete response: ${json.responseMessage ?? "missing invoiceReference/accountNumber"}`
      );
    }

    return {
      provider: "MONNIFY",
      invoiceReference: body.invoiceReference,
      accountNumber: body.accountNumber,
      bankName: body.bankName ?? "Monnify",
      accountName: body.accountName ?? req.vendorBusinessName,
      checkoutUrl: body.checkoutUrl,
      expiresAt: req.expiresAt,
    };
  }

  public async verifyTransactionServerToServer(
    providerTransactionRef: string
  ): Promise<ServerVerifiedPaymentRecord> {
    if (this.isMockMode()) {
      const mock = this.mockTransactions.get(providerTransactionRef);
      if (!mock) {
        throw new Error(
          `Mock transaction "${providerTransactionRef}" not found in the local verification ledger.`
        );
      }
      return mock;
    }

    const json = await this.request<MonnifyTransactionBody>(
      `/api/v2/transactions/${encodeURIComponent(providerTransactionRef)}`,
      { method: "GET" }
    );

    const body = json.responseBody;
    if (!body?.transactionReference) {
      throw new Error(
        `Monnify transaction verification returned no transaction for "${providerTransactionRef}".`
      );
    }

    return this.toVerifiedRecord(body, body.paymentReference ?? body.product?.reference ?? "");
  }

  /**
   * Polling fallback for orders whose webhook may not have arrived (common while
   * developing behind a tunnel). Looks up the invoice's transaction by
   * `paymentReference` and returns `null` when no completed transfer is found yet.
   */
  public async verifyPaymentByInvoiceReference(
    invoiceReference: string
  ): Promise<ServerVerifiedPaymentRecord | null> {
    if (this.isMockMode()) {
      return (
        Array.from(this.mockTransactions.values()).find(
          (record) =>
            record.invoiceReference === invoiceReference ||
            record.paymentReference === invoiceReference
        ) ?? null
      );
    }

    const params = new URLSearchParams({
      paymentReference: invoiceReference,
      page: "0",
      size: "10",
    });
    const json = await this.request<{ content?: MonnifyTransactionBody[] }>(
      `/api/v1/transactions/search?${params.toString()}`,
      { method: "GET" }
    );

    const transactions = json.responseBody?.content ?? [];
    const completed = transactions.find((tx) => {
      const status = tx.paymentStatus?.toUpperCase();
      return (
        (status === "PAID" || status === "OVERPAID" || status === "PARTIALLY_PAID") &&
        (tx.amountPaid ?? 0) > 0
      );
    });
    if (!completed) return null;

    return this.toVerifiedRecord(completed, invoiceReference);
  }

  private toVerifiedRecord(
    body: MonnifyTransactionBody,
    invoiceReference: string
  ): ServerVerifiedPaymentRecord {
    const source = body.paymentSourceInformation?.[0];
    return {
      providerTransactionRef: body.transactionReference ?? "",
      paymentReference: body.paymentReference ?? invoiceReference,
      invoiceReference,
      paymentStatus: normalizePaymentStatus(body.paymentStatus),
      amountPaidKobo: nairaToKobo(body.amountPaid ?? 0),
      settlementAmountKobo:
        body.settlementAmount !== undefined ? nairaToKobo(body.settlementAmount) : undefined,
      payerName: source?.accountName ?? body.customer?.name,
      payerBankName: source?.bankCode,
      paymentMethod: body.paymentMethod ?? "UNKNOWN",
      serverVerifiedAt: new Date(),
      rawResponse: body as unknown as Record<string, unknown>,
    };
  }

  private async getAccessToken(forceRefresh = false): Promise<string> {
    const now = Date.now();
    if (!forceRefresh && this.tokenCache && this.tokenCache.expiresAtMs > now) {
      return this.tokenCache.value;
    }

    const basic = Buffer.from(`${this.config.apiKey}:${this.config.secretKey}`).toString(
      "base64"
    );
    const response = await fetch(`${this.config.baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { Authorization: `Basic ${basic}` },
      signal: AbortSignal.timeout(this.config.requestTimeoutMs),
    });
    if (!response.ok) {
      throw new Error(`Monnify auth login failed with status ${response.status}`);
    }

    const data = (await response.json()) as MonnifyEnvelope<{
      accessToken?: string;
      expiresIn?: number | string;
    }>;
    const accessToken = data.responseBody?.accessToken;
    if (!accessToken) {
      throw new Error("Monnify auth login returned no access token.");
    }

    const expiresInSeconds = Number(data.responseBody?.expiresIn ?? 3600);
    const ttlMs = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
      ? expiresInSeconds * 1000
      : 3_600_000;
    // Refresh one minute early so an in-flight request never uses a just-expired token.
    this.tokenCache = { value: accessToken, expiresAtMs: now + Math.max(30_000, ttlMs - 60_000) };
    return accessToken;
  }

  private async request<T>(
    path: string,
    init: { method: string; token?: string; body?: unknown }
  ): Promise<MonnifyEnvelope<T>> {
    const token = init.token ?? (await this.getAccessToken());
    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}${path}`, {
        method: init.method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: AbortSignal.timeout(this.config.requestTimeoutMs),
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`Monnify request ${init.method} ${path} failed: ${reason}`);
    }

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(
        `Monnify request ${init.method} ${path} failed (${response.status}): ${raw.slice(0, 500)}`
      );
    }

    let json: MonnifyEnvelope<T>;
    try {
      json = JSON.parse(raw) as MonnifyEnvelope<T>;
    } catch {
      throw new Error(
        `Monnify returned non-JSON for ${init.method} ${path}: ${raw.slice(0, 200)}`
      );
    }

    if (json.requestSuccessful === false) {
      throw new Error(
        `Monnify rejected ${init.method} ${path}: ${json.responseMessage ?? json.responseCode ?? "unknown error"}`
      );
    }

    return json;
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

function resolveAdapterMode(config: MonnifyAdapterConfig): IntegrationMode {
  if (config.mode) return config.mode;
  if (config.sandboxMock === true) return "mock";
  if (config.sandboxMock === false) {
    return (config.baseUrl ?? "").includes("sandbox.monnify.com") ? "sandbox" : "live";
  }
  return "mock";
}

function normalizePaymentStatus(
  status: string | undefined
): ServerVerifiedPaymentRecord["paymentStatus"] {
  switch (status?.toUpperCase()) {
    case "PAID":
      return "PAID";
    case "OVERPAID":
      return "OVERPAID";
    case "PARTIALLY_PAID":
      return "PARTIALLY_PAID";
    case "PENDING":
    case "IN_PROGRESS":
    case "AWAITING_PAYMENT":
      return "PENDING";
    default:
      // FAILED, REVERSED, EXPIRED, CANCELLED and unknown statuses are not payable.
      return "FAILED";
  }
}
