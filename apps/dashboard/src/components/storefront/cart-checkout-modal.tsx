"use client";

import React, { useMemo, useState } from "react";
import type { Discount, Product, ProductVariant, PublicOrderReceipt, ShippingZone } from "@/lib/types";
import { api, resolveImageUrl } from "@/lib/api";
import {
  resolveHeadingFontStyle,
  resolveRadiusClass,
  resolveSurfacePalette,
  type StorefrontThemeTokens,
} from "@/lib/storefront-presets";
import {
  computeSyntheticRating,
  extractProductSwatches,
  StorefrontButton,
  StorefrontColorSwatches,
  StorefrontStarRating,
} from "./primitives";

export interface StorefrontCartItem {
  product: Product;
  variant?: ProductVariant;
  selectedColor?: string;
  quantity: number;
}

// ---------------------------------------------------------------------------
// 1. PRODUCT QUICK-VIEW & DETAIL MODAL
// ---------------------------------------------------------------------------

export function StorefrontProductQuickViewModal({
  product,
  theme,
  businessName,
  whatsappPhone,
  onClose,
  onAddToCart,
  onBuyNow,
}: {
  product: Product | null;
  theme: StorefrontThemeTokens;
  businessName: string;
  whatsappPhone: string;
  onClose: () => void;
  onAddToCart: (item: StorefrontCartItem) => void;
  onBuyNow: (item: StorefrontCartItem) => void;
}) {
  if (!product) return null;

  const palette = resolveSurfacePalette(theme.surfaceMode);
  const headingFont = resolveHeadingFontStyle(theme.fontPairing);
  const cardRadius = resolveRadiusClass(theme.borderRadius, "card");

  const swatches = extractProductSwatches(product);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(
    product.variants?.[0]
  );
  const [selectedColor, setSelectedColor] = useState<string>(swatches[0]?.label ?? "");
  const [quantity, setQuantity] = useState(1);

  const unitPriceNaira = selectedVariant ? selectedVariant.priceNaira : product.basePriceNaira;
  const availableStock = selectedVariant
    ? (selectedVariant.availableStock ?? selectedVariant.stock)
    : product.availableStock;
  const isOutOfStock = availableStock <= 0;
  const ratingInfo = computeSyntheticRating(product);

  const imageUrl =
    resolveImageUrl(product.primaryImageUrl) ||
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80";

  const waOrderText = encodeURIComponent(
    `Hello ${businessName}! I'd like to order:\n• ${product.name} (${product.skuCode})${
      selectedVariant ? ` - ${selectedVariant.name}` : ""
    }${selectedColor ? ` [${selectedColor}]` : ""} x${quantity} (₦${(
      unitPriceNaira * quantity
    ).toLocaleString()})`
  );
  const waUrl = `https://wa.me/${whatsappPhone.replace(/\D/g, "")}?text=${waOrderText}`;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-3xl overflow-hidden ${cardRadius} shadow-2xl border grid grid-cols-1 md:grid-cols-12`}
        style={{
          backgroundColor: palette.cardSurfaceBg,
          borderColor: palette.borderSubtle,
          color: palette.textPrimary,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 z-20 w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center text-sm font-bold cursor-pointer"
          style={{ color: palette.textPrimary }}
        >
          ✕
        </button>

        {/* Left Image Column */}
        <div
          className="md:col-span-6 aspect-square md:aspect-auto flex items-center justify-center p-6"
          style={{ backgroundColor: palette.sectionAltBg }}
        >
          <img
            src={imageUrl}
            alt={product.name}
            className="w-full h-full max-h-96 object-cover rounded-xl shadow-sm"
          />
        </div>

        {/* Right Detail Column */}
        <div className="md:col-span-6 p-6 sm:p-8 flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span
                className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full"
                style={{
                  backgroundColor: palette.sectionAltBg,
                  color: palette.textSecondary,
                }}
              >
                {product.category || "Collection"} · {product.skuCode}
              </span>
              <span
                className={`text-[11px] font-bold ${
                  isOutOfStock ? "text-red-600" : "text-emerald-600"
                }`}
              >
                {isOutOfStock ? "Out of Stock" : `${availableStock} in stock`}
              </span>
            </div>

            <h2
              className="text-xl sm:text-2xl font-bold leading-snug mb-1.5"
              style={headingFont}
            >
              {product.name}
            </h2>

            <div className="mb-3">
              <StorefrontStarRating
                rating={ratingInfo.rating}
                reviewsCount={ratingInfo.reviewsCount}
                mutedColor={palette.textMuted}
              />
            </div>

            <p className="text-2xl font-black mb-3" style={{ color: theme.accentColor }}>
              ₦{unitPriceNaira.toLocaleString()}
            </p>

            <p
              className="text-xs leading-relaxed mb-4"
              style={{ color: palette.textSecondary }}
            >
              {product.description ||
                `Authentic ${product.name} from ${businessName}. Includes instant stock reservation and doorway courier delivery.`}
            </p>

            {/* Variant Selector (Sizes / Options) */}
            {product.variants && product.variants.length > 0 && (
              <div className="mb-4">
                <label
                  className="block text-[11px] font-bold uppercase tracking-wider mb-2"
                  style={{ color: palette.textMuted }}
                >
                  Select Option / Size
                </label>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v) => {
                    const isSelected = selectedVariant?.id === v.id;
                    const vAvail = (v.availableStock ?? v.stock) > 0;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={!vAvail}
                        onClick={() => setSelectedVariant(v)}
                        className="px-3 py-1.5 text-xs font-semibold border transition-all cursor-pointer disabled:opacity-40"
                        style={{
                          borderColor: isSelected ? theme.accentColor : palette.borderSubtle,
                          backgroundColor: isSelected ? theme.accentColor : "transparent",
                          color: isSelected ? "#FFFFFF" : palette.textPrimary,
                        }}
                      >
                        {v.name} (₦{v.priceNaira.toLocaleString()})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Color Swatches */}
            <div className="mb-4">
              <label
                className="block text-[11px] font-bold uppercase tracking-wider mb-2"
                style={{ color: palette.textMuted }}
              >
                Color: <span style={{ color: palette.textPrimary }}>{selectedColor}</span>
              </label>
              <StorefrontColorSwatches
                swatches={swatches}
                selectedColor={selectedColor}
                onSelectColor={setSelectedColor}
                size="md"
              />
            </div>

            {/* Quantity Stepper */}
            <div className="flex items-center gap-3">
              <span
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: palette.textMuted }}
              >
                Qty
              </span>
              <div
                className="inline-flex items-center border rounded-lg overflow-hidden"
                style={{ borderColor: palette.borderSubtle }}
              >
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="px-3 py-1 text-sm font-bold hover:opacity-75 cursor-pointer"
                >
                  −
                </button>
                <span className="px-3 py-1 text-xs font-bold">{quantity}</span>
                <button
                  type="button"
                  onClick={() =>
                    setQuantity((q) => Math.min(Math.max(1, availableStock), q + 1))
                  }
                  className="px-3 py-1 text-sm font-bold hover:opacity-75 cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-2">
            <div className="grid grid-cols-2 gap-2.5">
              <StorefrontButton
                theme={theme}
                variant="outline"
                size="md"
                disabled={isOutOfStock}
                onClick={() => {
                  onAddToCart({
                    product,
                    variant: selectedVariant,
                    selectedColor,
                    quantity,
                  });
                  onClose();
                }}
              >
                Add to Bag
              </StorefrontButton>

              <StorefrontButton
                theme={theme}
                variant="solid"
                size="md"
                disabled={isOutOfStock}
                onClick={() => {
                  onBuyNow({
                    product,
                    variant: selectedVariant,
                    selectedColor,
                    quantity,
                  });
                  onClose();
                }}
              >
                {isOutOfStock ? "Sold Out" : "Buy Now"}
              </StorefrontButton>
            </div>

            <a
              href={waUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full py-2.5 px-4 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2 transition-colors"
            >
              <span>💬 Order via WhatsApp Co-Pilot</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. SHOPPING BAG & INSTANT MONNIFY / WHATSAPP CHECKOUT DRAWER
// ---------------------------------------------------------------------------

export function StorefrontCartAndCheckoutDrawer({
  isOpen,
  onClose,
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  shippingZones,
  discounts,
  theme,
  vendorSlug,
  businessName,
  whatsappPhone,
}: {
  isOpen: boolean;
  onClose: () => void;
  cart: StorefrontCartItem[];
  onUpdateQuantity: (index: number, delta: number) => void;
  onRemoveItem: (index: number) => void;
  onClearCart: () => void;
  shippingZones: ShippingZone[];
  discounts: Discount[];
  theme: StorefrontThemeTokens;
  vendorSlug: string;
  businessName: string;
  whatsappPhone: string;
}) {
  const palette = resolveSurfacePalette(theme.surfaceMode);
  const headingFont = resolveHeadingFontStyle(theme.fontPairing);

  const [selectedZoneId, setSelectedZoneId] = useState<string>(
    shippingZones[0]?.id ?? ""
  );
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<Discount | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryLandmark, setDeliveryLandmark] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [createdReceipt, setCreatedReceipt] = useState<PublicOrderReceipt | null>(null);
  const [simulatingTransfer, setSimulatingTransfer] = useState(false);

  const activeZone =
    shippingZones.find((z) => z.id === selectedZoneId) ?? shippingZones[0];

  const subtotalNaira = useMemo(() => {
    return cart.reduce((sum, item) => {
      const unit = item.variant ? item.variant.priceNaira : item.product.basePriceNaira;
      return sum + unit * item.quantity;
    }, 0);
  }, [cart]);

  const discountNaira = useMemo(() => {
    if (!appliedDiscount) return 0;
    if (appliedDiscount.type === "PERCENTAGE") {
      const pct = Number(appliedDiscount.value) / 10000;
      return Math.round(subtotalNaira * pct);
    }
    return Math.min(subtotalNaira, Math.round(Number(appliedDiscount.value) / 100));
  }, [appliedDiscount, subtotalNaira]);

  const shippingFeeNaira = activeZone ? activeZone.feeNaira : 0;
  const totalNaira = Math.max(0, subtotalNaira - discountNaira) + shippingFeeNaira;

  if (!isOpen) return null;

  const handleApplyPromo = () => {
    setPromoError(null);
    const clean = promoCodeInput.trim().toUpperCase();
    if (!clean) return;
    const found = discounts.find(
      (d) => d.isActive && d.code.toUpperCase() === clean
    );
    if (!found) {
      setPromoError(`Promo code "${clean}" is not valid or has expired.`);
      return;
    }
    setAppliedDiscount(found);
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError(null);
    if (!buyerName.trim() || !buyerPhone.trim()) {
      setCheckoutError("Please enter your name and WhatsApp phone number.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.createPublicStorefrontOrder(
        {
          buyerName: buyerName.trim(),
          buyerPhone: buyerPhone.trim(),
          shippingZoneId: activeZone?.id,
          shippingZoneName: activeZone?.name,
          discountCode: appliedDiscount?.code,
          deliveryAddress: deliveryAddress.trim() || undefined,
          deliveryLandmark: deliveryLandmark.trim() || undefined,
          items: cart.map((it) => ({
            productId: it.product.id,
            productSku: it.product.skuCode,
            variantId: it.variant?.id,
            variantSku: it.variant?.sku,
            quantity: it.quantity,
          })),
        },
        vendorSlug
      );
      setCreatedReceipt(res.receipt);
      onClearCart();
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Checkout failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSimulateInstantPayment = async () => {
    if (!createdReceipt) return;
    setSimulatingTransfer(true);
    try {
      await fetch("/api/v1/simulate/monnify-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderShortCode: createdReceipt.shortCode,
          amountNaira: createdReceipt.totalAmountNaira,
          payerName: createdReceipt.customerName,
        }),
      });
      const updated = await api.getPublicOrderReceipt(createdReceipt.shortCode);
      setCreatedReceipt(updated.receipt);
    } catch {
      // Ignore if live Monnify mode is active
    } finally {
      setSimulatingTransfer(false);
    }
  };

  const waCartLines = cart
    .map(
      (it) =>
        `• ${it.product.name}${it.variant ? ` (${it.variant.name})` : ""} x${it.quantity} — ₦${(
          (it.variant ? it.variant.priceNaira : it.product.basePriceNaira) * it.quantity
        ).toLocaleString()}`
    )
    .join("\n");
  const waCheckoutUrl = `https://wa.me/${whatsappPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
    `Hello ${businessName}! I want to checkout my order:\n${waCartLines}\nDelivery Zone: ${
      activeZone?.name ?? "Standard"
    }\nTotal: ₦${totalNaira.toLocaleString()}`
  )}`;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md h-full overflow-y-auto shadow-2xl flex flex-col justify-between p-6"
        style={{
          backgroundColor: palette.cardSurfaceBg,
          color: palette.textPrimary,
        }}
      >
        {/* Top Drawer Header */}
        <div>
          <div
            className="flex items-center justify-between pb-4 mb-5 border-b"
            style={{ borderColor: palette.borderSubtle }}
          >
            <div>
              <h2 className="text-lg font-extrabold" style={headingFont}>
                {createdReceipt ? `Order #${createdReceipt.shortCode}` : "Your Shopping Bag"}
              </h2>
              <p className="text-xs" style={{ color: palette.textMuted }}>
                {businessName} · Verified Escrow Checkout
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCreatedReceipt(null);
                onClose();
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:opacity-75 cursor-pointer"
              style={{ backgroundColor: palette.sectionAltBg }}
            >
              ✕
            </button>
          </div>

          {/* VIEW A: Order Created -> Dynamic Monnify Virtual Account Invoice */}
          {createdReceipt ? (
            <div className="space-y-5">
              <div
                className="p-4 rounded-2xl border text-center"
                style={{
                  backgroundColor: createdReceipt.isPaid ? "#ECFDF5" : palette.sectionAltBg,
                  borderColor: createdReceipt.isPaid ? "#10B981" : palette.borderSubtle,
                }}
              >
                <span
                  className={`inline-block px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider mb-2 ${
                    createdReceipt.isPaid
                      ? "bg-emerald-600 text-white"
                      : "bg-amber-500/20 text-amber-700"
                  }`}
                >
                  {createdReceipt.isPaid
                    ? "✓ Payment Verified — Stock Confirmed"
                    : "⏳ Stock Reserved — Awaiting Transfer"}
                </span>

                <p className="text-2xl font-black" style={{ color: palette.textPrimary }}>
                  {createdReceipt.totalAmountFormatted}
                </p>

                {!createdReceipt.isPaid && (
                  <div className="mt-4 pt-4 border-t border-dashed space-y-1.5 text-xs" style={{ borderColor: palette.borderSubtle }}>
                    <p style={{ color: palette.textMuted }}>Transfer exact amount to Dynamic Virtual Account:</p>
                    <p className="text-xs font-bold" style={{ color: palette.textSecondary }}>
                      {createdReceipt.bankName}
                    </p>
                    <p className="text-2xl font-mono font-black tracking-wider select-all" style={{ color: theme.accentColor }}>
                      {createdReceipt.accountNumber}
                    </p>
                    <p className="text-[11px] font-semibold" style={{ color: palette.textMuted }}>
                      {createdReceipt.accountName}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2.5">
                {!createdReceipt.isPaid && (
                  <button
                    type="button"
                    disabled={simulatingTransfer}
                    onClick={handleSimulateInstantPayment}
                    className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {simulatingTransfer
                      ? "Verifying Transfer with Monnify..."
                      : "⚡ Simulate Instant Bank Transfer (Test Demo)"}
                  </button>
                )}

                <a
                  href={`/track/${encodeURIComponent(createdReceipt.shortCode)}`}
                  className="w-full py-3 px-4 rounded-xl text-xs font-bold text-center block border transition-opacity hover:opacity-85"
                  style={{
                    backgroundColor: theme.accentColor,
                    color: "#FFFFFF",
                    borderColor: theme.accentColor,
                  }}
                >
                  Open Live Order Tracker & Receipt (#{createdReceipt.shortCode}) →
                </a>
              </div>
            </div>
          ) : cart.length === 0 ? (
            /* VIEW B: Empty Bag */
            <div className="py-16 text-center space-y-3">
              <p className="text-base font-bold">Your shopping bag is empty</p>
              <p className="text-xs" style={{ color: palette.textMuted }}>
                Explore the catalog and add your favorite items to reserve stock.
              </p>
              <StorefrontButton theme={theme} variant="solid" size="sm" onClick={onClose}>
                Continue Shopping
              </StorefrontButton>
            </div>
          ) : (
            /* VIEW C: Active Cart Items + Shipping Zone + Promo Code + Buyer Checkout Form */
            <div className="space-y-5">
              {/* Cart Items List */}
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {cart.map((item, idx) => {
                  const unit = item.variant ? item.variant.priceNaira : item.product.basePriceNaira;
                  return (
                    <div
                      key={`${item.product.id}-${item.variant?.id ?? "base"}-${idx}`}
                      className="flex items-center gap-3 p-2.5 rounded-xl border"
                      style={{
                        backgroundColor: palette.sectionAltBg,
                        borderColor: palette.borderSubtle,
                      }}
                    >
                      <img
                        src={
                          resolveImageUrl(item.product.primaryImageUrl) ||
                          "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&q=80"
                        }
                        alt={item.product.name}
                        className="w-14 h-14 rounded-lg object-cover shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold truncate">{item.product.name}</h4>
                        <p className="text-[11px]" style={{ color: palette.textMuted }}>
                          {item.variant ? item.variant.name : item.product.skuCode}
                          {item.selectedColor ? ` · ${item.selectedColor}` : ""}
                        </p>
                        <p className="text-xs font-extrabold mt-0.5">
                          ₦{(unit * item.quantity).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(idx, -1)}
                          className="w-6 h-6 rounded-md border text-xs font-bold flex items-center justify-center cursor-pointer"
                          style={{ borderColor: palette.borderSubtle }}
                        >
                          −
                        </button>
                        <span className="text-xs font-bold w-5 text-center">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(idx, 1)}
                          className="w-6 h-6 rounded-md border text-xs font-bold flex items-center justify-center cursor-pointer"
                          style={{ borderColor: palette.borderSubtle }}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(idx)}
                          title="Remove"
                          className="ml-1 text-xs opacity-60 hover:opacity-100 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Shipping Zone Selector */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: palette.textMuted }}>
                  Delivery Zone
                </label>
                <select
                  value={activeZone?.id ?? ""}
                  onChange={(e) => setSelectedZoneId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-lg border bg-transparent"
                  style={{
                    borderColor: palette.borderSubtle,
                    color: palette.textPrimary,
                  }}
                >
                  {shippingZones.map((z) => (
                    <option key={z.id} value={z.id} className="text-gray-900">
                      {z.name} — {z.feeFormatted}
                    </option>
                  ))}
                </select>
              </div>

              {/* Promo Code Box */}
              <div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoCodeInput}
                    onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                    placeholder="Discount code (e.g. PAYDAY10)"
                    className="flex-1 px-3 py-2 text-xs rounded-lg border bg-transparent"
                    style={{
                      borderColor: palette.borderSubtle,
                      color: palette.textPrimary,
                    }}
                  />
                  <StorefrontButton
                    theme={theme}
                    variant="outline"
                    size="xs"
                    onClick={handleApplyPromo}
                  >
                    Apply
                  </StorefrontButton>
                </div>
                {promoError && <p className="text-[11px] text-red-500 mt-1">{promoError}</p>}
                {appliedDiscount && (
                  <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                    ✓ Code {appliedDiscount.code} applied ({appliedDiscount.label})
                  </p>
                )}
              </div>

              {/* Financial Breakdown */}
              <div
                className="p-3.5 rounded-xl border space-y-1.5 text-xs"
                style={{
                  backgroundColor: palette.sectionAltBg,
                  borderColor: palette.borderSubtle,
                }}
              >
                <div className="flex justify-between">
                  <span style={{ color: palette.textMuted }}>Subtotal</span>
                  <span className="font-semibold">₦{subtotalNaira.toLocaleString()}</span>
                </div>
                {discountNaira > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount ({appliedDiscount?.code})</span>
                    <span className="font-semibold">−₦{discountNaira.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span style={{ color: palette.textMuted }}>
                    Delivery ({activeZone?.name ?? "Standard"})
                  </span>
                  <span className="font-semibold">₦{shippingFeeNaira.toLocaleString()}</span>
                </div>
                <div
                  className="flex justify-between pt-2 border-t text-sm font-black"
                  style={{ borderColor: palette.borderSubtle }}
                >
                  <span>Total</span>
                  <span style={{ color: theme.accentColor }}>
                    ₦{totalNaira.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Buyer Details Form */}
              <form onSubmit={handleCheckout} className="space-y-3">
                <input
                  type="text"
                  required
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Your Full Name *"
                  className="w-full px-3.5 py-2.5 text-xs rounded-lg border bg-transparent"
                  style={{ borderColor: palette.borderSubtle, color: palette.textPrimary }}
                />
                <input
                  type="tel"
                  required
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  placeholder="WhatsApp Phone (e.g. +234803...) *"
                  className="w-full px-3.5 py-2.5 text-xs rounded-lg border bg-transparent"
                  style={{ borderColor: palette.borderSubtle, color: palette.textPrimary }}
                />
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Delivery Street Address (optional)"
                  className="w-full px-3.5 py-2 text-xs rounded-lg border bg-transparent"
                  style={{ borderColor: palette.borderSubtle, color: palette.textPrimary }}
                />
                <input
                  type="text"
                  value={deliveryLandmark}
                  onChange={(e) => setDeliveryLandmark(e.target.value)}
                  placeholder="Nearest Bus Stop / Landmark (optional)"
                  className="w-full px-3.5 py-2 text-xs rounded-lg border bg-transparent"
                  style={{ borderColor: palette.borderSubtle, color: palette.textPrimary }}
                />

                {checkoutError && (
                  <p className="text-xs font-semibold text-red-500">{checkoutError}</p>
                )}

                <StorefrontButton
                  type="submit"
                  theme={theme}
                  variant="solid"
                  size="lg"
                  fullWidth
                  disabled={submitting}
                >
                  {submitting
                    ? "Reserving Stock & Generating Virtual Account..."
                    : `Pay ₦${totalNaira.toLocaleString()} (Instant Virtual Account)`}
                </StorefrontButton>

                <a
                  href={waCheckoutUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 px-4 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2 transition-colors"
                >
                  <span>💬 Complete Order on WhatsApp</span>
                </a>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
