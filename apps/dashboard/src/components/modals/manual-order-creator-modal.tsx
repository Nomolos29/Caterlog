"use client";

import React, { useState, useMemo, useEffect } from "react";
import { api } from "@/lib/api";
import type {
  DiscountItem,
  OrderItem,
  ProductItem,
  PublicOrderReceipt,
  SalesChannel,
  ShippingZoneItem,
  VendorState,
} from "@/lib/types";

interface ManualOrderCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductItem[];
  shippingZones: ShippingZoneItem[];
  discounts?: DiscountItem[];
  vendorName: string;
  initialCustomerName?: string;
  initialCustomerPhone?: string;
  onOrderCreated?: (order: OrderItem, state: VendorState) => void;
}

interface LineItemDraft {
  id: string;
  productSku: string;
  variantId?: string;
  quantity: number;
  customUnitPriceNaira?: number;
}

export function ManualOrderCreatorModal({
  isOpen,
  onClose,
  products,
  shippingZones,
  discounts = [],
  vendorName,
  initialCustomerName = "",
  initialCustomerPhone = "",
  onOrderCreated,
}: ManualOrderCreatorModalProps) {
  const [customerName, setCustomerName] = useState(initialCustomerName);
  const [customerPhone, setCustomerPhone] = useState(initialCustomerPhone || "+234");
  const [customerEmail, setCustomerEmail] = useState("");
  const [salesChannel, setSalesChannel] = useState<SalesChannel>("POS_WALK_IN");
  const [paymentStatus, setPaymentStatus] = useState<"PAID_OFFLINE" | "AWAITING_PAYMENT">("PAID_OFFLINE");
  const [paymentMethod, setPaymentMethod] = useState<
    "POS_TERMINAL" | "CASH" | "BANK_TRANSFER" | "MONNIFY_INVOICE"
  >("POS_TERMINAL");
  const [shippingZoneId, setShippingZoneId] = useState<string>("");
  const [customShippingFeeNaira, setCustomShippingFeeNaira] = useState<string>("0");
  const [discountCode, setDiscountCode] = useState("");
  const [customDiscountNaira, setCustomDiscountNaira] = useState<string>("0");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes] = useState("");

  const [lineItems, setLineItems] = useState<LineItemDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<{
    order: OrderItem;
    receipt: PublicOrderReceipt;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCustomerName(initialCustomerName);
      setCustomerPhone(initialCustomerPhone || "+234");
      setError(null);
      setCreatedResult(null);
      if (products.length > 0 && lineItems.length === 0) {
        const first = products[0]!;
        setLineItems([
          {
            id: `li-${Date.now()}`,
            productSku: first.skuCode,
            variantId: first.variants?.[0]?.id,
            quantity: 1,
          },
        ]);
      }
    }
  }, [isOpen, initialCustomerName, initialCustomerPhone, products]);

  const selectedZone = useMemo(
    () => shippingZones.find((z) => z.id === shippingZoneId),
    [shippingZones, shippingZoneId]
  );

  const computedSummary = useMemo(() => {
    let subtotalNaira = 0;
    const resolvedItems = lineItems.map((li) => {
      const prod = products.find((p) => p.skuCode === li.productSku);
      const variant = prod?.variants?.find((v) => v.id === li.variantId);
      const defaultPrice = variant ? variant.priceNaira : prod?.basePriceNaira ?? 0;
      const unitPrice =
        li.customUnitPriceNaira !== undefined && li.customUnitPriceNaira > 0
          ? li.customUnitPriceNaira
          : defaultPrice;
      const lineTotal = unitPrice * li.quantity;
      subtotalNaira += lineTotal;
      return {
        ...li,
        prod,
        variant,
        unitPrice,
        lineTotal,
        availableStock: variant
          ? (variant.availableStock ?? variant.stock)
          : (prod?.availableStock ?? 0),
      };
    });

    const shippingNaira = selectedZone
      ? selectedZone.feeNaira
      : Math.max(0, Number(customShippingFeeNaira) || 0);

    let promoDiscountNaira = 0;
    const matchedPromo = discountCode.trim()
      ? discounts.find(
          (d) => d.isActive && d.code.toUpperCase() === discountCode.trim().toUpperCase()
        )
      : undefined;

    if (matchedPromo) {
      if (matchedPromo.type === "PERCENTAGE") {
        promoDiscountNaira = Math.round(subtotalNaira * (Number(matchedPromo.value) / 10000));
      } else {
        promoDiscountNaira = Math.min(subtotalNaira, Math.round(Number(matchedPromo.value) / 100));
      }
    } else if (Number(customDiscountNaira) > 0) {
      promoDiscountNaira = Math.min(subtotalNaira, Number(customDiscountNaira));
    }

    const totalNaira = Math.max(0, subtotalNaira - promoDiscountNaira) + shippingNaira;
    return {
      resolvedItems,
      subtotalNaira,
      shippingNaira,
      promoDiscountNaira,
      totalNaira,
      matchedPromo,
    };
  }, [lineItems, products, selectedZone, customShippingFeeNaira, discountCode, customDiscountNaira, discounts]);

  if (!isOpen) return null;

  const handleAddLineItem = () => {
    if (products.length === 0) return;
    const nextProd = products[lineItems.length % products.length]!;
    setLineItems((prev) => [
      ...prev,
      {
        id: `li-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        productSku: nextProd.skuCode,
        variantId: nextProd.variants?.[0]?.id,
        quantity: 1,
      },
    ]);
  };

  const handleUpdateLineItem = (id: string, patch: Partial<LineItemDraft>) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...patch };
        if (patch.productSku && patch.productSku !== item.productSku) {
          const newProd = products.find((p) => p.skuCode === patch.productSku);
          updated.variantId = newProd?.variants?.[0]?.id;
          updated.customUnitPriceNaira = undefined;
        }
        return updated;
      })
    );
  };

  const handleRemoveLineItem = (id: string) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!customerName.trim() || !customerPhone.trim()) {
      setError("Please enter the customer's full name and phone number.");
      return;
    }
    if (lineItems.length === 0) {
      setError("Please add at least one product item.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createManualOrder({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || undefined,
        salesChannel,
        paymentStatus,
        paymentMethod:
          paymentStatus === "AWAITING_PAYMENT" ? "MONNIFY_INVOICE" : paymentMethod,
        shippingZoneId: selectedZone?.id,
        shippingZoneName: selectedZone?.name || "Store Pickup / Custom Delivery",
        customShippingFeeNaira: selectedZone
          ? undefined
          : Math.max(0, Number(customShippingFeeNaira) || 0),
        discountCode: discountCode.trim() || undefined,
        customDiscountNaira:
          !discountCode.trim() && Number(customDiscountNaira) > 0
            ? Number(customDiscountNaira)
            : undefined,
        deliveryAddress: deliveryAddress.trim() || undefined,
        notes: notes.trim() || undefined,
        items: lineItems.map((li) => ({
          productSku: li.productSku,
          variantId: li.variantId,
          quantity: li.quantity,
          customUnitPriceNaira: li.customUnitPriceNaira,
        })),
      });

      setCreatedResult({ order: res.order, receipt: res.receipt });
      onOrderCreated?.(res.order, res.state);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record manual order.");
    } finally {
      setSubmitting(false);
    }
  };

  // Standalone Achievement Popup after Order / Invoice Creation
  if (createdResult) {
    const { order, receipt } = createdResult;
    const isPaid = order.status === "PAID";
    const trackUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/track/${order.shortCode}`
        : receipt.trackUrl;

    return (
      <div
        className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-backdrop-fade"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-[28px] max-w-lg w-full p-6 sm:p-8 shadow-[0_28px_80px_-12px_rgba(15,23,42,0.18)] border border-slate-200/80 space-y-6 animate-popup-spring"
        >
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center text-3xl mx-auto shadow-xs">
              {isPaid ? "✅" : "🧾"}
            </div>
            <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              {isPaid ? "Sale Recorded & Stock Deducted in DB" : "Invoice Generated & Stock Reserved"}
            </span>
            <h2 className="text-xl font-extrabold text-gray-900">
              Order #{order.shortCode} — {order.totalAmountFormatted}
            </h2>
            <p className="text-xs text-gray-500">
              {isPaid
                ? `Offline payment recorded for ${order.customerName}. Physical stock and CRM lifetime spend have been updated in PostgreSQL.`
                : `Dedicated Monnify virtual NUBAN (${order.accountNumber} · ${order.bankName}) generated for ${order.customerName}.`}
            </p>
          </div>

          <div className="bg-[#F8FAFC] rounded-2xl p-4 border border-slate-200/80 space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Customer:</span>
              <span className="font-bold text-gray-900">
                {order.customerName} ({order.customerPhone})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Items:</span>
              <span className="font-semibold text-gray-900">
                {order.productName} ({order.quantity} unit{order.quantity === 1 ? "" : "s"})
              </span>
            </div>
            {!isPaid && (
              <div className="pt-2 border-t border-slate-200/80 flex justify-between items-center">
                <span className="text-gray-500">Dedicated NUBAN:</span>
                <span className="font-mono font-black text-emerald-800">
                  {order.accountNumber} · {order.bankName}
                </span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-200/80 flex justify-between items-center">
              <span className="text-gray-500">Customer Receipt Link:</span>
              <span className="font-mono text-[11px] text-emerald-700 truncate max-w-[230px]">
                {trackUrl}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  navigator.clipboard.writeText(trackUrl);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }
              }}
              className="py-2.5 px-4 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs transition-all cursor-pointer"
            >
              {copiedLink ? "✓ Receipt Link Copied!" : "🔗 Copy Receipt / Invoice Link"}
            </button>
            <a
              href={`https://wa.me/${order.customerPhone.replace(/\+/g, "")}?text=${encodeURIComponent(
                isPaid
                  ? `Hello ${order.customerName}! Thank you for your purchase at ${vendorName}. Here is your official digital receipt for Order #${order.shortCode} (${order.totalAmountFormatted}):\n${trackUrl}`
                  : `Hello ${order.customerName}! Here is your invoice for Order #${order.shortCode} (${order.totalAmountFormatted}) from ${vendorName}.\n\nBank: ${order.bankName}\nAccount: ${order.accountNumber}\n\nView invoice & track delivery live:\n${trackUrl}`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="py-2.5 px-4 rounded-xl bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-bold text-xs text-center transition-all shadow-xs"
            >
              💬 Send Receipt on WhatsApp ↗
            </a>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setCreatedResult(null)}
              className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
            >
              + Record Another Sale
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-backdrop-fade"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-[28px] max-w-3xl w-full my-6 p-6 sm:p-8 shadow-[0_28px_80px_-12px_rgba(15,23,42,0.18)] border border-slate-200/80 space-y-6 max-h-[92vh] overflow-y-auto animate-popup-spring"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                Catlog POS &amp; DM Order Desk
              </span>
              <span className="text-[10px] font-semibold text-gray-400">
                100% Real-Time PostgreSQL Sync
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 mt-1">
              Record Offline Sale or Send Multi-Item Invoice
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Log walk-in POS transactions, phone calls, or Instagram/WhatsApp DM orders and automatically sync inventory &amp; CRM.
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

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
            {error}
          </div>
        )}

        {/* 1. Payment Mode Switcher */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#F8FAFC] p-2 rounded-2xl border border-slate-200/80">
          <button
            type="button"
            onClick={() => setPaymentStatus("PAID_OFFLINE")}
            className={`p-3 rounded-xl text-left transition-all cursor-pointer border ${
              paymentStatus === "PAID_OFFLINE"
                ? "bg-white border-emerald-500 shadow-xs ring-1 ring-emerald-500"
                : "border-transparent hover:bg-white/60"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-gray-900">
                ✅ Paid Offline (POS / Cash / Transfer)
              </span>
              {paymentStatus === "PAID_OFFLINE" && (
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              )}
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Marks order PAID immediately, deducts physical stock, and issues a digital receipt.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setPaymentStatus("AWAITING_PAYMENT")}
            className={`p-3 rounded-xl text-left transition-all cursor-pointer border ${
              paymentStatus === "AWAITING_PAYMENT"
                ? "bg-white border-emerald-500 shadow-xs ring-1 ring-emerald-500"
                : "border-transparent hover:bg-white/60"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-gray-900">
                🧾 Send Invoice Link (Awaiting Payment)
              </span>
              {paymentStatus === "AWAITING_PAYMENT" && (
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              )}
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Locks stock for 15 mins and generates a shareable Monnify NUBAN invoice link.
            </p>
          </button>
        </div>

        {/* 2. Customer & Channel Info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
          <div>
            <label className="block font-bold text-gray-700 mb-1">Customer Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Chioma Adebayo"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-emerald-600 font-semibold"
            />
          </div>
          <div>
            <label className="block font-bold text-gray-700 mb-1">WhatsApp Phone *</label>
            <input
              type="text"
              required
              placeholder="+234803..."
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-emerald-600 font-mono"
            />
          </div>
          <div>
            <label className="block font-bold text-gray-700 mb-1">Order Source Channel</label>
            <select
              value={salesChannel}
              onChange={(e) => setSalesChannel(e.target.value as SalesChannel)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-emerald-600 font-semibold cursor-pointer"
            >
              <option value="POS_WALK_IN">🏪 Walk-In / Physical POS</option>
              <option value="WHATSAPP">💬 WhatsApp Direct Chat</option>
              <option value="INSTAGRAM">📸 Instagram DM</option>
              <option value="FACEBOOK">📘 Facebook Messenger</option>
              <option value="PAYMENT_LINK">🔗 Custom Invoice Link</option>
            </select>
          </div>
        </div>

        {/* 3. Multi-Item Product Cart Builder */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Order Items ({lineItems.length})
            </label>
            <button
              type="button"
              onClick={handleAddLineItem}
              className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-xl cursor-pointer transition-colors"
            >
              + Add Another Item
            </button>
          </div>

          <div className="space-y-2.5">
            {computedSummary.resolvedItems.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-200/80 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center text-xs"
              >
                <div className="sm:col-span-5">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                    Product
                  </label>
                  <select
                    value={item.productSku}
                    onChange={(e) =>
                      handleUpdateLineItem(item.id, { productSku: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white font-semibold text-gray-900"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.skuCode}>
                        {p.skuCode} — {p.name} ({p.basePriceFormatted} · {p.availableStock} left)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                    Variant / Option
                  </label>
                  {item.prod?.variants && item.prod.variants.length > 0 ? (
                    <select
                      value={item.variantId || ""}
                      onChange={(e) =>
                        handleUpdateLineItem(item.id, { variantId: e.target.value })
                      }
                      className="w-full px-2.5 py-2 rounded-xl border border-gray-200 bg-white font-medium text-gray-800"
                    >
                      {item.prod.variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} (₦{v.priceNaira.toLocaleString()})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="px-3 py-2 rounded-xl bg-gray-100 text-gray-400 text-[11px]">
                      Standard SKU
                    </div>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                    Qty (Max {item.availableStock})
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, item.availableStock)}
                    value={item.quantity}
                    onChange={(e) =>
                      handleUpdateLineItem(item.id, {
                        quantity: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white font-bold text-center"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center justify-between sm:justify-end gap-2 pt-3 sm:pt-4">
                  <span className="font-extrabold text-gray-900">
                    ₦{item.lineTotal.toLocaleString()}
                  </span>
                  {lineItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveLineItem(item.id)}
                      className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                      title="Remove item"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Payment Method, Delivery Zone & Discount Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
          {paymentStatus === "PAID_OFFLINE" ? (
            <div>
              <label className="block font-bold text-gray-700 mb-1">Payment Tender</label>
              <select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(
                    e.target.value as "POS_TERMINAL" | "CASH" | "BANK_TRANSFER"
                  )
                }
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white font-semibold"
              >
                <option value="POS_TERMINAL">💳 POS Card Terminal</option>
                <option value="BANK_TRANSFER">🏦 Direct Bank Transfer</option>
                <option value="CASH">💵 Cash Handed Over</option>
              </select>
            </div>
          ) : (
            <div>
              <label className="block font-bold text-gray-700 mb-1">Customer Email (Optional)</label>
              <input
                type="email"
                placeholder="customer@email.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200"
              />
            </div>
          )}

          <div>
            <label className="block font-bold text-gray-700 mb-1">Delivery / Pickup Zone</label>
            <select
              value={shippingZoneId}
              onChange={(e) => setShippingZoneId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white font-semibold"
            >
              <option value="">In-Store Pickup / Custom Fee (₦{Number(customShippingFeeNaira || 0).toLocaleString()})</option>
              {shippingZones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name} ({z.feeFormatted})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">
              Promo Code or Flat Discount (₦)
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="Code (e.g. VIP10)"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                className="w-1/2 px-2.5 py-2.5 rounded-xl border border-gray-200 font-mono uppercase"
              />
              <input
                type="number"
                min={0}
                placeholder="Or ₦ Off"
                value={customDiscountNaira}
                onChange={(e) => setCustomDiscountNaira(e.target.value)}
                className="w-1/2 px-2.5 py-2.5 rounded-xl border border-gray-200"
              />
            </div>
          </div>
        </div>

        {/* Delivery Address & Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
          <div>
            <label className="block font-bold text-gray-700 mb-1">
              Delivery Address (Optional for Walk-In)
            </label>
            <input
              type="text"
              placeholder="e.g. 14 Admiralty Way, Lekki Phase 1"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-gray-200"
            />
          </div>
          <div>
            <label className="block font-bold text-gray-700 mb-1">
              CRM Note / Order Note (Saved to Customer Profile)
            </label>
            <input
              type="text"
              placeholder="e.g. Prefers weekend delivery, repeat shoe buyer"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-gray-200"
            />
          </div>
        </div>

        {/* Summary & Submit Footer */}
        <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5 text-xs">
            <div className="text-gray-600">
              Subtotal: <strong>₦{computedSummary.subtotalNaira.toLocaleString()}</strong>
              {computedSummary.promoDiscountNaira > 0 && (
                <span className="text-emerald-700 font-bold ml-2">
                  · Discount: −₦{computedSummary.promoDiscountNaira.toLocaleString()}
                </span>
              )}
              <span className="ml-2">
                · Delivery: <strong>₦{computedSummary.shippingNaira.toLocaleString()}</strong>
              </span>
            </div>
            <div className="text-base font-black text-gray-900">
              Total Order Amount: ₦{computedSummary.totalNaira.toLocaleString()}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-[#0d5c3a] hover:bg-[#0b4b2f] disabled:opacity-50 text-white text-xs font-bold shadow-xs cursor-pointer transition-all active:scale-95"
            >
              {submitting
                ? "Syncing with Database..."
                : paymentStatus === "PAID_OFFLINE"
                  ? "✓ Record Paid Sale & Deduct Stock"
                  : "🧾 Generate Invoice & Reserve Stock"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
