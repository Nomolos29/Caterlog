"use client";

import React, { useState, useRef } from "react";
import type { ProductItem, VendorProfile } from "@/lib/types";
import { resolveImageUrl } from "@/lib/api";

interface SocialFlyerQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: VendorProfile;
  products: ProductItem[];
  initialProduct?: ProductItem | null;
}

/**
 * Deterministic SVG QR pattern generator for storefront/product URLs.
 */
function renderStylizedQrSvg(seedText: string, accentColor = "#0d5c3a") {
  let hash = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    hash ^= seedText.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const size = 21;
  const cells: Array<{ x: number; y: number }> = [];
  const isFinder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= size - 7) || (r >= size - 7 && c < 7);

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (isFinder(r, c)) continue;
      const bit = ((hash >>> ((r * size + c) % 28)) ^ (r * 31 + c * 17)) & 1;
      if (bit === 1) {
        cells.push({ x: c, y: r });
      }
    }
  }

  return (
    <svg viewBox="0 0 210 210" className="w-full h-full">
      <rect width="210" height="210" rx="16" fill="#FFFFFF" />
      {/* 3 Finder Corners */}
      {[
        { x: 10, y: 10 },
        { x: 140, y: 10 },
        { x: 10, y: 140 },
      ].map((pos, idx) => (
        <g key={idx} transform={`translate(${pos.x}, ${pos.y})`}>
          <rect width="60" height="60" rx="12" fill="none" stroke={accentColor} strokeWidth="8" />
          <rect x="16" y="16" width="28" height="28" rx="6" fill={accentColor} />
        </g>
      ))}
      {cells.map((cell, idx) => (
        <rect
          key={idx}
          x={10 + cell.x * 9}
          y={10 + cell.y * 9}
          width="7.5"
          height="7.5"
          rx="2"
          fill="#0f172a"
        />
      ))}
    </svg>
  );
}

export function SocialFlyerQrModal({
  isOpen,
  onClose,
  vendor,
  products,
  initialProduct = null,
}: SocialFlyerQrModalProps) {
  const [format, setFormat] = useState<"STORY_9_16" | "SQUARE_1_1" | "QR_TABLE_TENT">(
    "STORY_9_16"
  );
  const [selectedSku, setSelectedSku] = useState<string>(
    initialProduct?.skuCode || products[0]?.skuCode || ""
  );
  const [customHeadline, setCustomHeadline] = useState("NEW ARRIVAL · LIMITED STOCK");
  const [themeStyle, setThemeStyle] = useState<"EMERALD" | "DAYLIGHT" | "GOLD">("EMERALD");
  const [copiedCaption, setCopiedCaption] = useState(false);
  const cardPreviewRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const activeProduct =
    products.find((p) => p.skuCode === selectedSku) || initialProduct || products[0];

  const storeUrl =
    typeof window !== "undefined"
      ? `${window.location.hostname}:3001/${vendor.slug}`
      : `caterlog.store/${vendor.slug}`;

  const comparePrice = activeProduct?.customFields?.compareAtPriceNaira
    ? Number(activeProduct.customFields.compareAtPriceNaira)
    : null;

  const shareCaption = activeProduct
    ? `✨ *${activeProduct.name}* is now available at *${vendor.businessName}*!\n💰 Price: *${activeProduct.basePriceFormatted}*${
        comparePrice && comparePrice > activeProduct.basePriceNaira
          ? ` (Was ~₦${comparePrice.toLocaleString()}~)`
          : ""
      }\n📦 Stock: ${activeProduct.availableStock} units available\n\n👉 Order directly on our website or reply with *${activeProduct.skuCode}* on WhatsApp:\nhttps://${storeUrl}`
    : `🛍️ Shop *${vendor.businessName}* online!\nBrowse our verified catalog with instant stock reservation and doorway delivery:\nhttps://${storeUrl}`;

  const handleCopyCaption = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(shareCaption);
      setCopiedCaption(true);
      setTimeout(() => setCopiedCaption(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-backdrop-fade"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-[28px] max-w-4xl w-full my-6 p-6 sm:p-8 shadow-[0_28px_80px_-12px_rgba(15,23,42,0.18)] border border-slate-200/80 space-y-6 max-h-[92vh] overflow-y-auto animate-popup-spring"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 pb-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              Catlog Social Flyer &amp; QR Marketing Studio
            </span>
            <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 mt-1">
              Instagram Story Flyer, WhatsApp Status Card &amp; Store QR Kit
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Generate branded product promo cards and printable QR table tents for your social channels and physical shop.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Controls (5 cols) */}
          <div className="lg:col-span-5 space-y-4 text-xs">
            <div>
              <label className="block font-bold text-gray-700 mb-1.5">
                1. Choose Flyer / Kit Format
              </label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  {
                    id: "STORY_9_16" as const,
                    title: "📱 Instagram Story / WhatsApp Status (9:16)",
                    desc: "Vertical story card with product photo, price badge & store QR",
                  },
                  {
                    id: "SQUARE_1_1" as const,
                    title: "🖼️ Feed Post / WhatsApp Catalog Card (1:1)",
                    desc: "Square product showcase card with strike-through discount support",
                  },
                  {
                    id: "QR_TABLE_TENT" as const,
                    title: "🖨️ Printable Storefront QR Table Tent",
                    desc: "Countertop QR standee for walk-in shoppers to scan & order",
                  },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFormat(opt.id)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      format === opt.id
                        ? "border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className="font-extrabold text-gray-900">{opt.title}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {format !== "QR_TABLE_TENT" && (
              <>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    2. Featured Product
                  </label>
                  <select
                    value={selectedSku}
                    onChange={(e) => setSelectedSku(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white font-semibold"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.skuCode}>
                        {p.skuCode} — {p.name} ({p.basePriceFormatted})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    3. Promo Banner Headline
                  </label>
                  <input
                    type="text"
                    value={customHeadline}
                    onChange={(e) => setCustomHeadline(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 font-semibold"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block font-bold text-gray-700 mb-1">
                Brand Palette Accent
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "EMERALD" as const, label: "Caterlog Emerald" },
                  { id: "DAYLIGHT" as const, label: "Clean Daylight" },
                  { id: "GOLD" as const, label: "Warm Boutique" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setThemeStyle(t.id)}
                    className={`py-2 px-2.5 rounded-xl border font-bold text-[11px] cursor-pointer ${
                      themeStyle === t.id
                        ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                        : "border-gray-200 text-gray-600"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Ready-to-post WhatsApp / Instagram Caption */}
            <div className="bg-[#F8FAFC] p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Ready-to-Paste Social Caption
                </span>
                <button
                  type="button"
                  onClick={handleCopyCaption}
                  className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                >
                  {copiedCaption ? "✓ Copied" : "Copy Caption"}
                </button>
              </div>
              <p className="text-[11px] text-gray-600 whitespace-pre-line font-mono bg-white p-2.5 rounded-xl border border-gray-200/80 max-h-28 overflow-y-auto">
                {shareCaption}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => window.print()}
                className="py-2.5 px-4 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-800 font-bold cursor-pointer"
              >
                🖨️ Print / Save PDF
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(shareCaption)}`}
                target="_blank"
                rel="noreferrer"
                className="py-2.5 px-4 rounded-xl bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-bold text-center shadow-xs"
              >
                💬 Share to WhatsApp ↗
              </a>
            </div>
          </div>

          {/* Right Live Visual Card Canvas (7 cols) */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center bg-[#F8FAFC] rounded-3xl p-6 border border-slate-200/80">
            <div
              ref={cardPreviewRef}
              className={`w-full transition-all duration-300 overflow-hidden shadow-[0_24px_60px_-15px_rgba(13,92,58,0.22)] border ${
                format === "STORY_9_16"
                  ? "max-w-[330px] rounded-[32px]"
                  : "max-w-[390px] rounded-[28px]"
              } ${
                themeStyle === "EMERALD"
                  ? "bg-gradient-to-br from-[#0d5c3a] via-[#0b4b2f] to-[#063520] text-white border-emerald-800"
                  : themeStyle === "GOLD"
                    ? "bg-gradient-to-br from-[#FFFBEB] via-[#FEF3C7] to-[#FDE68A]/50 text-gray-900 border-amber-200"
                    : "bg-white text-gray-900 border-slate-200"
              }`}
            >
              {format === "QR_TABLE_TENT" ? (
                <div className="p-7 text-center space-y-5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-400/30">
                    <span>✓ Verified Caterlog Storefront</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black tracking-tight">
                      {vendor.businessName}
                    </h3>
                    <p className="text-xs opacity-80 mt-1">
                      Scan with your phone camera to browse our live catalog &amp; checkout instantly
                    </p>
                  </div>
                  <div className="w-48 h-48 mx-auto p-3 rounded-3xl bg-white shadow-lg border border-slate-200">
                    {renderStylizedQrSvg(storeUrl, "#0d5c3a")}
                  </div>
                  <div className="space-y-1">
                    <div className="text-[11px] font-mono font-bold opacity-90">
                      {storeUrl}
                    </div>
                    <div className="text-[11px] opacity-75">
                      WhatsApp Order Line: {vendor.whatsappPhone}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-5 space-y-4">
                  {/* Top Brand Strip */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-emerald-500 text-white font-black text-xs flex items-center justify-center">
                        {vendor.businessName.charAt(0)}
                      </div>
                      <div>
                        <div className="text-xs font-extrabold leading-tight">
                          {vendor.businessName}
                        </div>
                        <div className="text-[10px] opacity-75">
                          ✓ Verified Store
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-[#00c068] text-slate-950">
                      {customHeadline}
                    </span>
                  </div>

                  {/* Product Photo */}
                  <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-slate-100 border border-white/15 shadow-md">
                    {activeProduct?.primaryImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveImageUrl(activeProduct.primaryImageUrl)}
                        alt={activeProduct.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">
                        🛍️
                      </div>
                    )}
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 bg-white/95 backdrop-blur-md text-gray-900 p-3 rounded-xl shadow-lg flex items-center justify-between">
                      <div className="min-w-0 pr-2">
                        <div className="text-[10px] font-mono font-bold text-emerald-700">
                          Reply &ldquo;{activeProduct?.skuCode || "CATALOG"}&rdquo;
                        </div>
                        <div className="text-xs font-extrabold truncate">
                          {activeProduct?.name || vendor.businessName}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {comparePrice &&
                          activeProduct &&
                          comparePrice > activeProduct.basePriceNaira && (
                            <div className="text-[10px] line-through text-gray-400">
                              ₦{comparePrice.toLocaleString()}
                            </div>
                          )}
                        <div className="text-sm font-black text-[#0d5c3a]">
                          {activeProduct?.basePriceFormatted || "Shop Now"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Call to Action + Mini QR */}
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="space-y-0.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider opacity-75">
                        Instant Checkout Link
                      </div>
                      <div className="text-xs font-mono font-bold truncate max-w-[190px]">
                        {storeUrl}
                      </div>
                      <div className="text-[10px] opacity-80">
                        WhatsApp: {vendor.whatsappPhone}
                      </div>
                    </div>
                    <div className="w-14 h-14 p-1 rounded-xl bg-white shrink-0 shadow-sm">
                      {renderStylizedQrSvg(
                        `${storeUrl}/${activeProduct?.skuCode || ""}`,
                        "#0d5c3a"
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
