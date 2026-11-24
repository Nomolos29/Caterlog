"use client";

import React, { useEffect, useState } from "react";
import type {
  StorefrontActivePage,
  StorefrontDiscount,
  StorefrontProduct,
  StorefrontShippingZone,
} from "./types";
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
} from "./presets";
import {
  resolveStorefrontImageUrl,
  StorefrontButton,
  StorefrontSectionHeading,
} from "./primitives";

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
  shippingZones: StorefrontShippingZone[];
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
      subtitle: "Your items are held atomically while you checkout",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: "Protected Web Checkout",
      subtitle: "Instant Bank Transfer & Card payments verified in real time",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
    },
  ];

  if (variant === "3-col-feature-cards") {
    return (
      <section className="max-w-7xl mx-auto px-3.5 @sm:px-6 @lg:px-8 py-10 @sm:py-14">
        <StorefrontSectionHeading
          title="WHY CHOOSE US?"
          subtitle="Every order is backed by verified inventory reservation, protected settlement, and live tracking."
          styleVariant={headingStyle}
          theme={theme}
        />
        <div className="grid grid-cols-1 @md:grid-cols-3 gap-6 @sm:gap-8 pt-2">
          {items.slice(0, 3).map((item, idx) => (
            <div key={idx} className="text-center flex flex-col items-center px-3 @sm:px-4">
              <div
                className="w-12 h-12 @sm:w-14 @sm:h-14 rounded-full flex items-center justify-center mb-3.5 @sm:mb-4 border"
                style={{
                  backgroundColor: palette.sectionAltBg,
                  borderColor: palette.borderSubtle,
                  color: theme.accentColor,
                }}
              >
                {item.icon}
              </div>
              <h3
                className="text-sm @sm:text-base font-bold mb-1.5"
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

  if (variant === "authentic-stamp-strip") {
    const stamps = [
      "CAC VERIFIED",
      "MONNIFY ESCROW",
      "SHIPBUBBLE LOGISTICS",
      "INSTANT CHECKOUT",
      "AUTHENTIC STOCK",
    ];
    return (
      <section
        className="border-y py-5 @sm:py-7"
        style={{
          backgroundColor: palette.pageBg,
          borderColor: palette.borderSubtle,
        }}
      >
        <div className="max-w-7xl mx-auto px-3.5 @sm:px-6 @lg:px-8 flex flex-wrap items-center justify-center @md:justify-around gap-3 @sm:gap-5">
          {stamps.map((stamp) => (
            <div
              key={stamp}
              className="px-3 @sm:px-4 py-1.5 @sm:py-2 border-2 border-dashed text-center select-none opacity-75 hover:opacity-100 transition-opacity"
              style={{
                borderColor: palette.textMuted,
                color: palette.textPrimary,
              }}
            >
              <span className="text-[10px] @sm:text-xs font-extrabold tracking-[0.18em] @sm:tracking-[0.22em] uppercase">
                ★ {stamp} ★
              </span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      className="border-b py-6 @sm:py-8"
      style={{
        backgroundColor: palette.pageBg,
        borderColor: palette.borderSubtle,
      }}
    >
      <div className="max-w-7xl mx-auto px-3.5 @sm:px-6 @lg:px-8 grid grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-4 gap-4 @sm:gap-6">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-start gap-3">
            <div
              className="shrink-0 p-2 @sm:p-2.5 rounded-xl border"
              style={{
                backgroundColor: palette.sectionAltBg,
                borderColor: palette.borderSubtle,
                color: theme.accentColor,
              }}
            >
              {item.icon}
            </div>
            <div className="min-w-0">
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
  discounts: StorefrontDiscount[];
  products: StorefrontProduct[];
  onShopDeal: () => void;
}) {
  if (variant === "none") return null;

  const palette = resolveSurfacePalette(theme.surfaceMode);
  const headingFont = resolveHeadingFontStyle(theme.fontPairing);
  const cardRadius = resolveRadiusClass(theme.borderRadius, "card");
  const activeDiscount = discounts.find((d) => d.isActive);

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
    resolveStorefrontImageUrl(products[1]?.primaryImageUrl || products[0]?.primaryImageUrl) ||
    copy.heroImageUrl ||
    "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1400&q=80";

  if (variant === "countdown-banner") {
    return (
      <section className="relative my-8 @sm:my-10 py-12 @sm:py-20 @lg:py-24 overflow-hidden text-center text-white">
        <img
          src={promoImg}
          alt={copy.dealHeadline}
          className="absolute inset-0 w-full h-full object-cover brightness-50"
        />
        <div className="absolute inset-0 bg-slate-900/45" />

        <div className="relative z-10 max-w-3xl mx-auto px-4">
          <p className="text-[10px] @sm:text-xs font-bold uppercase tracking-[0.2em] @sm:tracking-[0.25em] text-white/85 mb-2">
            {activeDiscount
              ? `USE PROMO CODE: ${activeDiscount.code} (${activeDiscount.label})`
              : copy.dealDiscountLabel || "DEAL OF THE DAY"}
          </p>
          <h2 className="text-2xl @sm:text-4xl @lg:text-5xl font-bold mb-3 break-words" style={headingFont}>
            {copy.dealHeadline}
          </h2>
          <p className="text-xs @sm:text-sm text-white/80 max-w-lg mx-auto mb-6 @sm:mb-8">
            {copy.dealSubcopy}
          </p>

          <div className="grid grid-cols-4 gap-2.5 @sm:gap-5 max-w-md @sm:max-w-lg mx-auto mb-7 @sm:mb-8">
            {[
              { value: String(timeLeft.days).padStart(2, "0"), label: "Days" },
              { value: String(timeLeft.hours).padStart(2, "0"), label: "Hours" },
              { value: String(timeLeft.mins).padStart(2, "0"), label: "Mins" },
              { value: String(timeLeft.secs).padStart(2, "0"), label: "Sec" },
            ].map((box) => (
              <div key={box.label} className="flex flex-col items-center">
                <div className="w-full aspect-square max-w-[74px] @sm:max-w-[92px] bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center mb-1.5 @sm:mb-2 shadow-lg">
                  <span
                    className="text-xl @sm:text-3xl @lg:text-4xl font-bold tracking-tight"
                    style={{ color: "#FDBA74" }}
                  >
                    {box.value}
                  </span>
                </div>
                <span className="text-[10px] @sm:text-[11px] font-semibold uppercase tracking-wider text-white/85">
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
            className="uppercase tracking-widest text-xs px-8 @sm:px-9"
          >
            Shop Now
          </StorefrontButton>
        </div>
      </section>
    );
  }

  return (
    <section
      className="py-10 @sm:py-16 @lg:py-20 border-y"
      style={{
        backgroundColor: palette.sectionAltBg,
        borderColor: palette.borderSubtle,
      }}
    >
      <div className="max-w-7xl mx-auto px-3.5 @sm:px-6 @lg:px-8 grid grid-cols-1 @md:grid-cols-12 items-center gap-8 @lg:gap-10">
        <div className="@md:col-span-5 relative">
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

          <div
            className="absolute -bottom-3 right-3 @sm:-bottom-4 @sm:right-4 px-4 py-2.5 @sm:px-5 @sm:py-3.5 rounded-2xl shadow-xl border"
            style={{
              backgroundColor: palette.cardSurfaceBg,
              borderColor: palette.borderSubtle,
            }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: palette.textMuted }}>
              {copy.storyStatLabel || "Verified Customers"}
            </p>
            <p className="text-lg @sm:text-2xl font-black mt-0.5" style={{ color: palette.textPrimary }}>
              {copy.storyStatNumber || "5,000+"}
            </p>
          </div>
        </div>

        <div className="@md:col-span-7 @md:pl-4 @lg:pl-6 space-y-3.5 @sm:space-y-4">
          <p
            className="text-xs font-bold uppercase tracking-[0.2em]"
            style={{ color: theme.accentColor }}
          >
            About Our Brand
          </p>
          <h2
            className="text-2xl @sm:text-3xl @lg:text-4xl font-bold tracking-tight break-words"
            style={{ ...headingFont, color: palette.textPrimary }}
          >
            {copy.storyHeadline}
          </h2>
          <p
            className="text-xs @sm:text-sm @lg:text-base leading-relaxed"
            style={{ color: palette.textSecondary }}
          >
            {copy.storyDescription}
          </p>
          <div className="pt-2">
            <StorefrontButton theme={theme} variant="solid" size="md" onClick={onShopDeal}>
              Explore Collection
            </StorefrontButton>
          </div>
        </div>
      </div>
    </section>
  );
}

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
      quote: `"Seamless online checkout with ${businessName}. Instant payment verification and my package arrived the exact same day!"`,
      author: "Chidinma Okafor",
      location: "Lekki Phase 1, Lagos",
    },
    {
      num: "2",
      pressLogo: "HAYDEN",
      quote: `"The craftsmanship exceeded expectations and the live order tracker kept me updated from dispatch pickup to delivery."`,
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

  if (variant === "press-quote-grid") {
    return (
      <section className="py-10 @sm:py-14 @lg:py-16" style={{ backgroundColor: palette.sectionAltBg }}>
        <div className="max-w-7xl mx-auto px-3.5 @sm:px-6 @lg:px-8">
          <StorefrontSectionHeading
            title="As seen in"
            styleVariant={headingStyle}
            theme={theme}
          />
          <div className="grid grid-cols-1 @md:grid-cols-3 gap-6 @sm:gap-8 text-center">
            {reviews.map((r) => (
              <div key={r.num} className="px-3 @sm:px-4">
                <h3
                  className="text-lg @sm:text-xl font-serif font-extrabold tracking-tight mb-2.5 @sm:mb-3"
                  style={{ ...headingFont, color: palette.textPrimary }}
                >
                  {r.pressLogo}
                </h3>
                <p
                  className="text-xs @sm:text-sm font-medium leading-relaxed"
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

  return (
    <section className="max-w-7xl mx-auto px-3.5 @sm:px-6 @lg:px-8 py-10 @sm:py-14">
      <StorefrontSectionHeading
        title="Testimonials"
        styleVariant={headingStyle}
        theme={theme}
      />
      <div className="grid grid-cols-1 @md:grid-cols-3 gap-5 @sm:gap-6">
        {reviews.map((r) => (
          <div
            key={r.num}
            className={`p-5 @sm:p-6 border ${cardRadius} text-center flex flex-col items-center`}
            style={{
              backgroundColor: palette.cardSurfaceBg,
              borderColor: palette.borderSubtle,
            }}
          >
            <span
              className="w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center mb-3.5 @sm:mb-4"
              style={{
                backgroundColor: `${theme.accentColor}20`,
                color: theme.accentColor,
              }}
            >
              {r.num}
            </span>
            <p
              className="text-xs @sm:text-sm italic leading-relaxed mb-4"
              style={{ color: palette.textSecondary }}
            >
              {r.quote}
            </p>
            <p className="text-xs font-bold mt-auto" style={{ color: palette.textPrimary }}>
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
  products: StorefrontProduct[];
  onSelectProduct: (p: StorefrontProduct) => void;
}) {
  const palette = resolveSurfacePalette(theme.surfaceMode);
  const headingFont = resolveHeadingFontStyle(theme.fontPairing);
  const [contactInput, setContactInput] = useState("");
  const [subscribedMsg, setSubscribedMsg] = useState<string | null>(null);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactInput.trim()) return;
    setSubscribedMsg(`✓ Subscribed to ${businessName} new arrivals & private offers!`);
    setContactInput("");
    setTimeout(() => setSubscribedMsg(null), 5000);
  };

  if (variant === "dark-rounded-card") {
    return (
      <section className="max-w-7xl mx-auto px-3.5 @sm:px-6 @lg:px-8 py-8 @sm:py-10">
        <div className="rounded-2xl @sm:rounded-3xl bg-zinc-900 text-white p-6 @sm:p-10 @lg:p-12 grid grid-cols-1 @md:grid-cols-12 items-center gap-6 @sm:gap-8 shadow-xl">
          <div className="@md:col-span-7 space-y-4">
            <h2 className="text-xl @sm:text-3xl @lg:text-4xl font-extrabold leading-tight break-words" style={headingFont}>
              {copy.newsletterHeadline || "Ready to Get Our New Stuff?"}
            </h2>
            <form onSubmit={handleSubscribe} className="flex items-center max-w-sm bg-white rounded-full p-1.5">
              <input
                type="email"
                value={contactInput}
                onChange={(e) => setContactInput(e.target.value)}
                placeholder="Your Email Address..."
                className="flex-1 min-w-0 px-3.5 py-1.5 text-xs text-gray-900 bg-transparent focus:outline-none"
              />
              <button
                type="submit"
                className="px-4 @sm:px-5 py-2 rounded-full text-xs font-bold bg-zinc-900 text-white hover:bg-black transition-colors cursor-pointer shrink-0"
              >
                Subscribe
              </button>
            </form>
            {subscribedMsg && (
              <p className="text-xs font-semibold text-emerald-400">{subscribedMsg}</p>
            )}
          </div>

          <div className="@md:col-span-5 @md:text-right">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-1.5">
              {businessName} · Newsletter
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {copy.newsletterSubcopy}
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (variant === "instagram-strip-plus-minimal") {
    const galleryItems = products.slice(0, 6);
    return (
      <section className="pt-10">
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
              type="email"
              value={contactInput}
              onChange={(e) => setContactInput(e.target.value)}
              placeholder="Enter your email address..."
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

          <div className="grid grid-cols-2 @sm:grid-cols-3 @lg:grid-cols-6">
            {galleryItems.map((p) => (
              <div
                key={`ig-${p.id}`}
                onClick={() => onSelectProduct(p)}
                className="group relative aspect-square overflow-hidden cursor-pointer"
              >
                <img
                  src={
                    resolveStorefrontImageUrl(p.primaryImageUrl) ||
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

  return (
    <section
      className="py-7 @sm:py-9 border-y"
      style={{
        backgroundColor: palette.sectionAltBg,
        borderColor: palette.borderSubtle,
      }}
    >
      <div className="max-w-4xl mx-auto px-3.5 @sm:px-8 flex flex-col @sm:flex-row items-center justify-center gap-4 @sm:gap-6">
        <h3
          className="text-sm @sm:text-base font-extrabold tracking-tight shrink-0"
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
            type="email"
            value={contactInput}
            onChange={(e) => setContactInput(e.target.value)}
            placeholder="TYPE YOUR EMAIL ADDRESS HERE"
            className="flex-1 min-w-0 text-xs tracking-wider bg-transparent focus:outline-none"
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

export function StorefrontFooterSection({
  variant,
  theme,
  businessName,
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
  whatsappPhone?: string;
  instagramHandle?: string;
  baseCity?: string;
  baseState?: string;
  products: StorefrontProduct[];
  onSelectPage: (page: StorefrontActivePage) => void;
  onSelectProduct: (p: StorefrontProduct) => void;
}) {
  const palette = resolveSurfacePalette(theme.surfaceMode);
  const headingFont = resolveHeadingFontStyle(theme.fontPairing);

  if (variant === "minimal-single-row") {
    return (
      <footer
        className="border-t py-6 @sm:py-8 px-3.5 @sm:px-6 @lg:px-8"
        style={{
          backgroundColor: palette.pageBg,
          borderColor: palette.borderSubtle,
        }}
      >
        <div className="max-w-7xl mx-auto flex flex-col @sm:flex-row items-center justify-between gap-4 text-xs text-center @sm:text-left">
          <div>
            <span
              className="text-base font-extrabold"
              style={{ ...headingFont, color: palette.textPrimary }}
            >
              {businessName}
            </span>
            <p className="text-[11px] mt-0.5" style={{ color: palette.textMuted }}>
              © {new Date().getFullYear()} {businessName}. All rights reserved.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 @sm:gap-6" style={{ color: palette.textSecondary }}>
            <button type="button" onClick={() => onSelectPage("shop")} className="hover:underline cursor-pointer">
              Catalog
            </button>
            <button type="button" onClick={() => onSelectPage("checkout")} className="hover:underline cursor-pointer">
              Checkout
            </button>
            <button type="button" onClick={() => onSelectPage("track")} className="hover:underline cursor-pointer">
              Track Order
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="px-2.5 py-1 rounded-xs border text-[10px] font-bold" style={{ borderColor: palette.borderSubtle, color: palette.textPrimary }}>
              VISA / MASTERCARD
            </span>
            <span className="px-2.5 py-1 rounded-xs border text-[10px] font-bold" style={{ borderColor: palette.borderSubtle, color: palette.textPrimary }}>
              BANK TRANSFER
            </span>
          </div>
        </div>
      </footer>
    );
  }

  if (variant === "dark-instagram-grid") {
    return (
      <footer className="bg-zinc-900 text-zinc-300 pt-10 @sm:pt-14 pb-8 px-3.5 @sm:px-6 @lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-4 gap-8 @lg:gap-10 pb-10 border-b border-zinc-800">
          <div>
            <h3 className="text-lg font-extrabold text-white mb-3" style={headingFont}>
              {businessName}
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-3">
              {baseCity || "Ikeja"}, {baseState || "Lagos"}, Nigeria
            </p>
            {instagramHandle && (
              <p className="text-xs text-zinc-400">Instagram: {instagramHandle}</p>
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
              Customer Service
            </h4>
            <ul className="space-y-2.5 text-xs text-zinc-400">
              <li>› Protected Card & Bank Transfer Checkout</li>
              <li>› Atomic 15-Minute Stock Reservation</li>
              <li>› Real-Time Courier Tracking</li>
              <li>
                <button type="button" onClick={() => onSelectPage("checkout")} className="text-white hover:underline cursor-pointer">
                  › Proceed to Checkout
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-white mb-4">
              Featured Gallery
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
                      resolveStorefrontImageUrl(p.primaryImageUrl) ||
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

        <div className="max-w-7xl mx-auto pt-6 flex flex-col @sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-500">
          <p>© {new Date().getFullYear()} {businessName}. All Rights Reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="px-2 py-0.5 bg-zinc-800 text-zinc-300 rounded-xs font-bold">VISA / MASTERCARD</span>
            <span className="px-2 py-0.5 bg-zinc-800 text-zinc-300 rounded-xs font-bold">INSTANT TRANSFER</span>
            <span className="px-2 py-0.5 bg-zinc-800 text-zinc-300 rounded-xs font-bold">SHIPBUBBLE</span>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer
      className="border-t pt-10 @sm:pt-14 pb-8 px-3.5 @sm:px-6 @lg:px-8"
      style={{
        backgroundColor: palette.pageBg,
        borderColor: palette.borderSubtle,
      }}
    >
      <div
        className="max-w-7xl mx-auto grid grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-4 gap-8 pb-10 border-b"
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
          {instagramHandle && (
            <p className="text-xs font-medium" style={{ color: palette.textSecondary }}>
              Instagram: {instagramHandle}
            </p>
          )}
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
            Orders & Delivery
          </h4>
          <ul className="space-y-2 text-xs" style={{ color: palette.textSecondary }}>
            <li>
              <button type="button" onClick={() => onSelectPage("checkout")} className="hover:underline cursor-pointer">
                Shopping Bag & Checkout
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onSelectPage("track")} className="hover:underline cursor-pointer">
                Live Order & Courier Tracker
              </button>
            </li>
            <li>Nationwide Doorway Delivery</li>
          </ul>
        </div>

        <div>
          <h4
            className="text-xs font-extrabold uppercase tracking-wider mb-3.5"
            style={{ color: palette.textPrimary }}
          >
            Secure Checkout
          </h4>
          <p className="text-xs leading-relaxed mb-3" style={{ color: palette.textMuted }}>
            Pay securely online via Card (Visa, Mastercard, Verve) or Instant Virtual Account Transfer.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <span
              className="px-2.5 py-1 text-[10px] font-bold border rounded-xs"
              style={{ borderColor: palette.borderSubtle, color: palette.textPrimary }}
            >
              VISA / MASTERCARD
            </span>
            <span
              className="px-2.5 py-1 text-[10px] font-bold border rounded-xs"
              style={{ borderColor: palette.borderSubtle, color: palette.textPrimary }}
            >
              BANK TRANSFER
            </span>
          </div>
        </div>
      </div>

      <div
        className="max-w-7xl mx-auto pt-6 flex flex-col @sm:flex-row items-center justify-between gap-4 text-[11px] text-center @sm:text-left"
        style={{ color: palette.textMuted }}
      >
        <p>© {new Date().getFullYear()} {businessName}. All rights reserved.</p>
        <p>Instant Inventory Lock · Verified E-Commerce Storefront</p>
      </div>
    </footer>
  );
}
