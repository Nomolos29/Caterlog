"use client";

import React, { useState } from "react";
import type { Discount, Product, ShippingZone } from "@/lib/types";
import {
  resolveHeadingFontStyle,
  resolveRadiusClass,
  resolveSurfacePalette,
  type StorefrontConfig,
} from "@/lib/storefront-presets";
import {
  StorefrontFooterSection,
  StorefrontPromoDealSection,
  StorefrontSocialNewsletterSection,
  StorefrontTestimonialsSection,
  StorefrontTrustStripSection,
} from "./brand-sections";
import {
  StorefrontCartAndCheckoutDrawer,
  StorefrontProductQuickViewModal,
  type StorefrontCartItem,
} from "./cart-checkout-modal";
import { StorefrontCatalogSection } from "./catalog-section";
import { StorefrontCategoryBentoSection } from "./category-bento-section";
import {
  StorefrontHeaderSection,
  type StorefrontActivePage,
} from "./header-section";
import {
  StorefrontHeroSection,
  StorefrontShopBannerSection,
} from "./hero-section";
import { StorefrontButton, StorefrontSectionHeading } from "./primitives";
import { StorefrontProductCard } from "./product-card";

export interface StorefrontVendorSummary {
  id: string;
  slug: string;
  businessName: string;
  whatsappPhone: string;
  verificationStatus: "VERIFIED" | "PENDING" | "REJECTED";
  cacNumber?: string;
  instagramHandle?: string;
  baseState?: string;
  baseCity?: string;
  reservationTtlMinutes: number;
}

export interface StorefrontRendererProps {
  vendor: StorefrontVendorSummary;
  products: Product[];
  shippingZones: ShippingZone[];
  discounts: Discount[];
  config: StorefrontConfig;
  initialPage?: StorefrontActivePage;
}

export function StorefrontRenderer({
  vendor,
  products,
  shippingZones,
  discounts,
  config,
  initialPage,
}: StorefrontRendererProps) {
  const palette = resolveSurfacePalette(config.theme.surfaceMode);
  const headingFont = resolveHeadingFontStyle(config.theme.fontPairing);
  const cardRadius = resolveRadiusClass(config.theme.borderRadius, "card");
  const isVerified = vendor.verificationStatus === "VERIFIED";

  const defaultPage: StorefrontActivePage =
    initialPage ?? (config.mode === "FULL_WEBSITE" ? "home" : "shop");

  const [activePage, setActivePage] = useState<StorefrontActivePage>(defaultPage);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Cart & Quick-View state
  const [cart, setCart] = useState<StorefrontCartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [trackCodeInput, setTrackCodeInput] = useState("");

  // Keep activePage synced when mode toggles in the live builder
  React.useEffect(() => {
    if (config.mode === "STOREFRONT_ONLY" && activePage !== "shop" && activePage !== "track") {
      setActivePage("shop");
    } else if (config.mode === "FULL_WEBSITE" && !initialPage && activePage === "shop" && selectedCategory === "ALL" && !searchQuery) {
      setActivePage("home");
    }
  }, [config.mode]);

  const totalCartItems = cart.reduce((sum, it) => sum + it.quantity, 0);

  const handleAddItemToCart = (incoming: StorefrontCartItem) => {
    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (it) =>
          it.product.id === incoming.product.id &&
          (it.variant?.id ?? "") === (incoming.variant?.id ?? "") &&
          (it.selectedColor ?? "") === (incoming.selectedColor ?? "")
      );
      if (existingIdx >= 0) {
        const copy = [...prev];
        const curr = copy[existingIdx]!;
        copy[existingIdx] = { ...curr, quantity: curr.quantity + incoming.quantity };
        return copy;
      }
      return [...prev, incoming];
    });
  };

  const handleQuickAddProduct = (product: Product) => {
    handleAddItemToCart({
      product,
      variant: product.variants?.[0],
      quantity: 1,
    });
    setCartOpen(true);
  };

  const handleBuyNowProduct = (product: Product) => {
    handleAddItemToCart({
      product,
      variant: product.variants?.[0],
      quantity: 1,
    });
    setCartOpen(true);
  };

  const handleUpdateCartQty = (idx: number, delta: number) => {
    setCart((prev) => {
      const copy = [...prev];
      const item = copy[idx];
      if (!item) return prev;
      const nextQty = item.quantity + delta;
      if (nextQty <= 0) {
        copy.splice(idx, 1);
      } else {
        copy[idx] = { ...item, quantity: nextQty };
      }
      return copy;
    });
  };

  const handleRemoveCartItem = (idx: number) => {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCategoryJump = (category: string) => {
    setSelectedCategory(category);
    setActivePage("shop");
  };

  return (
    <div
      className="min-h-screen flex flex-col transition-colors duration-200"
      style={{
        backgroundColor: palette.pageBg,
        color: palette.textPrimary,
      }}
    >
      {/* 1. HEADER SECTION (All 4 Variants) */}
      <StorefrontHeaderSection
        businessName={vendor.businessName}
        isVerified={isVerified}
        mode={config.mode}
        variant={config.headerVariant}
        theme={config.theme}
        showAnnouncementBar={config.visibility.showAnnouncementBar}
        announcementText={config.copy.announcementText}
        activePage={activePage}
        onSelectPage={setActivePage}
        cartCount={totalCartItems}
        onOpenCart={() => setCartOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          if (activePage !== "shop") setActivePage("shop");
        }}
        whatsappPhone={vendor.whatsappPhone}
      />

      {/* 2. PAGE BODY ROUTER */}
      <main className="flex-1">
        {/* ===================================================================
            PAGE A: ORDER TRACKER & LIVE RECEIPT LOOKUP (`track`)
           =================================================================== */}
        {activePage === "track" && (
          <section className="max-w-2xl mx-auto px-4 sm:px-8 py-16 text-center">
            <StorefrontSectionHeading
              title="Track Your Order & Live Courier Status"
              subtitle="Enter your order reference code (e.g. ORD-101) sent to your WhatsApp to view your verified payment receipt and live dispatch rider location."
              styleVariant="clean-centered"
              theme={config.theme}
            />
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!trackCodeInput.trim()) return;
                window.location.href = `/track/${encodeURIComponent(trackCodeInput.trim().toUpperCase())}`;
              }}
              className={`p-6 sm:p-8 border ${cardRadius} shadow-sm space-y-4`}
              style={{
                backgroundColor: palette.cardSurfaceBg,
                borderColor: palette.borderSubtle,
              }}
            >
              <input
                type="text"
                value={trackCodeInput}
                onChange={(e) => setTrackCodeInput(e.target.value.toUpperCase())}
                placeholder="Enter Order Reference (e.g. ORD-101)"
                className="w-full px-4 py-3 text-sm font-mono font-bold text-center rounded-xl border bg-transparent focus:outline-none"
                style={{
                  borderColor: palette.borderSubtle,
                  color: palette.textPrimary,
                }}
              />
              <StorefrontButton
                type="submit"
                theme={config.theme}
                variant="solid"
                size="lg"
                fullWidth
              >
                Track Order Live →
              </StorefrontButton>
            </form>
          </section>
        )}

        {/* ===================================================================
            PAGE B: ABOUT / BRAND STORY & DELIVERY ZONES (`about` — Growth/Pro)
           =================================================================== */}
        {activePage === "about" && config.mode === "FULL_WEBSITE" && (
          <div>
            <StorefrontPromoDealSection
              variant="split-story-stats"
              theme={config.theme}
              copy={config.copy}
              discounts={discounts}
              products={products}
              onShopDeal={() => setActivePage("shop")}
            />

            <StorefrontTrustStripSection
              variant="3-col-feature-cards"
              theme={config.theme}
              headingStyle={config.sectionHeadingStyle}
              isVerified={isVerified}
              cacNumber={vendor.cacNumber}
              shippingZones={shippingZones}
              reservationTtlMinutes={vendor.reservationTtlMinutes}
            />

            {/* Active Shipping Zones & Delivery Rates Table */}
            <section className="max-w-4xl mx-auto px-4 sm:px-8 py-12">
              <StorefrontSectionHeading
                title="Delivery Zones & Rates"
                subtitle={`Dispatched directly from ${vendor.baseCity || "Ikeja"}, ${vendor.baseState || "Lagos"}`}
                styleVariant={config.sectionHeadingStyle}
                theme={config.theme}
              />
              <div
                className={`overflow-hidden border ${cardRadius}`}
                style={{
                  backgroundColor: palette.cardSurfaceBg,
                  borderColor: palette.borderSubtle,
                }}
              >
                {shippingZones.map((zone, idx) => (
                  <div
                    key={zone.id}
                    className={`px-6 py-4 flex items-center justify-between text-xs sm:text-sm ${
                      idx > 0 ? "border-t" : ""
                    }`}
                    style={{ borderColor: palette.borderSubtle }}
                  >
                    <div className="font-semibold">{zone.name}</div>
                    <div className="font-bold" style={{ color: config.theme.accentColor }}>
                      {zone.feeFormatted}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <StorefrontTestimonialsSection
              variant={
                config.testimonialsVariant === "none"
                  ? "numbered-3col"
                  : config.testimonialsVariant
              }
              theme={config.theme}
              headingStyle={config.sectionHeadingStyle}
              businessName={vendor.businessName}
            />
          </div>
        )}

        {/* ===================================================================
            PAGE C: LOOKBOOK & COLLECTIONS (`collections` — Growth/Pro)
           =================================================================== */}
        {activePage === "collections" && config.mode === "FULL_WEBSITE" && (
          <div>
            <StorefrontCategoryBentoSection
              variant={config.categoryBentoVariant}
              headingStyle={config.sectionHeadingStyle}
              theme={config.theme}
              products={products}
              onSelectCategory={handleCategoryJump}
            />

            <StorefrontCatalogSection
              title="Seasonal Lookbook Edit"
              subtitle="Tap any piece to inspect options or reserve immediately"
              products={products}
              filterLayout="centered-category-tabs"
              productCardVariant={config.productCardVariant}
              headingStyle={config.sectionHeadingStyle}
              theme={config.theme}
              defaultColumns={config.gridColumns}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onAddToCart={handleQuickAddProduct}
              onBuyNow={handleBuyNowProduct}
              onQuickView={setQuickViewProduct}
            />
          </div>
        )}

        {/* ===================================================================
            PAGE D: SHOP / CATALOG STOREFRONT (`shop` or STOREFRONT_ONLY mode)
           =================================================================== */}
        {activePage === "shop" && (
          <div>
            <StorefrontShopBannerSection
              businessName={vendor.businessName}
              variant={config.shopBannerVariant}
              theme={config.theme}
              copy={config.copy}
              products={products}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onExploreCatalog={() => {
                const el = document.getElementById("storefront-catalog-anchor");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
            />

            {config.visibility.showTrustStrip && (
              <StorefrontTrustStripSection
                variant={config.trustStripVariant}
                theme={config.theme}
                headingStyle={config.sectionHeadingStyle}
                isVerified={isVerified}
                cacNumber={vendor.cacNumber}
                shippingZones={shippingZones}
                reservationTtlMinutes={vendor.reservationTtlMinutes}
              />
            )}

            <div id="storefront-catalog-anchor">
              <StorefrontCatalogSection
                products={products}
                filterLayout={config.filterLayoutVariant}
                productCardVariant={config.productCardVariant}
                headingStyle={config.sectionHeadingStyle}
                theme={config.theme}
                defaultColumns={config.gridColumns}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                showRecommendationsRow={config.visibility.showFeaturedCarousel}
                onAddToCart={handleQuickAddProduct}
                onBuyNow={handleBuyNowProduct}
                onQuickView={setQuickViewProduct}
              />
            </div>

            {config.visibility.showSocialNewsletter && (
              <StorefrontSocialNewsletterSection
                variant={config.socialNewsletterVariant}
                theme={config.theme}
                copy={config.copy}
                businessName={vendor.businessName}
                instagramHandle={vendor.instagramHandle}
                products={products}
                onSelectProduct={setQuickViewProduct}
              />
            )}
          </div>
        )}

        {/* ===================================================================
            PAGE E: FULL BRAND WEBSITE HOMEPAGE (`home` — Growth & Pro Mode)
           =================================================================== */}
        {activePage === "home" && config.mode === "FULL_WEBSITE" && (
          <div>
            {/* 1. Full Brand Hero (All 6 Variants) */}
            <StorefrontHeroSection
              businessName={vendor.businessName}
              variant={config.heroVariant}
              theme={config.theme}
              copy={config.copy}
              featuredProduct={products[0]}
              totalProductsCount={products.length}
              onPrimaryCta={() => setActivePage("shop")}
              onSecondaryCta={() => setActivePage("collections")}
            />

            {/* 2. Optional Trust / Why Choose Us Strip */}
            {config.visibility.showTrustStrip && (
              <StorefrontTrustStripSection
                variant={config.trustStripVariant}
                theme={config.theme}
                headingStyle={config.sectionHeadingStyle}
                isVerified={isVerified}
                cacNumber={vendor.cacNumber}
                shippingZones={shippingZones}
                reservationTtlMinutes={vendor.reservationTtlMinutes}
              />
            )}

            {/* 3. Optional Category Bento Mosaic (All 5 Variants) */}
            {config.visibility.showCategoryBento && (
              <StorefrontCategoryBentoSection
                variant={config.categoryBentoVariant}
                headingStyle={config.sectionHeadingStyle}
                theme={config.theme}
                products={products}
                onSelectCategory={handleCategoryJump}
              />
            )}

            {/* 4. Featured / Must-Have Products Row (Nyture "OUR MUST HAVE" / Glowing "Our Featured Products") */}
            {config.visibility.showFeaturedCarousel && products.length > 0 && (
              <section className="max-w-7xl mx-auto px-4 sm:px-8 py-12">
                <StorefrontSectionHeading
                  title="Our Featured Products"
                  subtitle="Curated best-sellers available for immediate dispatch"
                  styleVariant={config.sectionHeadingStyle}
                  theme={config.theme}
                  actionLabel="View All"
                  onAction={() => setActivePage("shop")}
                />
                <div
                  className={`grid ${
                    config.gridColumns === 3
                      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                      : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
                  } gap-6`}
                >
                  {products.slice(0, config.gridColumns).map((p, idx) => (
                    <StorefrontProductCard
                      key={`feat-${p.id}`}
                      product={p}
                      index={idx}
                      variant={config.productCardVariant}
                      theme={config.theme}
                      onAddToCart={handleQuickAddProduct}
                      onBuyNow={handleBuyNowProduct}
                      onQuickView={setQuickViewProduct}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* 5. Optional Flash Deal Countdown or Split Story Banner */}
            {config.visibility.showPromoDeal && (
              <StorefrontPromoDealSection
                variant={config.promoDealVariant}
                theme={config.theme}
                copy={config.copy}
                discounts={discounts}
                products={products}
                onShopDeal={() => setActivePage("shop")}
              />
            )}

            {/* 6. Main Homepage Catalog Grid */}
            <StorefrontCatalogSection
              title="Shop Collection"
              subtitle="Filter by category, size, color, or price"
              products={products}
              filterLayout={config.filterLayoutVariant}
              productCardVariant={config.productCardVariant}
              headingStyle={config.sectionHeadingStyle}
              theme={config.theme}
              defaultColumns={config.gridColumns}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onAddToCart={handleQuickAddProduct}
              onBuyNow={handleBuyNowProduct}
              onQuickView={setQuickViewProduct}
            />

            {/* 7. Optional Brand Story Section (when promoDealVariant is countdown-banner and showBrandStory is enabled) */}
            {config.visibility.showBrandStory &&
              config.promoDealVariant !== "split-story-stats" && (
                <StorefrontPromoDealSection
                  variant="split-story-stats"
                  theme={config.theme}
                  copy={config.copy}
                  discounts={discounts}
                  products={products}
                  onShopDeal={() => setActivePage("about")}
                />
              )}

            {/* 8. Optional Testimonials & Press Section */}
            {config.visibility.showTestimonials && (
              <StorefrontTestimonialsSection
                variant={config.testimonialsVariant}
                theme={config.theme}
                headingStyle={config.sectionHeadingStyle}
                businessName={vendor.businessName}
              />
            )}

            {/* 9. Optional Instagram Lookbook Strip & Newsletter / VIP Club */}
            {config.visibility.showSocialNewsletter && (
              <StorefrontSocialNewsletterSection
                variant={config.socialNewsletterVariant}
                theme={config.theme}
                copy={config.copy}
                businessName={vendor.businessName}
                instagramHandle={vendor.instagramHandle}
                products={products}
                onSelectProduct={setQuickViewProduct}
              />
            )}
          </div>
        )}
      </main>

      {/* 3. REUSABLE FOOTER SECTION (All 3 Variants) */}
      <StorefrontFooterSection
        variant={config.footerVariant}
        theme={config.theme}
        businessName={vendor.businessName}
        whatsappPhone={vendor.whatsappPhone}
        instagramHandle={vendor.instagramHandle}
        baseCity={vendor.baseCity}
        baseState={vendor.baseState}
        products={products}
        onSelectPage={setActivePage}
        onSelectProduct={setQuickViewProduct}
      />

      {/* 4. REUSABLE PRODUCT QUICK-VIEW & DETAIL MODAL */}
      <StorefrontProductQuickViewModal
        product={quickViewProduct}
        theme={config.theme}
        businessName={vendor.businessName}
        whatsappPhone={vendor.whatsappPhone}
        onClose={() => setQuickViewProduct(null)}
        onAddToCart={(item) => {
          handleAddItemToCart(item);
          setCartOpen(true);
        }}
        onBuyNow={(item) => {
          handleAddItemToCart(item);
          setCartOpen(true);
        }}
      />

      {/* 5. REUSABLE SHOPPING BAG & INSTANT MONNIFY / WHATSAPP CHECKOUT DRAWER */}
      <StorefrontCartAndCheckoutDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        onUpdateQuantity={handleUpdateCartQty}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={() => setCart([])}
        shippingZones={shippingZones}
        discounts={discounts}
        theme={config.theme}
        vendorSlug={vendor.slug}
        businessName={vendor.businessName}
        whatsappPhone={vendor.whatsappPhone}
      />
    </div>
  );
}
