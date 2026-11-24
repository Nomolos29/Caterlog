"use client";

import { useState } from "react";
import type { StorefrontActivePage } from "./types";
import {
  resolveHeadingFontStyle,
  resolveSurfacePalette,
  type HeaderVariantId,
  type StorefrontMode,
  type StorefrontThemeTokens,
} from "./presets";

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const handleNavClick = (page: StorefrontActivePage) => {
    onSelectPage(page);
    setMobileMenuOpen(false);
  };

  const BrandWordmark = ({ framed = false }: { framed?: boolean }) => (
    <button
      type="button"
      onClick={() => handleNavClick(mode === "FULL_WEBSITE" ? "home" : "shop")}
      className="inline-flex items-center gap-2 text-left cursor-pointer group min-w-0 max-w-full"
    >
      <span
        className={`text-base @sm:text-xl @lg:text-2xl font-black tracking-tight truncate max-w-[165px] @sm:max-w-[260px] @lg:max-w-none transition-opacity group-hover:opacity-80 ${
          framed ? "border-2 px-2.5 @sm:px-3.5 py-0.5 uppercase tracking-[0.16em] @sm:tracking-[0.22em]" : ""
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
          title="Verified Merchant (CAC & Escrow Protected)"
          className="shrink-0 inline-flex items-center gap-1 px-1.5 @sm:px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-700"
        >
          <svg className="w-3 h-3 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="hidden @sm:inline">Verified</span>
        </span>
      )}
    </button>
  );

  const NavItemsList = () => (
    <nav className="flex items-center gap-4 @sm:gap-6 @lg:gap-8 overflow-x-auto no-scrollbar max-w-full">
      {navLinks.map((item) => {
        const isActive = activePage === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleNavClick(item.id)}
            className={`text-xs @sm:text-[13px] tracking-wide whitespace-nowrap transition-all py-1.5 cursor-pointer relative ${
              isActive ? "font-bold" : "font-medium hover:opacity-75"
            }`}
            style={{
              color: isActive ? palette.textPrimary : palette.textSecondary,
            }}
          >
            {item.label}
            {isActive && (
              <span
                className="absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full"
                style={{ backgroundColor: theme.accentColor }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );

  const UtilityIcons = () => (
    <div className="flex items-center gap-1.5 @sm:gap-2.5 shrink-0">
      <button
        type="button"
        onClick={() => {
          setSearchOpen((prev) => !prev);
          if (activePage !== "shop") onSelectPage("shop");
        }}
        title="Search catalog"
        className="p-2 rounded-full hover:opacity-75 transition-opacity cursor-pointer"
        style={{
          color: palette.textPrimary,
          backgroundColor: searchOpen ? palette.sectionAltBg : "transparent",
        }}
      >
        <svg className="w-4 h-4 @sm:w-5 @sm:h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      </button>

      <button
        type="button"
        onClick={onOpenCart}
        className="inline-flex items-center gap-1.5 @sm:gap-2 px-2.5 @sm:px-3.5 py-1.5 @sm:py-2 rounded-full text-xs font-bold transition-all hover:opacity-90 cursor-pointer shadow-2xs"
        style={{
          backgroundColor: theme.accentColor,
          color: "#FFFFFF",
        }}
      >
        <svg className="w-3.5 h-3.5 @sm:w-4 @sm:h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
        <span className="hidden @sm:inline">Bag</span>
        <span className="px-1.5 py-0.2 rounded-full bg-white/25 text-[10px] @sm:text-[11px] font-extrabold">
          {cartCount}
        </span>
      </button>

      {cartCount > 0 && activePage !== "checkout" && (
        <button
          type="button"
          onClick={() => handleNavClick("checkout")}
          className="hidden @lg:inline-flex items-center gap-1 px-3.5 py-2 rounded-full text-xs font-bold border transition-all hover:opacity-80 cursor-pointer"
          style={{
            borderColor: palette.textPrimary,
            color: palette.textPrimary,
          }}
        >
          <span>Checkout →</span>
        </button>
      )}

      {/* Mobile Hamburger Toggle (< @md container width) */}
      <button
        type="button"
        onClick={() => setMobileMenuOpen((prev) => !prev)}
        aria-label="Toggle Menu"
        className="@md:hidden p-2 rounded-lg border transition-colors cursor-pointer"
        style={{
          borderColor: palette.borderSubtle,
          color: palette.textPrimary,
        }}
      >
        {mobileMenuOpen ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>
    </div>
  );

  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur-md transition-colors w-full"
      style={{
        backgroundColor: palette.isDark
          ? "rgba(17, 18, 21, 0.92)"
          : "rgba(255, 255, 255, 0.94)",
        borderColor: palette.borderSubtle,
      }}
    >
      {/* Top Announcement Bar */}
      {showAnnouncementBar && announcementText && (
        <div
          className="px-3 @sm:px-4 py-1.5 @sm:py-2 text-center text-[10px] @sm:text-[11px] font-semibold tracking-[0.12em] @sm:tracking-[0.14em] uppercase truncate"
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
            className="col-span-6 @md:col-span-3 flex items-center @md:border-r py-3 @sm:py-4 px-3.5 @sm:px-6 min-w-0"
            style={{ borderColor: palette.borderSubtle }}
          >
            <BrandWordmark />
          </div>

          <div className="hidden @md:flex @md:col-span-6 justify-center py-4 px-4">
            <NavItemsList />
          </div>

          <div
            className="col-span-6 @md:col-span-3 flex items-center justify-end gap-2 @md:border-l py-3 @sm:py-4 px-3.5 @sm:px-6"
            style={{ borderColor: palette.borderSubtle }}
          >
            <UtilityIcons />
          </div>

          <div
            className="col-span-12 @md:hidden border-t py-2 px-3.5 flex justify-center overflow-x-auto no-scrollbar"
            style={{ borderColor: palette.borderSubtle }}
          >
            <NavItemsList />
          </div>
        </div>
      )}

      {/* VARIANT 2: stacked-boutique (SA Storefront-01.jpg) */}
      {variant === "stacked-boutique" && (
        <div className="max-w-7xl mx-auto px-3.5 @sm:px-6 @lg:px-8">
          <div
            className="flex items-center justify-between gap-3 py-3 @sm:py-4 border-b"
            style={{ borderColor: palette.borderSubtle }}
          >
            <div className="hidden @md:flex items-center gap-2 w-48 @lg:w-60 shrink-0">
              <svg className="w-4 h-4 opacity-50 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  onSearchChange(e.target.value);
                  if (activePage !== "shop") onSelectPage("shop");
                }}
                placeholder="Search products..."
                className="w-full text-xs bg-transparent border-b pb-1 focus:outline-none"
                style={{
                  color: palette.textPrimary,
                  borderColor: palette.borderSubtle,
                }}
              />
            </div>
            <div className="@md:mx-auto min-w-0">
              <BrandWordmark framed />
            </div>
            <div className="@md:w-48 @lg:w-60 flex justify-end shrink-0">
              <UtilityIcons />
            </div>
          </div>
          <div className="py-2 @sm:py-2.5 flex justify-center overflow-x-auto no-scrollbar">
            <NavItemsList />
          </div>
        </div>
      )}

      {/* VARIANT 3: centered-editorial (Drexel, Glowing, Funio, Bagkin) */}
      {variant === "centered-editorial" && (
        <div className="max-w-7xl mx-auto px-3.5 @sm:px-6 @lg:px-8 py-3 @sm:py-4 grid grid-cols-12 items-center gap-2 @sm:gap-4">
          <div className="col-span-5 hidden @lg:flex items-center">
            <NavItemsList />
          </div>
          <div className="col-span-6 @lg:col-span-2 flex @lg:justify-center min-w-0">
            <BrandWordmark />
          </div>
          <div className="col-span-6 @lg:col-span-5 flex items-center justify-end">
            <UtilityIcons />
          </div>
          <div
            className="col-span-12 @lg:hidden pt-2 border-t flex justify-center overflow-x-auto no-scrollbar"
            style={{ borderColor: palette.borderSubtle }}
          >
            <NavItemsList />
          </div>
        </div>
      )}

      {/* VARIANT 4: minimal-inline (Guza, Minim, Ugmonk, Stuffsus) */}
      {variant === "minimal-inline" && (
        <div className="max-w-7xl mx-auto px-3.5 @sm:px-6 @lg:px-8 py-3 @sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-6 @lg:gap-10 min-w-0">
              <BrandWordmark />
              <div className="hidden @md:block">
                <NavItemsList />
              </div>
            </div>
            <UtilityIcons />
          </div>
          <div
            className="@md:hidden mt-2.5 pt-2 border-t flex justify-center overflow-x-auto no-scrollbar"
            style={{ borderColor: palette.borderSubtle }}
          >
            <NavItemsList />
          </div>
        </div>
      )}

      {/* Mobile Collapsible Drawer (< @md) */}
      {mobileMenuOpen && (
        <div
          className="@md:hidden border-t px-4 py-4 space-y-3"
          style={{
            backgroundColor: palette.cardSurfaceBg,
            borderColor: palette.borderSubtle,
          }}
        >
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                if (activePage !== "shop") onSelectPage("shop");
              }}
              placeholder={`Search ${businessName}...`}
              className="flex-1 px-3.5 py-2 text-xs rounded-xl border focus:outline-none"
              style={{
                backgroundColor: palette.sectionAltBg,
                color: palette.textPrimary,
                borderColor: palette.borderSubtle,
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {navLinks.map((item) => {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-left border transition-colors cursor-pointer"
                  style={{
                    backgroundColor: isActive ? theme.accentColor : palette.sectionAltBg,
                    color: isActive ? "#FFFFFF" : palette.textPrimary,
                    borderColor: isActive ? theme.accentColor : palette.borderSubtle,
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          {cartCount > 0 && (
            <button
              type="button"
              onClick={() => handleNavClick("checkout")}
              className="w-full py-2.5 rounded-xl text-xs font-extrabold text-center text-white cursor-pointer"
              style={{ backgroundColor: theme.accentColor }}
            >
              Proceed to Checkout ({cartCount} {cartCount === 1 ? "item" : "items"}) →
            </button>
          )}
        </div>
      )}

      {/* Expandable Search Bar */}
      {searchOpen && (
        <div
          className="border-t px-3.5 @sm:px-8 py-3"
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
              className="flex-1 px-4 py-2 text-xs @sm:text-sm rounded-full border focus:outline-none"
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
