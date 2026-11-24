"use client";

import React from "react";
import type { StorefrontProduct } from "./types";
import {
  resolveHeadingFontStyle,
  resolveRadiusClass,
  resolveSurfacePalette,
  type SectionHeadingStyleId,
  type StorefrontThemeTokens,
} from "./presets";

export function resolveStorefrontImageUrl(url?: string): string {
  if (!url) return "";
  if (url.startsWith("/api/v1/media/")) {
    if (typeof window !== "undefined") {
      return url;
    }
    return `http://127.0.0.1:4000${url}`;
  }
  return url;
}

const NAMED_COLOR_MAP: Record<string, { label: string; hex: string }> = {
  black: { label: "Black", hex: "#18181B" },
  obsidian: { label: "Obsidian", hex: "#111827" },
  white: { label: "White", hex: "#F9FAFB" },
  ivory: { label: "Ivory", hex: "#FAF8F5" },
  cream: { label: "Cream", hex: "#F3EFEA" },
  bone: { label: "Bone", hex: "#E7E2DA" },
  brown: { label: "Brown", hex: "#7C523E" },
  tan: { label: "Tan", hex: "#C89D7C" },
  camel: { label: "Camel", hex: "#C19A6B" },
  gold: { label: "Gold", hex: "#D4AF37" },
  red: { label: "Red", hex: "#DC2626" },
  burgundy: { label: "Burgundy", hex: "#5B2333" },
  wine: { label: "Wine", hex: "#722F37" },
  pink: { label: "Pink", hex: "#EC4899" },
  rose: { label: "Rose", hex: "#E11D48" },
  blue: { label: "Blue", hex: "#2563EB" },
  navy: { label: "Navy", hex: "#1E3A8A" },
  indigo: { label: "Indigo", hex: "#4F46E5" },
  green: { label: "Green", hex: "#16A34A" },
  emerald: { label: "Emerald", hex: "#059669" },
  olive: { label: "Olive", hex: "#4D6B53" },
  sage: { label: "Sage", hex: "#84A98C" },
  forest: { label: "Forest", hex: "#14532D" },
  grey: { label: "Grey", hex: "#6B7280" },
  gray: { label: "Gray", hex: "#6B7280" },
  charcoal: { label: "Charcoal", hex: "#374151" },
  silver: { label: "Silver", hex: "#9CA3AF" },
  yellow: { label: "Yellow", hex: "#EAB308" },
  orange: { label: "Orange", hex: "#EA580C" },
  purple: { label: "Purple", hex: "#9333EA" },
};

const FALLBACK_SWATCH_SETS: Array<Array<{ label: string; hex: string }>> = [
  [
    { label: "Obsidian", hex: "#18181B" },
    { label: "Camel", hex: "#C89D7C" },
    { label: "Stone", hex: "#9CA3AF" },
  ],
  [
    { label: "Navy", hex: "#1E3A8A" },
    { label: "Terracotta", hex: "#B87D5B" },
    { label: "Sand", hex: "#D6CFC7" },
  ],
  [
    { label: "Forest", hex: "#3F5244" },
    { label: "Burgundy", hex: "#5B2333" },
    { label: "Ivory", hex: "#EAE5DF" },
  ],
];

export function extractProductSwatches(
  product: StorefrontProduct,
  fallbackIndex = 0
): Array<{ label: string; hex: string }> {
  const found = new Map<string, { label: string; hex: string }>();
  const textToScan = [
    product.name,
    product.customFields?.color ?? "",
    product.customFields?.colors ?? "",
    ...(product.variants?.map((v) => v.name) ?? []),
  ]
    .join(" ")
    .toLowerCase();

  for (const [key, swatch] of Object.entries(NAMED_COLOR_MAP)) {
    if (new RegExp(`\\b${key}\\b`, "i").test(textToScan)) {
      found.set(swatch.label, swatch);
    }
  }

  if (found.size > 0) {
    return Array.from(found.values()).slice(0, 4);
  }
  return FALLBACK_SWATCH_SETS[fallbackIndex % FALLBACK_SWATCH_SETS.length]!;
}

export function extractProductSizes(product: StorefrontProduct): string[] {
  const sizes = new Set<string>();
  for (const v of product.variants ?? []) {
    const match = v.name.match(/\b(XXS|XS|S|M|L|XL|XXL|2XL|3XL|\d{2}(?:\.\d)?)\b/i);
    if (match && match[1]) {
      sizes.add(match[1].toUpperCase());
    }
  }
  if (product.customFields?.size) {
    for (const part of product.customFields.size.split(/[,/]/)) {
      const clean = part.trim().toUpperCase();
      if (clean) sizes.add(clean);
    }
  }
  return Array.from(sizes);
}

export function computeSyntheticRating(product: StorefrontProduct, index = 0): {
  rating: string;
  reviewsCount: string;
} {
  const scores = ["5.0", "4.9", "4.8", "4.9", "4.7"];
  const counts = ["1.2k", "340", "820", "195", "610"];
  const seed = (product.skuCode.charCodeAt(0) + index) % scores.length;
  return {
    rating: scores[seed]!,
    reviewsCount: counts[seed]!,
  };
}

export interface StorefrontSectionHeadingProps {
  title: string;
  subtitle?: string;
  overline?: string;
  styleVariant: SectionHeadingStyleId;
  theme: StorefrontThemeTokens;
  actionLabel?: string;
  onAction?: () => void;
  rightSlot?: React.ReactNode;
}

export function StorefrontSectionHeading({
  title,
  subtitle,
  overline,
  styleVariant,
  theme,
  actionLabel,
  onAction,
  rightSlot,
}: StorefrontSectionHeadingProps) {
  const palette = resolveSurfacePalette(theme.surfaceMode);
  const headingFont = resolveHeadingFontStyle(theme.fontPairing);

  if (styleVariant === "left-with-link") {
    return (
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8">
        <div>
          {overline && (
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-1.5"
              style={{ color: theme.accentColor }}
            >
              {overline}
            </p>
          )}
          <h2
            className="text-2xl sm:text-3xl font-bold tracking-tight"
            style={{ ...headingFont, color: palette.textPrimary }}
          >
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm mt-1" style={{ color: palette.textMuted }}>
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {rightSlot}
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider hover:opacity-75 transition-opacity cursor-pointer"
              style={{ color: palette.textPrimary }}
            >
              <span>{actionLabel}</span>
              <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  if (styleVariant === "flanking-lines") {
    return (
      <div className="mb-9 text-center">
        {overline && (
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.22em] mb-2"
            style={{ color: palette.textMuted }}
          >
            {overline}
          </p>
        )}
        <div className="flex items-center justify-center gap-5 max-w-xl mx-auto">
          <span
            className="h-px flex-1"
            style={{ backgroundColor: palette.borderSubtle }}
          />
          <h2
            className="text-xl sm:text-2xl font-medium uppercase tracking-[0.18em] px-2"
            style={{ ...headingFont, color: palette.textPrimary }}
          >
            {title}
          </h2>
          <span
            className="h-px flex-1"
            style={{ backgroundColor: palette.borderSubtle }}
          />
        </div>
        {subtitle && (
          <p className="text-xs sm:text-sm mt-2 max-w-md mx-auto" style={{ color: palette.textMuted }}>
            {subtitle}
          </p>
        )}
        {rightSlot && <div className="mt-4 flex justify-center">{rightSlot}</div>}
      </div>
    );
  }

  if (styleVariant === "framed-box") {
    return (
      <div className="mb-9 text-center">
        <div
          className="inline-block border px-8 py-2.5"
          style={{ borderColor: palette.textPrimary }}
        >
          <h2
            className="text-sm sm:text-base font-bold uppercase tracking-[0.25em]"
            style={{ ...headingFont, color: palette.textPrimary }}
          >
            {title}
          </h2>
        </div>
        {subtitle && (
          <p className="text-xs sm:text-sm mt-2.5 max-w-md mx-auto" style={{ color: palette.textMuted }}>
            {subtitle}
          </p>
        )}
        {rightSlot && <div className="mt-4 flex justify-center">{rightSlot}</div>}
      </div>
    );
  }

  return (
    <div className="mb-9 text-center max-w-2xl mx-auto">
      {overline && (
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-1.5"
          style={{ color: theme.accentColor }}
        >
          {overline}
        </p>
      )}
      <h2
        className="text-2xl sm:text-3xl font-bold tracking-tight"
        style={{ ...headingFont, color: palette.textPrimary }}
      >
        {title}
      </h2>
      {subtitle && (
        <p className="text-sm mt-1.5" style={{ color: palette.textMuted }}>
          {subtitle}
        </p>
      )}
      {rightSlot && <div className="mt-4 flex justify-center">{rightSlot}</div>}
    </div>
  );
}

export interface StorefrontButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  theme: StorefrontThemeTokens;
  variant?: "solid" | "outline" | "dark" | "white-pill" | "underline";
  size?: "xs" | "sm" | "md" | "lg";
  fullWidth?: boolean;
}

export function StorefrontButton({
  theme,
  variant = "solid",
  size = "md",
  fullWidth = false,
  className = "",
  children,
  style,
  ...rest
}: StorefrontButtonProps) {
  const palette = resolveSurfacePalette(theme.surfaceMode);
  const radiusCls =
    variant === "white-pill"
      ? "rounded-full"
      : variant === "underline"
        ? "rounded-none"
        : resolveRadiusClass(theme.borderRadius, "button");

  const sizeCls =
    size === "xs"
      ? "px-3 py-1.5 text-[11px]"
      : size === "sm"
        ? "px-4 py-2 text-xs"
        : size === "lg"
          ? "px-7 py-3.5 text-sm"
          : "px-5 py-2.5 text-xs sm:text-sm";

  let dynamicStyle: React.CSSProperties = {};
  let baseCls =
    "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 cursor-pointer select-none disabled:opacity-45 disabled:cursor-not-allowed";

  if (variant === "solid") {
    dynamicStyle = {
      backgroundColor: theme.accentColor,
      color: "#FFFFFF",
      border: `1px solid ${theme.accentColor}`,
    };
    baseCls += " hover:opacity-90 shadow-xs";
  } else if (variant === "dark") {
    dynamicStyle = {
      backgroundColor: "#111827",
      color: "#FFFFFF",
      border: "1px solid #111827",
    };
    baseCls += " hover:bg-black";
  } else if (variant === "outline") {
    dynamicStyle = {
      backgroundColor: "transparent",
      color: palette.textPrimary,
      border: `1px solid ${palette.borderSubtle}`,
    };
    baseCls += " hover:border-current";
  } else if (variant === "white-pill") {
    dynamicStyle = {
      backgroundColor: "#FFFFFF",
      color: "#111827",
      border: "1px solid rgba(0,0,0,0.08)",
    };
    baseCls += " shadow-md hover:shadow-lg";
  } else if (variant === "underline") {
    dynamicStyle = {
      backgroundColor: "transparent",
      color: palette.textPrimary,
      borderBottom: `1.5px solid ${palette.textPrimary}`,
    };
    baseCls += " !px-0 !py-1 uppercase tracking-wider text-xs hover:opacity-70";
  }

  return (
    <button
      type="button"
      className={`${baseCls} ${radiusCls} ${sizeCls} ${fullWidth ? "w-full" : ""} ${className}`}
      style={{ ...dynamicStyle, ...style }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function StorefrontStarRating({
  rating = "4.9",
  reviewsCount,
  compact = false,
  color = "#F59E0B",
  mutedColor = "#6B7280",
}: {
  rating?: string;
  reviewsCount?: string;
  compact?: boolean;
  color?: string;
  mutedColor?: string;
}) {
  if (compact) {
    return (
      <div className="inline-flex items-center gap-1 text-[11px]">
        <span style={{ color }}>★</span>
        <span className="font-semibold" style={{ color: mutedColor }}>
          {rating}
          {reviewsCount ? ` (${reviewsCount} Reviews)` : ""}
        </span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1 text-xs" aria-label={`Rated ${rating} out of 5`}>
      <span className="tracking-tighter" style={{ color }}>
        ★★★★★
      </span>
      {reviewsCount && (
        <span className="text-[11px]" style={{ color: mutedColor }}>
          ({reviewsCount})
        </span>
      )}
    </div>
  );
}

export function StorefrontColorSwatches({
  swatches,
  selectedColor,
  onSelectColor,
  size = "sm",
  vertical = false,
}: {
  swatches: Array<{ label: string; hex: string }>;
  selectedColor?: string;
  onSelectColor?: (label: string) => void;
  size?: "sm" | "md";
  vertical?: boolean;
}) {
  const dotCls = size === "md" ? "w-4 h-4" : "w-3 h-3";
  return (
    <div
      className={`inline-flex ${vertical ? "flex-col" : "flex-row"} items-center gap-1.5`}
      onClick={(e) => e.stopPropagation()}
    >
      {swatches.map((s) => {
        const isSelected = selectedColor?.toLowerCase() === s.label.toLowerCase();
        return (
          <button
            key={s.label}
            type="button"
            title={s.label}
            onClick={() => onSelectColor?.(s.label)}
            className={`${dotCls} rounded-full border transition-transform cursor-pointer ${
              isSelected ? "scale-125 ring-2 ring-offset-1 ring-gray-900" : "hover:scale-110"
            }`}
            style={{
              backgroundColor: s.hex,
              borderColor: "rgba(0,0,0,0.18)",
            }}
          />
        );
      })}
    </div>
  );
}

export function StorefrontPrice({
  priceFormatted,
  priceNaira,
  showCompareAt = false,
  textColor = "#111827",
  mutedColor = "#9CA3AF",
  size = "md",
}: {
  priceFormatted: string;
  priceNaira: number;
  showCompareAt?: boolean;
  textColor?: string;
  mutedColor?: string;
  size?: "sm" | "md" | "lg";
}) {
  const compareAtNaira = showCompareAt ? Math.round(priceNaira * 1.2) : null;
  const textCls =
    size === "lg"
      ? "text-base sm:text-lg font-bold"
      : size === "sm"
        ? "text-xs font-semibold"
        : "text-sm font-bold";

  return (
    <div className="inline-flex items-baseline gap-2 flex-wrap">
      <span className={textCls} style={{ color: textColor }}>
        {priceFormatted}
      </span>
      {compareAtNaira && (
        <span className="text-xs line-through" style={{ color: mutedColor }}>
          ₦{compareAtNaira.toLocaleString()}
        </span>
      )}
    </div>
  );
}
