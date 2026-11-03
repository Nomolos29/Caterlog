"use client";

import React, { useState } from "react";
import type { OrderItem } from "@/lib/types";
import { FilterIcon, ExportIcon, WhatsAppBadgeIcon, CheckIcon } from "../icons";

interface OrdersViewProps {
  orders: OrderItem[];
  selectedOrder: OrderItem | null;
  onSelectOrder: (order: OrderItem | null) => void;
  onSimulateTransfer?: (orderCode: string, amountNaira: number) => Promise<void>;
  onMarkDispatched?: (orderCode: string) => Promise<void>;
  onNavigateToPayments?: () => void;
}

export function OrdersView({
  orders,
  selectedOrder,
  onSelectOrder,
  onSimulateTransfer,
  onMarkDispatched,
  onNavigateToPayments,
}: OrdersViewProps) {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [supplierRequested, setSupplierRequested] = useState(false);

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

  /* -------------------------------------------------------------------------- */
  /* Screen 10: Orders · Reseller order fulfillment (Order Detail CT-1042)      */
  /* -------------------------------------------------------------------------- */
  if (selectedOrder) {
    const isCT1042 = selectedOrder.shortCode === "CT-1042" || selectedOrder.shortCode.includes("1042");

    return (
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
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
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Paid · server confirmed
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                Preparing for pickup
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                WhatsApp order
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3.5 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg shadow-xs"
            >
              Print slip
            </button>
            <button
              onClick={() => {
                if (onNavigateToPayments) onNavigateToPayments();
                else alert("Navigating to Refund review in Payments tab");
              }}
              className="px-3.5 py-1.5 border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-semibold rounded-lg shadow-xs"
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
                  <span className="font-semibold text-amber-800">Preparing · Not yet dispatched</span>
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

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    setSupplierRequested(true);
                    setTimeout(() => setSupplierRequested(false), 2500);
                  }}
                  className="px-4 py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  {supplierRequested ? "✓ Update Requested" : "Request supplier update"}
                </button>
                <a
                  href={`https://wa.me/${selectedOrder.customerPhone.replace(/\+/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg"
                >
                  Message customer
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
                onClick={() => alert("Navigating to Settings / Sales co-pilot / WA-0882")}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-medium block pt-1"
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
                    <span className="text-amber-600">●</span>
                    <span>Supplier preparing</span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">10:24 · Aroko update</div>
                </div>

                <div className="opacity-60">
                  <div className="font-medium text-gray-700 flex items-center gap-1.5">
                    <span>○</span>
                    <span>Ready for pickup</span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">Awaiting supplier confirmation</div>
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
                  if (onNavigateToPayments) onNavigateToPayments();
                  else alert("Viewing split transaction CT-1042 in Payments tab");
                }}
                className="w-full py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg"
              >
                View split transaction →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* Screen: Orders List Table                                                  */
  /* -------------------------------------------------------------------------- */
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage and track your business sales and fulfillment.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-xs">
            <FilterIcon className="w-3.5 h-3.5 text-gray-500" />
            <span>Filter</span>
          </button>
          <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-xs">
            <ExportIcon className="w-3.5 h-3.5 text-gray-500" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="border-b border-gray-200 flex gap-6 text-sm font-semibold text-gray-500 overflow-x-auto">
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
            className={`pb-3 border-b-2 font-medium transition-all whitespace-nowrap ${
              statusFilter === tab.id
                ? "border-emerald-600 text-emerald-600 font-bold"
                : "border-transparent text-gray-500 hover:text-gray-900"
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
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
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
              {filteredOrders.map((o) => (
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
                      className="px-3 py-1 border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-medium rounded-lg"
                    >
                      View detail →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
