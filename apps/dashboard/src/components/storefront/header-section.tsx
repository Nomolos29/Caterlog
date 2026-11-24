"use client";

import React, { useState } from "react";
import {
  resolveHeadingFontStyle,
  resolveSurfacePalette,
  type HeaderVariantId,
  type StorefrontMode,
  type StorefrontThemeTokens,
} from "@/lib/storefront-presets";

export type StorefrontActivePage = "home" | "shop" | "collections" | "about" | "track";

export interface StorefrontHeaderProps {
  businessName: string;
  isVerified: boolean;
  mode: StorefrontMode;
  variant: HeaderVariantId;
  theme: StorefrontThemeTokens;
  showAnnouncementBar: boolean;
  announcementText: string;
  activePage: StorefrontActivePage;
  onSelectPage: (page: StorefrontActivePage) => void;
  cartCount: number;
  onOpenCart: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  whatsappPhone?: string;
}

export function StorefrontHeaderSection({
  businessName,
  isVerified,
  mode,
  variant,
  theme,
  showAnnouncementBar,
  announcementText,
  activePage,
  onSelectPage,
  cartCount,
  onOpenCart,
  searchQuery,
  onSearchChange,
}: StorefrontHeaderProps) {
  const palette = resolveSurfacePalette(theme.surfaceMode);
  const headingFont = resolveHeadingFontStyle(theme.fontPairing);
  const [searchOpen, setSearchOpen] = useState(false);

  // Starter / Dropshipper storefronts focus on Catalog + Order Tracking;
  // Growth & Pro websites get the full multi-page brand navigation.
  const navLinks: Array<{ id: StorefrontActivePage; label: string }> =
    mode === "FULL_WEBSITE"
      ? [
          { id: "home", label: "Home" },
          { id: "shop", label: "Shop" },
          { id: "collections", label: "Lookbook" },
          { id: "about", label: "Our Story" },
          { id: "track", label: "Track Order" },
        ]
      : [
          { id: "shop", label: "Catalog" },
          { id: "track", label: "Track Order" },
        ];

  const BrandWordmark = ({ framed = false }: { framed?: boolean }) => (
    <button
      type="button"
      onClick={() => onSelectPage(mode === "FULL_WEBSITE" ? "home" : "shop")}
      className="inline-flex items-center gap-2 text-left cursor-pointer group"
    >
      <span
        className={`text-lg sm:text-xl font-extrabold tracking-tight transition-opacity group-hover:opacity-80 ${
          framed ? "border-2 px-3 py-0.5 uppercase tracking-[0.2em]" : ""
        }`}
        style={{
          ...headingFont,
          color: palette.textPrimary,
          borderColor: framed ? palette.textPrimary : undefined,
        }}
      >
        {businessName}
      </span>
      {isVerified && (
        <span
          title="Caterlog Verified Merchant (CAC & Monnify Escrow Protected)"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-700"
        >
          <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="hidden sm:inline">Verified</span>
        </span>
      )}
    </button>
  );

  const NavItemsList = () => (
    <nav className="flex items-center gap-5 sm:gap-7 overflow-x-auto no-scrollbar">
      {navLinks.map((item) => {
        const isActive = activePage === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectPage(item.id)}
            className={`text-xs sm:text-sm font-medium whitespace-nowrap transition-colors py-1 cursor-pointer ${
              isActive ? "font-bold border-b-2" : "hover:opacity-75"
            }`}
            style={{
              color: isActive ? palette.textPrimary : palette.textSecondary,
              borderColor: isActive ? theme.accentColor : "transparent",
            }}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );

  const UtilityIcons = () => (
    <div className="flex items-center gap-3 sm:gap-4">
      <button
        type="button"
        onClick={() => {
          setSearchOpen((prev) => !prev);
          if (activePage !== "shop") onSelectPage("shop");
        }}
        title="Search products"
        className="p-1.5 rounded-full hover:opacity-75 transition-opacity cursor-pointer"
        style={{ color: palette.textPrimary }}
      >
        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      </button>

      <button
        type="button"
        onClick={onOpenCart}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-transform hover:scale-105 cursor-pointer"
        style={{
          backgroundColor: theme.accentColor,
          color: "#FFFFFF",
        }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
        <span>Bag</span>
        <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[11px]">
          {cartCount}
        </span>
      </button>
    </div>
  );

  return (
    <header
      className="sticky top-0 z-30 border-b transition-colors"
      style={{
        backgroundColor: palette.pageBg,
        borderColor: palette.borderSubtle,
      }}
    >
      {/* Optional Announcement Strip (Luxora, Glowing, Kylie) */}
      {showAnnouncementBar && announcementText && (
        <div
          className="px-4 py-2 text-center text-[11px] font-semibold tracking-wider uppercase"
          style={{
            backgroundColor: theme.accentColor,
            color: "#FFFFFF",
          }}
        >
          {announcementText}
        </div>
      )}

      {/* VARIANT 1: bordered-editorial (Jenahara Storefront-05.jpg) */}
      {variant === "bordered-editorial" && (
        <div
          className="max-w-7xl mx-auto grid grid-cols-12 items-center text-xs"
          style={{ borderColor: palette.borderSubtle }}
        >
          <div
            className="col-span-4 sm:col-span-3 flex items-center divide-x border-r py-3.5 px-4"
            style={{ borderColor: palette.borderSubtle }}
          >
            <div className="pr-3">
              <BrandWordmark />
            </div>
          </div>

          <div className="col-span-4 sm:col-span-6 flex justify-center py-3.5 px-4">
            <NavItemsList />
          </div>

          <div
            className="col-span-4 sm:col-span-3 flex items-center justify-end gap-3 border-l py-3.5 px-4"
            style={{ borderColor: palette.borderSubtle }}
          >
            <UtilityIcons />
          </div>
        </div>
      )}

      {/* VARIANT 2: stacked-boutique (SA Storefront-01.jpg) */}
      {variant === "stacked-boutique" && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div
            className="flex items-center justify-between py-4 border-b"
            style={{ borderColor: palette.borderSubtle }}
          >
            <div className="hidden sm:flex items-center gap-2 w-56">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  onSearchChange(e.target.value);
                  if (activePage !== "shop") onSelectPage("shop");
                }}
                placeholder="Search anything..."
                className="w-full text-xs bg-transparent border-b pb-1 focus:outline-none"
                style={{
                  color: palette.textPrimary,
                  borderColor: palette.borderSubtle,
                }}
              />
            </div>
            <div className="mx-auto">
              <BrandWordmark framed />
            </div>
            <div className="w-56 flex justify-end">
              <UtilityIcons />
            </div>
          </div>
          <div className="py-2.5 flex justify-center">
            <NavItemsList />
          </div>
        </div>
      )}

      {/* VARIANT 3: centered-editorial (Drexel, Glowing, Funio, Bagkin) */}
      {variant === "centered-editorial" && (
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 grid grid-cols-12 items-center gap-4">
          <div className="col-span-5 hidden md:flex items-center">
            <NavItemsList />
          </div>
          <div className="col-span-7 md:col-span-2 flex md:justify-center">
            <BrandWordmark />
          </div>
          <div className="col-span-5 flex items-center justify-end">
            <UtilityIcons />
          </div>
          <div className="col-span-12 md:hidden pt-1 border-t flex justify-center" style={{ borderColor: palette.borderSubtle }}>
            <NavItemsList />
          </div>
        </div>
      )}

      {/* VARIANT 4: minimal-inline (Guza, Minim, Ugmonk, Stuffsus) */}
      {variant === "minimal-inline" && (
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <BrandWordmark />
            <div className="hidden md:block">
              <NavItemsList />
            </div>
          </div>
          <UtilityIcons />
        </div>
      )}

      {/* Expandable quick search bar when search icon is clicked */}
      {searchOpen && (
        <div
          className="border-t px-4 sm:px-8 py-3"
          style={{
            backgroundColor: palette.sectionAltBg,
            borderColor: palette.borderSubtle,
          }}
        >
          <div className="max-w-2xl mx-auto flex items-center gap-2">
            <input
              type="search"
              autoFocus
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={`Search ${businessName} catalog by name, SKU, or category...`}
              className="flex-1 px-4 py-2 text-xs sm:text-sm rounded-full border focus:outline-none"
              style={{
                backgroundColor: palette.cardSurfaceBg,
                color: palette.textPrimary,
                borderColor: palette.borderSubtle,
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="text-xs px-3 py-1.5 rounded-full hover:opacity-75 cursor-pointer"
                style={{ color: palette.textSecondary }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
