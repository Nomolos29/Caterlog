"use client";

import type { StorefrontProduct } from "./types";
import {
  resolveHeadingFontStyle,
  resolveRadiusClass,
  resolveSurfacePalette,
  type HeroVariantId,
  type ShopBannerVariantId,
  type StorefrontCopyConfig,
  type StorefrontThemeTokens,
} from "./presets";
import { resolveStorefrontImageUrl, StorefrontButton } from "./primitives";

// ---------------------------------------------------------------------------
// 1. COMPACT SHOP BANNER SECTION (Starter & Dropshipper Storefronts + /shop Page)
// ---------------------------------------------------------------------------

export interface StorefrontShopBannerProps {
  businessName: string;
  variant: ShopBannerVariantId;
  theme: StorefrontThemeTokens;
  copy: StorefrontCopyConfig;
  products: StorefrontProduct[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onExploreCatalog: () => void;
  onSelectProduct?: (product: StorefrontProduct) => void;
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
  onSelectProduct,
}: StorefrontShopBannerProps) {
  const palette = resolveSurfacePalette(theme.surfaceMode);
  const headingFont = resolveHeadingFontStyle(theme.fontPairing);
  const bannerImg =
    copy.heroImageUrl ||
    resolveStorefrontImageUrl(products[0]?.primaryImageUrl) ||
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1400&q=80";

  const titleText = copy.heroTitle || "Shop";
  const isShortSingleWord = titleText.trim().length <= 10;

  // VARIANT 1: overlap-typographic (Stuffsus Shoppage-01.jpg)
  if (variant === "overlap-typographic") {
    return (
      <section className="relative mb-8 @sm:mb-10">
        <div className="relative min-h-[240px] @sm:min-h-[320px] @lg:min-h-[380px] w-full overflow-hidden flex items-center justify-center py-12 px-4">
          <img
            src={bannerImg}
            alt={titleText}
            className="absolute inset-0 w-full h-full object-cover brightness-75 scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/15" />
          <div className="relative z-10 flex flex-col items-center justify-center text-center max-w-4xl mx-auto pb-6 @sm:pb-8">
            <span className="px-3 @sm:px-3.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-[10px] @sm:text-[11px] font-bold uppercase tracking-[0.18em] @sm:tracking-[0.22em] text-white/90 mb-3 border border-white/20 max-w-full truncate">
              {businessName} · Official Storefront
            </span>
            <h1
              className={`font-black tracking-tight text-white drop-shadow-sm break-words ${
                isShortSingleWord
                  ? "text-5xl @sm:text-7xl @lg:text-8xl leading-none"
                  : "text-2xl @sm:text-4xl @lg:text-6xl leading-[1.1]"
              }`}
              style={headingFont}
            >
              {titleText}
            </h1>
          </div>
        </div>

        {/* Floating search bar docked over the bottom seam */}
        <div className="max-w-6xl mx-auto px-3.5 @sm:px-6 @lg:px-8 -mt-8 @sm:-mt-10 relative z-10">
          <div
            className="rounded-2xl shadow-xl border p-4 @sm:px-6 @lg:px-8 @sm:py-5 flex flex-col @md:flex-row @md:items-center justify-between gap-3.5 @sm:gap-4"
            style={{
              backgroundColor: palette.cardSurfaceBg,
              borderColor: palette.borderSubtle,
            }}
          >
            <div className="min-w-0">
              <h2
                className="text-base @sm:text-lg @lg:text-xl font-extrabold truncate"
                style={{ color: palette.textPrimary }}
              >
                {copy.heroSubtitle || "Give All You Need"}
              </h2>
              <p className="text-[11px] @sm:text-xs mt-0.5" style={{ color: palette.textMuted }}>
                {products.length} verified items ready for immediate checkout
              </p>
            </div>

            <div className="flex items-center gap-2 w-full @md:w-80 @lg:w-96 shrink-0">
              <div
                className="flex-1 min-w-0 flex items-center gap-2 px-3.5 py-2 @sm:py-2.5 rounded-full border text-xs"
                style={{
                  backgroundColor: palette.sectionAltBg,
                  borderColor: palette.borderSubtle,
                }}
              >
                <svg className="w-4 h-4 opacity-50 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={`Search on ${businessName}...`}
                  className="w-full min-w-0 bg-transparent focus:outline-none"
                  style={{ color: palette.textPrimary }}
                />
              </div>
              <StorefrontButton
                theme={theme}
                variant="solid"
                size="sm"
                onClick={onExploreCatalog}
                className="!rounded-full px-4 @sm:px-5 py-2 @sm:py-2.5 shrink-0"
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
  if (variant === "curved-arch") {
    return (
      <section className="relative mb-10 @sm:mb-12">
        <div
          className="relative min-h-[260px] @sm:min-h-[360px] @lg:min-h-[420px] w-full overflow-hidden flex items-center justify-center text-center px-4 py-12"
          style={{
            borderBottomLeftRadius: "50% 12%",
            borderBottomRightRadius: "50% 12%",
          }}
        >
          <img
            src={bannerImg}
            alt={copy.heroTitle}
            className="absolute inset-0 w-full h-full object-cover brightness-75"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/40 to-black/60" />
          <div className="relative z-10 max-w-2xl mx-auto px-2">
            <span className="inline-block px-3.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-[10px] @sm:text-[11px] font-bold uppercase tracking-[0.2em] text-white mb-3 border border-white/20">
              {copy.heroSubtitle || businessName}
            </span>
            <h1
              className="text-2xl @sm:text-4xl @lg:text-6xl font-extrabold text-white tracking-tight leading-tight break-words"
              style={headingFont}
            >
              {copy.heroTitle}
            </h1>
            {copy.heroDescription && (
              <p className="text-xs @sm:text-sm text-white/85 mt-3 max-w-md mx-auto leading-relaxed">
                {copy.heroDescription}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-center -mt-6 relative z-20 px-4">
          <StorefrontButton
            theme={theme}
            variant="white-pill"
            size="md"
            onClick={onExploreCatalog}
            className="px-7 @sm:px-9 py-3 @sm:py-3.5 font-extrabold text-xs uppercase tracking-widest shadow-xl"
          >
            {copy.heroPrimaryCta || "Shop Now"}
          </StorefrontButton>
        </div>
      </section>
    );
  }

  // VARIANT 3: split-breadcrumb (Guza Storefront-06.jpg)
  if (variant === "split-breadcrumb") {
    return (
      <section
        className="border-b mb-6 @sm:mb-8 overflow-hidden"
        style={{
          backgroundColor: palette.sectionAltBg,
          borderColor: palette.borderSubtle,
        }}
      >
        <div className="max-w-7xl mx-auto px-3.5 @sm:px-6 @lg:px-8 py-8 @sm:py-12 grid grid-cols-1 @md:grid-cols-12 items-center gap-6 @lg:gap-8">
          <div className="@md:col-span-5 space-y-2">
            <p className="text-xs font-medium" style={{ color: palette.textMuted }}>
              Home <span className="mx-1.5">›</span>{" "}
              <span className="font-semibold" style={{ color: palette.textPrimary }}>
                {copy.heroTitle || "Shop"}
              </span>
            </p>
            <h1
              className="text-2xl @sm:text-4xl @lg:text-5xl font-bold tracking-tight break-words"
              style={{ ...headingFont, color: palette.textPrimary }}
            >
              {copy.heroTitle || "Shop"}
            </h1>
            {copy.heroDescription && (
              <p className="text-xs @sm:text-sm max-w-sm leading-relaxed" style={{ color: palette.textSecondary }}>
                {copy.heroDescription}
              </p>
            )}
          </div>

          <div className="@md:col-span-7 flex items-center @md:justify-end gap-3 overflow-x-auto no-scrollbar py-2">
            {products.slice(0, 4).map((p) => (
              <div
                key={p.id}
                onClick={() => (onSelectProduct ? onSelectProduct(p) : onExploreCatalog())}
                className="group relative w-28 h-36 @sm:w-36 @sm:h-44 @lg:w-40 @lg:h-48 rounded-2xl overflow-hidden shadow-sm border shrink-0 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-md"
                style={{
                  backgroundColor: palette.cardSurfaceBg,
                  borderColor: palette.borderSubtle,
                }}
              >
                <img
                  src={resolveStorefrontImageUrl(p.primaryImageUrl) || bannerImg}
                  alt={p.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-2.5 text-white">
                  <p className="text-[11px] font-bold truncate">{p.name}</p>
                  <p className="text-[10px] opacity-90">{p.basePriceFormatted}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // VARIANT 4: minimal-rack (Ugmonk Storefront-07.jpg)
  if (variant === "minimal-rack") {
    return (
      <section className="relative min-h-[260px] @sm:min-h-[360px] @lg:min-h-[420px] w-full overflow-hidden mb-6 @sm:mb-8 flex items-end">
        <img
          src={bannerImg}
          alt={copy.heroTitle}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
        <div className="max-w-7xl w-full mx-auto px-3.5 @sm:px-6 @lg:px-8 py-8 @sm:py-10 relative z-10">
          <div className="text-white max-w-md">
            <span className="text-[10px] @sm:text-[11px] font-bold uppercase tracking-[0.2em] text-white/80 block mb-1">
              {copy.heroSubtitle || businessName}
            </span>
            <h1 className="text-2xl @sm:text-3xl @lg:text-4xl font-bold mb-2.5 break-words" style={headingFont}>
              {copy.heroTitle || "New Essential Collection"}
            </h1>
            <button
              type="button"
              onClick={onExploreCatalog}
              className="text-xs font-bold uppercase tracking-widest underline underline-offset-8 hover:opacity-80 cursor-pointer"
            >
              {copy.heroPrimaryCta || "Explore Catalog →"}
            </button>
          </div>
        </div>
      </section>
    );
  }

  // VARIANT 5: promo-box (Drexel Shoppage-02.jpg)
  return (
    <section className="max-w-7xl mx-auto px-3.5 @sm:px-6 @lg:px-8 pt-4 @sm:pt-6 mb-6">
      <div
        className="py-8 @sm:py-12 @lg:py-14 px-4 @sm:px-6 text-center border"
        style={{
          backgroundColor: palette.sectionAltBg,
          borderColor: palette.borderSubtle,
        }}
      >
        <p
          className="text-[11px] @sm:text-xs font-bold uppercase tracking-[0.22em] mb-1.5"
          style={{ color: theme.accentColor }}
        >
          {copy.heroSubtitle || "NEW STYLE COLLECTION"}
        </p>
        <h1
          className="text-xl @sm:text-3xl @lg:text-4xl font-extrabold uppercase tracking-wider mb-2.5 break-words"
          style={{ ...headingFont, color: palette.textPrimary }}
        >
          {copy.heroTitle || businessName}
        </h1>
        <p
          className="text-xs @sm:text-sm max-w-lg mx-auto leading-relaxed"
          style={{ color: palette.textMuted }}
        >
          {copy.heroDescription}
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 2. FULL BRAND WEBSITE HERO SECTION (Growth & Pro Vendors — 6 Variants)
// ---------------------------------------------------------------------------

export interface StorefrontHeroProps {
  businessName: string;
  variant: HeroVariantId;
  theme: StorefrontThemeTokens;
  copy: StorefrontCopyConfig;
  featuredProduct?: StorefrontProduct;
  secondaryProduct?: StorefrontProduct;
  totalProductsCount: number;
  onPrimaryCta: () => void;
  onSecondaryCta: () => void;
  onSelectProduct?: (product: StorefrontProduct) => void;
}

export function StorefrontHeroSection({
  businessName,
  variant,
  theme,
  copy,
  featuredProduct,
  secondaryProduct,
  totalProductsCount,
  onPrimaryCta,
  onSecondaryCta,
  onSelectProduct,
}: StorefrontHeroProps) {
  const palette = resolveSurfacePalette(theme.surfaceMode);
  const headingFont = resolveHeadingFontStyle(theme.fontPairing);
  const heroRadius = resolveRadiusClass(theme.borderRadius, "card");

  const heroImg =
    copy.heroImageUrl ||
    resolveStorefrontImageUrl(featuredProduct?.primaryImageUrl) ||
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1200&q=80";

  // ---------------------------------------------------------------------------
  // VARIANT 1: magazine-layered (Jenahara Storefront-05.jpg)
  // ---------------------------------------------------------------------------
  if (variant === "magazine-layered") {
    return (
      <section
        className="relative overflow-hidden border-b"
        style={{
          background: palette.isDark
            ? "linear-gradient(180deg, #16171C 0%, #1F2128 100%)"
            : "linear-gradient(180deg, #ECEAE6 0%, #E2DFD9 100%)",
          borderColor: palette.borderSubtle,
        }}
      >
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none opacity-25"
          viewBox="0 0 1440 600"
          fill="none"
          preserveAspectRatio="none"
        >
          <path
            d="M-100 460 C 260 110, 620 130, 900 390 C 1140 580, 1320 340, 1540 90"
            stroke={palette.isDark ? "#4B5563" : "#9CA3AF"}
            strokeWidth="56"
            strokeLinecap="round"
          />
        </svg>

        <div className="max-w-7xl mx-auto px-3.5 @sm:px-6 @lg:px-8 py-8 @sm:py-12 @lg:py-14 relative z-10">
          {/* Top Editorial Masthead Row */}
          <div className="text-center mb-6 @sm:mb-8">
            <span
              className="inline-block text-[10px] @sm:text-[11px] font-bold uppercase tracking-[0.24em] @sm:tracking-[0.3em] mb-2"
              style={{ color: palette.textSecondary }}
            >
              {copy.heroSubtitle || "COLLECTION 01 · EDITORIAL"}
            </span>
            <h1
              className="text-3xl @sm:text-5xl @lg:text-7xl font-serif font-bold uppercase tracking-[0.06em] @sm:tracking-[0.1em] leading-[1.05] break-words max-w-5xl mx-auto"
              style={{
                ...headingFont,
                color: palette.textPrimary,
              }}
            >
              {copy.heroTitle || businessName}
            </h1>
          </div>

          {/* 3-Column Magazine Stage */}
          <div className="grid grid-cols-1 @lg:grid-cols-12 items-center @lg:items-end gap-6 @lg:gap-8">
            {/* Left Column: Editorial Story & Primary CTA */}
            <div className="@lg:col-span-4 space-y-5 order-2 @lg:order-1">
              <div
                className="p-4 @sm:p-5 rounded-2xl backdrop-blur-md border"
                style={{
                  backgroundColor: palette.isDark
                    ? "rgba(30,32,38,0.75)"
                    : "rgba(255,255,255,0.75)",
                  borderColor: palette.borderSubtle,
                }}
              >
                <p
                  className="text-xs font-bold uppercase tracking-widest mb-1.5"
                  style={{ color: theme.accentColor }}
                >
                  The New Silhouette
                </p>
                <p
                  className="text-xs @sm:text-sm leading-relaxed mb-5"
                  style={{ color: palette.textSecondary }}
                >
                  {copy.heroDescription}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <StorefrontButton
                    theme={theme}
                    variant="dark"
                    size="md"
                    onClick={onPrimaryCta}
                    className="!rounded-full px-6 @sm:px-7 py-2.5 shadow-md"
                  >
                    {copy.heroPrimaryCta || "Shop Now"}
                  </StorefrontButton>
                  <button
                    type="button"
                    onClick={onSecondaryCta}
                    className="text-xs font-bold uppercase tracking-wider underline underline-offset-4 cursor-pointer"
                    style={{ color: palette.textPrimary }}
                  >
                    {copy.heroSecondaryCta || "Lookbook"}
                  </button>
                </div>
              </div>
            </div>

            {/* Center Column: Tall Arched Hero Portrait */}
            <div className="@lg:col-span-4 flex justify-center order-1 @lg:order-2">
              <div className="relative w-56 h-72 @sm:w-72 @sm:h-88 @lg:w-80 @lg:h-96 rounded-t-full rounded-b-3xl overflow-hidden shadow-2xl border-4 border-white/80">
                <img
                  src={heroImg}
                  alt={copy.heroTitle}
                  className="w-full h-full object-cover object-top"
                />
              </div>
            </div>

            {/* Right Column: Featured Look Mini Card */}
            <div className="@lg:col-span-4 order-3 flex @lg:justify-end">
              {featuredProduct && (
                <div
                  onClick={() =>
                    onSelectProduct ? onSelectProduct(featuredProduct) : onPrimaryCta()
                  }
                  className="w-full @lg:max-w-xs p-3.5 rounded-2xl backdrop-blur-md border flex items-center gap-3.5 cursor-pointer transition-transform hover:-translate-y-1 shadow-sm"
                  style={{
                    backgroundColor: palette.isDark
                      ? "rgba(30,32,38,0.82)"
                      : "rgba(255,255,255,0.85)",
                    borderColor: palette.borderSubtle,
                  }}
                >
                  <img
                    src={resolveStorefrontImageUrl(featuredProduct.primaryImageUrl) || heroImg}
                    alt={featuredProduct.name}
                    className="w-14 h-18 @sm:w-16 @sm:h-20 rounded-xl object-cover shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider block"
                      style={{ color: theme.accentColor }}
                    >
                      Featured in Look
                    </span>
                    <h3
                      className="text-xs @sm:text-sm font-bold truncate mt-0.5"
                      style={{ color: palette.textPrimary }}
                    >
                      {featuredProduct.name}
                    </h3>
                    <p
                      className="text-xs font-extrabold mt-1"
                      style={{ color: palette.textPrimary }}
                    >
                      {featuredProduct.basePriceFormatted}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ---------------------------------------------------------------------------
  // VARIANT 2: product-spotlight (Homepage-01.jpg "Palo Santo" & Minim Storefront-03)
  // ---------------------------------------------------------------------------
  if (variant === "product-spotlight") {
    return (
      <section
        className="relative overflow-hidden border-b py-10 @sm:py-14 @lg:py-20"
        style={{
          backgroundColor: palette.pageBg,
          borderColor: palette.borderSubtle,
        }}
      >
        <div className="max-w-7xl mx-auto px-3.5 @sm:px-6 @lg:px-8 grid grid-cols-1 @lg:grid-cols-12 items-center gap-8 @lg:gap-12">
          <div className="@lg:col-span-7 relative">
            <span
              className="absolute -top-8 @sm:-top-12 -left-1 text-7xl @sm:text-9xl font-serif font-black select-none pointer-events-none opacity-10 leading-none"
              style={{ color: palette.textPrimary }}
            >
              01
            </span>

            <p
              className="text-[11px] @sm:text-xs font-bold uppercase tracking-[0.2em] mb-2 relative z-10"
              style={{ color: theme.accentColor }}
            >
              {copy.heroSubtitle}
            </p>

            <h1
              className="text-3xl @sm:text-5xl @lg:text-6xl font-extrabold tracking-tight leading-[1.08] mb-4 @sm:mb-5 relative z-10 break-words"
              style={{ ...headingFont, color: palette.textPrimary }}
            >
              {copy.heroTitle}
            </h1>

            <p
              className="text-xs @sm:text-sm @lg:text-base max-w-xl mb-6 @sm:mb-8 leading-relaxed"
              style={{ color: palette.textSecondary }}
            >
              {copy.heroDescription}
            </p>

            <div className="flex flex-wrap items-center gap-3 mb-8 @sm:mb-10">
              <StorefrontButton
                theme={theme}
                variant="solid"
                size="lg"
                onClick={onPrimaryCta}
                className="uppercase tracking-wider text-xs px-6 @sm:px-8 flex-1 @sm:flex-initial"
              >
                {copy.heroPrimaryCta || "Buy Now"}
              </StorefrontButton>
              <StorefrontButton
                theme={theme}
                variant="dark"
                size="lg"
                onClick={onSecondaryCta}
                className="uppercase tracking-wider text-xs px-6 @sm:px-8 flex-1 @sm:flex-initial"
              >
                {copy.heroSecondaryCta || "Explore"}
              </StorefrontButton>
            </div>

            <div
              className="grid grid-cols-1 @sm:grid-cols-2 gap-4 @sm:gap-6 pt-5 @sm:pt-6 border-t max-w-lg"
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
                  100% authentic inventory with instant stock lock at checkout.
                </p>
              </div>
              <div>
                <h3
                  className="text-xs font-bold uppercase tracking-wider mb-1"
                  style={{ color: palette.textPrimary }}
                >
                  Express Fulfillment
                </h3>
                <p className="text-[11px] leading-relaxed" style={{ color: palette.textMuted }}>
                  Protected checkout with real-time order and dispatch rider tracking.
                </p>
              </div>
            </div>
          </div>

          <div className="@lg:col-span-5 relative flex items-center justify-center py-3">
            <div
              className={`relative w-full max-w-xs @sm:max-w-sm aspect-[4/5] ${heroRadius} overflow-hidden shadow-2xl border`}
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

            <div
              className="absolute top-0 right-2 @sm:right-4 w-16 h-16 @sm:w-20 @sm:h-20 rounded-full shadow-xl flex flex-col items-center justify-center text-center p-2"
              style={{
                backgroundColor: "#111827",
                color: "#FFFFFF",
              }}
            >
              <span className="text-xs @sm:text-sm font-black leading-none">
                {totalProductsCount}+
              </span>
              <span className="text-[8px] @sm:text-[9px] uppercase tracking-wider opacity-80 mt-0.5">
                Items Live
              </span>
            </div>

            <div
              className="absolute bottom-0 right-2 @sm:right-4 px-3.5 py-2 @sm:px-4 @sm:py-2.5 rounded-xl shadow-lg border text-center"
              style={{
                backgroundColor: palette.cardSurfaceBg,
                borderColor: palette.borderSubtle,
              }}
            >
              <p className="text-xs @sm:text-sm font-extrabold" style={{ color: palette.textPrimary }}>
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
  // ---------------------------------------------------------------------------
  if (variant === "editorial-center-overlay") {
    return (
      <section className="relative min-h-[380px] @sm:min-h-[460px] @lg:min-h-[540px] w-full overflow-hidden flex items-center justify-center text-center px-4 py-14">
        <img
          src={heroImg}
          alt={copy.heroTitle}
          className="absolute inset-0 w-full h-full object-cover brightness-75 scale-102"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/40 to-black/25" />

        <div className="relative z-10 max-w-2xl mx-auto text-white px-2">
          {copy.heroSubtitle && (
            <span className="inline-block px-3.5 @sm:px-4 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-[10px] @sm:text-[11px] font-bold uppercase tracking-[0.2em] @sm:tracking-[0.25em] text-white mb-4">
              {copy.heroSubtitle}
            </span>
          )}
          <h1
            className="text-3xl @sm:text-5xl @lg:text-7xl font-bold leading-[1.08] mb-4 drop-shadow-xs break-words"
            style={headingFont}
          >
            {copy.heroTitle}
          </h1>
          <p className="text-xs @sm:text-sm @lg:text-base text-white/85 max-w-lg mx-auto mb-7 @sm:mb-8 leading-relaxed">
            {copy.heroDescription}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <StorefrontButton
              theme={theme}
              variant="solid"
              size="lg"
              onClick={onPrimaryCta}
              className="uppercase tracking-widest text-xs px-6 @sm:px-8 shadow-lg"
            >
              {copy.heroPrimaryCta || "Shop Collection"}
            </StorefrontButton>
            <StorefrontButton
              theme={theme}
              variant="white-pill"
              size="lg"
              onClick={onSecondaryCta}
              className="uppercase tracking-widest text-xs px-6 @sm:px-7"
            >
              {copy.heroSecondaryCta || "Explore Lookbook"}
            </StorefrontButton>
          </div>
        </div>
      </section>
    );
  }

  // ---------------------------------------------------------------------------
  // VARIANT 4: dark-luxury (Illuminate Storefront-11 & Funio Storefront-09)
  // ---------------------------------------------------------------------------
  if (variant === "dark-luxury") {
    return (
      <section
        className="relative overflow-hidden py-10 @sm:py-16 @lg:py-20 text-white"
        style={{
          background: "radial-gradient(circle at 75% 40%, #2D2620 0%, #15161A 65%, #0F1013 100%)",
        }}
      >
        <div className="max-w-7xl mx-auto px-3.5 @sm:px-6 @lg:px-8 grid grid-cols-1 @lg:grid-cols-12 items-center gap-8 @lg:gap-10">
          <div className="@lg:col-span-6 space-y-4 @sm:space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-[10px] @sm:text-[11px] font-bold uppercase tracking-[0.18em]">
              <span>★</span>
              <span>{featuredProduct ? `From ${featuredProduct.basePriceFormatted}` : copy.heroSubtitle}</span>
            </div>

            <h1
              className="text-3xl @sm:text-5xl @lg:text-6xl font-bold tracking-tight leading-[1.08] break-words"
              style={headingFont}
            >
              {copy.heroTitle}
            </h1>

            <p className="text-xs @sm:text-sm @lg:text-base text-gray-300 max-w-md leading-relaxed">
              {copy.heroDescription}
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3.5">
              <StorefrontButton
                theme={theme}
                variant="solid"
                size="lg"
                onClick={onPrimaryCta}
                className="uppercase tracking-wider text-xs px-6 @sm:px-8"
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

          <div className="@lg:col-span-6 flex justify-center @lg:justify-end">
            <div className="relative w-full max-w-sm @sm:max-w-md aspect-square rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/15">
              <img
                src={heroImg}
                alt={copy.heroTitle}
                className="w-full h-full object-cover"
              />
              {featuredProduct && (
                <div
                  onClick={() =>
                    onSelectProduct ? onSelectProduct(featuredProduct) : onPrimaryCta()
                  }
                  className="absolute bottom-3 left-3 right-3 @sm:bottom-4 @sm:left-4 @sm:right-4 p-3 @sm:p-3.5 rounded-xl bg-black/75 backdrop-blur-md border border-white/15 flex items-center justify-between cursor-pointer hover:bg-black/85 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-widest text-amber-300 font-bold">
                      Spotlight Piece
                    </p>
                    <p className="text-xs @sm:text-sm font-bold text-white truncate">
                      {featuredProduct.name}
                    </p>
                  </div>
                  <span className="text-xs @sm:text-sm font-extrabold text-white shrink-0 ml-3">
                    {featuredProduct.basePriceFormatted} →
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ---------------------------------------------------------------------------
  // VARIANT 5: script-overlap (Orgamic Storefront-13.jpg)
  // ---------------------------------------------------------------------------
  if (variant === "script-overlap") {
    return (
      <section
        className="border-b py-10 @sm:py-14 @lg:py-18"
        style={{
          backgroundColor: palette.sectionAltBg,
          borderColor: palette.borderSubtle,
        }}
      >
        <div className="max-w-7xl mx-auto px-3.5 @sm:px-6 @lg:px-8 grid grid-cols-1 @md:grid-cols-12 items-center gap-8 @lg:gap-10">
          <div className="@md:col-span-5 flex justify-center">
            <div
              className={`w-full max-w-xs @sm:max-w-sm aspect-[4/5] ${heroRadius} overflow-hidden shadow-xl border`}
              style={{ borderColor: palette.borderSubtle }}
            >
              <img
                src={heroImg}
                alt={copy.heroTitle}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="@md:col-span-7 @md:pl-4 @lg:pl-6 space-y-4">
            <div>
              <span
                className="block text-3xl @sm:text-5xl @lg:text-6xl italic font-serif leading-none mb-1 select-none"
                style={{ color: theme.accentColor }}
              >
                {copy.heroScriptAccent || businessName.split(" ")[0]}
              </span>
              <h1
                className="text-2xl @sm:text-4xl @lg:text-5xl font-extrabold uppercase tracking-wider leading-tight break-words"
                style={{ ...headingFont, color: palette.textPrimary }}
              >
                {copy.heroTitle}
              </h1>
            </div>
            <p
              className="text-xs @sm:text-sm max-w-lg leading-relaxed"
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
                className="!rounded-full uppercase tracking-wider text-xs px-6 @sm:px-8"
              >
                {copy.heroPrimaryCta || "Shop Now"}
              </StorefrontButton>
              <StorefrontButton
                theme={theme}
                variant="outline"
                size="lg"
                onClick={onSecondaryCta}
                className="!rounded-full uppercase tracking-wider text-xs px-5 @sm:px-6"
              >
                {copy.heroSecondaryCta || "Collections"}
              </StorefrontButton>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ---------------------------------------------------------------------------
  // VARIANT 6 (Default): split-studio (Nyture Storefront-08, Glowing Storefront-12, Luxora)
  // ---------------------------------------------------------------------------
  return (
    <section
      className="border-b"
      style={{
        backgroundColor: palette.sectionAltBg,
        borderColor: palette.borderSubtle,
      }}
    >
      <div className="max-w-7xl mx-auto px-3.5 @sm:px-6 @lg:px-8 py-10 @sm:py-14 @lg:py-18 grid grid-cols-1 @lg:grid-cols-12 items-center gap-8 @lg:gap-10">
        <div className="@lg:col-span-6 space-y-4 @sm:space-y-5">
          <div className="inline-flex flex-wrap items-center gap-2">
            <span
              className="px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] rounded-full"
              style={{
                backgroundColor: theme.accentColor,
                color: "#FFFFFF",
              }}
            >
              {copy.heroSubtitle || "NEW COLLECTION"}
            </span>
            {featuredProduct && (
              <span className="text-xs font-bold" style={{ color: palette.textSecondary }}>
                From {featuredProduct.basePriceFormatted}
              </span>
            )}
          </div>

          <h1
            className="text-3xl @sm:text-5xl @lg:text-6xl font-bold tracking-tight leading-[1.08] break-words"
            style={{ ...headingFont, color: palette.textPrimary }}
          >
            {copy.heroTitle}
          </h1>

          <p
            className="text-xs @sm:text-sm @lg:text-base max-w-lg leading-relaxed"
            style={{ color: palette.textSecondary }}
          >
            {copy.heroDescription}
          </p>

          <div className="pt-1 flex flex-wrap items-center gap-3">
            <StorefrontButton
              theme={theme}
              variant="solid"
              size="lg"
              onClick={onPrimaryCta}
              className="uppercase tracking-wider text-xs px-6 @sm:px-8"
            >
              {copy.heroPrimaryCta || "Shop Now"}
            </StorefrontButton>
            <StorefrontButton
              theme={theme}
              variant="outline"
              size="lg"
              onClick={onSecondaryCta}
              className="uppercase tracking-wider text-xs px-6 @sm:px-7"
            >
              {copy.heroSecondaryCta || "Explore Lookbook"}
            </StorefrontButton>
          </div>

          <div
            className="pt-3 flex flex-wrap items-center gap-4 text-[11px] @sm:text-xs font-medium"
            style={{ color: palette.textMuted }}
          >
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              Instant Stock Reservation
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              Verified Escrow Checkout
            </span>
          </div>
        </div>

        <div className="@lg:col-span-6 relative flex justify-center @lg:justify-end">
          <div
            className={`relative w-full max-w-lg aspect-[5/4] overflow-hidden ${heroRadius} shadow-xl border`}
            style={{
              backgroundColor: palette.cardSurfaceBg,
              borderColor: palette.borderSubtle,
            }}
          >
            <img
              src={heroImg}
              alt={copy.heroTitle}
              className="w-full h-full object-cover"
            />

            {featuredProduct && (
              <div
                onClick={() =>
                  onSelectProduct ? onSelectProduct(featuredProduct) : onPrimaryCta()
                }
                className="absolute bottom-3 left-3 right-3 @sm:bottom-4 @sm:left-4 @sm:right-auto @sm:max-w-xs p-3 @sm:p-3.5 rounded-xl backdrop-blur-md border shadow-lg flex items-center gap-3 cursor-pointer transition-transform hover:-translate-y-0.5"
                style={{
                  backgroundColor: palette.isDark
                    ? "rgba(24, 26, 31, 0.9)"
                    : "rgba(255, 255, 255, 0.92)",
                  borderColor: palette.borderSubtle,
                }}
              >
                <img
                  src={resolveStorefrontImageUrl(
                    (secondaryProduct ?? featuredProduct).primaryImageUrl
                  ) || heroImg}
                  alt={featuredProduct.name}
                  className="w-11 h-11 @sm:w-12 @sm:h-12 rounded-lg object-cover shrink-0"
                />
                <div className="min-w-0">
                  <p
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: theme.accentColor }}
                  >
                    Featured Item
                  </p>
                  <p
                    className="text-xs font-bold truncate"
                    style={{ color: palette.textPrimary }}
                  >
                    {featuredProduct.name}
                  </p>
                  <p
                    className="text-xs font-extrabold"
                    style={{ color: palette.textSecondary }}
                  >
                    {featuredProduct.basePriceFormatted}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
