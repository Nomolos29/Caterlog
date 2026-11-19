"use client";

import React, { useState, useEffect } from "react";
import type {
  VendorProfile,
  KycSubmissionItem,
  SubscriptionInfo,
  TrustTierInfo,
  PlatformInvoiceItem,
  SubscriptionPlanId,
  BillingCycle,
} from "@/lib/types";
import { VerificationView } from "./verification-view";
import { BillingSubscriptionView } from "./billing-subscription-view";
import { TrustTierView } from "./trust-tier-view";
import { SubscriptionsView } from "./subscriptions-view";
import { ShieldCheckIcon, SparklesIcon } from "../icons";

export type ProfileTabId =
  | "profile"
  | "verification"
  | "billing"
  | "trust-tier"
  | "plans";

interface ProfileViewProps {
  vendor: VendorProfile;
  kycSubmissions?: KycSubmissionItem[];
  subscription?: SubscriptionInfo;
  trustTier?: TrustTierInfo;
  invoices?: PlatformInvoiceItem[];
  initialTab?: ProfileTabId;
  onUpdateProfile?: (profile: {
    businessName?: string;
    whatsappPhone?: string;
    instagramHandle?: string;
    baseState?: string;
    baseCity?: string;
  }) => Promise<boolean>;
  onSubmitKyc?: (input: {
    businessName: string;
    cacNumber?: string;
    tinNumber?: string;
    businessAddress?: string;
    businessCategory?: string;
    bankCode?: string;
    accountNumber?: string;
    resolvedAccountName?: string;
    whatsappPhone?: string;
    instagramHandle?: string;
  }) => Promise<boolean>;
  onUpgradePlan?: (planId: SubscriptionPlanId, cycle: BillingCycle) => Promise<boolean>;
  onFastTrackTrustTier?: (cacNumber?: string) => Promise<boolean>;
}

export function ProfileView({
  vendor,
  kycSubmissions = [],
  subscription,
  trustTier,
  invoices,
  initialTab = "profile",
  onUpdateProfile,
  onSubmitKyc,
  onUpgradePlan,
  onFastTrackTrustTier,
}: ProfileViewProps) {
  const [activeTab, setActiveTab] = useState<ProfileTabId>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const [businessName, setBusinessName] = useState(vendor.businessName || "");
  const [whatsappPhone, setWhatsappPhone] = useState(vendor.whatsappPhone || "");
  const [instagramHandle, setInstagramHandle] = useState(vendor.instagramHandle || "");
  const [baseState, setBaseState] = useState(vendor.baseState || "Lagos");
  const [baseCity, setBaseCity] = useState(vendor.baseCity || "Lagos");
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  const activeSub: SubscriptionInfo = subscription ||
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
    };

  const activeTier: TrustTierInfo = trustTier ||
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

  useEffect(() => {
    setBusinessName(vendor.businessName || "");
    setWhatsappPhone(vendor.whatsappPhone || "");
    setInstagramHandle(vendor.instagramHandle || "");
    setBaseState(vendor.baseState || "Lagos");
    setBaseCity(vendor.baseCity || "Lagos");
  }, [
    vendor.businessName,
    vendor.whatsappPhone,
    vendor.instagramHandle,
    vendor.baseState,
    vendor.baseCity,
  ]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateProfile) return;
    setSaving(true);
    setSavedToast(null);
    try {
      const ok = await onUpdateProfile({
        businessName: businessName.trim(),
        whatsappPhone: whatsappPhone.trim(),
        instagramHandle: instagramHandle.trim(),
        baseState: baseState.trim(),
        baseCity: baseCity.trim(),
      });
      if (ok) {
        setSavedToast("Store profile updated and synced to database.");
        setTimeout(() => setSavedToast(null), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  const getHeaderTitle = () => {
    switch (activeTab) {
      case "profile":
        return "Merchant Profile & Settings";
      case "verification":
        return "Business Verification (KYC)";
      case "billing":
        return "Billing & Subscription Management";
      case "trust-tier":
        return "Account Trust & Settlement Tier";
      case "plans":
        return "Platform Subscription Plans";
      default:
        return "Account Settings";
    }
  };

  const getHeaderSubtitle = () => {
    switch (activeTab) {
      case "profile":
        return "Manage your storefront identity, WhatsApp business line, social handle, and dispatch location.";
      case "verification":
        return "Complete CAC, TIN, and settlement bank verification for instant Monnify split payouts.";
      case "billing":
        return "Manage your active SaaS plan, payment card, invoice receipts, and transaction fee rates.";
      case "trust-tier":
        return "Monitor your payout settlement release speed, clean order track record, and fast-track eligibility.";
      case "plans":
        return "Compare feature breakdowns and role coverage across Reseller ($5), Starter ($10), Growth ($15), and Pro Concierge ($20).";
      default:
        return "";
    }
  };

  const isResellerRole = vendor.role === "reseller";

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-h-[52px]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">{getHeaderTitle()}</h1>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                vendor.role === "reseller"
                  ? "bg-blue-50 text-blue-800 border-blue-200"
                  : vendor.role === "starter"
                  ? "bg-amber-50 text-amber-900 border-amber-200"
                  : vendor.role === "growth"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-purple-50 text-purple-900 border-purple-200"
              }`}
            >
              {vendor.role === "reseller"
                ? "Role: Reseller / Dropshipper ($5)"
                : vendor.role === "starter"
                ? "Role: Starter Vendor ($10)"
                : vendor.role === "growth"
                ? "Role: Growth Vendor ($15)"
                : "Role: Pro Concierge ($20)"}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{getHeaderSubtitle()}</p>
        </div>
      </div>

      {/* Fixed-position Tab Strip */}
      <div className="flex border-b border-gray-200 text-xs font-medium gap-6 overflow-x-auto whitespace-nowrap scrollbar-none pb-px">
        <button
          onClick={() => setActiveTab("profile")}
          className={`pb-2.5 cursor-pointer transition-colors ${
            activeTab === "profile"
              ? "border-b-2 border-emerald-600 text-emerald-700 font-semibold"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          Store Profile
        </button>

        <button
          onClick={() => setActiveTab("billing")}
          className={`pb-2.5 cursor-pointer transition-colors flex items-center gap-1.5 ${
            activeTab === "billing"
              ? "border-b-2 border-emerald-600 text-emerald-700 font-semibold"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          <span>Billing & Subscription</span>
          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
            {activeSub.planName.split(" ")[0]}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("trust-tier")}
          className={`pb-2.5 cursor-pointer transition-colors flex items-center gap-1.5 ${
            activeTab === "trust-tier"
              ? "border-b-2 border-emerald-600 text-emerald-700 font-semibold"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          <span>Account Trust Tier</span>
          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-800">
            Level {activeTier.currentTier}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("verification")}
          className={`pb-2.5 cursor-pointer transition-colors ${
            activeTab === "verification"
              ? "border-b-2 border-emerald-600 text-emerald-700 font-semibold"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          Verification (KYC)
        </button>

        <button
          onClick={() => setActiveTab("plans")}
          className={`pb-2.5 cursor-pointer transition-colors flex items-center gap-1.5 ${
            activeTab === "plans"
              ? "border-b-2 border-emerald-600 text-emerald-700 font-semibold"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          <SparklesIcon className="w-3.5 h-3.5 text-emerald-600" />
          <span>All Plans & Pricing</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "profile" && (
        <div className="space-y-6">
          {savedToast && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
              <span>✓</span>
              <span>{savedToast}</span>
            </div>
          )}

          {/* Quick Status Cards: Account Tier & Active Plan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Account Trust Tier Card */}
            <div className="bg-linear-to-r from-indigo-50/50 to-white rounded-2xl border border-indigo-100 p-5 shadow-2xs flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <ShieldCheckIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-900">
                      Settlement Speed: {activeTier.tierName}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {activeTier.settlementSpeed} · Limit: ₦
                    {activeTier.dailyPayoutLimitNaira.toLocaleString()}/day
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab("trust-tier")}
                className="px-3 py-1.5 rounded-lg bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-semibold transition-colors cursor-pointer shrink-0 shadow-2xs"
              >
                Upgrade Tier →
              </button>
            </div>

            {/* Platform Subscription Card */}
            <div className="bg-linear-to-r from-emerald-50/50 to-white rounded-2xl border border-emerald-100 p-5 shadow-2xs flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#0d5c3a] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <SparklesIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-900">
                      Platform Plan: {activeSub.planName}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                      {(activeSub.platformFeeBps / 100).toFixed(2)}% fee
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {activeSub.priceUsd ? `$${activeSub.priceUsd}` : `₦${activeSub.priceNaira.toLocaleString()}`}
                    <span className="text-gray-400"> (~₦{activeSub.priceNaira.toLocaleString()})</span>/
                    {activeSub.billingCycle.toLowerCase()} · Billed via Card
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab("billing")}
                className="px-3 py-1.5 rounded-lg bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-50 text-xs font-semibold transition-colors cursor-pointer shrink-0 shadow-2xs"
              >
                Manage Billing →
              </button>
            </div>
          </div>

          <form
            onSubmit={handleSaveProfile}
            className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-5 text-xs"
          >
            <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
              <div className="w-12 h-12 rounded-full bg-[#eef2ff] text-[#1e1b4b] border border-indigo-200 flex items-center justify-center font-bold text-sm shrink-0">
                {(businessName || "CS")
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900">
                  {businessName || vendor.businessName}
                </div>
                <div className="text-[11px] text-gray-500 font-mono">
                  Store slug: /{vendor.slug} · Status: {vendor.verificationStatus}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  Business Name
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  WhatsApp Business Phone
                </label>
                <input
                  type="text"
                  required
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value)}
                  placeholder="+234803..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  Instagram Handle
                </label>
                <input
                  type="text"
                  value={instagramHandle}
                  onChange={(e) => setInstagramHandle(e.target.value)}
                  placeholder="@yourstore"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    Base State
                  </label>
                  <input
                    type="text"
                    value={baseState}
                    onChange={(e) => setBaseState(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    Base City
                  </label>
                  <input
                    type="text"
                    value={baseCity}
                    onChange={(e) => setBaseCity(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                {saving ? "Saving Profile..." : "Save Profile"}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === "billing" && (
        <BillingSubscriptionView
          vendor={vendor}
          subscription={activeSub}
          trustTier={activeTier}
          invoices={invoices}
          onUpgradePlan={onUpgradePlan}
          onFastTrackTrustTier={onFastTrackTrustTier}
          onNavigateToKyc={() => setActiveTab("verification")}
          onNavigateToPlans={() => setActiveTab("plans")}
        />
      )}

      {activeTab === "trust-tier" && (
        <TrustTierView
          vendor={vendor}
          trustTier={activeTier}
          onFastTrack={onFastTrackTrustTier}
          onNavigateToKyc={() => setActiveTab("verification")}
        />
      )}

      {activeTab === "verification" && (
        <VerificationView
          vendor={vendor}
          vendorName={vendor.businessName}
          whatsappPhone={vendor.whatsappPhone}
          kycSubmissions={kycSubmissions}
          onSubmitKyc={onSubmitKyc}
          onComplete={() => setActiveTab("profile")}
        />
      )}

      {activeTab === "plans" && (
        <SubscriptionsView
          vendor={vendor}
          subscription={activeSub}
          trustTier={activeTier}
          onUpgradePlan={onUpgradePlan}
          onNavigateToKyc={() => setActiveTab("verification")}
          onNavigateToBilling={() => setActiveTab("billing")}
        />
      )}
    </div>
  );
}
