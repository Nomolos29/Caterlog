"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import type { PublicOrderReceipt } from "@/lib/types";

export default function PublicOrderTrackerPage() {
  const params = useParams<{ code: string }>();
  const rawCode = params?.code ? decodeURIComponent(params.code) : "";

  const [receipt, setReceipt] = useState<PublicOrderReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Delivery & Landmark form state
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryLandmark, setDeliveryLandmark] = useState("");
  const [alternatePhone, setAlternatePhone] = useState("");
  const [savingDelivery, setSavingDelivery] = useState(false);
  const [deliverySavedBanner, setDeliverySavedBanner] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const loadReceipt = useCallback(async (showSpinner = false) => {
    if (!rawCode) return;
    if (showSpinner) setLoading(true);
    try {
      const { receipt: data } = await api.getPublicOrderReceipt(rawCode);
      setReceipt(data);
      setError(null);
      setDeliveryAddress((prev) => prev || data.deliveryAddress || "");
      setDeliveryLandmark((prev) => prev || data.deliveryLandmark || "");
      setAlternatePhone((prev) => prev || data.alternatePhone || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Order receipt not found");
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [rawCode]);

  useEffect(() => {
    void loadReceipt(true);
    const interval = setInterval(() => {
      void loadReceipt(false);
    }, 10000);
    return () => clearInterval(interval);
  }, [loadReceipt]);

  const handleSaveDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receipt) return;
    setSavingDelivery(true);
    setDeliverySavedBanner(null);
    try {
      const res = await api.updatePublicOrderDelivery(receipt.shortCode, {
        deliveryAddress: deliveryAddress.trim() || undefined,
        deliveryLandmark: deliveryLandmark.trim() || undefined,
        alternatePhone: alternatePhone.trim() || undefined,
      });
      setReceipt(res.receipt);
      setDeliverySavedBanner("Delivery landmark & contact details synced to vendor and dispatch rider!");
      setTimeout(() => setDeliverySavedBanner(null), 5000);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingDelivery(false);
    }
  };

  const handleCopy = (value: string, label: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(value);
      setCopiedText(label);
      setTimeout(() => setCopiedText(null), 2500);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-emerald-700 text-white flex items-center justify-center font-black text-xl animate-pulse shadow-md">
          C
        </div>
        <p className="text-sm font-bold text-gray-900 mt-4">Loading Official Order Receipt...</p>
        <p className="text-xs text-gray-500 mt-1">Verifying payment & live dispatch status for {rawCode}</p>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white rounded-3xl border border-gray-200 p-8 shadow-xs space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-2xl mx-auto">
            🔍
          </div>
          <h1 className="text-lg font-bold text-gray-900">Order Receipt Not Found</h1>
          <p className="text-xs text-gray-500 leading-relaxed">
            We couldn&apos;t find an order matching <span className="font-mono font-bold text-gray-800">{rawCode}</span>. Please check the link in your WhatsApp receipt.
          </p>
          <a
            href="/"
            className="inline-block px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl transition-all"
          >
            Return to Caterlog
          </a>
        </div>
      </div>
    );
  }

  const isPaidOrBeyond =
    receipt.status === "PAID" ||
    receipt.status === "PROCESSING" ||
    receipt.status === "OUT_FOR_DELIVERY" ||
    receipt.status === "FULFILLED";
  const isRefunded = receipt.status === "REFUNDED";
  const isDispatchedOrBeyond =
    receipt.status === "OUT_FOR_DELIVERY" || receipt.status === "FULFILLED";
  const isFulfilled = receipt.status === "FULFILLED";

  return (
    <div className="min-h-screen bg-[#F4F6F5] text-gray-900 py-6 px-4 sm:px-6 font-sans antialiased">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Top Verified Vendor Header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-2xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-800 text-white flex items-center justify-center font-bold text-sm shadow-2xs">
              {receipt.vendor.businessName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-gray-900">{receipt.vendor.businessName}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  ✓ Verified Store
                </span>
              </div>
              <p className="text-[11px] text-gray-500">
                Official Caterlog Receipt & Live Delivery Tracker
              </p>
            </div>
          </div>
          <a
            href={`https://wa.me/${receipt.vendor.whatsappPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
              `Hello ${receipt.vendor.businessName}, I am checking my Order #${receipt.shortCode}`
            )}`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold transition-all whitespace-nowrap"
          >
            💬 WhatsApp Store
          </a>
        </div>

        {/* Official Payment Status Stamp Card */}
        <div
          className={`rounded-2xl border p-5 shadow-xs space-y-3 ${
            isRefunded
              ? "bg-rose-50/90 border-rose-200 text-rose-950"
              : isPaidOrBeyond
              ? "bg-emerald-900 border-emerald-800 text-white"
              : "bg-amber-50 border-amber-200 text-amber-950"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <span
                className={`inline-block text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                  isRefunded
                    ? "bg-rose-200 text-rose-900"
                    : isPaidOrBeyond
                    ? "bg-emerald-700 text-emerald-100 border border-emerald-600"
                    : "bg-amber-200 text-amber-900"
                }`}
              >
                {isRefunded
                  ? "↩️ Instant Refund Issued"
                  : isPaidOrBeyond
                  ? "✅ Verified Bank Transfer Receipt"
                  : "⏳ Awaiting Bank Transfer"}
              </span>
              <h1 className="text-xl font-black tracking-tight mt-2">
                Order #{receipt.shortCode}
              </h1>
              <p
                className={`text-xs mt-0.5 ${
                  isPaidOrBeyond ? "text-emerald-200" : "text-gray-600"
                }`}
              >
                Buyer: {receipt.customerName} ({receipt.customerPhone})
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs opacity-80">Total Amount</div>
              <div className="text-xl font-black">{receipt.totalAmountFormatted}</div>
            </div>
          </div>

          {isPaidOrBeyond && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-700/70 space-y-1 text-xs">
              <div className="font-extrabold text-emerald-300 tracking-wide uppercase text-[11px]">
                ✓ PAID IN ADVANCE — DO NOT PAY CASH TO RIDER
              </div>
              <div className="flex flex-wrap justify-between gap-2 text-[11px] text-emerald-100 pt-0.5">
                <span>Amount Paid: {receipt.amountPaidFormatted}</span>
                {receipt.paymentTransactionRef && (
                  <span className="font-mono">Ref: {receipt.paymentTransactionRef}</span>
                )}
              </div>
            </div>
          )}

          {isRefunded && (
            <div className="p-3 rounded-xl bg-white/80 border border-rose-200 space-y-1 text-xs text-rose-900">
              <div className="font-bold">
                Refunded: {receipt.refundedAmountFormatted || receipt.amountPaidFormatted}
              </div>
              {receipt.refundReference && (
                <div className="font-mono text-[11px]">Refund Ref: {receipt.refundReference}</div>
              )}
              {receipt.refundReason && (
                <div className="text-[11px] text-rose-700">Reason: {receipt.refundReason}</div>
              )}
            </div>
          )}

          {!isPaidOrBeyond && !isRefunded && (
            <div className="p-3.5 rounded-xl bg-white border border-amber-200 space-y-2 text-xs text-gray-800">
              <div className="font-bold text-amber-900">
                Complete Payment via Your Bank App (Traditional Transfer):
              </div>
              <div className="flex items-center justify-between bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                <div>
                  <div className="text-[11px] text-gray-500">{receipt.bankName}</div>
                  <div className="font-mono text-base font-black text-gray-900 tracking-wider">
                    {receipt.accountNumber}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(receipt.accountNumber, "account")}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  {copiedText === "account" ? "✓ Copied" : "Copy Account"}
                </button>
              </div>
              <p className="text-[11px] text-gray-500">
                As soon as your bank transfer goes through, this page and your WhatsApp chat will automatically update to <strong>PAID</strong>.
              </p>
            </div>
          )}
        </div>

        {/* Live 4-Step Order Timeline */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">Live Fulfillment Progress</h2>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
              {receipt.status.replace(/_/g, " ")}
            </span>
          </div>

          <div className="space-y-4 relative pl-4 border-l-2 border-emerald-500 text-xs">
            {/* Step 1 */}
            <div>
              <div className="font-bold text-gray-900 flex items-center gap-2">
                <span className="text-emerald-600 font-black">✓</span>
                <span>1. Order Reserved on WhatsApp</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {new Date(receipt.createdAt).toLocaleString("en-NG", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>

            {/* Step 2 */}
            <div>
              <div className="font-bold text-gray-900 flex items-center gap-2">
                <span className={isPaidOrBeyond ? "text-emerald-600 font-black" : "text-amber-500"}>
                  {isPaidOrBeyond ? "✓" : "●"}
                </span>
                <span>2. Bank Transfer Verified</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {receipt.paidAt
                  ? `Confirmed at ${new Date(receipt.paidAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })} (${receipt.amountPaidFormatted})`
                  : isPaidOrBeyond
                  ? `Confirmed (${receipt.amountPaidFormatted})`
                  : "Waiting for transfer to dedicated NUBAN"}
              </p>
            </div>

            {/* Step 3 */}
            <div>
              <div
                className={`font-bold flex items-center gap-2 ${
                  isDispatchedOrBeyond ? "text-blue-800" : "text-gray-500"
                }`}
              >
                <span className={isDispatchedOrBeyond ? "text-emerald-600 font-black" : "text-gray-400"}>
                  {isDispatchedOrBeyond ? "✓" : "○"}
                </span>
                <span>3. Dispatched / Out for Delivery</span>
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5 space-y-1.5">
                {isDispatchedOrBeyond ? (
                  <>
                    <p>
                      Package handed over to dispatch rider
                      {receipt.dispatchedAt
                        ? ` at ${new Date(receipt.dispatchedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                        : ""}
                      .
                    </p>
                    {receipt.riderPhone && (
                      <a
                        href={`tel:${receipt.riderPhone}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-semibold text-xs transition-all"
                      >
                        <span>🛵 Call Dispatch Rider ({receipt.riderPhone})</span>
                      </a>
                    )}
                  </>
                ) : (
                  <p>Vendor is preparing your package for dispatch</p>
                )}
              </div>
            </div>

            {/* Step 4 */}
            <div>
              <div
                className={`font-bold flex items-center gap-2 ${
                  isFulfilled ? "text-emerald-800" : "text-gray-400"
                }`}
              >
                <span>{isFulfilled ? "✓" : "○"}</span>
                <span>4. Delivered</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {isFulfilled ? "Order completed and delivered" : "Pending rider arrival"}
              </p>
            </div>
          </div>
        </div>

        {/* Interactive Buyer Delivery Landmark & Alternate Phone Form */}
        {!isRefunded && (
          <form
            onSubmit={handleSaveDelivery}
            className="bg-white rounded-2xl border border-gray-200 p-5 shadow-2xs space-y-4"
          >
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900">
                  📍 Delivery Address & Rider Landmark
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800">
                  Live Sync to Rider
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Help the dispatch rider find you faster without endless phone calls. Any update here is sent straight to the store and rider waybill.
              </p>
            </div>

            {deliverySavedBanner && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold">
                ✓ {deliverySavedBanner}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Street Delivery Address ({receipt.shippingZoneName || "Delivery Zone"})
                </label>
                <input
                  type="text"
                  placeholder="e.g. 14 Admiralty Way, Lekki Phase 1, Lagos"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-emerald-600 bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Prominent Landmark / Gate Directions
                </label>
                <input
                  type="text"
                  placeholder="e.g. Opposite Total Filling Station, black gate beside Domino's Pizza"
                  value={deliveryLandmark}
                  onChange={(e) => setDeliveryLandmark(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-emerald-600 bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Alternate / Gate Receiver Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 0803 000 0000 (if someone else is collecting at the gate)"
                  value={alternatePhone}
                  onChange={(e) => setAlternatePhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-emerald-600 bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingDelivery}
              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs font-semibold rounded-xl shadow-2xs transition-all cursor-pointer active:scale-95"
            >
              {savingDelivery ? "Saving to Rider Waybill..." : "Save Delivery Landmark & Directions"}
            </button>
          </form>
        )}

        {/* Itemized Order Breakdown */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-2xs space-y-3 text-xs">
          <h2 className="text-sm font-bold text-gray-900">Itemized Receipt</h2>

          <div className="divide-y divide-gray-100">
            {(receipt.items ?? []).map((item, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-gray-900">
                    {item.productName} × {item.quantity}
                  </div>
                  {item.variantName && (
                    <div className="text-[11px] text-emerald-700 font-medium">{item.variantName}</div>
                  )}
                </div>
                <div className="font-bold text-gray-900">{item.subtotalFormatted}</div>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 pt-2.5 space-y-1.5">
            <div className="flex justify-between text-gray-500">
              <span>Items Subtotal</span>
              <span className="font-semibold text-gray-900">{receipt.subtotalFormatted}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Delivery ({receipt.shippingZoneName || "Standard"})</span>
              <span className="font-semibold text-gray-900">{receipt.shippingFeeFormatted}</span>
            </div>
            {receipt.discountAmountFormatted !== "₦0" && (
              <div className="flex justify-between text-emerald-700">
                <span>Discount</span>
                <span className="font-semibold">-{receipt.discountAmountFormatted}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-black text-gray-900 pt-1 border-t border-gray-100">
              <span>Total</span>
              <span>{receipt.totalAmountFormatted}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-2.5 pb-8">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 py-2.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 text-xs font-semibold rounded-xl shadow-2xs cursor-pointer"
          >
            🖨️ Print / Save PDF Receipt
          </button>
          <button
            type="button"
            onClick={() =>
              handleCopy(
                typeof window !== "undefined" ? window.location.href : receipt.shortCode,
                "link"
              )
            }
            className="flex-1 py-2.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 text-xs font-semibold rounded-xl shadow-2xs cursor-pointer"
          >
            {copiedText === "link" ? "✓ Link Copied!" : "🔗 Copy Tracking Link"}
          </button>
        </div>
      </div>
    </div>
  );
}
