/**
 * Integration mode & credential configuration.
 *
 * Every external provider can run in one of three modes:
 *  - `mock`    — fully in-process, no network calls, deterministic test data.
 *  - `sandbox` — real provider APIs pointed at their sandbox/test environment.
 *  - `live`    — real provider APIs pointed at production.
 *
 * WhatsApp Cloud API only distinguishes `mock` (local outbox) from `live`
 * (Graph API), while the WhatsApp catalog has its own toggle so commerce sync
 * can be exercised independently of message delivery.
 *
 * Values are resolved from `process.env` but every resolver accepts an explicit
 * env object so the behaviour can be unit-tested without mutating the process.
 */

export type IntegrationMode = "mock" | "sandbox" | "live";
export type WhatsAppMode = "mock" | "live";
export type CatalogMode = "mock" | "live";

export const MONNIFY_SANDBOX_BASE_URL = "https://sandbox.monnify.com";
export const MONNIFY_LIVE_BASE_URL = "https://api.monnify.com";
export const WHATSAPP_GRAPH_BASE_URL = "https://graph.facebook.com";
export const DEFAULT_WHATSAPP_GRAPH_VERSION = "v21.0";
export const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

export type EnvLike = Record<string, string | undefined>;

export interface MonnifyIntegrationConfig {
  mode: IntegrationMode;
  baseUrl: string;
  apiKey: string;
  secretKey: string;
  contractCode: string;
  requestTimeoutMs: number;
  redirectUrl?: string;
  /** Comma-separated payment methods accepted by the checkout (e.g. `CARD,ACCOUNT_TRANSFER`). */
  paymentMethods?: string;
}

export interface WhatsAppIntegrationConfig {
  mode: WhatsAppMode;
  accessToken: string;
  defaultPhoneNumberId: string;
  appSecret: string;
  verifyToken: string;
  graphApiVersion: string;
}

export interface WhatsAppCatalogIntegrationConfig {
  mode: CatalogMode;
  catalogId: string;
  businessAccountId: string;
  accessToken: string;
  graphApiVersion: string;
  requestTimeoutMs: number;
}

export interface IntegrationConfig {
  monnify: MonnifyIntegrationConfig;
  whatsapp: WhatsAppIntegrationConfig;
  catalog: WhatsAppCatalogIntegrationConfig;
}

export interface ConfigIssue {
  severity: "error" | "warning";
  provider: "monnify" | "whatsapp" | "catalog";
  variable: string;
  message: string;
}

function read(env: EnvLike, key: string): string | undefined {
  const raw = env[key];
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readBoolean(env: EnvLike, key: string): boolean | undefined {
  const raw = read(env, key);
  if (raw === undefined) return undefined;
  return !["false", "0", "no", "off"].includes(raw.toLowerCase());
}

function readPositiveInt(env: EnvLike, key: string, fallback: number): number {
  const raw = read(env, key);
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Placeholder detection so a live mode never silently runs with `.env.example` values. */
export function isPlaceholderValue(value: string | undefined): boolean {
  if (!value) return true;
  const normalized = value.trim().toUpperCase();
  return (
    normalized.length === 0 ||
    normalized.includes("PLACEHOLDER") ||
    normalized.includes("CHANGE_ME") ||
    normalized.includes("CHANGEME") ||
    normalized === "TODO"
  );
}

function parseMonnifyMode(env: EnvLike): IntegrationMode {
  const explicit = read(env, "MONNIFY_MODE")?.toLowerCase();
  if (explicit === "mock" || explicit === "sandbox" || explicit === "live") {
    return explicit;
  }

  // Legacy boolean switch: false means "use the real API", which is sandbox
  // unless the configured base URL points at production.
  const legacyMock = readBoolean(env, "MONNIFY_SANDBOX_MOCK");
  if (legacyMock !== undefined) {
    if (legacyMock) return "mock";
    const baseUrl = read(env, "MONNIFY_BASE_URL") ?? MONNIFY_SANDBOX_BASE_URL;
    return baseUrl.includes("sandbox.monnify.com") ? "sandbox" : "live";
  }

  // Safe default for a fresh checkout: never touch the network without opting in.
  return "mock";
}

export function resolveMonnifyConfig(env: EnvLike = process.env): MonnifyIntegrationConfig {
  const mode = parseMonnifyMode(env);
  const fallbackBaseUrl =
    mode === "live" ? MONNIFY_LIVE_BASE_URL : MONNIFY_SANDBOX_BASE_URL;

  return {
    mode,
    baseUrl: (read(env, "MONNIFY_BASE_URL") ?? fallbackBaseUrl).replace(/\/+$/, ""),
    apiKey: read(env, "MONNIFY_API_KEY") ?? "",
    secretKey: read(env, "MONNIFY_SECRET_KEY") ?? "",
    contractCode: read(env, "MONNIFY_CONTRACT_CODE") ?? "",
    requestTimeoutMs: readPositiveInt(env, "MONNIFY_TIMEOUT_MS", DEFAULT_REQUEST_TIMEOUT_MS),
    redirectUrl: read(env, "MONNIFY_REDIRECT_URL"),
    paymentMethods: read(env, "MONNIFY_PAYMENT_METHODS"),
  };
}

function parseWhatsAppMode(env: EnvLike): WhatsAppMode {
  const explicit = read(env, "WHATSAPP_MODE")?.toLowerCase();
  if (explicit === "mock" || explicit === "live") return explicit;

  const legacyMock = readBoolean(env, "WHATSAPP_SANDBOX_MOCK");
  if (legacyMock !== undefined) return legacyMock ? "mock" : "live";

  return "mock";
}

export function resolveWhatsAppConfig(
  env: EnvLike = process.env
): WhatsAppIntegrationConfig {
  return {
    mode: parseWhatsAppMode(env),
    accessToken: read(env, "WHATSAPP_ACCESS_TOKEN") ?? "",
    defaultPhoneNumberId: read(env, "WHATSAPP_PHONE_NUMBER_ID") ?? "",
    appSecret: read(env, "WHATSAPP_APP_SECRET") ?? "",
    verifyToken: read(env, "WHATSAPP_VERIFY_TOKEN") ?? "caterlog-whatsapp-verify-token",
    graphApiVersion:
      read(env, "WHATSAPP_GRAPH_API_VERSION") ?? DEFAULT_WHATSAPP_GRAPH_VERSION,
  };
}

function parseCatalogMode(env: EnvLike): CatalogMode {
  const explicit = read(env, "WHATSAPP_CATALOG_MODE")?.toLowerCase();
  if (explicit === "mock" || explicit === "live") return explicit;

  // Catalog sync defaults to mirroring WhatsApp: mock outbox unless opted in.
  return parseWhatsAppMode(env);
}

export function resolveWhatsAppCatalogConfig(
  env: EnvLike = process.env
): WhatsAppCatalogIntegrationConfig {
  return {
    mode: parseCatalogMode(env),
    catalogId: read(env, "WHATSAPP_CATALOG_ID") ?? "",
    businessAccountId:
      read(env, "WHATSAPP_BUSINESS_ACCOUNT_ID") ?? read(env, "WHATSAPP_WABA_ID") ?? "",
    accessToken: read(env, "WHATSAPP_ACCESS_TOKEN") ?? "",
    graphApiVersion:
      read(env, "WHATSAPP_GRAPH_API_VERSION") ?? DEFAULT_WHATSAPP_GRAPH_VERSION,
    requestTimeoutMs: readPositiveInt(
      env,
      "WHATSAPP_CATALOG_TIMEOUT_MS",
      DEFAULT_REQUEST_TIMEOUT_MS
    ),
  };
}

export function resolveIntegrationConfig(env: EnvLike = process.env): IntegrationConfig {
  return {
    monnify: resolveMonnifyConfig(env),
    whatsapp: resolveWhatsAppConfig(env),
    catalog: resolveWhatsAppCatalogConfig(env),
  };
}

/**
 * Validates credentials for every provider that is *not* in mock mode.
 * Mock mode never fails validation: it is the zero-config developer default.
 */
export function validateIntegrationConfig(config: IntegrationConfig): ConfigIssue[] {
  const issues: ConfigIssue[] = [];

  if (config.monnify.mode !== "mock") {
    const required: Array<[keyof MonnifyIntegrationConfig, string]> = [
      ["apiKey", "MONNIFY_API_KEY"],
      ["secretKey", "MONNIFY_SECRET_KEY"],
      ["contractCode", "MONNIFY_CONTRACT_CODE"],
      ["baseUrl", "MONNIFY_BASE_URL"],
    ];
    for (const [field, variable] of required) {
      const value = String(config.monnify[field] ?? "");
      if (isPlaceholderValue(value)) {
        issues.push({
          severity: "error",
          provider: "monnify",
          variable,
          message: `${variable} is required when MONNIFY_MODE=${config.monnify.mode}.`,
        });
      }
    }
    if (!config.monnify.baseUrl.startsWith("https://")) {
      issues.push({
        severity: "error",
        provider: "monnify",
        variable: "MONNIFY_BASE_URL",
        message: "Monnify base URL must use https://.",
      });
    }
    if (
      config.monnify.mode === "live" &&
      config.monnify.baseUrl.includes("sandbox.monnify.com")
    ) {
      issues.push({
        severity: "warning",
        provider: "monnify",
        variable: "MONNIFY_BASE_URL",
        message:
          "MONNIFY_MODE=live still points at sandbox.monnify.com. Set MONNIFY_BASE_URL=https://api.monnify.com.",
      });
    }
    if (
      config.monnify.mode === "sandbox" &&
      config.monnify.baseUrl.includes("api.monnify.com")
    ) {
      issues.push({
        severity: "warning",
        provider: "monnify",
        variable: "MONNIFY_BASE_URL",
        message:
          "MONNIFY_MODE=sandbox points at api.monnify.com. Use https://sandbox.monnify.com for test keys.",
      });
    }
  }

  if (config.whatsapp.mode === "live") {
    const required: Array<[keyof WhatsAppIntegrationConfig, string]> = [
      ["accessToken", "WHATSAPP_ACCESS_TOKEN"],
      ["defaultPhoneNumberId", "WHATSAPP_PHONE_NUMBER_ID"],
      ["appSecret", "WHATSAPP_APP_SECRET"],
      ["verifyToken", "WHATSAPP_VERIFY_TOKEN"],
    ];
    for (const [field, variable] of required) {
      const value = String(config.whatsapp[field] ?? "");
      if (isPlaceholderValue(value)) {
        issues.push({
          severity: "error",
          provider: "whatsapp",
          variable,
          message: `${variable} is required when WHATSAPP_MODE=live.`,
        });
      }
    }
  }

  if (config.catalog.mode === "live") {
    const required: Array<[keyof WhatsAppCatalogIntegrationConfig, string]> = [
      ["catalogId", "WHATSAPP_CATALOG_ID"],
      ["businessAccountId", "WHATSAPP_BUSINESS_ACCOUNT_ID"],
      ["accessToken", "WHATSAPP_ACCESS_TOKEN"],
    ];
    for (const [field, variable] of required) {
      const value = String(config.catalog[field] ?? "");
      if (isPlaceholderValue(value)) {
        issues.push({
          severity: "error",
          provider: "catalog",
          variable,
          message: `${variable} is required when WHATSAPP_CATALOG_MODE=live.`,
        });
      }
    }
  }

  return issues;
}

export function configErrors(config: IntegrationConfig): ConfigIssue[] {
  return validateIntegrationConfig(config).filter((issue) => issue.severity === "error");
}

/**
 * Fail fast at startup when a real integration is selected but not configured.
 * Mock mode is always allowed so `npm run dev` works on a fresh clone.
 */
export function assertValidIntegrationConfig(config: IntegrationConfig): void {
  const errors = configErrors(config);
  if (errors.length === 0) return;
  const detail = errors
    .map((issue) => `  • [${issue.provider}] ${issue.variable}: ${issue.message}`)
    .join("\n");
  throw new Error(
    `Invalid integration configuration. Fix the following before starting the API:\n${detail}`
  );
}

/** Redacted, dashboard-safe summary of the active integration modes. */
export function describeIntegrationConfig(config: IntegrationConfig) {
  const issues = validateIntegrationConfig(config);
  return {
    monnify: {
      mode: config.monnify.mode,
      baseUrl: config.monnify.baseUrl,
      contractCode: redactTail(config.monnify.contractCode, 4),
      credentialsConfigured:
        !isPlaceholderValue(config.monnify.apiKey) &&
        !isPlaceholderValue(config.monnify.secretKey),
      redirectUrlConfigured: Boolean(config.monnify.redirectUrl),
      paymentMethods: config.monnify.paymentMethods ?? null,
    },
    whatsapp: {
      mode: config.whatsapp.mode,
      phoneNumberId: config.whatsapp.defaultPhoneNumberId || null,
      graphApiVersion: config.whatsapp.graphApiVersion,
      credentialsConfigured:
        !isPlaceholderValue(config.whatsapp.accessToken) &&
        !isPlaceholderValue(config.whatsapp.appSecret),
    },
    catalog: {
      mode: config.catalog.mode,
      catalogId: config.catalog.catalogId || null,
      businessAccountId: config.catalog.businessAccountId || null,
      credentialsConfigured: !isPlaceholderValue(config.catalog.accessToken),
    },
    issues,
  };
}

function redactTail(value: string, visible: number): string | null {
  if (isPlaceholderValue(value)) return null;
  if (value.length <= visible) return value;
  return `…${value.slice(-visible)}`;
}
