"use client";

import React, { useState } from "react";
import type {
  VendorProfile,
  SubscriptionInfo,
  SubscriptionPlanId,
  BillingCycle,
  TrustTierInfo,
} from "@/lib/types";
import {
  CheckIcon,
  SparklesIcon,
  ShieldCheckIcon,
  CreditCardIcon,
  ClockIcon,
} from "../icons";

interface SubscriptionsViewProps {
  vendor: VendorProfile;
  subscription?: SubscriptionInfo;
  trustTier?: TrustTierInfo;
  onUpgradePlan?: (planId: SubscriptionPlanId, cycle: BillingCycle) => Promise<boolean>;
  onNavigateToKyc?: () => void;
  onNavigateToBilling?: () => void;
}

interface PlanDefinition {
  id: SubscriptionPlanId;
  name: string;
  badge?: string;
  badgeColor?: string;
  coreIdentity: string;
  tagline: string;
  whyUpgrade: string;
  monthlyUsd: number;
  annualUsd: number;
  monthlyNaira: number;
  annualNaira: number;
  platformFeePercent: string;
  productsLimit: string;
  teamSeats: string;
  copilotDescription: string;
  shippingIdentity: string;
  features: string[];
  ctaLabel: string;
  isPopular?: boolean;
}

const PLANS: PlanDefinition[] = [
  {
    id: "RESELLER",
    name: "Reseller / Dropshipper",
    badge: "Zero-Capital",
    badgeColor: "bg-blue-600 text-white",
    coreIdentity: "Zero-Capital Sales Rep",
    tagline: "Start selling online immediately without owning or holding a single product in stock.",
    whyUpgrade: "Cheapest entry point to start selling with zero inventory capital.",
    monthlyUsd: 5,
    annualUsd: 50,
    monthlyNaira: 7500,
    annualNaira: 75000,
    platformFeePercent: "1.5%",
    productsLimit: "Unlimited supplier catalog mirrors",
    teamSeats: "1 Admin seat",
    copilotDescription: "Keyword auto-checkout links (#catalog, #buy)",
    shippingIdentity: "Supplier ships direct to customer",
    features: [
      "Copy & markup any verified Market Boost supplier catalog",
      "Instant auto-storefront + branded WhatsApp checkout links",
      "Instant Monnify markup payouts directly to your bank account",
      "Zero warehouse, zero packing, zero inventory risk",
      "1.5% platform transaction fee",
      "Customer delivery notifications via WhatsApp/SMS",
      "Standard community support",
    ],
    ctaLabel: "Start as Reseller ($5)",
  },
  {
    id: "STARTER",
    name: "Starter Vendor",
    badge: "Solo Brand",
    badgeColor: "bg-amber-600 text-white",
    coreIdentity: "Solo Brand & Storefront",
    tagline: "For independent social merchants running their own boutique or product brand.",
    whyUpgrade: "Replaces a ₦150k+ website developer and automates daily WhatsApp/IG selling.",
    monthlyUsd: 10,
    annualUsd: 100,
    monthlyNaira: 15000,
    annualNaira: 150000,
    platformFeePercent: "1.25%",
    productsLimit: "Up to 100 products (high storage)",
    teamSeats: "2 Team seats",
    copilotDescription: "Inactivity Co-Pilot (auto-replies after 60s)",
    shippingIdentity: "100% self-managed shipping (vendor sets flat fee & books own rider)",
    features: [
      "Full WhatsApp & Instagram chat-to-checkout automation",
      "Auto-Generated Website (turns your inventory into a live site instantly)",
      "Smart Sales Co-Pilot (inactivity timer auto-takes over when you're busy)",
      "Omnichannel Story/Status Auto-Scheduler (4-in-1 best-seller grids)",
      "100% self-managed shipping: set your own flat delivery fees and call your riders",
      "Up to 100 active products with multi-photo variations",
      "Level 0/1 escrow integration with Shipbubble/Kwik tracking",
      "1.25% platform transaction fee",
      "2 Team Member accounts",
    ],
    ctaLabel: "Select Starter ($10)",
  },
  {
    id: "GROWTH",
    name: "Growth Vendor (Market Boost)",
    badge: "Most Popular",
    badgeColor: "bg-emerald-600 text-white",
    coreIdentity: "Wholesale & Distribution",
    tagline: "For established merchants and suppliers ready to recruit an army of resellers.",
    whyUpgrade: "Adding just 2–3 active resellers easily pays back the extra $5/month in extra sales volume.",
    monthlyUsd: 15,
    annualUsd: 150,
    monthlyNaira: 22500,
    annualNaira: 225000,
    platformFeePercent: "1.0% (save 33% on fees)",
    productsLimit: "Unlimited products + Reseller Mirrors",
    teamSeats: "5 Team seats",
    copilotDescription: "Full-Auto AI Co-Pilot (natural speech inquiries & orders)",
    shippingIdentity: "Pickup Station / Hub Delivery (discounted station-to-station courier rates)",
    features: [
      "Everything in $10 Starter Vendor, plus:",
      "Market Boost (Geofenced Wholesale Directory): publish SKUs to approved states/LGAs",
      "Allow hundreds of verified resellers to copy and sell your products across Nigeria",
      "Pickup Station / Hub Delivery Integration (discounted station-to-station courier rates)",
      "Unlimited products & real-time inventory synchronization",
      "Visual Status Matching (pHash image quotation for screenshot inquiries)",
      "Level 1 Dispatch Escrow eligible (50% restock capital upfront at rider pickup)",
      "Automated WhatsApp cart abandonment recovery",
      "1.0% platform transaction fee",
      "5 Team Member seats (Sales reps, dispatchers, accountants)",
      "Priority WhatsApp Human Support (<15 min response)",
    ],
    ctaLabel: "Upgrade to Growth ($15)",
    isPopular: true,
  },
  {
    id: "PRO",
    name: "Pro Concierge Vendor",
    badge: "All-In-One Flagship",
    badgeColor: "bg-indigo-600 text-white",
    coreIdentity: "Hands-Free Scale & Express",
    tagline: "For high-volume wholesalers and brands that want 100% hands-off logistics.",
    whyUpgrade: "Saves hours of daily rider calls, protects vendor privacy, and wins buyer trust with guaranteed doorstep delivery.",
    monthlyUsd: 20,
    annualUsd: 200,
    monthlyNaira: 30000,
    annualNaira: 300000,
    platformFeePercent: "0.75% (lowest platform fee)",
    productsLimit: "Unlimited products + Multi-branch",
    teamSeats: "15 Team seats + Audit Log",
    copilotDescription: "Multi-Agent AI with bulk wholesale quotations & custom price lists",
    shippingIdentity: "3 Daily Pickup Windows (10AM, 1PM, 4PM) + Express Doorstep Concierge",
    features: [
      "Everything in $15 Growth Vendor (including full Market Boost directory access), plus:",
      "3 Daily Scheduled Pickup Windows: 10:00 AM, 1:00 PM, 4:00 PM",
      "Express Doorstep Delivery at bulk discounted platform rates",
      "Caterlog Delivery Concierge: Caterlog handles rider coordination end-to-end",
      "Shielded Privacy: Buyers call Caterlog Support (vendor personal number stays 100% private)",
      "Level 2 Instant 0-Second Monnify Split Settlement eligible",
      "Custom Storefront Domain (shop.yourbrand.ng)",
      "15 Team Member seats + granular role permissions and audit logging",
      "0.75% platform transaction fee (lowest fee tier)",
      "Dedicated WhatsApp VIP Account Manager + 24/7 Phone SLA",
    ],
    ctaLabel: "Upgrade to Pro Concierge ($20)",
  },
];

const COMPARISON_ROWS = [
  {
    category: "Core Positioning & Value",
    items: [
      {
        name: "Core Identity",
        reseller: "Zero-Capital Sales Rep",
        starter: "Solo Brand & Storefront",
        growth: "Wholesale & Distribution",
        pro: "Hands-Free Scale & Express",
      },
      {
        name: "Primary ROI Hook",
        reseller: "Zero upfront stock capital",
        starter: "Replaces ₦150k website dev",
        growth: "2-3 resellers pay the fee",
        pro: "Zero rider phone calls + privacy",
      },
    ],
  },
  {
    category: "Storefront & Selling Capabilities",
    items: [
      { name: "Active Catalog Limit", reseller: "Mirrored SKUs", starter: "Up to 100 products", growth: "Unlimited products", pro: "Unlimited + Multi-branch" },
      { name: "Auto-Generated Website", reseller: "Reseller Storefront", starter: "Included (Full Site)", growth: "Included (Full Site)", pro: "Custom Domain (shop.brand.ng)" },
      { name: "Story / Status Auto-Scheduler", reseller: "Manual links", starter: "4-in-1 Best-Seller Grids", growth: "4-in-1 Best-Seller Grids", pro: "Automated Omnichannel Grids" },
      { name: "Market Boost Wholesale Directory", reseller: "Browse & Copy", starter: "—", growth: "Publish to approved states", pro: "Publish to approved states + VIP boost" },
      { name: "Reseller Network Recruitment", reseller: "Sell for suppliers", starter: "—", growth: "Hundreds of active resellers", pro: "Hundreds of active resellers" },
    ],
  },
  {
    category: "Logistics & Shipping Orchestration",
    items: [
      {
        name: "Shipping Model",
        reseller: "Supplier dropships",
        starter: "100% Self-Managed (flat fee)",
        growth: "Pickup Station / Hub Delivery",
        pro: "Express Doorstep Concierge",
      },
      {
        name: "Scheduled Pickup Windows",
        reseller: "N/A",
        starter: "Manual rider booking",
        growth: "Vendor coordinates drop-off",
        pro: "3 Windows (10AM, 1PM, 4PM)",
      },
      {
        name: "Shielded Privacy & Buyer Support",
        reseller: "Vendor / supplier phone",
        starter: "Vendor handles calls",
        growth: "Vendor handles calls",
        pro: "Caterlog Support takes buyer calls",
      },
    ],
  },
  {
    category: "WhatsApp AI & Financial Settlement",
    items: [
      { name: "Sales Co-Pilot Mode", reseller: "Keyword Links", starter: "Inactivity Co-Pilot (60s)", growth: "Full-Auto AI (Natural Lang)", pro: "Multi-Agent AI (Bulk Quotations)" },
      { name: "Visual Status pHash Match", reseller: "—", starter: "—", growth: "Included", pro: "Included (High-res)" },
      { name: "Platform Transaction Fee", reseller: "1.5%", starter: "1.25%", growth: "1.0%", pro: "0.75%" },
      { name: "Settlement Escrow Tier", reseller: "Instant Markup Split", starter: "Level 0 (Delivery-Triggered)", growth: "Level 1 (50% at Pickup)", pro: "Level 2 (0-Sec Instant Split)" },
      { name: "Team Seats", reseller: "1 Seat", starter: "2 Seats", growth: "5 Seats", pro: "15 Seats + Audit Logs" },
      { name: "Support Level", reseller: "Community", starter: "Standard Email/WA", growth: "Priority WhatsApp (<15m)", pro: "Dedicated VIP Manager (24/7)" },
    ],
  },
];

export function SubscriptionsView({
  vendor,
  subscription,
  trustTier,
  onUpgradePlan,
  onNavigateToKyc,
  onNavigateToBilling,
}: SubscriptionsViewProps) {
  const currentPlanId: SubscriptionPlanId =
    subscription?.planId || vendor.subscription?.planId || "GROWTH";
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(
    subscription?.billingCycle || vendor.subscription?.billingCycle || "MONTHLY"
  );
  const [currencyMode, setCurrencyMode] = useState<"USD" | "NGN">("USD");
  const [upgradingPlan, setUpgradingPlan] = useState<SubscriptionPlanId | null>(null);
  const [confirmModalPlan, setConfirmModalPlan] = useState<PlanDefinition | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"CARD" | "TRANSFER" | "USDT">("CARD");
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const isAnnual = billingCycle === "ANNUALLY";

  const handleOpenUpgrade = (plan: PlanDefinition) => {
    if (plan.id === currentPlanId) return;
    setConfirmModalPlan(plan);
  };

  const handleConfirmUpgrade = async () => {
    if (!confirmModalPlan) return;
    setUpgradingPlan(confirmModalPlan.id);
    try {
      if (onUpgradePlan) {
        const ok = await onUpgradePlan(confirmModalPlan.id, billingCycle);
        if (ok) {
          setSuccessToast(`Successfully upgraded to the ${confirmModalPlan.name}!`);
          setTimeout(() => setSuccessToast(null), 4000);
          setConfirmModalPlan(null);
        }
      }
    } finally {
      setUpgradingPlan(null);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto w-full pb-24 text-gray-900">
      {/* Toast */}
      {successToast && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center gap-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
            ✓
          </span>
          <span>{successToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3 pt-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 text-[11px] font-bold tracking-wide uppercase">
          <SparklesIcon className="w-3.5 h-3.5 text-indigo-600" />
          <span>The Balanced 4-Tier Value Ladder</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">
          Distinct tiers built for your stage of growth
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 max-w-2xl mx-auto leading-relaxed">
          Separating <strong>Distribution (Market Boost)</strong> from <strong>Fulfillment (Concierge Shipping)</strong> so you
          never overpay for features you don't use.
        </p>

        {/* Currency & Billing Cycle Controls */}
        <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
          {/* Monthly / Annual Toggle */}
          <div className="bg-gray-100 p-1 rounded-xl inline-flex items-center gap-1 border border-gray-200">
            <button
              onClick={() => setBillingCycle("MONTHLY")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                billingCycle === "MONTHLY"
                  ? "bg-white text-gray-900 shadow-xs"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBillingCycle("ANNUALLY")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                billingCycle === "ANNUALLY"
                  ? "bg-white text-gray-900 shadow-xs"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <span>Annual Billing</span>
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                2 Mo Free
              </span>
            </button>
          </div>

          {/* Currency Toggle (USD vs NGN) */}
          <div className="bg-gray-100 p-1 rounded-xl inline-flex items-center gap-1 border border-gray-200 text-xs font-semibold">
            <button
              onClick={() => setCurrencyMode("USD")}
              className={`px-3 py-2 rounded-lg transition-all cursor-pointer ${
                currencyMode === "USD"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              USD ($ / USDT)
            </button>
            <button
              onClick={() => setCurrencyMode("NGN")}
              className={`px-3 py-2 rounded-lg transition-all cursor-pointer ${
                currencyMode === "NGN"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              NGN (₦)
            </button>
          </div>
        </div>
      </div>

      {/* Trust Tier Bridge Banner */}
      <div className="bg-linear-to-r from-[#eef2ff] via-white to-[#f0fdf4] border border-indigo-100 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <ShieldCheckIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-900">
                Current Trust Tier: {trustTier?.tierName || "Level 1: Dispatch Payouts"}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Active
              </span>
            </div>
            <p className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">
              Your subscription plan determines software limits and automation features. Your{" "}
              <strong>Account Trust Tier</strong> determines how quickly courier escrow funds release to your bank.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onNavigateToBilling}
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-xs font-semibold transition-colors cursor-pointer"
          >
            Manage Billing
          </button>
          <button
            onClick={onNavigateToKyc}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
          >
            <span>Fast-Track to Level 2</span>
            <span>→</span>
          </button>
        </div>
      </div>

      {/* 4 Main Pricing Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {PLANS.map((plan) => {
          const isCurrent =
            plan.id === currentPlanId ||
            (currentPlanId === "SCALE" && plan.id === "PRO");

          const displayPrice =
            currencyMode === "USD"
              ? isAnnual
                ? `$${plan.annualUsd}`
                : `$${plan.monthlyUsd}`
              : isAnnual
              ? `₦${plan.annualNaira.toLocaleString()}`
              : `₦${plan.monthlyNaira.toLocaleString()}`;

          const secondaryPrice =
            currencyMode === "USD"
              ? isAnnual
                ? `~₦${plan.annualNaira.toLocaleString()}/yr`
                : `~₦${plan.monthlyNaira.toLocaleString()}/mo`
              : isAnnual
              ? `$${plan.annualUsd}/yr`
              : `$${plan.monthlyUsd}/mo`;

          const periodLabel = isAnnual ? "/ year" : "/ month";

          return (
            <div
              key={plan.id}
              className={`rounded-2xl p-5 transition-all relative flex flex-col justify-between ${
                plan.isPopular
                  ? "bg-white border-2 border-emerald-500 shadow-md ring-4 ring-emerald-500/10"
                  : isCurrent
                  ? "bg-white border-2 border-indigo-500 shadow-sm"
                  : "bg-white border border-gray-200 shadow-xs hover:border-gray-300"
              }`}
            >
              {plan.badge && (
                <div
                  className={`absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-xs ${plan.badgeColor}`}
                >
                  {plan.badge}
                </div>
              )}

              <div>
                {/* Plan Header */}
                <div className="flex items-center justify-between gap-1">
                  <h3 className="text-base font-bold text-gray-900 leading-tight">{plan.name}</h3>
                </div>

                {/* Single-sentence Core Identity */}
                <div className="mt-1 text-xs font-semibold text-indigo-900 italic">
                  "{plan.coreIdentity}"
                </div>

                <p className="text-[11px] text-gray-500 mt-1 min-h-[38px] leading-relaxed">
                  {plan.tagline}
                </p>

                {/* Price Display */}
                <div className="mt-4 pb-4 border-b border-gray-100">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                      {displayPrice}
                    </span>
                    <span className="text-xs font-semibold text-gray-500">{periodLabel}</span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{secondaryPrice}</div>
                  {isAnnual && (
                    <div className="text-[10px] text-emerald-700 font-bold mt-1">
                      Includes 2 months free!
                    </div>
                  )}
                </div>

                {/* Value Hook */}
                <div className="py-2.5 px-3 my-3 bg-gray-50 border border-gray-100 rounded-xl text-[10px] text-gray-700 leading-snug">
                  <strong className="text-gray-900">Why upgrade: </strong>
                  <span>{plan.whyUpgrade}</span>
                </div>

                {/* Key Metrics Quick Pill Grid */}
                <div className="space-y-1.5 text-[11px] pb-3 border-b border-gray-100">
                  <div className="flex items-center justify-between text-gray-600">
                    <span className="text-[10px]">Platform Fee:</span>
                    <span className="font-bold text-gray-900">{plan.platformFeePercent}</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-600">
                    <span className="text-[10px]">Catalog:</span>
                    <span className="font-bold text-gray-900 truncate max-w-[130px]">{plan.productsLimit}</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-600">
                    <span className="text-[10px]">Shipping Model:</span>
                    <span className="font-bold text-indigo-950 truncate max-w-[130px]">{plan.shippingIdentity}</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-600">
                    <span className="text-[10px]">Team:</span>
                    <span className="font-bold text-gray-900">{plan.teamSeats}</span>
                  </div>
                </div>

                {/* Feature Bullet List */}
                <div className="pt-3 space-y-2">
                  <div className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                    Included Perks
                  </div>
                  <ul className="space-y-1.5 text-xs text-gray-600">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <CheckIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span className="leading-tight text-[11px] text-gray-700">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-5 mt-5 border-t border-gray-100">
                {isCurrent ? (
                  <button
                    disabled
                    className="w-full py-2.5 px-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 font-bold text-xs cursor-default flex items-center justify-center gap-1.5"
                  >
                    <span>✓ Active on your store</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleOpenUpgrade(plan)}
                    className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-xs active:scale-[0.98] ${
                      plan.isPopular
                        ? "bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white"
                        : plan.id === "PRO"
                        ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                        : "bg-white hover:bg-gray-50 text-gray-800 border border-gray-300"
                    }`}
                  >
                    {plan.ctaLabel}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Free Plan Callout Bar */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div>
          <span className="font-bold text-gray-900">Need a free trial or explorer account? </span>
          <span className="text-gray-600">
            Our Free Explorer tier ($0/mo) includes manual order logging, up to 25 catalog items, standard WhatsApp payment links, and delivery-triggered escrow.
          </span>
        </div>
        <button
          onClick={() => {
            if (onUpgradePlan) void onUpgradePlan("FREE", "MONTHLY");
          }}
          className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 font-semibold shrink-0 cursor-pointer"
        >
          Select Free Explorer ($0)
        </button>
      </div>

      {/* Feature Comparison Matrix Table */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Compare all plan features</h2>
          <p className="text-xs text-gray-500 mt-1">
            Detailed breakdown comparing Reseller ($5), Starter ($10), Growth ($15), and Pro Concierge ($20).
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-center">
                <th className="py-3 px-3 font-bold text-gray-900 text-left w-1/4">Feature</th>
                <th className="py-3 px-2 font-bold text-blue-900 w-3/16">Reseller ($5)</th>
                <th className="py-3 px-2 font-bold text-amber-900 w-3/16">Starter ($10)</th>
                <th className="py-3 px-2 font-bold text-emerald-900 bg-emerald-50/50 rounded-t-lg w-3/16">
                  Growth ($15)
                </th>
                <th className="py-3 px-2 font-bold text-indigo-900 w-3/16">Pro Concierge ($20)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {COMPARISON_ROWS.map((section, sIdx) => (
                <React.Fragment key={sIdx}>
                  <tr className="bg-gray-50/70">
                    <td
                      colSpan={5}
                      className="py-2 px-3 font-bold text-[10px] uppercase tracking-wider text-gray-600"
                    >
                      {section.category}
                    </td>
                  </tr>
                  {section.items.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-gray-50/50 transition-colors text-center">
                      <td className="py-2.5 px-3 text-left text-gray-700 font-medium text-[11px]">
                        {row.name}
                      </td>
                      <td className="py-2.5 px-2 text-gray-600 text-[11px]">{row.reseller}</td>
                      <td className="py-2.5 px-2 text-gray-800 text-[11px] font-medium">{row.starter}</td>
                      <td className="py-2.5 px-2 font-semibold text-emerald-900 bg-emerald-50/30 text-[11px]">
                        {row.growth}
                      </td>
                      <td className="py-2.5 px-2 font-semibold text-indigo-900 text-[11px]">{row.pro}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Frequently Asked Questions */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Frequently Asked Questions</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Everything you need to know about roles, subscription tiers, fulfillment, and payout security.
          </p>
        </div>

        <div className="divide-y divide-gray-100 text-xs">
          {[
            {
              q: "What are the two platform roles in Caterlog, and which one is right for me?",
              a: "Caterlog operates with two primary roles: Reseller and Vendor. If you do not own physical inventory and want to earn profit margins by sharing products to your contacts, choose the Reseller role ($5/mo). If you own physical stock, manage inventory, or manufacture goods, choose the Vendor role (Free, $10 Starter, $15 Growth, or $20 Pro Concierge). You can also switch or operate both from your account switcher.",
            },
            {
              q: "What features are covered under the Reseller subscription ($5/mo)?",
              a: "The $5/mo (or $50/yr) Reseller plan gives you 1-click catalog mirroring from verified Market Boost suppliers, custom markup controls, personal branded WhatsApp checkout links, an automated online storefront, and real-time delivery notifications for your customers. When an order is paid and delivered, your profit markup is automatically disbursed straight to your verified bank account via Monnify, while the supplier fulfills and ships the item.",
            },
            {
              q: "How do Reseller profit markups get paid out?",
              a: "Reseller payouts use Monnify's multi-party settlement engine. When your customer pays, the system calculates your markup margin. Once the order reaches its settlement trigger (such as courier delivery confirmation), your profit is routed directly to your KYC-verified bank account without waiting for manual platform approval or pooling in a vulnerable shared balance.",
            },
            {
              q: "What is the difference between the 3 Vendor subscription plans ($10, $15, $20)?",
              a: "The $10 Starter plan is built for solo brands selling direct-to-consumer with an auto-generated website, Sales Co-Pilot, and self-managed shipping. The $15 Growth plan unlocks Wholesale Distribution through Market Boost (allowing hundreds of resellers to sell for you) plus pickup station hub logistics. The $20 Pro Concierge plan is our all-in-one flagship for hands-free scale, adding 3 Daily Scheduled Pickup Sweeps (10AM, 1PM, 4PM), Express Doorstep Delivery, Caterlog Delivery Concierge, and Shielded Privacy Support.",
            },
            {
              q: "Why is Market Boost on the $15 Growth plan instead of the $10 Starter plan?",
              a: "The $10 tier provides solo merchants with a complete storefront, AI sales co-pilot, and status scheduler for their direct customer sales. Vendors upgrade to $15 specifically when they want to recruit dropshippers and wholesale resellers across Nigeria. Adding just 2 to 3 active resellers typically generates enough additional sales volume to pay back the $5/month difference immediately.",
            },
            {
              q: "What if I am on the $10 Starter tier and want managed shipping without Market Boost?",
              a: "Because Market Boost syndication is opt-in on a per-product basis, upgrading to the $20 Pro Concierge tier gives you the full concierge shipping suite (3 daily scheduled pickup windows, express doorstep delivery, Caterlog rider care). You can simply leave Market Boost toggled OFF on your individual products if you only sell direct-to-consumer.",
            },
            {
              q: "How do shipping logistics differ across each Vendor plan?",
              a: "On Starter ($10), shipping is 100% self-managed—you set your flat delivery fees and book your own dispatch riders. On Growth ($15), you get Pickup Station / Hub Delivery integration with discounted courier rates where you drop off packages at local partner hubs (GIGL, Shipbubble, Kwik). On Pro Concierge ($20), dedicated couriers arrive at your shop or home during 3 scheduled daily windows (10:00 AM, 1:00 PM, 4:00 PM) for express doorstep delivery, and Caterlog manages all rider tracking.",
            },
            {
              q: "What are the 3 daily pickup sweeps on the $20 Pro Concierge tier?",
              a: "Pro Concierge subscribers enjoy scheduled courier sweeps at 10:00 AM, 1:00 PM, and 4:00 PM every business day. Riders arrive automatically on schedule to pick up packed parcels directly from your shop, warehouse, or home, eliminating phone-tag and daily rider delays.",
            },
            {
              q: "What does Shielded Privacy & Caterlog Customer Care mean on the $20 tier?",
              a: "On order waybills, dispatch tags, and customer tracking portals, buyers are directed to call Caterlog Customer Support instead of your personal phone number. Caterlog manages rider coordination, landmark instructions, and package safety end-to-end, keeping your personal phone line private and spam-free.",
            },
            {
              q: "What is the Free Explorer ($0) tier and what are its limits?",
              a: "The Free Explorer tier allows new vendors to test Caterlog with up to 5 products and standard WhatsApp checkout links. It is subject to Level 0 delivery-triggered escrow release and standard 1.5% transaction fees, making it an easy sandbox before upgrading to a growth plan.",
            },
            {
              q: "How does Caterlog's Dynamic Trust Settlement Engine work (Level 0, 1, 2)?",
              a: "Instead of freezing capital indefinitely, Caterlog graduates vendors based on verification and clean fulfillment: Level 0 (New/Unverified) unlocks funds upon courier delivery confirmation. Level 1 (KYC verified + 5 clean orders) releases 50% of the funds the instant the courier scans the package at pickup. Level 2 (Wholesalers with CAC or 20+ clean orders) receives Instant Monnify Split Settlement (0-second escrow) straight to their bank account at payment time.",
            },
            {
              q: "What is the 72-Hour Payout Bank Change Lockout and how does it prevent hacks?",
              a: "If an account is ever compromised, hackers often attempt to redirect payouts to unverified mule accounts. Caterlog prevents this by requiring a 6-digit transaction PIN, a WhatsApp OTP, and strict BVN/NIN name matching to update bank details. Once changed, a mandatory 72-hour cooling-off freeze is applied to all outgoing payouts, accompanied by immediate SMS and WhatsApp security alerts with a 1-tap Panic Killswitch to abort the modification.",
            },
            {
              q: "Can I pay for my subscription in Nigerian Naira (₦) or USDT ($)?",
              a: "Yes! You can pay in Nigerian Naira via local debit card or Monnify direct bank transfer, or in USD / USDT via supported web3 gateways. Annual subscriptions receive 2 months completely free across all plans.",
            },
          ].map((faq, idx) => {
            const isOpen = expandedFaq === idx;
            return (
              <div key={idx} className="py-3.5 group">
                <button
                  type="button"
                  onClick={() => setExpandedFaq(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between text-left font-semibold text-gray-900 hover:text-indigo-600 transition-colors cursor-pointer gap-4"
                  aria-expanded={isOpen}
                >
                  <span className="text-xs sm:text-sm leading-snug">{faq.q}</span>
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border transition-all duration-300 ${
                      isOpen
                        ? "rotate-180 bg-indigo-50 text-indigo-600 border-indigo-200"
                        : "rotate-0 bg-gray-50 text-gray-400 border-gray-200 group-hover:bg-gray-100 group-hover:text-gray-600"
                    }`}
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </span>
                </button>
                <div
                  className={`grid transition-all duration-300 ease-in-out ${
                    isOpen ? "grid-rows-[1fr] opacity-100 mt-2.5" : "grid-rows-[0fr] opacity-0 mt-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="text-gray-600 leading-relaxed text-xs sm:text-[13px] pb-1 pr-6">
                      {faq.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upgrade Confirmation Modal */}
      {confirmModalPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-gray-900 text-sm">
                  Confirm Plan Switch: {confirmModalPlan.name}
                </h3>
              </div>
              <button
                onClick={() => setConfirmModalPlan(null)}
                className="text-gray-400 hover:text-gray-700 text-xs p-1"
              >
                ✕
              </button>
            </div>

            {/* Summary Box */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Selected Plan:</span>
                <span className="font-bold text-gray-900">{confirmModalPlan.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Core Identity:</span>
                <span className="font-semibold text-indigo-900">{confirmModalPlan.coreIdentity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Billing Cycle:</span>
                <span className="font-bold text-gray-900">
                  {billingCycle === "ANNUALLY" ? "Annually (2 Mo Free)" : "Monthly"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Platform Fee:</span>
                <span className="font-bold text-emerald-700">{confirmModalPlan.platformFeePercent}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200 text-sm font-bold">
                <span className="text-gray-900">Total Due Today:</span>
                <span className="text-gray-900">
                  {currencyMode === "USD" ? (
                    <span>
                      $
                      {(
                        (billingCycle === "ANNUALLY"
                          ? confirmModalPlan.annualUsd
                          : confirmModalPlan.monthlyUsd) * (promoApplied ? 0.8 : 1)
                      ).toFixed(0)}{" "}
                      <span className="text-xs font-normal text-gray-500">
                        (~₦
                        {(
                          (billingCycle === "ANNUALLY"
                            ? confirmModalPlan.annualNaira
                            : confirmModalPlan.monthlyNaira) * (promoApplied ? 0.8 : 1)
                        ).toLocaleString()}
                        )
                      </span>
                    </span>
                  ) : (
                    <span>
                      ₦
                      {(
                        (billingCycle === "ANNUALLY"
                          ? confirmModalPlan.annualNaira
                          : confirmModalPlan.monthlyNaira) * (promoApplied ? 0.8 : 1)
                      ).toLocaleString()}
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Promo Code Input */}
            <div className="space-y-1.5 text-xs">
              <label className="font-semibold text-gray-700 text-[11px]">Promo / Referral Code</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. LAGOSGROWTH"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono uppercase focus:outline-none focus:border-indigo-600"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (promoCode.trim().length > 3) {
                      setPromoApplied(true);
                    }
                  }}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Apply
                </button>
              </div>
              {promoApplied && (
                <div className="text-[10px] text-emerald-700 font-bold">
                  ✓ 20% promotional discount applied to first billing cycle!
                </div>
              )}
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2 text-xs">
              <label className="font-semibold text-gray-700 text-[11px]">Payment Method</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethod("CARD")}
                  className={`p-2.5 rounded-xl border text-center cursor-pointer transition-all ${
                    selectedPaymentMethod === "CARD"
                      ? "border-indigo-600 bg-indigo-50/50 text-indigo-900 font-bold"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <div className="text-[11px]">Debit Card</div>
                  <div className="text-[9px] text-gray-400">Paystack / Card</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethod("TRANSFER")}
                  className={`p-2.5 rounded-xl border text-center cursor-pointer transition-all ${
                    selectedPaymentMethod === "TRANSFER"
                      ? "border-indigo-600 bg-indigo-50/50 text-indigo-900 font-bold"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <div className="text-[11px]">Bank Transfer</div>
                  <div className="text-[9px] text-gray-400">Monnify NUBAN</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethod("USDT")}
                  className={`p-2.5 rounded-xl border text-center cursor-pointer transition-all ${
                    selectedPaymentMethod === "USDT"
                      ? "border-indigo-600 bg-indigo-50/50 text-indigo-900 font-bold"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <div className="text-[11px]">USDT / Crypto</div>
                  <div className="text-[9px] text-gray-400">TRC20 / ERC20</div>
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalPlan(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-gray-300 text-gray-700 font-semibold text-xs hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={upgradingPlan !== null}
                onClick={handleConfirmUpgrade}
                className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2"
              >
                {upgradingPlan ? (
                  <span>Processing...</span>
                ) : (
                  <span>Activate {confirmModalPlan.name.split(" ")[0]}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
