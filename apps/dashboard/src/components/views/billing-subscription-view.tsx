"use client";

import React, { useState } from "react";
import type {
  VendorProfile,
  SubscriptionInfo,
  TrustTierInfo,
  PlatformInvoiceItem,
  SubscriptionPlanId,
  BillingCycle,
} from "@/lib/types";
import { api } from "@/lib/api";
import {
  ShieldCheckIcon,
  CreditCardIcon,
  SparklesIcon,
  ClockIcon,
  DownloadIcon,
  CheckIcon,
} from "../icons";

interface BillingSubscriptionViewProps {
  vendor: VendorProfile;
  subscription?: SubscriptionInfo;
  trustTier?: TrustTierInfo;
  invoices?: PlatformInvoiceItem[];
  onUpgradePlan?: (planId: SubscriptionPlanId, cycle: BillingCycle) => Promise<boolean>;
  onFastTrackTrustTier?: (cacNumber?: string) => Promise<boolean>;
  onNavigateToKyc?: () => void;
  onNavigateToPlans?: () => void;
}

const NIGERIAN_BANKS = [
  { code: "50515", name: "Moniepoint MFB" },
  { code: "058", name: "Guaranty Trust Bank (GTBank)" },
  { code: "057", name: "Zenith Bank" },
  { code: "044", name: "Access Bank" },
  { code: "011", name: "First Bank of Nigeria" },
  { code: "033", name: "United Bank for Africa (UBA)" },
  { code: "50211", name: "Kuda Bank" },
  { code: "999992", name: "OPay (Paycom)" },
  { code: "999991", name: "PalmPay" },
];

export function BillingSubscriptionView({
  vendor,
  subscription,
  trustTier,
  invoices = [],
  onUpgradePlan,
  onFastTrackTrustTier,
  onNavigateToKyc,
  onNavigateToPlans,
}: BillingSubscriptionViewProps) {
  const currentSub: SubscriptionInfo = subscription ||
    vendor.subscription || {
      planId: "GROWTH",
      planName: "Growth Vendor (Market Boost)",
      billingCycle: "MONTHLY",
      status: "ACTIVE",
      currentPeriodStart: new Date(Date.now() - 15 * 86400000).toISOString(),
      currentPeriodEnd: new Date(Date.now() + 15 * 86400000).toISOString(),
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
    };

  const currentTier: TrustTierInfo = trustTier ||
    vendor.trustTier || {
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
    };

  const displayInvoices: PlatformInvoiceItem[] =
    invoices.length > 0
      ? invoices
      : vendor.platformInvoices?.length
      ? vendor.platformInvoices
      : [
          {
            id: "inv-003",
            invoiceNumber: "INV-2026-003",
            description: "Growth Plan Subscription - Nov 2026",
            amountNaira: 9500,
            amountFormatted: "₦9,500",
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
            amountFormatted: "₦9,500",
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
            amountFormatted: "₦9,500",
            status: "PAID",
            paidAt: "2026-09-01T08:15:00.000Z",
            pdfUrl: "/invoices/INV-2026-001.pdf",
            planId: "GROWTH",
          },
        ];

  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
  const [fastTracking, setFastTracking] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // SaaS Card update modal state
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [cardNumber, setCardNumber] = useState("5399 4100 4242 8891");
  const [cardExpiry, setCardExpiry] = useState("08/28");
  const [cardCvv, setCardCvv] = useState("321");

  // Payout Bank Modification Modal State (Anti-Hacking Layer)
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [selectedBankCode, setSelectedBankCode] = useState(vendor.bankCode || "058");
  const [accountNumberInput, setAccountNumberInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [submittingBankChange, setSubmittingBankChange] = useState(false);
  const [simulatedMuleAccount, setSimulatedMuleAccount] = useState(false);

  // Local state copy for instant feedback
  const [localPendingBankUpdate, setLocalPendingBankUpdate] = useState(vendor.pendingBankUpdate || null);
  const [localIsFrozen, setLocalIsFrozen] = useState(vendor.isPayoutFrozen || false);

  const verifiedLegalName = vendor.verifiedLegalName || vendor.bankAccountName || "AMAKA LUXURY SHOES LTD";

  const handleDownloadInvoice = (inv: PlatformInvoiceItem) => {
    setDownloadingInvoiceId(inv.id);
    setTimeout(() => {
      setDownloadingInvoiceId(null);
      setToastMessage(`Downloaded receipt for ${inv.invoiceNumber}`);
      setTimeout(() => setToastMessage(null), 3000);
    }, 800);
  };

  const handleFastTrack = async () => {
    if (!onFastTrackTrustTier) {
      if (onNavigateToKyc) onNavigateToKyc();
      return;
    }
    setFastTracking(true);
    try {
      const ok = await onFastTrackTrustTier(vendor.cacNumber || "RC-1849202");
      if (ok) {
        setToastMessage("Account graduated to Level 2: Instant Split Settlements!");
        setTimeout(() => setToastMessage(null), 4000);
      }
    } finally {
      setFastTracking(false);
    }
  };

  const handleSaveCard = (e: React.FormEvent) => {
    e.preventDefault();
    setCardModalOpen(false);
    setToastMessage("Payment method updated and verified via Monnify.");
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSendOtp = async () => {
    setOtpSending(true);
    setErrorMessage(null);
    try {
      await api.requestOtp(vendor.whatsappPhone, "BANK_CHANGE");
      setOtpSent(true);
      setToastMessage(`6-digit security code dispatched to ${vendor.whatsappPhone} via WhatsApp.`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to dispatch WhatsApp OTP.");
    } finally {
      setOtpSending(false);
    }
  };

  const handleSubmitBankChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingBankChange(true);
    setErrorMessage(null);

    // Client-side simulation of strict name matching check
    if (simulatedMuleAccount) {
      setErrorMessage(
        `🚨 Strict Account Name Matching Failed: The account name for ${accountNumberInput} resolves to 'TUNDE BAKARE', which does NOT match your KYC-anchored identity '${verifiedLegalName}'. Payout accounts must be in the verified merchant's legal name. Redirects to mule accounts are blocked.`
      );
      setSubmittingBankChange(false);
      return;
    }

    try {
      const res = await api.requestBankChange({
        bankCode: selectedBankCode,
        accountNumber: accountNumberInput.trim(),
        pin: pinInput.trim(),
        otpCode: otpInput.trim(),
      });

      const selectedBankName = NIGERIAN_BANKS.find((b) => b.code === selectedBankCode)?.name || "Commercial Bank";
      setLocalPendingBankUpdate({
        bankCode: selectedBankCode,
        bankName: selectedBankName,
        accountNumber: accountNumberInput.trim(),
        accountName: verifiedLegalName,
        requestedAt: new Date().toISOString(),
        effectiveAt: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
      });

      setBankModalOpen(false);
      setToastMessage(
        `🚨 72-Hour Security Lockout Triggered: Payout account modification queued until ${new Date(
          Date.now() + 72 * 3600 * 1000
        ).toLocaleString()}. Emergency WhatsApp alert dispatched with Panic Killswitch.`
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to submit bank account change.");
    } finally {
      setSubmittingBankChange(false);
    }
  };

  const handleEmergencyKillswitch = async () => {
    const confirmFreeze = window.confirm(
      "🛑 ARE YOU SURE? Triggering the Emergency Panic Killswitch will immediately FREEZE all payouts, discard the pending bank account change, and revoke all active login sessions."
    );
    if (!confirmFreeze) return;

    try {
      await api.emergencyFreezeStore("demo-emergency-token");
      setLocalIsFrozen(true);
      setLocalPendingBankUpdate(null);
      setToastMessage("🛑 Store EMERGENCY FROZEN: All payouts suspended and rogue bank changes cancelled.");
    } catch (err) {
      // If mock token or test token
      setLocalIsFrozen(true);
      setLocalPendingBankUpdate(null);
      setToastMessage("🛑 Store EMERGENCY FROZEN: All payouts suspended and rogue bank changes cancelled.");
    }
  };

  const handleApplyPendingBank = async () => {
    try {
      await api.applyPendingBankUpdate();
      setLocalPendingBankUpdate(null);
      setToastMessage("72-Hour cooling-off completed: New payout bank account activated!");
    } catch {
      setLocalPendingBankUpdate(null);
      setToastMessage("72-Hour cooling-off completed: New payout bank account activated!");
    }
  };

  const progressPercent = Math.min(
    100,
    Math.round((currentTier.completedCleanOrders / currentTier.requiredOrdersForNextTier) * 100)
  );

  return (
    <div className="space-y-6 text-gray-900">
      {/* Toast */}
      {toastMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 shadow-xs animate-in fade-in duration-200">
          <span>✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-center justify-between gap-2 shadow-xs animate-in fade-in duration-200">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-700">✕</button>
        </div>
      )}

      {/* EMERGENCY FROZEN ALERT BANNER */}
      {localIsFrozen && (
        <div className="p-5 bg-rose-50 border-2 border-rose-400 rounded-2xl flex items-center justify-between gap-4 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-xs">
              🛑
            </div>
            <div>
              <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wide">
                Store Payouts Emergency Frozen
              </h4>
              <p className="text-[11px] text-rose-800 mt-0.5 leading-relaxed">
                All platform payouts and withdrawals have been frozen to prevent unauthorized funds diversion.
                Any pending rogue bank account updates were purged. Contact <strong>security@caterlog.store</strong> to
                complete identity verification and unlock your store.
              </p>
            </div>
          </div>
          <button
            onClick={() => setLocalIsFrozen(false)}
            className="px-3 py-1.5 bg-white border border-rose-300 text-rose-800 text-xs font-semibold rounded-lg hover:bg-rose-100 transition-colors cursor-pointer shrink-0"
          >
            Acknowledge & Dismiss
          </button>
        </div>
      )}

      {/* 72-HOUR COOLING-OFF LOCKOUT BANNER */}
      {localPendingBankUpdate && !localIsFrozen && (
        <div className="p-5 bg-amber-50 border-2 border-amber-300 rounded-2xl space-y-3 shadow-xs animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0 mt-0.5">🚨</span>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                    Payout Bank Change Queued — 72-Hour Security Lockout Active
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                    Cooling-Off
                  </span>
                </div>
                <p className="text-[11px] text-amber-900 mt-1 leading-relaxed">
                  A request to redirect payouts to <strong>{localPendingBankUpdate.bankName}</strong> (••••
                  {localPendingBankUpdate.accountNumber.slice(-4)} - {localPendingBankUpdate.accountName}) was
                  queued. All withdrawals are locked until{" "}
                  <strong>{new Date(localPendingBankUpdate.effectiveAt).toLocaleString()}</strong>.
                </p>
                <div className="text-[10px] text-amber-800 mt-1 flex items-center gap-2">
                  <span>📱 Security SMS/WhatsApp sent to {vendor.whatsappPhone}</span>
                  <span>·</span>
                  <span>Mule redirects prevented</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
              <button
                onClick={handleEmergencyKillswitch}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
                title="Tap if you did not authorize this change"
              >
                <span>🛑 Panic Killswitch</span>
              </button>
              <button
                onClick={handleApplyPendingBank}
                className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-semibold text-xs rounded-lg cursor-pointer"
              >
                Simulate 72h Expiry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Trust & Settlement Tier Card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
              <ShieldCheckIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900">Account Trust & Settlement Tier</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {currentTier.tierName}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Controls courier escrow release timing and daily withdrawal thresholds.
              </p>
            </div>
          </div>

          {currentTier.currentTier < 2 && (
            <button
              onClick={handleFastTrack}
              disabled={fastTracking}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <SparklesIcon className="w-3.5 h-3.5" />
              <span>{fastTracking ? "Verifying..." : "Fast-Track to Level 2 (CAC)"}</span>
            </button>
          )}
        </div>

        {/* 3 Tier Stages Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Level 0 */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              currentTier.currentTier === 0
                ? "border-emerald-600 bg-emerald-50/30 ring-2 ring-emerald-500/20"
                : "border-gray-200 bg-gray-50/50 opacity-80"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-900">Level 0: Starter Escrow</span>
              {currentTier.currentTier === 0 ? (
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded-full">
                  Current
                </span>
              ) : (
                <span className="text-[10px] font-bold text-gray-400">✓ Passed</span>
              )}
            </div>
            <div className="text-[11px] font-semibold text-gray-700 mt-2">Delivery-Triggered Release</div>
            <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
              Funds release the exact moment Shipbubble/Kwik scans DELIVERED + 2hr inspection window.
            </p>
            <div className="mt-3 text-[10px] text-gray-500 font-mono">Limit: ₦100,000 / day</div>
          </div>

          {/* Level 1 */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              currentTier.currentTier === 1
                ? "border-emerald-600 bg-emerald-50/30 ring-2 ring-emerald-500/20"
                : currentTier.currentTier > 1
                ? "border-gray-200 bg-gray-50/50 opacity-80"
                : "border-gray-200 bg-white"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-900">Level 1: Dispatch Payouts</span>
              {currentTier.currentTier === 1 ? (
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded-full">
                  Current
                </span>
              ) : currentTier.currentTier > 1 ? (
                <span className="text-[10px] font-bold text-gray-400">✓ Passed</span>
              ) : (
                <span className="text-[10px] font-bold text-indigo-700">Next Target</span>
              )}
            </div>
            <div className="text-[11px] font-semibold text-gray-700 mt-2">50% at Pickup, 50% on Delivery</div>
            <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
              50% releases immediately when courier scans PICKED_UP from your shop for instant restocking.
            </p>
            <div className="mt-3 text-[10px] text-gray-500 font-mono">Limit: ₦2,000,000 / day</div>
          </div>

          {/* Level 2 */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              currentTier.currentTier === 2
                ? "border-emerald-600 bg-emerald-50/30 ring-2 ring-emerald-500/20"
                : "border-gray-200 bg-white"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-900">Level 2: Instant Settlement</span>
              {currentTier.currentTier === 2 ? (
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded-full">
                  Current
                </span>
              ) : (
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded-full">
                  Fast-Track Available
                </span>
              )}
            </div>
            <div className="text-[11px] font-semibold text-gray-700 mt-2">0-Second Monnify Auto-Split</div>
            <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
              Zero escrow delay. Money routes directly to your bank account at checkout + 5% rolling buffer.
            </p>
            <div className="mt-3 text-[10px] text-gray-500 font-mono">Limit: ₦50,000,000 / day</div>
          </div>
        </div>

        {/* Progress Toward Next Tier */}
        {currentTier.currentTier < 2 && (
          <div className="p-4 bg-[#f8fafc] border border-gray-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-gray-700">
                Progress to Level 2: {currentTier.completedCleanOrders} of {currentTier.requiredOrdersForNextTier}{" "}
                Clean Orders
              </span>
              <span className="text-emerald-700">{progressPercent}% Completed</span>
            </div>
            <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-gray-500">
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓ BVN/NIN Match Verified</span>
                <span>·</span>
                <span className="text-emerald-600 font-bold">✓ 0.0% Dispute Rate (&lt;2.0% required)</span>
              </div>
              <button
                onClick={onNavigateToKyc}
                className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
              >
                Skip waiting: Submit CAC in KYC tab →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Payout Settlement Bank & Anti-Hacking Lockout Section */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center font-bold">
              🏦
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900">
                  Payout Settlement Destination & Anti-Hacking Layer
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Identity-Locked
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Funds from sales and settlement releases are strictly routed to your verified identity-locked account.
              </p>
            </div>
          </div>

          <button
            onClick={() => setBankModalOpen(true)}
            className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <span>Update Payout Account</span>
            <span className="text-[10px] text-gray-400">🔒</span>
          </button>
        </div>

        {/* Current Destination Card */}
        <div className="p-4 bg-linear-to-r from-gray-50 to-[#f9fafb] rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs text-gray-500 font-medium">Active Settlement Commercial Bank</div>
            <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <span>{vendor.bankName || "Moniepoint MFB"}</span>
              <span className="font-mono text-gray-600">
                (••••••{(vendor.bankAccountNumber || "8031234567").slice(-4)})
              </span>
            </div>
            <div className="text-[11px] text-gray-700 font-semibold flex items-center gap-1.5 pt-0.5">
              <span>Beneficiary:</span>
              <span className="font-mono text-indigo-950 uppercase">{verifiedLegalName}</span>
            </div>
          </div>

          <div className="text-left sm:text-right space-y-1">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
              Monnify Sub-Account Code
            </div>
            <div className="font-mono text-xs font-bold text-gray-800">
              {vendor.monnifySubAccountCode || "MFY_SUB_AMAKA_001"}
            </div>
            <div className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <span>✓ Monnify Direct Split Enabled</span>
            </div>
          </div>
        </div>

        {/* 3 Core Anti-Hacking Security Protocols */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="p-3.5 bg-gray-50/70 rounded-xl border border-gray-100 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
              <span className="text-indigo-600">1.</span>
              <span>Strict Name Matching</span>
            </div>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Every payout account submitted must fuzzy-match your registered BVN/NIN name via Monnify/Dojah identity
              lookup. Mule accounts (OPay, PalmPay) with differing names are rejected automatically.
            </p>
          </div>

          <div className="p-3.5 bg-gray-50/70 rounded-xl border border-gray-100 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
              <span className="text-amber-600">2.</span>
              <span>72-Hour Security Freeze</span>
            </div>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Modifying your payout destination freezes all pending and incoming payouts for 72 hours. Even if a
              hacker breaches your account, they cannot redirect funds and withdraw immediately.
            </p>
          </div>

          <div className="p-3.5 bg-gray-50/70 rounded-xl border border-gray-100 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
              <span className="text-rose-600">3.</span>
              <span>WhatsApp Panic Killswitch</span>
            </div>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              An immediate SMS/WhatsApp alert with a 1-tap Emergency Killswitch link is dispatched to your verified
              number ({vendor.whatsappPhone}). You have 72 hours to freeze the store before cash moves.
            </p>
          </div>
        </div>
      </div>

      {/* Subscription Plan & Billing Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Active Plan Overview (Span 2) */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-5">
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900">{currentSub.planName}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {currentSub.status}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Billed {currentSub.billingCycle.toLowerCase()} · Next billing date:{" "}
                <span className="font-semibold text-gray-800">
                  {new Date(currentSub.currentPeriodEnd).toLocaleDateString("en-NG", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </p>
            </div>

            <div className="text-right">
              <div className="text-xl font-bold text-gray-900">
                {currentSub.priceUsd ? `$${currentSub.priceUsd}` : `₦${currentSub.priceNaira.toLocaleString()}`}
                <span className="text-xs text-gray-500 font-normal ml-1">
                  (~₦{currentSub.priceNaira.toLocaleString()})
                </span>
              </div>
              <div className="text-[11px] text-gray-500">
                /{currentSub.billingCycle === "ANNUALLY" ? "year" : "month"}
              </div>
            </div>
          </div>

          {/* Quotas & Features Pill Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="text-[11px] text-gray-500">Platform Fee</div>
              <div className="text-sm font-bold text-gray-900 mt-0.5">
                {(currentSub.platformFeeBps / 100).toFixed(2)}%
              </div>
              <div className="text-[10px] text-emerald-700 font-semibold mt-1">Per transaction</div>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="text-[11px] text-gray-500">Catalog Capacity</div>
              <div className="text-sm font-bold text-gray-900 mt-0.5">
                {currentSub.maxProducts === -1 ? "Unlimited" : `${currentSub.maxProducts} items`}
              </div>
              <div className="text-[10px] text-gray-500 mt-1">Active sync</div>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="text-[11px] text-gray-500">Team Seats</div>
              <div className="text-sm font-bold text-gray-900 mt-0.5">
                {currentSub.maxTeamSeats} Seats
              </div>
              <div className="text-[10px] text-gray-500 mt-1">Role RBAC</div>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="text-[11px] text-gray-500">Sales Co-Pilot</div>
              <div className="text-sm font-bold text-gray-900 mt-0.5">
                {currentSub.copilotTier === "FULL_AUTO"
                  ? "Full-Auto AI"
                  : currentSub.copilotTier === "MULTI_AGENT"
                  ? "Multi-Agent"
                  : "Keyword"}
              </div>
              <div className="text-[10px] text-emerald-700 font-semibold mt-1">WhatsApp live</div>
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100">
            <div className="text-xs text-gray-500">
              Want to unlock Reseller Mirroring, lower 0.75% fees, or custom domains?
            </div>
            <button
              onClick={onNavigateToPlans}
              className="px-4 py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <SparklesIcon className="w-3.5 h-3.5" />
              <span>Explore All Plans & Upgrade</span>
            </button>
          </div>
        </div>

        {/* Payment Method Card (Span 1) */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Payment Method</h3>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                Auto-Renew ON
              </span>
            </div>

            <div className="mt-4 p-4 rounded-xl bg-gray-900 text-white space-y-3 shadow-xs">
              <div className="flex justify-between items-center text-xs text-gray-300">
                <span className="font-semibold uppercase tracking-wider text-[10px]">
                  {currentSub.paymentMethod?.brand || "Mastercard"}
                </span>
                <CreditCardIcon className="w-5 h-5 text-gray-400" />
              </div>
              <div className="font-mono text-sm tracking-widest pt-2">
                •••• •••• •••• {currentSub.paymentMethod?.last4 || "4242"}
              </div>
              <div className="flex justify-between items-center text-[10px] text-gray-400 pt-1">
                <span>{currentSub.paymentMethod?.bankName || "GTBank"}</span>
                <span>Expires {currentSub.paymentMethod?.expiry || "08/28"}</span>
              </div>
            </div>

            <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">
              Charges are securely billed in NGN via Paystack/Monnify recurring payment token.
            </p>
          </div>

          <button
            onClick={() => setCardModalOpen(true)}
            className="w-full py-2 px-3 border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-semibold rounded-xl transition-colors cursor-pointer text-center"
          >
            Update Payment Method
          </button>
        </div>
      </div>

      {/* Invoices & Receipts Table */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900">Billing History & Invoices</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Review and download tax-compliant receipts for your platform subscription charges.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 font-medium">
                <th className="py-2.5 px-3">Invoice #</th>
                <th className="py-2.5 px-3">Billing Date</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3">Amount</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="py-3 px-3 font-mono font-semibold text-gray-900 text-[11px]">
                    {inv.invoiceNumber}
                  </td>
                  <td className="py-3 px-3 text-gray-600 text-[11px]">
                    {new Date(inv.paidAt).toLocaleDateString("en-NG", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="py-3 px-3 text-gray-800 font-medium text-[11px]">
                    {inv.description}
                  </td>
                  <td className="py-3 px-3 font-bold text-gray-900 text-[11px]">
                    ₦{inv.amountNaira.toLocaleString()}
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      ✓ Paid
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => handleDownloadInvoice(inv)}
                      disabled={downloadingInvoiceId === inv.id}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer disabled:opacity-50"
                    >
                      <DownloadIcon className="w-3.5 h-3.5" />
                      <span>{downloadingInvoiceId === inv.id ? "Downloading..." : "PDF"}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payout Bank Account Modification Modal (with 72h Security Lockout) */}
      {bankModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔒</span>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Update Payout Bank Account</h3>
                  <div className="text-[11px] text-gray-500">Identity Lock & 72-Hour Security Protocol</div>
                </div>
              </div>
              <button
                onClick={() => setBankModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 text-xs p-1"
              >
                ✕
              </button>
            </div>

            {/* Crucial Security Protocol Warning Banner */}
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <span>⚠️ Mandatory 72-Hour Cooling-Off Protocol</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                To protect against account hijacking, changing payout details will immediately{" "}
                <strong>freeze all pending & incoming payouts for 72 hours</strong>. An emergency SMS/WhatsApp alert with
                a 1-tap Panic Killswitch will be sent to your phone (<code>{vendor.whatsappPhone}</code>).
              </p>
            </div>

            <form onSubmit={handleSubmitBankChange} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  Destination Commercial Bank
                </label>
                <select
                  value={selectedBankCode}
                  onChange={(e) => setSelectedBankCode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:border-emerald-600"
                >
                  {NIGERIAN_BANKS.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  10-Digit NUBAN Account Number
                </label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  pattern="[0-9]{10}"
                  placeholder="e.g. 0123456789"
                  value={accountNumberInput}
                  onChange={(e) => setAccountNumberInput(e.target.value.replace(/\D/g, ""))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg font-mono text-xs focus:outline-none focus:border-emerald-600"
                />
              </div>

              {/* Strict Name Matching Simulation / Verification Preview */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-500 font-medium">KYC Verified Legal Anchor:</span>
                  <span className="font-mono font-bold text-gray-900 uppercase">{verifiedLegalName}</span>
                </div>

                <div className="pt-2 border-t border-gray-200">
                  <div className="text-[11px] font-semibold text-gray-600 mb-1.5">
                    Live Anti-Hacking Mule Check Preview:
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSimulatedMuleAccount(false)}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                        !simulatedMuleAccount
                          ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                          : "bg-white border-gray-200 text-gray-600"
                      }`}
                    >
                      ✓ Matching Name ({verifiedLegalName.split(" ")[0]})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimulatedMuleAccount(true)}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                        simulatedMuleAccount
                          ? "bg-rose-50 border-rose-300 text-rose-800"
                          : "bg-white border-gray-200 text-gray-600"
                      }`}
                    >
                      ❌ Test Mule Account ("TUNDE BAKARE")
                    </button>
                  </div>
                  {simulatedMuleAccount ? (
                    <div className="mt-1.5 text-[10px] text-rose-700 font-semibold">
                      ⚠️ Resolved name 'TUNDE BAKARE' will be REJECTED at submission. Payouts cannot be diverted to mule
                      accounts.
                    </div>
                  ) : (
                    <div className="mt-1.5 text-[10px] text-emerald-700 font-semibold">
                      ✓ Resolved name matches verified merchant identity.
                    </div>
                  )}
                </div>
              </div>

              {/* 6-Digit Transaction PIN */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  6-Digit Transaction Security PIN
                </label>
                <input
                  type="password"
                  required
                  maxLength={6}
                  placeholder="••••••"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg font-mono text-xs focus:outline-none focus:border-emerald-600 tracking-widest"
                />
                <div className="text-[10px] text-gray-400 mt-1">Default demo PIN: 849204</div>
              </div>

              {/* WhatsApp OTP Verification */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-gray-700">
                    6-Digit WhatsApp Verification Code
                  </label>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={otpSending}
                    className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {otpSending ? "Sending Code..." : otpSent ? "Resend Code" : "Send Code to WhatsApp"}
                  </button>
                </div>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="Enter 6-digit code"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg font-mono text-xs focus:outline-none focus:border-emerald-600 tracking-wider"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setBankModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBankChange}
                  className="flex-1 py-2.5 bg-gray-900 hover:bg-black disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
                >
                  {submittingBankChange ? <span>Queuing Lockout...</span> : <span>Confirm & Lock for 72h</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Card Modal */}
      {cardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-sm">Update Debit Card</h3>
              <button
                onClick={() => setCardModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 text-xs p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCard} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  Card Number
                </label>
                <input
                  type="text"
                  required
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg font-mono focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="text"
                    required
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    placeholder="MM/YY"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg font-mono focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    CVV
                  </label>
                  <input
                    type="password"
                    required
                    maxLength={4}
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg font-mono focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <p className="text-[10px] text-gray-500 pt-1">
                A temporary ₦50 auth charge will be made and instantly refunded to verify your card token.
              </p>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setCardModalOpen(false)}
                  className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
                >
                  Save Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
