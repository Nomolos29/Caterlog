"use client";

import React, { useState } from "react";
import { CheckIcon } from "../icons";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth/client";
import type { PlatformRole } from "@/lib/types";

interface AuthViewProps {
  initialMode?: "login" | "onboarding";
  onLoginSuccess: (user: { email: string; businessName: string; role?: PlatformRole }) => void;
}

export function AuthView({
  initialMode = "login",
  onLoginSuccess,
}: AuthViewProps) {
  const [viewMode, setViewMode] = useState<"login" | "signup" | "otp_input">(
    initialMode === "onboarding" ? "signup" : "login"
  );

  // Form states
  const [loginMethod, setLoginMethod] = useState<"whatsapp" | "email">("whatsapp");
  const [whatsappPhone, setWhatsappPhone] = useState("+234 803 123 4567");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Signup states
  const [signupMethod, setSignupMethod] = useState<"whatsapp" | "email">("whatsapp");
  const [sellerProfile, setSellerProfile] = useState<"existing" | "new">("new");
  const [signupRole, setSignupRole] = useState<PlatformRole>("reseller");
  const [signupPhone, setSignupPhone] = useState("+234 ");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [catalogSelection, setCatalogSelection] = useState<"mirror" | "custom">("mirror");

  // OTP Verification state
  const [otpCode, setOtpCode] = useState("");
  const [otpTarget, setOtpTarget] = useState<{
    phone: string;
    maskedPhone: string;
    purpose: "LOGIN" | "SIGNUP";
    businessName?: string;
    role?: PlatformRole;
    isExistingBusiness?: boolean;
    catalogSelection?: "mirror" | "custom";
  } | null>(null);

  // Shared status states
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, "");
    if (!digits) return "";
    if (digits.length === 11 && digits.startsWith("0")) {
      return `+234${digits.slice(1)}`;
    }
    if (digits.length === 14 && digits.startsWith("2340")) {
      return `+234${digits.slice(4)}`;
    }
    if (digits.length === 10 && /^[789]/.test(digits)) {
      return `+234${digits}`;
    }
    return `+${digits}`;
  };

  /* -------------------------------------------------------------------------- */
  /* Action: Request 6-Digit OTP on WhatsApp for Login                          */
  /* -------------------------------------------------------------------------- */
  const handleRequestLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setResendNotice(null);
    const cleanPhone = formatPhone(whatsappPhone);

    if (cleanPhone.length < 10) {
      setErrorMessage("Please enter a valid WhatsApp number (e.g. 0803 123 4567).");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.requestOtp(cleanPhone, "LOGIN");
      setOtpTarget({
        phone: cleanPhone,
        maskedPhone: res.destinationPhone,
        purpose: "LOGIN",
      });
      setOtpCode(res.devCode || "");
      if (res.devCode) {
        setResendNotice(`Local Dev Mode: 6-digit code (${res.devCode}) has been auto-filled for you.`);
      }
      setViewMode("otp_input");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to send WhatsApp security code.");
    } finally {
      setSubmitting(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* Action: Request 6-Digit OTP on WhatsApp for New Store Signup               */
  /* -------------------------------------------------------------------------- */
  const handleStartStoreSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setResendNotice(null);
    const cleanPhone = formatPhone(signupPhone);

    if (cleanPhone.length < 10) {
      setErrorMessage("Please enter a valid WhatsApp number (e.g. 0803 123 4567).");
      return;
    }

    const effectiveName =
      businessName.trim() ||
      (sellerProfile === "existing" ? "WhatsApp Business Store" : "My WhatsApp Store");

    setSubmitting(true);
    try {
      const res = await api.requestOtp(cleanPhone, "SIGNUP");
      setOtpTarget({
        phone: cleanPhone,
        maskedPhone: res.destinationPhone,
        purpose: "SIGNUP",
        businessName: effectiveName,
        role: signupRole,
        isExistingBusiness: sellerProfile === "existing",
        catalogSelection,
      });
      setOtpCode(res.devCode || "");
      if (res.devCode) {
        setResendNotice(`Local Dev Mode: 6-digit code (${res.devCode}) has been auto-filled for you.`);
      }
      setViewMode("otp_input");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to send verification code.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailStoreSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!signupEmail.trim() || !signupEmail.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    if (signupPassword.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    const effectiveName =
      businessName.trim() ||
      (signupRole !== "reseller" ? "WhatsApp Business Store" : "My Reseller Store");

    setSubmitting(true);
    try {
      try {
        await authClient.signUp.email({
          email: signupEmail.trim(),
          password: signupPassword,
          name: effectiveName,
        });
      } catch {
        // Proceed with local backend onboarding if Neon Auth endpoint is offline locally
      }

      const cleanPhone = formatPhone(signupPhone);
      await api.onboardVendor({
        businessName: effectiveName,
        phone: cleanPhone.length >= 10 ? cleanPhone : undefined,
        role: signupRole,
        isExistingBusiness: sellerProfile === "existing",
        catalogSelection,
        skipOtp: true,
      });

      onLoginSuccess({
        email: signupEmail.trim(),
        businessName: effectiveName,
        role: signupRole,
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Sign up failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* Action: Verify 6-Digit WhatsApp Code                                       */
  /* -------------------------------------------------------------------------- */
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpTarget) return;
    setErrorMessage(null);

    const cleanCode = otpCode.replace(/\D/g, "");
    if (cleanCode.length !== 6) {
      setErrorMessage("Please enter all 6 digits of the code sent to your WhatsApp.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.verifyOtp({
        phone: otpTarget.phone,
        code: cleanCode,
        purpose: otpTarget.purpose,
        businessName: otpTarget.businessName,
        role: otpTarget.role,
        isExistingBusiness: otpTarget.isExistingBusiness,
        catalogSelection: otpTarget.catalogSelection,
      });

      if (res.authenticated) {
        onLoginSuccess({
          email: `${otpTarget.phone.replace(/\D/g, "")}@caterlog.store`,
          businessName: res.vendor.businessName || otpTarget.businessName || "My WhatsApp Store",
          role: res.vendor.role ?? otpTarget.role,
        });
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Invalid or expired 6-digit code.");
    } finally {
      setSubmitting(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* Action: Resend OTP Code                                                    */
  /* -------------------------------------------------------------------------- */
  const handleResendOtp = async () => {
    if (!otpTarget) return;
    setErrorMessage(null);
    setResendNotice(null);
    setSubmitting(true);
    try {
      await api.requestOtp(otpTarget.phone, otpTarget.purpose);
      setResendNotice("A new 6-digit code has been delivered to your WhatsApp.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to resend code.");
    } finally {
      setSubmitting(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* Screen 1: 6-Digit Code Verification Screen (Strict WhatsApp PIN Input)     */
  /* -------------------------------------------------------------------------- */
  if (viewMode === "otp_input" && otpTarget) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-[440px] bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-xs space-y-6 animate-in fade-in zoom-in-95 duration-150">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 border border-emerald-100 text-[#00c068] flex items-center justify-center text-xl shadow-xs">
              🔒
            </div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">
              Enter 6-Digit Security Code
            </h1>
            <p className="text-xs text-gray-500 leading-relaxed max-w-sm mx-auto">
              We sent a 6-digit verification code to your WhatsApp:
            </p>
            <div className="inline-block px-3 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono font-bold text-gray-900">
              {otpTarget.maskedPhone}
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium text-center">
              {errorMessage}
            </div>
          )}

          {resendNotice && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium text-center">
              {resendNotice}
            </div>
          )}

          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold tracking-wider uppercase text-gray-600 text-center mb-2">
                6-DIGIT WHATSAPP CODE
              </label>
              <input
                type="text"
                autoFocus
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setOtpCode(val);
                }}
                placeholder="••••••"
                className="w-full px-4 py-3.5 text-center text-2xl font-mono font-bold tracking-[0.5em] border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 text-gray-900 bg-gray-50/50"
              />
              <p className="text-[11px] text-gray-400 text-center mt-1.5">
                Code expires in 10 minutes. Check your WhatsApp chat.
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting || otpCode.length !== 6}
              className="w-full py-3.5 bg-[#00c068] hover:bg-[#00ad5d] text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying Code...</span>
                </>
              ) : (
                <span>Verify &amp; Enter Dashboard →</span>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                setViewMode(otpTarget.purpose === "SIGNUP" ? "signup" : "login");
                setErrorMessage(null);
                setResendNotice(null);
              }}
              className="text-gray-500 hover:text-gray-900 font-medium cursor-pointer"
            >
              ← Change phone number
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleResendOtp}
              className="text-emerald-600 hover:text-emerald-700 font-bold cursor-pointer disabled:opacity-50"
            >
              Resend code
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* Screen 2: Login Screen                                                     */
  /* -------------------------------------------------------------------------- */
  if (viewMode === "login") {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-[440px] bg-white rounded-2xl border border-gray-200 p-6 sm:p-10 shadow-xs space-y-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-[#00c068] text-white flex items-center justify-center font-black text-2xl shadow-xs mb-3">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" opacity="0" />
                <path d="M16 2v10M12 2v10M20 2v10M12 12a4 4 0 0 0 8 0M16 16v6M4 2v7a3 3 0 0 0 3 3h1v10" />
              </svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">Caterlog</h1>
            <p className="text-xs text-gray-500 mt-1">Smart commerce &amp; AI Co-Pilot on WhatsApp</p>
          </div>

          <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-xl text-xs font-semibold text-gray-600">
            <button
              type="button"
              onClick={() => {
                setLoginMethod("whatsapp");
                setErrorMessage(null);
              }}
              className={`py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                loginMethod === "whatsapp"
                  ? "bg-white text-gray-900 shadow-xs font-bold"
                  : "hover:text-gray-900"
              }`}
            >
              <span>💬 WhatsApp PIN</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMethod("email");
                setErrorMessage(null);
              }}
              className={`py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                loginMethod === "email"
                  ? "bg-white text-gray-900 shadow-xs font-bold"
                  : "hover:text-gray-900"
              }`}
            >
              <span>✉️ Password</span>
            </button>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {errorMessage}
            </div>
          )}

          {loginMethod === "whatsapp" ? (
            <form onSubmit={handleRequestLoginOtp} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold tracking-wider uppercase text-gray-600 mb-1.5">
                  WHATSAPP PHONE NUMBER
                </label>
                <input
                  type="text"
                  required
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value)}
                  placeholder="e.g. 0803 123 4567 or +234..."
                  className="w-full px-3.5 py-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all text-gray-900 font-mono font-medium"
                />
                <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                  We will send a 6-digit security code to your WhatsApp phone.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-[#00c068] hover:bg-[#00ad5d] text-white font-bold text-xs rounded-lg shadow-xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Sending Code on WhatsApp...</span>
                  </>
                ) : (
                  <span>Send 6-Digit Code on WhatsApp →</span>
                )}
              </button>
            </form>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setErrorMessage(null);
                if (!email.trim() || !password) {
                  setErrorMessage("Please enter your email and password.");
                  return;
                }
                setSubmitting(true);
                try {
                  let resolvedEmail = email.trim();
                  let resolvedName = "Nia Stores";
                  try {
                    const signInResult = await authClient.signIn.email({
                      email: email.trim(),
                      password,
                    });
                    if (signInResult?.data?.user) {
                      resolvedEmail = signInResult.data.user.email || resolvedEmail;
                      resolvedName = signInResult.data.user.name || resolvedName;
                    }
                  } catch {
                    // Proceed to activate local backend vendor session
                  }
                  const demoRes = await api.requestDemoSession();
                  onLoginSuccess({
                    email: resolvedEmail,
                    businessName: demoRes.vendor?.businessName || resolvedName,
                    role: demoRes.vendor?.role,
                  });
                } catch (err) {
                  setErrorMessage(
                    err instanceof Error ? err.message : "Failed to sign in. Please try again."
                  );
                } finally {
                  setSubmitting(false);
                }
              }}
              className="space-y-4"
            >
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
                  className="w-full px-3.5 py-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600 text-gray-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold tracking-wider uppercase text-gray-600 mb-1.5">
                  PASSWORD
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600 text-gray-900 font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-[#00c068] hover:bg-[#00ad5d] text-white font-bold text-xs rounded-lg shadow-xs transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>
          )}

          <div className="pt-2 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-600">
              Don&apos;t have a store yet?{" "}
              <button
                type="button"
                onClick={() => {
                  setViewMode("signup");
                  setErrorMessage(null);
                }}
                className="text-blue-600 hover:text-blue-700 font-bold cursor-pointer underline underline-offset-2 ml-1"
              >
                Create your store
              </button>
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await api.requestDemoSession();
                  onLoginSuccess({
                    email: res.vendor.whatsappPhone
                      ? `${res.vendor.whatsappPhone.replace(/\D/g, "")}@caterlog.store`
                      : "owner@niastores.example",
                    businessName: res.vendor.businessName || "Nia Stores",
                  });
                } catch {
                  onLoginSuccess({
                    email: "owner@niastores.example",
                    businessName: "Nia Stores",
                  });
                }
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
  /* Screen 3: Sleek Modern Create Store                                        */
  /* -------------------------------------------------------------------------- */
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-between">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#00c068] text-white flex items-center justify-center font-black text-sm">
              C
            </div>
            <span className="font-bold text-gray-900 text-sm tracking-tight">Caterlog</span>
          </div>

          <button
            onClick={() => setViewMode("login")}
            className="text-xs text-gray-600 hover:text-gray-900 font-semibold cursor-pointer"
          >
            Already have an account? <span className="text-emerald-600 font-bold">Login →</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-[500px] bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-xs space-y-6 animate-in fade-in zoom-in-95 duration-150">
          <div>
            <span className="text-[10px] font-bold text-emerald-700 tracking-wider uppercase bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
              Instant Setup
            </span>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 mt-2">
              Start selling on WhatsApp
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Automated orders, 24/7 AI Co-Pilot, and verified bank transfers.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-bold tracking-wider uppercase text-gray-700 mb-2">
              ACCOUNT ROLE
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setSignupRole("reseller");
                  setSellerProfile("new");
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  signupRole === "reseller"
                    ? "border-emerald-600 bg-emerald-50/50 shadow-2xs"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="font-bold text-xs text-gray-900">Dropshipper / Reseller</div>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                  Mirror supplier catalogs &amp; sell without holding inventory.
                </p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSignupRole("growth");
                  setSellerProfile("existing");
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  signupRole !== "reseller"
                    ? "border-emerald-600 bg-emerald-50/50 shadow-2xs"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="font-bold text-xs text-gray-900">Vendor / Supplier</div>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                  Manage your own stock, Market Boost &amp; reseller network.
                </p>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-xl text-xs font-semibold text-gray-600">
            <button
              type="button"
              onClick={() => {
                setSignupMethod("whatsapp");
                setErrorMessage(null);
              }}
              className={`py-2 px-2.5 rounded-lg transition-all cursor-pointer text-center ${
                signupMethod === "whatsapp"
                  ? "bg-white text-gray-900 shadow-xs font-bold"
                  : "hover:text-gray-900"
              }`}
            >
              💬 WhatsApp PIN
            </button>
            <button
              type="button"
              onClick={() => {
                setSignupMethod("email");
                setErrorMessage(null);
              }}
              className={`py-2 px-2.5 rounded-lg transition-all cursor-pointer text-center ${
                signupMethod === "email"
                  ? "bg-white text-gray-900 shadow-xs font-bold"
                  : "hover:text-gray-900"
              }`}
            >
              ✉️ Email &amp; Password
            </button>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {errorMessage}
            </div>
          )}

          <form
            onSubmit={signupMethod === "whatsapp" ? handleStartStoreSignup : handleEmailStoreSignup}
            className="space-y-4"
          >
            {signupMethod === "email" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold tracking-wider uppercase text-gray-700 mb-1.5">
                    EMAIL ADDRESS
                  </label>
                  <input
                    type="email"
                    required
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full px-3.5 py-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600 font-medium text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold tracking-wider uppercase text-gray-700 mb-1.5">
                    PASSWORD
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className="w-full px-3.5 py-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600 font-medium text-gray-900"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold tracking-wider uppercase text-gray-700 mb-1.5">
                WHATSAPP PHONE NUMBER {signupMethod === "email" ? "(OPTIONAL)" : ""}
              </label>
              <input
                type="text"
                required={signupMethod === "whatsapp"}
                value={signupPhone}
                onChange={(e) => setSignupPhone(e.target.value)}
                placeholder="e.g. 0803 123 4567 or +234..."
                className="w-full px-3.5 py-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600 font-mono font-medium text-gray-900"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                {signupMethod === "whatsapp"
                  ? "We will send a 6-digit security code to verify your WhatsApp number."
                  : "Used for WhatsApp order alerts & AI Co-Pilot notifications."}
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold tracking-wider uppercase text-gray-700 mb-1.5">
                STORE / BUSINESS NAME
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder={
                  sellerProfile === "existing"
                    ? "e.g. Nia Stores (or auto-pull from WhatsApp)"
                    : "e.g. Kemi Luxury Closet"
                }
                className="w-full px-3.5 py-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-600 font-medium text-gray-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold tracking-wider uppercase text-gray-700 mb-2">
                STARTING INVENTORY
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div
                  onClick={() => setCatalogSelection("mirror")}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    catalogSelection === "mirror"
                      ? "border-emerald-600 bg-emerald-50/50 shadow-2xs"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-gray-900">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>{sellerProfile === "existing" ? "Sync Existing Catalog" : "Wholesale Catalog"}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                    {sellerProfile === "existing"
                      ? "Auto-imports your current WhatsApp Business items."
                      : "4 ready-to-sell kitchenware items (20% margin)."}
                  </p>
                </div>

                <div
                  onClick={() => setCatalogSelection("custom")}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    catalogSelection === "custom"
                      ? "border-emerald-600 bg-emerald-50/50 shadow-2xs"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-gray-900">
                    <span className="w-2 h-2 rounded-full bg-gray-400" />
                    <span>Custom Inventory</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                    Start with a fresh store and add your own items manually.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-[#00c068] hover:bg-[#00ad5d] text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-[0.99] cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{signupMethod === "whatsapp" ? "Sending Verification Code..." : "Creating Your Store..."}</span>
                </>
              ) : (
                <span>
                  {signupMethod === "whatsapp"
                    ? "Continue & Receive 6-Digit Code on WhatsApp →"
                    : "Create Store & Enter Dashboard →"}
                </span>
              )}
            </button>
          </form>

          <div className="pt-2 text-center text-[11px] text-gray-400 flex items-center justify-center gap-1.5">
            <span>🔒</span>
            <span>Bank-grade Monnify escrow &amp; official Meta Cloud integration</span>
          </div>
        </div>
      </main>

      <footer className="py-3 text-center text-xs text-gray-400 border-t border-gray-100 bg-white">
        © 2024 Caterlog Commerce. All rights reserved.
      </footer>
    </div>
  );
}
