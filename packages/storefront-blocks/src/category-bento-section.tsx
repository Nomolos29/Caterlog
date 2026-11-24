"use client";

import type { StorefrontProduct } from "./types";
import {
  resolveCardImageBackdrop,
  resolveHeadingFontStyle,
  resolveRadiusClass,
  resolveSurfacePalette,
  type CategoryBentoVariantId,
  type SectionHeadingStyleId,
  type StorefrontThemeTokens,
} from "./presets";
import { resolveStorefrontImageUrl, StorefrontSectionHeading } from "./primitives";

export interface CategoryTileItem {
  id: string;
  name: string;
  subtitle: string;
  count: number;
  imageUrl: string;
  priceFromFormatted?: string;
}

const FALLBACK_CATEGORY_TILES: CategoryTileItem[] = [
  {
    id: "New Arrivals",
    name: "New Arrivals",
    subtitle: "Just Landed",
    count: 12,
    imageUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80",
  },
  {
    id: "Best Sellers",
    name: "Best Sellers",
    subtitle: "Most Wanted",
    count: 18,
    imageUrl: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&q=80",
  },
  {
    id: "Footwear",
    name: "Footwear",
    subtitle: "Signature Pairs",
    count: 9,
    imageUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&q=80",
  },
  {
    id: "Accessories",
    name: "Accessories",
    subtitle: "Finishing Touches",
    count: 15,
    imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80",
  },
  {
    id: "Essentials",
    name: "Essentials",
    subtitle: "Daily Wardrobe",
    count: 14,
    imageUrl: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800&q=80",
  },
  {
    id: "Limited Drops",
    name: "Limited Drops",
    subtitle: "Up to 25% Off",
    count: 6,
    imageUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&q=80",
  },
];

export function deriveCategoryTiles(products: StorefrontProduct[]): CategoryTileItem[] {
  const byCategory = new Map<
    string,
    { count: number; imageUrl: string; lowestPriceFormatted: string; lowestPriceNaira: number }
  >();

  for (const p of products) {
    const cat = (p.category || "Signature Collection").trim();
    const img =
      resolveStorefrontImageUrl(p.primaryImageUrl) ||
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80";
    const existing = byCategory.get(cat);
    if (!existing) {
      byCategory.set(cat, {
        count: 1,
        imageUrl: img,
        lowestPriceFormatted: p.basePriceFormatted,
        lowestPriceNaira: p.basePriceNaira,
      });
    } else {
      existing.count += 1;
      if (p.basePriceNaira < existing.lowestPriceNaira) {
        existing.lowestPriceNaira = p.basePriceNaira;
        existing.lowestPriceFormatted = p.basePriceFormatted;
      }
    }
  }

  const derived: CategoryTileItem[] = Array.from(byCategory.entries()).map(([cat, info], idx) => ({
    id: cat,
    name: cat,
    subtitle: idx === 0 ? "Most Wanted" : idx === 1 ? "New Collection" : `${info.count} Items`,
    count: info.count,
    imageUrl: info.imageUrl,
    priceFromFormatted: info.lowestPriceFormatted,
  }));

  let i = 0;
  while (derived.length < 6) {
    const fb = FALLBACK_CATEGORY_TILES[i % FALLBACK_CATEGORY_TILES.length]!;
    const p = products[i % Math.max(1, products.length)];
    derived.push({
      id: p?.category || fb.id,
      name: p ? p.name.split(" ").slice(0, 2).join(" ") : fb.name,
      subtitle: fb.subtitle,
      count: p ? Math.max(1, p.availableStock) : fb.count,
      imageUrl: (p && resolveStorefrontImageUrl(p.primaryImageUrl)) || fb.imageUrl,
      priceFromFormatted: p?.basePriceFormatted,
    });
    i++;
  }

  return derived;
}

export interface StorefrontCategoryBentoProps {
  variant: CategoryBentoVariantId;
  headingStyle: SectionHeadingStyleId;
  theme: StorefrontThemeTokens;
  products: StorefrontProduct[];
  onSelectCategory: (category: string) => void;
}

export function StorefrontCategoryBentoSection({
  variant,
  headingStyle,
  theme,
  products,
  onSelectCategory,
}: StorefrontCategoryBentoProps) {
  const palette = resolveSurfacePalette(theme.surfaceMode);
  const headingFont = resolveHeadingFontStyle(theme.fontPairing);
  const cardRadius = resolveRadiusClass(theme.borderRadius, "card");
  const tiles = deriveCategoryTiles(products);

  const BentoTile = ({
    tile,
    className = "",
    overlayStyle = "corner-studio",
    index = 0,
  }: {
    tile: CategoryTileItem;
    className?: string;
    overlayStyle?: "corner-studio" | "centered-lookbook" | "split-pastel";
    index?: number;
  }) => {
    const bg = resolveCardImageBackdrop(theme.cardTone, index, palette.isDark);

    if (overlayStyle === "centered-lookbook") {
      return (
        <div
          onClick={() => onSelectCategory(tile.id)}
          className={`group relative overflow-hidden ${cardRadius} cursor-pointer ${className}`}
          style={{ backgroundColor: bg }}
        >
          <img
            src={tile.imageUrl}
            alt={tile.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors flex flex-col items-center justify-center p-4 text-center">
            <span
              className="text-sm @sm:text-base @lg:text-lg font-extrabold uppercase tracking-[0.2em] text-white drop-shadow-xs break-words"
              style={headingFont}
            >
              {tile.name}
            </span>
            <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/90 underline underline-offset-4 opacity-100 @lg:opacity-0 @lg:group-hover:opacity-100 transition-opacity">
              Shop Now →
            </span>
          </div>
        </div>
      );
    }

    if (overlayStyle === "split-pastel") {
      const pastel = resolveCardImageBackdrop("pastel-tint", index, palette.isDark);
      return (
        <div
          onClick={() => onSelectCategory(tile.id)}
          className={`group relative overflow-hidden ${cardRadius} cursor-pointer grid grid-cols-12 items-center p-4 @sm:p-6 gap-2 transition-shadow hover:shadow-md ${className}`}
          style={{ backgroundColor: pastel }}
        >
          <div className="col-span-7 z-10 pr-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-600 mb-1 truncate">
              {tile.subtitle}
            </p>
            <h3
              className="text-base @sm:text-xl @lg:text-2xl font-extrabold text-gray-900 leading-tight mb-2 break-words"
              style={headingFont}
            >
              {tile.name}
            </h3>
            <span className="inline-flex items-center gap-1 text-[11px] @sm:text-xs font-bold text-gray-900 border-b border-gray-900 pb-0.5">
              {tile.priceFromFormatted ? `From ${tile.priceFromFormatted}` : "Explore"} →
            </span>
          </div>
          <div className="col-span-5 h-28 @sm:h-36 @lg:h-40 rounded-lg overflow-hidden shadow-sm">
            <img
              src={tile.imageUrl}
              alt={tile.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        </div>
      );
    }

    return (
      <div
        onClick={() => onSelectCategory(tile.id)}
        className={`group relative overflow-hidden ${cardRadius} cursor-pointer ${className}`}
        style={{ backgroundColor: bg }}
      >
        <img
          src={tile.imageUrl}
          alt={tile.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-3.5 left-3.5 right-3.5 @sm:bottom-4 @sm:left-4 @sm:right-4 text-white">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/80 mb-0.5 truncate">
            {tile.subtitle}
          </p>
          <h3
            className="text-sm @sm:text-lg @lg:text-xl font-extrabold uppercase tracking-wider truncate"
            style={headingFont}
          >
            {tile.name}
          </h3>
          <span className="inline-block mt-1 text-[10px] @sm:text-[11px] font-bold uppercase tracking-wider border-b border-white pb-0.5">
            Shop Now
          </span>
        </div>
      </div>
    );
  };

  return (
    <section className="max-w-7xl mx-auto px-3.5 @sm:px-6 @lg:px-8 py-8 @sm:py-12">
      {variant === "4-tile-left-tall" && (
        <div className="grid grid-cols-1 @md:grid-cols-12 gap-4 @sm:gap-5">
          <BentoTile tile={tiles[0]!} index={0} className="@md:col-span-6 h-72 @sm:h-80 @md:h-[440px]" />
          <div className="@md:col-span-6 grid grid-cols-1 @sm:grid-cols-2 gap-4 @sm:gap-5">
            <BentoTile tile={tiles[1]!} index={1} className="@sm:col-span-2 h-48 @sm:h-52" />
            <BentoTile tile={tiles[2]!} index={2} className="col-span-1 h-48 @sm:h-52" />
            <BentoTile tile={tiles[3]!} index={3} className="col-span-1 h-48 @sm:h-52" />
          </div>
        </div>
      )}

      {variant === "4-tile-right-tall" && (
        <div className="grid grid-cols-1 @md:grid-cols-12 gap-4 @sm:gap-5">
          <div className="@md:col-span-6 grid grid-cols-1 @sm:grid-cols-2 gap-4 @sm:gap-5">
            <div
              className={`col-span-1 p-5 @sm:p-6 flex flex-col justify-center ${cardRadius} border min-h-[180px]`}
              style={{
                backgroundColor: palette.sectionAltBg,
                borderColor: palette.borderSubtle,
              }}
            >
              <p
                className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1.5"
                style={{ color: theme.accentColor }}
              >
                Curated Edit
              </p>
              <h2
                className="text-lg @sm:text-xl @lg:text-2xl font-bold uppercase leading-snug mb-3"
                style={{ ...headingFont, color: palette.textPrimary }}
              >
                Essentials Of Season
              </h2>
              <button
                type="button"
                onClick={() => onSelectCategory("ALL")}
                className="text-xs font-bold uppercase tracking-wider text-left underline underline-offset-4 cursor-pointer"
                style={{ color: palette.textPrimary }}
              >
                View All →
              </button>
            </div>

            <BentoTile
              tile={tiles[0]!}
              index={0}
              overlayStyle="centered-lookbook"
              className="col-span-1 h-52 @sm:h-56"
            />
            <BentoTile
              tile={tiles[1]!}
              index={1}
              overlayStyle="centered-lookbook"
              className="col-span-1 h-52 @sm:h-56"
            />
            <BentoTile
              tile={tiles[2]!}
              index={2}
              overlayStyle="centered-lookbook"
              className="col-span-1 h-52 @sm:h-56"
            />
          </div>

          <BentoTile
            tile={tiles[3]!}
            index={3}
            overlayStyle="centered-lookbook"
            className="@md:col-span-6 h-72 @sm:h-80 @md:h-[468px]"
          />
        </div>
      )}

      {variant === "6-tile-editorial-mosaic" && (
        <div className="space-y-4 @sm:space-y-5">
          <div className="grid grid-cols-1 @md:grid-cols-12 gap-4 @sm:gap-5">
            <div className="@md:col-span-6 flex flex-col gap-4 @sm:gap-5">
              <BentoTile tile={tiles[0]!} index={0} overlayStyle="split-pastel" className="flex-1" />
              <BentoTile tile={tiles[1]!} index={1} overlayStyle="split-pastel" className="flex-1" />
            </div>
            <BentoTile
              tile={tiles[2]!}
              index={2}
              className="@md:col-span-6 h-72 @md:h-auto min-h-[300px] @md:min-h-[340px]"
            />
          </div>

          <div className="grid grid-cols-1 @sm:grid-cols-2 @md:grid-cols-12 gap-4 @sm:gap-5">
            <BentoTile tile={tiles[3]!} index={3} className="@sm:col-span-1 @md:col-span-3 h-52 @sm:h-56" />
            <BentoTile
              tile={tiles[4]!}
              index={4}
              overlayStyle="split-pastel"
              className="@sm:col-span-2 @md:col-span-6 min-h-[190px] @sm:h-56"
            />
            <BentoTile tile={tiles[5]!} index={5} className="@sm:col-span-1 @md:col-span-3 h-52 @sm:h-56" />
          </div>
        </div>
      )}

      {variant === "2-col-split-banners" && (
        <div className="grid grid-cols-1 @md:grid-cols-2 gap-4 @sm:gap-6">
          <BentoTile
            tile={tiles[0]!}
            index={0}
            overlayStyle="split-pastel"
            className="min-h-[200px] @sm:min-h-[220px]"
          />
          <BentoTile
            tile={tiles[1]!}
            index={1}
            overlayStyle="split-pastel"
            className="min-h-[200px] @sm:min-h-[220px]"
          />
        </div>
      )}

      {variant === "thumbnail-strip" && (
        <div>
          <StorefrontSectionHeading
            title="Top Categories"
            styleVariant={headingStyle}
            theme={theme}
          />
          <div className="grid grid-cols-2 @sm:grid-cols-3 @lg:grid-cols-5 gap-3.5 @sm:gap-4">
            {tiles.slice(0, 5).map((t, idx) => (
              <button
                key={`${t.id}-${idx}`}
                type="button"
                onClick={() => onSelectCategory(t.id)}
                className="group text-center flex flex-col items-center cursor-pointer min-w-0"
              >
                <div
                  className={`w-full aspect-square overflow-hidden ${cardRadius} mb-2 p-2.5 @sm:p-3 flex items-center justify-center`}
                  style={{
                    backgroundColor: resolveCardImageBackdrop(theme.cardTone, idx, palette.isDark),
                  }}
                >
                  <img
                    src={t.imageUrl}
                    alt={t.name}
                    className="w-full h-full object-cover rounded-lg transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <span
                  className="text-xs font-bold uppercase tracking-wider truncate max-w-full"
                  style={{ color: palette.textPrimary }}
                >
                  {t.name}
                </span>
                <span className="text-[11px]" style={{ color: palette.textMuted }}>
                  {t.count} Products
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
