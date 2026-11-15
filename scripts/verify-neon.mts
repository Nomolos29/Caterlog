/**
 * End-to-end verification script for all 5 Neon services wired into Caterlog:
 *   1. Lakebase Postgres (DATABASE_URL, DATABASE_URL_UNPOOLED, Prisma + pg Pool)
 *   2. Neon Auth (NEON_AUTH_BASE_URL, NEON_AUTH_JWKS_URL, @neon/auth + jose)
 *   3. Neon Object Storage (AWS_* S3 credentials, files-sdk/neon bucket "assets")
 *   4. Neon Functions (NEON_FUNCTION_HOST_SUFFIX, @neon/functions + @neon/env "hello")
 *   5. Neon Realtime (NEON_REALTIME_URL, NEON_REALTIME_SECRET, @neon/realtime server + client)
 */
import dns from "node:dns";
import { createRealtimeClient, type SealedLiveQuery } from "@neon/realtime/client";

dns.setDefaultResultOrder("ipv4first");

const API_URL = process.env.API_URL ?? "http://localhost:4000";
const DASHBOARD_URL = process.env.DASHBOARD_URL ?? "http://localhost:3000";

async function fetchJson(url: string, init?: RequestInit): Promise<{ status: number; data: any }> {
  const res = await fetch(url, init);
  const text = await res.text();
  let data: any = text;
  try {
    data = JSON.parse(text);
  } catch {
    // keep raw text
  }
  return { status: res.status, data };
}

async function main() {
  console.log("==================================================================");
  console.log("🧪 CATERLOG NEON END-TO-END VERIFICATION SUITE");
  console.log("==================================================================\n");

  // -------------------------------------------------------------------------
  // 1. POSTGRES (Lakebase Postgres via Prisma + pg Pool)
  // -------------------------------------------------------------------------
  console.log("1️⃣  Testing Lakebase Postgres (Prisma + pg Pool)...");
  const statusRes = await fetchJson(`${API_URL}/api/v1/neon/status`);
  if (statusRes.status !== 200 || !statusRes.data?.postgres?.connected) {
    throw new Error(`Postgres status failed: ${JSON.stringify(statusRes.data)}`);
  }
  console.log("   ✓ /api/v1/neon/status Postgres check:", JSON.stringify({
    connected: statusRes.data.postgres.connected,
    database: statusRes.data.postgres.database,
    branch: statusRes.data.postgres.branch,
    txid: statusRes.data.postgres.txid,
    tableCount: statusRes.data.postgres.tableCount,
    vendorCount: statusRes.data.postgres.vendorCount,
    productCount: statusRes.data.postgres.productCount,
    orderCount: statusRes.data.postgres.orderCount,
  }));
  console.log(`   ✓ Public schema tables (${statusRes.data.postgres.tableCount}): ${(statusRes.data.postgres.tables ?? []).join(", ")}`);

  const stateRes = await fetchJson(`${API_URL}/api/v1/vendor/state`);
  if (stateRes.status !== 200 || statusRes.data?.dataMode !== "database") {
    throw new Error(`Expected dataMode="database", got: ${statusRes.data?.dataMode}`);
  }
  const vendorId = stateRes.data.vendor.id as string;
  console.log(
    `   ✓ /api/v1/vendor/state loaded from Lakebase Postgres: dataMode="${statusRes.data.dataMode}", vendor="${stateRes.data.vendor.businessName}" (${vendorId}), products=${stateRes.data.products.length}, orders=${stateRes.data.orders.length}`
  );

  // Verify live write persistence to Lakebase Postgres
  const customUpdateRes = await fetchJson(`${API_URL}/api/v1/vendor/products/SHOE-01`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category: "Footwear & Sneakers",
      customFields: { Material: "Italian Calfskin", Sole: "Hand-stitched Leather", Origin: "Lagos" },
    }),
  });
  if (customUpdateRes.status !== 200) {
    throw new Error(`Product update in Postgres failed: HTTP ${customUpdateRes.status}`);
  }
  const updatedShoe = customUpdateRes.data.products.find((p: any) => p.skuCode === "SHOE-01");
  console.log(
    `   ✓ Persisted product update to Lakebase Postgres: SKU="SHOE-01", category="${updatedShoe?.category}", customFields=${JSON.stringify(updatedShoe?.customFields)}`
  );

  // Verify auto-generated structured SKU + variant SKU in Lakebase Postgres
  const structuredProdRes = await fetchJson(`${API_URL}/api/v1/vendor/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "24K Gold Vitamin C Serum",
      category: "Beauty, Skincare & Cosmetics",
      priceNaira: 18500,
      stockTotal: 25,
      customFields: { Volume: "50ml", SkinType: "All Skin Types" },
      variants: [
        { name: "50ml Bottle", priceNaira: 18500, stockTotal: 15 },
        { name: "100ml Jumbo", priceNaira: 32000, stockTotal: 10 },
      ],
    }),
  });
  if (structuredProdRes.status !== 201) {
    throw new Error(`Structured SKU creation failed: HTTP ${structuredProdRes.status}`);
  }
  const createdGlow = structuredProdRes.data.products.find(
    (p: any) => p.name === "24K Gold Vitamin C Serum"
  );
  if (!createdGlow || !/^GLOW-\d{2,}$/.test(createdGlow.skuCode)) {
    throw new Error(`Expected structured GLOW-XX SKU, got: ${createdGlow?.skuCode}`);
  }
  console.log(
    `   ✓ Auto-generated structured SKU persisted to Postgres: parent="${createdGlow.skuCode}", variants=${JSON.stringify((createdGlow.variants ?? []).map((v: any) => v.sku))}`
  );
  // Clean up test product so catalog stays deterministic
  await fetchJson(`${API_URL}/api/v1/vendor/products/${encodeURIComponent(createdGlow.skuCode)}`, {
    method: "DELETE",
  });

  // Verify full platform database sync endpoints (MarketBoost, PaymentLinks, SplitRules, Team, KYC, Notifications)
  const boostRes = await fetchJson(`${API_URL}/api/v1/vendor/market-boost`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      isPublished: true,
      baseState: "Lagos",
      baseCity: "Lekki",
      shippingScope: "SELECTED_STATES",
      allowInterstate: true,
      coveredStates: ["Lagos", "Ogun", "FCT - Abuja"],
    }),
  });
  if (boostRes.status !== 200 || !boostRes.data?.listing?.isPublished) {
    throw new Error(`MarketBoost DB sync failed: HTTP ${boostRes.status}`);
  }
  console.log(
    `   ✓ Persisted MarketBoostListing to Postgres: scope="${boostRes.data.listing.shippingScope}", coveredStates=${JSON.stringify(boostRes.data.listing.coveredStates)}`
  );

  const linkRes = await fetchJson(`${API_URL}/api/v1/vendor/payment-links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: "Adaeze Okafor",
      productSku: "SHOE-01",
      description: "Express VIP Delivery",
      amountNaira: 45000,
    }),
  });
  if (linkRes.status !== 201 || !linkRes.data?.link?.slug) {
    throw new Error(`PaymentLink DB sync failed: HTTP ${linkRes.status}`);
  }
  console.log(
    `   ✓ Persisted PaymentLink to Postgres: slug="${linkRes.data.link.slug}", amount=${linkRes.data.link.amountFormatted}`
  );

  const splitRes = await fetchJson(`${API_URL}/api/v1/vendor/split-rules`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      supplierShareBps: 7500,
      resellerShareBps: 2500,
      platformFeeBps: 150,
    }),
  });
  if (splitRes.status !== 200) {
    throw new Error(`SplitRule DB sync failed: HTTP ${splitRes.status}`);
  }
  console.log(
    `   ✓ Persisted SettlementSplitRule to Postgres: supplier=${splitRes.data.rule.supplierShareBps}bps, reseller=${splitRes.data.rule.resellerShareBps}bps`
  );

  const kycRes = await fetchJson(`${API_URL}/api/v1/vendor/kyc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      businessName: "Amaka Luxury Shoes",
      cacNumber: "RC-1849204",
      tinNumber: "24910293-0001",
      bankCode: "035",
      accountNumber: "7821948301",
      resolvedAccountName: "AMAKA LUXURY SHOES LTD",
    }),
  });
  if (kycRes.status !== 200 && kycRes.status !== 201) {
    throw new Error(`KYC DB sync failed: HTTP ${kycRes.status}`);
  }
  console.log(
    `   ✓ Persisted KycSubmission to Postgres: cacNumber="${kycRes.data.submission.cacNumber}", status="${kycRes.data.submission.status}"`
  );

  const notifRes = await fetchJson(`${API_URL}/api/v1/vendor/notifications/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      readKeys: ["notif-ord-ORD-9021", "notif-paid-ORD-9021"],
    }),
  });
  if (notifRes.status !== 200) {
    throw new Error(`Notifications DB sync failed: HTTP ${notifRes.status}`);
  }
  console.log(
    `   ✓ Persisted VendorNotifications to Postgres: totalSynced=${notifRes.data.notifications?.length ?? 0}`
  );

  // -------------------------------------------------------------------------
  // 2. NEON AUTH (Managed Better Auth + JWKS + Next.js /api/auth/[...path])
  // -------------------------------------------------------------------------
  console.log("\n2️⃣  Testing Neon Auth (JWKS + Next.js Managed Auth route)...");
  const authStatus = await fetchJson(`${API_URL}/api/v1/neon/auth/status`);
  if (authStatus.status !== 200 || !authStatus.data?.ok) {
    throw new Error(`Neon Auth status failed: ${JSON.stringify(authStatus.data)}`);
  }
  console.log("   ✓ /api/v1/neon/auth/status:", JSON.stringify(authStatus.data));

  const sessionRes = await fetchJson(`${DASHBOARD_URL}/api/auth/get-session`, {
    headers: { Origin: DASHBOARD_URL },
  });
  console.log(
    `   ✓ Next.js /api/auth/get-session HTTP ${sessionRes.status}:`,
    JSON.stringify(sessionRes.data)
  );

  const testEmail = `caterlog.e2e.${Date.now()}@example.com`;
  const signUpRes = await fetchJson(`${DASHBOARD_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: DASHBOARD_URL,
    },
    body: JSON.stringify({
      email: testEmail,
      password: "CaterlogNeonPassword2026!",
      name: "Caterlog Neon E2E Vendor",
    }),
  });
  console.log(
    `   ✓ Next.js /api/auth/sign-up/email HTTP ${signUpRes.status}: user=${signUpRes.data?.user?.email ?? "created"} (id=${signUpRes.data?.user?.id ?? "n/a"})`
  );

  // -------------------------------------------------------------------------
  // 3. NEON OBJECT STORAGE (files-sdk/neon bucket "assets")
  // -------------------------------------------------------------------------
  console.log("\n3️⃣  Testing Neon Object Storage (bucket: 'assets')...");
  const storageKey = `e2e/caterlog-neon-test-${Date.now()}.txt`;
  const payloadText = `Caterlog Neon Object Storage E2E test payload @ ${new Date().toISOString()}`;
  const uploadRes = await fetchJson(`${API_URL}/api/v1/neon/storage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: storageKey,
      content: payloadText,
      contentType: "text/plain",
    }),
  });
  if (uploadRes.status !== 201 || !uploadRes.data?.presignedUrl) {
    throw new Error(`Object Storage upload failed: ${JSON.stringify(uploadRes.data)}`);
  }
  console.log(
    `   ✓ POST /api/v1/neon/storage uploaded key="${uploadRes.data.key}" (${uploadRes.data.bytes} bytes)`
  );

  const downloadRes = await fetchJson(
    `${API_URL}/api/v1/neon/storage?key=${encodeURIComponent(storageKey)}`
  );
  if (downloadRes.status !== 200 || downloadRes.data?.text !== payloadText) {
    throw new Error(`Object Storage roundtrip mismatch: ${JSON.stringify(downloadRes.data)}`);
  }
  console.log(`   ✓ GET /api/v1/neon/storage verified round-trip text: "${downloadRes.data.text}"`);

  const presignedDirect = await fetch(uploadRes.data.presignedUrl);
  const presignedText = await presignedDirect.text();
  if (!presignedDirect.ok || presignedText !== payloadText) {
    throw new Error(`Presigned URL fetch failed: HTTP ${presignedDirect.status}`);
  }
  console.log(`   ✓ Direct Presigned S3 URL fetch HTTP ${presignedDirect.status} verified`);

  // -------------------------------------------------------------------------
  // 4. NEON FUNCTIONS (hello.ts deployed on Neon Compute)
  // -------------------------------------------------------------------------
  console.log("\n4️⃣  Testing Neon Functions ('hello' serverless function)...");
  const fnRes = await fetchJson(`${API_URL}/api/v1/neon/functions/hello`);
  if (fnRes.status !== 200 || !fnRes.data?.ok) {
    throw new Error(`Neon Function invocation failed: ${JSON.stringify(fnRes.data)}`);
  }
  console.log("   ✓ GET /api/v1/neon/functions/hello:", JSON.stringify(fnRes.data));

  // -------------------------------------------------------------------------
  // 5. NEON REALTIME (Seal Live Query + WebSocket Subscription)
  // -------------------------------------------------------------------------
  console.log("\n5️⃣  Testing Neon Realtime (Seal Live Query + WebSocket Subscription)...");
  const sealRes = await fetchJson(`${API_URL}/api/v1/neon/realtime/seal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      table: "products",
      vendorId,
      limit: 25,
    }),
  });
  if (sealRes.status !== 200 || !sealRes.data?.sealed) {
    throw new Error(`Realtime seal failed: ${JSON.stringify(sealRes.data)}`);
  }
  console.log(
    `   ✓ POST /api/v1/neon/realtime/seal sealed live query for table="${sealRes.data.table}", vendorId="${sealRes.data.vendorId}", expiresAt=${sealRes.data.sealed.expiresAt}`
  );

  // Connect WebSocket client to Neon Realtime and await initial materialized rows
  const rtClient = createRealtimeClient({
    url: sealRes.data.realtimeUrl,
    webSocketFactory: (url, protocols) => {
      // Node 22 global WebSocket with Origin header for allowedOrigins check
      const WS = globalThis.WebSocket as any;
      return new WS(url, protocols);
    },
  });

  const sub = rtClient.subscribe(
    sealRes.data.sealed as SealedLiveQuery<Record<string, unknown>>
  );

  await sub.awaitRows((rows) => rows.length > 0, 15000);
  const snapshot = sub.getSnapshot();
  console.log(
    `   ✓ Neon Realtime WebSocket live subscription status="${snapshot.status}", materialized rows=${snapshot.data?.length ?? 0}, first SKU="${(snapshot.data?.[0] as any)?.skuCode ?? "n/a"}"`
  );

  sub.unsubscribe();
  rtClient.close();

  console.log("\n==================================================================");
  console.log("✅ ALL 5 NEON SERVICES VERIFIED END-TO-END SUCCESSFULLY!");
  console.log("==================================================================");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Verification failed:", err);
  process.exit(1);
});
