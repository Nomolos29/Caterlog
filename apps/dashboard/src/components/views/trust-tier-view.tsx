"use client";

import React, { useState } from "react";
import type { VendorProfile, TrustTierInfo } from "@/lib/types";
import { ShieldCheckIcon, SparklesIcon, CheckIcon } from "../icons";

interface TrustTierViewProps {
  vendor: VendorProfile;
  trustTier?: TrustTierInfo;
  onFastTrack?: (cacNumber?: string) => Promise<boolean>;
  onNavigateToKyc?: () => void;
}

export function TrustTierView({
  vendor,
  trustTier,
  onFastTrack,
  onNavigateToKyc,
}: TrustTierViewProps) {
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

  const [cacNumberInput, setCacNumberInput] = useState(vendor.cacNumber || "RC-1849202");
  const [fastTracking, setFastTracking] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleFastTrackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onFastTrack) {
      if (onNavigateToKyc) onNavigateToKyc();
      return;
    }
    setFastTracking(true);
    try {
      const ok = await onFastTrack(cacNumberInput.trim());
      if (ok) {
        setToastMessage("Fast-Track approved! Account upgraded to Level 2: Instant 0-Second Settlement.");
        setTimeout(() => setToastMessage(null), 4000);
      }
    } finally {
      setFastTracking(false);
    }
  };

  const progressPercent = Math.min(
    100,
    Math.round((currentTier.completedCleanOrders / currentTier.requiredOrdersForNextTier) * 100)
  );

  return (
    <div className="space-y-6 text-gray-900 max-w-5xl">
      {/* Toast */}
      {toastMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center gap-2 shadow-xs animate-in fade-in duration-200">
          <span>✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0 shadow-xs">
            <ShieldCheckIcon className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-gray-900">Dynamic Trust-Tiered Settlement</h2>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                {currentTier.tierName}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl leading-relaxed">
              We never freeze merchant restock capital indefinitely. Payout release speed automatically accelerates
              from Delivery-triggered to Dispatch-triggered, and finally to 0-Second Instant Bank Settlements as you
              build a clean fulfillment record.
            </p>
          </div>
        </div>

        <div className="text-left md:text-right shrink-0 bg-gray-50 p-3.5 rounded-xl border border-gray-100">
          <div className="text-[11px] text-gray-500 font-medium">Daily Settlement Limit</div>
          <div className="text-lg font-extrabold text-gray-900">
            ₦{currentTier.dailyPayoutLimitNaira.toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
            {currentTier.settlementSpeed}
          </div>
        </div>
      </div>

      {/* 3 Tier Stages Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Level 0 */}
        <div
          className={`rounded-2xl p-5 border transition-all flex flex-col justify-between ${
            currentTier.currentTier === 0
              ? "bg-white border-2 border-emerald-600 shadow-sm ring-4 ring-emerald-500/10"
              : "bg-gray-50/70 border-gray-200 opacity-80"
          }`}
        >
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-900">Level 0: Starter Escrow</span>
              {currentTier.currentTier === 0 ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Current
                </span>
              ) : (
                <span className="text-[10px] font-bold text-emerald-600">✓ Completed</span>
              )}
            </div>
            <div className="mt-3 text-xs font-bold text-gray-800">Delivery-Triggered Release</div>
            <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
              Funds unlock automatically the exact second Shipbubble or Kwik webhook scans <code>DELIVERED</code> + a
              2-4 hour inspection window. Never waiting days for lazy buyers to click confirm.
            </p>
          </div>

          <div className="pt-4 mt-4 border-t border-gray-100 space-y-1 text-[11px] text-gray-600">
            <div className="flex justify-between">
              <span>Qualification:</span>
              <span className="font-semibold text-gray-800">Basic Onboarding</span>
            </div>
            <div className="flex justify-between">
              <span>Daily Limit:</span>
              <span className="font-semibold text-gray-800">₦100,000 / day</span>
            </div>
          </div>
        </div>

        {/* Level 1 */}
        <div
          className={`rounded-2xl p-5 border transition-all flex flex-col justify-between ${
            currentTier.currentTier === 1
              ? "bg-white border-2 border-emerald-600 shadow-sm ring-4 ring-emerald-500/10"
              : currentTier.currentTier > 1
              ? "bg-gray-50/70 border-gray-200 opacity-80"
              : "bg-white border-gray-200"
          }`}
        >
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-900">Level 1: Dispatch Payouts</span>
              {currentTier.currentTier === 1 ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Current
                </span>
              ) : currentTier.currentTier > 1 ? (
                <span className="text-[10px] font-bold text-emerald-600">✓ Completed</span>
              ) : (
                <span className="text-[10px] font-bold text-indigo-700">Next Target</span>
              )}
            </div>
            <div className="mt-3 text-xs font-bold text-gray-800">50% at Pickup, 50% at Delivery</div>
            <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
              50% of your earnings release the instant the courier scans <code>PICKED_UP</code> from your store so you
              have immediate cash to restock inventory while goods are in transit.
            </p>
          </div>

          <div className="pt-4 mt-4 border-t border-gray-100 space-y-1 text-[11px] text-gray-600">
            <div className="flex justify-between">
              <span>Qualification:</span>
              <span className="font-semibold text-gray-800">BVN + 5 Clean Orders</span>
            </div>
            <div className="flex justify-between">
              <span>Daily Limit:</span>
              <span className="font-semibold text-gray-800">₦2,000,000 / day</span>
            </div>
          </div>
        </div>

        {/* Level 2 */}
        <div
          className={`rounded-2xl p-5 border transition-all flex flex-col justify-between ${
            currentTier.currentTier === 2
              ? "bg-white border-2 border-emerald-600 shadow-sm ring-4 ring-emerald-500/10"
              : "bg-white border-gray-200"
          }`}
        >
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-900">Level 2: Instant Settlement</span>
              {currentTier.currentTier === 2 ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Current
                </span>
              ) : (
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                  Fast-Track Available
                </span>
              )}
            </div>
            <div className="mt-3 text-xs font-bold text-gray-800">0-Second Monnify Auto-Split</div>
            <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
              Zero escrow waiting period. Monnify sub-account split routes funds straight to your commercial bank
              account at checkout with an automated 5% rolling reserve dispute buffer.
            </p>
          </div>

          <div className="pt-4 mt-4 border-t border-gray-100 space-y-1 text-[11px] text-gray-600">
            <div className="flex justify-between">
              <span>Qualification:</span>
              <span className="font-semibold text-gray-800">20 Clean Orders or CAC</span>
            </div>
            <div className="flex justify-between">
              <span>Daily Limit:</span>
              <span className="font-semibold text-gray-800">₦50,000,000+ / day</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress & Live Checklist */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-5">
        <div>
          <h3 className="text-base font-bold text-gray-900">Settlement Tier Graduation Progress</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Your live track record based on verified customer orders and identity credentials.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-gray-700">
              Clean Orders Completed: {currentTier.completedCleanOrders} / {currentTier.requiredOrdersForNextTier}
            </span>
            <span className="text-emerald-700 font-bold">{progressPercent}% to Level 2</span>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden p-0.5 border border-gray-200">
            <div
              className="h-full bg-emerald-600 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs shrink-0 mt-0.5">
              ✓
            </div>
            <div>
              <div className="text-xs font-bold text-gray-900">Identity Match (BVN/NIN)</div>
              <div className="text-[11px] text-emerald-700 font-medium mt-0.5">Verified & Locked</div>
            </div>
          </div>

          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs shrink-0 mt-0.5">
              ✓
            </div>
            <div>
              <div className="text-xs font-bold text-gray-900">Dispute Rate: 0.0%</div>
              <div className="text-[11px] text-gray-500 mt-0.5">Must remain below 2.0%</div>
            </div>
          </div>

          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-2.5">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5 ${
                currentTier.isCacVerified
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-indigo-100 text-indigo-800"
              }`}
            >
              {currentTier.isCacVerified ? "✓" : "⚡"}
            </div>
            <div>
              <div className="text-xs font-bold text-gray-900">Fast-Track CAC Status</div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                {currentTier.isCacVerified ? "Verified CAC registered" : "Submit CAC to skip waiting"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fast-Track Card for Wholesalers & Registered Businesses */}
      {currentTier.currentTier < 2 && (
        <div className="bg-linear-to-r from-indigo-50/70 via-white to-purple-50/70 rounded-2xl border border-indigo-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <SparklesIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Are you an established Wholesaler or CAC-Registered Business?
              </h3>
              <p className="text-xs text-gray-600 mt-0.5">
                Skip waiting for 20 orders. Wholesalers doing high volume can fast-track immediately to Level 2 (Day-1
                0-Second Split Payouts) via CAC certificate verification.
              </p>
            </div>
          </div>

          <form onSubmit={handleFastTrackSubmit} className="pt-2 flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              required
              value={cacNumberInput}
              onChange={(e) => setCacNumberInput(e.target.value)}
              placeholder="e.g. RC-1849202 or BN-3948102"
              className="flex-1 px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-mono uppercase focus:outline-none focus:border-indigo-600 shadow-2xs"
            />
            <button
              type="submit"
              disabled={fastTracking}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2 shrink-0"
            >
              {fastTracking ? (
                <span>Verifying with CAC...</span>
              ) : (
                <>
                  <span>Fast-Track to Level 2</span>
                  <span>→</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onNavigateToKyc}
              className="px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer shrink-0"
            >
              Upload CAC in KYC Tab
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
