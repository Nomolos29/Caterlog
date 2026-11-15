"use client";

import React, { useState, useEffect } from "react";
import type { VendorProfile, KycSubmissionItem } from "@/lib/types";
import { VerificationView } from "./verification-view";

export type ProfileTabId = "profile" | "verification";

interface ProfileViewProps {
  vendor: VendorProfile;
  kycSubmissions?: KycSubmissionItem[];
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
}

export function ProfileView({
  vendor,
  kycSubmissions = [],
  initialTab = "profile",
  onUpdateProfile,
  onSubmitKyc,
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

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-h-[52px]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            {activeTab === "profile" ? "Merchant Profile" : "Business Verification (KYC)"}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {activeTab === "profile"
              ? "Manage your storefront identity, WhatsApp business line, social handle, and dispatch location."
              : "Complete CAC, TIN, and settlement bank verification for instant Monnify split payouts."}
          </p>
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
          Profile
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
      </div>

      {activeTab === "profile" ? (
        <div className="space-y-4">
          {savedToast && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
              <span>✓</span>
              <span>{savedToast}</span>
            </div>
          )}

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
      ) : (
        <VerificationView
          vendor={vendor}
          vendorName={vendor.businessName}
          whatsappPhone={vendor.whatsappPhone}
          kycSubmissions={kycSubmissions}
          onSubmitKyc={onSubmitKyc}
          onComplete={() => setActiveTab("profile")}
        />
      )}
    </div>
  );
}
