"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { PlatformRole, VendorState } from "@/lib/types";
import {
  canUseFullWebsiteMode,
  getStorefrontPresetById,
  resolveVendorStorefrontConfig,
  STOREFRONT_PRESETS,
  StorefrontRenderer,
  type BorderRadiusToken,
  type CardToneToken,
  type FontPairingId,
  type SectionHeadingStyleId,
  type StorefrontActivePage,
  type StorefrontConfig,
  type StudioSectionId,
  type SurfaceModeId,
} from "@caterlog/storefront-blocks";

interface StorefrontViewProps {
  state: VendorState;
  activeWorkspace: PlatformRole;
  onStateChange: (nextState: VendorState) => void;
  onNavigateToPlans?: () => void;
}

type StudioTab = "sections" | "presets" | "theme";

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

  const [studioTab, setStudioTab] = useState<StudioTab>("sections");
  const [activeSection, setActiveSection] = useState<StudioSectionId>("hero");
  const [activePreviewPage, setActivePreviewPage] = useState<StorefrontActivePage>(
    isFullWebsiteEligible ? "home" : "shop"
  );
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [previewFullWebsiteAsStarter, setPreviewFullWebsiteAsStarter] = useState(false);

  const [syncState, setSyncState] = useState<"synced" | "syncing" | "saved">("synced");
  const [copiedUrl, setCopiedUrl] = useState(false);
  const isInitialMount = useRef(true);

  useEffect(() => {
    setDraftConfig((prev) => {
      const nextEligible = canUseFullWebsiteMode(activeWorkspace);
      const currentPreset = getStorefrontPresetById(prev.presetId);
      if (!nextEligible && prev.mode === "FULL_WEBSITE") {
        const starterPreset =
          currentPreset.recommendedTier === "STARTER_RESELLER"
            ? currentPreset.config
            : getStorefrontPresetById("stuffsus-shop").config;
        setActivePreviewPage("shop");
        setActiveSection("shop-banner");
        return {
          ...starterPreset,
          mode: "STOREFRONT_ONLY",
        };
      }
      if (
        nextEligible &&
        prev.mode === "STOREFRONT_ONLY" &&
        currentPreset.recommendedTier === "STARTER_RESELLER"
      ) {
        const growthPreset = getStorefrontPresetById("jenahara-editorial").config;
        setActivePreviewPage("home");
        setActiveSection("hero");
        return {
          ...growthPreset,
          mode: "FULL_WEBSITE",
        };
      }
      return prev;
    });
  }, [activeWorkspace]);

  const effectivePreviewConfig: StorefrontConfig = {
    ...draftConfig,
    mode: isFullWebsiteEligible
      ? draftConfig.mode
      : previewFullWebsiteAsStarter
        ? "FULL_WEBSITE"
        : "STOREFRONT_ONLY",
  };

  // Real-time BroadcastChannel + Debounced Backend Auto-Save so the Storefront App updates without reloading
  useEffect(() => {
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      const bc = new BroadcastChannel("caterlog_realtime_sync");
      bc.postMessage({
        type: "STOREFRONT_CONFIG_DRAFT",
        config: effectivePreviewConfig,
      });
      bc.close();
    }

    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    setSyncState("syncing");
    const timer = setTimeout(async () => {
      try {
        const res = await api.saveStorefrontConfig(draftConfig, activeWorkspace);
        onStateChange(res.state);
        setSyncState("saved");
      } catch {
        setSyncState("synced");
      }
    }, 550);

    return () => clearTimeout(timer);
  }, [draftConfig, activeWorkspace]);

  const slug = encodeURIComponent(state.vendor.slug || "store");
  const tierParam = effectivePreviewConfig.mode === "FULL_WEBSITE" ? "GROWTH" : "STARTER";
  const standaloneStorefrontUrl =
    typeof window !== "undefined"
      ? `http://${window.location.hostname}:3001/${slug}?tier=${tierParam}`
      : `http://localhost:3001/${slug}?tier=${tierParam}`;

  const handleApplyPreset = (presetId: string) => {
    const preset = getStorefrontPresetById(presetId);
    const shouldPreviewFull =
      !isFullWebsiteEligible && preset.recommendedTier === "GROWTH_PRO";
    if (shouldPreviewFull) {
      setPreviewFullWebsiteAsStarter(true);
    }
    const nextMode = isFullWebsiteEligible
      ? preset.config.mode
      : shouldPreviewFull
        ? "FULL_WEBSITE"
        : "STOREFRONT_ONLY";
    setDraftConfig({
      ...preset.config,
      mode: nextMode,
    });
    setActivePreviewPage(nextMode === "FULL_WEBSITE" ? "home" : "shop");
  };

  const handleManualPublish = async () => {
    setSyncState("syncing");
    try {
      const res = await api.saveStorefrontConfig(draftConfig, activeWorkspace);
      onStateChange(res.state);
      setSyncState("saved");
    } catch {
      setSyncState("synced");
    }
  };

  const handleCopyLink = () => {
    if (typeof window !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(standaloneStorefrontUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    }
  };

  const handleSelectSectionFromCanvas = (secId: StudioSectionId) => {
    setStudioTab("sections");
    setActiveSection(secId);
    if (inspectorCollapsed) setInspectorCollapsed(false);
  };

  const starterPresets = STOREFRONT_PRESETS.filter(
    (p) => p.recommendedTier === "STARTER_RESELLER"
  );
  const growthProPresets = STOREFRONT_PRESETS.filter(
    (p) => p.recommendedTier === "GROWTH_PRO"
  );

  // Reusable Visual Variant Option Card for the Inspector
  const VariantOptionCard = ({
    selected,
    title,
    subtitle,
    badge,
    onClick,
  }: {
    selected: boolean;
    title: string;
    subtitle: string;
    badge?: string;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
        selected
          ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600"
          : "border-gray-200 hover:border-gray-300 bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-gray-900">{title}</span>
        {badge && (
          <span
            className={`px-2 py-0.5 rounded-xs text-[10px] font-semibold ${
              selected ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            {badge}
          </span>
        )}
      </div>
      <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{subtitle}</p>
    </button>
  );

  const sectionTree: Array<{
    id: StudioSectionId;
    title: string;
    badge: string;
    visibilityKey?: keyof StorefrontConfig["visibility"];
    fullWebsiteOnly?: boolean;
  }> = [
    {
      id: "header",
      title: "Navigation Header",
      badge: draftConfig.headerVariant,
    },
    ...(effectivePreviewConfig.mode === "FULL_WEBSITE"
      ? [
          {
            id: "hero" as StudioSectionId,
            title: "Brand Hero Header",
            badge: draftConfig.heroVariant,
          },
        ]
      : []),
    {
      id: "shop-banner",
      title: "Catalog / Shop Banner",
      badge: draftConfig.shopBannerVariant,
    },
    {
      id: "catalog",
      title: "Product Cards & Filters",
      badge: draftConfig.productCardVariant,
    },
    {
      id: "trust-strip",
      title: "Trust & Value Strip",
      badge: draftConfig.trustStripVariant,
      visibilityKey: "showTrustStrip",
    },
    ...(effectivePreviewConfig.mode === "FULL_WEBSITE"
      ? [
          {
            id: "category-bento" as StudioSectionId,
            title: "Category Bento Mosaic",
            badge: draftConfig.categoryBentoVariant,
            visibilityKey: "showCategoryBento" as const,
            fullWebsiteOnly: true,
          },
          {
            id: "promo-deal" as StudioSectionId,
            title: "Flash Deal & Countdown",
            badge: draftConfig.promoDealVariant,
            visibilityKey: "showPromoDeal" as const,
            fullWebsiteOnly: true,
          },
          {
            id: "brand-story" as StudioSectionId,
            title: "Brand Story & Stats",
            badge: "split-story",
            visibilityKey: "showBrandStory" as const,
            fullWebsiteOnly: true,
          },
          {
            id: "testimonials" as StudioSectionId,
            title: "Reviews & Press Quotes",
            badge: draftConfig.testimonialsVariant,
            visibilityKey: "showTestimonials" as const,
            fullWebsiteOnly: true,
          },
        ]
      : []),
    {
      id: "newsletter",
      title: "Instagram & Newsletter",
      badge: draftConfig.socialNewsletterVariant,
      visibilityKey: "showSocialNewsletter",
    },
    {
      id: "footer",
      title: "Website Footer",
      badge: draftConfig.footerVariant,
    },
  ];

  return (
    <div className="space-y-4">
      {/* 1. STUDIO TOP COMMAND BAR */}
      <div className="bg-white border border-gray-200 rounded-2xl p-3.5 sm:px-5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setInspectorCollapsed((prev) => !prev)}
            className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
            title="Toggle Left Inspector"
          >
            {inspectorCollapsed ? "▸ Show Studio Panel" : "◂ Full Canvas"}
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-extrabold text-gray-900">
                Website & Storefront Studio
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  syncState === "syncing"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    syncState === "syncing" ? "bg-amber-500 animate-ping" : "bg-emerald-500"
                  }`}
                />
                {syncState === "syncing" ? "Syncing Live..." : "Realtime Sync Active"}
              </span>
            </div>
          </div>
        </div>

        {/* Center Page Preview Switcher */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
          {(effectivePreviewConfig.mode === "FULL_WEBSITE"
            ? ([
                { id: "home", label: "Home" },
                { id: "shop", label: "Shop" },
                { id: "collections", label: "Lookbook" },
                { id: "about", label: "Story" },
                { id: "checkout", label: "Checkout" },
                { id: "track", label: "Tracker" },
              ] as const)
            : ([
                { id: "shop", label: "Catalog" },
                { id: "checkout", label: "Checkout" },
                { id: "track", label: "Tracker" },
              ] as const)
          ).map((pg) => (
            <button
              key={pg.id}
              type="button"
              onClick={() => setActivePreviewPage(pg.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activePreviewPage === pg.id
                  ? "bg-white text-gray-900 shadow-2xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {pg.label}
            </button>
          ))}
        </div>

        {/* Right Actions: Device Viewport + Copy Link + Open Standalone Storefront App */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center bg-gray-100 p-1 rounded-xl text-xs font-semibold">
            {(
              [
                { id: "desktop", icon: "💻", label: "Desktop" },
                { id: "tablet", icon: "📟", label: "Tablet" },
                { id: "mobile", icon: "📱", label: "Mobile" },
              ] as const
            ).map((vp) => (
              <button
                key={vp.id}
                type="button"
                onClick={() => setViewport(vp.id)}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 ${
                  viewport === vp.id
                    ? "bg-white text-gray-900 shadow-2xs font-bold"
                    : "text-gray-600 opacity-75 hover:opacity-100"
                }`}
                title={`${vp.label} view`}
              >
                <span>{vp.icon}</span>
                <span className="hidden md:inline text-[11px]">{vp.label}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleCopyLink}
            className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
          >
            {copiedUrl ? "✓ Copied" : "🔗 Copy URL"}
          </button>

          <a
            href={standaloneStorefrontUrl}
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold transition-colors"
          >
            ↗ Open Storefront (:3001)
          </a>

          <button
            type="button"
            onClick={handleManualPublish}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-gray-900 hover:bg-black text-white shadow-xs cursor-pointer"
          >
            Publish
          </button>
        </div>
      </div>

      {/* TIER BANNER FOR STARTER / DROPSHIPPER */}
      {!isFullWebsiteEligible && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs">
            <span className="inline-block px-2 py-0.5 rounded-xs bg-amber-400 text-slate-950 text-[10px] font-extrabold uppercase mr-2">
              {activeWorkspace === "reseller" ? "Dropshipper Plan" : "Starter Plan"}
            </span>
            <span className="font-semibold">
              {previewFullWebsiteAsStarter
                ? "Previewing Growth/Pro Full Brand Website Mode."
                : "Active in Catalog Storefront Mode. Upgrade to Growth or Pro to publish multi-page Full Brand Websites."}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setPreviewFullWebsiteAsStarter((prev) => {
                  const next = !prev;
                  setActivePreviewPage(next ? "home" : "shop");
                  return next;
                });
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/15 hover:bg-white/25 text-white cursor-pointer"
            >
              {previewFullWebsiteAsStarter
                ? "Back to Storefront Mode"
                : "✨ Preview Full Website"}
            </button>
            {onNavigateToPlans && (
              <button
                type="button"
                onClick={onNavigateToPlans}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer"
              >
                Upgrade →
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. STUDIO WORKSPACE: Left Visual Inspector + Right Interactive Canvas */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* LEFT VISUAL INSPECTOR */}
        {!inspectorCollapsed && (
          <div className="w-full lg:w-[320px] xl:w-[340px] shrink-0 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
            {/* 3 Clean Studio Tabs */}
            <div className="grid grid-cols-3 border-b border-gray-200 bg-gray-50/80 text-xs font-extrabold">
              {(
                [
                  { id: "sections", label: "🧩 Sections" },
                  { id: "presets", label: "🎨 Presets" },
                  { id: "theme", label: "✨ Theme" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setStudioTab(t.id)}
                  className={`py-3.5 text-center border-b-2 transition-all cursor-pointer ${
                    studioTab === t.id
                      ? "bg-white text-indigo-600 border-indigo-600"
                      : "text-gray-500 border-transparent hover:text-gray-800"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-4 max-h-[820px] overflow-y-auto space-y-3">
              {/* =============================================================
                  TAB 1: VISUAL PAGE SECTIONS & INLINE EDITOR
                 ============================================================= */}
              {studioTab === "sections" && (
                <div className="space-y-2.5">
                  <p className="text-[11px] text-gray-500 px-1">
                    Click any section below (or click directly on the live website preview) to switch its layout and edit its content.
                  </p>

                  {sectionTree.map((sec) => {
                    const isOpen = activeSection === sec.id;
                    const isVisible = sec.visibilityKey
                      ? draftConfig.visibility[sec.visibilityKey]
                      : true;

                    return (
                      <div
                        key={sec.id}
                        className={`rounded-xl border transition-all overflow-hidden ${
                          isOpen
                            ? "border-indigo-600 shadow-xs bg-white"
                            : "border-gray-200 bg-gray-50/60 hover:bg-white"
                        }`}
                      >
                        {/* Section Accordion Header */}
                        <div
                          onClick={() => setActiveSection(sec.id)}
                          className="px-3.5 py-3 flex items-center justify-between gap-2 cursor-pointer select-none"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                !isVisible
                                  ? "bg-gray-300"
                                  : isOpen
                                    ? "bg-indigo-600"
                                    : "bg-emerald-500"
                              }`}
                            />
                            <span className="text-xs font-extrabold text-gray-900 truncate">
                              {sec.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {sec.visibilityKey && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const key = sec.visibilityKey!;
                                  setDraftConfig((prev) => ({
                                    ...prev,
                                    visibility: {
                                      ...prev.visibility,
                                      [key]: !prev.visibility[key],
                                    },
                                  }));
                                }}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                                  isVisible
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-gray-200 text-gray-600"
                                }`}
                              >
                                {isVisible ? "Visible" : "Hidden"}
                              </button>
                            )}
                            <span className="text-xs text-gray-400">
                              {isOpen ? "▾" : "▸"}
                            </span>
                          </div>
                        </div>

                        {/* Section Expanded Visual Picker + Inline Copy Fields */}
                        {isOpen && (
                          <div className="p-3.5 pt-2 border-t border-gray-100 space-y-3 bg-white text-xs">
                            {/* 1. HEADER SECTION OPTIONS */}
                            {sec.id === "header" && (
                              <>
                                <div className="space-y-2">
                                  <VariantOptionCard
                                    selected={draftConfig.headerVariant === "minimal-inline"}
                                    title="Minimal Inline"
                                    subtitle="Brand left, navigation links center, search & bag right (Guza / Stuffsus)"
                                    badge="Clean"
                                    onClick={() =>
                                      setDraftConfig((p) => ({ ...p, headerVariant: "minimal-inline" }))
                                    }
                                  />
                                  <VariantOptionCard
                                    selected={draftConfig.headerVariant === "centered-editorial"}
                                    title="Centered Editorial Wordmark"
                                    subtitle="Navigation left, centered brand wordmark, utility icons right (Glowing / Bagkin)"
                                    badge="Editorial"
                                    onClick={() =>
                                      setDraftConfig((p) => ({
                                        ...p,
                                        headerVariant: "centered-editorial",
                                      }))
                                    }
                                  />
                                  <VariantOptionCard
                                    selected={draftConfig.headerVariant === "bordered-editorial"}
                                    title="Bordered Magazine Grid"
                                    subtitle="Architectural hairline grid dividing Brand, Navigation & Bag (Jenahara)"
                                    badge="Couture"
                                    onClick={() =>
                                      setDraftConfig((p) => ({
                                        ...p,
                                        headerVariant: "bordered-editorial",
                                      }))
                                    }
                                  />
                                  <VariantOptionCard
                                    selected={draftConfig.headerVariant === "stacked-boutique"}
                                    title="Stacked 2-Row Boutique"
                                    subtitle="Top row with search, framed logo & bag; second row with navigation links (SA)"
                                    badge="Boutique"
                                    onClick={() =>
                                      setDraftConfig((p) => ({
                                        ...p,
                                        headerVariant: "stacked-boutique",
                                      }))
                                    }
                                  />
                                </div>

                                <div className="pt-2 border-t border-gray-100 space-y-2">
                                  <label className="flex items-center justify-between font-bold text-gray-700">
                                    <span>Top Announcement Bar</span>
                                    <input
                                      type="checkbox"
                                      checked={draftConfig.visibility.showAnnouncementBar}
                                      onChange={(e) =>
                                        setDraftConfig((p) => ({
                                          ...p,
                                          visibility: {
                                            ...p.visibility,
                                            showAnnouncementBar: e.target.checked,
                                          },
                                        }))
                                      }
                                    />
                                  </label>
                                  <input
                                    type="text"
                                    value={draftConfig.copy.announcementText}
                                    onChange={(e) =>
                                      setDraftConfig((p) => ({
                                        ...p,
                                        copy: { ...p.copy, announcementText: e.target.value },
                                      }))
                                    }
                                    placeholder="Announcement text..."
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200"
                                  />
                                </div>
                              </>
                            )}

                            {/* 2. BRAND HERO HEADER OPTIONS */}
                            {sec.id === "hero" && (
                              <>
                                <div className="space-y-2">
                                  <VariantOptionCard
                                    selected={draftConfig.heroVariant === "split-studio"}
                                    title="50/50 Editorial Studio Split"
                                    subtitle="Badge pill, bold headline & dual CTAs left; framed lookbook portrait with floating product card right"
                                    badge="Nyture / Glowing"
                                    onClick={() =>
                                      setDraftConfig((p) => ({ ...p, heroVariant: "split-studio" }))
                                    }
                                  />
                                  <VariantOptionCard
                                    selected={draftConfig.heroVariant === "magazine-layered"}
                                    title="Magazine Cover Masthead"
                                    subtitle="Oversized serif masthead above 3-column editorial stage & central arched model frame"
                                    badge="Jenahara"
                                    onClick={() =>
                                      setDraftConfig((p) => ({
                                        ...p,
                                        heroVariant: "magazine-layered",
                                      }))
                                    }
                                  />
                                  <VariantOptionCard
                                    selected={draftConfig.heroVariant === "product-spotlight"}
                                    title="Product Spotlight + Stat Callouts"
                                    subtitle="Watermark 01 numeral, dual CTAs, feature columns & floating stat badges"
                                    badge="Homepage-01"
                                    onClick={() =>
                                      setDraftConfig((p) => ({
                                        ...p,
                                        heroVariant: "product-spotlight",
                                      }))
                                    }
                                  />
                                  <VariantOptionCard
                                    selected={draftConfig.heroVariant === "editorial-center-overlay"}
                                    title="Full-Bleed Cinema Center Overlay"
                                    subtitle="Full-width photography with vignette overlay, frosted badge & centered typography"
                                    badge="Bagkin / Kylie"
                                    onClick={() =>
                                      setDraftConfig((p) => ({
                                        ...p,
                                        heroVariant: "editorial-center-overlay",
                                      }))
                                    }
                                  />
                                  <VariantOptionCard
                                    selected={draftConfig.heroVariant === "dark-luxury"}
                                    title="Obsidian Dark Luxury Showcase"
                                    subtitle="High-contrast dark radial-lit hero with gold price badge & spotlight card"
                                    badge="Illuminate"
                                    onClick={() =>
                                      setDraftConfig((p) => ({ ...p, heroVariant: "dark-luxury" }))
                                    }
                                  />
                                  <VariantOptionCard
                                    selected={draftConfig.heroVariant === "script-overlap"}
                                    title="Script Accent Split"
                                    subtitle="Framed portrait left; decorative italic script accent above bold display title right"
                                    badge="Orgamic"
                                    onClick={() =>
                                      setDraftConfig((p) => ({
                                        ...p,
                                        heroVariant: "script-overlap",
                                      }))
                                    }
                                  />
                                </div>

                                <div className="pt-2 border-t border-gray-100 space-y-2.5">
                                  <div>
                                    <label className="block font-bold text-gray-700 mb-1">
                                      Eyebrow / Subtitle
                                    </label>
                                    <input
                                      type="text"
                                      value={draftConfig.copy.heroSubtitle}
                                      onChange={(e) =>
                                        setDraftConfig((p) => ({
                                          ...p,
                                          copy: { ...p.copy, heroSubtitle: e.target.value },
                                        }))
                                      }
                                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200"
                                    />
                                  </div>
                                  <div>
                                    <label className="block font-bold text-gray-700 mb-1">
                                      Main Hero Headline
                                    </label>
                                    <input
                                      type="text"
                                      value={draftConfig.copy.heroTitle}
                                      onChange={(e) =>
                                        setDraftConfig((p) => ({
                                          ...p,
                                          copy: { ...p.copy, heroTitle: e.target.value },
                                        }))
                                      }
                                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 font-bold"
                                    />
                                  </div>
                                  <div>
                                    <label className="block font-bold text-gray-700 mb-1">
                                      Hero Subcopy
                                    </label>
                                    <textarea
                                      rows={2}
                                      value={draftConfig.copy.heroDescription}
                                      onChange={(e) =>
                                        setDraftConfig((p) => ({
                                          ...p,
                                          copy: { ...p.copy, heroDescription: e.target.value },
                                        }))
                                      }
                                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200"
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block font-bold text-gray-700 mb-1">
                                        Primary Button
                                      </label>
                                      <input
                                        type="text"
                                        value={draftConfig.copy.heroPrimaryCta}
                                        onChange={(e) =>
                                          setDraftConfig((p) => ({
                                            ...p,
                                            copy: { ...p.copy, heroPrimaryCta: e.target.value },
                                          }))
                                        }
                                        className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200"
                                      />
                                    </div>
                                    <div>
                                      <label className="block font-bold text-gray-700 mb-1">
                                        Secondary Button
                                      </label>
                                      <input
                                        type="text"
                                        value={draftConfig.copy.heroSecondaryCta}
                                        onChange={(e) =>
                                          setDraftConfig((p) => ({
                                            ...p,
                                            copy: { ...p.copy, heroSecondaryCta: e.target.value },
                                          }))
                                        }
                                        className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200"
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
                                        setDraftConfig((p) => ({
                                          ...p,
                                          copy: { ...p.copy, heroImageUrl: e.target.value },
                                        }))
                                      }
                                      placeholder="https://images.unsplash.com/..."
                                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200"
                                    />
                                  </div>
                                </div>
                              </>
                            )}

                            {/* 3. SHOP BANNER OPTIONS */}
                            {sec.id === "shop-banner" && (
                              <div className="space-y-2">
                                <VariantOptionCard
                                  selected={draftConfig.shopBannerVariant === "overlap-typographic"}
                                  title="Typographic Overlap + Docked Search"
                                  subtitle="Oversized display title over photo with floating search card docked at bottom"
                                  badge="Shoppage-01"
                                  onClick={() =>
                                    setDraftConfig((p) => ({
                                      ...p,
                                      shopBannerVariant: "overlap-typographic",
                                    }))
                                  }
                                />
                                <VariantOptionCard
                                  selected={draftConfig.shopBannerVariant === "curved-arch"}
                                  title="Curved Arch + Straddling Pill CTA"
                                  subtitle="Curved bottom-edge banner with floating white pill button straddling the seam"
                                  badge="Shoppage-03"
                                  onClick={() =>
                                    setDraftConfig((p) => ({
                                      ...p,
                                      shopBannerVariant: "curved-arch",
                                    }))
                                  }
                                />
                                <VariantOptionCard
                                  selected={draftConfig.shopBannerVariant === "split-breadcrumb"}
                                  title="Split Breadcrumb + Product Cards"
                                  subtitle="Page title & breadcrumb left; interactive product showcase cards right"
                                  badge="Guza"
                                  onClick={() =>
                                    setDraftConfig((p) => ({
                                      ...p,
                                      shopBannerVariant: "split-breadcrumb",
                                    }))
                                  }
                                />
                                <VariantOptionCard
                                  selected={draftConfig.shopBannerVariant === "minimal-rack"}
                                  title="Full-Bleed Studio Rack"
                                  subtitle="Warm full-width product photography with bottom-left caption"
                                  badge="Ugmonk"
                                  onClick={() =>
                                    setDraftConfig((p) => ({
                                      ...p,
                                      shopBannerVariant: "minimal-rack",
                                    }))
                                  }
                                />
                                <VariantOptionCard
                                  selected={draftConfig.shopBannerVariant === "promo-box"}
                                  title="Architectural Muted Promo Box"
                                  subtitle="Clean bordered promo header box above catalog grid"
                                  badge="Drexel"
                                  onClick={() =>
                                    setDraftConfig((p) => ({
                                      ...p,
                                      shopBannerVariant: "promo-box",
                                    }))
                                  }
                                />
                              </div>
                            )}

                            {/* 4. PRODUCT CARDS & CATALOG FILTER OPTIONS */}
                            {sec.id === "catalog" && (
                              <div className="space-y-3">
                                <p className="font-bold text-gray-700">Product Card Design</p>
                                <div className="space-y-2">
                                  <VariantOptionCard
                                    selected={
                                      draftConfig.productCardVariant === "dual-action-rounded"
                                    }
                                    title="Dual Action Pills: [Add to Bag] + [Buy Now]"
                                    subtitle="Rounded studio frame, category pill, star reviews & dual bottom CTA pills"
                                    badge="Stuffsus"
                                    onClick={() =>
                                      setDraftConfig((p) => ({
                                        ...p,
                                        productCardVariant: "dual-action-rounded",
                                      }))
                                    }
                                  />
                                  <VariantOptionCard
                                    selected={
                                      draftConfig.productCardVariant === "pastel-floating-cart"
                                    }
                                    title="Pastel Backdrop + Floating Circle Bag Button"
                                    subtitle="Soft pastel tinted card top with floating circular cart button on seam"
                                    badge="Constructor"
                                    onClick={() =>
                                      setDraftConfig((p) => ({
                                        ...p,
                                        productCardVariant: "pastel-floating-cart",
                                      }))
                                    }
                                  />
                                  <VariantOptionCard
                                    selected={
                                      draftConfig.productCardVariant ===
                                      "lookbook-gradient-overlay"
                                    }
                                    title="Tall 3:4 Lookbook Gradient Overlay"
                                    subtitle="Full-bleed portrait photo with title, price & bag icon inside bottom fade"
                                    badge="Jenahara"
                                    onClick={() =>
                                      setDraftConfig((p) => ({
                                        ...p,
                                        productCardVariant: "lookbook-gradient-overlay",
                                      }))
                                    }
                                  />
                                  <VariantOptionCard
                                    selected={
                                      draftConfig.productCardVariant === "minimal-swatch-studio"
                                    }
                                    title="Minimal Studio + Interactive Color Swatches"
                                    subtitle="Clean 4:5 studio portrait, hover quick-add & clickable color dots below"
                                    badge="Guza / Bagkin"
                                    onClick={() =>
                                      setDraftConfig((p) => ({
                                        ...p,
                                        productCardVariant: "minimal-swatch-studio",
                                      }))
                                    }
                                  />
                                  <VariantOptionCard
                                    selected={draftConfig.productCardVariant === "boutique-badged"}
                                    title="Boutique Badged (HOT / -15% / NEW)"
                                    subtitle="Corner promo tags, star rating, compare-at price & centered CTA"
                                    badge="Drexel / Glowing"
                                    onClick={() =>
                                      setDraftConfig((p) => ({
                                        ...p,
                                        productCardVariant: "boutique-badged",
                                      }))
                                    }
                                  />
                                </div>

                                <div className="pt-2 border-t border-gray-100 space-y-2">
                                  <p className="font-bold text-gray-700">Filter & Toolbar Layout</p>
                                  <VariantOptionCard
                                    selected={draftConfig.filterLayoutVariant === "sidebar-full"}
                                    title="Left Sidebar Filters"
                                    subtitle="Categories with counts, Price tiers, Color circles & Size matrix grid"
                                    onClick={() =>
                                      setDraftConfig((p) => ({
                                        ...p,
                                        filterLayoutVariant: "sidebar-full",
                                      }))
                                    }
                                  />
                                  <VariantOptionCard
                                    selected={
                                      draftConfig.filterLayoutVariant === "horizontal-popover-bar"
                                    }
                                    title="Top Popover Bar + 2/3/4 Column Switcher"
                                    subtitle="Horizontal filter dropdowns + sort + grid column density toggle"
                                    onClick={() =>
                                      setDraftConfig((p) => ({
                                        ...p,
                                        filterLayoutVariant: "horizontal-popover-bar",
                                      }))
                                    }
                                  />
                                  <VariantOptionCard
                                    selected={
                                      draftConfig.filterLayoutVariant === "centered-category-tabs"
                                    }
                                    title="Centered Category Tabs"
                                    subtitle="Minimal pill/underline category tabs above product grid"
                                    onClick={() =>
                                      setDraftConfig((p) => ({
                                        ...p,
                                        filterLayoutVariant: "centered-category-tabs",
                                      }))
                                    }
                                  />
                                </div>
                              </div>
                            )}

                            {/* 5. TRUST STRIP OPTIONS */}
                            {sec.id === "trust-strip" && (
                              <div className="space-y-2">
                                <VariantOptionCard
                                  selected={
                                    draftConfig.trustStripVariant === "4-col-horizontal-icons"
                                  }
                                  title="4-Column Horizontal Value Strip"
                                  subtitle="Compact icon + title + subtitle row (Dispatch, CAC Verified, Stock Lock, Escrow)"
                                  badge="Luxora"
                                  onClick={() =>
                                    setDraftConfig((p) => ({
                                      ...p,
                                      trustStripVariant: "4-col-horizontal-icons",
                                    }))
                                  }
                                />
                                <VariantOptionCard
                                  selected={
                                    draftConfig.trustStripVariant === "3-col-feature-cards"
                                  }
                                  title="3-Column 'Why Choose Us?' Feature Grid"
                                  subtitle="Large centered circular icons with editorial value pillars"
                                  badge="Homepage-01"
                                  onClick={() =>
                                    setDraftConfig((p) => ({
                                      ...p,
                                      trustStripVariant: "3-col-feature-cards",
                                    }))
                                  }
                                />
                                <VariantOptionCard
                                  selected={
                                    draftConfig.trustStripVariant === "authentic-stamp-strip"
                                  }
                                  title="Authenticity Stamp Strip"
                                  subtitle="Bordered vintage authenticity badges row"
                                  badge="Kylie"
                                  onClick={() =>
                                    setDraftConfig((p) => ({
                                      ...p,
                                      trustStripVariant: "authentic-stamp-strip",
                                    }))
                                  }
                                />
                              </div>
                            )}

                            {/* 6. CATEGORY BENTO MOSAIC OPTIONS */}
                            {sec.id === "category-bento" && (
                              <div className="space-y-2">
                                <VariantOptionCard
                                  selected={
                                    draftConfig.categoryBentoVariant === "4-tile-left-tall"
                                  }
                                  title="4-Tile Left Tall Showcase"
                                  subtitle="1 tall vertical feature left + 1 wide top-right + 2 square bottom-right"
                                  badge="Bagkin"
                                  onClick={() =>
                                    setDraftConfig((p) => ({
                                      ...p,
                                      categoryBentoVariant: "4-tile-left-tall",
                                    }))
                                  }
                                />
                                <VariantOptionCard
                                  selected={
                                    draftConfig.categoryBentoVariant === "4-tile-right-tall"
                                  }
                                  title="4-Tile Right Tall Lookbook Edit"
                                  subtitle="Editorial title card & 3 portrait tiles left + 1 tall lookbook tile right"
                                  badge="Nyture"
                                  onClick={() =>
                                    setDraftConfig((p) => ({
                                      ...p,
                                      categoryBentoVariant: "4-tile-right-tall",
                                    }))
                                  }
                                />
                                <VariantOptionCard
                                  selected={
                                    draftConfig.categoryBentoVariant === "6-tile-editorial-mosaic"
                                  }
                                  title="6-Tile Pastel Editorial Mosaic"
                                  subtitle="2 stacked pastel banners + 1 large square + 3 asymmetric bottom cards"
                                  badge="Kylie"
                                  onClick={() =>
                                    setDraftConfig((p) => ({
                                      ...p,
                                      categoryBentoVariant: "6-tile-editorial-mosaic",
                                    }))
                                  }
                                />
                                <VariantOptionCard
                                  selected={
                                    draftConfig.categoryBentoVariant === "2-col-split-banners"
                                  }
                                  title="2-Column Split Collection Cards"
                                  subtitle="Two wide side-by-side landscape collection banners"
                                  badge="Funio / Glowing"
                                  onClick={() =>
                                    setDraftConfig((p) => ({
                                      ...p,
                                      categoryBentoVariant: "2-col-split-banners",
                                    }))
                                  }
                                />
                                <VariantOptionCard
                                  selected={draftConfig.categoryBentoVariant === "thumbnail-strip"}
                                  title="5-Column Category Thumbnail Strip"
                                  subtitle="Clean row of 5 square category thumbnails with item counts"
                                  badge="Top Categories"
                                  onClick={() =>
                                    setDraftConfig((p) => ({
                                      ...p,
                                      categoryBentoVariant: "thumbnail-strip",
                                    }))
                                  }
                                />
                              </div>
                            )}

                            {/* 7. PROMO DEAL & COUNTDOWN OPTIONS */}
                            {sec.id === "promo-deal" && (
                              <div className="space-y-2.5">
                                <VariantOptionCard
                                  selected={draftConfig.promoDealVariant === "countdown-banner"}
                                  title="Full-Width Flash Deal Countdown"
                                  subtitle="Frosted glass Days : Hours : Mins : Sec timer tied to active discounts"
                                  badge="Bagkin"
                                  onClick={() =>
                                    setDraftConfig((p) => ({
                                      ...p,
                                      promoDealVariant: "countdown-banner",
                                    }))
                                  }
                                />
                                <VariantOptionCard
                                  selected={draftConfig.promoDealVariant === "split-story-stats"}
                                  title="Split Editorial Promo + Stat Card"
                                  subtitle="Image with floating stat badge left + story headline & CTA right"
                                  badge="Homepage-01"
                                  onClick={() =>
                                    setDraftConfig((p) => ({
                                      ...p,
                                      promoDealVariant: "split-story-stats",
                                    }))
                                  }
                                />
                                <div>
                                  <label className="block font-bold text-gray-700 mb-1">
                                    Promo / Deal Headline
                                  </label>
                                  <input
                                    type="text"
                                    value={draftConfig.copy.dealHeadline}
                                    onChange={(e) =>
                                      setDraftConfig((p) => ({
                                        ...p,
                                        copy: { ...p.copy, dealHeadline: e.target.value },
                                      }))
                                    }
                                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200"
                                  />
                                </div>
                              </div>
                            )}

                            {/* 8. BRAND STORY OPTIONS */}
                            {sec.id === "brand-story" && (
                              <div className="space-y-2.5">
                                <div>
                                  <label className="block font-bold text-gray-700 mb-1">
                                    Story Headline
                                  </label>
                                  <input
                                    type="text"
                                    value={draftConfig.copy.storyHeadline}
                                    onChange={(e) =>
                                      setDraftConfig((p) => ({
                                        ...p,
                                        copy: { ...p.copy, storyHeadline: e.target.value },
                                      }))
                                    }
                                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200"
                                  />
                                </div>
                                <div>
                                  <label className="block font-bold text-gray-700 mb-1">
                                    Story Description
                                  </label>
                                  <textarea
                                    rows={2}
                                    value={draftConfig.copy.storyDescription}
                                    onChange={(e) =>
                                      setDraftConfig((p) => ({
                                        ...p,
                                        copy: { ...p.copy, storyDescription: e.target.value },
                                      }))
                                    }
                                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block font-bold text-gray-700 mb-1">
                                      Stat Highlight
                                    </label>
                                    <input
                                      type="text"
                                      value={draftConfig.copy.storyStatNumber}
                                      onChange={(e) =>
                                        setDraftConfig((p) => ({
                                          ...p,
                                          copy: { ...p.copy, storyStatNumber: e.target.value },
                                        }))
                                      }
                                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200"
                                    />
                                  </div>
                                  <div>
                                    <label className="block font-bold text-gray-700 mb-1">
                                      Stat Label
                                    </label>
                                    <input
                                      type="text"
                                      value={draftConfig.copy.storyStatLabel}
                                      onChange={(e) =>
                                        setDraftConfig((p) => ({
                                          ...p,
                                          copy: { ...p.copy, storyStatLabel: e.target.value },
                                        }))
                                      }
                                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* 9. TESTIMONIALS OPTIONS */}
                            {sec.id === "testimonials" && (
                              <div className="space-y-2">
                                <VariantOptionCard
                                  selected={
                                    draftConfig.testimonialsVariant === "single-pull-quote"
                                  }
                                  title="5-Star Editorial Pull Quote"
                                  subtitle="Large centered serif pull quote with 5-star badge"
                                  badge="Luxora"
                                  onClick={() =>
                                    setDraftConfig((p) => ({
                                      ...p,
                                      testimonialsVariant: "single-pull-quote",
                                    }))
                                  }
                                />
                                <VariantOptionCard
                                  selected={draftConfig.testimonialsVariant === "numbered-3col"}
                                  title="3-Column Numbered Review Cards"
                                  subtitle="Three bordered customer review cards numbered 1, 2, 3"
                                  badge="Minim"
                                  onClick={() =>
                                    setDraftConfig((p) => ({
                                      ...p,
                                      testimonialsVariant: "numbered-3col",
                                    }))
                                  }
                                />
                                <VariantOptionCard
                                  selected={draftConfig.testimonialsVariant === "press-quote-grid"}
                                  title="'As Seen In' Press & Review Grid"
                                  subtitle="Publication/brand headers with verified customer quotes below"
                                  badge="Glowing"
                                  onClick={() =>
                                    setDraftConfig((p) => ({
                                      ...p,
                                      testimonialsVariant: "press-quote-grid",
                                    }))
                                  }
                                />
                              </div>
                            )}

                            {/* 10. NEWSLETTER & INSTAGRAM OPTIONS */}
                            {sec.id === "newsletter" && (
                              <div className="space-y-2.5">
                                <VariantOptionCard
                                  selected={
                                    draftConfig.socialNewsletterVariant === "dark-rounded-card"
                                  }
                                  title="Dark Rounded Floating CTA Banner"
                                  subtitle="High-contrast dark rounded container with pill email subscribe bar"
                                  badge="Stuffsus"
                                  onClick={() =>
                                    setDraftConfig((p) => ({
                                      ...p,
                                      socialNewsletterVariant: "dark-rounded-card",
                                    }))
                                  }
                                />
                                <VariantOptionCard
                                  selected={
                                    draftConfig.socialNewsletterVariant ===
                                    "instagram-strip-plus-minimal"
                                  }
                                  title="6-Tile Shoppable Instagram Strip + Newsletter"
                                  subtitle="Edge-to-edge 6-photo shoppable strip with minimal underline newsletter bar"
                                  badge="Bagkin"
                                  onClick={() =>
                                    setDraftConfig((p) => ({
                                      ...p,
                                      socialNewsletterVariant: "instagram-strip-plus-minimal",
                                    }))
                                  }
                                />
                                <VariantOptionCard
                                  selected={
                                    draftConfig.socialNewsletterVariant === "inline-fomo-bar"
                                  }
                                  title="Compact Horizontal FOMO Bar"
                                  subtitle="Single-line horizontal email capture strip"
                                  badge="Kylie"
                                  onClick={() =>
                                    setDraftConfig((p) => ({
                                      ...p,
                                      socialNewsletterVariant: "inline-fomo-bar",
                                    }))
                                  }
                                />
                                <div>
                                  <label className="block font-bold text-gray-700 mb-1">
                                    Newsletter Headline
                                  </label>
                                  <input
                                    type="text"
                                    value={draftConfig.copy.newsletterHeadline}
                                    onChange={(e) =>
                                      setDraftConfig((p) => ({
                                        ...p,
                                        copy: { ...p.copy, newsletterHeadline: e.target.value },
                                      }))
                                    }
                                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200"
                                  />
                                </div>
                              </div>
                            )}

                            {/* 11. FOOTER OPTIONS */}
                            {sec.id === "footer" && (
                              <div className="space-y-2">
                                <VariantOptionCard
                                  selected={draftConfig.footerVariant === "clean-4col"}
                                  title="Clean 4-Column Brand Footer"
                                  subtitle="Brand info, Navigation, Orders & Delivery, and Payment badges"
                                  badge="Drexel / Bagkin"
                                  onClick={() =>
                                    setDraftConfig((p) => ({ ...p, footerVariant: "clean-4col" }))
                                  }
                                />
                                <VariantOptionCard
                                  selected={draftConfig.footerVariant === "dark-instagram-grid"}
                                  title="Dark Charcoal Footer + 6-Tile Gallery"
                                  subtitle="Rich dark footer with a 6-photo shoppable gallery in column 4"
                                  badge="Storefront-01"
                                  onClick={() =>
                                    setDraftConfig((p) => ({
                                      ...p,
                                      footerVariant: "dark-instagram-grid",
                                    }))
                                  }
                                />
                                <VariantOptionCard
                                  selected={draftConfig.footerVariant === "minimal-single-row"}
                                  title="Minimal Single-Row Footer"
                                  subtitle="Ultra-clean horizontal row with wordmark, links & payment pills"
                                  badge="Minim"
                                  onClick={() =>
                                    setDraftConfig((p) => ({
                                      ...p,
                                      footerVariant: "minimal-single-row",
                                    }))
                                  }
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* =============================================================
                  TAB 2: 10 MOCKUP-INSPIRED BRAND PRESETS
                 ============================================================= */}
              {studioTab === "presets" && (
                <div className="space-y-5">
                  {isFullWebsiteEligible && (
                    <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                      <label className="block text-[10px] font-extrabold uppercase tracking-wider text-gray-500 mb-2">
                        Active Experience Mode
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setDraftConfig((p) => ({ ...p, mode: "FULL_WEBSITE" }));
                            setActivePreviewPage("home");
                          }}
                          className={`py-2 px-3 rounded-lg text-xs font-bold border cursor-pointer ${
                            draftConfig.mode === "FULL_WEBSITE"
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white text-gray-700 border-gray-200"
                          }`}
                        >
                          🌐 Full Website
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDraftConfig((p) => ({ ...p, mode: "STOREFRONT_ONLY" }));
                            setActivePreviewPage("shop");
                          }}
                          className={`py-2 px-3 rounded-lg text-xs font-bold border cursor-pointer ${
                            draftConfig.mode === "STOREFRONT_ONLY"
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white text-gray-700 border-gray-200"
                          }`}
                        >
                          🛍️ Storefront Only
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-900 mb-2">
                      Full Brand Website Presets (Growth & Pro)
                    </h3>
                    <div className="space-y-2">
                      {growthProPresets.map((preset) => (
                        <VariantOptionCard
                          key={preset.id}
                          selected={draftConfig.presetId === preset.id}
                          title={preset.name}
                          subtitle={preset.tagline}
                          badge={preset.mockupReference}
                          onClick={() => handleApplyPreset(preset.id)}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-900 mb-2">
                      Catalog Storefront Presets (Starter & Dropshipper)
                    </h3>
                    <div className="space-y-2">
                      {starterPresets.map((preset) => (
                        <VariantOptionCard
                          key={preset.id}
                          selected={draftConfig.presetId === preset.id}
                          title={preset.name}
                          subtitle={preset.tagline}
                          badge={preset.mockupReference}
                          onClick={() => handleApplyPreset(preset.id)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* =============================================================
                  TAB 3: THEME TOKENS & STYLING
                 ============================================================= */}
              {studioTab === "theme" && (
                <div className="space-y-5 text-xs">
                  <div>
                    <label className="block font-bold text-gray-800 mb-2">
                      Brand Primary Accent Color
                    </label>
                    <div className="flex flex-wrap items-center gap-2.5">
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
                              isSelected ? "scale-115 ring-2 ring-offset-2 ring-indigo-600" : ""
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
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-800 mb-2">
                      Typography Pairing
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          { id: "editorial-serif", label: "Editorial Serif", sub: "Playfair / Georgia" },
                          { id: "modern-sans", label: "Modern Clean Sans", sub: "Inter / Geometric" },
                          { id: "street-geometric", label: "Street Uppercase", sub: "Bold Display" },
                          { id: "luxury-warm", label: "Warm Botanical", sub: "Soft Humanist" },
                        ] as const
                      ).map((f) => (
                        <VariantOptionCard
                          key={f.id}
                          selected={draftConfig.theme.fontPairing === f.id}
                          title={f.label}
                          subtitle={f.sub}
                          onClick={() =>
                            setDraftConfig((prev) => ({
                              ...prev,
                              theme: { ...prev.theme, fontPairing: f.id as FontPairingId },
                            }))
                          }
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-800 mb-2">
                      Page Surface Mode
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          { id: "light", label: "Crisp White", sub: "#FFFFFF Studio" },
                          { id: "warm-cream", label: "Warm Alabaster", sub: "#FAF8F5 Cream" },
                          { id: "soft-sage", label: "Botanical Sage", sub: "#F8FAF8 Mist" },
                          { id: "dark-luxury", label: "Obsidian Dark", sub: "#111215 Luxury" },
                        ] as const
                      ).map((s) => (
                        <VariantOptionCard
                          key={s.id}
                          selected={draftConfig.theme.surfaceMode === s.id}
                          title={s.label}
                          subtitle={s.sub}
                          onClick={() =>
                            setDraftConfig((prev) => ({
                              ...prev,
                              theme: { ...prev.theme, surfaceMode: s.id as SurfaceModeId },
                            }))
                          }
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-800 mb-2">
                      Section Heading Style
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          { id: "clean-centered", label: "Clean Centered", sub: "Classic minimal" },
                          { id: "flanking-lines", label: "Flanking Lines", sub: "─── TITLE ───" },
                          { id: "framed-box", label: "Framed Box", sub: "[ BEST SELLERS ]" },
                          { id: "left-with-link", label: "Left + Action Link", sub: "Title + View All →" },
                        ] as const
                      ).map((h) => (
                        <VariantOptionCard
                          key={h.id}
                          selected={draftConfig.sectionHeadingStyle === h.id}
                          title={h.label}
                          subtitle={h.sub}
                          onClick={() =>
                            setDraftConfig((prev) => ({
                              ...prev,
                              sectionHeadingStyle: h.id as SectionHeadingStyleId,
                            }))
                          }
                        />
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-800 mb-1.5">
                        Corner Radius
                      </label>
                      <select
                        value={draftConfig.theme.borderRadius}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            theme: {
                              ...prev.theme,
                              borderRadius: e.target.value as BorderRadiusToken,
                            },
                          }))
                        }
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 font-semibold"
                      >
                        <option value="sharp">Sharp (0px)</option>
                        <option value="soft">Soft (8px)</option>
                        <option value="rounded">Rounded (16px)</option>
                        <option value="pill">Pill (24px)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-gray-800 mb-1.5">
                        Card Backdrop
                      </label>
                      <select
                        value={draftConfig.theme.cardTone}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({
                            ...prev,
                            theme: {
                              ...prev.theme,
                              cardTone: e.target.value as CardToneToken,
                            },
                          }))
                        }
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 font-semibold"
                      >
                        <option value="studio-gray">Studio Neutral Gray</option>
                        <option value="pastel-tint">Multi-Color Pastel Tints</option>
                        <option value="pure-white">Pure White</option>
                        <option value="warm-sand">Editorial Warm Sand</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* RIGHT INTERACTIVE LIVE PREVIEW CANVAS */}
        <div className="w-full flex-1 min-w-0 flex flex-col items-center">
          <div
            className={`w-full transition-all duration-300 bg-white border border-gray-300 rounded-2xl shadow-xl overflow-hidden ${
              viewport === "mobile"
                ? "max-w-[390px]"
                : viewport === "tablet"
                  ? "max-w-[768px]"
                  : "w-full"
            }`}
          >
            {/* Browser Bar */}
            <div className="bg-gray-100 border-b border-gray-200 px-3.5 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              </div>

              <div className="flex-1 min-w-[140px] max-w-md mx-auto px-3 py-1 rounded-lg bg-white border border-gray-200 text-[11px] font-mono text-gray-600 truncate text-center">
                {standaloneStorefrontUrl}
              </div>

              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-xs bg-indigo-100 text-indigo-800">
                  {viewport === "mobile"
                    ? "Mobile · 390px"
                    : viewport === "tablet"
                      ? "Tablet · 768px"
                      : "Click Section to Edit"}
                </span>
                <button
                  type="button"
                  onClick={() => setInspectorCollapsed((prev) => !prev)}
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-xs border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  {inspectorCollapsed ? "Show Panel" : "Expand"}
                </button>
              </div>
            </div>

            <div className="max-h-[820px] overflow-y-auto">
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
                activePageOverride={activePreviewPage}
                onActivePageChange={setActivePreviewPage}
                isStudioMode
                activeStudioSection={activeSection}
                onSelectStudioSection={handleSelectSectionFromCanvas}
                onOrderCompleted={async () => {
                  try {
                    const latest = await api.getState();
                    onStateChange(latest);
                  } catch {
                    // ignore
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
