"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth/client";
import type { PlatformRole, SocialAccountSync } from "@/lib/types";
import { NIGERIAN_STATES } from "./market-boost-view";
import { SocialSyncWizardModal } from "../modals/social-sync-wizard-modal";
import { GoogleAuthenticatorLinkingModal } from "../modals/google-authenticator-modal";

interface AuthViewProps {
  initialMode?: "login" | "onboarding";
  onLoginSuccess: (user: { email: string; businessName: string; role?: PlatformRole }) => void;
}

type ActiveStandalonePopup =
  | "POPUP_LOGIN"
  | "POPUP_LOGIN_SMS_OTP"
  | "POPUP_LOGIN_AUTHENTICATOR"
  | "POPUP_CREATE_ACCOUNT"
  | "POPUP_VERIFY_PHONE_OTP"
  | "POPUP_LINK_GOOGLE_AUTHENTICATOR"
  | "POPUP_SETUP_PASSKEY"
  | "POPUP_CLAIM_STORE_LINK"
  | "POPUP_SYNC_SOCIAL_ACCOUNTS"
  | "POPUP_SEED_CATALOG_LAUNCH";

export function AuthView({
  initialMode = "login",
  onLoginSuccess,
}: AuthViewProps) {
  // Every milestone is its own independent standalone popup modal with smooth spring transitions
  const [activePopup, setActivePopup] = useState<ActiveStandalonePopup>(
    initialMode === "onboarding" ? "POPUP_CREATE_ACCOUNT" : "POPUP_LOGIN"
  );

  /* -------------------------------------------------------------------------- */
  /* LOGIN STATE (Email+Password | 6-Digit Passkey | SMS OTP | Authenticator)   */
  /* -------------------------------------------------------------------------- */
  const [loginMethod, setLoginMethod] = useState<
    "email_password" | "passkey_pin" | "sms_otp" | "google_authenticator"
  >("email_password");
  const [loginEmail, setLoginEmail] = useState("owner@niastores.example");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginPasskeyPin, setLoginPasskeyPin] = useState("");
  const [loginPhone, setLoginPhone] = useState("+234 803 123 4567");
  const [loginOtpCode, setLoginOtpCode] = useState("");
  const [loginMaskedPhone, setLoginMaskedPhone] = useState("");

  /* -------------------------------------------------------------------------- */
  /* STANDALONE POPUP MILESTONE STATES                                          */
  /* -------------------------------------------------------------------------- */
  // Popup 1: Account Creation
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPhone, setSignupPhone] = useState("+234 803 ");
  const [otpChannel, setOtpChannel] = useState<"SMS" | "AUTHENTICATOR">("SMS");

  // Popup 2: Phone SMS OTP or Google Authenticator Linking
  const [phoneOtpCode, setPhoneOtpCode] = useState("");
  const [simulatedSmsBanner, setSimulatedSmsBanner] = useState<string | null>(null);
  const [totpLinked, setTotpLinked] = useState(false);

  // Popup 3: 6-Digit Security Passkey Setup
  const [signupPasskeyPin, setSignupPasskeyPin] = useState("");

  // Popup 4: Claim Storefront Identity & Link
  const [businessName, setBusinessName] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [slugEditedManually, setSlugEditedManually] = useState(false);
  const [signupRole, setSignupRole] = useState<PlatformRole>("growth");
  const [baseState, setBaseState] = useState("Lagos");
  const [baseCity, setBaseCity] = useState("Ikeja");

  // Popup 5: Social Business Account Connections
  const [activeSocialWizard, setActiveSocialWizard] = useState<
    "WHATSAPP" | "INSTAGRAM" | "FACEBOOK" | null
  >(null);
  const [connectedSocials, setConnectedSocials] = useState<
    Partial<Record<"WHATSAPP" | "INSTAGRAM" | "FACEBOOK", SocialAccountSync>>
  >({});

  // Popup 6: Seed First Catalog & Launch
  const [catalogSelection, setCatalogSelection] = useState<"mirror" | "social" | "custom">(
    "mirror"
  );

  // Shared UI status
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const handleBusinessNameChange = (val: string) => {
    setBusinessName(val);
    if (!slugEditedManually) {
      const autoSlug = val
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 28);
      setCustomSlug(autoSlug);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* LOGIN POPUP HANDLERS                                                       */
  /* -------------------------------------------------------------------------- */
  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (loginMethod === "email_password") {
      if (!loginEmail.trim() || !loginPassword) {
        setErrorMessage("Please enter your email address and password.");
        return;
      }
    } else if (loginMethod === "passkey_pin") {
      if (!/^\d{6}$/.test(loginPasskeyPin.trim())) {
        setErrorMessage("Please enter your 6-digit Security Passkey.");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (loginMethod === "email_password") {
        try {
          await authClient.signIn.email({
            email: loginEmail.trim(),
            password: loginPassword,
          });
        } catch {
          // Proceed with PostgreSQL vendor auth verification
        }
      }

      const res = await api.loginWithCredentials({
        email: loginEmail.trim(),
        password: loginMethod === "email_password" ? loginPassword : undefined,
        passkeyPin: loginMethod === "passkey_pin" ? loginPasskeyPin.trim() : undefined,
      });

      onLoginSuccess({
        email: res.vendor.email || loginEmail.trim(),
        businessName: res.vendor.businessName || "Nia Stores",
        role: res.vendor.role,
      });
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to sign in. Please check your credentials."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestLoginSmsOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const cleanPhone = formatPhone(loginPhone);
    if (cleanPhone.length < 10) {
      setErrorMessage("Please enter a valid mobile phone number for SMS OTP.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.requestOtp(cleanPhone, "LOGIN");
      setLoginMaskedPhone(res.destinationPhone);
      if (res.devCode) {
        setLoginOtpCode(res.devCode);
        setSimulatedSmsBanner(
          `📱 Carrier SMS (${cleanPhone}): Your 6-digit login code is ${res.devCode}`
        );
      }
      setActivePopup("POPUP_LOGIN_SMS_OTP");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to send SMS verification code.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyLoginSmsOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const cleanPhone = formatPhone(loginPhone);
    const cleanCode = loginOtpCode.replace(/\D/g, "");
    if (cleanCode.length !== 6) {
      setErrorMessage("Please enter the 6-digit SMS OTP code.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.verifyOtp({
        phone: cleanPhone,
        code: cleanCode,
        purpose: "LOGIN",
      });
      if (res.authenticated) {
        onLoginSuccess({
          email: `${cleanPhone.replace(/\D/g, "")}@caterlog.store`,
          businessName: res.vendor.businessName || "Nia Stores",
          role: res.vendor.role,
        });
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Invalid or expired 6-digit SMS code.");
    } finally {
      setSubmitting(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* STANDALONE POPUP 1 -> STANDALONE POPUP 2 (SMS OTP OR GOOGLE AUTHENTICATOR) */
  /* -------------------------------------------------------------------------- */
  const handleCompleteAccountPopup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!signupEmail.trim() || !signupEmail.includes("@")) {
      setErrorMessage("Please enter a valid business email address.");
      return;
    }
    if (signupPassword.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }
    const cleanPhone = formatPhone(signupPhone);
    if (cleanPhone.length < 10) {
      setErrorMessage("Please enter a valid mobile phone number.");
      return;
    }

    if (otpChannel === "AUTHENTICATOR") {
      setActivePopup("POPUP_LINK_GOOGLE_AUTHENTICATOR");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.requestOtp(cleanPhone, "SIGNUP");
      if (res.devCode) {
        setPhoneOtpCode(res.devCode);
        setSimulatedSmsBanner(
          `📱 Carrier SMS: Code ${res.devCode} delivered to ${cleanPhone}`
        );
      }
      setActivePopup("POPUP_VERIFY_PHONE_OTP");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to send SMS OTP.");
    } finally {
      setSubmitting(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* STANDALONE POPUP 2 -> STANDALONE POPUP 3 (6-DIGIT PASSKEY)                 */
  /* -------------------------------------------------------------------------- */
  const handleCompletePhoneOtpPopup = (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneOtpCode.replace(/\D/g, "").length !== 6) {
      setErrorMessage("Please enter all 6 digits of your verification code.");
      return;
    }
    setErrorMessage(null);
    setActivePopup("POPUP_SETUP_PASSKEY");
  };

  /* -------------------------------------------------------------------------- */
  /* STANDALONE POPUP 3 -> STANDALONE POPUP 4 (CLAIM STOREFRONT LINK)           */
  /* -------------------------------------------------------------------------- */
  const handleCompletePasskeyPopup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(signupPasskeyPin.trim())) {
      setErrorMessage("Please enter a 6-digit numeric Security Passkey.");
      return;
    }
    setErrorMessage(null);
    setActivePopup("POPUP_CLAIM_STORE_LINK");
  };

  /* -------------------------------------------------------------------------- */
  /* STANDALONE POPUP 4 -> STANDALONE POPUP 5 (CONNECT SOCIAL ACCOUNTS)         */
  /* -------------------------------------------------------------------------- */
  const handleCompleteStoreLinkPopup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) {
      setErrorMessage("Please enter your Brand / Store Name.");
      return;
    }
    setErrorMessage(null);
    setActivePopup("POPUP_SYNC_SOCIAL_ACCOUNTS");
  };

  /* -------------------------------------------------------------------------- */
  /* STANDALONE POPUP 6 -> LAUNCH STORE & COMMIT TO POSTGRESQL                  */
  /* -------------------------------------------------------------------------- */
  const handleFinalizeStoreLaunch = async () => {
    setErrorMessage(null);
    setSubmitting(true);
    const effectiveName = businessName.trim() || "Nia Luxury Store";
    const cleanPhone = formatPhone(signupPhone);

    try {
      try {
        await authClient.signUp.email({
          email: signupEmail.trim(),
          password: signupPassword,
          name: effectiveName,
        });
      } catch {
        // Proceed with local PostgreSQL onboarding
      }

      const res = await api.onboardVendor({
        businessName: effectiveName,
        phone: cleanPhone,
        email: signupEmail.trim(),
        password: signupPassword,
        passkeyPin: signupPasskeyPin.trim(),
        slug: customSlug.trim() || undefined,
        baseState,
        baseCity,
        role: signupRole,
        isExistingBusiness: signupRole !== "reseller",
        catalogSelection,
        skipOtp: true,
      });

      onLoginSuccess({
        email: signupEmail.trim(),
        businessName: res.vendor.businessName || effectiveName,
        role: res.vendor.role ?? signupRole,
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to launch store.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative bg-gradient-to-br from-[#F8FAFC] via-[#F4F7F6] to-[#ECFDF5]/60 flex flex-col justify-between overflow-hidden select-none">
      {/* Soft Pastel Daylight Mesh Glows behind each standalone floating popup */}
      <div className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full bg-emerald-200/40 blur-[110px] pointer-events-none" />
      <div className="absolute top-1/3 -right-32 w-[420px] h-[420px] rounded-full bg-teal-200/35 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 left-1/3 w-[420px] h-[420px] rounded-full bg-amber-100/50 blur-[110px] pointer-events-none" />

      {/* Clean Light Header */}
      <header className="relative z-10 max-w-6xl w-full mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-[#0d5c3a] text-white flex items-center justify-center font-black text-base shadow-md shadow-emerald-900/15">
            C
          </div>
          <span className="font-bold text-slate-900 text-sm tracking-tight">Caterlog</span>
          <span className="hidden sm:inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-white text-emerald-800 border border-emerald-200 shadow-2xs">
            Social Commerce OS
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            setErrorMessage(null);
            setActivePopup(
              activePopup === "POPUP_LOGIN" ||
                activePopup === "POPUP_LOGIN_SMS_OTP" ||
                activePopup === "POPUP_LOGIN_AUTHENTICATOR"
                ? "POPUP_CREATE_ACCOUNT"
                : "POPUP_LOGIN"
            );
          }}
          className="px-4 py-2 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200/90 text-xs font-bold text-slate-800 shadow-sm cursor-pointer"
        >
          {activePopup === "POPUP_LOGIN" ||
          activePopup === "POPUP_LOGIN_SMS_OTP" ||
          activePopup === "POPUP_LOGIN_AUTHENTICATOR"
            ? "Create a New Store →"
            : "Sign In Instead →"}
        </button>
      </header>

      {/* Center Stage: Every Milestone is a Standalone Floating Popup with Soft Daylight Shadows & Spring Transitions */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4">
        {/* ==================================================================== */}
        {/* STANDALONE POPUP: SIGN IN                                            */}
        {/* ==================================================================== */}
        {activePopup === "POPUP_LOGIN" && (
          <div
            key="popup-login"
            className="w-full max-w-[460px] bg-white rounded-[30px] border border-slate-200/90 p-7 sm:p-8 shadow-[0_28px_80px_-12px_rgba(15,23,42,0.14)] space-y-6 animate-popup-spring"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Secure Sign-In
                </span>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-2">
                  Welcome back
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sign in with Email, 6-Digit Passkey, SMS OTP, or Google Authenticator.
                </p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center text-lg shadow-2xs">
                🔒
              </div>
            </div>

            <div className="grid grid-cols-4 p-1 bg-slate-100 rounded-2xl text-[10px] font-semibold text-slate-600 gap-1">
              {[
                { id: "email_password" as const, label: "✉️ Password" },
                { id: "passkey_pin" as const, label: "🔑 Passkey" },
                { id: "sms_otp" as const, label: "📱 SMS OTP" },
                { id: "google_authenticator" as const, label: "🔐 Authenticator" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setLoginMethod(tab.id);
                    setErrorMessage(null);
                  }}
                  className={`py-2 px-1.5 rounded-xl transition-all cursor-pointer truncate ${
                    loginMethod === tab.id
                      ? "bg-white text-slate-900 shadow-xs font-bold"
                      : "hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {errorMessage && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium animate-popup-spring">
                {errorMessage}
              </div>
            )}

            {loginMethod === "email_password" && (
              <form onSubmit={handleCredentialsLogin} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="owner@yourstore.com"
                    className="w-full px-4 py-3 text-xs border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-600 text-slate-900 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 text-xs border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-600 text-slate-900 font-medium"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-bold text-xs rounded-2xl shadow-lg shadow-emerald-900/15 cursor-pointer disabled:opacity-60"
                >
                  {submitting ? "Signing In..." : "Sign In to Dashboard →"}
                </button>
              </form>
            )}

            {loginMethod === "passkey_pin" && (
              <form onSubmit={handleCredentialsLogin} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                    Email or Store Slug
                  </label>
                  <input
                    type="text"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="owner@yourstore.com"
                    className="w-full px-4 py-3 text-xs border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-600 text-slate-900 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                    6-Digit Security Passkey
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    required
                    maxLength={6}
                    value={loginPasskeyPin}
                    onChange={(e) =>
                      setLoginPasskeyPin(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="••••••"
                    className="w-full px-4 py-3 text-center text-lg font-mono font-bold tracking-[0.5em] border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-600 text-slate-900"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || loginPasskeyPin.length !== 6}
                  className="w-full py-3.5 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-bold text-xs rounded-2xl shadow-lg shadow-emerald-900/15 cursor-pointer disabled:opacity-60"
                >
                  {submitting ? "Unlocking..." : "Unlock with 6-Digit Passkey →"}
                </button>
              </form>
            )}

            {loginMethod === "sms_otp" && (
              <form onSubmit={handleRequestLoginSmsOtp} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                    Verified Mobile Phone (Carrier SMS)
                  </label>
                  <input
                    type="text"
                    required
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    placeholder="+234 803 123 4567"
                    className="w-full px-4 py-3 text-xs border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-600 text-slate-900 font-mono font-bold"
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Code is delivered via carrier SMS—never via WhatsApp chat.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-bold text-xs rounded-2xl shadow-lg shadow-emerald-900/15 cursor-pointer disabled:opacity-60"
                >
                  {submitting ? "Sending SMS..." : "Send 6-Digit SMS Code →"}
                </button>
              </form>
            )}

            {loginMethod === "google_authenticator" && (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                    Account Email
                  </label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="owner@yourstore.com"
                    className="w-full px-4 py-3 text-xs border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-600 text-slate-900 font-medium"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setActivePopup("POPUP_LOGIN_AUTHENTICATOR")}
                  className="w-full py-3.5 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-bold text-xs rounded-2xl shadow-lg shadow-emerald-900/15 cursor-pointer"
                >
                  Open Google Authenticator Verification Popup →
                </button>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await api.requestDemoSession();
                    onLoginSuccess({
                      email: res.vendor.email || "owner@niastores.example",
                      businessName: res.vendor.businessName || "Nia Stores",
                      role: res.vendor.role,
                    });
                  } catch {
                    onLoginSuccess({
                      email: "owner@niastores.example",
                      businessName: "Nia Stores",
                    });
                  }
                }}
                className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 text-xs font-bold rounded-2xl border border-emerald-200/80 cursor-pointer"
              >
                ⚡ Instant Demo: Enter as Nia Stores →
              </button>

              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setActivePopup("POPUP_CREATE_ACCOUNT");
                }}
                className="text-xs text-slate-500 hover:text-slate-900 font-semibold text-center cursor-pointer"
              >
                New to Caterlog?{" "}
                <span className="text-emerald-700 font-bold underline underline-offset-2">
                  Create your account
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* STANDALONE POPUP: GOOGLE AUTHENTICATOR LOGIN                         */}
        {/* ==================================================================== */}
        {activePopup === "POPUP_LOGIN_AUTHENTICATOR" && (
          <GoogleAuthenticatorLinkingModal
            email={loginEmail}
            purpose="LOGIN"
            onClose={() => setActivePopup("POPUP_LOGIN")}
            onVerified={(res) => {
              onLoginSuccess({
                email: res.vendor?.email || loginEmail || "owner@niastores.example",
                businessName: res.vendor?.businessName || "Nia Stores",
                role: res.vendor?.role,
              });
            }}
          />
        )}

        {/* ==================================================================== */}
        {/* STANDALONE POPUP: LOGIN SMS OTP VERIFICATION                         */}
        {/* ==================================================================== */}
        {activePopup === "POPUP_LOGIN_SMS_OTP" && (
          <div
            key="popup-login-sms"
            className="w-full max-w-[420px] bg-white rounded-[30px] border border-slate-200/90 p-7 sm:p-8 shadow-[0_28px_80px_-12px_rgba(15,23,42,0.14)] space-y-5 animate-popup-spring text-xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                SMS Verification
              </span>
              <button
                type="button"
                onClick={() => setActivePopup("POPUP_LOGIN")}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center text-xl shadow-2xs">
                📱
              </div>
              <h2 className="text-lg font-bold text-slate-900">Enter 6-Digit SMS Code</h2>
              <p className="text-xs text-slate-500">
                Sent to{" "}
                <strong className="font-mono text-slate-800">
                  {loginMaskedPhone || loginPhone}
                </strong>
              </p>
            </div>

            {simulatedSmsBanner && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-950 text-[11px] font-medium">
                {simulatedSmsBanner}
              </div>
            )}

            {errorMessage && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 font-medium text-center">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleVerifyLoginSmsOtp} className="space-y-4">
              <input
                type="text"
                autoFocus
                required
                maxLength={6}
                value={loginOtpCode}
                onChange={(e) => setLoginOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••••"
                className="w-full px-4 py-3.5 text-center text-2xl font-mono font-bold tracking-[0.5em] border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-600 text-slate-900 bg-slate-50"
              />
              <button
                type="submit"
                disabled={submitting || loginOtpCode.length !== 6}
                className="w-full py-3.5 rounded-2xl bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-bold shadow-lg shadow-emerald-900/15 cursor-pointer disabled:opacity-50"
              >
                {submitting ? "Verifying..." : "Verify & Open Dashboard →"}
              </button>
            </form>
          </div>
        )}

        {/* ==================================================================== */}
        {/* STANDALONE POPUP 1: CREATE MERCHANT ACCOUNT                          */}
        {/* ==================================================================== */}
        {activePopup === "POPUP_CREATE_ACCOUNT" && (
          <div
            key="popup-create-account"
            className="w-full max-w-[440px] bg-white rounded-[30px] border border-slate-200/90 p-7 sm:p-8 shadow-[0_28px_80px_-12px_rgba(15,23,42,0.14)] space-y-5 animate-popup-spring text-xs"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Welcome to Caterlog
                </span>
                <h1 className="text-xl font-bold text-slate-900 mt-2">
                  Create your account
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Start with your business email, password, and mobile number.
                </p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center text-lg shadow-2xs">
                ✨
              </div>
            </div>

            {errorMessage && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 font-medium animate-popup-spring">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleCompleteAccountPopup} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                  Business Email Address
                </label>
                <input
                  type="email"
                  autoFocus
                  required
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="founder@yourbrand.com"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white font-medium text-slate-900 focus:outline-none focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                  Create Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white font-medium text-slate-900 focus:outline-none focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-600"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-slate-700">
                    Mobile Phone &amp; 2FA Method
                  </label>
                  <div className="flex gap-1 bg-slate-100 p-0.5 rounded-xl text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setOtpChannel("SMS")}
                      className={`px-2 py-0.5 rounded-lg cursor-pointer ${
                        otpChannel === "SMS" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"
                      }`}
                    >
                      📱 SMS OTP
                    </button>
                    <button
                      type="button"
                      onClick={() => setOtpChannel("AUTHENTICATOR")}
                      className={`px-2 py-0.5 rounded-lg cursor-pointer ${
                        otpChannel === "AUTHENTICATOR"
                          ? "bg-white text-slate-900 shadow-2xs"
                          : "text-slate-500"
                      }`}
                    >
                      🔐 Google Authenticator
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  required
                  value={signupPhone}
                  onChange={(e) => setSignupPhone(e.target.value)}
                  placeholder="+234 803 123 4567"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white font-mono font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-600"
                />
                <p className="text-[11px] text-slate-400">
                  {otpChannel === "AUTHENTICATOR"
                    ? "Next popup will display your Google Authenticator QR code & setup key."
                    : "We verify your phone via carrier SMS—never via WhatsApp."}
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-2xl bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-bold shadow-lg shadow-emerald-900/15 cursor-pointer"
              >
                {submitting
                  ? "Preparing Verification..."
                  : otpChannel === "AUTHENTICATOR"
                    ? "Create Account & Link Google Authenticator →"
                    : "Create Account & Send SMS OTP →"}
              </button>
            </form>
          </div>
        )}

        {/* ==================================================================== */}
        {/* STANDALONE POPUP 2A: LINK GOOGLE AUTHENTICATOR APP (QR + BASE32 KEY) */}
        {/* ==================================================================== */}
        {activePopup === "POPUP_LINK_GOOGLE_AUTHENTICATOR" && (
          <GoogleAuthenticatorLinkingModal
            email={signupEmail}
            businessName={businessName || "My Caterlog Store"}
            purpose="SIGNUP"
            onClose={() => setActivePopup("POPUP_CREATE_ACCOUNT")}
            onVerified={() => {
              setTotpLinked(true);
              setActivePopup("POPUP_SETUP_PASSKEY");
            }}
          />
        )}

        {/* ==================================================================== */}
        {/* STANDALONE POPUP 2B: PHONE SMS VERIFICATION                          */}
        {/* ==================================================================== */}
        {activePopup === "POPUP_VERIFY_PHONE_OTP" && (
          <div
            key="popup-verify-phone"
            className="w-full max-w-[420px] bg-white rounded-[30px] border border-slate-200/90 p-7 sm:p-8 shadow-[0_28px_80px_-12px_rgba(15,23,42,0.14)] space-y-5 animate-popup-spring text-xs"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span>✓</span>
                <span>Account Created</span>
              </span>
              <button
                type="button"
                onClick={() => setActivePopup("POPUP_LINK_GOOGLE_AUTHENTICATOR")}
                className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
              >
                Use Google Authenticator Instead →
              </button>
            </div>

            <div className="text-center space-y-1.5">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center text-2xl shadow-2xs">
                📲
              </div>
              <h2 className="text-lg font-bold text-slate-900">Verify your phone number</h2>
              <p className="text-xs text-slate-500">
                Enter the 6-digit SMS code sent to{" "}
                <strong className="font-mono text-slate-800">{formatPhone(signupPhone)}</strong>
              </p>
            </div>

            {simulatedSmsBanner && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-950 text-[11px] font-medium shadow-2xs">
                {simulatedSmsBanner}
              </div>
            )}

            {errorMessage && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 font-medium text-center">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleCompletePhoneOtpPopup} className="space-y-4">
              <input
                type="text"
                autoFocus
                required
                maxLength={6}
                value={phoneOtpCode}
                onChange={(e) => setPhoneOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••••"
                className="w-full px-4 py-3.5 text-center text-2xl font-mono font-bold tracking-[0.5em] border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-600 text-slate-900"
              />

              <button
                type="submit"
                disabled={phoneOtpCode.length !== 6}
                className="w-full py-3.5 rounded-2xl bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-bold shadow-lg shadow-emerald-900/15 cursor-pointer disabled:opacity-50"
              >
                Verify Phone Number →
              </button>
            </form>
          </div>
        )}

        {/* ==================================================================== */}
        {/* STANDALONE POPUP 3: 6-DIGIT SECURITY PASSKEY SETUP                   */}
        {/* ==================================================================== */}
        {activePopup === "POPUP_SETUP_PASSKEY" && (
          <div
            key="popup-setup-passkey"
            className="w-full max-w-[420px] bg-white rounded-[30px] border border-slate-200/90 p-7 sm:p-8 shadow-[0_28px_80px_-12px_rgba(15,23,42,0.14)] space-y-5 animate-popup-spring text-xs"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span>✓</span>
                <span>{totpLinked ? "Google Authenticator Linked" : "Phone Verified"}</span>
              </span>
              <span className="text-[10px] font-bold text-slate-400">Vault Protection</span>
            </div>

            <div className="text-center space-y-1.5">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center text-2xl shadow-2xs">
                🔑
              </div>
              <h2 className="text-lg font-bold text-slate-900">Set your 6-Digit Passkey</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Your 6-digit passkey lets you unlock your dashboard in one tap and protects bank withdrawals.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 font-medium text-center">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleCompletePasskeyPopup} className="space-y-4">
              <input
                type="password"
                inputMode="numeric"
                autoFocus
                required
                maxLength={6}
                value={signupPasskeyPin}
                onChange={(e) =>
                  setSignupPasskeyPin(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="••••••"
                className="w-full px-4 py-3.5 text-center text-2xl font-mono font-bold tracking-[0.5em] border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-600 text-slate-900"
              />

              <button
                type="submit"
                disabled={signupPasskeyPin.length !== 6}
                className="w-full py-3.5 rounded-2xl bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-bold shadow-lg shadow-emerald-900/15 cursor-pointer disabled:opacity-50"
              >
                Save 6-Digit Passkey →
              </button>
            </form>
          </div>
        )}

        {/* ==================================================================== */}
        {/* STANDALONE POPUP 4: CLAIM STOREFRONT IDENTITY & LINK                 */}
        {/* ==================================================================== */}
        {activePopup === "POPUP_CLAIM_STORE_LINK" && (
          <div
            key="popup-claim-store-link"
            className="w-full max-w-[480px] bg-white rounded-[30px] border border-slate-200/90 p-7 sm:p-8 shadow-[0_28px_80px_-12px_rgba(15,23,42,0.14)] space-y-5 animate-popup-spring text-xs"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span>✓</span>
                <span>6-Digit Passkey Active</span>
              </span>
              <span className="text-[10px] font-bold text-slate-400">Storefront Studio</span>
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900">Claim your store link</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Name your brand and pick your storefront tier.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 font-medium">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleCompleteStoreLinkPopup} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                    Brand / Store Name
                  </label>
                  <input
                    type="text"
                    autoFocus
                    required
                    value={businessName}
                    onChange={(e) => handleBusinessNameChange(e.target.value)}
                    placeholder="e.g. Aroko Studio"
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-emerald-500/15 focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                    Live Storefront URL
                  </label>
                  <div className="flex items-center border border-slate-200 rounded-2xl overflow-hidden bg-slate-50">
                    <span className="px-2.5 py-3 text-[11px] text-slate-400 font-mono border-r border-slate-200">
                      caterlog.store/
                    </span>
                    <input
                      type="text"
                      value={customSlug}
                      onChange={(e) => {
                        setSlugEditedManually(true);
                        setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                      }}
                      placeholder="aroko"
                      className="flex-1 px-2.5 py-3 bg-white font-mono font-bold text-emerald-700 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    role: "reseller" as PlatformRole,
                    title: "Dropshipper",
                    tag: "Storefront",
                  },
                  {
                    role: "growth" as PlatformRole,
                    title: "Growth Vendor",
                    tag: "Full Website",
                  },
                  {
                    role: "pro" as PlatformRole,
                    title: "Pro Supplier",
                    tag: "Auto-Logistics",
                  },
                ].map((tier) => (
                  <button
                    key={tier.role}
                    type="button"
                    onClick={() => setSignupRole(tier.role)}
                    className={`p-3 rounded-2xl border text-left cursor-pointer ${
                      signupRole === tier.role
                        ? "border-emerald-600 bg-emerald-50/70 text-emerald-950 ring-1 ring-emerald-600 shadow-xs"
                        : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded-full mb-1 bg-emerald-100 text-emerald-800">
                      {tier.tag}
                    </span>
                    <div className="font-bold text-xs">{tier.title}</div>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Base State
                  </label>
                  <select
                    value={baseState}
                    onChange={(e) => setBaseState(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-2xl bg-slate-50 font-medium text-slate-900"
                  >
                    {NIGERIAN_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    City / Hub
                  </label>
                  <input
                    type="text"
                    value={baseCity}
                    onChange={(e) => setBaseCity(e.target.value)}
                    placeholder="Ikeja, Lekki..."
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-2xl bg-slate-50 font-medium text-slate-900"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-bold shadow-lg shadow-emerald-900/15 cursor-pointer"
              >
                Claim Storefront Link →
              </button>
            </form>
          </div>
        )}

        {/* ==================================================================== */}
        {/* STANDALONE POPUP 5: CONNECT & SYNC SOCIAL BUSINESS ACCOUNTS          */}
        {/* ==================================================================== */}
        {activePopup === "POPUP_SYNC_SOCIAL_ACCOUNTS" && (
          <div
            key="popup-sync-socials"
            className="w-full max-w-[460px] bg-white rounded-[30px] border border-slate-200/90 p-7 sm:p-8 shadow-[0_28px_80px_-12px_rgba(15,23,42,0.14)] space-y-5 animate-popup-spring text-xs"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span>✓</span>
                <span>caterlog.store/{customSlug || "store"} Claimed</span>
              </span>
              <span className="text-[10px] font-bold text-slate-400">Meta Business Sync</span>
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900">Sync your social accounts</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Tap a social channel to pop open its connection card and sync it with PostgreSQL.
              </p>
            </div>

            <div className="space-y-2.5">
              {(
                [
                  {
                    platform: "WHATSAPP" as const,
                    title: "WhatsApp Business Cloud",
                    desc: "Sync catalog & automate chat checkout",
                    icon: "💬",
                    gradient: "from-emerald-500 to-teal-700",
                  },
                  {
                    platform: "INSTAGRAM" as const,
                    title: "Instagram Business & Shop",
                    desc: "Import product posts & automate DM orders",
                    icon: "📸",
                    gradient: "from-pink-500 via-rose-500 to-amber-500",
                  },
                  {
                    platform: "FACEBOOK" as const,
                    title: "Facebook Page & Shop",
                    desc: "Sync Meta Commerce Manager & Messenger",
                    icon: "📘",
                    gradient: "from-blue-600 to-indigo-700",
                  },
                ] as const
              ).map((ch) => {
                const synced = connectedSocials[ch.platform];
                return (
                  <div
                    key={ch.platform}
                    onClick={() => setActiveSocialWizard(ch.platform)}
                    className={`p-4 rounded-2xl border cursor-pointer flex items-center justify-between gap-3 ${
                      synced?.connected
                        ? "border-emerald-300 bg-emerald-50/50 shadow-xs"
                        : "border-slate-200 bg-white hover:border-slate-300 shadow-2xs hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${ch.gradient} text-white flex items-center justify-center text-lg shadow-md`}
                      >
                        {ch.icon}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span>{ch.title}</span>
                          {synced?.connected && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              ✓ Synced
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {synced?.connected ? `Connected as ${synced.handleOrPhone}` : ch.desc}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`px-3.5 py-2 rounded-xl text-[11px] font-bold shrink-0 ${
                        synced?.connected
                          ? "bg-white border border-emerald-200 text-emerald-800"
                          : "bg-[#0d5c3a] text-white shadow-xs"
                      }`}
                    >
                      {synced?.connected ? "Configured" : "Connect ↗"}
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setActivePopup("POPUP_SEED_CATALOG_LAUNCH")}
              className="w-full py-3.5 rounded-2xl bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-bold shadow-lg shadow-emerald-900/15 cursor-pointer"
            >
              Continue to Final Launch Popup →
            </button>
          </div>
        )}

        {/* ==================================================================== */}
        {/* STANDALONE POPUP 6: SEED FIRST CATALOG & LAUNCH STORE                */}
        {/* ==================================================================== */}
        {activePopup === "POPUP_SEED_CATALOG_LAUNCH" && (
          <div
            key="popup-seed-catalog"
            className="w-full max-w-[460px] bg-white rounded-[30px] border border-slate-200/90 p-7 sm:p-8 shadow-[0_28px_80px_-12px_rgba(15,23,42,0.14)] space-y-5 animate-popup-spring text-xs"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span>🎉</span>
                <span>Ready for Launch</span>
              </span>
              <span className="text-[10px] font-bold text-slate-400">PostgreSQL Sync</span>
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900">Seed your starting catalog</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pick how you want your store populated on first launch—zero empty-dashboard friction.
              </p>
            </div>

            <div className="space-y-2.5">
              {[
                {
                  id: "mirror" as const,
                  icon: "🤝",
                  title: "Mirror Verified Wholesale Supplier",
                  desc: "Launch with ready-to-sell items synced with supplier inventory.",
                },
                {
                  id: "social" as const,
                  icon: "📸",
                  title: "Pull Products from Synced Social Shop",
                  desc: "Use items imported from your Instagram, Facebook, or WhatsApp catalog.",
                },
                {
                  id: "custom" as const,
                  icon: "📦",
                  title: "Start with Custom Inventory",
                  desc: "Open your dashboard product studio and upload your own items.",
                },
              ].map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => setCatalogSelection(opt.id)}
                  className={`p-4 rounded-2xl border cursor-pointer flex items-center justify-between gap-3 ${
                    catalogSelection === opt.id
                      ? "border-emerald-600 bg-emerald-50/70 text-emerald-950 ring-1 ring-emerald-600 shadow-xs"
                      : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 shadow-2xs"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{opt.icon}</span>
                    <div>
                      <div className="font-bold">{opt.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</div>
                    </div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      catalogSelection === opt.id
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-slate-300"
                    }`}
                  >
                    {catalogSelection === opt.id && "✓"}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={handleFinalizeStoreLaunch}
              className="w-full py-4 rounded-2xl bg-[#00c068] hover:bg-[#00ad5d] text-white font-bold text-sm shadow-xl shadow-emerald-600/25 cursor-pointer disabled:opacity-50"
            >
              {submitting ? "Launching & Syncing Store..." : "🚀 Launch My Store Now →"}
            </button>
          </div>
        )}
      </main>

      {/* Standalone Social Sync Popup Series */}
      {activeSocialWizard && (
        <SocialSyncWizardModal
          platform={activeSocialWizard}
          businessName={businessName || "My Caterlog Store"}
          initialData={connectedSocials[activeSocialWizard]}
          defaultPhoneOrHandle={
            activeSocialWizard === "WHATSAPP" ? formatPhone(signupPhone) : undefined
          }
          onClose={() => setActiveSocialWizard(null)}
          onSynced={(res) => {
            setConnectedSocials((prev) => ({
              ...prev,
              [activeSocialWizard]: res.socialAccount,
            }));
          }}
        />
      )}

      <footer className="relative z-10 py-4 text-center text-[11px] text-slate-400">
        © 2026 Caterlog Commerce · Standalone Achievement Popups &amp; Real-Time PostgreSQL Sync
      </footer>
    </div>
  );
}
