"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";
import type { SocialAccountSync } from "@/lib/types";

export interface SocialSyncWizardModalProps {
  platform: "WHATSAPP" | "INSTAGRAM" | "FACEBOOK";
  businessName: string;
  initialData?: SocialAccountSync;
  defaultPhoneOrHandle?: string;
  onClose: () => void;
  onSynced: (result: {
    socialAccount: SocialAccountSync;
    importedProductsCount: number;
    syncedCustomersCount: number;
  }) => void;
}

const PLATFORM_META: Record<
  "WHATSAPP" | "INSTAGRAM" | "FACEBOOK",
  {
    name: string;
    shortName: string;
    badge: string;
    icon: string;
    gradient: string;
    ringColor: string;
    pillBg: string;
    pillText: string;
    inputLabel: string;
    inputPlaceholder: string;
    assetIdLabel: string;
    assetIdPlaceholder: string;
    permissions: Array<{ title: string; desc: string }>;
  }
> = {
  WHATSAPP: {
    name: "WhatsApp Business Cloud",
    shortName: "WhatsApp",
    badge: "Meta Official WABA",
    icon: "💬",
    gradient: "from-emerald-600 to-teal-700",
    ringColor: "focus:ring-emerald-500/20 focus:border-emerald-600",
    pillBg: "bg-emerald-50 border-emerald-200/80",
    pillText: "text-emerald-800",
    inputLabel: "WhatsApp Business Phone Number",
    inputPlaceholder: "+234 803 123 4567",
    assetIdLabel: "WABA Phone Number ID",
    assetIdPlaceholder: "WABA_105992837465001",
    permissions: [
      {
        title: "Real-Time Catalog Mirroring",
        desc: "Push store products, variants & live stock directly to WhatsApp Catalog.",
      },
      {
        title: "24/7 AI Sales Co-Pilot",
        desc: "Instant automated price checks & virtual NUBAN checkout in chat.",
      },
      {
        title: "Automated Order & Waybill Alerts",
        desc: "Send verified payment receipts and courier tracking links automatically.",
      },
    ],
  },
  INSTAGRAM: {
    name: "Instagram Business & Shop",
    shortName: "Instagram",
    badge: "Meta Graph API",
    icon: "📸",
    gradient: "from-pink-600 via-rose-600 to-amber-500",
    ringColor: "focus:ring-pink-500/20 focus:border-pink-600",
    pillBg: "bg-pink-50 border-pink-200/80",
    pillText: "text-pink-800",
    inputLabel: "Instagram Business Handle",
    inputPlaceholder: "@yourbrand.ng",
    assetIdLabel: "Instagram Business Account ID",
    assetIdPlaceholder: "IG_BIZ_992018472",
    permissions: [
      {
        title: "DM & Story Order Capture",
        desc: "Turn Instagram DMs, story replies & reel comments into instant orders.",
      },
      {
        title: "Post & Product Tag Import",
        desc: "Pull product posts from Instagram or push your Caterlog catalog.",
      },
      {
        title: "Unified Customer CRM Sync",
        desc: "Save every Instagram shopper directly into your PostgreSQL Customers table.",
      },
    ],
  },
  FACEBOOK: {
    name: "Facebook Business Page & Shop",
    shortName: "Facebook",
    badge: "Meta Commerce Manager",
    icon: "📘",
    gradient: "from-blue-600 to-indigo-700",
    ringColor: "focus:ring-blue-500/20 focus:border-blue-600",
    pillBg: "bg-blue-50 border-blue-200/80",
    pillText: "text-blue-800",
    inputLabel: "Facebook Business Page Name",
    inputPlaceholder: "Your Brand Official Page",
    assetIdLabel: "Facebook Page / Catalog ID",
    assetIdPlaceholder: "FB_PAGE_448192031",
    permissions: [
      {
        title: "Meta Commerce Manager Feed",
        desc: "Keep Facebook Shop inventory & pricing 100% synced with your database.",
      },
      {
        title: "Click-to-Messenger Ad Co-Pilot",
        desc: "Convert Facebook ad leads in Messenger with instant checkout.",
      },
      {
        title: "Cross-Channel Order Attribution",
        desc: "Track Facebook revenue and customers in your unified dashboard.",
      },
    ],
  },
};

type ActiveSocialPopup =
  | "POPUP_AUTHORIZE"
  | "POPUP_LINK_ASSET"
  | "POPUP_AUTOMATION_RULES"
  | "POPUP_SYNC_CELEBRATION";

export function SocialSyncWizardModal({
  platform,
  businessName,
  initialData,
  defaultPhoneOrHandle,
  onClose,
  onSynced,
}: SocialSyncWizardModalProps) {
  const meta = PLATFORM_META[platform];
  // Each action opens its own completely standalone popup modal (no multi-step header or step bar!)
  const [activePopup, setActivePopup] = useState<ActiveSocialPopup>("POPUP_AUTHORIZE");

  const [connectionMode, setConnectionMode] = useState<"guided_oauth" | "manual_token">(
    "guided_oauth"
  );
  const [handleOrPhone, setHandleOrPhone] = useState(
    initialData?.handleOrPhone ||
      defaultPhoneOrHandle ||
      (platform === "INSTAGRAM"
        ? `@${businessName.toLowerCase().replace(/[^a-z0-9]/g, "") || "mybrand"}`
        : platform === "FACEBOOK"
          ? `${businessName || "My Brand"} Official`
          : "+234 803 123 4567")
  );
  const [businessPortfolioName, setBusinessPortfolioName] = useState(
    initialData?.businessPortfolioName || `${businessName || "My Brand"} Meta Business`
  );
  const [businessAssetId, setBusinessAssetId] = useState(
    initialData?.businessAssetId || meta.assetIdPlaceholder
  );

  // Sync rules
  const [syncCatalogToSocial, setSyncCatalogToSocial] = useState(
    initialData?.syncCatalogToSocial ?? true
  );
  const [importSocialBuyersToCrm, setImportSocialBuyersToCrm] = useState(
    initialData?.importSocialBuyersToCrm ?? true
  );
  const [copilotAutoReply, setCopilotAutoReply] = useState(
    initialData?.copilotAutoReply ?? true
  );
  const [importSampleProductsFromSocial, setImportSampleProductsFromSocial] = useState(false);

  const [syncing, setSyncing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [completedResult, setCompletedResult] = useState<{
    socialAccount: SocialAccountSync;
    importedProductsCount: number;
    syncedCustomersCount: number;
  } | null>(null);

  const handleCommitSyncToDatabase = async () => {
    setErrorMsg(null);
    setSyncing(true);
    try {
      const res = await api.syncSocialAccount({
        platform,
        connected: true,
        handleOrPhone: handleOrPhone.trim(),
        businessAssetId: businessAssetId.trim(),
        businessPortfolioName: businessPortfolioName.trim(),
        syncCatalogToSocial,
        importSocialBuyersToCrm,
        copilotAutoReply,
        importSampleProductsFromSocial,
      });

      setCompletedResult({
        socialAccount: res.socialAccount,
        importedProductsCount: res.importedProductsCount,
        syncedCustomersCount: res.syncedCustomersCount,
      });
      setActivePopup("POPUP_SYNC_CELEBRATION");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to sync social business account.");
    } finally {
      setSyncing(false);
    }
  };

  /* ======================================================================== */
  /* STANDALONE POPUP 1: AUTHORIZE & CHOOSE CONNECTION MODE                   */
  /* ======================================================================== */
  if (activePopup === "POPUP_AUTHORIZE") {
    return (
      <div className="fixed inset-0 z-[75] bg-slate-900/20 backdrop-blur-md flex items-center justify-center p-4 animate-backdrop-fade">
        <div
          key="social-popup-authorize"
          className="relative w-full max-w-[440px] bg-white rounded-[30px] border border-slate-200/90 p-7 shadow-[0_28px_80px_-12px_rgba(15,23,42,0.18)] space-y-5 animate-popup-spring text-xs"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3.5">
              <div
                className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${meta.gradient} text-white flex items-center justify-center text-2xl shadow-lg shadow-slate-900/15`}
              >
                {meta.icon}
              </div>
              <div>
                <span
                  className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${meta.pillBg} ${meta.pillText}`}
                >
                  {meta.badge}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  Connect {meta.shortName} Business
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2.5">
            {meta.permissions.map((perm, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-start gap-3 shadow-2xs"
              >
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  ✓
                </span>
                <div>
                  <div className="font-bold text-slate-900">{perm.title}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">{perm.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setConnectionMode("guided_oauth")}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                connectionMode === "guided_oauth"
                  ? "border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/15"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              <div className="font-bold flex items-center justify-between">
                <span>⚡ 1-Click OAuth</span>
                {connectionMode === "guided_oauth" && <span>✓</span>}
              </div>
              <p
                className={`text-[10px] mt-1 ${
                  connectionMode === "guided_oauth" ? "text-slate-300" : "text-slate-400"
                }`}
              >
                Meta Business Suite
              </p>
            </button>

            <button
              type="button"
              onClick={() => setConnectionMode("manual_token")}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                connectionMode === "manual_token"
                  ? "border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/15"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              <div className="font-bold flex items-center justify-between">
                <span>🔑 Asset ID</span>
                {connectionMode === "manual_token" && <span>✓</span>}
              </div>
              <p
                className={`text-[10px] mt-1 ${
                  connectionMode === "manual_token" ? "text-slate-300" : "text-slate-400"
                }`}
              >
                Custom Graph ID
              </p>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setActivePopup("POPUP_LINK_ASSET")}
            className="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-lg shadow-slate-900/25 transition-all active:scale-98 cursor-pointer"
          >
            Authorize &amp; Link Account →
          </button>
        </div>
      </div>
    );
  }

  /* ======================================================================== */
  /* STANDALONE POPUP 2: LINK BUSINESS HANDLE / PHONE ASSET                   */
  /* ======================================================================== */
  if (activePopup === "POPUP_LINK_ASSET") {
    return (
      <div className="fixed inset-0 z-[75] bg-slate-900/20 backdrop-blur-md flex items-center justify-center p-4 animate-backdrop-fade">
        <div
          key="social-popup-link"
          className="relative w-full max-w-[430px] bg-white rounded-[30px] border border-slate-200/90 p-7 shadow-[0_28px_80px_-12px_rgba(15,23,42,0.18)] space-y-5 animate-popup-spring text-xs"
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span>✓</span>
              <span>Permissions Authorized</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900">
              Link Your {meta.shortName} Profile
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Confirm the business identity to bind to <strong>{businessName}</strong>.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 font-medium">
              {errorMsg}
            </div>
          )}

          <div className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                {meta.inputLabel}
              </label>
              <input
                type="text"
                autoFocus
                value={handleOrPhone}
                onChange={(e) => setHandleOrPhone(e.target.value)}
                placeholder={meta.inputPlaceholder}
                className={`w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white font-mono font-bold text-slate-900 focus:outline-none focus:ring-4 transition-all ${meta.ringColor}`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                Meta Business Portfolio
              </label>
              <input
                type="text"
                value={businessPortfolioName}
                onChange={(e) => setBusinessPortfolioName(e.target.value)}
                className={`w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white font-medium text-slate-900 focus:outline-none focus:ring-4 transition-all ${meta.ringColor}`}
              />
            </div>

            {connectionMode === "manual_token" && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                  {meta.assetIdLabel}
                </label>
                <input
                  type="text"
                  value={businessAssetId}
                  onChange={(e) => setBusinessAssetId(e.target.value)}
                  placeholder={meta.assetIdPlaceholder}
                  className={`w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white font-mono text-slate-700 focus:outline-none focus:ring-4 transition-all ${meta.ringColor}`}
                />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              if (!handleOrPhone.trim()) {
                setErrorMsg(`Please enter your ${meta.inputLabel}.`);
                return;
              }
              setErrorMsg(null);
              setActivePopup("POPUP_AUTOMATION_RULES");
            }}
            className="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-lg shadow-slate-900/25 transition-all active:scale-98 cursor-pointer"
          >
            Account Linked · Choose Sync Rules →
          </button>
        </div>
      </div>
    );
  }

  /* ======================================================================== */
  /* STANDALONE POPUP 3: CATALOG & AI CO-PILOT SYNC PREFERENCES               */
  /* ======================================================================== */
  if (activePopup === "POPUP_AUTOMATION_RULES") {
    return (
      <div className="fixed inset-0 z-[75] bg-slate-900/20 backdrop-blur-md flex items-center justify-center p-4 animate-backdrop-fade">
        <div
          key="social-popup-rules"
          className="relative w-full max-w-[440px] bg-white rounded-[30px] border border-slate-200/90 p-7 shadow-[0_28px_80px_-12px_rgba(15,23,42,0.18)] space-y-5 animate-popup-spring text-xs"
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span>✓</span>
              <span>Linked: {handleOrPhone}</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900">
              Activate Database &amp; Catalog Sync
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Toggle what Caterlog should automatically sync for <strong>{handleOrPhone}</strong>.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 font-medium">
              {errorMsg}
            </div>
          )}

          <div className="space-y-2.5">
            {[
              {
                checked: syncCatalogToSocial,
                onChange: setSyncCatalogToSocial,
                title: `Push Store Catalog to ${meta.shortName}`,
                desc: "Mirror prices, variants & real-time stock quantities.",
              },
              {
                checked: importSocialBuyersToCrm,
                onChange: setImportSocialBuyersToCrm,
                title: "Auto-Save Buyers to Customers DB",
                desc: `Save every ${meta.shortName} shopper in PostgreSQL.`,
              },
              {
                checked: copilotAutoReply,
                onChange: setCopilotAutoReply,
                title: "24/7 AI Sales Co-Pilot Replies",
                desc: "Instant automated price checks & virtual NUBAN checkout.",
              },
              {
                checked: importSampleProductsFromSocial,
                onChange: setImportSampleProductsFromSocial,
                title: `Import Product Posts from ${meta.shortName}`,
                desc: "Pull featured social catalog items into your store DB now.",
                highlight: true,
              },
            ].map((rule, i) => (
              <div
                key={i}
                onClick={() => rule.onChange(!rule.checked)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  rule.highlight && rule.checked
                    ? "border-emerald-300 bg-emerald-50/70 shadow-xs"
                    : rule.checked
                      ? "border-slate-300 bg-white shadow-2xs"
                      : "border-slate-200 bg-slate-50/60 opacity-75"
                }`}
              >
                <div>
                  <div className="font-bold text-slate-900">{rule.title}</div>
                  <p className="text-[11px] text-slate-500 mt-0.5">{rule.desc}</p>
                </div>
                <div
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${
                    rule.checked ? "bg-emerald-600" : "bg-slate-300"
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${
                      rule.checked ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            disabled={syncing}
            onClick={handleCommitSyncToDatabase}
            className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-600/25 transition-all active:scale-98 cursor-pointer disabled:opacity-50"
          >
            {syncing ? "Syncing with PostgreSQL..." : `Finish & Sync ${meta.shortName} →`}
          </button>
        </div>
      </div>
    );
  }

  /* ======================================================================== */
  /* STANDALONE POPUP 4: ACHIEVEMENT & SYNC CELEBRATION POPUP                 */
  /* ======================================================================== */
  return (
    <div className="fixed inset-0 z-[75] bg-slate-900/20 backdrop-blur-md flex items-center justify-center p-4 animate-backdrop-fade">
      <div
        key="social-popup-celebration"
        className="relative w-full max-w-[400px] bg-white rounded-[30px] border border-slate-200/90 p-7 shadow-[0_28px_80px_-12px_rgba(15,23,42,0.18)] text-center space-y-5 animate-popup-spring text-xs"
      >
        <div className="w-16 h-16 rounded-3xl bg-emerald-600 text-white flex items-center justify-center text-3xl mx-auto shadow-xl shadow-emerald-600/30">
          ✓
        </div>

        <div>
          <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 mb-2">
            Achievement Unlocked
          </span>
          <h3 className="text-lg font-bold text-slate-900">
            {meta.shortName} Synced with Database!
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            <strong className="text-slate-900">
              {completedResult?.socialAccount.handleOrPhone || handleOrPhone}
            </strong>{" "}
            is now live and connected to your store.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="text-slate-400">Webhook</div>
            <div className="font-bold text-emerald-700 mt-0.5">● LIVE</div>
          </div>
          <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="text-slate-400">Catalog</div>
            <div className="font-bold text-slate-900 mt-0.5">
              {completedResult?.socialAccount.syncedProductsCount ?? 0} items
            </div>
          </div>
          <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="text-slate-400">Imported</div>
            <div className="font-bold text-emerald-700 mt-0.5">
              +{completedResult?.importedProductsCount ?? 0} new
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (completedResult) {
              onSynced(completedResult);
            }
            onClose();
          }}
          className="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-lg shadow-slate-900/20 transition-all cursor-pointer"
        >
          Awesome, Continue →
        </button>
      </div>
    </div>
  );
}
