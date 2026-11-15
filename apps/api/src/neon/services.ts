import { Files } from "files-sdk";
import { neon as neonStorageAdapter } from "files-sdk/neon";
import { createRealtime, rawSql } from "@neon/realtime/server";
import { functionBaseUrl } from "@neon/env";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { getNeonPgPool, prisma } from "@caterlog/database";

const DEFAULT_BUCKET = process.env.NEON_STORAGE_BUCKET || "assets";

let filesInstance: Files | null = null;

/**
 * Returns a branch-scoped Neon Object Storage client backed by `files-sdk/neon`.
 * Uses the injected `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, and `AWS_REGION`.
 */
export function getNeonStorageFiles(bucket = DEFAULT_BUCKET): Files | null {
  if (
    !process.env.AWS_ENDPOINT_URL_S3 ||
    !process.env.AWS_ACCESS_KEY_ID ||
    !process.env.AWS_SECRET_ACCESS_KEY
  ) {
    return null;
  }
  if (!filesInstance || bucket !== DEFAULT_BUCKET) {
    const client = new Files({ adapter: neonStorageAdapter({ bucket }) });
    if (bucket === DEFAULT_BUCKET) {
      filesInstance = client;
    }
    return client;
  }
  return filesInstance;
}

export async function uploadObjectToNeonBucket(params: {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType?: string;
  bucket?: string;
}): Promise<{ key: string; bucket: string; presignedUrl: string } | null> {
  const bucket = params.bucket || DEFAULT_BUCKET;
  const files = getNeonStorageFiles(bucket);
  if (!files) return null;

  await files.upload(params.key, params.body, {
    contentType: params.contentType || "application/octet-stream",
  });
  const presignedUrl = await files.url(params.key, { expiresIn: 3600 });
  return { key: params.key, bucket, presignedUrl };
}

export async function downloadObjectFromNeonBucket(
  key: string,
  bucket = DEFAULT_BUCKET
): Promise<Buffer | null> {
  const files = getNeonStorageFiles(bucket);
  if (!files) return null;
  const response = await files.download(key);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function getNeonBucketPresignedUrl(
  key: string,
  expiresIn = 3600,
  bucket = DEFAULT_BUCKET
): Promise<string | null> {
  const files = getNeonStorageFiles(bucket);
  if (!files) return null;
  return files.url(key, { expiresIn });
}

/**
 * Neon Realtime server instance & parameterized rawSql live queries.
 */
function resolveDatabaseName(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) return "neondb";
  try {
    const parsed = new URL(raw);
    return parsed.pathname.replace(/^\/+/, "") || "neondb";
  } catch {
    return "neondb";
  }
}

export interface LiveOrderRow {
  id: string;
  shortCode: string;
  status: string;
  totalAmountKobo: string;
  amountPaidKobo: string;
  deliveryAddress: string | null;
  deliveryLandmark: string | null;
  riderPhone: string | null;
}

export interface LiveProductRow {
  id: string;
  skuCode: string;
  name: string;
  category: string | null;
  basePriceKobo: string;
  stockTotal: number;
  stockReserved: number;
}

export function getNeonRealtimeServer() {
  const secret = process.env.NEON_REALTIME_SECRET;
  if (!secret) return null;
  return createRealtime({
    secret,
    db: resolveDatabaseName(),
    ...(process.env.NEON_REALTIME_URL ? { url: process.env.NEON_REALTIME_URL } : {}),
  });
}

export function liveOrdersQuery(vendorSlug: string) {
  return rawSql<LiveOrderRow>(
    `SELECT o.id, o."shortCode", o.status::text AS status, o."totalAmountKobo"::text AS "totalAmountKobo", o."amountPaidKobo"::text AS "amountPaidKobo", o."deliveryAddress", o."deliveryLandmark", o."riderPhone" FROM "Order" o INNER JOIN "Vendor" v ON v.id = o."vendorId" WHERE v.slug = $1 ORDER BY o."createdAt" DESC LIMIT 50`,
    [vendorSlug]
  );
}

export function liveProductsQuery(vendorSlug: string) {
  return rawSql<LiveProductRow>(
    `SELECT p.id, p."skuCode", p.name, p.category, p."basePriceKobo"::text AS "basePriceKobo", p."stockTotal", p."stockReserved" FROM "Product" p INNER JOIN "Vendor" v ON v.id = p."vendorId" WHERE v.slug = $1 AND p."isActive" = true ORDER BY p."createdAt" ASC LIMIT 100`,
    [vendorSlug]
  );
}

export async function sealNeonLiveQuery(
  kind: "orders" | "products",
  vendorSlug: string
) {
  const rt = getNeonRealtimeServer();
  if (!rt) {
    throw new Error("NEON_REALTIME_SECRET is not configured.");
  }
  const query =
    kind === "products" ? liveProductsQuery(vendorSlug) : liveOrdersQuery(vendorSlug);
  const sealedQuery = await rt.seal({ query });
  return {
    kind,
    vendorSlug,
    realtimeUrl: process.env.NEON_REALTIME_URL ?? null,
    db: resolveDatabaseName(),
    sealedQuery,
  };
}

/**
 * Neon Auth (Managed Better Auth) JWKS verification & status check.
 */
let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

export async function verifyNeonAuthToken(
  bearerToken: string
): Promise<{ userId: string; payload: Record<string, unknown> } | null> {
  const jwksUrl = process.env.NEON_AUTH_JWKS_URL;
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  if (!jwksUrl || !baseUrl) return null;

  try {
    if (!cachedJwks) {
      cachedJwks = createRemoteJWKSet(new URL(jwksUrl));
    }
    const issuer = new URL(baseUrl).origin;
    const { payload } = await jwtVerify(bearerToken, cachedJwks, { issuer });
    if (!payload.sub) return null;
    return {
      userId: payload.sub,
      payload: payload as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}

export async function checkNeonAuthStatus(): Promise<{
  configured: boolean;
  baseUrl: string | null;
  jwksUrl: string | null;
  jwksReachable: boolean;
  keysCount: number;
}> {
  const baseUrl = process.env.NEON_AUTH_BASE_URL ?? null;
  const jwksUrl = process.env.NEON_AUTH_JWKS_URL ?? null;
  if (!baseUrl || !jwksUrl) {
    return {
      configured: false,
      baseUrl,
      jwksUrl,
      jwksReachable: false,
      keysCount: 0,
    };
  }

  try {
    const res = await fetch(jwksUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      return {
        configured: true,
        baseUrl,
        jwksUrl,
        jwksReachable: false,
        keysCount: 0,
      };
    }
    const body = (await res.json()) as { keys?: unknown[] };
    return {
      configured: true,
      baseUrl,
      jwksUrl,
      jwksReachable: true,
      keysCount: Array.isArray(body.keys) ? body.keys.length : 0,
    };
  } catch {
    return {
      configured: true,
      baseUrl,
      jwksUrl,
      jwksReachable: false,
      keysCount: 0,
    };
  }
}

/**
 * Neon Functions invocation helper using `functionBaseUrl` from `@neon/env`.
 */
export function resolveNeonFunctionUrl(slug = "hello"): string | null {
  try {
    return functionBaseUrl(slug);
  } catch {
    const branchId = process.env.NEON_BRANCH_ID;
    const suffix = process.env.NEON_FUNCTION_HOST_SUFFIX;
    if (branchId && suffix) {
      return `https://${branchId}-${slug}${suffix}`;
    }
    return null;
  }
}

export async function invokeNeonFunction(
  slug = "hello",
  pathAndQuery = "/status?format=json"
): Promise<{
  url: string;
  status: number;
  text: string;
  json?: unknown;
}> {
  const baseUrl = resolveNeonFunctionUrl(slug);
  if (!baseUrl) {
    throw new Error(
      "Neon Function URL could not be resolved (missing NEON_BRANCH_ID / NEON_FUNCTION_HOST_SUFFIX)."
    );
  }
  const targetUrl = `${baseUrl}${pathAndQuery.startsWith("/") ? pathAndQuery : `/${pathAndQuery}`}`;
  const res = await fetch(targetUrl, {
    headers: { Accept: "application/json, text/plain" },
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let json: unknown = undefined;
  try {
    json = JSON.parse(text);
  } catch {
    // Plain text response
  }
  return {
    url: targetUrl,
    status: res.status,
    text,
    ...(json !== undefined ? { json } : {}),
  };
}

/**
 * Lakebase Postgres direct pool health & txid query helper.
 */
export async function checkNeonPostgresPool(): Promise<{
  connected: boolean;
  database: string | null;
  branch: string | null;
  txid: string | null;
  tableCount: number;
  tables: string[];
  vendorCount: number;
  productCount: number;
  orderCount: number;
}> {
  if (!process.env.DATABASE_URL) {
    return {
      connected: false,
      database: null,
      branch: process.env.NEON_BRANCH ?? null,
      txid: null,
      tableCount: 0,
      tables: [],
      vendorCount: 0,
      productCount: 0,
      orderCount: 0,
    };
  }
  const sql = `
    SELECT
      current_database() AS db,
      pg_current_xact_id()::text AS txid,
      (SELECT count(*)::int FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS table_count,
      (SELECT coalesce(json_agg(table_name ORDER BY table_name), '[]'::json) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS tables,
      (SELECT count(*)::int FROM "Vendor") AS vendor_count,
      (SELECT count(*)::int FROM "Product" WHERE "isActive" = true) AS product_count,
      (SELECT count(*)::int FROM "Order") AS order_count
  `;
  let row:
    | {
        db: string;
        txid: string;
        table_count: number;
        tables: string[];
        vendor_count: number;
        product_count: number;
        order_count: number;
      }
    | undefined;
  try {
    const pool = getNeonPgPool();
    const { rows } = await pool.query<{
      db: string;
      txid: string;
      table_count: number;
      tables: string[];
      vendor_count: number;
      product_count: number;
      order_count: number;
    }>(sql);
    row = rows[0];
  } catch {
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        db: string;
        txid: string;
        table_count: number;
        tables: string[];
        vendor_count: number;
        product_count: number;
        order_count: number;
      }>
    >(sql);
    row = rows[0];
  }
  return {
    connected: true,
    database: row?.db ?? null,
    branch: process.env.NEON_BRANCH ?? null,
    txid: row?.txid ?? null,
    tableCount: Number(row?.table_count ?? 0),
    tables: Array.isArray(row?.tables) ? row.tables : [],
    vendorCount: Number(row?.vendor_count ?? 0),
    productCount: Number(row?.product_count ?? 0),
    orderCount: Number(row?.order_count ?? 0),
  };
}
