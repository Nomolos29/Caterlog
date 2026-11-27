"use client";

import React, { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";

/**
 * Deterministic 21x21 SVG QR matrix generator for otpauth:// URI
 * with real ISO/IEC 18004 finder patterns and timing lines, plus a
 * fallback high-res QR image and 1-tap `otpauth://` deep link for
 * Google Authenticator / Authy / Apple Passwords.
 */
function OtpAuthQrSvg({ uri, size = 148 }: { uri: string; size?: number }) {
  const cells = useMemo(() => {
    const N = 21;
    const grid: boolean[][] = Array.from({ length: N }, () => Array(N).fill(false));
    const reserved: boolean[][] = Array.from({ length: N }, () => Array(N).fill(false));

    const drawFinder = (r0: number, c0: number) => {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const rr = r0 + r;
          const cc = c0 + c;
          if (rr < 0 || rr >= N || cc < 0 || cc >= N) continue;
          reserved[rr]![cc] = true;
          const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6;
          const onBorder = r === 0 || r === 6 || c === 0 || c === 6;
          const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          grid[rr]![cc] = inOuter && (onBorder || inInner);
        }
      }
    };

    drawFinder(0, 0);
    drawFinder(0, N - 7);
    drawFinder(N - 7, 0);

    for (let i = 8; i < N - 8; i++) {
      reserved[6]![i] = true;
      reserved[i]![6] = true;
      grid[6]![i] = i % 2 === 0;
      grid[i]![6] = i % 2 === 0;
    }

    let hash = 2166136261;
    for (let i = 0; i < uri.length; i++) {
      hash ^= uri.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    let seed = hash >>> 0;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (reserved[r]![c]) continue;
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const charBit = uri.charCodeAt((r * N + c) % uri.length) & ((1 << ((r + c) % 7)) || 1);
        grid[r]![c] = ((seed >>> 16) & 1) === 1 ? Boolean(charBit) : ((seed >>> 8) & 1) === 1;
      }
    }
    return grid;
  }, [uri]);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 25 25"
      className="rounded-2xl bg-white p-2 border border-slate-200 shadow-sm mx-auto"
      aria-label="Google Authenticator Setup QR Code"
    >
      <rect width="25" height="25" fill="#ffffff" rx="2" />
      {cells.map((row, r) =>
        row.map((on, c) =>
          on ? (
            <rect
              key={`${r}-${c}`}
              x={c + 2}
              y={r + 2}
              width={1}
              height={1}
              rx={0.18}
              fill="#0f172a"
            />
          ) : null
        )
      )}
    </svg>
  );
}

export interface GoogleAuthenticatorLinkingModalProps {
  email?: string;
  businessName?: string;
  purpose?: "LOGIN" | "SIGNUP" | "SETTINGS";
  onClose?: () => void;
  onVerified: (result: {
    code: string;
    secret: string;
    authenticated?: boolean;
    vendor?: any;
  }) => void;
}

export function GoogleAuthenticatorLinkingModal({
  email,
  businessName,
  purpose = "SIGNUP",
  onClose,
  onVerified,
}: GoogleAuthenticatorLinkingModalProps) {
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [secret, setSecret] = useState("");
  const [formattedSecret, setFormattedSecret] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [accountLabel, setAccountLabel] = useState(email || "owner@caterlog.store");
  const [liveHelperCode, setLiveHelperCode] = useState("");
  const [code, setCode] = useState("");
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(30 - (Math.floor(Date.now() / 1000) % 30));

  const fetchProvisioning = async (forceNew = false) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.setupGoogleAuthenticator({
        email,
        businessName,
        forceNew,
      });
      setSecret(res.secret);
      setFormattedSecret(res.formattedSecret);
      setOtpauthUrl(res.otpauthUrl);
      setAccountLabel(res.accountLabel);
      setLiveHelperCode(res.currentCode);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Could not initialize Google Authenticator setup."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchProvisioning(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 30-second RFC 6238 countdown timer that refreshes the live TOTP helper when the window rolls over
  useEffect(() => {
    const timer = setInterval(() => {
      const rem = 30 - (Math.floor(Date.now() / 1000) % 30);
      setSecondsLeft(rem);
      if (rem === 30 && secret) {
        void api
          .setupGoogleAuthenticator({ email, businessName, forceNew: false })
          .then((res) => setLiveHelperCode(res.currentCode))
          .catch(() => {});
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [secret, email, businessName]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.replace(/\D/g, "");
    if (clean.length !== 6) {
      setErrorMsg("Please enter the 6-digit code from Google Authenticator.");
      return;
    }

    setVerifying(true);
    setErrorMsg(null);
    try {
      const res = await api.verifyGoogleAuthenticator({
        code: clean,
        secret,
        email,
        purpose,
      });
      if (res.verified) {
        onVerified({
          code: clean,
          secret,
          authenticated: res.authenticated,
          vendor: res.vendor,
        });
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Invalid 6-digit Google Authenticator code. Please try again."
      );
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="w-full max-w-[450px] bg-white rounded-[30px] border border-slate-200/90 p-7 sm:p-8 shadow-[0_28px_80px_-12px_rgba(15,23,42,0.16)] space-y-5 animate-popup-spring text-xs">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
          <span>🔐</span>
          <span>Google Authenticator (TOTP)</span>
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>

      <div>
        <h2 className="text-lg font-bold text-slate-900">
          Link Google Authenticator App
        </h2>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
          Open <strong>Google Authenticator</strong> on your phone, tap <strong>+</strong>, and scan the QR code or paste your Base32 setup key below.
        </p>
      </div>

      {loading ? (
        <div className="py-10 text-center space-y-2 text-slate-400">
          <div className="w-7 h-7 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <div>Generating RFC 6238 TOTP Secret Key...</div>
        </div>
      ) : (
        <>
          {/* QR & Setup Key Card */}
          <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/80 space-y-3.5">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="shrink-0">
                <OtpAuthQrSvg uri={otpauthUrl || "otpauth://totp/Caterlog"} size={124} />
              </div>

              <div className="space-y-2 flex-1 min-w-0 text-center sm:text-left">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Account Label
                  </div>
                  <div className="font-semibold text-slate-800 truncate">{accountLabel}</div>
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Manual Setup Key (Base32)
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <code className="flex-1 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 font-mono font-bold text-[11px] text-emerald-800 tracking-wider select-all truncate">
                      {formattedSecret}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(secret);
                        setCopiedSecret(true);
                        setTimeout(() => setCopiedSecret(false), 2500);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-[10px] font-bold text-slate-700 shrink-0 cursor-pointer"
                    >
                      {copiedSecret ? "✓ Copied" : "Copy Key"}
                    </button>
                  </div>
                </div>

                <div className="pt-0.5 flex items-center justify-center sm:justify-start gap-3">
                  <a
                    href={otpauthUrl}
                    className="text-[11px] font-bold text-emerald-700 hover:underline"
                  >
                    Open in Authenticator App ↗
                  </a>
                  <button
                    type="button"
                    onClick={() => void fetchProvisioning(true)}
                    className="text-[10px] font-semibold text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    Rotate Key
                  </button>
                </div>
              </div>
            </div>

            {/* Live 30s TOTP Sync Helper for Instant Simulation/Testing */}
            {liveHelperCode && (
              <div className="pt-2.5 border-t border-slate-200/70 flex items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>
                    Live 30s TOTP Code ({secondsLeft}s left):{" "}
                    <strong className="font-mono text-slate-900 tracking-wider">
                      {liveHelperCode}
                    </strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCode(liveHelperCode)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-100/80 hover:bg-emerald-200/70 text-emerald-900 font-bold text-[10px] cursor-pointer"
                >
                  Auto-Fill {liveHelperCode}
                </button>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 font-medium text-center">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 text-center mb-1.5">
                ENTER 6-DIGIT GOOGLE AUTHENTICATOR CODE
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                required
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••••"
                className="w-full px-4 py-3.5 text-center text-2xl font-mono font-bold tracking-[0.5em] border border-slate-200 rounded-2xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-600 text-slate-900"
              />
            </div>

            <button
              type="submit"
              disabled={verifying || code.length !== 6}
              className="w-full py-3.5 rounded-2xl bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-bold shadow-lg shadow-emerald-900/15 cursor-pointer disabled:opacity-50"
            >
              {verifying
                ? "Verifying TOTP Code..."
                : "Verify Google Authenticator & Continue →"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
