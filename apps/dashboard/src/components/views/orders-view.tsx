"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type {
  CourierShipmentReceipt,
  OrderItem,
  OrderWaybill,
  PlatformRole,
  ShipbubbleCourierQuoteItem,
  VendorProfile,
  VendorState,
} from "@/lib/types";
import { FilterIcon, ExportIcon } from "../icons";
import { EmptyState } from "../ui/empty-state";

interface OrdersViewProps {
  orders: OrderItem[];
  selectedOrder: OrderItem | null;
  vendor?: VendorProfile;
  workspaceRole?: PlatformRole;
  onStateChange?: (state: VendorState) => void;
  initialStatusFilter?: string;
  onSelectOrder: (order: OrderItem | null) => void;
  onSimulateTransfer?: (orderCode: string, amountNaira: number) => Promise<void>;
  onMarkDispatched?: (orderCode: string, riderPhone?: string) => Promise<void>;
  onRefundOrder?: (orderCode: string, reason?: string) => Promise<void>;
  onNavigateToPayments?: (tab?: string, subId?: string) => void;
  onNavigateToSettings?: (tab?: string, subId?: string) => void;
  onOpenTour?: () => void;
}

export function OrdersView({
  orders,
  selectedOrder,
  vendor,
  workspaceRole = "growth",
  onStateChange,
  initialStatusFilter = "ALL",
  onSelectOrder,
  onSimulateTransfer,
  onMarkDispatched,
  onRefundOrder,
  onNavigateToPayments,
  onNavigateToSettings,
  onOpenTour,
}: OrdersViewProps) {
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter);

  useEffect(() => {
    if (initialStatusFilter) {
      setStatusFilter(initialStatusFilter);
    }
  }, [initialStatusFilter]);
  const [search, setSearch] = useState("");
  const [supplierStatus, setSupplierStatus] = useState("Preparing · Not yet dispatched");
  const [supplierRequested, setSupplierRequested] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [waybillData, setWaybillData] = useState<OrderWaybill | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [riderPhoneInput, setRiderPhoneInput] = useState("");
  const [isDispatching, setIsDispatching] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundReasonInput, setRefundReasonInput] = useState("");
  const [isRefunding, setIsRefunding] = useState(false);

  // Shipbubble Multi-Courier Booking & Official Courier Receipt State
  const isPremiumTier =
    workspaceRole === "pro" ||
    vendor?.role === "pro" ||
    vendor?.subscription?.planId === "PRO" ||
    vendor?.subscription?.planId === "SCALE";
  const [showShipbubbleModal, setShowShipbubbleModal] = useState(false);
  const [showCourierReceiptModal, setShowCourierReceiptModal] = useState(false);
  const [activeCourierReceipt, setActiveCourierReceipt] = useState<CourierShipmentReceipt | null>(null);
  const [sbDeliveryAddress, setSbDeliveryAddress] = useState("");
  const [sbWeightPreset, setSbWeightPreset] = useState<"SMALL_BAG" | "SHOEBOX" | "CARTON" | "CUSTOM">(
    vendor?.shipbubbleConfig?.defaultWeightPreset ?? "SHOEBOX"
  );
  const [sbCustomWeightKg, setSbCustomWeightKg] = useState<string>(
    String(vendor?.shipbubbleConfig?.customWeightKg ?? 1.5)
  );
  const [sbFetchingRates, setSbFetchingRates] = useState(false);
  const [sbRatesError, setSbRatesError] = useState<string | null>(null);
  const [sbRequestToken, setSbRequestToken] = useState<string>("");
  const [sbCouriers, setSbCouriers] = useState<ShipbubbleCourierQuoteItem[]>([]);
  const [sbCheapestId, setSbCheapestId] = useState<string | null>(null);
  const [sbFastestId, setSbFastestId] = useState<string | null>(null);
  const [sbSelectedCourier, setSbSelectedCourier] = useState<ShipbubbleCourierQuoteItem | null>(null);
  const [sbBooking, setSbBooking] = useState(false);
  const [sbUpdatingStatus, setSbUpdatingStatus] = useState(false);

  const handleOpenShipbubbleModal = async (ord: OrderItem) => {
    const initialAddr =
      ord.deliveryAddress ||
      (ord.shippingZoneName ? `${ord.shippingZoneName}, Lagos, Nigeria` : "25 Allen Avenue, Ikeja, Lagos, Nigeria");
    setSbDeliveryAddress(initialAddr);
    const defaultPreset = vendor?.shipbubbleConfig?.defaultWeightPreset ?? "SHOEBOX";
    const effectivePreset = defaultPreset === "CUSTOM" && !isPremiumTier ? "SHOEBOX" : defaultPreset;
    setSbWeightPreset(effectivePreset);
    setSbCustomWeightKg(String(vendor?.shipbubbleConfig?.customWeightKg ?? 1.5));
    setShowShipbubbleModal(true);
    await fetchShipbubbleQuotes(ord.shortCode, initialAddr, effectivePreset, Number(vendor?.shipbubbleConfig?.customWeightKg ?? 1.5));
  };

  const fetchShipbubbleQuotes = async (
    shortCode: string,
    addressOverride?: string,
    presetOverride?: "SMALL_BAG" | "SHOEBOX" | "CARTON" | "CUSTOM",
    customKgOverride?: number
  ) => {
    setSbFetchingRates(true);
    setSbRatesError(null);
    try {
      const res = await api.fetchOrderShipbubbleRates(shortCode, {
        deliveryAddress: addressOverride ?? sbDeliveryAddress,
        weightPreset: presetOverride ?? sbWeightPreset,
        customWeightKg: customKgOverride ?? (Number(sbCustomWeightKg) || 1.5),
      });
      setSbRequestToken(res.requestToken);
      setSbCouriers(res.couriers);
      setSbCheapestId(res.cheapestCourier?.courier_id ?? null);
      setSbFastestId(res.fastestCourier?.courier_id ?? null);
      const preferredList = vendor?.shipbubbleConfig?.selectedCarriers ?? [];
      const defaultPick =
        res.couriers.find(
          (c) => preferredList.includes(c.courier_id) || preferredList.includes(c.service_code)
        ) ??
        res.cheapestCourier ??
        res.couriers[0] ??
        null;
      setSbSelectedCourier(defaultPick);
    } catch (err) {
      setSbRatesError(err instanceof Error ? err.message : "Failed to fetch live courier quotes from Shipbubble.");
    } finally {
      setSbFetchingRates(false);
    }
  };

  const handleBookShipbubbleCourier = async () => {
    if (!selectedOrder || !sbSelectedCourier) return;
    setSbBooking(true);
    setSbRatesError(null);
    try {
      const res = await api.bookOrderShipbubbleCourier(selectedOrder.shortCode, {
        requestToken: sbRequestToken,
        courierId: sbSelectedCourier.courier_id,
        serviceCode: sbSelectedCourier.service_code,
        deliveryAddress: sbDeliveryAddress,
        weightPreset: sbWeightPreset,
        customWeightKg: Number(sbCustomWeightKg) || 1.5,
      });
      if (onStateChange && res.state) {
        onStateChange(res.state);
      }
      setActiveCourierReceipt(res.receipt);
      setShowShipbubbleModal(false);
      setShowCourierReceiptModal(true);
    } catch (err) {
      setSbRatesError(err instanceof Error ? err.message : "Failed to book courier on Shipbubble.");
    } finally {
      setSbBooking(false);
    }
  };

  const handleSimulateCourierStatus = async (
    shortCode: string,
    nextStatus: "confirmed" | "picked_up" | "in_transit" | "completed" | "cancelled"
  ) => {
    setSbUpdatingStatus(true);
    try {
      const res = await api.simulateOrderShipbubbleStatus(shortCode, nextStatus);
      if (onStateChange && res.state) {
        onStateChange(res.state);
      }
      setActiveCourierReceipt(res.receipt);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update courier status.");
    } finally {
      setSbUpdatingStatus(false);
    }
  };

  useEffect(() => {
    if (showPrintModal && selectedOrder) {
      void api
        .getOrderWaybill(selectedOrder.shortCode)
        .then((res) => setWaybillData(res.waybill))
        .catch(() => setWaybillData(null));
    } else {
      setWaybillData(null);
    }
  }, [showPrintModal, selectedOrder]);

  const filteredOrders = orders.filter((o) => {
    if (statusFilter === "PENDING_PAYMENT" && o.status !== "PENDING_PAYMENT" && o.status !== "PARTIALLY_PAID") return false;
    if (statusFilter === "OUT_FOR_DELIVERY" && o.status !== "OUT_FOR_DELIVERY" && o.status !== "FULFILLED") return false;
    if (statusFilter !== "ALL" && statusFilter !== "PENDING_PAYMENT" && statusFilter !== "OUT_FOR_DELIVERY" && o.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        o.shortCode.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.includes(q) ||
        o.productName.toLowerCase().includes(q) ||
        (o.deliveryAddress && o.deliveryAddress.toLowerCase().includes(q)) ||
        o.accountNumber.includes(q)
      );
    }
    return true;
  });

  const counts = {
    ALL: orders.length,
    PENDING_PAYMENT: orders.filter((o) => o.status === "PENDING_PAYMENT" || o.status === "PARTIALLY_PAID").length,
    PAID: orders.filter((o) => o.status === "PAID").length,
    PROCESSING: orders.filter((o) => o.status === "PROCESSING").length,
    OUT_FOR_DELIVERY: orders.filter((o) => o.status === "OUT_FOR_DELIVERY" || o.status === "FULFILLED").length,
  };

  const handleDispatchSubmit = async () => {
    if (!selectedOrder || !onMarkDispatched) return;
    setIsDispatching(true);
    try {
      await onMarkDispatched(selectedOrder.shortCode, riderPhoneInput.trim() || undefined);
      setShowDispatchModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDispatching(false);
    }
  };

  const handleRefundSubmit = async () => {
    if (!selectedOrder || !onRefundOrder) return;
    setIsRefunding(true);
    try {
      await onRefundOrder(selectedOrder.shortCode, refundReasonInput.trim() || undefined);
      setShowRefundModal(false);
      setRefundReasonInput("");
    } catch {
      // Error alerted in parent handler
    } finally {
      setIsRefunding(false);
    }
  };

  const handleExportOrders = () => {
    const header = "Order ID,Customer,Phone,Product,Qty,Amount (NGN),Status,Created At\n";
    const rows = filteredOrders
      .map(
        (o) =>
          `"${o.shortCode}","${o.customerName}","${o.customerPhone}","${o.productName}",${o.quantity},${o.totalAmountNaira},"${o.status}","${o.createdAt}"`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `caterlog-orders-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRequestSupplierUpdate = () => {
    setSupplierRequested(true);
    setTimeout(() => {
      setSupplierStatus("Ready for pickup · Pickup tag generated");
    }, 1200);
  };

  /* -------------------------------------------------------------------------- */
  /* Screen 10: Orders · Reseller order fulfillment (Order Detail CT-1042)      */
  /* -------------------------------------------------------------------------- */
  if (selectedOrder) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto pb-16">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs text-gray-500 mb-1 flex items-center gap-1.5">
              <button
                onClick={() => onSelectOrder(null)}
                className="hover:text-emerald-700 underline"
              >
                Orders
              </button>
              <span>/</span>
              <span>{selectedOrder.shortCode}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Order {selectedOrder.shortCode}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {new Date(selectedOrder.createdAt).toLocaleDateString("en-NG", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
              {", "}
              {new Date(selectedOrder.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              · Sold by Nia Stores
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                  selectedOrder.status === "PAID"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : selectedOrder.status === "OUT_FOR_DELIVERY"
                    ? "bg-blue-50 text-blue-800 border-blue-200"
                    : selectedOrder.status === "FULFILLED"
                    ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                    : selectedOrder.status === "PENDING_PAYMENT"
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : selectedOrder.status === "REFUNDED"
                    ? "bg-rose-50 text-rose-800 border-rose-200"
                    : selectedOrder.status === "EXPIRED"
                    ? "bg-rose-50 text-rose-800 border-rose-200"
                    : "bg-gray-100 text-gray-700 border-gray-200"
                }`}
              >
                {selectedOrder.status === "PAID"
                  ? "🟢 Paid · Transfer Verified"
                  : selectedOrder.status === "OUT_FOR_DELIVERY"
                  ? `🚚 Out for Delivery${selectedOrder.riderPhone ? ` · Rider: ${selectedOrder.riderPhone}` : ""}`
                  : selectedOrder.status === "FULFILLED"
                  ? "✅ Delivered"
                  : selectedOrder.status === "PENDING_PAYMENT"
                  ? "🟡 Awaiting Payment"
                  : selectedOrder.status === "REFUNDED"
                  ? `↩️ Refunded${selectedOrder.refundReference ? ` · Ref: ${selectedOrder.refundReference}` : ""}`
                  : selectedOrder.status === "EXPIRED"
                  ? "🛑 Expired"
                  : selectedOrder.status}
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                WhatsApp order
              </span>
              <a
                href={`/track/${selectedOrder.shortCode}`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-all"
              >
                🔗 Customer Live Receipt (/track/{selectedOrder.shortCode}) ↗
              </a>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
            {selectedOrder.courierShipment ? (
              <button
                onClick={() => {
                  setActiveCourierReceipt(selectedOrder.courierShipment!);
                  setShowCourierReceiptModal(true);
                }}
                className="px-3.5 py-1.5 bg-indigo-950 hover:bg-indigo-900 text-white text-xs font-semibold rounded-lg shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
              >
                <span>🧾</span>
                <span>Courier Receipt ({selectedOrder.courierShipment.receiptNumber})</span>
              </button>
            ) : null}
            {(selectedOrder.status === "PAID" ||
              selectedOrder.status === "PROCESSING" ||
              selectedOrder.status === "OUT_FOR_DELIVERY") && (
              <button
                onClick={() => void handleOpenShipbubbleModal(selectedOrder)}
                className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
              >
                <span>🚚</span>
                <span>
                  {selectedOrder.courierShipment
                    ? "Change Courier (Shipbubble)"
                    : "Ship with Courier (Shipbubble)"}
                </span>
              </button>
            )}
            {(selectedOrder.status === "PAID" || selectedOrder.status === "PROCESSING") && (
              <button
                onClick={() => {
                  setRiderPhoneInput(selectedOrder.riderPhone || "");
                  setShowDispatchModal(true);
                }}
                className="px-3.5 py-1.5 border border-emerald-700 hover:bg-emerald-50 text-emerald-900 text-xs font-semibold rounded-lg shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
              >
                <span>🛵</span>
                <span>Manual Bike Rider</span>
              </button>
            )}
            {selectedOrder.status === "OUT_FOR_DELIVERY" && (
              <button
                onClick={() => {
                  setRiderPhoneInput(selectedOrder.riderPhone || "");
                  setShowDispatchModal(true);
                }}
                className="px-3.5 py-1.5 border border-emerald-600 hover:bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-lg shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
              >
                <span>🛵</span>
                <span>Update rider</span>
              </button>
            )}
            <button
              onClick={() => setShowPrintModal(true)}
              className="px-3.5 py-1.5 border border-gray-300 hover:border-gray-500 hover:bg-gray-100 text-gray-700 hover:text-gray-900 text-xs font-semibold rounded-lg shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
            >
              <span>📦</span>
              <span>Rider Waybill / Print Slip</span>
            </button>
            {selectedOrder.status !== "REFUNDED" &&
              (selectedOrder.status === "PAID" ||
                selectedOrder.status === "PARTIALLY_PAID" ||
                selectedOrder.status === "PROCESSING" ||
                selectedOrder.status === "OUT_FOR_DELIVERY") && (
                <button
                  onClick={() => setShowRefundModal(true)}
                  className="px-3.5 py-1.5 border border-rose-300 hover:border-rose-500 hover:bg-rose-50 text-rose-700 text-xs font-semibold rounded-lg shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
                >
                  <span>↩️</span>
                  <span>Issue Instant Refund</span>
                </button>
              )}
          </div>
        </div>

        {/* Official Shipping Courier Receipt & Live Tracking Card (when booked via Shipbubble) */}
        {selectedOrder.courierShipment && (
          <div className="bg-white rounded-2xl border-2 border-emerald-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-lg">
                  🚚
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">
                      {selectedOrder.courierShipment.courierName}
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-900 border border-indigo-200">
                      Receipt: {selectedOrder.courierShipment.receiptNumber}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        selectedOrder.courierShipment.status === "completed"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                          : selectedOrder.courierShipment.status === "in_transit" ||
                            selectedOrder.courierShipment.status === "picked_up"
                          ? "bg-blue-50 text-blue-800 border-blue-200"
                          : selectedOrder.courierShipment.status === "cancelled"
                          ? "bg-rose-50 text-rose-800 border-rose-200"
                          : "bg-amber-50 text-amber-800 border-amber-200"
                      }`}
                    >
                      {selectedOrder.courierShipment.status.replace("_", " ")}
                    </span>
                    {selectedOrder.courierShipment.autoBooked && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">
                        ⚡ Auto-Booked on Paid
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Waybill ID:{" "}
                    <span className="font-mono font-bold text-gray-800">
                      {selectedOrder.courierShipment.trackingCode}
                    </span>{" "}
                    · Package: {selectedOrder.courierShipment.packageWeightKg} kg (
                    {selectedOrder.courierShipment.boxName || "Small Box"}) · Fee Paid:{" "}
                    <span className="font-bold text-emerald-800">
                      ₦{selectedOrder.courierShipment.shippingFeeNaira.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    setActiveCourierReceipt(selectedOrder.courierShipment!);
                    setShowCourierReceiptModal(true);
                  }}
                  className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-lg cursor-pointer transition-all flex items-center gap-1.5"
                >
                  <span>🧾</span>
                  <span>View Official Courier Receipt</span>
                </button>
                <a
                  href={selectedOrder.courierShipment.trackingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-semibold rounded-lg transition-all"
                >
                  Track on Shipbubble ↗
                </a>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="text-gray-600">
                <span className="font-semibold text-gray-800">Delivering To:</span>{" "}
                {selectedOrder.courierShipment.shipTo.address}
                {selectedOrder.courierShipment.deliveryEta
                  ? ` · ETA: ${selectedOrder.courierShipment.deliveryEta}`
                  : ""}
              </div>

              {/* Sandbox Courier Webhook Progression Simulator */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-gray-500 mr-1">
                  Courier Webhook Test:
                </span>
                <button
                  disabled={sbUpdatingStatus}
                  onClick={() =>
                    void handleSimulateCourierStatus(selectedOrder.shortCode, "picked_up")
                  }
                  className="px-2.5 py-1 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-gray-700 text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                >
                  📦 Picked Up
                </button>
                <button
                  disabled={sbUpdatingStatus}
                  onClick={() =>
                    void handleSimulateCourierStatus(selectedOrder.shortCode, "in_transit")
                  }
                  className="px-2.5 py-1 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-gray-700 text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                >
                  🚚 In Transit
                </button>
                <button
                  disabled={sbUpdatingStatus}
                  onClick={() =>
                    void handleSimulateCourierStatus(selectedOrder.shortCode, "completed")
                  }
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                >
                  ✅ Delivered (Unlock Escrow)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2 Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order items card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">Order items</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                  {selectedOrder.quantity || 2} units
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/70 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5">Product</th>
                      <th className="px-4 py-2.5">Price</th>
                      <th className="px-4 py-2.5">Qty</th>
                      <th className="px-4 py-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {selectedOrder.items && selectedOrder.items.length > 0 ? (
                      selectedOrder.items.map((it, idx) => (
                        <tr key={it.id || idx}>
                          <td className="px-4 py-3 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-lg">
                              🛍️
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">
                                {it.productName}
                              </div>
                              {it.variantName ? (
                                <div className="text-[11px] font-medium text-emerald-700">
                                  {it.variantName} {it.variantSku ? `· ${it.variantSku}` : ""}
                                </div>
                              ) : (
                                <div className="text-[11px] text-gray-400">{it.productSku || ""}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {it.unitPriceFormatted || `₦${(Number(it.unitPriceKobo) / 100).toLocaleString()}`}
                          </td>
                          <td className="px-4 py-3 font-medium">{it.quantity}</td>
                          <td className="px-4 py-3 text-right font-bold text-gray-900">
                            {it.subtotalFormatted || `₦${(Number(it.subtotalKobo) / 100).toLocaleString()}`}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-4 py-3 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-lg">
                            🧴
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">
                              {selectedOrder.productName || "Product"}
                            </div>
                            {selectedOrder.variantName ? (
                              <div className="text-[11px] font-medium text-emerald-700">
                                {selectedOrder.variantName} {selectedOrder.variantSku ? `· ${selectedOrder.variantSku}` : ""}
                              </div>
                            ) : (
                              <div className="text-[11px] text-gray-400">{selectedOrder.productSku || ""}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium">
                          ₦{Math.round((Number(selectedOrder.subtotalKobo || selectedOrder.totalAmountKobo) / (selectedOrder.quantity || 1)) / 100).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-medium">{selectedOrder.quantity || 1}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900">
                          {selectedOrder.totalAmountFormatted || `₦${selectedOrder.totalAmountNaira.toLocaleString()}`}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-gray-100 pt-2 text-xs">
                <div className="py-2 flex justify-between text-gray-600">
                  <span>Items subtotal</span>
                  <span className="font-semibold text-gray-900">
                    {selectedOrder.subtotalFormatted || selectedOrder.totalAmountFormatted}
                  </span>
                </div>
                <div className="py-2 flex justify-between text-gray-600">
                  <span>Shipping charged</span>
                  <span className="font-semibold text-gray-900">
                    {selectedOrder.shippingFeeFormatted || "₦0"} · {selectedOrder.shippingZoneName || "Delivery"}
                  </span>
                </div>
                {selectedOrder.discountAmountFormatted && selectedOrder.discountAmountFormatted !== "₦0" && (
                  <div className="py-2 flex justify-between text-emerald-700">
                    <span>Discount applied ({selectedOrder.discountCode || "Promo"})</span>
                    <span className="font-semibold">-{selectedOrder.discountAmountFormatted}</span>
                  </div>
                )}
                <div className="py-2.5 flex justify-between text-sm font-bold text-gray-900">
                  <span>Customer paid</span>
                  <span>{selectedOrder.amountPaidFormatted || selectedOrder.totalAmountFormatted}</span>
                </div>
                {selectedOrder.remainingBalanceFormatted && selectedOrder.remainingBalanceFormatted !== "₦0" && (
                  <div className="py-2 flex justify-between text-amber-700 font-semibold">
                    <span>Remaining balance</span>
                    <span>{selectedOrder.remainingBalanceFormatted}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Order fulfillment card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Order fulfillment</h3>
                <p className="text-[11px] text-gray-400">Delivery & Courier Dispatch</p>
              </div>

              <div className="divide-y divide-gray-100">
                <div className="py-2.5 flex justify-between">
                  <span className="text-gray-500">Destination</span>
                  <span className="font-semibold text-gray-900">
                    {selectedOrder.deliveryAddress || selectedOrder.shippingZoneName || "Standard Delivery"}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-gray-500">Dispatch Rider</span>
                  <span className="font-semibold text-gray-900">
                    {selectedOrder.riderPhone ? `📞 ${selectedOrder.riderPhone}` : "Not assigned"}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-gray-500">Fulfillment status</span>
                  <span
                    className={`font-semibold ${
                      selectedOrder.status === "OUT_FOR_DELIVERY"
                        ? "text-blue-700 font-bold"
                        : selectedOrder.status === "FULFILLED"
                        ? "text-emerald-700 font-bold"
                        : selectedOrder.status === "PAID"
                        ? "text-emerald-800"
                        : "text-amber-800"
                    }`}
                  >
                    {selectedOrder.status === "OUT_FOR_DELIVERY"
                      ? `🚚 Out for Delivery${selectedOrder.riderPhone ? ` (${selectedOrder.riderPhone})` : ""}`
                      : selectedOrder.status === "FULFILLED"
                      ? "✅ Delivered & Complete"
                      : selectedOrder.status === "PAID"
                      ? "🟢 Paid · Ready for Dispatch"
                      : selectedOrder.status === "PENDING_PAYMENT"
                      ? "🟡 Awaiting Payment"
                      : selectedOrder.status}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-xl space-y-1">
                <div className="font-bold text-blue-900 flex items-center gap-1.5">
                  <span>ℹ</span>
                  <span>WhatsApp Live Sync</span>
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  {selectedOrder.status === "OUT_FOR_DELIVERY"
                    ? `Package marked Out for Delivery. Buyer received automated WhatsApp alert${selectedOrder.riderPhone ? ` with rider contact ${selectedOrder.riderPhone}` : ""}.`
                    : selectedOrder.status === "PAID"
                    ? "Payment confirmed. Click 'Dispatch Order' to hand to courier and notify the customer on WhatsApp."
                    : `Order ${selectedOrder.shortCode} is synchronized live with customer WhatsApp thread.`}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {(selectedOrder.status === "PENDING_PAYMENT" || selectedOrder.status === "PARTIALLY_PAID") && onSimulateTransfer && (
                  <button
                    onClick={() => {
                      const amountNaira = Number(
                        BigInt(selectedOrder.totalAmountKobo) -
                          (selectedOrder.amountPaidKobo ? BigInt(selectedOrder.amountPaidKobo) : 0n)
                      ) / 100;
                      void onSimulateTransfer(selectedOrder.shortCode, amountNaira);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
                  >
                    <span>⚡</span>
                    <span>Simulate Bank Transfer (Test Payment)</span>
                  </button>
                )}
                {(selectedOrder.status === "PAID" || selectedOrder.status === "PROCESSING") && (
                  <button
                    onClick={() => {
                      setRiderPhoneInput(selectedOrder.riderPhone || "");
                      setShowDispatchModal(true);
                    }}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
                  >
                    <span>🚚</span>
                    <span>Dispatch Order & Notify Customer</span>
                  </button>
                )}
                {selectedOrder.status === "OUT_FOR_DELIVERY" && (
                  <button
                    onClick={() => {
                      setRiderPhoneInput(selectedOrder.riderPhone || "");
                      setShowDispatchModal(true);
                    }}
                    className="px-4 py-2 border border-emerald-300 hover:bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-lg shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
                  >
                    <span>🛵</span>
                    <span>Update Dispatch Rider</span>
                  </button>
                )}
                <a
                  href={`https://wa.me/${selectedOrder.customerPhone.replace(/\+/g, "")}?text=${encodeURIComponent(
                    `Hello ${selectedOrder.customerName}, regarding your Order ${selectedOrder.shortCode}: It is currently being processed for delivery!`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 border border-gray-300 hover:border-gray-500 hover:bg-gray-100 hover:text-gray-900 text-gray-700 text-xs font-semibold rounded-lg shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
                >
                  <span>Message customer on WhatsApp</span>
                  <span>↗</span>
                </a>
              </div>
            </div>

            {/* Conversation context card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-3 text-xs">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Conversation context</h3>
                <p className="text-[11px] text-gray-400">WhatsApp · {selectedOrder.customerPhone} · Sales co-pilot</p>
              </div>

              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
                <div className="font-semibold text-gray-900 text-xs">{selectedOrder.customerName}</div>
                <p className="text-gray-700 leading-relaxed">
                  Purchased {selectedOrder.quantity}x {selectedOrder.productName} ({selectedOrder.shortCode}).
                </p>
                <div className="text-[10px] text-emerald-700 font-medium pt-1">Verified Order Context</div>
              </div>

              <button
                onClick={() => {
                  if (onNavigateToSettings) {
                    onNavigateToSettings("conversations");
                  }
                }}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-medium block pt-1 text-left"
              >
                Settings → Sales co-pilot → Open conversation ↗
              </button>
            </div>
          </div>

          {/* Right Column (1 Col) */}
          <div className="space-y-6">
            {/* Order journey stepper */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
              <h3 className="text-xs font-bold text-gray-900">Order journey</h3>

              <div className="space-y-3.5 relative pl-4 border-l-2 border-emerald-500">
                <div>
                  <div className="font-bold text-gray-900 flex items-center gap-1.5">
                    <span className="text-emerald-600">✓</span>
                    <span>Order received</span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    {new Date(selectedOrder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · WhatsApp order
                  </div>
                </div>

                <div>
                  <div className="font-bold text-gray-900 flex items-center gap-1.5">
                    <span className={selectedOrder.status !== "PENDING_PAYMENT" ? "text-emerald-600" : "text-amber-500"}>
                      {selectedOrder.status !== "PENDING_PAYMENT" ? "✓" : "○"}
                    </span>
                    <span>{selectedOrder.status !== "PENDING_PAYMENT" ? "Payment confirmed" : "Payment pending"}</span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    {selectedOrder.paidAt
                      ? `${new Date(selectedOrder.paidAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Verified gateway event`
                      : selectedOrder.status === "PAID"
                      ? "Verified gateway event"
                      : "Awaiting customer bank transfer"}
                  </div>
                </div>

                <div>
                  <div className={`font-semibold flex items-center gap-1.5 ${
                    selectedOrder.status === "OUT_FOR_DELIVERY" || selectedOrder.status === "FULFILLED"
                      ? "text-emerald-700 font-bold"
                      : "text-gray-700"
                  }`}>
                    <span className={selectedOrder.status === "OUT_FOR_DELIVERY" || selectedOrder.status === "FULFILLED" ? "text-emerald-600" : "text-gray-400"}>
                      {selectedOrder.status === "OUT_FOR_DELIVERY" || selectedOrder.status === "FULFILLED" ? "✓" : "○"}
                    </span>
                    <span>Out for delivery</span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    {selectedOrder.dispatchedAt
                      ? `${new Date(selectedOrder.dispatchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Dispatched${selectedOrder.riderPhone ? ` (${selectedOrder.riderPhone})` : ""}`
                      : selectedOrder.status === "OUT_FOR_DELIVERY"
                      ? `Dispatched${selectedOrder.riderPhone ? ` · Rider: ${selectedOrder.riderPhone}` : ""}`
                      : "Awaiting dispatch rider assignment"}
                  </div>
                </div>

                <div>
                  <div className={`font-semibold flex items-center gap-1.5 ${
                    selectedOrder.status === "FULFILLED" ? "text-emerald-700 font-bold" : "text-gray-400"
                  }`}>
                    <span>{selectedOrder.status === "FULFILLED" ? "✓" : "○"}</span>
                    <span>Delivered</span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    {selectedOrder.status === "FULFILLED" ? "Successfully completed" : "Pending delivery completion"}
                  </div>
                </div>
              </div>
            </div>

            {/* Customer & Delivery card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-900">Customer & Delivery</h3>
                <a
                  href={`/track/${selectedOrder.shortCode}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-semibold text-emerald-700 hover:underline"
                >
                  Open Live Tracker ↗
                </a>
              </div>
              <div>
                <div className="font-bold text-gray-900 text-sm">{selectedOrder.customerName}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  WhatsApp · {selectedOrder.customerPhone}
                </div>
                {selectedOrder.alternatePhone && (
                  <div className="text-[11px] text-emerald-800 font-semibold mt-0.5">
                    📞 Alternate / Gate Phone: {selectedOrder.alternatePhone}
                  </div>
                )}
              </div>
              <div className="pt-2 border-t border-gray-100 space-y-2">
                <div className="flex items-center justify-between text-gray-500">
                  <span>Zone:</span>
                  <span className="font-semibold text-gray-900">{selectedOrder.shippingZoneName || "Standard Delivery"}</span>
                </div>
                <div className="text-gray-500">
                  <span className="text-[11px] font-medium text-gray-700">Street Delivery Address:</span>
                  <div className={`mt-1 p-2.5 rounded-lg text-xs leading-relaxed ${
                    selectedOrder.deliveryAddress
                      ? "bg-emerald-50 text-emerald-950 border border-emerald-200 font-medium"
                      : "bg-amber-50 text-amber-900 border border-amber-200 italic"
                  }`}>
                    {selectedOrder.deliveryAddress
                      ? `🏠 ${selectedOrder.deliveryAddress}`
                      : "⏳ Awaiting buyer street address via WhatsApp or /track link"}
                  </div>
                </div>
                {selectedOrder.deliveryLandmark && (
                  <div className="text-gray-500">
                    <span className="text-[11px] font-medium text-gray-700">Prominent Landmark / Gate Directions:</span>
                    <div className="mt-1 p-2.5 rounded-lg text-xs leading-relaxed bg-blue-50 text-blue-950 border border-blue-200 font-medium">
                      🧭 {selectedOrder.deliveryLandmark}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Payment allocation card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
              <h3 className="text-xs font-bold text-gray-900">Payment allocation</h3>
              <div className="divide-y divide-gray-100">
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Gateway reference</span>
                  <span className="font-semibold text-gray-900 font-mono">
                    {selectedOrder.paymentTransactionRef || "GW-1042"}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Amount verified</span>
                  <span className="font-bold text-emerald-700">
                    {selectedOrder.amountPaidFormatted || selectedOrder.totalAmountFormatted}
                  </span>
                </div>
                {selectedOrder.status === "REFUNDED" && (
                  <div className="py-2 flex justify-between text-rose-700">
                    <span>Refunded ({selectedOrder.refundReference || "Processed"})</span>
                    <span className="font-bold">
                      -{selectedOrder.refundedAmountFormatted || selectedOrder.amountPaidFormatted}
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  if (onNavigateToPayments) {
                    onNavigateToPayments("detail", selectedOrder.shortCode);
                  }
                }}
                className="w-full py-2 border border-gray-300 hover:border-gray-500 hover:bg-gray-100 hover:text-gray-900 text-gray-700 text-xs font-semibold rounded-lg shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95"
              >
                View split transaction →
              </button>
            </div>
          </div>
        </div>

        {/* 1-Click Dispatch Rider Waybill / Packing Slip Modal */}
        {showPrintModal && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b pb-3">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    📦 Dispatch Rider Waybill & Packing Slip
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Print for package box or forward directly to dispatch rider on WhatsApp
                  </p>
                </div>
                <button onClick={() => setShowPrintModal(false)} className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer">
                  ✕
                </button>
              </div>
              <div className="font-mono text-xs space-y-2 text-gray-800 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="text-center font-bold text-sm">
                  {waybillData?.waybillNumber || `WB-${selectedOrder.shortCode}`} · CATERLOG WAYBILL
                </div>
                <div className="text-center text-[10px] text-gray-500">
                  {waybillData?.vendorName || "Nia Stores"} · Order #{selectedOrder.shortCode}
                </div>
                <div className="border-t border-dashed my-2" />
                <div>
                  <span className="font-bold">BUYER:</span> {selectedOrder.customerName}
                </div>
                <div>
                  <span className="font-bold">PRIMARY PHONE:</span> {selectedOrder.customerPhone}
                </div>
                {(waybillData?.alternatePhone || selectedOrder.alternatePhone) && (
                  <div>
                    <span className="font-bold">ALT / GATE PHONE:</span>{" "}
                    {waybillData?.alternatePhone || selectedOrder.alternatePhone}
                  </div>
                )}
                <div>
                  <span className="font-bold">ZONE:</span>{" "}
                  {selectedOrder.shippingZoneName || "Standard Delivery"}
                </div>
                <div>
                  <span className="font-bold">ADDRESS:</span>{" "}
                  {selectedOrder.deliveryAddress || "Pending buyer street address"}
                </div>
                {(waybillData?.deliveryLandmark || selectedOrder.deliveryLandmark) && (
                  <div>
                    <span className="font-bold">LANDMARK:</span>{" "}
                    {waybillData?.deliveryLandmark || selectedOrder.deliveryLandmark}
                  </div>
                )}
                <div className="border-t border-dashed my-2" />
                <div className="font-bold">ITEMS ({selectedOrder.quantity || 1} units):</div>
                {waybillData?.items && waybillData.items.length > 0 ? (
                  waybillData.items.map((it, idx) => (
                    <div key={idx}>
                      • {it.name} ({it.sku}) ×{it.quantity}
                    </div>
                  ))
                ) : (
                  <div>
                    • {selectedOrder.productName} ×{selectedOrder.quantity || 1}
                  </div>
                )}
                <div className="border-t border-dashed my-2" />
                <div className="p-2 rounded bg-emerald-100/80 text-center text-[11px] text-emerald-900 font-bold">
                  {waybillData?.paymentStamp ||
                    (selectedOrder.status === "PAID" ||
                    selectedOrder.status === "PROCESSING" ||
                    selectedOrder.status === "OUT_FOR_DELIVERY" ||
                    selectedOrder.status === "FULFILLED"
                      ? "✅ PAID IN ADVANCE — DO NOT COLLECT CASH FROM CUSTOMER"
                      : `⚠️ COLLECT ON DELIVERY / PENDING: ${selectedOrder.totalAmountFormatted}`)}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <a
                  href={`https://wa.me/${(selectedOrder.riderPhone || "").replace(/\D/g, "")}?text=${encodeURIComponent(
                    waybillData?.whatsappRiderText ||
                      `📦 *DISPATCH WAYBILL #WB-${selectedOrder.shortCode}*\n👤 *Buyer:* ${selectedOrder.customerName}\n📞 *Phone:* ${selectedOrder.customerPhone}${
                        selectedOrder.alternatePhone ? `\n📞 *Alt Phone:* ${selectedOrder.alternatePhone}` : ""
                      }\n🏠 *Address:* ${selectedOrder.deliveryAddress || selectedOrder.shippingZoneName || "Standard"}${
                        selectedOrder.deliveryLandmark ? `\n🧭 *Landmark:* ${selectedOrder.deliveryLandmark}` : ""
                      }\n🛍️ *Item:* ${selectedOrder.productName} ×${selectedOrder.quantity}\n💳 *Payment:* PAID IN ADVANCE — DO NOT COLLECT CASH`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg text-center shadow-2xs transition-all cursor-pointer"
                >
                  📲 Send Waybill to Rider on WhatsApp
                </a>
                <button
                  onClick={() => window.print()}
                  className="py-2.5 px-4 bg-gray-900 hover:bg-black text-white text-xs font-semibold rounded-lg shadow-2xs transition-all cursor-pointer active:scale-95"
                >
                  🖨️ Print Slip
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="px-4 py-2.5 border border-gray-300 hover:border-gray-500 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 1-Click Instant Refund Modal */}
        {showRefundModal && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b pb-3">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    ↩️ Issue Instant Refund · Order #{selectedOrder.shortCode}
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Reverses payment via Monnify, restores inventory stock, and sends buyer a WhatsApp refund receipt.
                  </p>
                </div>
                <button
                  onClick={() => setShowRefundModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-3.5 bg-rose-50/70 rounded-xl border border-rose-200 space-y-1.5 text-xs text-rose-950">
                <div className="flex justify-between">
                  <span className="text-rose-700">Customer:</span>
                  <span className="font-bold">{selectedOrder.customerName} ({selectedOrder.customerPhone})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-rose-700">Refund Amount:</span>
                  <span className="font-black text-sm">
                    {selectedOrder.amountPaidFormatted && selectedOrder.amountPaidFormatted !== "₦0"
                      ? selectedOrder.amountPaidFormatted
                      : selectedOrder.totalAmountFormatted}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-rose-700">Stock Action:</span>
                  <span className="font-semibold">+{selectedOrder.quantity} unit(s) restored to catalog</span>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <label className="block text-gray-700 font-semibold">
                  Reason for Refund (Sent to Buyer on WhatsApp)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Out of requested color / Buyer requested cancellation"
                  value={refundReasonInput}
                  onChange={(e) => setRefundReasonInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-rose-600 bg-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleRefundSubmit}
                  disabled={isRefunding}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg shadow-2xs transition-all cursor-pointer active:scale-95"
                >
                  {isRefunding ? "Processing Monnify Refund..." : "↩️ Confirm & Refund Customer Now"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRefundModal(false)}
                  className="px-4 py-2.5 border border-gray-300 hover:border-gray-500 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dispatch Order Modal */}
        {showDispatchModal && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b pb-3">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Dispatch Order #{selectedOrder.shortCode}</h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">Hand package over to dispatch courier</p>
                </div>
                <button
                  onClick={() => setShowDispatchModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl space-y-1.5 text-xs text-gray-700 border border-gray-100">
                <div className="flex justify-between">
                  <span className="text-gray-500">Customer:</span>
                  <span className="font-semibold text-gray-900">{selectedOrder.customerName} ({selectedOrder.customerPhone})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Item:</span>
                  <span className="font-semibold text-gray-900">{selectedOrder.productName} ×{selectedOrder.quantity || 1}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Delivery Address:</span>
                  <span className="font-semibold text-emerald-900 text-right max-w-[220px] truncate" title={selectedOrder.deliveryAddress || selectedOrder.shippingZoneName}>
                    {selectedOrder.deliveryAddress || selectedOrder.shippingZoneName || "Standard Delivery"}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <label className="block text-gray-700 font-semibold">
                  Dispatch Rider Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 08031234567"
                  value={riderPhoneInput}
                  onChange={(e) => setRiderPhoneInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-emerald-600 bg-white"
                />
                <p className="text-[11px] text-gray-500">
                  The buyer will immediately receive a WhatsApp message with package details and rider phone number.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleDispatchSubmit}
                  disabled={isDispatching}
                  className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <span>🚚</span>
                  <span>{isDispatching ? "Dispatching..." : "Confirm & Send WhatsApp Alert"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  className="px-4 py-2.5 border border-gray-300 hover:border-gray-500 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg shadow-2xs transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Shipbubble Multi-Courier Rate Shopping & Booking Modal */}
        {showShipbubbleModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl my-8">
              <div className="flex justify-between items-start border-b border-gray-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🚚</span>
                    <h3 className="font-bold text-gray-900 text-base">
                      Ship with Courier (Shipbubble) · Order #{selectedOrder.shortCode}
                    </h3>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {isPremiumTier ? "Pro Multi-Carrier & Manual Weight" : "Standard Preset"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Compare live Shipbubble courier rates, book official pickup, and generate the courier shipping receipt.
                  </p>
                </div>
                <button
                  onClick={() => setShowShipbubbleModal(false)}
                  className="text-gray-400 hover:text-gray-700 p-1 cursor-pointer text-sm"
                >
                  ✕
                </button>
              </div>

              {/* Delivery Address & Package Weight Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs">
                <div className="space-y-1.5">
                  <label className="block font-bold text-gray-700">
                    Customer Delivery Address
                  </label>
                  <input
                    type="text"
                    value={sbDeliveryAddress}
                    onChange={(e) => setSbDeliveryAddress(e.target.value)}
                    placeholder="e.g. 25 Allen Avenue, Ikeja, Lagos"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-xs text-gray-900 focus:outline-none focus:border-emerald-600"
                  />
                  <p className="text-[11px] text-gray-500">
                    Pickup:{" "}
                    <span className="font-semibold text-gray-700">
                      {vendor?.shipbubbleConfig?.pickupAddress || "14 Admiralty Way, Lekki Phase 1, Lagos"}
                    </span>
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-gray-700">
                      Package Weight &amp; Box
                    </label>
                    {!isPremiumTier && (
                      <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                        Manual kg: Premium Only
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: "SMALL_BAG" as const, label: "Small Bag", sub: "0.5 kg" },
                      { id: "SHOEBOX" as const, label: "Shoebox", sub: "1.5 kg" },
                      { id: "CARTON" as const, label: "Carton", sub: "5.0 kg" },
                    ].map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setSbWeightPreset(preset.id);
                          void fetchShipbubbleQuotes(selectedOrder.shortCode, sbDeliveryAddress, preset.id);
                        }}
                        className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                          sbWeightPreset === preset.id
                            ? "border-emerald-600 bg-emerald-50/70 text-emerald-950 font-bold"
                            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                        }`}
                      >
                        <div className="text-[11px] font-bold">{preset.label}</div>
                        <div className="text-[10px] text-gray-500">{preset.sub}</div>
                      </button>
                    ))}
                  </div>

                  {isPremiumTier ? (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setSbWeightPreset("CUSTOM")}
                        className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                          sbWeightPreset === "CUSTOM"
                            ? "border-indigo-600 bg-indigo-50 text-indigo-900"
                            : "border-gray-200 bg-white text-gray-700"
                        }`}
                      >
                        Manual Weight (kg):
                      </button>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="100"
                        value={sbCustomWeightKg}
                        onChange={(e) => {
                          setSbCustomWeightKg(e.target.value);
                          setSbWeightPreset("CUSTOM");
                        }}
                        className="w-24 px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white text-xs font-mono font-bold text-gray-900"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          void fetchShipbubbleQuotes(
                            selectedOrder.shortCode,
                            sbDeliveryAddress,
                            sbWeightPreset,
                            Number(sbCustomWeightKg) || 1.5
                          )
                        }
                        className="px-2.5 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-[11px] font-semibold cursor-pointer"
                      >
                        Refresh Quotes
                      </button>
                    </div>
                  ) : (
                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          void fetchShipbubbleQuotes(
                            selectedOrder.shortCode,
                            sbDeliveryAddress,
                            sbWeightPreset
                          )
                        }
                        className="px-2.5 py-1 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-[11px] font-semibold cursor-pointer"
                      >
                        Refresh Quotes
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {sbRatesError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {sbRatesError}
                </div>
              )}

              {/* Courier Rate Cards */}
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {sbFetchingRates ? (
                  <div className="py-10 text-center space-y-2">
                    <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <div className="text-xs font-semibold text-gray-700">
                      Fetching live multi-courier quotes from Shipbubble...
                    </div>
                  </div>
                ) : sbCouriers.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-500">
                    No courier quotes loaded yet. Click Refresh Quotes above.
                  </div>
                ) : (
                  sbCouriers.map((c) => {
                    const isSelected =
                      sbSelectedCourier?.courier_id === c.courier_id &&
                      sbSelectedCourier?.service_code === c.service_code;
                    const isCheapest = sbCheapestId === c.courier_id;
                    const isFastest = sbFastestId === c.courier_id;
                    return (
                      <div
                        key={`${c.courier_id}-${c.service_code}`}
                        onClick={() => setSbSelectedCourier(c)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? "border-2 border-emerald-600 bg-emerald-50/40 shadow-2xs"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-base font-bold text-gray-700">
                            🚚
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-bold text-gray-900">
                                {c.courier_name}
                              </span>
                              {isCheapest && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900">
                                  Cheapest
                                </span>
                              )}
                              {isFastest && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900">
                                  Fastest
                                </span>
                              )}
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 uppercase">
                                {c.service_type}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-500 mt-0.5">
                              Pickup: {c.pickup_eta} · Delivery:{" "}
                              <span className="font-semibold text-gray-700">{c.delivery_eta}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-black text-gray-900">
                            ₦{Math.round(c.total).toLocaleString()}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            incl. ₦{Math.round(c.vat || 0)} VAT
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100">
                <div className="text-[11px] text-gray-500">
                  {sbSelectedCourier ? (
                    <>
                      Selected:{" "}
                      <span className="font-bold text-gray-900">
                        {sbSelectedCourier.courier_name} (₦
                        {Math.round(sbSelectedCourier.total).toLocaleString()})
                      </span>
                    </>
                  ) : (
                    "Select a courier above to generate shipment label & receipt"
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowShipbubbleModal(false)}
                    className="px-4 py-2.5 border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={sbBooking || !sbSelectedCourier}
                    onClick={handleBookShipbubbleCourier}
                    className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <span>🧾</span>
                    <span>
                      {sbBooking
                        ? "Booking & Generating Receipt..."
                        : "Book Courier & Get Official Receipt"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Official Shipping Courier Receipt Modal */}
        {showCourierReceiptModal && activeCourierReceipt && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl my-8 border border-gray-200">
              <div className="flex items-start justify-between border-b-2 border-dashed border-gray-200 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded bg-emerald-900 text-white">
                      Official Courier Receipt
                    </span>
                    <span className="text-xs font-mono font-bold text-gray-700">
                      {activeCourierReceipt.receiptNumber}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-gray-900 mt-1.5">
                    {activeCourierReceipt.courierName}
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    Issued via Shipbubble Logistics ·{" "}
                    {new Date(activeCourierReceipt.bookedAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => setShowCourierReceiptModal(false)}
                  className="text-gray-400 hover:text-gray-700 p-1 cursor-pointer text-sm"
                >
                  ✕
                </button>
              </div>

              {/* Waybill & Status Banner */}
              <div className="p-3.5 rounded-xl bg-gray-900 text-white flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-400">
                    Carrier Waybill / Tracking Code
                  </div>
                  <div className="text-base font-mono font-black tracking-wide text-emerald-400">
                    {activeCourierReceipt.trackingCode}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-gray-400">
                    Courier Payment Status
                  </div>
                  <div className="text-xs font-bold text-emerald-300 uppercase">
                    ✓ PAID ({activeCourierReceipt.paymentType}) · ₦
                    {activeCourierReceipt.shippingFeeNaira.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Sender & Receiver Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 space-y-1">
                  <div className="text-[10px] font-bold uppercase text-gray-400">
                    📤 Ship From (Sender)
                  </div>
                  <div className="font-bold text-gray-900">{activeCourierReceipt.shipFrom.name}</div>
                  <div className="text-gray-600">{activeCourierReceipt.shipFrom.phone}</div>
                  <div className="text-[11px] text-gray-500 leading-snug">
                    {activeCourierReceipt.shipFrom.address}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-1">
                  <div className="text-[10px] font-bold uppercase text-emerald-700">
                    📥 Ship To (Receiver)
                  </div>
                  <div className="font-bold text-gray-900">{activeCourierReceipt.shipTo.name}</div>
                  <div className="text-gray-600">{activeCourierReceipt.shipTo.phone}</div>
                  <div className="text-[11px] text-gray-700 leading-snug">
                    {activeCourierReceipt.shipTo.address}
                  </div>
                </div>
              </div>

              {/* Package Manifest & Financial Breakdown */}
              <div className="border border-gray-200 rounded-xl overflow-hidden text-xs">
                <div className="bg-gray-50 px-3.5 py-2 border-b border-gray-200 font-bold text-gray-800 flex justify-between">
                  <span>Package Manifest (#{selectedOrder.shortCode})</span>
                  <span>
                    {activeCourierReceipt.packageWeightKg} kg ·{" "}
                    {activeCourierReceipt.boxName || "Small Box"}
                  </span>
                </div>
                <div className="p-3.5 space-y-2 divide-y divide-gray-100">
                  {activeCourierReceipt.items.map((item, i) => (
                    <div key={i} className="pt-1.5 first:pt-0 flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-gray-900">
                          {item.name} ×{item.quantity}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          Weight: {item.weight} kg · Declared Value: ₦{item.amount.toLocaleString()}
                        </div>
                      </div>
                      <div className="font-mono font-semibold text-gray-800">
                        ₦{item.total.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-gray-50 px-3.5 py-2.5 border-t border-gray-200 space-y-1">
                  <div className="flex justify-between text-[11px] text-gray-500">
                    <span>Courier Service ({activeCourierReceipt.serviceType.toUpperCase()}):</span>
                    <span>
                      ₦
                      {Math.max(
                        0,
                        activeCourierReceipt.shippingFeeNaira - (activeCourierReceipt.vatNaira || 0)
                      ).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-gray-500">
                    <span>VAT:</span>
                    <span>₦{(activeCourierReceipt.vatNaira || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs font-black text-gray-900 pt-1 border-t border-gray-200">
                    <span>Total Courier Shipping Fee Paid:</span>
                    <span className="text-emerald-700">
                      ₦{activeCourierReceipt.shippingFeeNaira.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-gray-500 flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                <span>
                  Delivery ETA:{" "}
                  <strong className="text-gray-800">
                    {activeCourierReceipt.deliveryEta || "Within 24 - 48 hrs"}
                  </strong>
                </span>
                <a
                  href={activeCourierReceipt.trackingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-700 font-bold hover:underline"
                >
                  Open Live Shipbubble Tracker ↗
                </a>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-2 border border-gray-300 hover:bg-gray-100 text-gray-800 text-xs font-semibold rounded-xl cursor-pointer flex items-center gap-1.5"
                >
                  <span>🖨️</span>
                  <span>Print Courier Receipt</span>
                </button>
                <a
                  href={`https://wa.me/${selectedOrder.customerPhone.replace(/\+/g, "")}?text=${encodeURIComponent(
                    `🧾 OFFICIAL COURIER RECEIPT (${activeCourierReceipt.receiptNumber})\nCourier: ${activeCourierReceipt.courierName}\nWaybill ID: ${activeCourierReceipt.trackingCode}\nOrder: #${selectedOrder.shortCode}\nFee Paid: ₦${activeCourierReceipt.shippingFeeNaira.toLocaleString()}\nTrack Live: ${activeCourierReceipt.trackingUrl}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5"
                >
                  <span>💬</span>
                  <span>Share Receipt on WhatsApp ↗</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* Screen: Orders List Table                                                  */
  /* -------------------------------------------------------------------------- */
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage and track your business sales and fulfillment.</p>
        </div>
        <div data-tour="orders-header-actions" className="flex items-center gap-2 self-start sm:self-center">
          {onOpenTour && (
            <button
              onClick={onOpenTour}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-emerald-950 shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95"
              title="Learn how Orders, Waybills &amp; Monnify Escrow work"
            >
              <span>🧭</span>
              <span className="hidden sm:inline">Orders Guide</span>
              <span className="sm:hidden">Guide</span>
            </button>
          )}
          <button
            onClick={() => setShowFilterModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-gray-300 hover:border-gray-500 hover:bg-gray-100 text-gray-700 hover:text-gray-900 shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <FilterIcon className="w-3.5 h-3.5 text-gray-500" />
            <span>Filter</span>
          </button>
          <button
            onClick={handleExportOrders}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-gray-300 hover:border-gray-500 hover:bg-gray-100 text-gray-700 hover:text-gray-900 shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <ExportIcon className="w-3.5 h-3.5 text-gray-500" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Status Tabs */}
      <div data-tour="orders-status-tabs" className="border-b border-gray-200 flex gap-6 text-sm font-semibold text-gray-500 overflow-x-auto scrollbar-none">
        {[
          { id: "ALL", label: `All (${counts.ALL})` },
          { id: "PENDING_PAYMENT", label: `Pending (${counts.PENDING_PAYMENT})` },
          { id: "PAID", label: `Paid (${counts.PAID})` },
          { id: "PROCESSING", label: `Processing (${counts.PROCESSING})` },
          { id: "OUT_FOR_DELIVERY", label: `Fulfilled / Shipped (${counts.OUT_FOR_DELIVERY})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`pb-3 border-b-2 font-medium transition-all whitespace-nowrap cursor-pointer active:scale-95 ${
              statusFilter === tab.id
                ? "border-emerald-600 text-emerald-600 font-bold"
                : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search by order code, customer name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm px-3.5 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-600 bg-white"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Clear
          </button>
        )}
      </div>

      {/* Orders Content: Dedicated Clean Account Guide vs Table */}
      {orders.length === 0 ? (
        <EmptyState
          badge="Orders & Settlements"
          icon="🛍️"
          title="No Orders Placed Yet"
          description="When customers send inquiries to your WhatsApp Business number or checkout with your store link, Caterlog will handle stock reservations, invoice delivery, and bank transfer reconciliation automatically."
        >
          <div className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-left pt-2">
            <div className="p-4 rounded-2xl bg-gray-50/80 border border-gray-100 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                1. Inbound Chat
              </span>
              <p className="text-xs font-semibold text-gray-900">Buyer chats WhatsApp</p>
              <p className="text-[11px] text-gray-400 leading-normal">
                Buyer inquires about product stock or replies to your WhatsApp status.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-gray-50/80 border border-gray-100 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                2. Instant NUBAN
              </span>
              <p className="text-xs font-semibold text-gray-900">Co-Pilot sends invoice</p>
              <p className="text-[11px] text-gray-400 leading-normal">
                AI locks stock for 15 mins and sends dedicated Monnify NUBAN transfer account.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-gray-50/80 border border-gray-100 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                3. Auto Verified
              </span>
              <p className="text-xs font-semibold text-gray-900">Order appears here</p>
              <p className="text-[11px] text-gray-400 leading-normal">
                Payment reconciles via server webhook; live order streams to this table.
              </p>
            </div>
          </div>
        </EmptyState>
      ) : (
        <div data-tour="orders-table-wrapper" className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[680px]">
              <thead className="bg-gray-50/70 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-5">Order ID</th>
                  <th className="py-3.5 px-5">Customer</th>
                  <th className="py-3.5 px-5">Product</th>
                  <th className="py-3.5 px-5">Amount</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-400">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 text-lg font-bold">
                          🛒
                        </div>
                        <p className="text-sm font-bold text-gray-900">No matching orders found</p>
                        <p className="text-xs text-gray-400 mt-1 max-w-sm">
                          No orders match your selected filter criteria.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((o) => (
                    <tr
                      key={o.id}
                      onClick={() => onSelectOrder(o)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-5">
                        <span className="font-mono font-bold text-gray-900">{o.shortCode}</span>
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-gray-900">{o.customerName}</div>
                        <div className="text-[11px] text-gray-400">{o.customerPhone}</div>
                        {o.deliveryAddress ? (
                          <div className="text-[11px] text-emerald-800 font-medium truncate max-w-[220px]" title={o.deliveryAddress}>
                            📍 {o.deliveryAddress}
                          </div>
                        ) : (
                          <div className="text-[10px] text-gray-400">
                            🚚 {o.shippingZoneName || "Zone"}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="font-medium text-gray-900">{o.productName}</div>
                        {o.variantName ? (
                          <div className="text-[11px] font-semibold text-emerald-700">
                            {o.variantName} {o.variantSku ? `(${o.variantSku})` : ""} · {o.quantity} unit(s)
                          </div>
                        ) : o.items && o.items.length > 1 ? (
                          <div className="text-[11px] font-medium text-emerald-700">
                            🛒 {o.items.length} cart items · {o.quantity} unit(s) total
                          </div>
                        ) : (
                          <div className="text-[11px] text-gray-400">{o.quantity} unit(s)</div>
                        )}
                      </td>
                      <td className="py-3.5 px-5 font-bold text-gray-900">
                        {o.totalAmountFormatted || `₦${o.totalAmountNaira.toLocaleString()}`}
                      </td>
                      <td className="py-3.5 px-5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            o.status === "PAID"
                              ? "bg-emerald-100 text-emerald-800"
                              : o.status === "PENDING_PAYMENT"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectOrder(o);
                          }}
                          className="px-3 py-1 border border-gray-300 hover:border-emerald-600 hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 text-xs font-semibold rounded-lg shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95"
                        >
                          View detail →
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

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-gray-900 text-sm">Filter Orders</h3>
              <button onClick={() => setShowFilterModal(false)} className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer">
                ✕
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-500 font-semibold mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-white cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PAID">Paid</option>
                  <option value="PENDING_PAYMENT">Pending</option>
                  <option value="PROCESSING">Processing</option>
                  <option value="OUT_FOR_DELIVERY">Fulfilled / Shipped</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setStatusFilter("ALL");
                  setSearch("");
                  setShowFilterModal(false);
                }}
                className="flex-1 py-2 border border-gray-300 hover:border-gray-500 hover:bg-gray-100 hover:text-gray-900 text-gray-700 text-xs font-semibold rounded-lg shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95"
              >
                Reset
              </button>
              <button
                onClick={() => setShowFilterModal(false)}
                className="flex-1 py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold rounded-lg shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
