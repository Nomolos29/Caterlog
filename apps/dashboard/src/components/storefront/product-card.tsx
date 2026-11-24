"use client";

import React, { useState } from "react";
import type { Product } from "@/lib/types";
import { resolveImageUrl } from "@/lib/api";
import {
  resolveCardImageBackdrop,
  resolveHeadingFontStyle,
  resolveRadiusClass,
  resolveSurfacePalette,
  type ProductCardVariantId,
  type StorefrontThemeTokens,
} from "@/lib/storefront-presets";
import {
  computeSyntheticRating,
  extractProductSwatches,
  StorefrontButton,
  StorefrontColorSwatches,
  StorefrontPrice,
  StorefrontStarRating,
} from "./primitives";

export interface StorefrontProductCardProps {
  product: Product;
  index: number;
  variant: ProductCardVariantId;
  theme: StorefrontThemeTokens;
  onAddToCart: (product: Product) => void;
  onBuyNow: (product: Product) => void;
  onQuickView: (product: Product) => void;
}

export function StorefrontProductCard({
  product,
  index,
  variant,
  theme,
  onAddToCart,
  onBuyNow,
  onQuickView,
}: StorefrontProductCardProps) {
  const palette = resolveSurfacePalette(theme.surfaceMode);
  const headingFont = resolveHeadingFontStyle(theme.fontPairing);
  const cardRadius = resolveRadiusClass(theme.borderRadius, "card");
  const imgBackdrop = resolveCardImageBackdrop(theme.cardTone, index, palette.isDark);
  const imageUrl =
    resolveImageUrl(product.primaryImageUrl) ||
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80";

  const isOutOfStock = product.availableStock <= 0;
  const swatches = extractProductSwatches(product, index);
  const [selectedColor, setSelectedColor] = useState<string>(swatches[0]?.label ?? "");
  const ratingInfo = computeSyntheticRating(product, index);
  const categoryLabel = product.category || "Collection";

  // ---------------------------------------------------------------------------
  // VARIANT 1: dual-action-rounded (Stuffsus Shoppage-01.jpg)
  // Rounded gray image box + top-right category pill + title + star reviews + price
  // + [Add to Cart] (outline pill) & [Buy Now] (solid dark/accent pill)
  // ---------------------------------------------------------------------------
  if (variant === "dual-action-rounded") {
    return (
      <div
        className="group flex flex-col transition-all duration-200"
        style={{ color: palette.textPrimary }}
      >
        <div
          onClick={() => onQuickView(product)}
          className={`relative aspect-square w-full overflow-hidden ${cardRadius} mb-3 cursor-pointer flex items-center justify-center p-4 transition-transform duration-300 group-hover:scale-[1.01]`}
          style={{ backgroundColor: imgBackdrop }}
        >
          {/* Top-right category pill badge from Shoppage-01 */}
          <span
            className="absolute top-3 right-3 z-10 px-2.5 py-1 text-[10px] font-semibold rounded-full shadow-2xs"
            style={{
              backgroundColor: palette.cardSurfaceBg,
              color: palette.textSecondary,
            }}
          >
            {categoryLabel}
          </span>

          {isOutOfStock && (
            <span className="absolute top-3 left-3 z-10 px-2.5 py-1 text-[10px] font-bold uppercase rounded-full bg-red-600 text-white">
              Sold Out
            </span>
          )}

          <img
            src={imageUrl}
            alt={product.name}
            className="w-full h-full object-cover rounded-xl transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        </div>

        <div
          onClick={() => onQuickView(product)}
          className="cursor-pointer mb-1"
        >
          <h3 className="text-sm sm:text-base font-bold truncate">{product.name}</h3>
        </div>

        <div className="flex items-center justify-between gap-2 mb-3">
          <StorefrontStarRating
            rating={ratingInfo.rating}
            reviewsCount={ratingInfo.reviewsCount}
            compact
            mutedColor={palette.textMuted}
          />
          <StorefrontPrice
            priceFormatted={product.basePriceFormatted}
            priceNaira={product.basePriceNaira}
            textColor={palette.textPrimary}
            size="md"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 mt-auto">
          <StorefrontButton
            theme={theme}
            variant="outline"
            size="xs"
            disabled={isOutOfStock}
            onClick={() => onAddToCart(product)}
            className="!rounded-full font-semibold"
          >
            Add to Cart
          </StorefrontButton>
          <StorefrontButton
            theme={theme}
            variant="solid"
            size="xs"
            disabled={isOutOfStock}
            onClick={() => onBuyNow(product)}
            className="!rounded-full font-semibold"
          >
            {isOutOfStock ? "Sold Out" : "Buy Now"}
          </StorefrontButton>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VARIANT 2: pastel-floating-cart (Constructor Shoppage-03.jpg)
  // Pastel tinted top image area + floating circular white cart button straddling
  // bottom-right of image + white card body with title, category & price
  // ---------------------------------------------------------------------------
  if (variant === "pastel-floating-cart") {
    const pastelBg = resolveCardImageBackdrop("pastel-tint", index, palette.isDark);
    return (
      <div
        onClick={() => onQuickView(product)}
        className={`group flex flex-col overflow-hidden ${cardRadius} border transition-all duration-200 hover:shadow-md cursor-pointer`}
        style={{
          backgroundColor: palette.cardSurfaceBg,
          borderColor: palette.borderSubtle,
        }}
      >
        <div
          className="relative aspect-[4/3] w-full flex items-center justify-center p-5 overflow-hidden"
          style={{ backgroundColor: pastelBg }}
        >
          {isOutOfStock && (
            <span className="absolute top-3 left-3 z-10 px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full bg-gray-900 text-white">
              Sold Out
            </span>
          )}
          <img
            src={imageUrl}
            alt={product.name}
            className="w-full h-full object-cover rounded-lg transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        </div>

        <div className="relative px-4 pt-4 pb-4 flex flex-col flex-1">
          {/* Floating circular white cart button straddling the seam (Shoppage-03) */}
          <button
            type="button"
            disabled={isOutOfStock}
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(product);
            }}
            title={isOutOfStock ? "Out of stock" : "Add to Bag"}
            className="absolute -top-5 right-4 w-10 h-10 rounded-full bg-white text-gray-900 shadow-md border border-gray-100 flex items-center justify-center hover:scale-110 transition-transform cursor-pointer disabled:opacity-40"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </button>

          <h3
            className="text-sm font-bold truncate pr-10 mb-2"
            style={{ color: palette.textPrimary }}
          >
            {product.name}
          </h3>

          <div className="flex items-center justify-between text-xs mt-auto pt-1">
            <span style={{ color: palette.textMuted }}>{categoryLabel}</span>
            <span className="font-bold" style={{ color: palette.textPrimary }}>
              {product.basePriceFormatted}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VARIANT 3: lookbook-gradient-overlay (Jenahara Storefront-05.jpg)
  // Tall 3:4 portrait rounded card with bottom white/dark fade overlay holding
  // product name, bold price on the left, and quick cart icon on the right
  // ---------------------------------------------------------------------------
  if (variant === "lookbook-gradient-overlay") {
    return (
      <div
        onClick={() => onQuickView(product)}
        className={`group relative aspect-[3/4] w-full overflow-hidden ${cardRadius} cursor-pointer shadow-xs hover:shadow-lg transition-all duration-300`}
        style={{ backgroundColor: imgBackdrop }}
      >
        <img
          src={imageUrl}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
        />

        {isOutOfStock ? (
          <span className="absolute top-3 left-3 z-10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-black/80 text-white">
            Out of Stock
          </span>
        ) : (
          product.variants &&
          product.variants.length > 0 && (
            <span className="absolute top-3 left-3 z-10 px-2.5 py-1 text-[10px] font-medium rounded-full bg-white/85 backdrop-blur-xs text-gray-900">
              {product.variants.length} Options
            </span>
          )
        )}

        {/* Bottom gradient overlay matching Storefront-05 Jenahara */}
        <div
          className="absolute inset-x-0 bottom-0 pt-14 pb-4 px-4 flex items-end justify-between gap-3"
          style={{
            background: palette.isDark
              ? "linear-gradient(to top, rgba(17,18,21,0.95) 20%, rgba(17,18,21,0.55) 65%, transparent 100%)"
              : "linear-gradient(to top, rgba(255,255,255,0.96) 22%, rgba(255,255,255,0.72) 65%, transparent 100%)",
          }}
        >
          <div className="min-w-0">
            <h3
              className="text-sm sm:text-base font-medium truncate"
              style={{ ...headingFont, color: palette.textPrimary }}
            >
              {product.name}
            </h3>
            <p
              className="text-sm sm:text-base font-extrabold leading-tight mt-0.5"
              style={{ color: palette.textPrimary }}
            >
              {product.basePriceFormatted}
            </p>
          </div>

          <button
            type="button"
            disabled={isOutOfStock}
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(product);
            }}
            aria-label="Add to Cart"
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-110 cursor-pointer disabled:opacity-40"
            style={{
              backgroundColor: palette.textPrimary,
              color: palette.pageBg,
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VARIANT 4: minimal-swatch-studio (Guza Storefront-06, Ugmonk Storefront-07, Bagkin Storefront-02)
  // Tall clean studio card, quick-add hover bar, left-aligned title, price,
  // and interactive color swatch dots directly below
  // ---------------------------------------------------------------------------
  if (variant === "minimal-swatch-studio") {
    return (
      <div className="group flex flex-col">
        <div
          onClick={() => onQuickView(product)}
          className={`relative aspect-[4/5] w-full overflow-hidden ${cardRadius} mb-3 cursor-pointer`}
          style={{ backgroundColor: imgBackdrop }}
        >
          {isOutOfStock && (
            <span className="absolute top-3 left-3 z-10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-black text-white">
              Sold Out
            </span>
          )}
          <img
            src={imageUrl}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />

          {/* Subtle hover quick-add bar */}
          {!isOutOfStock && (
            <div className="absolute inset-x-3 bottom-3 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 flex gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToCart(product);
                }}
                className="flex-1 py-2 px-3 text-[11px] font-semibold uppercase tracking-wider bg-white/95 text-gray-900 shadow-md hover:bg-black hover:text-white transition-colors cursor-pointer"
              >
                + Quick Add
              </button>
            </div>
          )}
        </div>

        <div
          onClick={() => onQuickView(product)}
          className="cursor-pointer"
        >
          <h3
            className="text-xs sm:text-sm font-semibold truncate"
            style={{ color: palette.textPrimary }}
          >
            {product.name}
          </h3>
          <div className="mt-0.5 mb-2">
            <StorefrontPrice
              priceFormatted={product.basePriceFormatted}
              priceNaira={product.basePriceNaira}
              textColor={palette.textSecondary}
              size="sm"
            />
          </div>
        </div>

        <StorefrontColorSwatches
          swatches={swatches}
          selectedColor={selectedColor}
          onSelectColor={setSelectedColor}
          size="sm"
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VARIANT 5: boutique-badged (Drexel Shoppage-02, Funio Storefront-09, Glowing Storefront-12, Luxora)
  // Studio frame with corner badge (HOT / SALE / -15%), star rating, centered or
  // clean title, compare-at price, and full-width or underlined ADD TO CART CTA
  // ---------------------------------------------------------------------------
  const badgeType = index % 3 === 0 ? "HOT" : index % 3 === 1 ? "-15%" : "NEW";
  return (
    <div className="group flex flex-col">
      <div
        onClick={() => onQuickView(product)}
        className={`relative aspect-square w-full overflow-hidden ${cardRadius} mb-3.5 cursor-pointer`}
        style={{ backgroundColor: imgBackdrop }}
      >
        {/* Top corner badge */}
        <span
          className="absolute top-3 left-3 z-10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
          style={{
            backgroundColor:
              badgeType === "-15%"
                ? theme.accentColor
                : palette.isDark
                  ? "#F9FAFB"
                  : "#111827",
            color:
              badgeType === "-15%"
                ? "#FFFFFF"
                : palette.isDark
                  ? "#111827"
                  : "#FFFFFF",
          }}
        >
          {isOutOfStock ? "SOLD OUT" : badgeType}
        </span>

        {/* Top-right wishlist / quick-view icon (Illuminate & SA) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onQuickView(product);
          }}
          title="Quick View"
          className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-white/85 text-gray-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-2xs"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>

        <img
          src={imageUrl}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
      </div>

      <div className="text-center flex flex-col items-center flex-1">
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-1"
          style={{ color: palette.textMuted }}
        >
          {categoryLabel}
        </p>
        <h3
          onClick={() => onQuickView(product)}
          className="text-xs sm:text-sm font-bold uppercase tracking-wide truncate max-w-full cursor-pointer mb-1"
          style={{ color: palette.textPrimary }}
        >
          {product.name}
        </h3>

        <div className="mb-1.5">
          <StorefrontStarRating rating={ratingInfo.rating} mutedColor={palette.textMuted} />
        </div>

        <div className="mb-3">
          <StorefrontPrice
            priceFormatted={product.basePriceFormatted}
            priceNaira={product.basePriceNaira}
            showCompareAt={badgeType === "-15%"}
            textColor={palette.textPrimary}
            mutedColor={palette.textMuted}
            size="md"
          />
        </div>

        <StorefrontButton
          theme={theme}
          variant="solid"
          size="xs"
          disabled={isOutOfStock}
          onClick={() => onAddToCart(product)}
          className="mt-auto uppercase tracking-wider text-[11px] px-5"
        >
          {isOutOfStock ? "Out of Stock" : "Add to Cart"}
        </StorefrontButton>
      </div>
    </div>
  );
}
