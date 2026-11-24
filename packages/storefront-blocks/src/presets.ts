import type React from "react";

export type StorefrontMode = "STOREFRONT_ONLY" | "FULL_WEBSITE";

export type FontPairingId =
  | "editorial-serif"   // Playfair / Georgia + clean sans (Jenahara, Bagkin, Luxora)
  | "modern-sans"       // Inter / Geist clean geometric (Guza, Minim, Ugmonk, Stuffsus)
  | "street-geometric"  // Bold condensed uppercase / geometric (Kylie, Constructor, Drexel)
  | "luxury-warm";      // Soft editorial display + humanist sans (Glowing, Funio, Nyture)

export type SurfaceModeId =
  | "light"             // Crisp white & studio light gray (#FFFFFF / #F6F6F6)
  | "warm-cream"        // Soft alabaster & sand tones (#FAF8F5 / #F3EFEA)
  | "soft-sage"         // Botanical off-white & sage tint (#F7F9F7 / #EBF1EC)
  | "dark-luxury";      // High-contrast obsidian & charcoal (#121316 / #1C1E22)

export type BorderRadiusToken =
  | "sharp"             // 0px — Drexel, Kylie, SA, Nyture
  | "soft"              // 8px — Guza, Glowing, Bagkin
  | "rounded"           // 16px — Constructor, Jenahara
  | "pill";             // 24px — Stuffsus

export type CardToneToken =
  | "studio-gray"       // #F5F5F7 neutral studio backdrop
  | "pure-white"        // #FFFFFF with subtle border/shadow
  | "pastel-tint"       // Cycling soft pastel tints (Constructor Shoppage-03 & Kylie Storefront-04)
  | "warm-sand";        // #F4EFEA warm editorial backdrop

export interface StorefrontThemeTokens {
  fontPairing: FontPairingId;
  surfaceMode: SurfaceModeId;
  accentColor: string;
  secondaryAccentColor: string;
  borderRadius: BorderRadiusToken;
  cardTone: CardToneToken;
}

export type HeaderVariantId =
  | "minimal-inline"      // Guza, Minim, Ugmonk: Logo left, nav center, icons right
  | "centered-editorial"  // Drexel, Glowing, Funio: Nav left, centered logo, icons right + top bar
  | "stacked-boutique"    // SA (Storefront-01): Search left, framed logo center, cart right; nav row below
  | "bordered-editorial"; // Jenahara (Storefront-05): Full-width hairlines dividing Menu | Search | Nav | Cart

export type ShopBannerVariantId =
  | "overlap-typographic" // Stuffsus (Shoppage-01): Giant "Shop" over photo + docked floating search bar
  | "curved-arch"         // Constructor (Shoppage-03): Curved arch hero + straddling white pill button
  | "split-breadcrumb"    // Guza (Storefront-06): Warm banner with title/breadcrumb left & product row right
  | "minimal-rack"        // Ugmonk (Storefront-07): Full-bleed studio photography + bottom-left link
  | "promo-box";          // Drexel (Shoppage-02): Clean header + muted promo box at top of catalog

export type HeroVariantId =
  | "split-studio"             // Nyture, Glowing, Luxora: 50/50 split with promo price/tag, title, CTA & model photo
  | "magazine-layered"         // Jenahara (Storefront-05): Giant brand title behind cutout portrait + ribbon curve
  | "product-spotlight"        // Homepage-01 (Palo Santo) & Minim: Watermark 01/02, dual CTAs, specs & stat bubbles
  | "editorial-center-overlay" // Bagkin & Kylie: Full-bleed dark/street-style image with centered headline & CTA
  | "dark-luxury"              // Illuminate & Funio: Charcoal/taupe dark hero transitioning to light body
  | "script-overlap";          // Orgamic (Storefront-13): Script accent word overlapping uppercase display headline

export type ProductCardVariantId =
  | "dual-action-rounded"       // Stuffsus (Shoppage-01): Category pill, stars, price, [Add to Bag] + [Buy Now] buttons
  | "pastel-floating-cart"      // Constructor (Shoppage-03): Pastel background + floating circular white cart button
  | "lookbook-gradient-overlay" // Jenahara (Storefront-05): Tall portrait with bottom gradient overlay holding title/price/cart
  | "minimal-swatch-studio"     // Guza, Ugmonk, Bagkin: Clean studio frame, title, price & interactive color swatches
  | "boutique-badged";          // Drexel, Funio, Glowing: Corner badges (HOT/SALE/-20%), stars, compare-at & full-width/underline CTA

export type CategoryBentoVariantId =
  | "4-tile-left-tall"        // Bagkin (Storefront-02): 1 tall left + 1 wide top-right + 2 square bottom-right
  | "4-tile-right-tall"       // Nyture (Storefront-08) & Illuminate: Left stack + 1 tall right lookbook hero tile
  | "6-tile-editorial-mosaic" // Kylie (Storefront-04): 2 stacked pastel left + 1 big square right + 3 bottom tiles
  | "2-col-split-banners"     // Funio, Glowing, Orgamic: 2 side-by-side landscape collection cards
  | "thumbnail-strip";        // Funio Top Categories & Storefront-10: 3-to-5 clean category thumbnail cards

export type FilterLayoutVariantId =
  | "sidebar-full"           // Stuffsus, Drexel, Constructor: Left sidebar with Categories, Price, Colors & Sizes
  | "horizontal-popover-bar" // Guza (Storefront-06): Top filter dropdown pills + Sort + 2/3/4 column density toggle
  | "centered-category-tabs";// SA, Ugmonk, Funio: Centered pill or underline category tabs above grid

export type SectionHeadingStyleId =
  | "clean-centered" // Minim, Glowing, Bagkin
  | "flanking-lines" // Nyture (Storefront-08): ─── OUR MUST HAVE ───
  | "framed-box"     // Orgamic (Storefront-13): [ BEST SELLERS ]
  | "left-with-link";// Illuminate & Stuffsus: Left bold heading + right "Explore all →"

export type TrustStripVariantId =
  | "4-col-horizontal-icons" // Luxora & Glowing: 4 horizontal icon + title + subtitle items
  | "3-col-feature-cards"    // Homepage-01 ("Why Choose Us?") & Orgamic: 3 centered icon feature columns
  | "authentic-stamp-strip"  // Kylie & Homepage-01: Authentic / Verified stamp & partner badges row
  | "none";

export type PromoDealVariantId =
  | "countdown-banner"  // Bagkin (Storefront-02): Deal of the day with Days : Hours : Mins : Sec glass boxes
  | "split-story-stats" // Homepage-01 ("About Us"): Split brand story with floating stat badge (5000+ Customers)
  | "none";

export type TestimonialsVariantId =
  | "single-pull-quote" // Luxora (Websitelinkmockup): 5-star centered editorial pull quote
  | "numbered-3col"     // Minim (Storefront-03): Numbered 1, 2, 3 three-column testimonial cards
  | "press-quote-grid"  // Glowing (Storefront-12 "As seen in"): Brand/press headers with quotes underneath
  | "none";

export type SocialNewsletterVariantId =
  | "dark-rounded-card"            // Stuffsus (Shoppage-01): Dark rounded banner "Ready to Get Our New Stuff?"
  | "instagram-strip-plus-minimal" // Bagkin (Storefront-02): 6-tile edge-to-edge Instagram strip + minimal input
  | "inline-fomo-bar";             // Kylie (Storefront-04): Horizontal "Fear of missing out" bar

export type FooterVariantId =
  | "clean-4col"          // Guza, Drexel, Bagkin: 4-column links + payment icons
  | "dark-instagram-grid" // SA (Storefront-01) & Illuminate: Dark charcoal footer with 6-tile Instagram grid
  | "minimal-single-row"; // Minim (Storefront-03): Single compact row with logo, newsletter & payment icons

export interface StorefrontCopyConfig {
  announcementText: string;
  heroSubtitle: string;
  heroTitle: string;
  heroScriptAccent?: string;
  heroDescription: string;
  heroPrimaryCta: string;
  heroSecondaryCta: string;
  heroImageUrl?: string;
  heroPromoPrice?: string;
  heroComparePrice?: string;
  dealHeadline: string;
  dealSubcopy: string;
  dealDiscountLabel: string;
  storyHeadline: string;
  storyDescription: string;
  storyStatNumber: string;
  storyStatLabel: string;
  newsletterHeadline: string;
  newsletterSubcopy: string;
}

export interface StorefrontSectionVisibility {
  showAnnouncementBar: boolean;
  showTrustStrip: boolean;
  showCategoryBento: boolean;
  showFeaturedCarousel: boolean;
  showPromoDeal: boolean;
  showBrandStory: boolean;
  showTestimonials: boolean;
  showSocialNewsletter: boolean;
}

export interface StorefrontConfig {
  presetId: string;
  mode: StorefrontMode;
  theme: StorefrontThemeTokens;
  headerVariant: HeaderVariantId;
  shopBannerVariant: ShopBannerVariantId;
  heroVariant: HeroVariantId;
  productCardVariant: ProductCardVariantId;
  categoryBentoVariant: CategoryBentoVariantId;
  filterLayoutVariant: FilterLayoutVariantId;
  sectionHeadingStyle: SectionHeadingStyleId;
  trustStripVariant: TrustStripVariantId;
  promoDealVariant: PromoDealVariantId;
  testimonialsVariant: TestimonialsVariantId;
  socialNewsletterVariant: SocialNewsletterVariantId;
  footerVariant: FooterVariantId;
  gridColumns: 3 | 4;
  visibility: StorefrontSectionVisibility;
  copy: StorefrontCopyConfig;
  customDomain?: string;
}

export interface StorefrontPresetDefinition {
  id: string;
  name: string;
  tagline: string;
  mockupReference: string;
  recommendedTier: "STARTER_RESELLER" | "GROWTH_PRO";
  categoryFocus: string;
  previewBadgeColor: string;
  config: StorefrontConfig;
}

export function canUseFullWebsiteMode(roleOrPlan?: string): boolean {
  if (!roleOrPlan) return false;
  const normalized = roleOrPlan.trim().toUpperCase();
  return (
    normalized === "GROWTH" ||
    normalized === "PRO" ||
    normalized === "SCALE" ||
    normalized === "ENTERPRISE" ||
    normalized === "SUPPLIER"
  );
}

export function resolveRadiusClass(
  token: BorderRadiusToken,
  target: "card" | "button" | "badge" | "input" = "card"
): string {
  switch (token) {
    case "sharp":
      return "rounded-none";
    case "soft":
      return target === "card" ? "rounded-lg" : "rounded-md";
    case "rounded":
      return target === "card" ? "rounded-2xl" : target === "button" ? "rounded-xl" : "rounded-lg";
    case "pill":
      return target === "card" ? "rounded-3xl" : "rounded-full";
  }
}

export function resolveHeadingFontStyle(pairing: FontPairingId): React.CSSProperties {
  switch (pairing) {
    case "editorial-serif":
      return {
        fontFamily: "'Playfair Display', 'Cormorant Garamond', Georgia, serif",
        letterSpacing: "-0.02em",
      };
    case "luxury-warm":
      return {
        fontFamily: "'Georgia', 'Times New Roman', serif",
        letterSpacing: "-0.015em",
      };
    case "street-geometric":
      return {
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        letterSpacing: "0.03em",
        textTransform: "uppercase" as const,
      };
    case "modern-sans":
    default:
      return {
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        letterSpacing: "-0.025em",
      };
  }
}

export function resolveSurfacePalette(mode: SurfaceModeId): {
  pageBg: string;
  sectionAltBg: string;
  cardSurfaceBg: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  borderSubtle: string;
  isDark: boolean;
} {
  switch (mode) {
    case "warm-cream":
      return {
        pageBg: "#FAF8F5",
        sectionAltBg: "#F3EFEA",
        cardSurfaceBg: "#FFFFFF",
        textPrimary: "#18181B",
        textSecondary: "#52525B",
        textMuted: "#71717A",
        borderSubtle: "#E7E2DA",
        isDark: false,
      };
    case "soft-sage":
      return {
        pageBg: "#F8FAF8",
        sectionAltBg: "#EDF3EE",
        cardSurfaceBg: "#FFFFFF",
        textPrimary: "#142218",
        textSecondary: "#3F5244",
        textMuted: "#657A6B",
        borderSubtle: "#DCE6DE",
        isDark: false,
      };
    case "dark-luxury":
      return {
        pageBg: "#111215",
        sectionAltBg: "#181A1F",
        cardSurfaceBg: "#1E2026",
        textPrimary: "#F9FAFB",
        textSecondary: "#D1D5DB",
        textMuted: "#9CA3AF",
        borderSubtle: "#2D3039",
        isDark: true,
      };
    case "light":
    default:
      return {
        pageBg: "#FFFFFF",
        sectionAltBg: "#F7F7F8",
        cardSurfaceBg: "#FFFFFF",
        textPrimary: "#111827",
        textSecondary: "#4B5563",
        textMuted: "#6B7280",
        borderSubtle: "#E5E7EB",
        isDark: false,
      };
  }
}

const PASTEL_PALETTE = [
  "#D8E2DC",
  "#BCE0EA",
  "#B8B8D1",
  "#C5D1DF",
  "#E2DCE0",
  "#C8D6CE",
  "#E5ECD2",
  "#DDD2C2",
  "#EAC5C8",
];

export function resolveCardImageBackdrop(
  tone: CardToneToken,
  index: number,
  isDarkSurface = false
): string {
  if (isDarkSurface && tone !== "pastel-tint") {
    return "#252830";
  }
  switch (tone) {
    case "pastel-tint":
      return PASTEL_PALETTE[index % PASTEL_PALETTE.length]!;
    case "pure-white":
      return "#FFFFFF";
    case "warm-sand":
      return "#F4EFEA";
    case "studio-gray":
    default:
      return "#F4F4F6";
  }
}

export const STOREFRONT_PRESETS: StorefrontPresetDefinition[] = [
  {
    id: "stuffsus-shop",
    name: "Stuffsus Modern Shop",
    tagline: "Bold typographic banner with docked search bar, category sidebar & dual Buy Now buttons",
    mockupReference: "Shoppage-01.jpg",
    recommendedTier: "STARTER_RESELLER",
    categoryFocus: "Multi-Category / Gadgets / Everyday Retail",
    previewBadgeColor: "#111827",
    config: {
      presetId: "stuffsus-shop",
      mode: "STOREFRONT_ONLY",
      theme: {
        fontPairing: "modern-sans",
        surfaceMode: "light",
        accentColor: "#111827",
        secondaryAccentColor: "#F3F4F6",
        borderRadius: "pill",
        cardTone: "studio-gray",
      },
      headerVariant: "minimal-inline",
      shopBannerVariant: "overlap-typographic",
      heroVariant: "split-studio",
      productCardVariant: "dual-action-rounded",
      categoryBentoVariant: "thumbnail-strip",
      filterLayoutVariant: "sidebar-full",
      sectionHeadingStyle: "left-with-link",
      trustStripVariant: "4-col-horizontal-icons",
      promoDealVariant: "none",
      testimonialsVariant: "none",
      socialNewsletterVariant: "dark-rounded-card",
      footerVariant: "clean-4col",
      gridColumns: 3,
      visibility: {
        showAnnouncementBar: false,
        showTrustStrip: true,
        showCategoryBento: false,
        showFeaturedCarousel: true,
        showPromoDeal: false,
        showBrandStory: false,
        showTestimonials: false,
        showSocialNewsletter: true,
      },
      copy: {
        announcementText: "Complimentary Express Dispatch on Eligible Orders · Protected Escrow Checkout",
        heroSubtitle: "Give All You Need",
        heroTitle: "Shop",
        heroDescription: "Browse verified inventory with instant stock reservation and fast doorway delivery.",
        heroPrimaryCta: "Shop Now",
        heroSecondaryCta: "View Lookbook",
        heroImageUrl: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1400&q=80",
        dealHeadline: "Flash Drop — Limited Pieces",
        dealSubcopy: "Reserve your piece before the timer expires.",
        dealDiscountLabel: "Up to 30% Off",
        storyHeadline: "Built for Fast, Trusted Commerce",
        storyDescription: "Every order is backed by verified inventory reservation and instant payment confirmation.",
        storyStatNumber: "5,000+",
        storyStatLabel: "Fulfilled Orders",
        newsletterHeadline: "Ready to Get Our New Stuff?",
        newsletterSubcopy: "Subscribe for new arrival alerts and exclusive seasonal discount codes.",
      },
    },
  },
  {
    id: "constructor-kicks",
    name: "Constructor Sneaker Lab",
    tagline: "Curved arch hero, pastel product cards with floating cart buttons & size/color matrix sidebar",
    mockupReference: "Shoppage-03.jpg",
    recommendedTier: "STARTER_RESELLER",
    categoryFocus: "Footwear / Sneakers / Streetwear",
    previewBadgeColor: "#4F46E5",
    config: {
      presetId: "constructor-kicks",
      mode: "STOREFRONT_ONLY",
      theme: {
        fontPairing: "street-geometric",
        surfaceMode: "light",
        accentColor: "#4F46E5",
        secondaryAccentColor: "#EEF2FF",
        borderRadius: "rounded",
        cardTone: "pastel-tint",
      },
      headerVariant: "minimal-inline",
      shopBannerVariant: "curved-arch",
      heroVariant: "editorial-center-overlay",
      productCardVariant: "pastel-floating-cart",
      categoryBentoVariant: "4-tile-left-tall",
      filterLayoutVariant: "sidebar-full",
      sectionHeadingStyle: "left-with-link",
      trustStripVariant: "4-col-horizontal-icons",
      promoDealVariant: "none",
      testimonialsVariant: "none",
      socialNewsletterVariant: "inline-fomo-bar",
      footerVariant: "clean-4col",
      gridColumns: 3,
      visibility: {
        showAnnouncementBar: true,
        showTrustStrip: false,
        showCategoryBento: false,
        showFeaturedCarousel: true,
        showPromoDeal: false,
        showBrandStory: false,
        showTestimonials: false,
        showSocialNewsletter: true,
      },
      copy: {
        announcementText: "Same-Day Dispatch in Lagos · Nationwide Courier Delivery",
        heroSubtitle: "New Season Footwear & Apparel",
        heroTitle: "Signature Kicks & Drops",
        heroDescription: "Authentic pairs and limited runs with live size availability.",
        heroPrimaryCta: "Shop Now",
        heroSecondaryCta: "Size Guide",
        heroImageUrl: "https://images.unsplash.com/photo-1552346154-21d32810aba3?w=1400&q=80",
        dealHeadline: "Weekend Drop Special",
        dealSubcopy: "Use your promo code at checkout for instant savings.",
        dealDiscountLabel: "20% Off Selected Pairs",
        storyHeadline: "Curated Footwear & Street Culture",
        storyDescription: "Every pair is inspected, verified, and shipped in protective double-box packaging.",
        storyStatNumber: "100%",
        storyStatLabel: "Verified Stock",
        newsletterHeadline: "Never Miss a Limited Size Drop",
        newsletterSubcopy: "Enter your email to get notified 1 hour before public restocks.",
      },
    },
  },
  {
    id: "guza-atelier",
    name: "Guza Minimal Atelier",
    tagline: "Warm cream shop banner, horizontal popover filters with 2/3/4 column toggle & color swatch cards",
    mockupReference: "Storefront-06.jpg",
    recommendedTier: "STARTER_RESELLER",
    categoryFocus: "Clothing / Ready-to-Wear / Fashion Boutiques",
    previewBadgeColor: "#1F2937",
    config: {
      presetId: "guza-atelier",
      mode: "STOREFRONT_ONLY",
      theme: {
        fontPairing: "modern-sans",
        surfaceMode: "warm-cream",
        accentColor: "#18181B",
        secondaryAccentColor: "#F4EFEA",
        borderRadius: "soft",
        cardTone: "studio-gray",
      },
      headerVariant: "minimal-inline",
      shopBannerVariant: "split-breadcrumb",
      heroVariant: "split-studio",
      productCardVariant: "minimal-swatch-studio",
      categoryBentoVariant: "2-col-split-banners",
      filterLayoutVariant: "horizontal-popover-bar",
      sectionHeadingStyle: "clean-centered",
      trustStripVariant: "4-col-horizontal-icons",
      promoDealVariant: "none",
      testimonialsVariant: "none",
      socialNewsletterVariant: "dark-rounded-card",
      footerVariant: "dark-instagram-grid",
      gridColumns: 4,
      visibility: {
        showAnnouncementBar: false,
        showTrustStrip: true,
        showCategoryBento: false,
        showFeaturedCarousel: false,
        showPromoDeal: false,
        showBrandStory: false,
        showTestimonials: false,
        showSocialNewsletter: true,
      },
      copy: {
        announcementText: "Complimentary signature packaging on all orders",
        heroSubtitle: "Home › Shop Collection",
        heroTitle: "Shop",
        heroDescription: "Elevated everyday wardrobe essentials crafted in small batches.",
        heroPrimaryCta: "Explore Collection",
        heroSecondaryCta: "Lookbook",
        heroImageUrl: "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=1400&q=80",
        dealHeadline: "Archive Sale",
        dealSubcopy: "End-of-season pieces at special studio prices.",
        dealDiscountLabel: "Receive an exclusive 20% discount",
        storyHeadline: "Modern Wardrobe Staples",
        storyDescription: "Designed for effortless layering and tailored comfort.",
        storyStatNumber: "4.9★",
        storyStatLabel: "Buyer Rating",
        newsletterHeadline: "Receive an exclusive 20% discount code when you signup.",
        newsletterSubcopy: "Be the first to shop seasonal capsules.",
      },
    },
  },
  {
    id: "ugmonk-essentials",
    name: "Ugmonk Clean Essentials",
    tagline: "Warm terracotta full-bleed rack banner, centered underline tabs & ultra-clean 4-column studio grid",
    mockupReference: "Storefront-07.jpg",
    recommendedTier: "STARTER_RESELLER",
    categoryFocus: "Apparel Basics / Tees / Lifestyle Objects",
    previewBadgeColor: "#9A6B53",
    config: {
      presetId: "ugmonk-essentials",
      mode: "STOREFRONT_ONLY",
      theme: {
        fontPairing: "modern-sans",
        surfaceMode: "light",
        accentColor: "#7C523E",
        secondaryAccentColor: "#F5EBE6",
        borderRadius: "sharp",
        cardTone: "studio-gray",
      },
      headerVariant: "minimal-inline",
      shopBannerVariant: "minimal-rack",
      heroVariant: "editorial-center-overlay",
      productCardVariant: "minimal-swatch-studio",
      categoryBentoVariant: "thumbnail-strip",
      filterLayoutVariant: "centered-category-tabs",
      sectionHeadingStyle: "clean-centered",
      trustStripVariant: "none",
      promoDealVariant: "none",
      testimonialsVariant: "none",
      socialNewsletterVariant: "inline-fomo-bar",
      footerVariant: "minimal-single-row",
      gridColumns: 4,
      visibility: {
        showAnnouncementBar: false,
        showTrustStrip: false,
        showCategoryBento: false,
        showFeaturedCarousel: false,
        showPromoDeal: false,
        showBrandStory: false,
        showTestimonials: false,
        showSocialNewsletter: true,
      },
      copy: {
        announcementText: "New Essential Capsule Now Live",
        heroSubtitle: "Small Batch Production",
        heroTitle: "New Essential Collection",
        heroDescription: "Thoughtfully designed essentials with zero clutter.",
        heroPrimaryCta: "Learn more →",
        heroSecondaryCta: "Browse All",
        heroImageUrl: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=1400&q=80",
        dealHeadline: "Bundle & Save",
        dealSubcopy: "Pick any 3 essentials for an automatic discount.",
        dealDiscountLabel: "Save 15%",
        storyHeadline: "Simplicity in Every Stitch",
        storyDescription: "We focus on heavyweight fabrics, clean lines, and timeless tones.",
        storyStatNumber: "15m",
        storyStatLabel: "Instant Reservation",
        newsletterHeadline: "Join the Studio Dispatch",
        newsletterSubcopy: "Occasional notes on new releases and restocks.",
      },
    },
  },
  {
    id: "drexel-catalog",
    name: "Drexel Architectural Catalog",
    tagline: "Centered editorial header, rich sidebar filter with promo header box & sharp badged studio cards",
    mockupReference: "Shoppage-02.jpg",
    recommendedTier: "STARTER_RESELLER",
    categoryFocus: "Home / Accessories / Minimal Fashion",
    previewBadgeColor: "#171717",
    config: {
      presetId: "drexel-catalog",
      mode: "STOREFRONT_ONLY",
      theme: {
        fontPairing: "street-geometric",
        surfaceMode: "light",
        accentColor: "#171717",
        secondaryAccentColor: "#F5F5F5",
        borderRadius: "sharp",
        cardTone: "studio-gray",
      },
      headerVariant: "centered-editorial",
      shopBannerVariant: "promo-box",
      heroVariant: "split-studio",
      productCardVariant: "boutique-badged",
      categoryBentoVariant: "thumbnail-strip",
      filterLayoutVariant: "sidebar-full",
      sectionHeadingStyle: "framed-box",
      trustStripVariant: "4-col-horizontal-icons",
      promoDealVariant: "none",
      testimonialsVariant: "none",
      socialNewsletterVariant: "inline-fomo-bar",
      footerVariant: "clean-4col",
      gridColumns: 3,
      visibility: {
        showAnnouncementBar: false,
        showTrustStrip: false,
        showCategoryBento: false,
        showFeaturedCarousel: false,
        showPromoDeal: false,
        showBrandStory: false,
        showTestimonials: false,
        showSocialNewsletter: false,
      },
      copy: {
        announcementText: "Verified Merchant Storefront",
        heroSubtitle: "NEW STYLE COLLECTION",
        heroTitle: "BLACK & MONOCHROME",
        heroDescription: "Curated contemporary pieces with architectural precision and enduring quality.",
        heroPrimaryCta: "Shop Collection",
        heroSecondaryCta: "Filter Catalog",
        heroImageUrl: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=1400&q=80",
        dealHeadline: "Seasonal Selection",
        dealSubcopy: "Limited quantities available for immediate dispatch.",
        dealDiscountLabel: "HOT & SALE",
        storyHeadline: "Design-Driven Objects",
        storyDescription: "Every item in our catalog is selected for form, utility, and longevity.",
        storyStatNumber: "24h",
        storyStatLabel: "Dispatch Turnaround",
        newsletterHeadline: "Stay Updated on New Arrivals",
        newsletterSubcopy: "Subscribe for private sale access.",
      },
    },
  },
  {
    id: "jenahara-editorial",
    name: "Jenahara Magazine Couture",
    tagline: "Magazine-cover layered serif hero, bordered editorial header & gradient-overlay portrait lookbook cards",
    mockupReference: "Storefront-05.jpg",
    recommendedTier: "GROWTH_PRO",
    categoryFocus: "Luxury Fashion / Modest Couture / Womenswear",
    previewBadgeColor: "#5B2333",
    config: {
      presetId: "jenahara-editorial",
      mode: "FULL_WEBSITE",
      theme: {
        fontPairing: "editorial-serif",
        surfaceMode: "light",
        accentColor: "#111111",
        secondaryAccentColor: "#5B2333",
        borderRadius: "rounded",
        cardTone: "studio-gray",
      },
      headerVariant: "bordered-editorial",
      shopBannerVariant: "split-breadcrumb",
      heroVariant: "magazine-layered",
      productCardVariant: "lookbook-gradient-overlay",
      categoryBentoVariant: "4-tile-right-tall",
      filterLayoutVariant: "horizontal-popover-bar",
      sectionHeadingStyle: "clean-centered",
      trustStripVariant: "4-col-horizontal-icons",
      promoDealVariant: "split-story-stats",
      testimonialsVariant: "single-pull-quote",
      socialNewsletterVariant: "instagram-strip-plus-minimal",
      footerVariant: "clean-4col",
      gridColumns: 3,
      visibility: {
        showAnnouncementBar: false,
        showTrustStrip: true,
        showCategoryBento: true,
        showFeaturedCarousel: true,
        showPromoDeal: true,
        showBrandStory: true,
        showTestimonials: true,
        showSocialNewsletter: true,
      },
      copy: {
        announcementText: "Complimentary Express Delivery on Couture Orders",
        heroSubtitle: "Step Into Effortless Elegance",
        heroTitle: "NEW SEASON ATELIER",
        heroDescription: "Our new arrivals are tailored to withstand your busiest days while keeping you looking your absolute best.",
        heroPrimaryCta: "Shop Now",
        heroSecondaryCta: "Explore Lookbook",
        heroImageUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1200&q=80",
        dealHeadline: "The Signature Capsule",
        dealSubcopy: "Hand-finished silhouettes crafted in small runs for discerning wardrobes.",
        dealDiscountLabel: "Limited Edition",
        storyHeadline: "Craftsmanship Meets Contemporary Poise",
        storyDescription: "Every garment is cut from breathable premium textiles and finished by master tailors in our studio.",
        storyStatNumber: "5,000+",
        storyStatLabel: "Private Clients",
        newsletterHeadline: "Join Our Private Lookbook List",
        newsletterSubcopy: "Receive first access to runway drops and trunk show invitations.",
      },
    },
  },
  {
    id: "bagkin-lookbook",
    name: "Bagkin Leather & Lookbook",
    tagline: "Editorial centered hero, 4-tile left-tall category bento, deal of the day countdown & 6-tile Instagram strip",
    mockupReference: "Storefront-02.jpg",
    recommendedTier: "GROWTH_PRO",
    categoryFocus: "Handbags / Footwear / Fashion Accessories",
    previewBadgeColor: "#C89D7C",
    config: {
      presetId: "bagkin-lookbook",
      mode: "FULL_WEBSITE",
      theme: {
        fontPairing: "editorial-serif",
        surfaceMode: "light",
        accentColor: "#B87D5B",
        secondaryAccentColor: "#F9F5F1",
        borderRadius: "soft",
        cardTone: "studio-gray",
      },
      headerVariant: "centered-editorial",
      shopBannerVariant: "split-breadcrumb",
      heroVariant: "editorial-center-overlay",
      productCardVariant: "minimal-swatch-studio",
      categoryBentoVariant: "4-tile-left-tall",
      filterLayoutVariant: "centered-category-tabs",
      sectionHeadingStyle: "clean-centered",
      trustStripVariant: "4-col-horizontal-icons",
      promoDealVariant: "countdown-banner",
      testimonialsVariant: "single-pull-quote",
      socialNewsletterVariant: "instagram-strip-plus-minimal",
      footerVariant: "clean-4col",
      gridColumns: 4,
      visibility: {
        showAnnouncementBar: true,
        showTrustStrip: true,
        showCategoryBento: true,
        showFeaturedCarousel: true,
        showPromoDeal: true,
        showBrandStory: false,
        showTestimonials: true,
        showSocialNewsletter: true,
      },
      copy: {
        announcementText: "All items in Season Collection up to 30% Off · Protected Escrow Checkout",
        heroSubtitle: "Curated Leather & Accessories",
        heroTitle: "Lookbook Inspiration",
        heroDescription: "Timeless silhouettes, supple textures, and everyday versatility.",
        heroPrimaryCta: "Shop All Collection",
        heroSecondaryCta: "Our Best Sellers",
        heroImageUrl: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=1400&q=80",
        dealHeadline: "Nature Deal of the Day — 50% Off",
        dealSubcopy: "Limited-time flash offer on our most-requested pieces before the timer hits zero.",
        dealDiscountLabel: "Flash Deal",
        storyHeadline: "Designed to Carry Your World",
        storyDescription: "From structured satchels to relaxed totes, every piece balances form and function.",
        storyStatNumber: "4.9★",
        storyStatLabel: "Verified Reviews",
        newsletterHeadline: "Sign Up For Newsletter",
        newsletterSubcopy: "Subscribe to receive restock updates and private voucher codes.",
      },
    },
  },
  {
    id: "kylie-street-mosaic",
    name: "Kylie Street Editorial",
    tagline: "Street-style hero, 3-col icon trust bar, 6-tile pastel editorial bento mosaic & vintage authenticity stamps",
    mockupReference: "Storefront-04.jpg & Storefront-08.jpg",
    recommendedTier: "GROWTH_PRO",
    categoryFocus: "Streetwear / Contemporary Fashion / Multi-Brand",
    previewBadgeColor: "#5F7A7B",
    config: {
      presetId: "kylie-street-mosaic",
      mode: "FULL_WEBSITE",
      theme: {
        fontPairing: "street-geometric",
        surfaceMode: "light",
        accentColor: "#5F7A7B",
        secondaryAccentColor: "#F2ECE9",
        borderRadius: "sharp",
        cardTone: "pastel-tint",
      },
      headerVariant: "centered-editorial",
      shopBannerVariant: "overlap-typographic",
      heroVariant: "editorial-center-overlay",
      productCardVariant: "boutique-badged",
      categoryBentoVariant: "6-tile-editorial-mosaic",
      filterLayoutVariant: "horizontal-popover-bar",
      sectionHeadingStyle: "flanking-lines",
      trustStripVariant: "authentic-stamp-strip",
      promoDealVariant: "countdown-banner",
      testimonialsVariant: "numbered-3col",
      socialNewsletterVariant: "inline-fomo-bar",
      footerVariant: "clean-4col",
      gridColumns: 4,
      visibility: {
        showAnnouncementBar: true,
        showTrustStrip: true,
        showCategoryBento: true,
        showFeaturedCarousel: true,
        showPromoDeal: false,
        showBrandStory: false,
        showTestimonials: true,
        showSocialNewsletter: true,
      },
      copy: {
        announcementText: "Express Nationwide Delivery · Live Order & Courier Tracking",
        heroSubtitle: "New Streetwear Capsule",
        heroTitle: "Wear What Defines Your Rhythm",
        heroDescription: "Unapologetic silhouettes, statement sneakers, and seasonal essentials.",
        heroPrimaryCta: "Discover Now",
        heroSecondaryCta: "Must Haves",
        heroImageUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1400&q=80",
        dealHeadline: "Essentials of the Season",
        dealSubcopy: "Hot prices on our fastest-moving streetwear pieces.",
        dealDiscountLabel: "Up to 29% Off",
        storyHeadline: "Authentic Urban Aesthetics",
        storyDescription: "Curated drops for bold self-expression.",
        storyStatNumber: "10k+",
        storyStatLabel: "Community Members",
        newsletterHeadline: "Fear of missing out?",
        newsletterSubcopy: "Drop your email to unlock secret drops.",
      },
    },
  },
  {
    id: "glowing-botanical",
    name: "Glowing Clean Beauty & Organics",
    tagline: "Botanical spotlight hero with stat callouts, 'Why Choose Us' icons, 2-col promos & 'As Seen In' press quotes",
    mockupReference: "Storefront-12.jpg, Homepage-01.jpg & Websitelinkmockup.jpg",
    recommendedTier: "GROWTH_PRO",
    categoryFocus: "Beauty / Skincare / Perfumes / Wellness",
    previewBadgeColor: "#4D6B53",
    config: {
      presetId: "glowing-botanical",
      mode: "FULL_WEBSITE",
      theme: {
        fontPairing: "luxury-warm",
        surfaceMode: "soft-sage",
        accentColor: "#4D6B53",
        secondaryAccentColor: "#E9F0EA",
        borderRadius: "soft",
        cardTone: "pure-white",
      },
      headerVariant: "centered-editorial",
      shopBannerVariant: "split-breadcrumb",
      heroVariant: "product-spotlight",
      productCardVariant: "boutique-badged",
      categoryBentoVariant: "2-col-split-banners",
      filterLayoutVariant: "centered-category-tabs",
      sectionHeadingStyle: "clean-centered",
      trustStripVariant: "3-col-feature-cards",
      promoDealVariant: "split-story-stats",
      testimonialsVariant: "press-quote-grid",
      socialNewsletterVariant: "instagram-strip-plus-minimal",
      footerVariant: "clean-4col",
      gridColumns: 4,
      visibility: {
        showAnnouncementBar: true,
        showTrustStrip: true,
        showCategoryBento: true,
        showFeaturedCarousel: true,
        showPromoDeal: true,
        showBrandStory: true,
        showTestimonials: true,
        showSocialNewsletter: true,
      },
      copy: {
        announcementText: "Free shipping on orders over ₦35,000 · 100% Pure & Authentic Formulations",
        heroSubtitle: "ESSENTIAL ITEMS · 01",
        heroTitle: "Beauty Inspired by Real Life",
        heroDescription: "Made using clean, skin-loving ingredients formulated for radiant everyday confidence.",
        heroPrimaryCta: "Buy Now",
        heroSecondaryCta: "Explore Rituals",
        heroImageUrl: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1200&q=80",
        dealHeadline: "25% Off Everything — Seasonal Glow Event",
        dealSubcopy: "Replenish your daily skincare and fragrance favorites while stocks last.",
        dealDiscountLabel: "25% Off",
        storyHeadline: "Why Choose Us? 100% Authentic & Dermatologist Tested",
        storyDescription: "Our formulations are crafted from ethically sourced botanicals with zero harsh additives.",
        storyStatNumber: "5,000+",
        storyStatLabel: "Monthly Clients",
        newsletterHeadline: "Elevate Your Everyday Ritual",
        newsletterSubcopy: "Join our skincare journal for routine tips and VIP launch offers.",
      },
    },
  },
  {
    id: "illuminate-dark",
    name: "Illuminate Obsidian Luxury",
    tagline: "High-contrast dark luxury hero, 4-tile asymmetric category bento, badged product cards & dark Instagram footer",
    mockupReference: "Storefront-11.jpg & Storefront-09.jpg",
    recommendedTier: "GROWTH_PRO",
    categoryFocus: "Luxury Goods / Watches / Interior Decor / High-End Fashion",
    previewBadgeColor: "#18181B",
    config: {
      presetId: "illuminate-dark",
      mode: "FULL_WEBSITE",
      theme: {
        fontPairing: "modern-sans",
        surfaceMode: "dark-luxury",
        accentColor: "#D97706",
        secondaryAccentColor: "#27272A",
        borderRadius: "sharp",
        cardTone: "studio-gray",
      },
      headerVariant: "centered-editorial",
      shopBannerVariant: "overlap-typographic",
      heroVariant: "dark-luxury",
      productCardVariant: "boutique-badged",
      categoryBentoVariant: "4-tile-right-tall",
      filterLayoutVariant: "centered-category-tabs",
      sectionHeadingStyle: "left-with-link",
      trustStripVariant: "4-col-horizontal-icons",
      promoDealVariant: "countdown-banner",
      testimonialsVariant: "numbered-3col",
      socialNewsletterVariant: "inline-fomo-bar",
      footerVariant: "dark-instagram-grid",
      gridColumns: 4,
      visibility: {
        showAnnouncementBar: true,
        showTrustStrip: true,
        showCategoryBento: true,
        showFeaturedCarousel: true,
        showPromoDeal: true,
        showBrandStory: true,
        showTestimonials: true,
        showSocialNewsletter: true,
      },
      copy: {
        announcementText: "VIP Concierge Delivery · Verified CAC & Monnify Escrow Protected",
        heroSubtitle: "SIGNATURE EDITION",
        heroTitle: "TIMELESS CRAFTSMANSHIP",
        heroDescription: "Precision-crafted statement pieces designed to command attention.",
        heroPrimaryCta: "Shop Collection →",
        heroSecondaryCta: "View Lookbook",
        heroImageUrl: "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=1400&q=80",
        dealHeadline: "Private Collector's Release",
        dealSubcopy: "Exclusive pricing for early collectors before public allocation closes.",
        dealDiscountLabel: "10% Off All Items",
        storyHeadline: "Engineered for Distinction",
        storyDescription: "Combining bold architectural proportions with uncompromising materials.",
        storyStatNumber: "99.8%",
        storyStatLabel: "On-Time Fulfillment",
        newsletterHeadline: "Join Our Private Collector List",
        newsletterSubcopy: "Get a 10% voucher on your first order and priority access to limited editions.",
      },
    },
  },
];

export function getStorefrontPresetById(presetId?: string): StorefrontPresetDefinition {
  if (presetId) {
    const found = STOREFRONT_PRESETS.find((p) => p.id === presetId);
    if (found) return found;
  }
  return STOREFRONT_PRESETS[0]!;
}

export function resolveVendorStorefrontConfig(
  rawConfig?: Partial<StorefrontConfig> | Record<string, unknown> | null,
  roleOrPlan?: string,
  businessName?: string
): StorefrontConfig {
  const isFullWebsiteAllowed = canUseFullWebsiteMode(roleOrPlan);
  const defaultPresetId = isFullWebsiteAllowed ? "jenahara-editorial" : "stuffsus-shop";
  const requestedPresetId =
    rawConfig && typeof rawConfig === "object" && "presetId" in rawConfig && typeof rawConfig.presetId === "string"
      ? rawConfig.presetId
      : defaultPresetId;

  const basePreset = getStorefrontPresetById(requestedPresetId).config;
  const incoming = (rawConfig && typeof rawConfig === "object" ? rawConfig : {}) as Partial<StorefrontConfig>;

  const requestedMode: StorefrontMode =
    incoming.mode ?? (isFullWebsiteAllowed ? "FULL_WEBSITE" : "STOREFRONT_ONLY");

  const effectiveMode: StorefrontMode = isFullWebsiteAllowed ? requestedMode : "STOREFRONT_ONLY";

  return {
    ...basePreset,
    ...incoming,
    presetId: basePreset.presetId,
    mode: effectiveMode,
    theme: {
      ...basePreset.theme,
      ...(incoming.theme ?? {}),
    },
    visibility: {
      ...basePreset.visibility,
      ...(incoming.visibility ?? {}),
    },
    copy: {
      ...basePreset.copy,
      ...(businessName && !incoming.copy?.heroTitle && effectiveMode === "STOREFRONT_ONLY"
        ? { heroSubtitle: `Welcome to ${businessName}` }
        : {}),
      ...(incoming.copy ?? {}),
    },
  };
}
