"use client";

import React, { useMemo, useState } from "react";
import type {
  StorefrontDiscount,
  StorefrontOrderReceipt,
  StorefrontProduct,
  StorefrontProductVariant,
  StorefrontShippingZone,
} from "./types";
import {
  resolveHeadingFontStyle,
  resolveRadiusClass,
  resolveSurfacePalette,
  type StorefrontThemeTokens,
} from "./presets";
import {
  computeSyntheticRating,
  extractProductSwatches,
  resolveStorefrontImageUrl,
  StorefrontButton,
  StorefrontColorSwatches,
  StorefrontStarRating,
} from "./primitives";

export interface StorefrontCartItem {
  product: StorefrontProduct;
  variant?: StorefrontProductVariant;
  selectedColor?: string;
  quantity: number;
}

// ---------------------------------------------------------------------------
// 1. PRODUCT QUICK-VIEW & DETAIL MODAL (Pure Web E-Commerce)
// ---------------------------------------------------------------------------

export function StorefrontProductQuickViewModal({
  product,
  theme,
  businessName,
  onClose,
  onAddToCart,
  onBuyNow,
}: {
  product: StorefrontProduct | null;
  theme: StorefrontThemeTokens;
  businessName: string;
  onClose: () => void;
  onAddToCart: (item: StorefrontCartItem) => void;
  onBuyNow: (item: StorefrontCartItem) => void;
}) {
  if (!product) return null;

  const palette = resolveSurfacePalette(theme.surfaceMode);
  const headingFont = resolveHeadingFontStyle(theme.fontPairing);
  const cardRadius = resolveRadiusClass(theme.borderRadius, "card");

  const swatches = extractProductSwatches(product);
  const [selectedVariant, setSelectedVariant] = useState<StorefrontProductVariant | undefined>(
    product.variants?.[0]
  );
  const [selectedColor, setSelectedColor] = useState<string>(swatches[0]?.label ?? "");
  const [quantity, setQuantity] = useState(1);

  const galleryList = useMemo(() => {
    if (product.customFields?.galleryUrls) {
      try {
        const parsed = JSON.parse(product.customFields.galleryUrls);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((u) => resolveStorefrontImageUrl(String(u))).filter(Boolean);
        }
      } catch {}
    }
    const primary =
      resolveStorefrontImageUrl(product.primaryImageUrl) ||
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80";
    return [primary];
  }, [product]);

  const [activeImageIdx, setActiveImageIdx] = useState(0);

  const unitPriceNaira = selectedVariant ? selectedVariant.priceNaira : product.basePriceNaira;
  const compareAtNaira = product.customFields?.compareAtPriceNaira
    ? Number(product.customFields.compareAtPriceNaira)
    : 0;
  const availableStock = selectedVariant
    ? (selectedVariant.availableStock ?? selectedVariant.stock)
    : product.availableStock;
  const isOutOfStock = availableStock <= 0;
  const ratingInfo = computeSyntheticRating(product);

  const imageUrl = galleryList[activeImageIdx] || galleryList[0]!;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 @sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-3xl max-h-[90vh] overflow-y-auto ${cardRadius} shadow-2xl border grid grid-cols-1 @md:grid-cols-12`}
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

        <div
          className="@md:col-span-6 aspect-square @md:aspect-auto flex flex-col items-center justify-center p-4 @sm:p-6 gap-3"
          style={{ backgroundColor: palette.sectionAltBg }}
        >
          <img
            src={imageUrl}
            alt={product.name}
            className="w-full h-full max-h-72 @md:max-h-88 object-cover rounded-xl shadow-sm"
          />
          {galleryList.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto max-w-full py-1">
              {galleryList.map((thumb, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImageIdx(idx)}
                  className={`w-12 h-12 rounded-lg overflow-hidden border-2 shrink-0 cursor-pointer transition-all ${
                    activeImageIdx === idx ? "scale-105 shadow-xs" : "opacity-60 hover:opacity-100"
                  }`}
                  style={{
                    borderColor:
                      activeImageIdx === idx ? theme.accentColor : palette.borderSubtle,
                  }}
                >
                  <img src={thumb} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="@md:col-span-6 p-5 @sm:p-8 flex flex-col justify-between space-y-5">
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

            <h2 className="text-xl sm:text-2xl font-bold leading-snug mb-1.5" style={headingFont}>
              {product.name}
            </h2>

            <div className="mb-3">
              <StorefrontStarRating
                rating={ratingInfo.rating}
                reviewsCount={ratingInfo.reviewsCount}
                mutedColor={palette.textMuted}
              />
            </div>

            <div className="flex items-baseline gap-2.5 mb-3">
              <p className="text-2xl font-black" style={{ color: theme.accentColor }}>
                ₦{unitPriceNaira.toLocaleString()}
              </p>
              {compareAtNaira > unitPriceNaira && (
                <span className="text-sm line-through opacity-55">
                  ₦{compareAtNaira.toLocaleString()}
                </span>
              )}
              {product.customFields?.productType === "DIGITAL" && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 uppercase">
                  ⚡ Instant Digital Delivery
                </span>
              )}
            </div>

            <p className="text-xs leading-relaxed mb-4" style={{ color: palette.textSecondary }}>
              {product.description ||
                `Authentic ${product.name} from ${businessName}. Includes instant stock reservation and doorway courier delivery.`}
            </p>

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

          <div className="grid grid-cols-2 gap-3 pt-3">
            <StorefrontButton
              theme={theme}
              variant="outline"
              size="lg"
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
              size="lg"
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
              {isOutOfStock ? "Sold Out" : "Buy It Now →"}
            </StorefrontButton>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. SLIDE-OVER SHOPPING BAG DRAWER (Leads cleanly into Standard Web Checkout)
// ---------------------------------------------------------------------------

export function StorefrontShoppingBagDrawer({
  isOpen,
  onClose,
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onProceedToCheckout,
  theme,
  businessName,
}: {
  isOpen: boolean;
  onClose: () => void;
  cart: StorefrontCartItem[];
  onUpdateQuantity: (index: number, delta: number) => void;
  onRemoveItem: (index: number) => void;
  onProceedToCheckout: () => void;
  theme: StorefrontThemeTokens;
  businessName: string;
}) {
  const palette = resolveSurfacePalette(theme.surfaceMode);
  const headingFont = resolveHeadingFontStyle(theme.fontPairing);

  const subtotalNaira = useMemo(() => {
    return cart.reduce((sum, item) => {
      const unit = item.variant ? item.variant.priceNaira : item.product.basePriceNaira;
      return sum + unit * item.quantity;
    }, 0);
  }, [cart]);

  if (!isOpen) return null;

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
        <div>
          <div
            className="flex items-center justify-between pb-4 mb-5 border-b"
            style={{ borderColor: palette.borderSubtle }}
          >
            <div>
              <h2 className="text-lg font-extrabold" style={headingFont}>
                Shopping Bag ({cart.reduce((s, i) => s + i.quantity, 0)})
              </h2>
              <p className="text-xs" style={{ color: palette.textMuted }}>
                {businessName} · Free 15-minute stock lock at checkout
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:opacity-75 cursor-pointer"
              style={{ backgroundColor: palette.sectionAltBg }}
            >
              ✕
            </button>
          </div>

          {cart.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <div
                className="w-14 h-14 mx-auto rounded-full flex items-center justify-center"
                style={{ backgroundColor: palette.sectionAltBg }}
              >
                <svg className="w-6 h-6 opacity-50" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <p className="text-base font-bold">Your shopping bag is empty</p>
              <p className="text-xs max-w-xs mx-auto" style={{ color: palette.textMuted }}>
                Browse the catalog and add items to your bag to proceed to checkout.
              </p>
              <StorefrontButton theme={theme} variant="solid" size="sm" onClick={onClose}>
                Continue Shopping
              </StorefrontButton>
            </div>
          ) : (
            <div className="space-y-3.5">
              {cart.map((item, idx) => {
                const unit = item.variant ? item.variant.priceNaira : item.product.basePriceNaira;
                return (
                  <div
                    key={`${item.product.id}-${item.variant?.id ?? "base"}-${idx}`}
                    className="flex items-center gap-3.5 p-3 rounded-xl border"
                    style={{
                      backgroundColor: palette.sectionAltBg,
                      borderColor: palette.borderSubtle,
                    }}
                  >
                    <img
                      src={
                        resolveStorefrontImageUrl(item.product.primaryImageUrl) ||
                        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&q=80"
                      }
                      alt={item.product.name}
                      className="w-16 h-16 rounded-lg object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold truncate">{item.product.name}</h4>
                      <p className="text-[11px]" style={{ color: palette.textMuted }}>
                        {item.variant ? item.variant.name : item.product.skuCode}
                        {item.selectedColor ? ` · ${item.selectedColor}` : ""}
                      </p>
                      <p className="text-xs font-extrabold mt-1">
                        ₦{(unit * item.quantity).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(idx, -1)}
                        className="w-7 h-7 rounded-md border text-xs font-bold flex items-center justify-center cursor-pointer"
                        style={{ borderColor: palette.borderSubtle }}
                      >
                        −
                      </button>
                      <span className="text-xs font-bold w-5 text-center">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(idx, 1)}
                        className="w-7 h-7 rounded-md border text-xs font-bold flex items-center justify-center cursor-pointer"
                        style={{ borderColor: palette.borderSubtle }}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(idx)}
                        title="Remove item"
                        className="ml-1 text-xs opacity-60 hover:opacity-100 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div
            className="pt-5 mt-6 border-t space-y-4"
            style={{ borderColor: palette.borderSubtle }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: palette.textMuted }}>
                Subtotal
              </span>
              <span className="text-lg font-black">₦{subtotalNaira.toLocaleString()}</span>
            </div>
            <p className="text-[11px]" style={{ color: palette.textMuted }}>
              Shipping fee and discount codes are calculated at checkout.
            </p>
            <StorefrontButton
              theme={theme}
              variant="solid"
              size="lg"
              fullWidth
              onClick={() => {
                onClose();
                onProceedToCheckout();
              }}
            >
              Proceed to Checkout →
            </StorefrontButton>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 text-xs font-semibold text-center hover:underline cursor-pointer"
              style={{ color: palette.textSecondary }}
            >
              Continue Shopping
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. FULL STANDARD E-COMMERCE WEB CHECKOUT PAGE
//    Supports Card Checkout (Visa / Mastercard / Verve) + Instant Bank Transfer
//    + Discount Codes + Shipping Zone Selection + Instant On-Site Order Receipt
// ---------------------------------------------------------------------------

export function StorefrontStandardCheckoutPage({
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onContinueShopping,
  shippingZones,
  discounts,
  theme,
  vendorSlug,
  businessName,
  apiBaseUrl = "",
  onOrderCompleted,
}: {
  cart: StorefrontCartItem[];
  onUpdateQuantity: (index: number, delta: number) => void;
  onRemoveItem: (index: number) => void;
  onClearCart: () => void;
  onContinueShopping: () => void;
  shippingZones: StorefrontShippingZone[];
  discounts: StorefrontDiscount[];
  theme: StorefrontThemeTokens;
  vendorSlug: string;
  businessName: string;
  apiBaseUrl?: string;
  onOrderCompleted?: () => void;
}) {
  const palette = resolveSurfacePalette(theme.surfaceMode);
  const headingFont = resolveHeadingFontStyle(theme.fontPairing);
  const cardRadius = resolveRadiusClass(theme.borderRadius, "card");

  const [selectedZoneId, setSelectedZoneId] = useState<string>(
    shippingZones[0]?.id ?? ""
  );
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<StorefrontDiscount | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Customer & Shipping Form
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("Lagos");
  const [deliveryLandmark, setDeliveryLandmark] = useState("");

  // Payment Method ("CARD" | "BANK_TRANSFER")
  const [paymentMethod, setPaymentMethod] = useState<"CARD" | "BANK_TRANSFER">("CARD");
  const [cardNumber, setCardNumber] = useState("5399 •••• •••• 8821");
  const [cardExpiry, setCardExpiry] = useState("09/28");
  const [cardCvv, setCardCvv] = useState("842");

  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [createdReceipt, setCreatedReceipt] = useState<StorefrontOrderReceipt | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);

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

  const handleApplyPromo = () => {
    setPromoError(null);
    const clean = promoCodeInput.trim().toUpperCase();
    if (!clean) return;
    const found = discounts.find((d) => d.isActive && d.code.toUpperCase() === clean);
    if (!found) {
      setPromoError(`Promo code "${clean}" is not valid or has expired.`);
      return;
    }
    setAppliedDiscount(found);
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError(null);
    if (!buyerName.trim() || !buyerPhone.trim() || !deliveryAddress.trim()) {
      setCheckoutError("Please complete your full name, phone number, and delivery street address.");
      return;
    }
    setSubmitting(true);
    try {
      const endpoint = `${apiBaseUrl}/api/v1/public/storefront/${encodeURIComponent(
        vendorSlug
      )}/checkout`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerName: buyerName.trim(),
          buyerPhone: buyerPhone.trim(),
          shippingZoneId: activeZone?.id,
          shippingZoneName: activeZone?.name,
          discountCode: appliedDiscount?.code,
          deliveryAddress: `${deliveryAddress.trim()}, ${deliveryCity.trim()}`,
          deliveryLandmark: deliveryLandmark.trim() || undefined,
          items: cart.map((it) => ({
            productId: it.product.id,
            productSku: it.product.skuCode,
            variantId: it.variant?.id,
            variantSku: it.variant?.sku,
            quantity: it.quantity,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Could not place order.");
      }

      let finalReceipt: StorefrontOrderReceipt = data.receipt;

      // If buyer selected Card checkout, complete payment verification immediately
      if (paymentMethod === "CARD" && finalReceipt && !finalReceipt.isPaid) {
        try {
          await fetch(`${apiBaseUrl}/api/v1/simulate/monnify-transfer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderShortCode: finalReceipt.shortCode,
              amountNaira: finalReceipt.totalAmountNaira,
              payerName: buyerName.trim(),
            }),
          });
          const refreshed = await fetch(
            `${apiBaseUrl}/api/v1/public/orders/${encodeURIComponent(finalReceipt.shortCode)}`
          );
          if (refreshed.ok) {
            const refreshedData = await refreshed.json();
            if (refreshedData?.receipt) {
              finalReceipt = refreshedData.receipt;
            }
          }
        } catch {
          // Fallback to pending receipt if live gateway
        }
      }

      setCreatedReceipt(finalReceipt);
      onClearCart();
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        const bc = new BroadcastChannel("caterlog_realtime_sync");
        bc.postMessage({ type: "ORDER_CREATED", shortCode: finalReceipt?.shortCode });
        bc.close();
      }
      onOrderCompleted?.();
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Checkout failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyBankTransfer = async () => {
    if (!createdReceipt) return;
    setVerifyingPayment(true);
    try {
      await fetch(`${apiBaseUrl}/api/v1/simulate/monnify-transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderShortCode: createdReceipt.shortCode,
          amountNaira: createdReceipt.totalAmountNaira,
          payerName: createdReceipt.customerName,
        }),
      });
      const refreshed = await fetch(
        `${apiBaseUrl}/api/v1/public/orders/${encodeURIComponent(createdReceipt.shortCode)}`
      );
      if (refreshed.ok) {
        const refreshedData = await refreshed.json();
        if (refreshedData?.receipt) {
          setCreatedReceipt(refreshedData.receipt);
          if (typeof window !== "undefined" && "BroadcastChannel" in window) {
            const bc = new BroadcastChannel("caterlog_realtime_sync");
            bc.postMessage({ type: "ORDER_PAID", shortCode: refreshedData.receipt.shortCode });
            bc.close();
          }
          onOrderCompleted?.();
        }
      }
    } finally {
      setVerifyingPayment(false);
    }
  };

  // ---------------------------------------------------------------------------
  // STATE A: ORDER CONFIRMED / VIRTUAL ACCOUNT PAYMENT SCREEN
  // ---------------------------------------------------------------------------
  if (createdReceipt) {
    return (
      <section className="max-w-3xl mx-auto px-4 sm:px-8 py-12">
        <div
          className={`p-6 sm:p-10 border ${cardRadius} shadow-lg space-y-6`}
          style={{
            backgroundColor: palette.cardSurfaceBg,
            borderColor: palette.borderSubtle,
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b" style={{ borderColor: palette.borderSubtle }}>
            <div>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider mb-2 ${
                  createdReceipt.isPaid
                    ? "bg-emerald-500/15 text-emerald-700"
                    : "bg-amber-500/15 text-amber-700"
                }`}
              >
                {createdReceipt.isPaid
                  ? "✓ Payment Confirmed · Order Processing"
                  : "⏳ Awaiting Bank Transfer · Stock Reserved"}
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold" style={headingFont}>
                Order #{createdReceipt.shortCode}
              </h1>
              <p className="text-xs mt-1" style={{ color: palette.textMuted }}>
                Thank you, {createdReceipt.customerName}! Your order with {businessName} is registered.
              </p>
            </div>

            <div className="sm:text-right">
              <p className="text-xs uppercase tracking-wider" style={{ color: palette.textMuted }}>
                Total Amount
              </p>
              <p className="text-2xl sm:text-3xl font-black" style={{ color: theme.accentColor }}>
                {createdReceipt.totalAmountFormatted}
              </p>
            </div>
          </div>

          {/* Bank Transfer Virtual Account Instructions if not yet paid */}
          {!createdReceipt.isPaid && (
            <div
              className="p-6 rounded-2xl border space-y-4"
              style={{
                backgroundColor: palette.sectionAltBg,
                borderColor: palette.borderSubtle,
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: palette.textMuted }}>
                    Transfer Exact Amount To Dedicated Virtual Account
                  </p>
                  <p className="text-sm font-bold mt-1">{createdReceipt.bankName}</p>
                  <p className="text-xs" style={{ color: palette.textSecondary }}>
                    Account Name: <span className="font-semibold">{createdReceipt.accountName}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className="text-2xl sm:text-3xl font-mono font-black tracking-wider"
                    style={{ color: theme.accentColor }}
                  >
                    {createdReceipt.accountNumber}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof navigator !== "undefined" && navigator.clipboard) {
                        void navigator.clipboard.writeText(createdReceipt.accountNumber);
                        setCopiedAccount(true);
                        setTimeout(() => setCopiedAccount(false), 2000);
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer"
                    style={{ borderColor: palette.borderSubtle }}
                  >
                    {copiedAccount ? "✓ Copied" : "Copy"}
                  </button>
                </div>
              </div>

              <StorefrontButton
                theme={theme}
                variant="solid"
                size="lg"
                fullWidth
                disabled={verifyingPayment}
                onClick={handleVerifyBankTransfer}
              >
                {verifyingPayment
                  ? "Verifying Transfer..."
                  : "I Have Sent the Transfer — Confirm Payment Now"}
              </StorefrontButton>
            </div>
          )}

          {/* Delivery & Order Summary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div
              className="p-4 rounded-xl border space-y-1.5"
              style={{
                backgroundColor: palette.sectionAltBg,
                borderColor: palette.borderSubtle,
              }}
            >
              <h3 className="font-extrabold uppercase tracking-wider mb-2">
                Shipping Details
              </h3>
              <p>
                <span style={{ color: palette.textMuted }}>Recipient:</span>{" "}
                <span className="font-semibold">{createdReceipt.customerName}</span>
              </p>
              <p>
                <span style={{ color: palette.textMuted }}>Phone:</span>{" "}
                <span className="font-semibold">{createdReceipt.customerPhone}</span>
              </p>
              <p>
                <span style={{ color: palette.textMuted }}>Address:</span>{" "}
                <span className="font-semibold">{createdReceipt.deliveryAddress || "Standard Delivery"}</span>
              </p>
              {createdReceipt.deliveryLandmark && (
                <p>
                  <span style={{ color: palette.textMuted }}>Landmark:</span>{" "}
                  <span className="font-semibold">{createdReceipt.deliveryLandmark}</span>
                </p>
              )}
              <p>
                <span style={{ color: palette.textMuted }}>Delivery Zone:</span>{" "}
                <span className="font-semibold">{createdReceipt.shippingZoneName}</span>
              </p>
            </div>

            <div
              className="p-4 rounded-xl border space-y-1.5"
              style={{
                backgroundColor: palette.sectionAltBg,
                borderColor: palette.borderSubtle,
              }}
            >
              <h3 className="font-extrabold uppercase tracking-wider mb-2">
                Payment Breakdown
              </h3>
              <div className="flex justify-between">
                <span style={{ color: palette.textMuted }}>Items Subtotal</span>
                <span className="font-semibold">{createdReceipt.subtotalFormatted}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: palette.textMuted }}>Shipping Fee</span>
                <span className="font-semibold">{createdReceipt.shippingFeeFormatted}</span>
              </div>
              {createdReceipt.discountCode && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount ({createdReceipt.discountCode})</span>
                  <span className="font-semibold">−{createdReceipt.discountAmountFormatted}</span>
                </div>
              )}
              <div
                className="flex justify-between pt-2 border-t text-sm font-black"
                style={{ borderColor: palette.borderSubtle }}
              >
                <span>Total Paid</span>
                <span>{createdReceipt.amountPaidFormatted}</span>
              </div>
              <p className="text-[11px] pt-1 text-emerald-600 font-semibold">
                {createdReceipt.paymentStamp}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t" style={{ borderColor: palette.borderSubtle }}>
            <StorefrontButton
              theme={theme}
              variant="outline"
              size="md"
              onClick={() => {
                setCreatedReceipt(null);
                onContinueShopping();
              }}
            >
              ← Continue Shopping
            </StorefrontButton>

            <a
              href={`/track/${encodeURIComponent(createdReceipt.shortCode)}`}
              className="px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: theme.accentColor }}
            >
              View Full Live Courier Tracker (#{createdReceipt.shortCode}) →
            </a>
          </div>
        </div>
      </section>
    );
  }

  // ---------------------------------------------------------------------------
  // STATE B: EMPTY CART ON CHECKOUT PAGE
  // ---------------------------------------------------------------------------
  if (cart.length === 0) {
    return (
      <section className="max-w-2xl mx-auto px-4 sm:px-8 py-20 text-center space-y-4">
        <h1 className="text-2xl font-bold" style={headingFont}>
          Your Checkout Bag is Empty
        </h1>
        <p className="text-xs sm:text-sm" style={{ color: palette.textMuted }}>
          Add one or more products from the catalog to proceed to checkout.
        </p>
        <StorefrontButton theme={theme} variant="solid" size="lg" onClick={onContinueShopping}>
          Return to Catalog
        </StorefrontButton>
      </section>
    );
  }

  // ---------------------------------------------------------------------------
  // STATE C: STANDARD TWO-COLUMN E-COMMERCE CHECKOUT FORM
  // ---------------------------------------------------------------------------
  return (
    <section className="max-w-7xl mx-auto px-3.5 @sm:px-6 @lg:px-8 py-8 @sm:py-12 @lg:py-14">
      <div className="mb-6 @sm:mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onContinueShopping}
            className="text-xs font-semibold hover:underline mb-1.5 inline-flex items-center gap-1 cursor-pointer"
            style={{ color: palette.textSecondary }}
          >
            ← Back to Shopping
          </button>
          <h1 className="text-2xl @sm:text-3xl @lg:text-4xl font-extrabold tracking-tight" style={headingFont}>
            Secure Checkout
          </h1>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] @sm:text-xs font-bold bg-emerald-500/10 text-emerald-700">
          🔒 256-Bit Encrypted · Instant Stock Lock
        </span>
      </div>

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 @lg:grid-cols-12 gap-6 @lg:gap-8 items-start">
        {/* LEFT COLUMN (7 Cols): Contact, Shipping Address, Delivery Method & Payment Method */}
        <div className="@lg:col-span-7 space-y-5 @sm:space-y-6">
          {/* 1. Contact Information */}
          <div
            className={`p-4 @sm:p-6 border ${cardRadius} space-y-4`}
            style={{
              backgroundColor: palette.cardSurfaceBg,
              borderColor: palette.borderSubtle,
            }}
          >
            <h2 className="text-sm font-extrabold uppercase tracking-wider">
              1. Contact Information
            </h2>
            <div className="grid grid-cols-1 @sm:grid-cols-2 gap-4">
              <div className="@sm:col-span-2">
                <label className="block text-xs font-semibold mb-1" style={{ color: palette.textSecondary }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="e.g. Chidinma Okafor"
                  className="w-full px-3.5 py-2.5 text-xs @sm:text-sm rounded-xl border bg-transparent focus:outline-none"
                  style={{ borderColor: palette.borderSubtle, color: palette.textPrimary }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: palette.textSecondary }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 text-xs @sm:text-sm rounded-xl border bg-transparent focus:outline-none"
                  style={{ borderColor: palette.borderSubtle, color: palette.textPrimary }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: palette.textSecondary }}>
                  Phone Number (For Rider Delivery) *
                </label>
                <input
                  type="tel"
                  required
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  placeholder="e.g. 0803 123 4567"
                  className="w-full px-3.5 py-2.5 text-xs @sm:text-sm rounded-xl border bg-transparent focus:outline-none"
                  style={{ borderColor: palette.borderSubtle, color: palette.textPrimary }}
                />
              </div>
            </div>
          </div>

          {/* 2. Shipping Address & Delivery Zone */}
          <div
            className={`p-4 @sm:p-6 border ${cardRadius} space-y-4`}
            style={{
              backgroundColor: palette.cardSurfaceBg,
              borderColor: palette.borderSubtle,
            }}
          >
            <h2 className="text-sm font-extrabold uppercase tracking-wider">
              2. Delivery Address & Shipping Method
            </h2>
            <div className="grid grid-cols-1 @sm:grid-cols-2 gap-4">
              <div className="@sm:col-span-2">
                <label className="block text-xs font-semibold mb-1" style={{ color: palette.textSecondary }}>
                  Street Address *
                </label>
                <input
                  type="text"
                  required
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="House number, street name, estate..."
                  className="w-full px-3.5 py-2.5 text-xs @sm:text-sm rounded-xl border bg-transparent focus:outline-none"
                  style={{ borderColor: palette.borderSubtle, color: palette.textPrimary }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: palette.textSecondary }}>
                  City / State *
                </label>
                <input
                  type="text"
                  required
                  value={deliveryCity}
                  onChange={(e) => setDeliveryCity(e.target.value)}
                  placeholder="e.g. Lekki, Lagos"
                  className="w-full px-3.5 py-2.5 text-xs @sm:text-sm rounded-xl border bg-transparent focus:outline-none"
                  style={{ borderColor: palette.borderSubtle, color: palette.textPrimary }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: palette.textSecondary }}>
                  Nearest Landmark / Bus Stop
                </label>
                <input
                  type="text"
                  value={deliveryLandmark}
                  onChange={(e) => setDeliveryLandmark(e.target.value)}
                  placeholder="e.g. Opposite Ebeano Supermarket"
                  className="w-full px-3.5 py-2.5 text-xs @sm:text-sm rounded-xl border bg-transparent focus:outline-none"
                  style={{ borderColor: palette.borderSubtle, color: palette.textPrimary }}
                />
              </div>
            </div>

            {/* Shipping Zone Radio Cards */}
            <div className="pt-2">
              <label className="block text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: palette.textMuted }}>
                Select Delivery Zone
              </label>
              <div className="grid grid-cols-1 @sm:grid-cols-2 gap-2.5">
                {shippingZones.map((zone) => {
                  const isSelected = activeZone?.id === zone.id;
                  return (
                    <button
                      key={zone.id}
                      type="button"
                      onClick={() => setSelectedZoneId(zone.id)}
                      className="p-3.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer"
                      style={{
                        borderColor: isSelected ? theme.accentColor : palette.borderSubtle,
                        backgroundColor: isSelected ? `${theme.accentColor}10` : palette.sectionAltBg,
                      }}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-bold truncate">{zone.name}</p>
                        <p className="text-[11px]" style={{ color: palette.textMuted }}>
                          Doorway Courier Delivery
                        </p>
                      </div>
                      <span className="text-xs font-extrabold shrink-0" style={{ color: theme.accentColor }}>
                        {zone.feeFormatted}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3. Payment Method Selection */}
          <div
            className={`p-4 @sm:p-6 border ${cardRadius} space-y-4`}
            style={{
              backgroundColor: palette.cardSurfaceBg,
              borderColor: palette.borderSubtle,
            }}
          >
            <h2 className="text-sm font-extrabold uppercase tracking-wider">
              3. Payment Method
            </h2>

            <div className="grid grid-cols-1 @sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod("CARD")}
                className="p-4 rounded-xl border text-left transition-all cursor-pointer"
                style={{
                  borderColor: paymentMethod === "CARD" ? theme.accentColor : palette.borderSubtle,
                  backgroundColor:
                    paymentMethod === "CARD" ? `${theme.accentColor}10` : palette.sectionAltBg,
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-extrabold">Debit / Credit Card</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-xs bg-emerald-500/15 text-emerald-700">
                    Instant
                  </span>
                </div>
                <p className="text-[11px]" style={{ color: palette.textMuted }}>
                  Visa · Mastercard · Verve
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("BANK_TRANSFER")}
                className="p-4 rounded-xl border text-left transition-all cursor-pointer"
                style={{
                  borderColor:
                    paymentMethod === "BANK_TRANSFER" ? theme.accentColor : palette.borderSubtle,
                  backgroundColor:
                    paymentMethod === "BANK_TRANSFER"
                      ? `${theme.accentColor}10`
                      : palette.sectionAltBg,
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-extrabold">Bank Transfer</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-xs bg-blue-500/15 text-blue-700">
                    Virtual Account
                  </span>
                </div>
                <p className="text-[11px]" style={{ color: palette.textMuted }}>
                  Dedicated 10-digit NUBAN account
                </p>
              </button>
            </div>

            {paymentMethod === "CARD" && (
              <div
                className="p-4 rounded-xl border space-y-3 mt-3"
                style={{
                  backgroundColor: palette.sectionAltBg,
                  borderColor: palette.borderSubtle,
                }}
              >
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: palette.textMuted }}>
                    Card Number
                  </label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    placeholder="0000 0000 0000 0000"
                    className="w-full px-3.5 py-2 text-xs font-mono rounded-lg border bg-transparent"
                    style={{ borderColor: palette.borderSubtle, color: palette.textPrimary }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: palette.textMuted }}>
                      Expiry Date
                    </label>
                    <input
                      type="text"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      placeholder="MM/YY"
                      className="w-full px-3.5 py-2 text-xs font-mono rounded-lg border bg-transparent"
                      style={{ borderColor: palette.borderSubtle, color: palette.textPrimary }}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: palette.textMuted }}>
                      CVV
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      placeholder="123"
                      className="w-full px-3.5 py-2 text-xs font-mono rounded-lg border bg-transparent"
                      style={{ borderColor: palette.borderSubtle, color: palette.textPrimary }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN (5 Cols): Order Summary, Promo Code & Place Order Button */}
        <div
          className={`@lg:col-span-5 p-4 @sm:p-6 border ${cardRadius} space-y-5 @lg:sticky @lg:top-24`}
          style={{
            backgroundColor: palette.cardSurfaceBg,
            borderColor: palette.borderSubtle,
          }}
        >
          <h2 className="text-sm font-extrabold uppercase tracking-wider">
            Order Summary ({cart.reduce((s, i) => s + i.quantity, 0)} Items)
          </h2>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {cart.map((item, idx) => {
              const unit = item.variant ? item.variant.priceNaira : item.product.basePriceNaira;
              return (
                <div
                  key={`chk-${item.product.id}-${idx}`}
                  className="flex items-center gap-3 pb-3 border-b"
                  style={{ borderColor: palette.borderSubtle }}
                >
                  <img
                    src={
                      resolveStorefrontImageUrl(item.product.primaryImageUrl) ||
                      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&q=80"
                    }
                    alt={item.product.name}
                    className="w-14 h-14 rounded-lg object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold truncate">{item.product.name}</h4>
                    <p className="text-[11px]" style={{ color: palette.textMuted }}>
                      {item.variant ? item.variant.name : item.product.skuCode} · Qty {item.quantity}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-extrabold">
                      ₦{(unit * item.quantity).toLocaleString()}
                    </p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(idx, -1)}
                        className="w-5 h-5 rounded border text-[10px] font-bold cursor-pointer"
                        style={{ borderColor: palette.borderSubtle }}
                      >
                        −
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(idx, 1)}
                        className="w-5 h-5 rounded border text-[10px] font-bold cursor-pointer"
                        style={{ borderColor: palette.borderSubtle }}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(idx)}
                        className="text-[10px] ml-1 opacity-60 hover:opacity-100 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Discount Code Box */}
          <div>
            <div className="flex gap-2">
              <input
                type="text"
                value={promoCodeInput}
                onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                placeholder="Promo / Discount Code"
                className="flex-1 px-3.5 py-2 text-xs rounded-xl border bg-transparent focus:outline-none"
                style={{ borderColor: palette.borderSubtle, color: palette.textPrimary }}
              />
              <StorefrontButton
                theme={theme}
                variant="outline"
                size="sm"
                onClick={handleApplyPromo}
              >
                Apply
              </StorefrontButton>
            </div>
            {promoError && <p className="text-[11px] text-red-500 mt-1">{promoError}</p>}
            {appliedDiscount && (
              <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                ✓ Discount {appliedDiscount.code} ({appliedDiscount.label}) applied!
              </p>
            )}
          </div>

          {/* Totals Breakdown */}
          <div
            className="p-4 rounded-xl border space-y-2 text-xs"
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
                Shipping ({activeZone?.name ?? "Standard"})
              </span>
              <span className="font-semibold">₦{shippingFeeNaira.toLocaleString()}</span>
            </div>
            <div
              className="flex justify-between pt-2.5 border-t text-base font-black"
              style={{ borderColor: palette.borderSubtle }}
            >
              <span>Total</span>
              <span style={{ color: theme.accentColor }}>₦{totalNaira.toLocaleString()}</span>
            </div>
          </div>

          {checkoutError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs font-semibold">
              {checkoutError}
            </div>
          )}

          <StorefrontButton
            type="submit"
            theme={theme}
            variant="solid"
            size="lg"
            fullWidth
            disabled={submitting}
            className="py-4 text-sm font-extrabold shadow-md"
          >
            {submitting
              ? "Processing Secure Order..."
              : paymentMethod === "CARD"
                ? `Pay ₦${totalNaira.toLocaleString()} with Card →`
                : `Generate Virtual Account (₦${totalNaira.toLocaleString()}) →`}
          </StorefrontButton>

          <p className="text-[11px] text-center" style={{ color: palette.textMuted }}>
            Protected by Monnify Escrow · Automatic stock lock & instant receipt
          </p>
        </div>
      </form>
    </section>
  );
}
