import React, { useState } from "react";
import type { VendorAnalytics, OrderItem, VendorProfile } from "@/lib/types";
import { ClockIcon, CheckIcon, WhatsAppBadgeIcon } from "../icons";

interface OverviewViewProps {
  analytics: VendorAnalytics;
  vendor: VendorProfile;
  orders: OrderItem[];
  onSelectOrder?: (order: OrderItem) => void;
  onViewAllOrders?: () => void;
  onNavigateToPayments?: () => void;
  onFilterOrdersByStatus?: (status: "PENDING" | "PAID" | "PROCESSING") => void;
}

export function OverviewView({
  analytics,
  vendor,
  orders,
  onSelectOrder,
  onViewAllOrders,
  onNavigateToPayments,
  onFilterOrdersByStatus,
}: OverviewViewProps) {
  const [period, setPeriod] = useState<"7D" | "30D" | "1Y">("30D");

  // Derive counts based on orders
  const pendingOrders = orders.filter((o) => o.status === "PENDING_PAYMENT" || o.status === "PARTIALLY_PAID");
  const paidOrders = orders.filter((o) => o.status === "PAID");
  const processingOrders = orders.filter((o) => o.status === "PROCESSING" || o.status === "OUT_FOR_DELIVERY");

  // Needs Attention: Unpaid or recently active pending orders
  const needsAttention = pendingOrders.slice(0, 5);

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
            Good morning, {vendor.businessName}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Here&apos;s what&apos;s happening with your business today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onViewAllOrders}
            className="text-xs font-semibold px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors shadow-2xs"
          >
            Manage Orders
          </button>
          <button
            onClick={onNavigateToPayments}
            className="text-xs font-semibold px-3.5 py-2 rounded-xl bg-[#0d5c3a] text-white hover:bg-[#0b4b2f] transition-colors shadow-2xs"
          >
            View Settlements
          </button>
        </div>
      </div>

      {/* Onboarding Checklist for newly connected WhatsApp Business account */}
      {orders.length === 0 && (
        <div className="bg-gradient-to-r from-emerald-950 via-[#0d5c3a] to-emerald-900 text-white rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-800/80 text-emerald-200 text-xs font-semibold mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>WhatsApp Business Connected: {vendor.whatsappPhone || "+234 Active"}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold">Welcome to Caterlog, {vendor.businessName}!</h2>
              <p className="text-xs sm:text-sm text-emerald-100/90 mt-1 max-w-xl">
                Your store and AI Sales Co-Pilot are ready. Complete these setup steps to start receiving automated orders and verified Monnify bank transfers.
              </p>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-3xl font-black text-emerald-300">1/3</span>
              <div className="text-[11px] text-emerald-200 uppercase tracking-wider font-bold">Setup Completed</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* Step 1: WhatsApp Connected */}
            <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-4 border border-white/15 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Step 1 · Ready</span>
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">✓</span>
              </div>
              <div className="font-bold text-sm text-white">WhatsApp Connected</div>
              <p className="text-xs text-emerald-100/80">
                Coexistence engine connected. Co-Pilot is listening for buyer inquiries.
              </p>
            </div>

            {/* Step 2: Add Products */}
            <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-4 border border-white/15 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">Step 2 · Action Required</span>
                <span className="w-5 h-5 rounded-full bg-amber-400 text-gray-900 flex items-center justify-center text-xs font-bold">2</span>
              </div>
              <div className="font-bold text-sm text-white">Add Store Products</div>
              <p className="text-xs text-emerald-100/80">
                Add items with prices and stock so Co-Pilot knows what to sell.
              </p>
            </div>

            {/* Step 3: Test Co-Pilot */}
            <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-4 border border-white/15 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-200/70 uppercase tracking-wider">Step 3 · Verification</span>
                <span className="w-5 h-5 rounded-full bg-white/20 text-white flex items-center justify-center text-xs font-bold">3</span>
              </div>
              <div className="font-bold text-sm text-white">Test WhatsApp Checkout</div>
              <p className="text-xs text-emerald-100/80">
                Message your WhatsApp number to test instant stock check &amp; NUBAN invoice.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4 Top KPI Metric Cards (Interactive) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* TOTAL REVENUE */}
        <div
          onClick={onNavigateToPayments}
          className="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs flex flex-col justify-between cursor-pointer hover:border-emerald-300 hover:shadow-xs transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 group-hover:text-emerald-700 transition-colors">
              Total Revenue
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm group-hover:scale-105 transition-transform">
              ₦
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-gray-900">{analytics.paidGrossFormatted}</div>
            {orders.length === 0 ? (
              <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400 font-normal">
                <span>Awaiting first customer payment</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-1 text-xs font-semibold text-emerald-600">
                <span>↑ 12%</span>
                <span className="text-gray-400 font-normal">vs last 30 days</span>
              </div>
            )}
          </div>
        </div>

        {/* PENDING */}
        <div
          onClick={() => {
            if (onFilterOrdersByStatus) onFilterOrdersByStatus("PENDING");
            else if (onViewAllOrders) onViewAllOrders();
          }}
          className="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs flex flex-col justify-between cursor-pointer hover:border-amber-300 hover:shadow-xs transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 group-hover:text-amber-700 transition-colors">
              Pending
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <ClockIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-gray-900">{analytics.pendingOrdersCount}</div>
            <div className="text-xs text-gray-500 mt-1">Awaiting confirmation</div>
          </div>
        </div>

        {/* PAID */}
        <div
          onClick={() => {
            if (onFilterOrdersByStatus) onFilterOrdersByStatus("PAID");
            else if (onViewAllOrders) onViewAllOrders();
          }}
          className="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs flex flex-col justify-between cursor-pointer hover:border-emerald-300 hover:shadow-xs transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 group-hover:text-emerald-700 transition-colors">
              Paid
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <CheckIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-gray-900">{analytics.paidOrdersCount}</div>
            <div className="text-xs text-gray-500 mt-1">Confirmed payments</div>
          </div>
        </div>

        {/* PROCESSING */}
        <div
          onClick={() => {
            if (onFilterOrdersByStatus) onFilterOrdersByStatus("PROCESSING");
            else if (onViewAllOrders) onViewAllOrders();
          }}
          className="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs flex flex-col justify-between cursor-pointer hover:border-blue-300 hover:shadow-xs transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 group-hover:text-blue-700 transition-colors">
              Processing
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-gray-900">
              {String(processingOrders.length).padStart(2, "0")}
            </div>
            <div className="text-xs text-gray-500 mt-1">In fulfillment</div>
          </div>
        </div>
      </div>

      {/* Middle Row: Revenue Summary Chart & Recent Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Revenue Summary Chart */}
        <div className="lg:col-span-2 bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">Revenue Summary</h2>
              <p className="text-xs text-gray-400 mt-0.5">Daily performance tracking</p>
            </div>
            <div className="flex items-center bg-gray-50 p-1 rounded-xl border border-gray-100 text-xs font-semibold">
              {(["7D", "30D", "1Y"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    period === p ? "bg-emerald-600 text-white shadow-2xs" : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Revenue Chart or Clean Zero State */}
          {orders.length === 0 ? (
            <div className="my-6 py-10 flex flex-col items-center justify-center text-center px-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 text-lg font-bold">
                📈
              </div>
              <h3 className="text-sm font-bold text-gray-900">No Sales Curve Recorded Yet</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-sm leading-relaxed">
                As buyers purchase products via your WhatsApp Co-Pilot or checkout links, daily revenue and volume curves will graph here automatically.
              </p>
              <div className="mt-6 w-full border-b border-dashed border-gray-200 relative">
                <span className="absolute -top-3 left-0 text-[10px] font-mono text-gray-400 bg-white pr-2">₦0.00</span>
              </div>
              <div className="w-full flex justify-between text-[10px] font-semibold text-gray-300 mt-2 px-1">
                <span>Day 1</span>
                <span>Day 7</span>
                <span>Day 14</span>
                <span>Day 21</span>
                <span>Day 30</span>
              </div>
            </div>
          ) : (
            <div className="my-6 relative">
              <div className="h-44 w-full flex items-end">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 500 150" fill="none" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0 110 C 100 100, 180 130, 260 110 C 340 90, 420 30, 500 45 L 500 150 L 0 150 Z"
                    fill="url(#revenueGradient)"
                  />
                  <path
                    d="M0 110 C 100 100, 180 130, 260 110 C 340 90, 420 30, 500 45"
                    stroke="#10B981"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              {/* X-axis date labels */}
              <div className="flex justify-between text-[11px] font-semibold text-gray-400 mt-4 px-2">
                <span>01 OCT</span>
                <span>08 OCT</span>
                <span>15 OCT</span>
                <span>22 OCT</span>
                <span>29 OCT</span>
              </div>
            </div>
          )}
        </div>

        {/* Right 1 Col: Recent Activity */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-900">Recent Activity</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Live</span>
          </div>

          <div className="space-y-3 flex-1 flex flex-col justify-center">
            {orders.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400 flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 font-mono text-sm">
                  ⚡
                </div>
                <p className="font-semibold text-gray-700">No activity yet</p>
                <p className="text-[11px] text-gray-400 mt-1 max-w-[220px]">
                  Incoming orders, buyer WhatsApp conversations, and Monnify escrow payments will appear here in real time.
                </p>
              </div>
            ) : (
              orders.slice(0, 5).map((o, idx) => (
                <div
                  key={o.id || idx}
                  onClick={() => onSelectOrder?.(o)}
                  className="flex items-start gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 shrink-0 flex items-center justify-center text-xs font-bold mt-0.5">
                    <WhatsAppBadgeIcon className="w-4 h-4" />
                  </div>
                  <div className="text-xs min-w-0 flex-1">
                    <div className="text-gray-900 truncate">
                      <span className="font-semibold">{o.customerName}</span> ordered <span className="font-medium">{o.productName}</span>
                    </div>
                    <div className="text-gray-400 text-[11px] mt-0.5 flex items-center gap-1.5">
                      <span>{o.shortCode}</span>
                      <span>•</span>
                      <span className="font-medium text-gray-700">{o.totalAmountFormatted}</span>
                      <span>•</span>
                      <span className={o.status === "PAID" ? "text-emerald-600 font-semibold" : "text-amber-600 font-medium"}>
                        {o.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Needs Attention Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-gray-900">Needs Attention</h2>
            {needsAttention.length > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100">
                {needsAttention.length} URGENT
              </span>
            )}
          </div>
          <button
            onClick={onViewAllOrders}
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
          >
            View All Orders
          </button>
        </div>

        {needsAttention.length === 0 ? (
          <div className="py-12 px-4 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 text-lg font-bold">
              ✓
            </div>
            <p className="text-sm font-bold text-gray-900">All caught up!</p>
            <p className="text-xs text-gray-400 mt-1 max-w-sm">
              No pending orders or expiring checkout holds requiring attention right now.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[640px]">
              <thead className="bg-gray-50/50 text-[11px] uppercase font-bold text-gray-400 border-b border-gray-100">
                <tr>
                  <th className="py-3 px-6">Customer</th>
                  <th className="py-3 px-6">Order Reference</th>
                  <th className="py-3 px-6">Status / Time Remaining</th>
                  <th className="py-3 px-6">Amount</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {needsAttention.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50/70 transition-all">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0">
                          {order.customerName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 text-xs">{order.customerName}</div>
                          <div className="text-[11px] text-gray-400">{order.customerPhone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-mono text-xs font-semibold text-gray-700">
                      {order.shortCode}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                        <ClockIcon className="w-3.5 h-3.5 text-rose-500" />
                        <span>Awaiting Transfer</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-bold text-gray-900 text-xs">
                      {order.totalAmountFormatted}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => onSelectOrder?.(order)}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
