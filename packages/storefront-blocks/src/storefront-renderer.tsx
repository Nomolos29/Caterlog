"use client";

import React, { useState } from "react";
import type {
  StorefrontActivePage,
  StorefrontDiscount,
  StorefrontOrderReceipt,
  StorefrontProduct,
  StorefrontShippingZone,
  StorefrontVendorSummary,
  StudioSectionId,
} from "./types";
import {
  resolveRadiusClass,
  resolveSurfacePalette,
  type StorefrontConfig,
} from "./presets";
import {
  StorefrontFooterSection,
  StorefrontPromoDealSection,
  StorefrontSocialNewsletterSection,
  StorefrontTestimonialsSection,
  StorefrontTrustStripSection,
} from "./brand-sections";
import {
  StorefrontProductQuickViewModal,
  StorefrontShoppingBagDrawer,
  StorefrontStandardCheckoutPage,
  type StorefrontCartItem,
} from "./checkout-section";
import { StorefrontCatalogSection } from "./catalog-section";
import { StorefrontCategoryBentoSection } from "./category-bento-section";
import { StorefrontHeaderSection } from "./header-section";
import {
  StorefrontHeroSection,
  StorefrontShopBannerSection,
} from "./hero-section";
import { StorefrontButton, StorefrontSectionHeading } from "./primitives";
import { StorefrontProductCard } from "./product-card";

export interface StorefrontRendererProps {
  vendor: StorefrontVendorSummary;
  products: StorefrontProduct[];
  shippingZones: StorefrontShippingZone[];
  discounts: StorefrontDiscount[];
  config: StorefrontConfig;
  initialPage?: StorefrontActivePage;
  activePageOverride?: StorefrontActivePage;
  onActivePageChange?: (page: StorefrontActivePage) => void;
  apiBaseUrl?: string;
  isStudioMode?: boolean;
  activeStudioSection?: StudioSectionId | null;
  onSelectStudioSection?: (section: StudioSectionId) => void;
  onOrderCompleted?: () => void;
}

export function StorefrontRenderer({
  vendor,
  products,
  shippingZones,
  discounts,
  config,
  initialPage,
  activePageOverride,
  onActivePageChange,
  apiBaseUrl = "",
  isStudioMode = false,
  activeStudioSection,
  onSelectStudioSection,
  onOrderCompleted,
}: StorefrontRendererProps) {
  const palette = resolveSurfacePalette(config.theme.surfaceMode);
  const cardRadius = resolveRadiusClass(config.theme.borderRadius, "card");
  const isVerified = vendor.verificationStatus === "VERIFIED";

  const defaultPage: StorefrontActivePage =
    initialPage ?? (config.mode === "FULL_WEBSITE" ? "home" : "shop");

  const [internalPage, setInternalPage] = useState<StorefrontActivePage>(defaultPage);
  const activePage = activePageOverride ?? internalPage;

  const setActivePage = (nextPage: StorefrontActivePage) => {
    setInternalPage(nextPage);
    onActivePageChange?.(nextPage);
  };

  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Cart, Quick-View & Inline Order Lookup state
  const [cart, setCart] = useState<StorefrontCartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<StorefrontProduct | null>(null);

  const [trackCodeInput, setTrackCodeInput] = useState("");
  const [trackedReceipt, setTrackedReceipt] = useState<StorefrontOrderReceipt | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [trackLoading, setTrackLoading] = useState(false);

  React.useEffect(() => {
    if (
      config.mode === "STOREFRONT_ONLY" &&
      activePage !== "shop" &&
      activePage !== "checkout" &&
      activePage !== "track"
    ) {
      setActivePage("shop");
    } else if (
      config.mode === "FULL_WEBSITE" &&
      !initialPage &&
      !activePageOverride &&
      activePage === "shop" &&
      selectedCategory === "ALL" &&
      !searchQuery
    ) {
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

  const handleQuickAddProduct = (product: StorefrontProduct) => {
    handleAddItemToCart({
      product,
      variant: product.variants?.[0],
      quantity: 1,
    });
    setCartOpen(true);
  };

  const handleBuyNowProduct = (product: StorefrontProduct) => {
    handleAddItemToCart({
      product,
      variant: product.variants?.[0],
      quantity: 1,
    });
    setCartOpen(false);
    setActivePage("checkout");
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

  const handleLookupOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = trackCodeInput.trim().toUpperCase();
    if (!clean) return;
    setTrackLoading(true);
    setTrackError(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/public/orders/${encodeURIComponent(clean)}`
      );
      const data = await res.json();
      if (!res.ok || !data?.receipt) {
        throw new Error(data?.error || `Order "${clean}" not found.`);
      }
      setTrackedReceipt(data.receipt);
    } catch (err) {
      setTrackedReceipt(null);
      setTrackError(err instanceof Error ? err.message : "Order not found.");
    } finally {
      setTrackLoading(false);
    }
  };

  // Wrapper that enables click-to-edit section highlighting in the Dashboard Visual Studio
  const StudioWrapper = ({
    id,
    label,
    children,
  }: {
    id: StudioSectionId;
    label: string;
    children: React.ReactNode;
  }) => {
    if (!isStudioMode) return <>{children}</>;
    const isSelected = activeStudioSection === id;
    return (
      <div
        onClick={(e) => {
          if (onSelectStudioSection) {
            e.stopPropagation();
            onSelectStudioSection(id);
          }
        }}
        className={`relative group/studio transition-all ${
          isSelected
            ? "ring-2 ring-inset ring-indigo-500"
            : "hover:ring-2 hover:ring-inset hover:ring-indigo-400/60"
        }`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectStudioSection?.(id);
          }}
          className={`absolute top-2.5 right-3 z-40 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider shadow-md transition-opacity cursor-pointer ${
            isSelected
              ? "opacity-100 bg-indigo-600 text-white"
              : "opacity-0 group-hover/studio:opacity-100 bg-gray-900/90 text-white"
          }`}
        >
          ✎ {label}
        </button>
        {children}
      </div>
    );
  };

  return (
    <div
      className="@container min-h-screen w-full overflow-x-hidden flex flex-col transition-colors duration-200"
      style={{
        backgroundColor: palette.pageBg,
        color: palette.textPrimary,
      }}
    >
      {/* 1. HEADER SECTION */}
      <StudioWrapper id="header" label="Edit Header">
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
        />
      </StudioWrapper>

      {/* 2. PAGE BODY ROUTER */}
      <main className="flex-1">
        {/* ===================================================================
            PAGE A: STANDARD WEB CHECKOUT PAGE (`checkout`)
           =================================================================== */}
        {activePage === "checkout" && (
          <StorefrontStandardCheckoutPage
            cart={cart}
            onUpdateQuantity={handleUpdateCartQty}
            onRemoveItem={handleRemoveCartItem}
            onClearCart={() => setCart([])}
            onContinueShopping={() =>
              setActivePage(config.mode === "FULL_WEBSITE" ? "home" : "shop")
            }
            shippingZones={shippingZones}
            discounts={discounts}
            theme={config.theme}
            vendorSlug={vendor.slug}
            businessName={vendor.businessName}
            apiBaseUrl={apiBaseUrl}
            onOrderCompleted={onOrderCompleted}
          />
        )}

        {/* ===================================================================
            PAGE B: INLINE ORDER TRACKER & RECEIPT LOOKUP (`track`)
           =================================================================== */}
        {activePage === "track" && (
          <section className="max-w-2xl mx-auto px-4 sm:px-8 py-14">
            <StorefrontSectionHeading
              title="Track Your Order & Live Delivery Status"
              subtitle="Enter your Order Reference (e.g. ORD-101) to view your itemized receipt, payment confirmation, and courier dispatch status."
              styleVariant="clean-centered"
              theme={config.theme}
            />
            <form
              onSubmit={handleLookupOrder}
              className={`p-6 sm:p-8 border ${cardRadius} shadow-sm space-y-4`}
              style={{
                backgroundColor: palette.cardSurfaceBg,
                borderColor: palette.borderSubtle,
              }}
            >
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={trackCodeInput}
                  onChange={(e) => setTrackCodeInput(e.target.value.toUpperCase())}
                  placeholder="Enter Order Reference (e.g. ORD-101)"
                  className="flex-1 px-4 py-3 text-sm font-mono font-bold rounded-xl border bg-transparent focus:outline-none"
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
                  disabled={trackLoading}
                >
                  {trackLoading ? "Searching..." : "Track Order →"}
                </StorefrontButton>
              </div>
              {trackError && (
                <p className="text-xs font-semibold text-red-500">{trackError}</p>
              )}
            </form>

            {trackedReceipt && (
              <div
                className={`mt-6 p-6 border ${cardRadius} shadow-md space-y-4`}
                style={{
                  backgroundColor: palette.cardSurfaceBg,
                  borderColor: palette.borderSubtle,
                }}
              >
                <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: palette.borderSubtle }}>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: palette.textMuted }}>
                      Order Reference
                    </span>
                    <h3 className="text-xl font-black">#{trackedReceipt.shortCode}</h3>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      trackedReceipt.isPaid
                        ? "bg-emerald-500/15 text-emerald-700"
                        : "bg-amber-500/15 text-amber-700"
                    }`}
                  >
                    {trackedReceipt.status.replace(/_/g, " ")}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <p style={{ color: palette.textMuted }}>Customer</p>
                    <p className="font-bold">{trackedReceipt.customerName}</p>
                  </div>
                  <div>
                    <p style={{ color: palette.textMuted }}>Total Amount</p>
                    <p className="font-bold">{trackedReceipt.totalAmountFormatted}</p>
                  </div>
                  <div>
                    <p style={{ color: palette.textMuted }}>Delivery Zone</p>
                    <p className="font-bold">{trackedReceipt.shippingZoneName}</p>
                  </div>
                  <div>
                    <p style={{ color: palette.textMuted }}>Payment Status</p>
                    <p className="font-bold text-emerald-600">{trackedReceipt.paymentStamp}</p>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ===================================================================
            PAGE C: ABOUT / BRAND STORY & DELIVERY ZONES (`about` — Growth/Pro)
           =================================================================== */}
        {activePage === "about" && config.mode === "FULL_WEBSITE" && (
          <div>
            <StudioWrapper id="brand-story" label="Edit Brand Story">
              <StorefrontPromoDealSection
                variant="split-story-stats"
                theme={config.theme}
                copy={config.copy}
                discounts={discounts}
                products={products}
                onShopDeal={() => setActivePage("shop")}
              />
            </StudioWrapper>

            <StudioWrapper id="trust-strip" label="Edit Trust Strip">
              <StorefrontTrustStripSection
                variant="3-col-feature-cards"
                theme={config.theme}
                headingStyle={config.sectionHeadingStyle}
                isVerified={isVerified}
                cacNumber={vendor.cacNumber}
                shippingZones={shippingZones}
                reservationTtlMinutes={vendor.reservationTtlMinutes}
              />
            </StudioWrapper>

            <section className="max-w-4xl mx-auto px-4 sm:px-8 py-12">
              <StorefrontSectionHeading
                title="Delivery Zones & Shipping Rates"
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

            <StudioWrapper id="testimonials" label="Edit Testimonials">
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
            </StudioWrapper>
          </div>
        )}

        {/* ===================================================================
            PAGE D: LOOKBOOK & COLLECTIONS (`collections` — Growth/Pro)
           =================================================================== */}
        {activePage === "collections" && config.mode === "FULL_WEBSITE" && (
          <div>
            <StudioWrapper id="category-bento" label="Edit Category Bento">
              <StorefrontCategoryBentoSection
                variant={config.categoryBentoVariant}
                headingStyle={config.sectionHeadingStyle}
                theme={config.theme}
                products={products}
                onSelectCategory={handleCategoryJump}
              />
            </StudioWrapper>

            <StudioWrapper id="catalog" label="Edit Catalog & Product Cards">
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
            </StudioWrapper>
          </div>
        )}

        {/* ===================================================================
            PAGE E: SHOP / CATALOG STOREFRONT (`shop` or STOREFRONT_ONLY mode)
           =================================================================== */}
        {activePage === "shop" && (
          <div>
            <StudioWrapper id="shop-banner" label="Edit Shop Banner">
              <StorefrontShopBannerSection
                businessName={vendor.businessName}
                variant={config.shopBannerVariant}
                theme={config.theme}
                copy={config.copy}
                products={products}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onSelectProduct={setQuickViewProduct}
                onExploreCatalog={() => {
                  const el = document.getElementById("storefront-catalog-anchor");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
              />
            </StudioWrapper>

            {config.visibility.showTrustStrip && (
              <StudioWrapper id="trust-strip" label="Edit Trust Strip">
                <StorefrontTrustStripSection
                  variant={config.trustStripVariant}
                  theme={config.theme}
                  headingStyle={config.sectionHeadingStyle}
                  isVerified={isVerified}
                  cacNumber={vendor.cacNumber}
                  shippingZones={shippingZones}
                  reservationTtlMinutes={vendor.reservationTtlMinutes}
                />
              </StudioWrapper>
            )}

            <StudioWrapper id="catalog" label="Edit Filters & Product Cards">
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
            </StudioWrapper>

            {config.visibility.showSocialNewsletter && (
              <StudioWrapper id="newsletter" label="Edit Social & Newsletter">
                <StorefrontSocialNewsletterSection
                  variant={config.socialNewsletterVariant}
                  theme={config.theme}
                  copy={config.copy}
                  businessName={vendor.businessName}
                  instagramHandle={vendor.instagramHandle}
                  products={products}
                  onSelectProduct={setQuickViewProduct}
                />
              </StudioWrapper>
            )}
          </div>
        )}

        {/* ===================================================================
            PAGE F: FULL BRAND WEBSITE HOMEPAGE (`home` — Growth & Pro Mode)
           =================================================================== */}
        {activePage === "home" && config.mode === "FULL_WEBSITE" && (
          <div>
            <StudioWrapper id="hero" label="Edit Brand Hero">
              <StorefrontHeroSection
                businessName={vendor.businessName}
                variant={config.heroVariant}
                theme={config.theme}
                copy={config.copy}
                featuredProduct={products[0]}
                secondaryProduct={products[1]}
                totalProductsCount={products.length}
                onPrimaryCta={() => setActivePage("shop")}
                onSecondaryCta={() => setActivePage("collections")}
                onSelectProduct={setQuickViewProduct}
              />
            </StudioWrapper>

            {config.visibility.showTrustStrip && (
              <StudioWrapper id="trust-strip" label="Edit Trust Strip">
                <StorefrontTrustStripSection
                  variant={config.trustStripVariant}
                  theme={config.theme}
                  headingStyle={config.sectionHeadingStyle}
                  isVerified={isVerified}
                  cacNumber={vendor.cacNumber}
                  shippingZones={shippingZones}
                  reservationTtlMinutes={vendor.reservationTtlMinutes}
                />
              </StudioWrapper>
            )}

            {config.visibility.showCategoryBento && (
              <StudioWrapper id="category-bento" label="Edit Category Bento">
                <StorefrontCategoryBentoSection
                  variant={config.categoryBentoVariant}
                  headingStyle={config.sectionHeadingStyle}
                  theme={config.theme}
                  products={products}
                  onSelectCategory={handleCategoryJump}
                />
              </StudioWrapper>
            )}

            {config.visibility.showFeaturedCarousel && products.length > 0 && (
              <StudioWrapper id="featured-products" label="Edit Featured Products">
                <section className="max-w-7xl mx-auto px-3.5 @sm:px-6 @lg:px-8 py-8 @sm:py-12">
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
                        ? "grid-cols-2 @md:grid-cols-3"
                        : "grid-cols-2 @md:grid-cols-3 @xl:grid-cols-4"
                    } gap-3.5 @sm:gap-6`}
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
              </StudioWrapper>
            )}

            {config.visibility.showPromoDeal && (
              <StudioWrapper id="promo-deal" label="Edit Promo & Countdown">
                <StorefrontPromoDealSection
                  variant={config.promoDealVariant}
                  theme={config.theme}
                  copy={config.copy}
                  discounts={discounts}
                  products={products}
                  onShopDeal={() => setActivePage("shop")}
                />
              </StudioWrapper>
            )}

            <StudioWrapper id="catalog" label="Edit Catalog & Product Cards">
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
            </StudioWrapper>

            {config.visibility.showBrandStory &&
              config.promoDealVariant !== "split-story-stats" && (
                <StudioWrapper id="brand-story" label="Edit Brand Story">
                  <StorefrontPromoDealSection
                    variant="split-story-stats"
                    theme={config.theme}
                    copy={config.copy}
                    discounts={discounts}
                    products={products}
                    onShopDeal={() => setActivePage("about")}
                  />
                </StudioWrapper>
              )}

            {config.visibility.showTestimonials && (
              <StudioWrapper id="testimonials" label="Edit Testimonials">
                <StorefrontTestimonialsSection
                  variant={config.testimonialsVariant}
                  theme={config.theme}
                  headingStyle={config.sectionHeadingStyle}
                  businessName={vendor.businessName}
                />
              </StudioWrapper>
            )}

            {config.visibility.showSocialNewsletter && (
              <StudioWrapper id="newsletter" label="Edit Social & Newsletter">
                <StorefrontSocialNewsletterSection
                  variant={config.socialNewsletterVariant}
                  theme={config.theme}
                  copy={config.copy}
                  businessName={vendor.businessName}
                  instagramHandle={vendor.instagramHandle}
                  products={products}
                  onSelectProduct={setQuickViewProduct}
                />
              </StudioWrapper>
            )}
          </div>
        )}
      </main>

      {/* 3. FOOTER SECTION */}
      <StudioWrapper id="footer" label="Edit Footer">
        <StorefrontFooterSection
          variant={config.footerVariant}
          theme={config.theme}
          businessName={vendor.businessName}
          instagramHandle={vendor.instagramHandle}
          baseCity={vendor.baseCity}
          baseState={vendor.baseState}
          products={products}
          onSelectPage={setActivePage}
          onSelectProduct={setQuickViewProduct}
        />
      </StudioWrapper>

      {/* 4. PRODUCT QUICK-VIEW MODAL */}
      <StorefrontProductQuickViewModal
        product={quickViewProduct}
        theme={config.theme}
        businessName={vendor.businessName}
        onClose={() => setQuickViewProduct(null)}
        onAddToCart={(item) => {
          handleAddItemToCart(item);
          setCartOpen(true);
        }}
        onBuyNow={(item) => {
          handleAddItemToCart(item);
          setCartOpen(false);
          setActivePage("checkout");
        }}
      />

      {/* 5. SLIDE-OVER SHOPPING BAG DRAWER */}
      <StorefrontShoppingBagDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        onUpdateQuantity={handleUpdateCartQty}
        onRemoveItem={handleRemoveCartItem}
        onProceedToCheckout={() => setActivePage("checkout")}
        theme={config.theme}
        businessName={vendor.businessName}
      />
    </div>
  );
}
