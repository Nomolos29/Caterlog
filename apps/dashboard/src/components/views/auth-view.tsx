"use client";

import React, { useState } from "react";
import { CaterlogIcon, CheckIcon } from "../icons";

interface AuthViewProps {
  initialMode?: "login" | "onboarding";
  onLoginSuccess: (user: { email: string; businessName: string }) => void;
}

export function AuthView({
  initialMode = "login",
  onLoginSuccess,
}: AuthViewProps) {
  const [mode, setMode] = useState<"login" | "onboarding">(initialMode);

  // Login form state
  const [email, setEmail] = useState("owner@niastores.example");
  const [password, setPassword] = useState("••••••••");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // Onboarding steps: 1 = Connect WhatsApp, 2 = Business Details, 3 = Catalog & Co-Pilot
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [phoneNumberId, setPhoneNumberId] = useState("104592837482");
  const [businessName, setBusinessName] = useState("Nia Stores");
  const [businessPhone, setBusinessPhone] = useState("+234 800 000 0142");
  const [cacNumber, setCacNumber] = useState("RC-1928374");
  const [catalogSelection, setCatalogSelection] = useState<"mirror" | "custom">("mirror");
  const [copilotSetting, setCopilotSetting] = useState<"smart" | "full_auto">("smart");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setLoginError("Please enter your email and password.");
      return;
    }
    setLoggingIn(true);
    setTimeout(() => {
      setLoggingIn(false);
      onLoginSuccess({
        email: email.trim(),
        businessName: email.includes("nia") ? "Nia Stores" : "My WhatsApp Store",
      });
    }, 600);
  };

  const handleCompleteOnboarding = () => {
    setLoggingIn(true);
    setTimeout(() => {
      setLoggingIn(false);
      onLoginSuccess({
        email: `${businessName.toLowerCase().replace(/\s+/g, "")}@example.com`,
        businessName: businessName.trim() || "My WhatsApp Store",
      });
    }, 700);
  };

  /* -------------------------------------------------------------------------- */
  /* Screen: Login (Matches Figma 'Caterlog Auth & Setup.png')                   */
  /* -------------------------------------------------------------------------- */
  if (mode === "login") {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-[440px] bg-white rounded-2xl border border-gray-200 p-6 sm:p-10 shadow-xs space-y-6">
          {/* Logo badge */}
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-[#00c068] text-white flex items-center justify-center font-black text-2xl shadow-xs mb-3">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" opacity="0" />
                <path d="M16 2v10M12 2v10M20 2v10M12 12a4 4 0 0 0 8 0M16 16v6M4 2v7a3 3 0 0 0 3 3h1v10" />
              </svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">Caterlog</h1>
            <p className="text-xs text-gray-500 mt-1">Manage your business on WhatsApp</p>
          </div>

          {loginError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold tracking-wider uppercase text-gray-600 mb-1.5">
                EMAIL
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-3.5 py-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all text-gray-900 font-medium"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[11px] font-bold tracking-wider uppercase text-gray-600">
                  PASSWORD
                </label>
                <button
                  type="button"
                  onClick={() => alert("Password reset instructions sent to your merchant email.")}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  Forgot?
                </button>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all text-gray-900 font-medium"
              />
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-3 bg-[#00c068] hover:bg-[#00ad5d] text-white font-bold text-xs rounded-lg shadow-xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loggingIn ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Login</span>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-600">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("onboarding")}
                className="text-blue-600 hover:text-blue-700 font-bold cursor-pointer underline underline-offset-2 ml-1"
              >
                Create an account
              </button>
            </p>
          </div>

          {/* Quick Demo Preload */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                setEmail("owner@niastores.example");
                setPassword("password123");
                onLoginSuccess({
                  email: "owner@niastores.example",
                  businessName: "Nia Stores",
                });
              }}
              className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-semibold rounded-lg border border-emerald-200 transition-colors cursor-pointer"
            >
              Demo: Sign In as Nia Stores (CAC Verified) →
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* Screen: 3-Step Vendor Onboarding (Matches 'Vendor Onboarding.png')          */
  /* -------------------------------------------------------------------------- */
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#00c068] text-white flex items-center justify-center font-black text-sm">
              C
            </div>
            <span className="font-bold text-gray-900 text-sm tracking-tight">Caterlog</span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="font-bold tracking-wider uppercase text-gray-500 text-[11px]">
              STEP {step} OF 3
            </span>
            <button
              onClick={() => setMode("login")}
              className="text-gray-600 hover:text-gray-900 font-semibold cursor-pointer"
            >
              Save &amp; Exit
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-100 h-1">
          <div
            className="bg-[#00c068] h-1 transition-all duration-300"
            style={{ width: step === 1 ? "33.3%" : step === 2 ? "66.6%" : "100%" }}
          />
        </div>
      </header>

      {/* Main Form Center Card */}
      <main className="flex-1 flex items-center justify-center p-4 py-10">
        <div className="w-full max-w-[520px] bg-white rounded-2xl border border-gray-200 p-8 sm:p-10 shadow-xs space-y-6 animate-in fade-in zoom-in-95 duration-150">
          {/* Step 1: Connect WhatsApp */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>

              <div>
                <h2 className="text-xl font-bold tracking-tight text-gray-900">Connect WhatsApp</h2>
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                  Sync your business WhatsApp account to start receiving orders directly from customers.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Phone Number ID
                </label>
                <input
                  type="text"
                  required
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                  placeholder="e.g. 104592837482"
                  className="w-full px-3.5 py-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600 text-gray-900 font-mono font-medium"
                />
                <p className="text-[11px] text-gray-400 mt-1.5">
                  Find this in your Facebook Developer Dashboard under WhatsApp Settings.
                </p>
              </div>

              <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-900 flex items-start gap-2.5 leading-relaxed">
                <span className="text-blue-600 font-bold">ℹ</span>
                <span>
                  We use this ID to securely bridge your Caterlog catalog with your WhatsApp Business API.
                </span>
              </div>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full py-3 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-bold text-xs rounded-lg shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Continue</span>
                <span>→</span>
              </button>
            </div>
          )}

          {/* Step 2: Business Profile & KYC */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 21h18M3 7v1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7H3l2-4h14l2 4M5 21V10.85M19 21V10.85M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4" />
                </svg>
              </div>

              <div>
                <h2 className="text-xl font-bold tracking-tight text-gray-900">Business Details</h2>
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                  Enter your store name and CAC registration for automated bank payouts &amp; verification.
                </p>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Store / Business Name
                  </label>
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Nia Stores"
                    className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    WhatsApp Customer Contact
                  </label>
                  <input
                    type="text"
                    required
                    value={businessPhone}
                    onChange={(e) => setBusinessPhone(e.target.value)}
                    placeholder="+234 800 000 0000"
                    className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    CAC RC Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={cacNumber}
                    onChange={(e) => setCacNumber(e.target.value)}
                    placeholder="e.g. RC-1928374"
                    className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600 font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-lg cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex-1 py-2.5 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-bold text-xs rounded-lg shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Continue</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Catalog Sync & Sales Co-Pilot */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />
                </svg>
              </div>

              <div>
                <h2 className="text-xl font-bold tracking-tight text-gray-900">Catalog &amp; Co-Pilot</h2>
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                  Start with pre-verified supplier catalog products and configure your 24/7 AI selling assistant.
                </p>
              </div>

              <div className="space-y-3">
                <label
                  onClick={() => setCatalogSelection("mirror")}
                  className={`p-3.5 border rounded-xl flex items-start gap-3 cursor-pointer transition-colors ${
                    catalogSelection === "mirror"
                      ? "border-emerald-600 bg-emerald-50/40"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="catalog"
                    checked={catalogSelection === "mirror"}
                    onChange={() => setCatalogSelection("mirror")}
                    className="mt-0.5 text-emerald-600"
                  />
                  <div>
                    <div className="text-xs font-bold text-gray-900">Mirror Verified Supplier Catalog (Recommended)</div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Instantly sync 4 popular kitchenware products from Aroko Wholesale with 20% margin.
                    </p>
                  </div>
                </label>

                <label
                  onClick={() => setCatalogSelection("custom")}
                  className={`p-3.5 border rounded-xl flex items-start gap-3 cursor-pointer transition-colors ${
                    catalogSelection === "custom"
                      ? "border-emerald-600 bg-emerald-50/40"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="catalog"
                    checked={catalogSelection === "custom"}
                    onChange={() => setCatalogSelection("custom")}
                    className="mt-0.5 text-emerald-600"
                  />
                  <div>
                    <div className="text-xs font-bold text-gray-900">Start with Custom Inventory</div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Upload your own product items, custom photos, and delivery zones manually.
                    </p>
                  </div>
                </label>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl text-xs space-y-1 text-gray-600">
                <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                  <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Meta WhatsApp Cloud Catalog Sync Enabled</span>
                </div>
                <p className="text-[11px] text-gray-500">
                  Products are automatically mapped to Meta&apos;s product format for WhatsApp shopping.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-lg cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={loggingIn}
                  onClick={handleCompleteOnboarding}
                  className="flex-1 py-2.5 bg-[#00c068] hover:bg-[#00ad5d] text-white font-bold text-xs rounded-lg shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {loggingIn ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Creating Store...</span>
                    </>
                  ) : (
                    <span>Complete Setup &amp; Enter Dashboard →</span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Security footnote */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-center gap-1.5 text-[11px] text-gray-400">
            <span>🔒</span>
            <span>Secure bank-level encryption for all business data</span>
          </div>
        </div>
      </main>

      {/* Footer copyright */}
      <footer className="py-4 text-center text-xs text-gray-400 border-t border-gray-100 bg-white">
        © 2024 Caterlog Business. All rights reserved.
      </footer>
    </div>
  );
}

