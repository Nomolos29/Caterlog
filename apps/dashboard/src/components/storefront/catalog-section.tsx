"use client";

import React, { useMemo, useState } from "react";
import type { Product } from "@/lib/types";
import {
  resolveRadiusClass,
  resolveSurfacePalette,
  type FilterLayoutVariantId,
  type ProductCardVariantId,
  type SectionHeadingStyleId,
  type StorefrontThemeTokens,
} from "@/lib/storefront-presets";
import {
  extractProductSizes,
  extractProductSwatches,
  StorefrontSectionHeading,
} from "./primitives";
import { StorefrontProductCard } from "./product-card";

export type CatalogSortOption = "newest" | "price-asc" | "price-desc" | "popular";

export interface StorefrontCatalogSectionProps {
  title?: string;
  subtitle?: string;
  products: Product[];
  filterLayout: FilterLayoutVariantId;
  productCardVariant: ProductCardVariantId;
  headingStyle: SectionHeadingStyleId;
  theme: StorefrontThemeTokens;
  defaultColumns: 3 | 4;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  showRecommendationsRow?: boolean;
  onAddToCart: (product: Product) => void;
  onBuyNow: (product: Product) => void;
  onQuickView: (product: Product) => void;
}

export function StorefrontCatalogSection({
  title,
  subtitle,
  products,
  filterLayout,
  productCardVariant,
  headingStyle,
  theme,
  defaultColumns,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  showRecommendationsRow = false,
  onAddToCart,
  onBuyNow,
  onQuickView,
}: StorefrontCatalogSectionProps) {
  const palette = resolveSurfacePalette(theme.surfaceMode);
  const cardRadius = resolveRadiusClass(theme.borderRadius, "card");

  const [sortBy, setSortBy] = useState<CatalogSortOption>("newest");
  const [columnsOverride, setColumnsOverride] = useState<2 | 3 | 4 | null>(null);
  const activeCols = columnsOverride ?? defaultColumns;

  const [selectedColor, setSelectedColor] = useState<string>("ALL");
  const [selectedSize, setSelectedSize] = useState<string>("ALL");
  const [priceRange, setPriceRange] = useState<"ALL" | "UNDER_15K" | "15K_50K" | "OVER_50K">("ALL");
  const [activePopover, setActivePopover] = useState<"color" | "price" | "size" | null>(null);

  // Extract unique categories with product counts
  const categoriesWithCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      const cat = (p.category || "Collection").trim();
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
  }, [products]);

  // Extract available color swatches across catalog
  const allColors = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p, idx) => {
      for (const s of extractProductSwatches(p, idx)) {
        if (!map.has(s.label)) map.set(s.label, s.hex);
      }
    });
    return Array.from(map.entries()).map(([label, hex]) => ({ label, hex }));
  }, [products]);

  // Extract available sizes across catalog (or fallback standard sizes for Constructor matrix)
  const allSizes = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      for (const sz of extractProductSizes(p)) {
        set.add(sz);
      }
    }
    if (set.size === 0) {
      return ["S", "M", "L", "XL", "38", "39", "40", "41", "42", "43", "44", "45"];
    }
    return Array.from(set).slice(0, 12);
  }, [products]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        if (selectedCategory !== "ALL") {
          const cat = (p.category || "Collection").trim().toLowerCase();
          if (cat !== selectedCategory.toLowerCase()) return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const match =
            p.name.toLowerCase().includes(q) ||
            p.skuCode.toLowerCase().includes(q) ||
            (p.category || "").toLowerCase().includes(q) ||
            (p.description || "").toLowerCase().includes(q);
          if (!match) return false;
        }
        if (priceRange === "UNDER_15K" && p.basePriceNaira >= 15000) return false;
        if (priceRange === "15K_50K" && (p.basePriceNaira < 15000 || p.basePriceNaira > 50000)) {
          return false;
        }
        if (priceRange === "OVER_50K" && p.basePriceNaira <= 50000) return false;

        if (selectedColor !== "ALL") {
          const prodColors = extractProductSwatches(p).map((s) => s.label.toLowerCase());
          if (!prodColors.includes(selectedColor.toLowerCase())) return false;
        }
        if (selectedSize !== "ALL") {
          const prodSizes = extractProductSizes(p);
          if (prodSizes.length > 0 && !prodSizes.includes(selectedSize.toUpperCase())) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "price-asc") return a.basePriceNaira - b.basePriceNaira;
        if (sortBy === "price-desc") return b.basePriceNaira - a.basePriceNaira;
        if (sortBy === "popular") return b.stockTotal - a.stockTotal;
        return 0;
      });
  }, [products, selectedCategory, searchQuery, priceRange, selectedColor, selectedSize, sortBy]);

  const gridColsClass =
    activeCols === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : activeCols === 3
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";

  const hasActiveFilters =
    selectedCategory !== "ALL" ||
    selectedColor !== "ALL" ||
    selectedSize !== "ALL" ||
    priceRange !== "ALL" ||
    Boolean(searchQuery.trim());

  const resetAllFilters = () => {
    onSelectCategory("ALL");
    setSelectedColor("ALL");
    setSelectedSize("ALL");
    setPriceRange("ALL");
    onSearchChange("");
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
      {title && (
        <StorefrontSectionHeading
          title={title}
          subtitle={subtitle}
          styleVariant={headingStyle}
          theme={theme}
        />
      )}

      {/* ---------------------------------------------------------------------
          FILTER LAYOUT 1: centered-category-tabs (SA Storefront-01, Ugmonk Storefront-07, Funio)
         --------------------------------------------------------------------- */}
      {filterLayout === "centered-category-tabs" && (
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-8">
          <button
            type="button"
            onClick={() => onSelectCategory("ALL")}
            className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              selectedCategory === "ALL" ? "shadow-xs" : "hover:opacity-75"
            }`}
            style={{
              backgroundColor: selectedCategory === "ALL" ? theme.accentColor : "transparent",
              color: selectedCategory === "ALL" ? "#FFFFFF" : palette.textSecondary,
              borderBottom:
                selectedCategory === "ALL" ? `2px solid ${theme.accentColor}` : "2px solid transparent",
            }}
          >
            All ({products.length})
          </button>
          {categoriesWithCounts.map((c) => {
            const isActive = selectedCategory.toLowerCase() === c.name.toLowerCase();
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => onSelectCategory(c.name)}
                className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                style={{
                  backgroundColor: isActive ? theme.accentColor : "transparent",
                  color: isActive ? "#FFFFFF" : palette.textSecondary,
                  borderBottom: isActive ? `2px solid ${theme.accentColor}` : "2px solid transparent",
                }}
              >
                {c.name} ({c.count})
              </button>
            );
          })}
        </div>
      )}

      {/* ---------------------------------------------------------------------
          FILTER LAYOUT 2: horizontal-popover-bar (Guza Storefront-06.jpg)
          Filter by: Categories | Color (popover) | Size | Price + Sort + 2/3/4 column density buttons
         --------------------------------------------------------------------- */}
      {filterLayout === "horizontal-popover-bar" && (
        <div
          className="relative flex flex-wrap items-center justify-between gap-4 pb-5 mb-8 border-b text-xs"
          style={{ borderColor: palette.borderSubtle }}
        >
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <span className="font-medium" style={{ color: palette.textMuted }}>
              Filter by
            </span>

            {/* Category select pill */}
            <select
              value={selectedCategory}
              onChange={(e) => onSelectCategory(e.target.value)}
              className="font-bold bg-transparent focus:outline-none cursor-pointer"
              style={{ color: palette.textPrimary }}
            >
              <option value="ALL">Categories ({products.length})</option>
              {categoriesWithCounts.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.count})
                </option>
              ))}
            </select>

            {/* Color Popover Trigger (Guza Storefront-06 exact popover) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setActivePopover(activePopover === "color" ? null : "color")}
                className="inline-flex items-center gap-1 font-bold cursor-pointer"
                style={{ color: palette.textPrimary }}
              >
                <span>Color{selectedColor !== "ALL" ? `: ${selectedColor}` : ""}</span>
                <span>▾</span>
              </button>
              {activePopover === "color" && (
                <div
                  className="absolute left-0 top-7 z-30 w-44 p-3.5 rounded-xl shadow-xl border space-y-2"
                  style={{
                    backgroundColor: palette.cardSurfaceBg,
                    borderColor: palette.borderSubtle,
                  }}
                >
                  <p className="text-[11px] font-bold mb-1" style={{ color: palette.textPrimary }}>
                    Colors
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedColor("ALL");
                      setActivePopover(null);
                    }}
                    className="w-full text-left text-xs py-1 hover:opacity-75 cursor-pointer flex items-center gap-2"
                    style={{ color: palette.textSecondary }}
                  >
                    <span className="w-3.5 h-3.5 rounded-full border border-gray-400 inline-block" />
                    <span>All Colors</span>
                  </button>
                  {allColors.map((c) => (
                    <button
                      key={c.label}
                      type="button"
                      onClick={() => {
                        setSelectedColor(c.label);
                        setActivePopover(null);
                      }}
                      className="w-full text-left text-xs py-1 hover:opacity-75 cursor-pointer flex items-center gap-2"
                      style={{
                        color:
                          selectedColor === c.label ? palette.textPrimary : palette.textSecondary,
                        fontWeight: selectedColor === c.label ? 700 : 400,
                      }}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border inline-block"
                        style={{ backgroundColor: c.hex, borderColor: "rgba(0,0,0,0.2)" }}
                      />
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Price Popover Trigger */}
            <select
              value={priceRange}
              onChange={(e) => setPriceRange(e.target.value as typeof priceRange)}
              className="font-bold bg-transparent focus:outline-none cursor-pointer"
              style={{ color: palette.textPrimary }}
            >
              <option value="ALL">Price: All</option>
              <option value="UNDER_15K">Under ₦15,000</option>
              <option value="15K_50K">₦15,000 – ₦50,000</option>
              <option value="OVER_50K">Over ₦50,000</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-[11px] font-semibold underline cursor-pointer"
                style={{ color: theme.accentColor }}
              >
                Reset
              </button>
            )}
          </div>

          {/* Right side: Sort dropdown + 2/3/4 Column Density Switcher (Guza Storefront-06) */}
          <div className="flex items-center gap-4">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as CatalogSortOption)}
              className="font-semibold bg-transparent focus:outline-none cursor-pointer"
              style={{ color: palette.textPrimary }}
            >
              <option value="newest">Default Sorting</option>
              <option value="popular">Highest Rated / Popular</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>

            <div className="hidden sm:flex items-center gap-1">
              {([2, 3, 4] as const).map((cols) => {
                const isSelected = activeCols === cols;
                return (
                  <button
                    key={cols}
                    type="button"
                    onClick={() => setColumnsOverride(cols)}
                    title={`${cols} Columns`}
                    className={`w-7 h-7 flex items-center justify-center border text-[10px] font-bold transition-colors cursor-pointer ${
                      isSelected ? "shadow-2xs" : "opacity-55 hover:opacity-100"
                    }`}
                    style={{
                      borderColor: isSelected ? palette.textPrimary : palette.borderSubtle,
                      color: palette.textPrimary,
                    }}
                  >
                    {"|".repeat(cols)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          MAIN CATALOG BODY: Optional Left Sidebar (sidebar-full) + Product Grid
         --------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {filterLayout === "sidebar-full" && (
          <aside className="lg:col-span-3 space-y-7">
            {/* 1. Categories Tree with Item Counts (Stuffsus Shoppage-01 & Constructor Shoppage-03) */}
            <div
              className={`p-5 border ${cardRadius}`}
              style={{
                backgroundColor: palette.cardSurfaceBg,
                borderColor: palette.borderSubtle,
              }}
            >
              <h3
                className="text-xs font-extrabold uppercase tracking-wider mb-3.5"
                style={{ color: palette.textPrimary }}
              >
                Categories
              </h3>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => onSelectCategory("ALL")}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  style={{
                    backgroundColor:
                      selectedCategory === "ALL" ? palette.sectionAltBg : "transparent",
                    color: selectedCategory === "ALL" ? theme.accentColor : palette.textSecondary,
                  }}
                >
                  <span>All Products</span>
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{
                      backgroundColor:
                        selectedCategory === "ALL" ? theme.accentColor : palette.sectionAltBg,
                      color: selectedCategory === "ALL" ? "#FFFFFF" : palette.textMuted,
                    }}
                  >
                    {products.length}
                  </span>
                </button>

                {categoriesWithCounts.map((c) => {
                  const isActive = selectedCategory.toLowerCase() === c.name.toLowerCase();
                  return (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => onSelectCategory(c.name)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer hover:opacity-80"
                      style={{
                        backgroundColor: isActive ? palette.sectionAltBg : "transparent",
                        color: isActive ? palette.textPrimary : palette.textSecondary,
                        fontWeight: isActive ? 700 : 500,
                      }}
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="text-[11px]" style={{ color: palette.textMuted }}>
                        {c.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Price Tier Filter (Constructor Shoppage-03 & Drexel Shoppage-02) */}
            <div
              className={`p-5 border ${cardRadius}`}
              style={{
                backgroundColor: palette.cardSurfaceBg,
                borderColor: palette.borderSubtle,
              }}
            >
              <h3
                className="text-xs font-extrabold uppercase tracking-wider mb-3.5"
                style={{ color: palette.textPrimary }}
              >
                Price Range
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {(
                  [
                    { id: "ALL", label: "All Prices" },
                    { id: "UNDER_15K", label: "Under ₦15k" },
                    { id: "15K_50K", label: "₦15k – ₦50k" },
                    { id: "OVER_50K", label: "Over ₦50k" },
                  ] as const
                ).map((tier) => {
                  const isSelected = priceRange === tier.id;
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => setPriceRange(tier.id)}
                      className="flex items-center gap-1.5 py-1.5 px-2 rounded-md text-left cursor-pointer"
                      style={{
                        color: isSelected ? palette.textPrimary : palette.textSecondary,
                        fontWeight: isSelected ? 700 : 400,
                      }}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0"
                        style={{
                          borderColor: isSelected ? theme.accentColor : palette.borderSubtle,
                          backgroundColor: isSelected ? theme.accentColor : "transparent",
                        }}
                      >
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                      <span className="truncate text-[11px]">{tier.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Color Swatch Circles (Constructor Shoppage-03) */}
            <div
              className={`p-5 border ${cardRadius}`}
              style={{
                backgroundColor: palette.cardSurfaceBg,
                borderColor: palette.borderSubtle,
              }}
            >
              <div className="flex items-center justify-between mb-3.5">
                <h3
                  className="text-xs font-extrabold uppercase tracking-wider"
                  style={{ color: palette.textPrimary }}
                >
                  Colors
                </h3>
                {selectedColor !== "ALL" && (
                  <button
                    type="button"
                    onClick={() => setSelectedColor("ALL")}
                    className="text-[10px] underline cursor-pointer"
                    style={{ color: palette.textMuted }}
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2.5">
                {allColors.map((c) => {
                  const isSelected = selectedColor === c.label;
                  return (
                    <button
                      key={c.label}
                      type="button"
                      title={c.label}
                      onClick={() => setSelectedColor(isSelected ? "ALL" : c.label)}
                      className={`w-6 h-6 rounded-full border transition-transform cursor-pointer ${
                        isSelected ? "scale-115 ring-2 ring-offset-2 ring-gray-900" : "hover:scale-105"
                      }`}
                      style={{
                        backgroundColor: c.hex,
                        borderColor: "rgba(0,0,0,0.18)",
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* 4. Bordered Size Matrix Grid (Constructor Shoppage-03) */}
            <div
              className={`p-5 border ${cardRadius}`}
              style={{
                backgroundColor: palette.cardSurfaceBg,
                borderColor: palette.borderSubtle,
              }}
            >
              <div className="flex items-center justify-between mb-3.5">
                <h3
                  className="text-xs font-extrabold uppercase tracking-wider"
                  style={{ color: palette.textPrimary }}
                >
                  Size
                </h3>
                {selectedSize !== "ALL" && (
                  <button
                    type="button"
                    onClick={() => setSelectedSize("ALL")}
                    className="text-[10px] underline cursor-pointer"
                    style={{ color: palette.textMuted }}
                  >
                    Clear
                  </button>
                )}
              </div>
              <div
                className="grid grid-cols-4 border-t border-l"
                style={{ borderColor: palette.borderSubtle }}
              >
                {allSizes.map((sz) => {
                  const isSelected = selectedSize === sz;
                  return (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setSelectedSize(isSelected ? "ALL" : sz)}
                      className="py-2 text-[11px] font-semibold border-r border-b transition-colors cursor-pointer"
                      style={{
                        borderColor: palette.borderSubtle,
                        backgroundColor: isSelected ? theme.accentColor : "transparent",
                        color: isSelected ? "#FFFFFF" : palette.textSecondary,
                      }}
                    >
                      {sz}
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        )}

        {/* Right/Main Product Grid Column */}
        <div className={filterLayout === "sidebar-full" ? "lg:col-span-9" : "lg:col-span-12"}>
          {/* Top sort bar when in sidebar-full mode (Constructor Shoppage-03 & Drexel Shoppage-02) */}
          {filterLayout === "sidebar-full" && (
            <div
              className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-6 border-b text-xs"
              style={{ borderColor: palette.borderSubtle }}
            >
              <p className="font-semibold" style={{ color: palette.textSecondary }}>
                Showing <span style={{ color: palette.textPrimary }}>{filteredProducts.length}</span>{" "}
                of {products.length} Products
                {selectedCategory !== "ALL" ? ` in "${selectedCategory}"` : ""}
              </p>

              <div className="flex items-center gap-4">
                {(
                  [
                    { id: "newest", label: "Newest" },
                    { id: "popular", label: "Highest Rated" },
                    { id: "price-asc", label: "Low Price to High" },
                    { id: "price-desc", label: "High Price to Low" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSortBy(opt.id)}
                    className="text-xs transition-colors cursor-pointer"
                    style={{
                      color: sortBy === opt.id ? theme.accentColor : palette.textMuted,
                      fontWeight: sortBy === opt.id ? 700 : 500,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredProducts.length === 0 ? (
            <div
              className={`py-16 px-6 text-center border ${cardRadius}`}
              style={{
                backgroundColor: palette.sectionAltBg,
                borderColor: palette.borderSubtle,
              }}
            >
              <p
                className="text-base font-bold mb-1"
                style={{ color: palette.textPrimary }}
              >
                No matching products found
              </p>
              <p className="text-xs mb-4" style={{ color: palette.textMuted }}>
                Try clearing one of your active filters or searching for another item.
              </p>
              <button
                type="button"
                onClick={resetAllFilters}
                className="px-5 py-2 rounded-full text-xs font-bold text-white cursor-pointer"
                style={{ backgroundColor: theme.accentColor }}
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className={`grid ${gridColsClass} gap-6 sm:gap-7`}>
              {filteredProducts.map((product, idx) => (
                <StorefrontProductCard
                  key={product.id}
                  product={product}
                  index={idx}
                  variant={productCardVariant}
                  theme={theme}
                  onAddToCart={onAddToCart}
                  onBuyNow={onBuyNow}
                  onQuickView={onQuickView}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Optional "Explore our recommendations" horizontal section from Shoppage-01 */}
      {showRecommendationsRow && products.length > 2 && (
        <div className="mt-16 pt-10 border-t" style={{ borderColor: palette.borderSubtle }}>
          <StorefrontSectionHeading
            title="Explore our recommendations"
            styleVariant="left-with-link"
            theme={theme}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.slice(0, 3).map((product, idx) => (
              <StorefrontProductCard
                key={`rec-${product.id}`}
                product={product}
                index={idx + 2}
                variant={productCardVariant}
                theme={theme}
                onAddToCart={onAddToCart}
                onBuyNow={onBuyNow}
                onQuickView={onQuickView}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
