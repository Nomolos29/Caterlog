"use client";

import React, { useEffect, useState } from "react";
import type { Discount, Product, ShippingZone } from "@/lib/types";
import { resolveImageUrl } from "@/lib/api";
import {
  resolveHeadingFontStyle,
  resolveRadiusClass,
  resolveSurfacePalette,
  type FooterVariantId,
  type PromoDealVariantId,
  type SectionHeadingStyleId,
  type SocialNewsletterVariantId,
  type StorefrontCopyConfig,
  type StorefrontThemeTokens,
  type TestimonialsVariantId,
  type TrustStripVariantId,
} from "@/lib/storefront-presets";
import type { StorefrontActivePage } from "./header-section";
import { StorefrontButton, StorefrontSectionHeading } from "./primitives";

// ---------------------------------------------------------------------------
// 1. TRUST & VALUE PROPOSITION STRIP SECTION
//    - 4-col-horizontal-icons (Luxora Websitelinkmockup & Glowing Storefront-12)
//    - 3-col-feature-cards (Homepage-01 "Why Choose Us?" & Orgamic Storefront-13)
//    - authentic-stamp-strip (Kylie Storefront-04 & Homepage-01 Partner Strip)
// ---------------------------------------------------------------------------

export function StorefrontTrustStripSection({
  variant,
  theme,
  headingStyle,
  isVerified,
  cacNumber,
  shippingZones,
  reservationTtlMinutes,
}: {
  variant: TrustStripVariantId;
  theme: StorefrontThemeTokens;
  headingStyle: SectionHeadingStyleId;
  isVerified: boolean;
  cacNumber?: string;
  shippingZones: ShippingZone[];
  reservationTtlMinutes: number;
}) {
  if (variant === "none") return null;

  const palette = resolveSurfacePalette(theme.surfaceMode);
  const headingFont = resolveHeadingFontStyle(theme.fontPairing);
  const lowestShipping =
    shippingZones.length > 0
      ? shippingZones.reduce((min, z) => (z.feeNaira < min.feeNaira ? z : min), shippingZones[0]!)
      : null;

  const items = [
    {
      title: lowestShipping ? `Dispatch From ${lowestShipping.feeFormatted}` : "Nationwide Dispatch",
      subtitle:
        shippingZones.length > 0
          ? `${shippingZones.length} active delivery zones available`
          : "Same-day & interstate courier fulfillment",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      title: isVerified ? "CAC Verified Business" : "Quality Guaranteed",
      subtitle: cacNumber ? `Registered (${cacNumber})` : "Carefully inspected authentic stock",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      title: `${reservationTtlMinutes}-Min Stock Lock`,
      subtitle: "Your items are held atomically while you pay",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: "Protected Escrow Checkout",
      subtitle: "Instant Monnify Virtual Account & WhatsApp receipt",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
    },
  ];

  // VARIANT 1: 3-col-feature-cards (Homepage-01.jpg "WHY CHOOSE US?" & Orgamic Storefront-13)
  if (variant === "3-col-feature-cards") {
    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-8 py-14">
        <StorefrontSectionHeading
          title="WHY CHOOSE US?"
          subtitle="Every order is backed by verified inventory reservation, protected settlement, and live tracking."
          styleVariant={headingStyle}
          theme={theme}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-2">
          {items.slice(0, 3).map((item, idx) => (
            <div key={idx} className="text-center flex flex-col items-center px-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mb-4 border"
                style={{
                  backgroundColor: palette.sectionAltBg,
                  borderColor: palette.borderSubtle,
                  color: theme.accentColor,
                }}
              >
                {item.icon}
              </div>
              <h3
                className="text-sm sm:text-base font-bold mb-1.5"
                style={{ ...headingFont, color: palette.textPrimary }}
              >
                {item.title}
              </h3>
              <p className="text-xs leading-relaxed max-w-xs" style={{ color: palette.textMuted }}>
                {item.subtitle}
              </p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // VARIANT 2: authentic-stamp-strip (Kylie Storefront-04 & Homepage-01 logo bar)
  if (variant === "authentic-stamp-strip") {
    const stamps = [
      "CAC VERIFIED",
      "MONNIFY ESCROW",
      "SHIPBUBBLE LOGISTICS",
      "WHATSAPP CO-PILOT",
      "AUTHENTIC STOCK",
    ];
    return (
      <section
        className="border-y py-7"
        style={{
          backgroundColor: palette.pageBg,
          borderColor: palette.borderSubtle,
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex flex-wrap items-center justify-around gap-6">
          {stamps.map((stamp) => (
            <div
              key={stamp}
              className="px-4 py-2 border-2 border-dashed text-center select-none opacity-70 hover:opacity-100 transition-opacity"
              style={{
                borderColor: palette.textMuted,
                color: palette.textPrimary,
              }}
            >
              <span className="text-[10px] sm:text-xs font-extrabold tracking-[0.22em] uppercase">
                ★ {stamp} ★
              </span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // VARIANT 3 (Default): 4-col-horizontal-icons (Luxora Websitelinkmockup & Glowing Storefront-12)
  return (
    <section
      className="border-b py-8"
      style={{
        backgroundColor: palette.pageBg,
        borderColor: palette.borderSubtle,
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-start gap-3.5">
            <div
              className="shrink-0 p-2.5 rounded-xl border"
              style={{
                backgroundColor: palette.sectionAltBg,
                borderColor: palette.borderSubtle,
                color: theme.accentColor,
              }}
            >
              {item.icon}
            </div>
            <div>
              <h3
                className="text-xs font-extrabold uppercase tracking-wider"
                style={{ color: palette.textPrimary }}
              >
                {item.title}
              </h3>
              <p className="text-[11px] mt-0.5 leading-snug" style={{ color: palette.textMuted }}>
                {item.subtitle}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 2. PROMO DEAL COUNTDOWN & BRAND STORY SECTION
//    - countdown-banner (Bagkin Storefront-02.jpg: Deal of the day with Days : Hours : Mins : Sec)
//    - split-story-stats (Homepage-01.jpg "About Us": Split brand story with floating stat card)
// ---------------------------------------------------------------------------

export function StorefrontPromoDealSection({
  variant,
  theme,
  copy,
  discounts,
  products,
  onShopDeal,
}: {
  variant: PromoDealVariantId;
  theme: StorefrontThemeTokens;
  copy: StorefrontCopyConfig;
  discounts: Discount[];
  products: Product[];
  onShopDeal: () => void;
}) {
  if (variant === "none") return null;

  const palette = resolveSurfacePalette(theme.surfaceMode);
  const headingFont = resolveHeadingFontStyle(theme.fontPairing);
  const cardRadius = resolveRadiusClass(theme.borderRadius, "card");
  const activeDiscount = discounts.find((d) => d.isActive);

  // Live countdown clock state
  const [timeLeft, setTimeLeft] = useState({ days: 2, hours: 14, mins: 43, secs: 19 });
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.secs > 0) return { ...prev, secs: prev.secs - 1 };
        if (prev.mins > 0) return { ...prev, mins: prev.mins - 1, secs: 59 };
        if (prev.hours > 0) return { ...prev, hours: prev.hours - 1, mins: 59, secs: 59 };
        return { days: 2, hours: 14, mins: 59, secs: 59 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const promoImg =
    resolveImageUrl(products[1]?.primaryImageUrl || products[0]?.primaryImageUrl) ||
    copy.heroImageUrl ||
    "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1400&q=80";

  // VARIANT 1: countdown-banner (Bagkin Storefront-02.jpg "Handbags 50% Off" with 4 frosted glass boxes)
  if (variant === "countdown-banner") {
    return (
      <section className="relative my-10 py-16 sm:py-24 overflow-hidden text-center text-white">
        <img
          src={promoImg}
          alt={copy.dealHeadline}
          className="absolute inset-0 w-full h-full object-cover brightness-50"
        />
        <div className="absolute inset-0 bg-slate-900/45" />

        <div className="relative z-10 max-w-3xl mx-auto px-4">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/85 mb-2">
            {activeDiscount
              ? `USE PROMO CODE: ${activeDiscount.code} (${activeDiscount.label})`
              : copy.dealDiscountLabel || "DEAL OF THE DAY"}
          </p>
          <h2
            className="text-3xl sm:text-5xl font-bold mb-3"
            style={headingFont}
          >
            {copy.dealHeadline}
          </h2>
          <p className="text-xs sm:text-sm text-white/80 max-w-lg mx-auto mb-8">
            {copy.dealSubcopy}
          </p>

          {/* 4 Frosted Glass Countdown Boxes from Bagkin Storefront-02 */}
          <div className="grid grid-cols-4 gap-3 sm:gap-5 max-w-lg mx-auto mb-8">
            {[
              { value: String(timeLeft.days).padStart(2, "0"), label: "Days" },
              { value: String(timeLeft.hours).padStart(2, "0"), label: "Hours" },
              { value: String(timeLeft.mins).padStart(2, "0"), label: "Mins" },
              { value: String(timeLeft.secs).padStart(2, "0"), label: "Sec" },
            ].map((box) => (
              <div key={box.label} className="flex flex-col items-center">
                <div className="w-full aspect-square max-w-[92px] bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center mb-2 shadow-lg">
                  <span
                    className="text-2xl sm:text-4xl font-bold tracking-tight"
                    style={{ color: "#FDBA74" }}
                  >
                    {box.value}
                  </span>
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white/85">
                  {box.label}
                </span>
              </div>
            ))}
          </div>

          <StorefrontButton
            theme={theme}
            variant="white-pill"
            size="lg"
            onClick={onShopDeal}
            className="uppercase tracking-widest text-xs px-9"
          >
            Shop Now
          </StorefrontButton>
        </div>
      </section>
    );
  }

  // VARIANT 2: split-story-stats (Homepage-01.jpg "About Us" with floating stat card)
  return (
    <section
      className="py-14 sm:py-20 border-y"
      style={{
        backgroundColor: palette.sectionAltBg,
        borderColor: palette.borderSubtle,
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-8 grid grid-cols-1 md:grid-cols-12 items-center gap-10">
        <div className="md:col-span-5 relative">
          <div
            className={`aspect-[4/3] w-full overflow-hidden ${cardRadius} shadow-lg`}
            style={{ backgroundColor: palette.cardSurfaceBg }}
          >
            <img
              src={promoImg}
              alt={copy.storyHeadline}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Floating stat badge from Homepage-01 ("Monthly Members 5000+") */}
          <div
            className="absolute -bottom-4 right-4 sm:-right-4 px-5 py-3.5 rounded-2xl shadow-xl border"
            style={{
              backgroundColor: palette.cardSurfaceBg,
              borderColor: palette.borderSubtle,
            }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: palette.textMuted }}>
              {copy.storyStatLabel || "Verified Customers"}
            </p>
            <p className="text-xl sm:text-2xl font-black mt-0.5" style={{ color: palette.textPrimary }}>
              {copy.storyStatNumber || "5,000+"}
            </p>
          </div>
        </div>

        <div className="md:col-span-7 md:pl-6 space-y-4">
          <p
            className="text-xs font-bold uppercase tracking-[0.2em]"
            style={{ color: theme.accentColor }}
          >
            About Our Studio
          </p>
          <h2
            className="text-2xl sm:text-4xl font-bold tracking-tight"
            style={{ ...headingFont, color: palette.textPrimary }}
          >
            {copy.storyHeadline}
          </h2>
          <p
            className="text-sm sm:text-base leading-relaxed"
            style={{ color: palette.textSecondary }}
          >
            {copy.storyDescription}
          </p>
          <div className="pt-2">
            <StorefrontButton
              theme={theme}
              variant="solid"
              size="md"
              onClick={onShopDeal}
            >
              Explore Collection
            </StorefrontButton>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 3. TESTIMONIALS & PRESS PROOF SECTION
//    - single-pull-quote (Luxora Websitelinkmockup.jpg)
//    - numbered-3col (Minim Storefront-03.jpg)
//    - press-quote-grid (Glowing Storefront-12.jpg "As seen in")
// ---------------------------------------------------------------------------

export function StorefrontTestimonialsSection({
  variant,
  theme,
  headingStyle,
  businessName,
}: {
  variant: TestimonialsVariantId;
  theme: StorefrontThemeTokens;
  headingStyle: SectionHeadingStyleId;
  businessName: string;
}) {
  if (variant === "none") return null;

  const palette = resolveSurfacePalette(theme.surfaceMode);
  const headingFont = resolveHeadingFontStyle(theme.fontPairing);
  const cardRadius = resolveRadiusClass(theme.borderRadius, "card");

  const reviews = [
    {
      num: "1",
      pressLogo: "Parker & Co.",
      quote: `"Great shopping experience with ${businessName}. Instant virtual account confirmation and my package arrived the exact same day!"`,
      author: "Chidinma Okafor",
      location: "Lekki Phase 1, Lagos",
    },
    {
      num: "2",
      pressLogo: "HAYDEN",
      quote: `"The product quality exceeded expectations and the WhatsApp Co-Pilot kept me updated with live courier tracking from pickup to delivery."`,
      author: "Tunde Adebayo",
      location: "Wuse II, Abuja",
    },
    {
      num: "3",
      pressLogo: "GOOD MOOD",
      quote: `"Looking to effortlessly upgrade your everyday wardrobe? Look no further than ${businessName}. Phenomenal customer service!"`,
      author: "Zainab Danjuma",
      location: "Victoria Island, Lagos",
    },
  ];

  // VARIANT 1: single-pull-quote (Luxora Websitelinkmockup.jpg)
  if (variant === "single-pull-quote") {
    return (
      <section className="max-w-4xl mx-auto px-4 sm:px-8 py-14 text-center">
        <div className="text-lg tracking-widest mb-3" style={{ color: theme.accentColor }}>
          ★★★★★
        </div>
        <blockquote
          className="text-lg sm:text-2xl italic font-medium leading-relaxed mb-3"
          style={{ ...headingFont, color: palette.textPrimary }}
        >
          {reviews[0]!.quote}
        </blockquote>
        <p
          className="text-xs font-bold uppercase tracking-[0.2em]"
          style={{ color: palette.textMuted }}
        >
          — {reviews[0]!.author} · {reviews[0]!.location}
        </p>
      </section>
    );
  }

  // VARIANT 2: press-quote-grid (Glowing Storefront-12.jpg "As seen in")
  if (variant === "press-quote-grid") {
    return (
      <section
        className="py-14 sm:py-16"
        style={{ backgroundColor: palette.sectionAltBg }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <StorefrontSectionHeading
            title="As seen in"
            styleVariant={headingStyle}
            theme={theme}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            {reviews.map((r) => (
              <div key={r.num} className="px-4">
                <h3
                  className="text-xl font-serif font-extrabold tracking-tight mb-3"
                  style={{ ...headingFont, color: palette.textPrimary }}
                >
                  {r.pressLogo}
                </h3>
                <p
                  className="text-xs sm:text-sm font-medium leading-relaxed"
                  style={{ color: palette.textSecondary }}
                >
                  {r.quote}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // VARIANT 3: numbered-3col (Minim Storefront-03.jpg)
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-8 py-14">
      <StorefrontSectionHeading
        title="Testimonials"
        styleVariant={headingStyle}
        theme={theme}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reviews.map((r) => (
          <div
            key={r.num}
            className={`p-6 border ${cardRadius} text-center flex flex-col items-center`}
            style={{
              backgroundColor: palette.cardSurfaceBg,
              borderColor: palette.borderSubtle,
            }}
          >
            <span
              className="w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center mb-4"
              style={{
                backgroundColor: `${theme.accentColor}20`,
                color: theme.accentColor,
              }}
            >
              {r.num}
            </span>
            <p
              className="text-xs sm:text-sm italic leading-relaxed mb-4"
              style={{ color: palette.textSecondary }}
            >
              {r.quote}
            </p>
            <p
              className="text-xs font-bold mt-auto"
              style={{ color: palette.textPrimary }}
            >
              {r.author}
            </p>
            <p className="text-[11px]" style={{ color: palette.textMuted }}>
              {r.location}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 4. SOCIAL & NEWSLETTER / WHATSAPP VIP CLUB SECTION
//    - dark-rounded-card (Stuffsus Shoppage-01.jpg "Ready to Get Our New Stuff?")
//    - instagram-strip-plus-minimal (Bagkin Storefront-02.jpg "SHOP INSTAGRAM")
//    - inline-fomo-bar (Kylie Storefront-04.jpg "Fear of missing out")
// ---------------------------------------------------------------------------

export function StorefrontSocialNewsletterSection({
  variant,
  theme,
  copy,
  businessName,
  instagramHandle,
  products,
  onSelectProduct,
}: {
  variant: SocialNewsletterVariantId;
  theme: StorefrontThemeTokens;
  copy: StorefrontCopyConfig;
  businessName: string;
  instagramHandle?: string;
  products: Product[];
  onSelectProduct: (p: Product) => void;
}) {
  const palette = resolveSurfacePalette(theme.surfaceMode);
  const headingFont = resolveHeadingFontStyle(theme.fontPairing);
  const [contactInput, setContactInput] = useState("");
  const [subscribedMsg, setSubscribedMsg] = useState<string | null>(null);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactInput.trim()) return;
    setSubscribedMsg(`✓ You're on ${businessName}'s VIP drop list!`);
    setContactInput("");
    setTimeout(() => setSubscribedMsg(null), 5000);
  };

  // VARIANT 1: dark-rounded-card (Stuffsus Shoppage-01.jpg)
  if (variant === "dark-rounded-card") {
    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-8 py-10">
        <div className="rounded-3xl bg-zinc-900 text-white p-8 sm:p-12 grid grid-cols-1 md:grid-cols-12 items-center gap-8 shadow-xl">
          <div className="md:col-span-7 space-y-4">
            <h2
              className="text-2xl sm:text-4xl font-extrabold leading-tight"
              style={headingFont}
            >
              {copy.newsletterHeadline || "Ready to Get Our New Stuff?"}
            </h2>
            <form onSubmit={handleSubscribe} className="flex items-center max-w-sm bg-white rounded-full p-1.5">
              <input
                type="text"
                value={contactInput}
                onChange={(e) => setContactInput(e.target.value)}
                placeholder="Your WhatsApp or Email..."
                className="flex-1 px-4 py-1.5 text-xs text-gray-900 bg-transparent focus:outline-none"
              />
              <button
                type="submit"
                className="px-5 py-2 rounded-full text-xs font-bold bg-zinc-900 text-white hover:bg-black transition-colors cursor-pointer"
              >
                Send
              </button>
            </form>
            {subscribedMsg && (
              <p className="text-xs font-semibold text-emerald-400">{subscribedMsg}</p>
            )}
          </div>

          <div className="md:col-span-5 md:text-right">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-1.5">
              {businessName} · VIP Broadcast
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {copy.newsletterSubcopy}
            </p>
          </div>
        </div>
      </section>
    );
  }

  // VARIANT 2: instagram-strip-plus-minimal (Bagkin Storefront-02.jpg)
  if (variant === "instagram-strip-plus-minimal") {
    const galleryItems = products.slice(0, 6);
    return (
      <section className="pt-10">
        {/* Newsletter underline input strip */}
        <div
          className="py-12 px-4 text-center border-t"
          style={{
            backgroundColor: palette.sectionAltBg,
            borderColor: palette.borderSubtle,
          }}
        >
          <h2
            className="text-base sm:text-lg font-bold uppercase tracking-[0.2em] mb-1"
            style={{ ...headingFont, color: palette.textPrimary }}
          >
            {copy.newsletterHeadline || "SIGN UP FOR NEWSLETTER"}
          </h2>
          <p className="text-xs mb-6" style={{ color: palette.textMuted }}>
            {copy.newsletterSubcopy}
          </p>
          <form
            onSubmit={handleSubscribe}
            className="max-w-md mx-auto flex items-center border-b pb-2"
            style={{ borderColor: palette.textPrimary }}
          >
            <input
              type="text"
              value={contactInput}
              onChange={(e) => setContactInput(e.target.value)}
              placeholder="Enter your email or WhatsApp phone..."
              className="flex-1 text-xs bg-transparent focus:outline-none"
              style={{ color: palette.textPrimary }}
            />
            <button
              type="submit"
              className="text-xs font-bold uppercase tracking-widest cursor-pointer hover:opacity-75"
              style={{ color: palette.textPrimary }}
            >
              Subscribe ›
            </button>
          </form>
          {subscribedMsg && (
            <p className="text-xs font-semibold text-emerald-600 mt-2">{subscribedMsg}</p>
          )}
        </div>

        {/* 6-Tile Edge-to-Edge SHOP INSTAGRAM Strip (Bagkin Storefront-02) */}
        <div className="pt-10 text-center">
          <div className="inline-flex flex-col items-center mb-6 px-4">
            <svg
              className="w-6 h-6 mb-2"
              style={{ color: palette.textPrimary }}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              viewBox="0 0 24 24"
            >
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
            </svg>
            <h3
              className="text-sm font-extrabold uppercase tracking-[0.22em]"
              style={{ color: palette.textPrimary }}
            >
              SHOP INSTAGRAM {instagramHandle ? `· ${instagramHandle}` : ""}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: palette.textMuted }}>
              Tap any photo to shop the featured item directly
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6">
            {galleryItems.map((p) => (
              <div
                key={`ig-${p.id}`}
                onClick={() => onSelectProduct(p)}
                className="group relative aspect-square overflow-hidden cursor-pointer"
              >
                <img
                  src={
                    resolveImageUrl(p.primaryImageUrl) ||
                    "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=500&q=80"
                  }
                  alt={p.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-3 text-white text-center">
                  <span className="text-xs font-bold truncate max-w-full">{p.name}</span>
                  <span className="text-[11px] text-white/85 mt-0.5">{p.basePriceFormatted}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // VARIANT 3: inline-fomo-bar (Kylie Storefront-04.jpg "Fear of missing out")
  return (
    <section
      className="py-9 border-y"
      style={{
        backgroundColor: palette.sectionAltBg,
        borderColor: palette.borderSubtle,
      }}
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-center gap-6">
        <h3
          className="text-sm sm:text-base font-extrabold tracking-tight shrink-0"
          style={{ ...headingFont, color: palette.textPrimary }}
        >
          {copy.newsletterHeadline || "Fear of missing out"}
        </h3>
        <form
          onSubmit={handleSubscribe}
          className="w-full max-w-md flex items-center border-b pb-1.5"
          style={{ borderColor: palette.textPrimary }}
        >
          <input
            type="text"
            value={contactInput}
            onChange={(e) => setContactInput(e.target.value)}
            placeholder="TYPE YOUR WHATSAPP OR EMAIL HERE"
            className="flex-1 text-xs tracking-wider bg-transparent focus:outline-none"
            style={{ color: palette.textPrimary }}
          />
          <button
            type="submit"
            className="text-xs font-bold uppercase tracking-widest cursor-pointer"
            style={{ color: palette.textPrimary }}
          >
            →
          </button>
        </form>
        {subscribedMsg && (
          <span className="text-xs font-semibold text-emerald-600">{subscribedMsg}</span>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 5. REUSABLE FOOTER SECTION
//    - clean-4col (Guza, Drexel, Bagkin)
//    - dark-instagram-grid (SA Storefront-01 & Illuminate Storefront-11)
//    - minimal-single-row (Minim Storefront-03)
// ---------------------------------------------------------------------------

export function StorefrontFooterSection({
  variant,
  theme,
  businessName,
  whatsappPhone,
  instagramHandle,
  baseCity,
  baseState,
  products,
  onSelectPage,
  onSelectProduct,
}: {
  variant: FooterVariantId;
  theme: StorefrontThemeTokens;
  businessName: string;
  whatsappPhone: string;
  instagramHandle?: string;
  baseCity?: string;
  baseState?: string;
  products: Product[];
  onSelectPage: (page: StorefrontActivePage) => void;
  onSelectProduct: (p: Product) => void;
}) {
  const palette = resolveSurfacePalette(theme.surfaceMode);
  const headingFont = resolveHeadingFontStyle(theme.fontPairing);
  const waLink = `https://wa.me/${whatsappPhone.replace(/\D/g, "")}`;

  // VARIANT 1: minimal-single-row (Minim Storefront-03.jpg)
  if (variant === "minimal-single-row") {
    return (
      <footer
        className="border-t py-8 px-4 sm:px-8"
        style={{
          backgroundColor: palette.pageBg,
          borderColor: palette.borderSubtle,
        }}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div>
            <span
              className="text-base font-extrabold"
              style={{ ...headingFont, color: palette.textPrimary }}
            >
              {businessName}
            </span>
            <p className="text-[11px] mt-0.5" style={{ color: palette.textMuted }}>
              © {new Date().getFullYear()} {businessName}. Powered by Caterlog Commerce.
            </p>
          </div>

          <div className="flex items-center gap-6" style={{ color: palette.textSecondary }}>
            <button type="button" onClick={() => onSelectPage("shop")} className="hover:underline cursor-pointer">
              Catalog
            </button>
            <button type="button" onClick={() => onSelectPage("track")} className="hover:underline cursor-pointer">
              Track Order
            </button>
            <a href={waLink} target="_blank" rel="noreferrer" className="hover:underline">
              WhatsApp Support
            </a>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-xs border text-[10px] font-bold" style={{ borderColor: palette.borderSubtle, color: palette.textPrimary }}>
              MONNIFY
            </span>
            <span className="px-2.5 py-1 rounded-xs border text-[10px] font-bold" style={{ borderColor: palette.borderSubtle, color: palette.textPrimary }}>
              BANK TRANSFER
            </span>
            <span className="px-2.5 py-1 rounded-xs border text-[10px] font-bold" style={{ borderColor: palette.borderSubtle, color: palette.textPrimary }}>
              VISA / MASTERCARD
            </span>
          </div>
        </div>
      </footer>
    );
  }

  // VARIANT 2: dark-instagram-grid (SA Storefront-01.jpg & Guza Storefront-06 dark footer)
  if (variant === "dark-instagram-grid") {
    return (
      <footer className="bg-zinc-900 text-zinc-300 pt-14 pb-8 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 pb-10 border-b border-zinc-800">
          <div>
            <h3 className="text-lg font-extrabold text-white mb-3" style={headingFont}>
              {businessName}
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-4">
              📍 {baseCity || "Ikeja"}, {baseState || "Lagos"}, Nigeria
            </p>
            <p className="text-xs text-zinc-400 mb-1">📞 {whatsappPhone}</p>
            {instagramHandle && (
              <p className="text-xs text-zinc-400">📸 Instagram: {instagramHandle}</p>
            )}
          </div>

          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-white mb-4">
              Quick Links
            </h4>
            <ul className="space-y-2.5 text-xs text-zinc-400">
              <li>
                <button type="button" onClick={() => onSelectPage("shop")} className="hover:text-white cursor-pointer">
                  › Shop All Inventory
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onSelectPage("collections")} className="hover:text-white cursor-pointer">
                  › Seasonal Lookbook
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onSelectPage("about")} className="hover:text-white cursor-pointer">
                  › Our Brand Story
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onSelectPage("track")} className="hover:text-white cursor-pointer">
                  › Live Order Tracker
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-white mb-4">
              Buyer Protection
            </h4>
            <ul className="space-y-2.5 text-xs text-zinc-400">
              <li>› Dynamic Monnify Virtual Account</li>
              <li>› Atomic Stock Reservation</li>
              <li>› Shipbubble Live Courier Tracking</li>
              <li>
                <a href={waLink} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">
                  › Chat with WhatsApp Co-Pilot
                </a>
              </li>
            </ul>
          </div>

          {/* 4th Column: 6-tile Instagram Photo Grid from Storefront-01 */}
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-white mb-4">
              Instagram Feed
            </h4>
            <div className="grid grid-cols-3 gap-2">
              {products.slice(0, 6).map((p) => (
                <button
                  key={`ft-ig-${p.id}`}
                  type="button"
                  onClick={() => onSelectProduct(p)}
                  className="aspect-square rounded-md overflow-hidden bg-zinc-800 hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <img
                    src={
                      resolveImageUrl(p.primaryImageUrl) ||
                      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&q=80"
                    }
                    alt={p.name}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-500">
          <p>© {new Date().getFullYear()} {businessName}. All Rights Reserved · Powered by Caterlog.</p>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-zinc-800 text-zinc-300 rounded-xs font-bold">MONNIFY</span>
            <span className="px-2 py-0.5 bg-zinc-800 text-zinc-300 rounded-xs font-bold">SHIPBUBBLE</span>
            <span className="px-2 py-0.5 bg-zinc-800 text-zinc-300 rounded-xs font-bold">WHATSAPP PAY</span>
          </div>
        </div>
      </footer>
    );
  }

  // VARIANT 3 (Default): clean-4col (Drexel, Bagkin, Constructor)
  return (
    <footer
      className="border-t pt-14 pb-8 px-4 sm:px-8"
      style={{
        backgroundColor: palette.pageBg,
        borderColor: palette.borderSubtle,
      }}
    >
      <div
        className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pb-10 border-b"
        style={{ borderColor: palette.borderSubtle }}
      >
        <div>
          <h3
            className="text-lg font-extrabold mb-3"
            style={{ ...headingFont, color: palette.textPrimary }}
          >
            {businessName}
          </h3>
          <p className="text-xs leading-relaxed mb-3" style={{ color: palette.textMuted }}>
            {baseCity || "Ikeja"}, {baseState || "Lagos"}, Nigeria
          </p>
          <p className="text-xs font-medium" style={{ color: palette.textSecondary }}>
            WhatsApp: {whatsappPhone}
          </p>
        </div>

        <div>
          <h4
            className="text-xs font-extrabold uppercase tracking-wider mb-3.5"
            style={{ color: palette.textPrimary }}
          >
            Navigation
          </h4>
          <ul className="space-y-2 text-xs" style={{ color: palette.textSecondary }}>
            <li>
              <button type="button" onClick={() => onSelectPage("shop")} className="hover:underline cursor-pointer">
                Shop Catalog
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onSelectPage("collections")} className="hover:underline cursor-pointer">
                Collections & Lookbook
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onSelectPage("about")} className="hover:underline cursor-pointer">
                About Us
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h4
            className="text-xs font-extrabold uppercase tracking-wider mb-3.5"
            style={{ color: palette.textPrimary }}
          >
            Customer Care
          </h4>
          <ul className="space-y-2 text-xs" style={{ color: palette.textSecondary }}>
            <li>
              <button type="button" onClick={() => onSelectPage("track")} className="hover:underline cursor-pointer">
                Order Tracking & Receipt
              </button>
            </li>
            <li>
              <a href={waLink} target="_blank" rel="noreferrer" className="hover:underline">
                24/7 WhatsApp Sales Co-Pilot
              </a>
            </li>
            <li>Delivery Zones & Rates</li>
          </ul>
        </div>

        <div>
          <h4
            className="text-xs font-extrabold uppercase tracking-wider mb-3.5"
            style={{ color: palette.textPrimary }}
          >
            Verified Checkout
          </h4>
          <p className="text-xs leading-relaxed mb-3" style={{ color: palette.textMuted }}>
            Instant NUBAN Virtual Account transfers & card payments verified server-to-server by Monnify.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <span
              className="px-2.5 py-1 text-[10px] font-bold border rounded-xs"
              style={{ borderColor: palette.borderSubtle, color: palette.textPrimary }}
            >
              MONNIFY ESCROW
            </span>
            <span
              className="px-2.5 py-1 text-[10px] font-bold border rounded-xs"
              style={{ borderColor: palette.borderSubtle, color: palette.textPrimary }}
            >
              SHIPBUBBLE
            </span>
          </div>
        </div>
      </div>

      <div
        className="max-w-7xl mx-auto pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px]"
        style={{ color: palette.textMuted }}
      >
        <p>© {new Date().getFullYear()} {businessName}. Powered by Caterlog.</p>
        <p>Instant Inventory Lock · Verified Merchant Storefront</p>
      </div>
    </footer>
  );
}
