"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { PlatformRole, VendorState } from "@/lib/types";
import {
  canUseFullWebsiteMode,
  getStorefrontPresetById,
  resolveVendorStorefrontConfig,
  STOREFRONT_PRESETS,
  type BorderRadiusToken,
  type CardToneToken,
  type CategoryBentoVariantId,
  type FilterLayoutVariantId,
  type FontPairingId,
  type FooterVariantId,
  type HeaderVariantId,
  type HeroVariantId,
  type ProductCardVariantId,
  type PromoDealVariantId,
  type SectionHeadingStyleId,
  type ShopBannerVariantId,
  type SocialNewsletterVariantId,
  type StorefrontConfig,
  type SurfaceModeId,
  type TestimonialsVariantId,
  type TrustStripVariantId,
} from "@/lib/storefront-presets";
import { StorefrontRenderer } from "@/components/storefront/storefront-renderer";

interface StorefrontViewProps {
  state: VendorState;
  activeWorkspace: PlatformRole;
  onStateChange: (nextState: VendorState) => void;
  onNavigateToPlans?: () => void;
}

type CustomizerTab = "presets" | "sections" | "theme" | "copy";

const ACCENT_COLOR_SWATCHES = [
  { label: "Obsidian", hex: "#111827" },
  { label: "Botanical Sage", hex: "#4D6B53" },
  { label: "Saddle Leather", hex: "#B87D5B" },
  { label: "Couture Wine", hex: "#5B2333" },
  { label: "Indigo Lab", hex: "#4F46E5" },
  { label: "Street Slate", hex: "#5F7A7B" },
  { label: "Luxury Amber", hex: "#D97706" },
  { label: "Terracotta", hex: "#7C523E" },
];

export function StorefrontView({
  state,
  activeWorkspace,
  onStateChange,
  onNavigateToPlans,
}: StorefrontViewProps) {
  const isFullWebsiteEligible = canUseFullWebsiteMode(activeWorkspace);

  const [draftConfig, setDraftConfig] = useState<StorefrontConfig>(() =>
    resolveVendorStorefrontConfig(
      state.storefrontConfig ?? state.vendor.storefrontConfig,
      activeWorkspace,
      state.vendor.businessName
    )
  );

  // Sync when workspace role toggles in the top bar (e.g. reseller -> starter -> growth -> pro)
  useEffect(() => {
    setDraftConfig((prev) => {
      const nextEligible = canUseFullWebsiteMode(activeWorkspace);
      const currentPreset = getStorefrontPresetById(prev.presetId);
      if (!nextEligible && prev.mode === "FULL_WEBSITE") {
        // Switch to default storefront preset when previewing as Starter/Reseller unless preview override is on
        const starterPreset =
          currentPreset.recommendedTier === "STARTER_RESELLER"
            ? currentPreset.config
            : getStorefrontPresetById("stuffsus-shop").config;
        return {
          ...starterPreset,
          mode: "STOREFRONT_ONLY",
        };
      }
      if (nextEligible && prev.mode === "STOREFRONT_ONLY" && currentPreset.recommendedTier === "STARTER_RESELLER") {
        const growthPreset = getStorefrontPresetById("jenahara-editorial").config;
        return {
          ...growthPreset,
          mode: "FULL_WEBSITE",
        };
      }
      return prev;
    });
  }, [activeWorkspace]);

  const [activeTab, setActiveTab] = useState<CustomizerTab>("presets");
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [previewFullWebsiteAsStarter, setPreviewFullWebsiteAsStarter] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const publicStoreUrl = `/store/${encodeURIComponent(state.vendor.slug || "store")}`;

  const effectivePreviewConfig: StorefrontConfig = {
    ...draftConfig,
    mode:
      isFullWebsiteEligible
        ? draftConfig.mode
        : previewFullWebsiteAsStarter
          ? "FULL_WEBSITE"
          : "STOREFRONT_ONLY",
  };

  const handleApplyPreset = (presetId: string) => {
    const preset = getStorefrontPresetById(presetId);
    const shouldPreviewFull =
      !isFullWebsiteEligible && preset.recommendedTier === "GROWTH_PRO";
    if (shouldPreviewFull) {
      setPreviewFullWebsiteAsStarter(true);
    }
    setDraftConfig({
      ...preset.config,
      mode:
        isFullWebsiteEligible
          ? preset.config.mode
          : shouldPreviewFull
            ? "FULL_WEBSITE"
            : "STOREFRONT_ONLY",
    });
  };

  const handleSavePublish = async () => {
    setSaving(true);
    setStatusMessage(null);
    try {
      const res = await api.saveStorefrontConfig(draftConfig, activeWorkspace);
      onStateChange(res.state);
      setStatusMessage("✓ Storefront & Website design published live!");
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? `Error: ${err.message}` : "Failed to save storefront."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = () => {
    if (typeof window !== "undefined" && navigator.clipboard) {
      const fullUrl = `${window.location.origin}${publicStoreUrl}`;
      void navigator.clipboard.writeText(fullUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    }
  };

  const starterPresets = STOREFRONT_PRESETS.filter(
    (p) => p.recommendedTier === "STARTER_RESELLER"
  );
  const growthProPresets = STOREFRONT_PRESETS.filter(
    (p) => p.recommendedTier === "GROWTH_PRO"
  );

  return (
    <div className="space-y-5">
      {/* TOP BAR: Title, Tier Badge, Viewport Toggle, Share Link & Publish Button */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xs">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-lg sm:text-xl font-extrabold text-gray-900">
              Storefront & Website Studio
            </h1>
            {isFullWebsiteEligible ? (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                ★ {activeWorkspace.toUpperCase()} TIER · Full Brand Website Unlocked
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                {activeWorkspace === "reseller" ? "DROPSHIPPER" : "STARTER"} TIER · Catalog Storefront Mode
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {isFullWebsiteEligible
              ? "Mix and match reusable headers, heroes, category bentos, product cards, and theme tokens so your brand website looks 100% unique."
              : "Customize your high-converting catalog storefront below, or test-drive Growth/Pro Full Brand Website templates in the live preview."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Desktop / Mobile Viewport Toggle */}
          <div className="inline-flex items-center bg-gray-100 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewport("desktop")}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                viewport === "desktop"
                  ? "bg-white text-gray-900 shadow-2xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              💻 Desktop
            </button>
            <button
              type="button"
              onClick={() => setViewport("mobile")}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                viewport === "mobile"
                  ? "bg-white text-gray-900 shadow-2xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              📱 Mobile
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyLink}
            className="px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            {copiedUrl ? "✓ Link Copied!" : "🔗 Copy Store Link"}
          </button>

          <a
            href={`${publicStoreUrl}?tier=${encodeURIComponent(
              effectivePreviewConfig.mode === "FULL_WEBSITE" ? "GROWTH" : "STARTER"
            )}`}
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
          >
            ↗ Open Live Site
          </a>

          <button
            type="button"
            disabled={saving}
            onClick={handleSavePublish}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-gray-900 hover:bg-black text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {saving ? "Publishing..." : "Publish Design"}
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
          {statusMessage}
        </div>
      )}

      {/* TIER UPSELL BANNER FOR DROPSHIPPERS & STARTERS WHEN PREVIEWING FULL WEBSITE */}
      {!isFullWebsiteEligible && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="inline-block px-2 py-0.5 rounded-xs bg-amber-400 text-slate-950 text-[10px] font-extrabold uppercase tracking-wider mb-1">
              Tier Architecture
            </span>
            <h3 className="text-sm font-bold">
              {previewFullWebsiteAsStarter
                ? "Previewing Growth/Pro Full Brand Website Mode"
                : "You are on Catalog Storefront Mode (Starter & Dropshipper)"}
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Starter & Dropshipper plans include the 5 Catalog Storefront layouts. Upgrade to Growth or Pro to unlock multi-page Full Brand Websites, Editorial Bento Mosaics, Deal Countdowns & Custom Domains.
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setPreviewFullWebsiteAsStarter((prev) => !prev)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
            >
              {previewFullWebsiteAsStarter
                ? "Switch Back to Storefront Mode"
                : "✨ Preview Full Website Mode"}
            </button>
            {onNavigateToPlans && (
              <button
                type="button"
                onClick={onNavigateToPlans}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-colors cursor-pointer"
              >
                Upgrade to Growth →
              </button>
            )}
          </div>
        </div>
      )}

      {/* MAIN STUDIO WORKBENCH: Left Customizer Panel (4 cols) + Right Live Canvas (8 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* LEFT CUSTOMIZER SIDEBAR */}
        <div className="xl:col-span-4 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-2xs">
          {/* Customizer Tabs */}
          <div className="grid grid-cols-4 border-b border-gray-200 bg-gray-50 text-xs font-bold">
            {(
              [
                { id: "presets", label: "Presets" },
                { id: "sections", label: "Sections" },
                { id: "theme", label: "Theme" },
                { id: "copy", label: "Copy" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 text-center border-b-2 transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-white text-gray-900 border-gray-900"
                    : "text-gray-500 border-transparent hover:text-gray-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-4 sm:p-5 max-h-[780px] overflow-y-auto space-y-5">
            {/* ===============================================================
                TAB 1: 10 MOCKUP-INSPIRED BRAND PRESETS
               =============================================================== */}
            {activeTab === "presets" && (
              <div className="space-y-6">
                {/* Mode Switcher for Growth & Pro Vendors */}
                {isFullWebsiteEligible && (
                  <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                      Experience Mode
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setDraftConfig((prev) => ({ ...prev, mode: "FULL_WEBSITE" }))
                        }
                        className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          draftConfig.mode === "FULL_WEBSITE"
                            ? "bg-gray-900 text-white border-gray-900"
                            : "bg-white text-gray-700 border-gray-200"
                        }`}
                      >
                        🌐 Full Brand Website
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDraftConfig((prev) => ({ ...prev, mode: "STOREFRONT_ONLY" }))
                        }
                        className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          draftConfig.mode === "STOREFRONT_ONLY"
                            ? "bg-gray-900 text-white border-gray-900"
                            : "bg-white text-gray-700 border-gray-200"
                        }`}
                      >
                        🛍️ Compact Storefront
                      </button>
                    </div>
                  </div>
                )}

                {/* Group A: Starter & Dropshipper Storefront Presets */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-900">
                      Catalog Storefront Presets (Starter & Dropshipper)
                    </h3>
                    <span className="text-[10px] font-semibold text-gray-500">5 Layouts</span>
                  </div>
                  <div className="space-y-2.5">
                    {starterPresets.map((preset) => {
                      const isSelected = draftConfig.presetId === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleApplyPreset(preset.id)}
                          className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? "border-gray-900 ring-2 ring-gray-900/10 bg-gray-50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="inline-flex items-center gap-2 text-xs font-extrabold text-gray-900">
                              <span
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: preset.previewBadgeColor }}
                              />
                              {preset.name}
                            </span>
                            <span className="px-2 py-0.5 rounded-xs bg-gray-100 text-gray-600 text-[10px] font-mono">
                              {preset.mockupReference}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 leading-snug">
                            {preset.tagline}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Group B: Growth & Pro Full Brand Website Presets */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-900">
                      Full Brand Website Presets (Growth & Pro)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700">
                      Multi-Page
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {growthProPresets.map((preset) => {
                      const isSelected = draftConfig.presetId === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleApplyPreset(preset.id)}
                          className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? "border-gray-900 ring-2 ring-gray-900/10 bg-gray-50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="inline-flex items-center gap-2 text-xs font-extrabold text-gray-900">
                              <span
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: preset.previewBadgeColor }}
                              />
                              {preset.name}
                            </span>
                            <span className="px-2 py-0.5 rounded-xs bg-indigo-50 text-indigo-700 text-[10px] font-semibold">
                              {isFullWebsiteEligible ? "Growth/Pro" : "Preview"}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 leading-snug">
                            {preset.tagline}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ===============================================================
                TAB 2: REUSABLE SECTION VARIANTS & VISIBILITY
               =============================================================== */}
            {activeTab === "sections" && (
              <div className="space-y-4 text-xs">
                {/* 1. Header Variant */}
                <div>
                  <label className="block font-bold text-gray-800 mb-1">
                    1. Navigation Header Style
                  </label>
                  <select
                    value={draftConfig.headerVariant}
                    onChange={(e) =>
                      setDraftConfig((prev) => ({
                        ...prev,
                        headerVariant: e.target.value as HeaderVariantId,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white font-medium"
                  >
                    <option value="minimal-inline">Minimal Inline (Guza / Minim / Stuffsus)</option>
                    <option value="centered-editorial">Centered Editorial Wordmark (Drexel / Glowing / Bagkin)</option>
                    <option value="stacked-boutique">Stacked 2-Row Boutique (Storefront-01 SA)</option>
                    <option value="bordered-editorial">Bordered Magazine Grid (Jenahara Storefront-05)</option>
                  </select>
                </div>

                {/* 2. Shop Banner Variant (Used on Storefronts & /shop page) */}
                <div>
                  <label className="block font-bold text-gray-800 mb-1">
                    2. Shop / Storefront Banner Style
                  </label>
                  <select
                    value={draftConfig.shopBannerVariant}
                    onChange={(e) =>
                      setDraftConfig((prev) => ({
                        ...prev,
                        shopBannerVariant: e.target.value as ShopBannerVariantId,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white font-medium"
                  >
                    <option value="overlap-typographic">Giant Overlap &quot;Shop&quot; + Docked Search (Shoppage-01 Stuffsus)</option>
                    <option value="curved-arch">Curved Arch Hero + Straddling Pill CTA (Shoppage-03 Constructor)</option>
                    <option value="split-breadcrumb">Warm Split Banner + Product Lineup (Storefront-06 Guza)</option>
                    <option value="minimal-rack">Full-Bleed Studio Rack Banner (Storefront-07 Ugmonk)</option>
                    <option value="promo-box">Architectural Muted Promo Box (Shoppage-02 Drexel)</option>
                  </select>
                </div>

                {/* 3. Full Website Hero Variant (Growth & Pro) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-gray-800">
                      3. Homepage Brand Hero (Growth/Pro)
                    </label>
                    {!isFullWebsiteEligible && (
                      <span className="text-[10px] font-bold text-indigo-600">Growth/Pro</span>
                    )}
                  </div>
                  <select
                    value={draftConfig.heroVariant}
                    onChange={(e) =>
                      setDraftConfig((prev) => ({
                        ...prev,
                        heroVariant: e.target.value as HeroVariantId,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white font-medium"
                  >
                    <option value="split-studio">50/50 Studio Split with Price Tag (Nyture / Glowing / Luxora)</option>
                    <option value="magazine-layered">Magazine Cover Layered Title + Ribbon (Jenahara Storefront-05)</option>
                    <option value="product-spotlight">Watermark 01 + Stat Bubbles + Dual CTAs (Palo Santo Homepage-01)</option>
                    <option value="editorial-center-overlay">Full-Bleed Editorial Center Overlay (Bagkin / Kylie)</option>
                    <option value="dark-luxury">High-Contrast Obsidian Dark Luxury (Illuminate / Funio)</option>
                    <option value="script-overlap">Script Accent Overlapping Display Headline (Orgamic Storefront-13)</option>
                  </select>
                </div>

                {/* 4. Product Card Style */}
                <div>
                  <label className="block font-bold text-gray-800 mb-1">
                    4. Product Card Component Variant
                  </label>
                  <select
                    value={draftConfig.productCardVariant}
                    onChange={(e) =>
                      setDraftConfig((prev) => ({
                        ...prev,
                        productCardVariant: e.target.value as ProductCardVariantId,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white font-medium"
                  >
                    <option value="dual-action-rounded">Dual Action Pills: [Add to Cart] + [Buy Now] (Shoppage-01 Stuffsus)</option>
                    <option value="pastel-floating-cart">Pastel Backdrop + Floating Circle Cart Icon (Shoppage-03 Constructor)</option>
                    <option value="lookbook-gradient-overlay">Tall 3:4 Portrait + Bottom Gradient Overlay (Storefront-05 Jenahara)</option>
                    <option value="minimal-swatch-studio">Minimal Studio + Interactive Color Swatches (Storefront-06 Guza)</option>
                    <option value="boutique-badged">Corner Badges (HOT/-15%) + Stars + Compare Price (Drexel / Glowing)</option>
                  </select>
                </div>

                {/* 5. Catalog Filter & Toolbar Layout */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block font-bold text-gray-800 mb-1">
                      5. Catalog Filter Layout
                    </label>
                    <select
                      value={draftConfig.filterLayoutVariant}
                      onChange={(e) =>
                        setDraftConfig((prev) => ({
                          ...prev,
                          filterLayoutVariant: e.target.value as FilterLayoutVariantId,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white font-medium"
                    >
                      <option value="sidebar-full">Left Sidebar (Categories, Price, Colors, Sizes)</option>
                      <option value="horizontal-popover-bar">Top Popover Bar + 2/3/4 Column Switcher (Guza)</option>
                      <option value="centered-category-tabs">Centered Category Tabs (Ugmonk / SA)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-gray-800 mb-1">
                      Default Columns
                    </label>
                    <select
                      value={draftConfig.gridColumns}
                      onChange={(e) =>
                        setDraftConfig((prev) => ({
                          ...prev,
                          gridColumns: Number(e.target.value) as 3 | 4,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white font-medium"
                    >
                      <option value={3}>3 Columns</option>
                      <option value={4}>4 Columns</option>
                    </select>
                  </div>
                </div>

                {/* 6. Category Bento Mosaic Variant (Growth & Pro) */}
                <div>
                  <label className="block font-bold text-gray-800 mb-1">
                    6. Category & Lookbook Bento Mosaic (Growth/Pro)
                  </label>
                  <select
                    value={draftConfig.categoryBentoVariant}
                    onChange={(e) =>
                      setDraftConfig((prev) => ({
                        ...prev,
                        categoryBentoVariant: e.target.value as CategoryBentoVariantId,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white font-medium"
                  >
                    <option value="4-tile-left-tall">4-Tile Left Tall Feature (Bagkin Storefront-02)</option>
                    <option value="4-tile-right-tall">4-Tile Right Tall Lookbook Edit (Nyture Storefront-08)</option>
                    <option value="6-tile-editorial-mosaic">6-Tile Pastel Editorial Mosaic (Kylie Storefront-04)</option>
                    <option value="2-col-split-banners">2-Column Split Landscape Banners (Funio / Glowing)</option>
                    <option value="thumbnail-strip">5-Column Category Thumbnail Row (Funio Top Categories)</option>
                  </select>
                </div>

                {/* 7. Section Heading Style */}
                <div>
                  <label className="block font-bold text-gray-800 mb-1">
                    7. Section Heading Decoration
                  </label>
                  <select
                    value={draftConfig.sectionHeadingStyle}
                    onChange={(e) =>
                      setDraftConfig((prev) => ({
                        ...prev,
                        sectionHeadingStyle: e.target.value as SectionHeadingStyleId,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white font-medium"
                  >
                    <option value="clean-centered">Clean Centered Heading (Glowing / Bagkin)</option>
                    <option value="flanking-lines">Flanking Horizontal Lines ─── TITLE ─── (Nyture)</option>
                    <option value="framed-box">Framed Rectangular Box [ BEST SELLERS ] (Orgamic)</option>
                    <option value="left-with-link">Left Bold Title + Right Action Link (Stuffsus / Illuminate)</option>
                  </select>
                </div>

                {/* 8. Trust Strip, Promo Countdown, Testimonials & Footer */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold text-gray-800 mb-1">
                      8. Trust Strip
                    </label>
                    <select
                      value={draftConfig.trustStripVariant}
                      onChange={(e) =>
                        setDraftConfig((prev) => ({
                          ...prev,
                          trustStripVariant: e.target.value as TrustStripVariantId,
                        }))
                      }
                      className="w-full px-2.5 py-2 rounded-lg border border-gray-200 bg-white font-medium"
                    >
                      <option value="4-col-horizontal-icons">4-Col Icon Row (Luxora)</option>
                      <option value="3-col-feature-cards">3-Col &quot;Why Choose Us&quot; (Homepage-01)</option>
                      <option value="authentic-stamp-strip">Vintage Stamp Strip (Kylie)</option>
                      <option value="none">Hidden</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-800 mb-1">
                      9. Promo & Story
                    </label>
                    <select
                      value={draftConfig.promoDealVariant}
                      onChange={(e) =>
                        setDraftConfig((prev) => ({
                          ...prev,
                          promoDealVariant: e.target.value as PromoDealVariantId,
                        }))
                      }
                      className="w-full px-2.5 py-2 rounded-lg border border-gray-200 bg-white font-medium"
                    >
                      <option value="countdown-banner">Flash Deal Countdown (Bagkin)</option>
                      <option value="split-story-stats">Split Story + Stat Card (Homepage-01)</option>
                      <option value="none">Hidden</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-800 mb-1">
                      10. Testimonials
                    </label>
                    <select
                      value={draftConfig.testimonialsVariant}
                      onChange={(e) =>
                        setDraftConfig((prev) => ({
                          ...prev,
                          testimonialsVariant: e.target.value as TestimonialsVariantId,
                        }))
                      }
                      className="w-full px-2.5 py-2 rounded-lg border border-gray-200 bg-white font-medium"
                    >
                      <option value="single-pull-quote">5-Star Pull Quote (Luxora)</option>
                      <option value="numbered-3col">Numbered 3-Col Cards (Minim)</option>
                      <option value="press-quote-grid">&quot;As Seen In&quot; Press Grid (Glowing)</option>
                      <option value="none">Hidden</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-800 mb-1">
                      11. Footer Style
                    </label>
                    <select
                      value={draftConfig.footerVariant}
                      onChange={(e) =>
                        setDraftConfig((prev) => ({
                          ...prev,
                          footerVariant: e.target.value as FooterVariantId,
                        }))
                      }
                      className="w-full px-2.5 py-2 rounded-lg border border-gray-200 bg-white font-medium"
                    >
                      <option value="clean-4col">Clean 4-Column (Drexel / Bagkin)</option>
                      <option value="dark-instagram-grid">Dark + 6-Tile IG Grid (Storefront-01)</option>
                      <option value="minimal-single-row">Minimal Single Row (Minim)</option>
                    </select>
                  </div>
                </div>

                {/* 12. Social & Newsletter Variant */}
                <div>
                  <label className="block font-bold text-gray-800 mb-1">
                    12. Social & VIP Opt-In Section
                  </label>
                  <select
                    value={draftConfig.socialNewsletterVariant}
                    onChange={(e) =>
                      setDraftConfig((prev) => ({
                        ...prev,
                        socialNewsletterVariant: e.target.value as SocialNewsletterVariantId,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white font-medium"
                  >
                    <option value="dark-rounded-card">Dark Rounded Card &quot;Ready to Get Our New Stuff?&quot; (Stuffsus)</option>
                    <option value="instagram-strip-plus-minimal">6-Tile Shoppable Instagram Strip + Minimal Input (Bagkin)</option>
                    <option value="inline-fomo-bar">Inline &quot;Fear of missing out&quot; Bar (Kylie)</option>
                  </select>
                </div>

                {/* Section Visibility Toggles */}
                <div className="pt-3 border-t border-gray-200">
                  <p className="font-bold text-gray-800 mb-2">Toggle Section Visibility</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { key: "showAnnouncementBar", label: "Top Announcement Bar" },
                        { key: "showTrustStrip", label: "Trust & Value Strip" },
                        { key: "showCategoryBento", label: "Category Bento Mosaic" },
                        { key: "showFeaturedCarousel", label: "Featured / Recs Row" },
                        { key: "showPromoDeal", label: "Flash Deal / Promo" },
                        { key: "showBrandStory", label: "About / Brand Story" },
                        { key: "showTestimonials", label: "Customer Reviews" },
                        { key: "showSocialNewsletter", label: "Instagram & VIP Club" },
                      ] as const
                    ).map((item) => (
                      <label
                        key={item.key}
                        className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={draftConfig.visibility[item.key]}
                          onChange={(e) =>
                            setDraftConfig((prev) => ({
                              ...prev,
                              visibility: {
                                ...prev.visibility,
                                [item.key]: e.target.checked,
                              },
                            }))
                          }
                          className="rounded border-gray-300"
                        />
                        <span className="text-[11px] font-medium text-gray-700 truncate">
                          {item.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ===============================================================
                TAB 3: THEME TOKENS (FONTS, SURFACE, ACCENT COLOR, GEOMETRY)
               =============================================================== */}
            {activeTab === "theme" && (
              <div className="space-y-5 text-xs">
                {/* Font Pairing */}
                <div>
                  <label className="block font-bold text-gray-800 mb-2">
                    Typography Pairing
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { id: "editorial-serif", label: "Editorial Serif", sample: "Jenahara / Bagkin" },
                        { id: "modern-sans", label: "Modern Clean Sans", sample: "Guza / Stuffsus" },
                        { id: "street-geometric", label: "Street Uppercase", sample: "Kylie / Constructor" },
                        { id: "luxury-warm", label: "Warm Botanical", sample: "Glowing / Funio" },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            theme: { ...prev.theme, fontPairing: f.id as FontPairingId },
                          }))
                        }
                        className={`p-3 rounded-xl border text-left cursor-pointer ${
                          draftConfig.theme.fontPairing === f.id
                            ? "border-gray-900 bg-gray-50 font-bold"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="text-xs font-bold text-gray-900">{f.label}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{f.sample}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Surface Palette Mode */}
                <div>
                  <label className="block font-bold text-gray-800 mb-2">
                    Page Surface Palette
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { id: "light", label: "Crisp Studio White", bg: "#FFFFFF" },
                        { id: "warm-cream", label: "Warm Alabaster Cream", bg: "#FAF8F5" },
                        { id: "soft-sage", label: "Botanical Sage Mist", bg: "#F4F8F5" },
                        { id: "dark-luxury", label: "Obsidian Dark Luxury", bg: "#141519" },
                      ] as const
                    ).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            theme: { ...prev.theme, surfaceMode: s.id as SurfaceModeId },
                          }))
                        }
                        className={`p-2.5 rounded-xl border flex items-center gap-2.5 text-left cursor-pointer ${
                          draftConfig.theme.surfaceMode === s.id
                            ? "border-gray-900 bg-gray-50 font-bold"
                            : "border-gray-200"
                        }`}
                      >
                        <span
                          className="w-5 h-5 rounded-full border border-gray-300 shrink-0"
                          style={{ backgroundColor: s.bg }}
                        />
                        <span className="text-[11px] text-gray-800 truncate">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Brand Accent Color */}
                <div>
                  <label className="block font-bold text-gray-800 mb-2">
                    Brand Primary Accent Color
                  </label>
                  <div className="flex flex-wrap items-center gap-2.5 mb-2.5">
                    {ACCENT_COLOR_SWATCHES.map((swatch) => {
                      const isSelected =
                        draftConfig.theme.accentColor.toLowerCase() === swatch.hex.toLowerCase();
                      return (
                        <button
                          key={swatch.hex}
                          type="button"
                          title={swatch.label}
                          onClick={() =>
                            setDraftConfig((prev) => ({
                              ...prev,
                              theme: { ...prev.theme, accentColor: swatch.hex },
                            }))
                          }
                          className={`w-7 h-7 rounded-full border transition-transform cursor-pointer ${
                            isSelected ? "scale-115 ring-2 ring-offset-2 ring-gray-900" : ""
                          }`}
                          style={{ backgroundColor: swatch.hex }}
                        />
                      );
                    })}
                    <input
                      type="color"
                      value={draftConfig.theme.accentColor}
                      onChange={(e) =>
                        setDraftConfig((prev) => ({
                          ...prev,
                          theme: { ...prev.theme, accentColor: e.target.value },
                        }))
                      }
                      className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200"
                      title="Custom Hex Color"
                    />
                  </div>
                </div>

                {/* Corner Radius Geometry */}
                <div>
                  <label className="block font-bold text-gray-800 mb-2">
                    Corner Radius & Button Geometry
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(
                      [
                        { id: "sharp", label: "Sharp 0px" },
                        { id: "soft", label: "Soft 8px" },
                        { id: "rounded", label: "Round 16px" },
                        { id: "pill", label: "Pill 24px" },
                      ] as const
                    ).map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            theme: { ...prev.theme, borderRadius: r.id as BorderRadiusToken },
                          }))
                        }
                        className={`py-2 px-2 rounded-lg border text-center text-[11px] font-semibold cursor-pointer ${
                          draftConfig.theme.borderRadius === r.id
                            ? "bg-gray-900 text-white border-gray-900"
                            : "bg-white text-gray-700 border-gray-200"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Product Card Image Backdrop */}
                <div>
                  <label className="block font-bold text-gray-800 mb-2">
                    Product Card Studio Backdrop
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { id: "studio-gray", label: "Studio Neutral Gray" },
                        { id: "pastel-tint", label: "Multi-Color Pastel Tints" },
                        { id: "pure-white", label: "Pure Crisp White" },
                        { id: "warm-sand", label: "Editorial Warm Sand" },
                      ] as const
                    ).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            theme: { ...prev.theme, cardTone: t.id as CardToneToken },
                          }))
                        }
                        className={`py-2 px-3 rounded-lg border text-left text-[11px] font-semibold cursor-pointer ${
                          draftConfig.theme.cardTone === t.id
                            ? "border-gray-900 bg-gray-50 font-bold"
                            : "border-gray-200"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ===============================================================
                TAB 4: COPY, HEADLINES & HERO IMAGE
               =============================================================== */}
            {activeTab === "copy" && (
              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Top Announcement Bar Text
                  </label>
                  <input
                    type="text"
                    value={draftConfig.copy.announcementText}
                    onChange={(e) =>
                      setDraftConfig((prev) => ({
                        ...prev,
                        copy: { ...prev.copy, announcementText: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Hero Overline / Subtitle
                  </label>
                  <input
                    type="text"
                    value={draftConfig.copy.heroSubtitle}
                    onChange={(e) =>
                      setDraftConfig((prev) => ({
                        ...prev,
                        copy: { ...prev.copy, heroSubtitle: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Hero Display Headline
                  </label>
                  <input
                    type="text"
                    value={draftConfig.copy.heroTitle}
                    onChange={(e) =>
                      setDraftConfig((prev) => ({
                        ...prev,
                        copy: { ...prev.copy, heroTitle: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Hero Description
                  </label>
                  <textarea
                    rows={2}
                    value={draftConfig.copy.heroDescription}
                    onChange={(e) =>
                      setDraftConfig((prev) => ({
                        ...prev,
                        copy: { ...prev.copy, heroDescription: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Primary CTA Label
                    </label>
                    <input
                      type="text"
                      value={draftConfig.copy.heroPrimaryCta}
                      onChange={(e) =>
                        setDraftConfig((prev) => ({
                          ...prev,
                          copy: { ...prev.copy, heroPrimaryCta: e.target.value },
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-200"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Secondary CTA Label
                    </label>
                    <input
                      type="text"
                      value={draftConfig.copy.heroSecondaryCta}
                      onChange={(e) =>
                        setDraftConfig((prev) => ({
                          ...prev,
                          copy: { ...prev.copy, heroSecondaryCta: e.target.value },
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Hero Banner Image URL
                  </label>
                  <input
                    type="url"
                    value={draftConfig.copy.heroImageUrl ?? ""}
                    onChange={(e) =>
                      setDraftConfig((prev) => ({
                        ...prev,
                        copy: { ...prev.copy, heroImageUrl: e.target.value },
                      }))
                    }
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3 py-2 rounded-lg border border-gray-200"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Flash Deal / Promo Headline
                  </label>
                  <input
                    type="text"
                    value={draftConfig.copy.dealHeadline}
                    onChange={(e) =>
                      setDraftConfig((prev) => ({
                        ...prev,
                        copy: { ...prev.copy, dealHeadline: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Brand Story Headline
                  </label>
                  <input
                    type="text"
                    value={draftConfig.copy.storyHeadline}
                    onChange={(e) =>
                      setDraftConfig((prev) => ({
                        ...prev,
                        copy: { ...prev.copy, storyHeadline: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Newsletter / VIP Club Headline
                  </label>
                  <input
                    type="text"
                    value={draftConfig.copy.newsletterHeadline}
                    onChange={(e) =>
                      setDraftConfig((prev) => ({
                        ...prev,
                        copy: { ...prev.copy, newsletterHeadline: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT LIVE INTERACTIVE CANVAS */}
        <div className="xl:col-span-8 flex flex-col items-center">
          <div
            className={`w-full transition-all duration-300 bg-white border border-gray-300 rounded-2xl shadow-xl overflow-hidden ${
              viewport === "mobile" ? "max-w-[410px]" : "w-full"
            }`}
          >
            {/* Browser Chrome Mock Bar */}
            <div className="bg-gray-100 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              </div>

              <div className="flex-1 max-w-md mx-auto px-3 py-1 rounded-md bg-white border border-gray-200 text-[11px] font-mono text-gray-600 truncate text-center">
                {effectivePreviewConfig.mode === "FULL_WEBSITE"
                  ? `https://${state.vendor.slug}.caterlog.shop`
                  : `https://caterlog.shop/store/${state.vendor.slug}`}
              </div>

              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-xs bg-gray-200 text-gray-700">
                {effectivePreviewConfig.mode === "FULL_WEBSITE"
                  ? "Full Website"
                  : "Storefront"}
              </span>
            </div>

            {/* Embedded Live StorefrontRenderer (100% same component as /store/[slug]) */}
            <div className="max-h-[800px] overflow-y-auto">
              <StorefrontRenderer
                vendor={{
                  id: state.vendor.id,
                  slug: state.vendor.slug,
                  businessName: state.vendor.businessName,
                  whatsappPhone: state.vendor.whatsappPhone,
                  verificationStatus: state.vendor.verificationStatus,
                  cacNumber: state.vendor.cacNumber,
                  instagramHandle: state.vendor.instagramHandle,
                  baseState: state.vendor.baseState,
                  baseCity: state.vendor.baseCity,
                  reservationTtlMinutes: state.vendor.reservationTtlMinutes,
                }}
                products={state.products}
                shippingZones={state.shippingZones}
                discounts={state.discounts}
                config={effectivePreviewConfig}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
