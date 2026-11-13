"use client";

import React, { useState, useEffect } from "react";
import { CheckIcon } from "../icons";

interface VerificationViewProps {
  onBack?: () => void;
  onComplete?: () => void;
  vendorName?: string;
  whatsappPhone?: string;
}

export function VerificationView({ onBack, onComplete, vendorName, whatsappPhone: initialWhatsappPhone }: VerificationViewProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Business Info
  const [businessName, setBusinessName] = useState(vendorName || "My Store");
  const [cacNumber, setCacNumber] = useState("RC-1849204");
  const [tinNumber, setTinNumber] = useState("24910293-0001");
  const [businessAddress, setBusinessAddress] = useState("Block 4, Plot 12, Admiralty Way, Lekki Phase 1, Lagos");
  const [businessCategory, setBusinessCategory] = useState("Kitchenware & Home Goods");

  // Step 2: Settlement Account
  const [bankCode, setBankCode] = useState("035"); // Wema
  const [accountNumber, setAccountNumber] = useState("7821948301");
  const [resolvingAccount, setResolvingAccount] = useState(false);
  const [resolvedAccountName, setResolvedAccountName] = useState("NIA STORES & GOODS LTD");

  // Step 3: Socials & Channels
  const [whatsappConnected, setWhatsappConnected] = useState(true);
  const [whatsappPhone, setWhatsappPhone] = useState(initialWhatsappPhone || "+2348031234567");
  const [instagramConnected, setInstagramConnected] = useState(true);
  const [instagramHandle, setInstagramHandle] = useState("@niastores.ng");

  useEffect(() => {
    if (vendorName) setBusinessName(vendorName);
  }, [vendorName]);

  useEffect(() => {
    if (initialWhatsappPhone) setWhatsappPhone(initialWhatsappPhone);
  }, [initialWhatsappPhone]);

  // Step 4: Documents & Review
  const [uploadedCac, setUploadedCac] = useState(true);
  const [uploadedId, setUploadedId] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleResolveNuban = (num: string) => {
    setAccountNumber(num);
    if (num.length === 10) {
      setResolvingAccount(true);
      setTimeout(() => {
        setResolvingAccount(false);
        setResolvedAccountName("NIA STORES & GOODS LTD (MATCHED)");
      }, 500);
    }
  };

  const handleSubmitVerification = () => {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 1200);
  };

  const steps = [
    { num: 1, title: "Business Information", desc: "CAC & Registered Entity" },
    { num: 2, title: "Bank Settlement", desc: "Monnify NUBAN Channel" },
    { num: 3, title: "Socials & Messaging", desc: "WhatsApp & Instagram" },
    { num: 4, title: "Review & Submit", desc: "Compliance Verification" },
  ];

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-black text-3xl mx-auto shadow-sm">
          ✓
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Verification Submitted!</h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Your CAC credentials and Monnify settlement NUBAN have been submitted to Caterlog Compliance.
            You will receive an automated WhatsApp confirmation within 2-4 hours.
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs max-w-md mx-auto text-left space-y-2 text-xs">
          <div className="flex justify-between py-1 border-b border-gray-100">
            <span className="text-gray-500">Business Name</span>
            <span className="font-semibold text-gray-900">{businessName}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-100">
            <span className="text-gray-500">CAC Number</span>
            <span className="font-mono font-semibold text-gray-900">{cacNumber}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-100">
            <span className="text-gray-500">Settlement NUBAN</span>
            <span className="font-mono font-semibold text-emerald-700">{accountNumber} · Wema Bank</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-gray-500">Status</span>
            <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full text-[10px]">
              Pending Approval
            </span>
          </div>
        </div>
        <div className="pt-4 flex justify-center gap-3">
          <button
            onClick={onBack || onComplete}
            className="bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-semibold text-xs py-2.5 px-6 rounded-xl shadow-2xs cursor-pointer active:scale-95 transition-all"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {onBack && (
              <button
                onClick={onBack}
                className="text-xs font-semibold text-gray-500 hover:text-gray-900 flex items-center gap-1 cursor-pointer"
              >
                ← Back
              </button>
            )}
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
              KYC & Compliance
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
            Business Verification
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Complete verification to enable automatic NUBAN escrow payouts and verified merchant status on WhatsApp.
          </p>
        </div>
      </div>

      {/* Step Indicator Progress Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        {steps.map((s) => {
          const isDone = currentStep > s.num;
          const isCurrent = currentStep === s.num;
          return (
            <div
              key={s.num}
              onClick={() => setCurrentStep(s.num as any)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                isCurrent
                  ? "bg-white border-emerald-600 shadow-2xs ring-1 ring-emerald-600"
                  : isDone
                  ? "bg-emerald-50/50 border-emerald-200 text-gray-700"
                  : "bg-white border-gray-100 text-gray-400"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isDone
                      ? "bg-emerald-600 text-white"
                      : isCurrent
                      ? "bg-emerald-600 text-white"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {isDone ? "✓" : s.num}
                </span>
                <span className="text-xs font-bold text-gray-900">{s.title}</span>
              </div>
              <div className="text-[10px] text-gray-500 pl-7 hidden sm:block truncate">{s.desc}</div>
            </div>
          );
        })}
      </div>

      {/* Step 1: Business Details */}
      {currentStep === 1 && (
        <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-2xs space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h2 className="text-base font-bold text-gray-900">Step 1: Registered Business Details</h2>
            <p className="text-xs text-gray-500 mt-0.5">Enter details as registered with the Corporate Affairs Commission (CAC).</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                Registered Business Name *
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                CAC Registration / RC Number *
              </label>
              <input
                type="text"
                value={cacNumber}
                onChange={(e) => setCacNumber(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-500 font-mono font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                Tax Identification Number (TIN)
              </label>
              <input
                type="text"
                value={tinNumber}
                onChange={(e) => setTinNumber(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-500 font-mono font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                Business Category
              </label>
              <select
                value={businessCategory}
                onChange={(e) => setBusinessCategory(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-500 font-medium"
              >
                <option value="Kitchenware & Home Goods">Kitchenware & Home Goods</option>
                <option value="Electronics & Accessories">Electronics & Accessories</option>
                <option value="Fashion & Apparel">Fashion & Apparel</option>
                <option value="Food & Provisions">Food & Provisions</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              Registered Office Address
            </label>
            <input
              type="text"
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-500 font-medium"
            />
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={() => setCurrentStep(2)}
              className="bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-semibold text-xs py-2.5 px-6 rounded-xl shadow-2xs cursor-pointer active:scale-95 transition-all"
            >
              Next: Bank Settlement →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Settlement Account */}
      {currentStep === 2 && (
        <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-2xs space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h2 className="text-base font-bold text-gray-900">Step 2: Monnify Settlement Account</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Connect the Nigerian commercial bank account where reseller commissions and sales will be settled automatically.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                Settlement Bank *
              </label>
              <select
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-500 font-medium"
              >
                <option value="035">Wema Bank</option>
                <option value="058">Guaranty Trust Bank (GTBank)</option>
                <option value="057">Zenith Bank</option>
                <option value="044">Access Bank</option>
                <option value="011">First Bank of Nigeria</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                10-Digit NUBAN Account Number *
              </label>
              <input
                type="text"
                maxLength={10}
                value={accountNumber}
                onChange={(e) => handleResolveNuban(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-500 font-mono font-bold"
              />
            </div>
          </div>

          {/* Dynamic Resolution Banner */}
          <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-bold text-emerald-800">Verified NIBSS Account Name</div>
              <div className="text-sm font-extrabold text-emerald-950 mt-0.5">
                {resolvingAccount ? "Resolving via Monnify NIBSS..." : resolvedAccountName}
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
              ✓
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setCurrentStep(1)}
              className="px-5 py-2.5 border border-gray-300 hover:border-gray-500 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl transition-all cursor-pointer active:scale-95"
            >
              ← Back
            </button>
            <button
              onClick={() => setCurrentStep(3)}
              className="bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-semibold text-xs py-2.5 px-6 rounded-xl shadow-2xs cursor-pointer active:scale-95 transition-all"
            >
              Next: Socials & Channels →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Socials & Channels (Matching Verification_ Socials Connection.png) */}
      {currentStep === 3 && (
        <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-2xs space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h2 className="text-base font-bold text-gray-900">Step 3: Socials & Messaging Connection</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Connect your official WhatsApp Business and Instagram accounts to allow Sales Co-Pilot automated coexistence.
            </p>
          </div>

          <div className="space-y-4">
            {/* WhatsApp Card */}
            <div className="border border-gray-200 rounded-2xl p-5 flex items-start justify-between gap-4 bg-gray-50/40">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xl shrink-0">
                  💬
                </div>
                <div>
                  <div className="font-bold text-sm text-gray-900">WhatsApp Business Cloud API</div>
                  <div className="text-xs text-gray-500 mt-0.5 font-mono">{whatsappPhone}</div>
                  <div className="text-[11px] text-emerald-700 font-semibold mt-1">
                    ✓ Coexistence webhook listening active
                  </div>
                </div>
              </div>
              <button
                onClick={() => setWhatsappConnected(!whatsappConnected)}
                className={`text-xs font-semibold px-3.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                  whatsappConnected
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                }`}
              >
                {whatsappConnected ? "Connected" : "Connect"}
              </button>
            </div>

            {/* Instagram Card */}
            <div className="border border-gray-200 rounded-2xl p-5 flex items-start justify-between gap-4 bg-gray-50/40">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xl shrink-0">
                  📸
                </div>
                <div>
                  <div className="font-bold text-sm text-gray-900">Instagram Graph API</div>
                  <div className="text-xs text-gray-500 mt-0.5">{instagramHandle}</div>
                  <div className="text-[11px] text-purple-700 font-semibold mt-1">
                    ✓ Meta Catalog token active (60 days)
                  </div>
                </div>
              </div>
              <button
                onClick={() => setInstagramConnected(!instagramConnected)}
                className={`text-xs font-semibold px-3.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                  instagramConnected
                    ? "bg-purple-50 text-purple-700 border-purple-300"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                }`}
              >
                {instagramConnected ? "Connected" : "Connect"}
              </button>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setCurrentStep(2)}
              className="px-5 py-2.5 border border-gray-300 hover:border-gray-500 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl transition-all cursor-pointer active:scale-95"
            >
              ← Back
            </button>
            <button
              onClick={() => setCurrentStep(4)}
              className="bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-semibold text-xs py-2.5 px-6 rounded-xl shadow-2xs cursor-pointer active:scale-95 transition-all"
            >
              Next: Review & Submit →
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review & Submit (Matching Verification_ Review & Submit.png) */}
      {currentStep === 4 && (
        <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-2xs space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h2 className="text-base font-bold text-gray-900">Step 4: Document Review & Final Submission</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Review all compliance parameters before sending to Caterlog Verification.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Entity Summary */}
            <div className="bg-gray-50 rounded-2xl p-5 space-y-3 border border-gray-100">
              <div className="text-xs font-bold text-gray-900">Business Summary</div>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">Business:</span>
                  <span className="font-semibold text-gray-900">{businessName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">CAC Number:</span>
                  <span className="font-mono font-semibold text-gray-900">{cacNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Category:</span>
                  <span className="text-gray-900">{businessCategory}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Address:</span>
                  <span className="text-gray-900 text-right truncate max-w-[180px]">{businessAddress}</span>
                </div>
              </div>
            </div>

            {/* Payout Channel Summary */}
            <div className="bg-gray-50 rounded-2xl p-5 space-y-3 border border-gray-100">
              <div className="text-xs font-bold text-gray-900">Payout & Channels</div>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">NUBAN:</span>
                  <span className="font-mono font-semibold text-emerald-800">{accountNumber} (Wema Bank)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Account Name:</span>
                  <span className="font-semibold text-gray-900">{resolvedAccountName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">WhatsApp:</span>
                  <span className="font-semibold text-emerald-700">Connected ({whatsappPhone})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Instagram:</span>
                  <span className="font-semibold text-purple-700">Connected ({instagramHandle})</span>
                </div>
              </div>
            </div>
          </div>

          {/* Document Uploads */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-gray-900">Verification Documents</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-dashed border-emerald-300 bg-emerald-50/30 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-gray-900">CAC Certificate of Incorporation</div>
                  <div className="text-[11px] text-emerald-700 mt-0.5">cac-certificate-nia-stores.pdf (1.4 MB)</div>
                </div>
                <span className="text-emerald-600 font-bold text-xs">✓ Uploaded</span>
              </div>

              <div className="border border-dashed border-emerald-300 bg-emerald-50/30 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-gray-900">Director Government ID (NIN / Passport)</div>
                  <div className="text-[11px] text-emerald-700 mt-0.5">director-national-id.pdf (890 KB)</div>
                </div>
                <span className="text-emerald-600 font-bold text-xs">✓ Uploaded</span>
              </div>
            </div>
          </div>

          {/* Compliance Agreement */}
          <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 text-xs text-amber-900 leading-relaxed flex items-start gap-2.5">
            <span className="text-base leading-none">⚖️</span>
            <div>
              By clicking <strong>Submit for Verification</strong>, you certify that all information provided is accurate and complies with Nigerian NDPR, CBN, and CAC regulations for merchant commerce settlement.
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setCurrentStep(3)}
              className="px-5 py-2.5 border border-gray-300 hover:border-gray-500 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl transition-all cursor-pointer active:scale-95"
            >
              ← Back
            </button>
            <button
              onClick={handleSubmitVerification}
              disabled={submitting}
              className="bg-[#0d5c3a] hover:bg-[#0b4b2f] disabled:opacity-75 text-white font-semibold text-xs py-2.5 px-6 rounded-xl shadow-2xs cursor-pointer active:scale-95 transition-all flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Submitting Verification...</span>
                </>
              ) : (
                <span>Submit for Verification</span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

