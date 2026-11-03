"use client";

import React, { useState } from "react";
import type { OrderItem } from "@/lib/types";
import { FilterIcon, ExportIcon } from "../icons";

interface OrdersViewProps {
  orders: OrderItem[];
  selectedOrder: OrderItem | null;
  onSelectOrder: (order: OrderItem | null) => void;
  onSimulateTransfer?: (orderCode: string, amountNaira: number) => Promise<void>;
  onMarkDispatched?: (orderCode: string) => Promise<void>;
  onNavigateToPayments?: (tab?: string, subId?: string) => void;
  onNavigateToSettings?: (tab?: string, subId?: string) => void;
}

export function OrdersView({
  orders,
  selectedOrder,
  onSelectOrder,
  onSimulateTransfer,
  onMarkDispatched,
  onNavigateToPayments,
  onNavigateToSettings,
}: OrdersViewProps) {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [supplierStatus, setSupplierStatus] = useState("Preparing · Not yet dispatched");
  const [supplierRequested, setSupplierRequested] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);

  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        o.shortCode.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.productName.toLowerCase().includes(q) ||
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
    OUT_FOR_DELIVERY: orders.filter((o) => o.status === "OUT_FOR_DELIVERY").length,
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
              3 Nov 2026, 10:14 WAT · Sold by Nia Stores
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Paid · server confirmed
              </span>
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                  supplierStatus.includes("Ready")
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-amber-50 text-amber-800 border-amber-200"
                }`}
              >
                {supplierStatus.includes("Ready") ? "Ready for pickup" : "Preparing for pickup"}
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                WhatsApp order
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={() => setShowPrintModal(true)}
              className="px-3.5 py-1.5 border border-gray-300 hover:border-gray-500 hover:bg-gray-100 text-gray-700 hover:text-gray-900 text-xs font-semibold rounded-lg shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95"
            >
              Print slip
            </button>
            <button
              onClick={() => {
                if (onNavigateToPayments) {
                  onNavigateToPayments("detail", selectedOrder.shortCode);
                }
              }}
              className="px-3.5 py-1.5 border border-rose-300 hover:border-rose-500 hover:bg-rose-50 text-rose-700 text-xs font-semibold rounded-lg shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95"
            >
              Review refund
            </button>
          </div>
        </div>

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
                    <tr>
                      <td className="px-4 py-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-lg">
                          🧴
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">
                            {selectedOrder.productName || "Stainless flask"}
                          </div>
                          <div className="text-[11px] text-gray-400">750ml · AW-FL750</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium">₦10,000</td>
                      <td className="px-4 py-3 font-medium">{selectedOrder.quantity || 2}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">
                        {selectedOrder.totalAmountFormatted || `₦${selectedOrder.totalAmountNaira.toLocaleString()}`}
                      </td>
                    </tr>
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
                  <span className="font-semibold text-gray-900">₦0 · Pickup</span>
                </div>
                <div className="py-2.5 flex justify-between text-sm font-bold text-gray-900">
                  <span>Customer paid</span>
                  <span>{selectedOrder.totalAmountFormatted || `₦${selectedOrder.totalAmountNaira.toLocaleString()}`}</span>
                </div>
              </div>
            </div>

            {/* Supplier fulfillment card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Supplier fulfillment</h3>
                <p className="text-[11px] text-gray-400">Responsibility: Aroko Wholesale</p>
              </div>

              <div className="divide-y divide-gray-100">
                <div className="py-2.5 flex justify-between">
                  <span className="text-gray-500">Shared stock</span>
                  <span className="font-semibold text-gray-900">2 units deducted at confirmation</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-gray-500">Master stock remaining</span>
                  <span className="font-semibold text-gray-900">42 units · Synced</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-gray-500">Pickup location</span>
                  <span className="font-semibold text-gray-900">Ikeja · Address in pickup note</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-gray-500">Fulfillment state</span>
                  <span
                    className={`font-semibold ${
                      supplierStatus.includes("Ready") ? "text-emerald-700" : "text-amber-800"
                    }`}
                  >
                    {supplierStatus}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-xl space-y-1">
                <div className="font-bold text-blue-900 flex items-center gap-1.5">
                  <span>ℹ</span>
                  <span>Awaiting supplier pickup confirmation</span>
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  Aroko is preparing this order. Nia manages customer communication. No delivery time has been promised.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={handleRequestSupplierUpdate}
                  disabled={supplierRequested}
                  className="px-4 py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] disabled:opacity-75 text-white text-xs font-semibold rounded-lg shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95"
                >
                  {supplierRequested ? "✓ Update Dispatched to Aroko" : "Request supplier update"}
                </button>
                <a
                  href={`https://wa.me/${selectedOrder.customerPhone.replace(/\+/g, "")}?text=${encodeURIComponent(
                    `Hello ${selectedOrder.customerName}, regarding your Order ${selectedOrder.shortCode}: It is currently being prepared for pickup at our Ikeja center!`
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
                <p className="text-[11px] text-gray-400">WhatsApp · Thread WA-0882 · Sales co-pilot</p>
              </div>

              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
                <div className="font-semibold text-gray-900 text-xs">Oluchi Adeyemi · 10:14</div>
                <p className="text-gray-700 leading-relaxed">
                  &ldquo;I&apos;d like two of the 750ml flasks for pickup. Please send the payment link.&rdquo;
                </p>
                <div className="text-[10px] text-emerald-700 font-medium pt-1">Converted from chat</div>
              </div>

              <button
                onClick={() => {
                  if (onNavigateToSettings) {
                    onNavigateToSettings("detail", "WA-0882");
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
                  <div className="text-[11px] text-gray-400 mt-0.5">3 Nov · 10:14 WAT</div>
                </div>

                <div>
                  <div className="font-bold text-gray-900 flex items-center gap-1.5">
                    <span className="text-emerald-600">✓</span>
                    <span>Payment confirmed</span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">10:18 · Verified gateway event</div>
                </div>

                <div>
                  <div className="font-bold text-gray-900 flex items-center gap-1.5">
                    <span className="text-emerald-600">✓</span>
                    <span>Supplier preparing</span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">10:24 · Aroko update</div>
                </div>

                <div>
                  <div
                    className={`font-semibold flex items-center gap-1.5 ${
                      supplierStatus.includes("Ready") ? "text-emerald-700 font-bold" : "text-gray-700 opacity-60"
                    }`}
                  >
                    <span>{supplierStatus.includes("Ready") ? "✓" : "○"}</span>
                    <span>Ready for pickup</span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    {supplierStatus.includes("Ready") ? "Ready at Ikeja fulfillment station" : "Awaiting supplier confirmation"}
                  </div>
                </div>

                <div className="opacity-40">
                  <div className="font-medium text-gray-700 flex items-center gap-1.5">
                    <span>○</span>
                    <span>Collected</span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">Not completed</div>
                </div>
              </div>
            </div>

            {/* Customer card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-3 text-xs">
              <h3 className="text-xs font-bold text-gray-900">Customer</h3>
              <div>
                <div className="font-bold text-gray-900 text-sm">{selectedOrder.customerName}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  WhatsApp · {selectedOrder.customerPhone}
                </div>
              </div>
              <div className="text-[11px] text-gray-500 pt-1">
                Pickup selected · No delivery charge
              </div>
            </div>

            {/* Payment allocation card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-xs">
              <h3 className="text-xs font-bold text-gray-900">Payment allocation</h3>
              <div className="divide-y divide-gray-100">
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Gateway reference</span>
                  <span className="font-semibold text-gray-900">GW-1042</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Supplier</span>
                  <span className="font-semibold text-gray-900">₦16,000</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Gross rep margin</span>
                  <span className="font-semibold text-gray-900">₦4,000</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Fee · Nia pays</span>
                  <span className="font-semibold text-rose-600">-₦300</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-500">Net rep earnings</span>
                  <span className="font-bold text-emerald-700 text-sm">₦3,700</span>
                </div>
              </div>

              <div className="p-2.5 bg-amber-50 text-amber-800 text-[11px] font-semibold rounded-lg text-center">
                Recipient payout needs attention
              </div>

              <button
                onClick={() => {
                  if (onNavigateToPayments) {
                    onNavigateToPayments("detail", "CT-1042");
                  }
                }}
                className="w-full py-2 border border-gray-300 hover:border-gray-500 hover:bg-gray-100 hover:text-gray-900 text-gray-700 text-xs font-semibold rounded-lg shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95"
              >
                View split transaction →
              </button>
            </div>
          </div>
        </div>

        {/* Printable Slip Modal */}
        {showPrintModal && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-gray-900 text-sm">Fulfillment Pickup Slip</h3>
                <button onClick={() => setShowPrintModal(false)} className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer">
                  ✕
                </button>
              </div>
              <div className="font-mono text-xs space-y-2 text-gray-800 p-4 bg-gray-50 rounded-xl">
                <div className="text-center font-bold text-sm">CATERLOG FULFILLMENT SLIP</div>
                <div className="text-center text-[10px] text-gray-500">Nia Stores × Aroko Wholesale</div>
                <div className="border-t border-dashed my-2" />
                <div>ORDER: {selectedOrder.shortCode}</div>
                <div>CUSTOMER: {selectedOrder.customerName} ({selectedOrder.customerPhone})</div>
                <div>ITEM: {selectedOrder.productName} (AW-FL750)</div>
                <div>QTY: {selectedOrder.quantity || 2} UNITS</div>
                <div>TOTAL PAID: {selectedOrder.totalAmountFormatted}</div>
                <div>NUBAN REF: {selectedOrder.accountNumber} ({selectedOrder.bankName})</div>
                <div className="border-t border-dashed my-2" />
                <div className="text-center text-[10px] text-emerald-800 font-bold">✓ PAYMENT SERVER VERIFIED · READY FOR PICKUP</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold rounded-lg shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95"
                >
                  Print Slip
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="px-4 py-2 border border-gray-300 hover:border-gray-500 hover:bg-gray-100 hover:text-gray-900 text-gray-700 text-xs font-semibold rounded-lg shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95"
                >
                  Close
                </button>
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
        <div className="flex items-center gap-2 self-start sm:self-center">
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
      <div className="border-b border-gray-200 flex gap-6 text-sm font-semibold text-gray-500 overflow-x-auto scrollbar-none">
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

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
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
                  <td colSpan={6} className="py-8 text-center text-gray-400">
                    No orders match your filter criteria.
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
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="font-medium text-gray-900">{o.productName}</div>
                      <div className="text-[11px] text-gray-400">{o.quantity} unit(s)</div>
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
