"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/api";
import type { DiscountItem, ProductItem, VendorState } from "@/lib/types";

interface PromotionsStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductItem[];
  discounts: DiscountItem[];
  onStateChange?: (state: VendorState) => void;
}

export function PromotionsStudioModal({
  isOpen,
  onClose,
  products,
  discounts,
  onStateChange,
}: PromotionsStudioModalProps) {
  const [activeTab, setActiveTab] = useState<"flash-sales" | "coupons">("flash-sales");

  // Flash Sale State
  const [discountPercent, setDiscountPercent] = useState("20");
  const [flashScope, setFlashScope] = useState<"ALL" | "CATEGORY" | "PRODUCTS">("ALL");
  const [targetCategory, setTargetCategory] = useState("");
  const [selectedSkus, setSelectedSkus] = useState<string[]>([]);
  const [flashLabel, setFlashLabel] = useState("WEEKEND FLASH SALE");
  const [applyingFlash, setApplyingFlash] = useState(false);

  // Coupon State
  const [couponCode, setCouponCode] = useState("");
  const [couponType, setCouponType] = useState<"PERCENTAGE" | "FLAT_KOBO">("PERCENTAGE");
  const [couponValue, setCouponValue] = useState("10");
  const [minOrderNaira, setMinOrderNaira] = useState("0");
  const [maxUses, setMaxUses] = useState("100");
  const [expiresAt, setExpiresAt] = useState("");
  const [savingCoupon, setSavingCoupon] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const categories = Array.from(
    new Set(products.map((p) => p.category || "General"))
  ).sort();

  const activeFlashProducts = products.filter(
    (p) =>
      p.customFields?.compareAtPriceNaira &&
      Number(p.customFields.compareAtPriceNaira) > p.basePriceNaira
  );

  const handleApplyFlashSale = async (action: "APPLY" | "CLEAR") => {
    setError(null);
    setApplyingFlash(true);
    try {
      const res = await api.applyFlashSale({
        action,
        discountPercent: Number(discountPercent) || 15,
        scope: flashScope,
        targetCategory:
          flashScope === "CATEGORY" ? targetCategory || categories[0] : undefined,
        targetSkus: flashScope === "PRODUCTS" ? selectedSkus : undefined,
        label: flashLabel.trim() || `${discountPercent}% OFF FLASH SALE`,
      });
      onStateChange?.(res.state);
      setToastMessage(
        action === "APPLY"
          ? `✨ Strike-through flash sale applied to ${res.affectedCount} product(s) and synced to PostgreSQL!`
          : `✓ Original retail prices restored on ${res.affectedCount} product(s).`
      );
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update flash sale.");
    } finally {
      setApplyingFlash(false);
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!couponCode.trim()) {
      setError("Please enter a promo coupon code (e.g. PAYDAY15).");
      return;
    }
    setSavingCoupon(true);
    try {
      const nextState = await api.addDiscount({
        code: couponCode.trim().toUpperCase(),
        type: couponType,
        value: Number(couponValue) || 10,
        minOrderNaira: Number(minOrderNaira) || 0,
        maxUses: Number(maxUses) > 0 ? Number(maxUses) : null,
        expiresAt: expiresAt || undefined,
      });
      onStateChange?.(nextState);
      setCouponCode("");
      setToastMessage("🎉 Promo voucher created and synced to PostgreSQL!");
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save promo code.");
    } finally {
      setSavingCoupon(false);
    }
  };

  const handleDeleteCoupon = async (code: string) => {
    try {
      const nextState = await api.deleteDiscount(code);
      onStateChange?.(nextState);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not deactivate coupon.");
    }
  };

  const toggleSku = (sku: string) => {
    setSelectedSkus((prev) =>
      prev.includes(sku) ? prev.filter((s) => s !== sku) : [...prev, sku]
    );
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-slate-900/25 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 overflow-hidden animate-backdrop-fade"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-none sm:rounded-[28px] max-w-3xl w-full h-[100dvh] sm:h-auto sm:max-h-[90dvh] p-4 sm:p-8 shadow-[0_28px_80px_-12px_rgba(15,23,42,0.18)] border-0 sm:border border-slate-200/80 space-y-6 overflow-y-auto animate-popup-spring"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                Catlog Promotions &amp; Flash Sales Studio
              </span>
              {activeFlashProducts.length > 0 && (
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900">
                  ⚡ {activeFlashProducts.length} Items on Flash Sale
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 mt-1">
              Discounts, Voucher Codes &amp; Strike-Through Sales
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Launch storewide strike-through flash deals or create checkout coupon codes for WhatsApp &amp; Web shoppers.
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

        {/* Mode Tabs */}
        <div className="grid grid-cols-2 gap-2 bg-[#F8FAFC] p-1.5 rounded-2xl border border-slate-200/80">
          <button
            type="button"
            onClick={() => setActiveTab("flash-sales")}
            className={`py-2.5 px-4 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === "flash-sales"
                ? "bg-white text-emerald-900 shadow-xs border border-emerald-200"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            ⚡ Strike-Through Flash Sales ({activeFlashProducts.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("coupons")}
            className={`py-2.5 px-4 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === "coupons"
                ? "bg-white text-emerald-900 shadow-xs border border-emerald-200"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            🎟️ Checkout Promo Coupons ({discounts.length})
          </button>
        </div>

        {toastMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
            {toastMessage}
          </div>
        )}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
            {error}
          </div>
        )}

        {activeTab === "flash-sales" ? (
          <div className="space-y-5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Discount Percentage (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 font-extrabold text-gray-900 focus:outline-none focus:border-emerald-600"
                  />
                  <span className="absolute right-3.5 top-2.5 font-bold text-emerald-700">
                    % OFF
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Apply To Scope
                </label>
                <select
                  value={flashScope}
                  onChange={(e) =>
                    setFlashScope(e.target.value as "ALL" | "CATEGORY" | "PRODUCTS")
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white font-semibold"
                >
                  <option value="ALL">Entire Product Catalog ({products.length} items)</option>
                  <option value="CATEGORY">Specific Category</option>
                  <option value="PRODUCTS">Selected Products ({selectedSkus.length})</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Sale Badge Label
                </label>
                <input
                  type="text"
                  value={flashLabel}
                  onChange={(e) => setFlashLabel(e.target.value)}
                  placeholder="e.g. PAYDAY FLASH SALE"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 font-semibold"
                />
              </div>
            </div>

            {flashScope === "CATEGORY" && (
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Select Target Category
                </label>
                <select
                  value={targetCategory || categories[0] || ""}
                  onChange={(e) => setTargetCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white font-semibold"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {flashScope === "PRODUCTS" && (
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-2xl p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#F8FAFC]">
                {products.map((p) => {
                  const checked = selectedSkus.includes(p.skuCode);
                  return (
                    <label
                      key={p.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        checked
                          ? "bg-emerald-50 border-emerald-400"
                          : "bg-white border-gray-200"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSku(p.skuCode)}
                          className="rounded text-emerald-600"
                        />
                        <div className="truncate">
                          <div className="font-bold text-gray-900 truncate">{p.name}</div>
                          <div className="text-[10px] text-gray-500">
                            {p.skuCode} · {p.basePriceFormatted}
                          </div>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {/* Preview Card */}
            <div className="bg-[#F8FAFC] rounded-2xl p-4 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  Live Storefront Strike-Through Preview
                </div>
                <div className="text-xs text-gray-600">
                  Example item at <strong>₦20,000</strong> will display as{" "}
                  <span className="line-through text-gray-400 mr-1.5">₦20,000</span>
                  <span className="font-black text-emerald-700 text-sm">
                    ₦
                    {Math.round(
                      20000 * (1 - (Number(discountPercent) || 15) / 100)
                    ).toLocaleString()}
                  </span>{" "}
                  with a <strong>{flashLabel || "FLASH SALE"}</strong> badge.
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {activeFlashProducts.length > 0 && (
                  <button
                    type="button"
                    disabled={applyingFlash}
                    onClick={() => void handleApplyFlashSale("CLEAR")}
                    className="px-3.5 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold cursor-pointer"
                  >
                    End Flash Sale
                  </button>
                )}
                <button
                  type="button"
                  disabled={applyingFlash}
                  onClick={() => void handleApplyFlashSale("APPLY")}
                  className="px-5 py-2.5 rounded-xl bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-bold shadow-xs cursor-pointer active:scale-95 transition-all"
                >
                  {applyingFlash ? "Applying..." : `⚡ Launch ${discountPercent}% Flash Sale`}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5 text-xs">
            <form
              onSubmit={handleCreateCoupon}
              className="bg-[#F8FAFC] p-4 rounded-2xl border border-slate-200/80 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Coupon Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. WELCOME15"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-white font-mono font-bold uppercase"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Discount Type
                  </label>
                  <select
                    value={couponType}
                    onChange={(e) =>
                      setCouponType(e.target.value as "PERCENTAGE" | "FLAT_KOBO")
                    }
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white font-semibold"
                  >
                    <option value="PERCENTAGE">Percentage (% Off)</option>
                    <option value="FLAT_KOBO">Fixed Amount (₦ Off)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    {couponType === "PERCENTAGE" ? "Percentage (%)" : "Flat Discount (₦)"}
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={couponValue}
                    onChange={(e) => setCouponValue(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-white font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Minimum Order Spend (₦)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={minOrderNaira}
                    onChange={(e) => setMinOrderNaira(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Usage Limit (Redemptions)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 bg-white"
                  />
                </div>
                <div>
                  <button
                    type="submit"
                    disabled={savingCoupon}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-bold shadow-xs cursor-pointer"
                  >
                    {savingCoupon ? "Saving..." : "+ Create Promo Code"}
                  </button>
                </div>
              </div>
            </form>

            {/* Active Coupons Table */}
            <div className="border border-gray-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-[10px] font-bold uppercase text-gray-400 border-b border-gray-200">
                  <tr>
                    <th className="py-2.5 px-4">Code</th>
                    <th className="py-2.5 px-4">Discount</th>
                    <th className="py-2.5 px-4">Min Spend</th>
                    <th className="py-2.5 px-4">Redemptions</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {discounts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-gray-400">
                        No active coupon codes yet. Create one above!
                      </td>
                    </tr>
                  ) : (
                    discounts.map((d) => (
                      <tr key={d.id} className="hover:bg-gray-50/60">
                        <td className="py-3 px-4 font-mono font-black text-emerald-800">
                          {d.code}
                        </td>
                        <td className="py-3 px-4 font-bold text-gray-900">{d.label}</td>
                        <td className="py-3 px-4 text-gray-600">
                          ₦{Math.round(Number(d.minOrderKobo || 0) / 100).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {d.usedCount} / {d.maxUses ?? "∞"} used
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => void handleDeleteCoupon(d.code)}
                            className="text-rose-600 hover:underline font-semibold cursor-pointer"
                          >
                            Deactivate
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
