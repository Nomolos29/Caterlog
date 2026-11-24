"use client";

import React from "react";
import type { Product } from "@/lib/types";
import { resolveImageUrl } from "@/lib/api";
import {
  resolveHeadingFontStyle,
  resolveRadiusClass,
  resolveSurfacePalette,
  type HeroVariantId,
  type ShopBannerVariantId,
  type StorefrontCopyConfig,
  type StorefrontThemeTokens,
} from "@/lib/storefront-presets";
import { StorefrontButton } from "./primitives";

// ---------------------------------------------------------------------------
// 1. COMPACT SHOP BANNER SECTION (Starter & Dropshipper Storefronts + /shop Page)
//    5 Variants from Shoppage-01, Shoppage-02, Shoppage-03, Storefront-06, Storefront-07
// ---------------------------------------------------------------------------

export interface StorefrontShopBannerProps {
  businessName: string;
  variant: ShopBannerVariantId;
  theme: StorefrontThemeTokens;
  copy: StorefrontCopyConfig;
  products: Product[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onExploreCatalog: () => void;
}

export function StorefrontShopBannerSection({
  businessName,
  variant,
  theme,
  copy,
  products,
  searchQuery,
  onSearchChange,
  onExploreCatalog,
}: StorefrontShopBannerProps) {
  const palette = resolveSurfacePalette(theme.surfaceMode);
  const headingFont = resolveHeadingFontStyle(theme.fontPairing);
  const bannerImg =
    copy.heroImageUrl ||
    resolveImageUrl(products[0]?.primaryImageUrl) ||
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1400&q=80";

  // VARIANT 1: overlap-typographic (Stuffsus Shoppage-01.jpg)
  // Large word "Shop" overlapping lifestyle header + floating white search bar docked at bottom
  if (variant === "overlap-typographic") {
    return (
      <section className="relative mb-8">
        <div className="relative h-64 sm:h-80 w-full overflow-hidden">
          <img
            src={bannerImg}
            alt={copy.heroTitle}
            className="w-full h-full object-cover brightness-75"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/15 to-transparent" />
          <div className="absolute inset-x-0 bottom-6 sm:bottom-8 flex justify-center pointer-events-none select-none">
            <h1
              className="text-7xl sm:text-9xl font-black tracking-tight text-white/95 leading-none"
              style={headingFont}
            >
              {copy.heroTitle || "Shop"}
            </h1>
          </div>
        </div>

        {/* Floating white search bar docked over bottom seam (Shoppage-01) */}
        <div className="max-w-6xl mx-auto px-4 sm:px-8 -mt-8 relative z-10">
          <div
            className="rounded-t-2xl sm:rounded-2xl shadow-lg border px-5 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            style={{
              backgroundColor: palette.cardSurfaceBg,
              borderColor: palette.borderSubtle,
            }}
          >
            <h2
              className="text-lg sm:text-xl font-extrabold"
              style={{ color: palette.textPrimary }}
            >
              {copy.heroSubtitle || "Give All You Need"}
            </h2>

            <div className="flex items-center gap-2 w-full sm:w-96">
              <div
                className="flex-1 flex items-center gap-2 px-3.5 py-2 rounded-full border text-xs"
                style={{
                  backgroundColor: palette.sectionAltBg,
                  borderColor: palette.borderSubtle,
                }}
              >
                <svg className="w-3.5 h-3.5 opacity-50" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={`Search on ${businessName}...`}
                  className="w-full bg-transparent focus:outline-none"
                  style={{ color: palette.textPrimary }}
                />
              </div>
              <StorefrontButton
                theme={theme}
                variant="solid"
                size="xs"
                onClick={onExploreCatalog}
                className="!rounded-full px-4 py-2"
              >
                Search
              </StorefrontButton>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // VARIANT 2: curved-arch (Constructor Shoppage-03.jpg)
  // Full-bleed hero with curved bottom mask and floating white pill button straddling the curve
  if (variant === "curved-arch") {
    return (
      <section className="relative mb-12">
        <div
          className="relative h-72 sm:h-96 w-full overflow-hidden flex items-center justify-center text-center px-4"
          style={{
            borderBottomLeftRadius: "50% 14%",
            borderBottomRightRadius: "50% 14%",
          }}
        >
          <img
            src={bannerImg}
            alt={copy.heroTitle}
            className="absolute inset-0 w-full h-full object-cover brightness-75"
          />
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative z-10 max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/80 mb-2">
              {copy.heroSubtitle}
            </p>
            <h1
              className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight"
              style={headingFont}
            >
              {copy.heroTitle}
            </h1>
          </div>
        </div>

        {/* Floating white pill button straddling the curve (Shoppage-03) */}
        <div className="flex justify-center -mt-6 relative z-20">
          <StorefrontButton
            theme={theme}
            variant="white-pill"
            size="md"
            onClick={onExploreCatalog}
            className="px-8 py-3 font-bold text-xs uppercase tracking-wider"
          >
            {copy.heroPrimaryCta || "Shop Now"}
          </StorefrontButton>
        </div>
      </section>
    );
  }

  // VARIANT 3: split-breadcrumb (Guza Storefront-06.jpg)
  // Soft cream/studio full-width banner with "Shop" + breadcrumb on left and product imagery right
  if (variant === "split-breadcrumb") {
    return (
      <section
        className="border-b mb-8 overflow-hidden"
        style={{
          backgroundColor: palette.sectionAltBg,
          borderColor: palette.borderSubtle,
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 sm:py-14 grid grid-cols-1 md:grid-cols-12 items-center gap-6">
          <div className="md:col-span-5">
            <h1
              className="text-3xl sm:text-5xl font-bold tracking-tight mb-2"
              style={{ ...headingFont, color: palette.textPrimary }}
            >
              {copy.heroTitle || "Shop"}
            </h1>
            <p className="text-xs sm:text-sm" style={{ color: palette.textMuted }}>
              Home <span className="mx-1.5">›</span>{" "}
              <span style={{ color: palette.textPrimary }}>{copy.heroTitle || "Shop"}</span>
            </p>
            {copy.heroDescription && (
              <p className="text-xs sm:text-sm mt-3 max-w-sm" style={{ color: palette.textSecondary }}>
                {copy.heroDescription}
              </p>
            )}
          </div>

          <div className="md:col-span-7 flex items-center justify-end gap-3 overflow-hidden">
            {products.slice(0, 4).map((p, idx) => (
              <div
                key={p.id}
                onClick={onExploreCatalog}
                className="w-28 h-32 sm:w-36 sm:h-40 rounded-xl overflow-hidden shadow-xs border shrink-0 cursor-pointer transition-transform hover:-translate-y-1"
                style={{
                  backgroundColor: palette.cardSurfaceBg,
                  borderColor: palette.borderSubtle,
                  transform: `rotate(${idx % 2 === 0 ? "-1.5deg" : "1.5deg"})`,
                }}
              >
                <img
                  src={resolveImageUrl(p.primaryImageUrl) || bannerImg}
                  alt={p.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // VARIANT 4: minimal-rack (Ugmonk Storefront-07.jpg)
  // Full-bleed warm studio photography with minimal bottom-left caption & link
  if (variant === "minimal-rack") {
    return (
      <section className="relative h-72 sm:h-96 w-full overflow-hidden mb-8">
        <img
          src={bannerImg}
          alt={copy.heroTitle}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-full flex items-end pb-8 relative z-10">
          <div className="text-white">
            <p className="text-sm sm:text-base font-medium mb-1">
              {copy.heroTitle || "New Essential Collection"}
            </p>
            <button
              type="button"
              onClick={onExploreCatalog}
              className="text-xs font-semibold underline underline-offset-4 hover:opacity-80 cursor-pointer"
            >
              {copy.heroPrimaryCta || "Learn more →"}
            </button>
          </div>
        </div>
      </section>
    );
  }

  // VARIANT 5: promo-box (Drexel Shoppage-02.jpg)
  // Clean centered muted gray promo container inside the catalog area
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 mb-6">
      <div
        className="py-10 sm:py-12 px-6 text-center border"
        style={{
          backgroundColor: palette.sectionAltBg,
          borderColor: palette.borderSubtle,
        }}
      >
        <p
          className="text-xs font-bold uppercase tracking-[0.22em] mb-1"
          style={{ color: palette.textSecondary }}
        >
          {copy.heroSubtitle || "NEW STYLE COLLECTION"}
        </p>
        <h1
          className="text-2xl sm:text-4xl font-extrabold uppercase tracking-wider mb-2.5"
          style={{ ...headingFont, color: palette.textPrimary }}
        >
          {copy.heroTitle || businessName}
        </h1>
        <p
          className="text-xs sm:text-sm max-w-lg mx-auto"
          style={{ color: palette.textMuted }}
        >
          {copy.heroDescription}
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 2. FULL BRAND WEBSITE HERO SECTION (Growth & Pro Vendors)
//    6 Variants from Homepage-01, Websitelinkmockup, Storefront-02..13
// ---------------------------------------------------------------------------

export interface StorefrontHeroProps {
  businessName: string;
  variant: HeroVariantId;
  theme: StorefrontThemeTokens;
  copy: StorefrontCopyConfig;
  featuredProduct?: Product;
  totalProductsCount: number;
  onPrimaryCta: () => void;
  onSecondaryCta: () => void;
}

export function StorefrontHeroSection({
  businessName,
  variant,
  theme,
  copy,
  featuredProduct,
  totalProductsCount,
  onPrimaryCta,
  onSecondaryCta,
}: StorefrontHeroProps) {
  const palette = resolveSurfacePalette(theme.surfaceMode);
  const headingFont = resolveHeadingFontStyle(theme.fontPairing);
  const heroRadius = resolveRadiusClass(theme.borderRadius, "card");

  const heroImg =
    copy.heroImageUrl ||
    resolveImageUrl(featuredProduct?.primaryImageUrl) ||
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1200&q=80";

  // ---------------------------------------------------------------------------
  // VARIANT 1: magazine-layered (Jenahara Storefront-05.jpg)
  // Giant display brand name layered behind portrait photo with sweeping ribbon
  // curve, bottom-left pill button, and bottom-right tagline
  // ---------------------------------------------------------------------------
  if (variant === "magazine-layered") {
    return (
      <section
        className="relative overflow-hidden border-b"
        style={{
          backgroundColor: "#E8E7E5",
          borderColor: palette.borderSubtle,
        }}
      >
        {/* Decorative sweeping SVG ribbon curve from Storefront-05 */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none opacity-30"
          viewBox="0 0 1440 600"
          fill="none"
          preserveAspectRatio="none"
        >
          <path
            d="M-100 450 C 250 100, 600 120, 880 380 C 1120 580, 1320 350, 1540 80"
            stroke="#9CA3AF"
            strokeWidth="48"
            strokeLinecap="round"
          />
        </svg>

        <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-10 pb-8 relative min-h-[420px] sm:min-h-[520px] flex flex-col justify-between">
          {/* Giant editorial display wordmark centered across the canvas */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center pointer-events-none select-none z-0 px-2">
            <h1
              className="text-5xl sm:text-8xl md:text-9xl font-serif font-bold uppercase tracking-[0.08em] text-black/90 leading-none truncate"
              style={headingFont}
            >
              {businessName}
            </h1>
          </div>

          {/* Central model / hero product portrait overlapping the giant title */}
          <div className="relative z-10 mx-auto my-auto w-60 h-72 sm:w-80 sm:h-96 rounded-t-full overflow-hidden shadow-2xl border-4 border-white/60">
            <img
              src={heroImg}
              alt={copy.heroTitle}
              className="w-full h-full object-cover object-top"
            />
          </div>

          {/* Bottom bar: Shop Now pill button left, editorial tagline right */}
          <div className="relative z-20 flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-4">
            <StorefrontButton
              theme={theme}
              variant="dark"
              size="md"
              onClick={onPrimaryCta}
              className="!rounded-full px-7 py-2.5 shadow-lg"
            >
              {copy.heroPrimaryCta || "Shop Now"}
            </StorefrontButton>

            <div className="sm:text-right max-w-xs">
              <p className="text-xs font-bold text-gray-900">{copy.heroSubtitle}</p>
              <p className="text-[11px] text-gray-600 mt-0.5 line-clamp-2">
                {copy.heroDescription}
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ---------------------------------------------------------------------------
  // VARIANT 2: product-spotlight (Homepage-01.jpg "Palo Santo" & Minim Storefront-03)
  // Large watermark number "01" behind headline, dual CTAs (BUY NOW + EXPLORE),
  // 2-col mini product highlights, and floating stat bubbles around hero image
  // ---------------------------------------------------------------------------
  if (variant === "product-spotlight") {
    return (
      <section
        className="relative overflow-hidden border-b py-12 sm:py-20"
        style={{
          backgroundColor: palette.pageBg,
          borderColor: palette.borderSubtle,
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8 grid grid-cols-1 lg:grid-cols-12 items-center gap-10">
          {/* Left column: Watermark number, display title, dual CTAs & 2-col mini facts */}
          <div className="lg:col-span-7 relative">
            <span
              className="absolute -top-12 -left-2 text-8xl sm:text-9xl font-serif font-black select-none pointer-events-none opacity-10 leading-none"
              style={{ color: palette.textPrimary }}
            >
              01
            </span>

            <p
              className="text-xs font-bold uppercase tracking-[0.22em] mb-2 relative z-10"
              style={{ color: theme.accentColor }}
            >
              {copy.heroSubtitle}
            </p>

            <h1
              className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.08] mb-4 relative z-10"
              style={{ ...headingFont, color: palette.textPrimary }}
            >
              {copy.heroTitle}
            </h1>

            <p
              className="text-sm sm:text-base max-w-xl mb-7 leading-relaxed"
              style={{ color: palette.textSecondary }}
            >
              {copy.heroDescription}
            </p>

            {/* Dual rectangular CTAs from Homepage-01: BUY NOW (Accent) + EXPLORE (Black) */}
            <div className="flex flex-wrap items-center gap-3 mb-10">
              <StorefrontButton
                theme={theme}
                variant="solid"
                size="lg"
                onClick={onPrimaryCta}
                className="uppercase tracking-wider text-xs px-8"
              >
                {copy.heroPrimaryCta || "Buy Now"}
              </StorefrontButton>
              <StorefrontButton
                theme={theme}
                variant="dark"
                size="lg"
                onClick={onSecondaryCta}
                className="uppercase tracking-wider text-xs px-8"
              >
                {copy.heroSecondaryCta || "Explore"}
              </StorefrontButton>
            </div>

            {/* 2-Column Mini Specs (Homepage-01 "Chemical Components" / "Fun Fact") */}
            <div
              className="grid grid-cols-2 gap-6 pt-6 border-t max-w-lg"
              style={{ borderColor: palette.borderSubtle }}
            >
              <div>
                <h3
                  className="text-xs font-bold uppercase tracking-wider mb-1"
                  style={{ color: palette.textPrimary }}
                >
                  Verified Quality
                </h3>
                <p className="text-[11px] leading-relaxed" style={{ color: palette.textMuted }}>
                  100% authentic inventory with instant 15-minute stock reservation at checkout.
                </p>
              </div>
              <div>
                <h3
                  className="text-xs font-bold uppercase tracking-wider mb-1"
                  style={{ color: palette.textPrimary }}
                >
                  Fast Dispatch
                </h3>
                <p className="text-[11px] leading-relaxed" style={{ color: palette.textMuted }}>
                  Protected by Monnify virtual account verification and real-time courier tracking.
                </p>
              </div>
            </div>
          </div>

          {/* Right column: Hero product portrait + floating stat callout bubbles */}
          <div className="lg:col-span-5 relative flex items-center justify-center">
            <div
              className={`relative w-72 h-80 sm:w-88 sm:h-96 ${heroRadius} overflow-hidden shadow-2xl border`}
              style={{
                backgroundColor: palette.sectionAltBg,
                borderColor: palette.borderSubtle,
              }}
            >
              <img
                src={heroImg}
                alt={copy.heroTitle}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Top-right circular stat bubble (Homepage-01 "9.6M Products") */}
            <div
              className="absolute -top-4 right-2 sm:right-4 w-20 h-20 rounded-full shadow-xl flex flex-col items-center justify-center text-center p-2"
              style={{
                backgroundColor: "#111827",
                color: "#FFFFFF",
              }}
            >
              <span className="text-sm font-black leading-none">
                {totalProductsCount}+
              </span>
              <span className="text-[9px] uppercase tracking-wider opacity-80 mt-0.5">
                Items Live
              </span>
            </div>

            {/* Bottom-right floating stat card (Homepage-01 "89m Total Clients") */}
            <div
              className="absolute -bottom-3 right-0 sm:right-2 px-4 py-2.5 rounded-xl shadow-lg border text-center"
              style={{
                backgroundColor: palette.cardSurfaceBg,
                borderColor: palette.borderSubtle,
              }}
            >
              <p className="text-sm font-extrabold" style={{ color: palette.textPrimary }}>
                {copy.storyStatNumber || "4.9★"}
              </p>
              <p className="text-[10px]" style={{ color: palette.textMuted }}>
                {copy.storyStatLabel || "Verified Buyers"}
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ---------------------------------------------------------------------------
  // VARIANT 3: editorial-center-overlay (Bagkin Storefront-02 & Kylie Storefront-04)
  // Full-bleed dark/street-style hero photography with centered editorial title & CTA
  // ---------------------------------------------------------------------------
  if (variant === "editorial-center-overlay") {
    return (
      <section className="relative h-[420px] sm:h-[520px] w-full overflow-hidden flex items-center justify-center text-center px-4">
        <img
          src={heroImg}
          alt={copy.heroTitle}
          className="absolute inset-0 w-full h-full object-cover brightness-75"
        />
        <div className="absolute inset-0 bg-black/40" />

        <div className="relative z-10 max-w-2xl mx-auto text-white">
          {copy.heroSubtitle && (
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/85 mb-3">
              {copy.heroSubtitle}
            </p>
          )}
          <h1
            className="text-4xl sm:text-6xl font-bold leading-tight mb-4"
            style={headingFont}
          >
            {copy.heroTitle}
          </h1>
          <p className="text-sm sm:text-base text-white/85 max-w-lg mx-auto mb-7">
            {copy.heroDescription}
          </p>
          <div className="flex items-center justify-center gap-3">
            <StorefrontButton
              theme={theme}
              variant="solid"
              size="lg"
              onClick={onPrimaryCta}
              className="uppercase tracking-widest text-xs px-8"
            >
              {copy.heroPrimaryCta || "Shop Collection"}
            </StorefrontButton>
          </div>
        </div>
      </section>
    );
  }

  // ---------------------------------------------------------------------------
  // VARIANT 4: dark-luxury (Illuminate Storefront-11 & Funio Storefront-09)
  // High-contrast charcoal/taupe hero with featured price tag, headline & large cutout
  // ---------------------------------------------------------------------------
  if (variant === "dark-luxury") {
    return (
      <section
        className="relative overflow-hidden py-14 sm:py-20 text-white"
        style={{
          background: "linear-gradient(135deg, #16171B 0%, #272524 55%, #18191D 100%)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8 grid grid-cols-1 lg:grid-cols-12 items-center gap-10">
          <div className="lg:col-span-6">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400 mb-2">
              {featuredProduct ? featuredProduct.basePriceFormatted : copy.heroSubtitle}
            </p>
            <h1
              className="text-4xl sm:text-6xl font-bold tracking-tight leading-tight mb-4"
              style={headingFont}
            >
              {copy.heroTitle}
            </h1>
            <p className="text-sm sm:text-base text-gray-300 max-w-md mb-8 leading-relaxed">
              {copy.heroDescription}
            </p>
            <div className="flex items-center gap-4">
              <StorefrontButton
                theme={theme}
                variant="solid"
                size="lg"
                onClick={onPrimaryCta}
                className="uppercase tracking-wider text-xs px-7"
              >
                {copy.heroPrimaryCta || "Shop Collection →"}
              </StorefrontButton>
              <button
                type="button"
                onClick={onSecondaryCta}
                className="text-xs font-semibold uppercase tracking-widest text-gray-300 hover:text-white underline underline-offset-8 cursor-pointer"
              >
                {copy.heroSecondaryCta || "Explore All"}
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 flex justify-center">
            <div className="relative w-72 h-72 sm:w-96 sm:h-96 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/15">
              <img
                src={heroImg}
                alt={copy.heroTitle}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ---------------------------------------------------------------------------
  // VARIANT 5: script-overlap (Orgamic Storefront-13.jpg)
  // Soft neutral canvas with product group on left and script accent word
  // overlapping bold uppercase headline on right
  // ---------------------------------------------------------------------------
  if (variant === "script-overlap") {
    return (
      <section
        className="border-b py-12 sm:py-16"
        style={{
          backgroundColor: palette.sectionAltBg,
          borderColor: palette.borderSubtle,
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8 grid grid-cols-1 md:grid-cols-12 items-center gap-8">
          <div className="md:col-span-5 flex justify-center">
            <div
              className={`w-64 h-72 sm:w-80 sm:h-88 ${heroRadius} overflow-hidden shadow-xl`}
            >
              <img
                src={heroImg}
                alt={copy.heroTitle}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="md:col-span-7 md:pl-6">
            <div className="relative mb-3">
              <span
                className="block text-4xl sm:text-6xl italic font-serif leading-none -mb-3 select-none"
                style={{ color: theme.accentColor }}
              >
                {copy.heroScriptAccent || businessName.split(" ")[0]}
              </span>
              <h1
                className="text-3xl sm:text-5xl font-extrabold uppercase tracking-wider"
                style={{ ...headingFont, color: palette.textPrimary }}
              >
                {copy.heroTitle}
              </h1>
            </div>
            <p
              className="text-xs sm:text-sm max-w-lg mb-6 leading-relaxed"
              style={{ color: palette.textSecondary }}
            >
              {copy.heroDescription}
            </p>
            <StorefrontButton
              theme={theme}
              variant="solid"
              size="md"
              onClick={onPrimaryCta}
              className="!rounded-full uppercase tracking-wider text-xs px-7"
            >
              {copy.heroPrimaryCta || "Shop Now"}
            </StorefrontButton>
          </div>
        </div>
      </section>
    );
  }

  // ---------------------------------------------------------------------------
  // VARIANT 6 (Default): split-studio (Nyture Storefront-08, Glowing Storefront-12, Luxora)
  // Clean 50/50 studio container with optional strikethrough promo price,
  // headline, subcopy, CTA on left, and studio portrait on right
  // ---------------------------------------------------------------------------
  return (
    <section
      className="border-b"
      style={{
        backgroundColor: palette.sectionAltBg,
        borderColor: palette.borderSubtle,
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12 sm:py-16 grid grid-cols-1 md:grid-cols-12 items-center gap-8">
        <div className="md:col-span-6 space-y-4">
          {featuredProduct ? (
            <div className="flex items-center gap-2.5 text-xs font-semibold">
              <span className="line-through opacity-50" style={{ color: palette.textMuted }}>
                ₦{Math.round(featuredProduct.basePriceNaira * 1.25).toLocaleString()}
              </span>
              <span className="font-bold" style={{ color: theme.accentColor }}>
                {featuredProduct.basePriceFormatted}
              </span>
              <span
                className="px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-xs"
                style={{
                  backgroundColor: theme.accentColor,
                  color: "#FFFFFF",
                }}
              >
                {copy.heroSubtitle}
              </span>
            </div>
          ) : (
            <p
              className="text-xs font-bold uppercase tracking-[0.2em]"
              style={{ color: theme.accentColor }}
            >
              {copy.heroSubtitle}
            </p>
          )}

          <h1
            className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]"
            style={{ ...headingFont, color: palette.textPrimary }}
          >
            {copy.heroTitle}
          </h1>

          <p
            className="text-sm sm:text-base max-w-md leading-relaxed"
            style={{ color: palette.textSecondary }}
          >
            {copy.heroDescription}
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <StorefrontButton
              theme={theme}
              variant="solid"
              size="lg"
              onClick={onPrimaryCta}
              className="uppercase tracking-wider text-xs px-8"
            >
              {copy.heroPrimaryCta || "Shop Now"}
            </StorefrontButton>
            <StorefrontButton
              theme={theme}
              variant="outline"
              size="lg"
              onClick={onSecondaryCta}
              className="uppercase tracking-wider text-xs px-6"
            >
              {copy.heroSecondaryCta || "Explore"}
            </StorefrontButton>
          </div>
        </div>

        <div className="md:col-span-6 flex justify-center md:justify-end">
          <div
            className={`w-full max-w-md aspect-[4/3] sm:aspect-[5/4] overflow-hidden ${heroRadius} shadow-lg`}
            style={{ backgroundColor: palette.cardSurfaceBg }}
          >
            <img
              src={heroImg}
              alt={copy.heroTitle}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
