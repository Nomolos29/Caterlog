import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CaterlogStage1Engine } from "./runtime-engine.ts";
import { createCaterlogApiServer } from "./server.ts";
import { hashSecret, verifySecret, weakPinReason, randomNumericCode } from "./security/crypto.ts";
import { matchAccountName } from "./security/name-match.ts";

describe("Layer 1 Payout Security & Identity Lock Engine", () => {
  it("hashes and verifies transaction PINs with scrypt and rejects weak PINs", async () => {
    // 1. Weak PIN rejections
    assert.ok(weakPinReason("111111", "+2348031234567"));
    assert.ok(weakPinReason("123456", "+2348031234567"));
    assert.ok(weakPinReason("654321", "+2348031234567"));
    assert.ok(weakPinReason("121212", "+2348031234567"));
    assert.ok(weakPinReason("234567", "+2348031234567")); // phone ending

    // Valid strong PIN
    const validPin = "849204";
    assert.equal(weakPinReason(validPin, "+2348031234567"), null);

    // 2. Cryptographic hash and verify
    const hashed = await hashSecret(validPin);
    assert.ok(hashed.startsWith("scrypt$"));
    const isValid = await verifySecret(validPin, hashed);
    assert.equal(isValid, true);

    const isWrong = await verifySecret("999999", hashed);
    assert.equal(isWrong, false);
  });

  it("strictly validates Nigerian bank account names against verified KYC identity anchors", () => {
    const verifiedOwner = "CHUKWUDI EMMANUEL OBI";

    // 1. Valid variations of the same owner
    const match1 = matchAccountName(verifiedOwner, "OBI CHUKWUDI EMMANUEL");
    assert.equal(match1.matched, true, "Permuted name order must match");

    const match2 = matchAccountName(verifiedOwner, "CHUKWUDI E. OBI");
    assert.equal(match2.matched, true, "Name with initial must match");

    const match3 = matchAccountName(verifiedOwner, "MR CHUKWUDI EMMANUEL OBI");
    assert.equal(match3.matched, true, "Honorifics (MR, CHIEF, DR) must be stripped");

    // 2. Fraudulent/Mule accounts MUST BE REJECTED
    const mule1 = matchAccountName(verifiedOwner, "TUNDE BAKARE");
    assert.equal(mule1.matched, false, "Completely unrelated name must fail");

    const mule2 = matchAccountName(verifiedOwner, "CHUKWUDI ALIYU MUSA");
    assert.equal(mule2.matched, false, "Different person sharing one name must fail");

    const mule3 = matchAccountName("AMAKA LUXURY SHOES LTD", "EMMANUEL CHUKWU");
    assert.equal(mule3.matched, false, "Mule account on corporate store must fail");
  });

  it("enforces 3-attempt Transaction PIN lockout with 24-hour freeze", async () => {
    const engine = new CaterlogStage1Engine();

    // 1. Setup Transaction PIN
    await engine.setTransactionPin({ pin: "739104" });
    assert.ok(engine.vendor.transactionPinHash);

    // 2. Correct PIN succeeds
    const success = await engine.verifyTransactionPin("739104");
    assert.equal(success, true);
    assert.equal(engine.vendor.pinFailedAttempts, 0);

    // 3. First wrong attempt
    await assert.rejects(
      async () => engine.verifyTransactionPin("000000"),
      /Incorrect transaction PIN\. 2 attempt\(s\) remaining/
    );
    assert.equal(engine.vendor.pinFailedAttempts, 1);

    // 4. Second wrong attempt
    await assert.rejects(
      async () => engine.verifyTransactionPin("000000"),
      /Incorrect transaction PIN\. 1 attempt\(s\) remaining/
    );
    assert.equal(engine.vendor.pinFailedAttempts, 2);

    // 5. Third wrong attempt triggers 24-hour lockout
    await assert.rejects(
      async () => engine.verifyTransactionPin("000000"),
      /Account security locked for 24 hours/
    );
    assert.ok(engine.vendor.pinLockedUntil);
    assert.ok(engine.vendor.pinLockedUntil.getTime() > Date.now());

    // 6. Further attempts blocked immediately while locked
    await assert.rejects(
      async () => engine.verifyTransactionPin("739104"),
      /Transaction PIN is locked due to multiple incorrect attempts/
    );
  });

  it("enforces Identity Lock & 72-Hour Cooling-Off on payout bank modifications", async () => {
    const engine = new CaterlogStage1Engine();

    // Setup owner identity & initial bank account
    engine.vendor.verifiedLegalName = "AMAKA LUXURY SHOES LTD";
    await engine.setTransactionPin({ pin: "852941" });

    // Seed mock names in Monnify adapter
    engine.monnify.seedMockAccountName("058", "0123456789", "AMAKA LUXURY SHOES LTD");
    engine.monnify.seedMockAccountName("044", "0987654321", "MULE HACKER PALMPAY");

    // 1. Initial linking with matching identity succeeds immediately
    await engine.linkVendorBankAccount({
      bankCode: "058",
      accountNumber: "0123456789",
    });
    assert.equal(engine.vendor.bankAccountNumber, "0123456789");

    // Generate valid OTP for bank modification
    const otpCode = engine.generateOtp(engine.vendor.whatsappPhone, "BANK_CHANGE");

    // 2. Hacker attempts to switch payout account to a mule account -> STRICT IDENTITY REJECTION!
    await assert.rejects(
      async () =>
        engine.requestPayoutAccountChange({
          bankCode: "044",
          accountNumber: "0987654321", // Mule account
          pin: "852941",
          otpCode,
        }),
      /Identity Lock Rejection/
    );

    // Ensure active bank account was NOT changed
    assert.equal(engine.vendor.bankAccountNumber, "0123456789");
    assert.equal(engine.vendor.pendingBankUpdate, null);

    // 3. Legitimate bank change to another account owned by Amaka Luxury Shoes
    engine.monnify.seedMockAccountName("033", "0555666777", "AMAKA LUXURY SHOES");
    const legitOtp = engine.generateOtp(engine.vendor.whatsappPhone, "BANK_CHANGE");

    const changeResult = await engine.requestPayoutAccountChange({
      bankCode: "033",
      accountNumber: "0555666777",
      pin: "852941",
      otpCode: legitOtp,
    });

    assert.equal(changeResult.status, "pending_cooling_off");
    assert.ok(changeResult.cancelToken);
    const pending = (engine.vendor as any).pendingBankUpdate;
    assert.ok(pending);
    assert.equal(pending.accountNumber, "0555666777");

    // Active payout account is STILL the old one during the 72-hour cooling-off window
    assert.equal(engine.vendor.bankAccountNumber, "0123456789");

    // 4. Attempting to apply before 72 hours elapses is rejected
    const appliedEarly = await engine.applyPendingBankUpdate();
    assert.equal(appliedEarly, false);
    assert.equal(engine.vendor.bankAccountNumber, "0123456789");

    // 5. Merchant taps emergency panic killswitch (from WhatsApp alert)
    const freezeRes = engine.emergencyFreezeStore(changeResult.cancelToken);
    assert.equal(freezeRes.frozen, true);
    assert.equal(engine.vendor.isPayoutFrozen, true);
    assert.equal(engine.vendor.pendingBankUpdate, null, "Pending bank update must be wiped on freeze");

    // 6. Withdrawals are blocked when store is frozen
    await assert.rejects(
      async () =>
        engine.recordWithdrawal({
          amountNaira: 10000,
        }),
      /Payouts are currently frozen/
    );
  });

  it("strictly routes withdrawals to verified account and creates durable sessions", async () => {
    const engine = new CaterlogStage1Engine();

    // 1. Session creation and authentication
    const { token, session } = engine.createVendorSession({
      phone: "+2348031234567",
    });
    assert.ok(token);
    assert.equal(session.vendorSlug, engine.vendor.slug);

    const authed = engine.authenticateVendorSession(token);
    assert.ok(authed);
    assert.equal(authed.phone, "+2348031234567");

    // Invalid token returns null
    assert.equal(engine.authenticateVendorSession("fake-token-xyz"), null);

    // 2. Withdrawal overrides any arbitrary client destination
    engine.vendor.isPayoutFrozen = false;
    engine.vendor.bankCode = "058";
    engine.vendor.bankName = "Guaranty Trust Bank";
    engine.vendor.bankAccountNumber = "0112233445";
    engine.vendor.bankAccountName = "Amaka Verified Store";

    const withdrawal = engine.recordWithdrawal({
      amountNaira: 50000,
      bankName: "Hacker Rogue Bank", // Malicious input
      accountNumber: "9999999999",     // Malicious input
    });

    // Payout MUST be forced to verified account
    assert.equal(withdrawal.bankName, "Guaranty Trust Bank");
    assert.equal(withdrawal.accountNumber, "0112233445");
    assert.equal(withdrawal.accountName, "Amaka Verified Store");
    assert.equal(withdrawal.netAmountKobo, 5000000n);

    // 3. Revoking sessions
    engine.revokeVendorSession(token);
    assert.equal(engine.authenticateVendorSession(token), null);
  });

  it("manages platform billing subscriptions, invoices, and fast-tracks trust tier settlements", () => {
    const engine = new CaterlogStage1Engine();

    // 1. Initial default state check
    assert.equal(engine.vendor.subscription?.planId, "GROWTH");
    assert.equal(engine.vendor.trustTier?.currentTier, 1);
    assert.equal(engine.vendor.invoices?.length, 3);

    // 2. Upgrade to Pro Concierge Vendor (Annual)
    const upgradedSub = engine.updateSubscription("PRO", "ANNUALLY");
    assert.equal(upgradedSub.planId, "PRO");
    assert.equal(upgradedSub.billingCycle, "ANNUALLY");
    assert.equal(upgradedSub.priceUsd, 20);
    assert.equal(upgradedSub.priceNaira, 200000);
    assert.equal(upgradedSub.platformFeeBps, 75); // 0.75%
    assert.equal(upgradedSub.hasCustomDomain, true);
    assert.equal(upgradedSub.hasResellerMirroring, true);
    assert.equal(upgradedSub.hasConciergeShipping, true);
    assert.equal(upgradedSub.hasMarketBoost, true);
    assert.deepEqual(upgradedSub.scheduledPickupWindows, ["10:00 AM", "1:00 PM", "4:00 PM"]);
    assert.equal(engine.vendor.subscription?.planId, "PRO");

    // New invoice added to history
    assert.equal(engine.vendor.invoices?.length, 4);
    assert.equal(engine.vendor.invoices?.[0].amountNaira, 200000);
    assert.equal(engine.vendor.invoices?.[0].status, "PAID");

    // 3. Fast-track Trust Tier to Level 2 (Instant Split Settlement)
    const upgradedTier = engine.fastTrackTrustTier("RC-9988776");
    assert.equal(upgradedTier.currentTier, 2);
    assert.equal(upgradedTier.tierName, "Level 2: Instant Settlement");
    assert.equal(upgradedTier.dailyPayoutLimitNaira, 50000000);
    assert.equal(upgradedTier.isCacVerified, true);
    assert.equal(engine.vendor.trustTier?.currentTier, 2);
    assert.equal(engine.vendor.cacNumber, "RC-9988776");

    // 4. Verify serialized state includes subscription, trustTier, and invoices
    const serialized = engine.serializeState();
    assert.equal(serialized.subscription?.planId, "PRO");
    assert.equal(serialized.trustTier?.currentTier, 2);
    assert.equal(serialized.platformInvoices?.length, 4);
    assert.equal(serialized.platformInvoices?.[0].amountFormatted, "₦200,000");
  });

  it("authenticates staff sub-accounts and strictly enforces Role-Based Access Control (RBAC) across API endpoints", async () => {
    const engine = new CaterlogStage1Engine();
    const { server } = createCaterlogApiServer(engine);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") {
      server.close();
      throw new Error("Could not bind test HTTP server.");
    }
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      // 1. Invite a "Dispatch Coordinator" (Rider/Fulfillment Only) and a "Catalog Editor" (Catalog Editor Only)
      const riderMember = engine.saveTeamMember({
        name: "Bola Rider",
        email: "bola.rider@niastores.ng",
        role: "Dispatch Coordinator",
        status: "Invited",
      });
      assert.equal(riderMember.canManageOrders, true);
      assert.equal(riderMember.canManageInventory, false);
      assert.equal(riderMember.canViewPayouts, false);
      assert.equal(riderMember.canProcessRefunds, false);

      const catalogMember = engine.saveTeamMember({
        name: "Kemi Catalog",
        email: "kemi.catalog@niastores.ng",
        role: "Catalog Editor",
        status: "Invited",
      });
      assert.equal(catalogMember.canManageOrders, false);
      assert.equal(catalogMember.canManageInventory, true);
      assert.equal(catalogMember.canViewPayouts, false);
      assert.equal(catalogMember.canProcessRefunds, false);

      // 2. Staff sub-account login for Dispatch Coordinator (`POST /api/v1/auth/staff-login`)
      const riderLoginRes = await fetch(`${baseUrl}/api/v1/auth/staff-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "bola.rider@niastores.ng" }),
      });
      assert.equal(riderLoginRes.status, 200);
      const riderAuth = (await riderLoginRes.json()) as {
        authenticated: boolean;
        token: string;
        session: { staffRole: string; isOwner: boolean };
        member: { status: string };
      };
      assert.equal(riderAuth.authenticated, true);
      assert.equal(riderAuth.session.staffRole, "Dispatch Coordinator");
      assert.equal(riderAuth.session.isOwner, false);
      assert.equal(riderAuth.member.status, "Active");

      // Dispatch Coordinator CAN access order waybill & mark order dispatched (`canManageOrders`)
      const targetOrder = engine.orders[0];
      assert.ok(targetOrder);
      const waybillRes = await fetch(
        `${baseUrl}/api/v1/vendor/orders/${encodeURIComponent(targetOrder.shortCode)}/waybill`,
        {
          headers: { Authorization: `Bearer ${riderAuth.token}` },
        }
      );
      assert.equal(waybillRes.status, 200);

      // Dispatch Coordinator is BLOCKED from adding/modifying products (`canManageInventory` = false)
      const riderAddProdRes = await fetch(`${baseUrl}/api/v1/vendor/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${riderAuth.token}`,
        },
        body: JSON.stringify({ name: "Unauthorized Bag", priceNaira: 15000, stockTotal: 5 }),
      });
      assert.equal(riderAddProdRes.status, 403);
      const riderProdErr = (await riderAddProdRes.json()) as { error: string };
      assert.match(riderProdErr.error, /canManageInventory/);

      // Dispatch Coordinator is BLOCKED from Owner-only endpoints (`POST /api/v1/vendor/team`)
      const riderTeamRes = await fetch(`${baseUrl}/api/v1/vendor/team`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${riderAuth.token}`,
        },
        body: JSON.stringify({ name: "Hacker", email: "hack@example.com", role: "Owner" }),
      });
      assert.equal(riderTeamRes.status, 403);
      const riderTeamErr = (await riderTeamRes.json()) as { error: string };
      assert.match(riderTeamErr.error, /Only the Store Owner/);

      // 3. Staff sub-account login for Catalog Editor
      const catalogLoginRes = await fetch(`${baseUrl}/api/v1/auth/staff-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "kemi.catalog@niastores.ng" }),
      });
      assert.equal(catalogLoginRes.status, 200);
      const catalogAuth = (await catalogLoginRes.json()) as { token: string };

      // Catalog Editor CAN add a new product (`canManageInventory` = true)
      const catalogAddProdRes = await fetch(`${baseUrl}/api/v1/vendor/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${catalogAuth.token}`,
        },
        body: JSON.stringify({
          skuCode: "RBAC-SHOE-01",
          name: "Catalog Editor Heel",
          priceNaira: 28000,
          stockTotal: 12,
        }),
      });
      assert.equal(catalogAddProdRes.status, 201);

      // Catalog Editor is BLOCKED from dispatching orders (`canManageOrders` = false)
      const catalogDispatchRes = await fetch(
        `${baseUrl}/api/v1/vendor/orders/${encodeURIComponent(targetOrder.shortCode)}/dispatch`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${catalogAuth.token}`,
          },
          body: JSON.stringify({ riderPhone: "08030001111" }),
        }
      );
      assert.equal(catalogDispatchRes.status, 403);
      const catalogDispatchErr = (await catalogDispatchRes.json()) as { error: string };
      assert.match(catalogDispatchErr.error, /canManageOrders/);

      // 4. Suspending a staff member immediately invalidates their active session token
      engine.saveTeamMember({
        name: "Kemi Catalog",
        email: "kemi.catalog@niastores.ng",
        role: "Catalog Editor",
        status: "Suspended",
      });
      const suspendedCheckRes = await fetch(`${baseUrl}/api/v1/vendor/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${catalogAuth.token}`,
        },
        body: JSON.stringify({ name: "After Suspension", priceNaira: 10000 }),
      });
      assert.equal(suspendedCheckRes.status, 401);
    } finally {
      server.closeAllConnections?.();
      server.close();
    }
  });
});
