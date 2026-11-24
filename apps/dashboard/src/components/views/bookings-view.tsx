"use client";

import React, { useState, useMemo } from "react";
import type { ProductItem, OrderItem } from "@/lib/types";

export type BookingStatus =
  | "REQUESTED"
  | "CONFIRMED"
  | "DEPOSIT_PENDING"
  | "DEPOSIT_PAID"
  | "READY_FOR_DISPATCH"
  | "FULFILLED"
  | "CANCELLED";

export interface WholesaleBookingItem {
  id: string;
  reference: string; // e.g. "BKG-8812"
  clientName: string;
  clientOrganization?: string;
  clientPhone: string;
  clientType: "WHOLESALER" | "RESELLER_NETWORK" | "RETAIL_CHAIN" | "VIP_BUYER" | "CORPORATE";
  channel: "WHATSAPP" | "INSTAGRAM" | "FACEBOOK" | "PORTAL";
  productSku: string;
  productName: string;
  quantity: number;
  unitPriceNaira: number;
  totalAmountNaira: number;
  depositRequiredNaira: number;
  depositPaidNaira: number;
  depositStatus: "UNPAID" | "PARTIAL" | "PAID";
  targetDeliveryDate: string;
  requestedAt: string;
  status: BookingStatus;
  notes?: string;
}

interface BookingsViewProps {
  products: ProductItem[];
  orders?: OrderItem[];
  onNavigateToProducts?: () => void;
  onNavigateToPayments?: () => void;
  onOpenTour?: () => void;
}

const INITIAL_BOOKINGS: WholesaleBookingItem[] = [
  {
    id: "bkg-1",
    reference: "BKG-7801",
    clientName: "Alhaji Musa Garba",
    clientOrganization: "Kano Central Distributors Ltd",
    clientPhone: "+2348031122334",
    clientType: "WHOLESALER",
    channel: "WHATSAPP",
    productSku: "SHOE-01",
    productName: "Zara Block Heel (Assorted 38-41)",
    quantity: 25,
    unitPriceNaira: 22000,
    totalAmountNaira: 550000,
    depositRequiredNaira: 165000,
    depositPaidNaira: 165000,
    depositStatus: "PAID",
    targetDeliveryDate: "2026-11-28",
    requestedAt: "2026-11-18 14:20",
    status: "DEPOSIT_PAID",
    notes: "Requires solid carton packaging for haulage to Sabon Gari Market, Kano.",
  },
  {
    id: "bkg-2",
    reference: "BKG-7802",
    clientName: "Folashade Balogun",
    clientOrganization: "Lekki Luxe Reseller Network",
    clientPhone: "+2348129988776",
    clientType: "RESELLER_NETWORK",
    channel: "INSTAGRAM",
    productSku: "BAG-01",
    productName: "Mini Structured Leather Bag",
    quantity: 12,
    unitPriceNaira: 32000,
    totalAmountNaira: 384000,
    depositRequiredNaira: 115200,
    depositPaidNaira: 0,
    depositStatus: "UNPAID",
    targetDeliveryDate: "2026-12-02",
    requestedAt: "2026-11-19 09:15",
    status: "REQUESTED",
    notes: "Requested via Instagram DM. Wants delivery directly to Lekki Phase 1 hub.",
  },
  {
    id: "bkg-3",
    reference: "BKG-7803",
    clientName: "Chidi & Sons Trading",
    clientOrganization: "Mainland Retail Outlets",
    clientPhone: "+2348023344556",
    clientType: "WHOLESALER",
    channel: "WHATSAPP",
    productSku: "FLASK-01",
    productName: "Smart Vacuum Temperature Flask",
    quantity: 50,
    unitPriceNaira: 8500,
    totalAmountNaira: 425000,
    depositRequiredNaira: 127500,
    depositPaidNaira: 127500,
    depositStatus: "PAID",
    targetDeliveryDate: "2026-11-24",
    requestedAt: "2026-11-17 11:00",
    status: "READY_FOR_DISPATCH",
    notes: "Stock packed and ready for GIG Logistics pickup.",
  },
  {
    id: "bkg-4",
    reference: "BKG-7804",
    clientName: "Amina Corporate Gifts",
    clientOrganization: "Abuja Enterprise Suppliers",
    clientPhone: "+2348095566778",
    clientType: "CORPORATE",
    channel: "FACEBOOK",
    productSku: "BAG-01",
    productName: "Mini Structured Leather Bag (Black)",
    quantity: 20,
    unitPriceNaira: 31000,
    totalAmountNaira: 620000,
    depositRequiredNaira: 310000,
    depositPaidNaira: 310000,
    depositStatus: "PAID",
    targetDeliveryDate: "2026-11-20",
    requestedAt: "2026-11-15 16:45",
    status: "FULFILLED",
    notes: "End-of-year corporate retreat order. Balance cleared via Monnify transfer.",
  },
];

export function BookingsView({
  products,
  onNavigateToProducts,
  onNavigateToPayments,
  onOpenTour,
}: BookingsViewProps) {
  const [activeTab, setActiveTab] = useState<"pipeline" | "terms">("pipeline");
  const [bookings, setBookings] = useState<WholesaleBookingItem[]>(INITIAL_BOOKINGS);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Booking Terms State
  const [defaultDepositPercent, setDefaultDepositPercent] = useState(30);
  const [defaultLeadTimeDays, setDefaultLeadTimeDays] = useState(5);
  const [minimumOrderValueNaira, setMinimumOrderValueNaira] = useState(150000);
  const [autoExpireHours, setAutoExpireHours] = useState(48);

  // New Booking Modal State
  const [showNewBookingModal, setShowNewBookingModal] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientOrg, setNewClientOrg] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("+234");
  const [newClientType, setNewClientType] = useState<WholesaleBookingItem["clientType"]>("WHOLESALER");
  const [newChannel, setNewChannel] = useState<WholesaleBookingItem["channel"]>("WHATSAPP");
  const [newProductSku, setNewProductSku] = useState(products[0]?.skuCode || "SHOE-01");
  const [newQuantity, setNewQuantity] = useState(10);
  const [newTargetDate, setNewTargetDate] = useState("2026-12-05");
  const [newNotes, setNewNotes] = useState("");

  // Feedback Toast
  const [actionToast, setActionToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(null), 4000);
  };

  // Financial KPIs
  const kpis = useMemo(() => {
    const activeList = bookings.filter((b) => b.status !== "CANCELLED");
    const totalPipelineValue = activeList.reduce((acc, b) => acc + b.totalAmountNaira, 0);
    const depositsCollected = activeList.reduce((acc, b) => acc + b.depositPaidNaira, 0);
    const totalUnitsReserved = activeList
      .filter((b) => b.status === "CONFIRMED" || b.status === "DEPOSIT_PAID" || b.status === "READY_FOR_DISPATCH")
      .reduce((acc, b) => acc + b.quantity, 0);
    const pendingApprovalCount = bookings.filter((b) => b.status === "REQUESTED").length;

    return {
      totalPipelineValue,
      depositsCollected,
      totalUnitsReserved,
      pendingApprovalCount,
    };
  }, [bookings]);

  // Filtered Bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const matchStatus = statusFilter === "ALL" || b.status === statusFilter;
      const matchSearch =
        searchQuery === "" ||
        b.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.clientOrganization && b.clientOrganization.toLowerCase().includes(searchQuery.toLowerCase())) ||
        b.productName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [bookings, statusFilter, searchQuery]);

  // Actions
  const handleApprove = (id: string) => {
    setBookings((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, status: "CONFIRMED" as BookingStatus } : b
      )
    );
    showToast("Booking approved! Client alerted to deposit Monnify escrow.");
  };

  const handleSimulateDeposit = (id: string) => {
    setBookings((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...b,
              depositPaidNaira: b.depositRequiredNaira,
              depositStatus: "PAID",
              status: "DEPOSIT_PAID" as BookingStatus,
            }
          : b
      )
    );
    showToast("Monnify 30% advance deposit confirmed & stock allocated!");
  };

  const handleMarkReady = (id: string) => {
    setBookings((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, status: "READY_FOR_DISPATCH" as BookingStatus } : b
      )
    );
    showToast("Order marked Ready for Dispatch! Wholesaler notified.");
  };

  const handleFulfill = (id: string) => {
    setBookings((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, status: "FULFILLED" as BookingStatus } : b
      )
    );
    showToast("Wholesale booking fulfilled and final balance settled!");
  };

  const handleCancel = (id: string) => {
    setBookings((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, status: "CANCELLED" as BookingStatus } : b
      )
    );
    showToast("Booking cancelled and reserved inventory released.");
  };

  // Create Manual Booking
  const handleCreateBooking = (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find((p) => p.skuCode === newProductSku);
    const unitPrice = prod?.basePriceNaira || 25000;
    const totalAmount = unitPrice * newQuantity;
    const depositRequired = Math.round((totalAmount * defaultDepositPercent) / 100);

    const newBooking: WholesaleBookingItem = {
      id: `bkg-${Date.now()}`,
      reference: `BKG-${Math.floor(1000 + Math.random() * 9000)}`,
      clientName: newClientName,
      clientOrganization: newClientOrg || undefined,
      clientPhone: newClientPhone,
      clientType: newClientType,
      channel: newChannel,
      productSku: newProductSku,
      productName: prod?.name || "Wholesale Merchandise",
      quantity: Number(newQuantity),
      unitPriceNaira: unitPrice,
      totalAmountNaira: totalAmount,
      depositRequiredNaira: depositRequired,
      depositPaidNaira: 0,
      depositStatus: "UNPAID",
      targetDeliveryDate: newTargetDate,
      requestedAt: new Date().toISOString().replace("T", " ").slice(0, 16),
      status: "CONFIRMED",
      notes: newNotes || undefined,
    };

    setBookings([newBooking, ...bookings]);
    setShowNewBookingModal(false);
    setNewClientName("");
    setNewClientOrg("");
    setNewNotes("");
    showToast(`Created wholesale booking ${newBooking.reference} for ${newBooking.clientName}!`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full pb-16">
      {/* Toast Notification */}
      {actionToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 border border-gray-700 animate-in slide-in-from-bottom duration-200">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{actionToast}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
              Wholesale &amp; Reseller Bookings
            </h1>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
              Pro Concierge ($20)
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Allow wholesale clients and reseller networks to request advance bulk bookings, lock inventory with Monnify escrow deposits, and manage lead-time fulfillment.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToProducts && (
            <button
              onClick={onNavigateToProducts}
              className="text-xs font-semibold px-3.5 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Configure bookable products and categories in Products"
            >
              <span>🛍️</span>
              <span className="hidden sm:inline">Product Bookability Settings →</span>
              <span className="sm:hidden">SKU Settings →</span>
            </button>
          )}
          {onOpenTour && (
            <button
              onClick={onOpenTour}
              className="text-xs font-semibold px-3.5 py-2.5 rounded-xl bg-purple-50 border border-purple-300 text-purple-950 hover:bg-purple-100 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Learn how Wholesale Bookings &amp; Monnify Escrow work"
            >
              <span>🧭</span>
              <span className="hidden sm:inline">Bookings Guide</span>
              <span className="sm:hidden">Guide</span>
            </button>
          )}
          <button
            onClick={() => setShowNewBookingModal(true)}
            className="text-xs font-semibold px-4 py-2.5 rounded-xl bg-[#0d5c3a] text-white hover:bg-[#0b4b2f] transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <span>+ New Wholesale Booking</span>
          </button>
        </div>
      </div>

      {/* 4 Financial & Inventory KPI Cards */}
      <div data-tour="bookings-kpi-cards" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Total Bookings Value</span>
            <span className="text-base">💼</span>
          </div>
          <div className="text-2xl font-extrabold text-gray-900 mt-2">
            ₦{kpis.totalPipelineValue.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">Across wholesale &amp; network orders</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Deposits in Escrow</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Monnify</span>
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-2">
            ₦{kpis.depositsCollected.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">Advance security deposits held</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Reserved Units</span>
            <span className="text-base">📦</span>
          </div>
          <div className="text-2xl font-extrabold text-gray-900 mt-2">
            {kpis.totalUnitsReserved} units
          </div>
          <div className="text-xs text-gray-500 mt-1">Locked for confirmed wholesale supply</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Awaiting Approval</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${kpis.pendingApprovalCount > 0 ? "bg-amber-100 text-amber-800 animate-pulse" : "bg-gray-100 text-gray-600"}`}>
              {kpis.pendingApprovalCount} requests
            </span>
          </div>
          <div className="text-2xl font-extrabold text-gray-900 mt-2">
            {kpis.pendingApprovalCount}
          </div>
          <div className="text-xs text-gray-500 mt-1">Incoming wholesaler bookings</div>
        </div>
      </div>

      {/* Main Tab Strip */}
      <div data-tour="bookings-tabs" className="flex border-b border-gray-200 text-xs font-semibold gap-6 overflow-x-auto pb-0.5 items-center justify-between">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab("pipeline")}
            className={`pb-2.5 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "pipeline"
                ? "border-emerald-600 text-emerald-700 font-bold"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            Active Bookings Pipeline ({bookings.length})
          </button>

          <button
            onClick={() => setActiveTab("terms")}
            className={`pb-2.5 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "terms"
                ? "border-emerald-600 text-emerald-700 font-bold"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            Wholesale Booking Policy &amp; Terms
          </button>
        </div>

        {onNavigateToProducts && (
          <button
            onClick={onNavigateToProducts}
            className="pb-2.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <span>🛍️ Configure Bookable Products in Catalog</span>
            <span>→</span>
          </button>
        )}
      </div>

      {/* TAB 1: BOOKINGS PIPELINE */}
      {activeTab === "pipeline" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-2xs">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-1">
                Status:
              </span>
              {[
                { id: "ALL", label: "All Bookings" },
                { id: "REQUESTED", label: "Requested" },
                { id: "CONFIRMED", label: "Confirmed" },
                { id: "DEPOSIT_PAID", label: "Deposit Paid" },
                { id: "READY_FOR_DISPATCH", label: "Ready" },
                { id: "FULFILLED", label: "Fulfilled" },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStatusFilter(s.id)}
                  className={`px-3 py-1 rounded-xl font-semibold transition-all cursor-pointer ${
                    statusFilter === s.id
                      ? "bg-gray-900 text-white shadow-2xs"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Search reference, client, SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-500 w-full sm:w-64"
              />
            </div>
          </div>

          {/* Bookings Table Card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[840px]">
                <thead className="bg-gray-50/70 border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-5">Ref / Client</th>
                    <th className="py-3 px-4">Channel</th>
                    <th className="py-3 px-4">Booked Item &amp; Qty</th>
                    <th className="py-3 px-4">Total Value</th>
                    <th className="py-3 px-4">Deposit Status</th>
                    <th className="py-3 px-4">Target Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredBookings.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-400">
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-3xl mb-2">📋</span>
                          <span className="text-sm font-bold text-gray-800">No bookings match this filter</span>
                          <span className="text-xs text-gray-400 mt-0.5">Click &ldquo;+ New Wholesale Booking&rdquo; to add a bulk booking manually.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredBookings.map((b) => (
                      <tr key={b.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-3.5 px-5">
                          <div className="font-bold text-gray-900 text-xs font-mono">{b.reference}</div>
                          <div className="font-semibold text-gray-800 mt-0.5">{b.clientName}</div>
                          {b.clientOrganization && (
                            <div className="text-[10px] text-gray-400 truncate">{b.clientOrganization}</div>
                          )}
                          <div className="text-[10px] text-gray-400">{b.clientPhone}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            b.channel === "WHATSAPP"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : b.channel === "INSTAGRAM"
                              ? "bg-pink-50 text-pink-700 border-pink-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}>
                            <span>{b.channel === "WHATSAPP" ? "🟢" : b.channel === "INSTAGRAM" ? "📸" : "🔵"}</span>
                            <span>{b.channel}</span>
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-gray-900">{b.productName}</div>
                          <div className="text-[10px] text-gray-400 font-mono">
                            {b.productSku} · ₦{b.unitPriceNaira.toLocaleString()} / unit
                          </div>
                          <span className="inline-block mt-1 font-bold text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded">
                            Qty: {b.quantity} units
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-extrabold text-gray-900 text-xs">
                            ₦{b.totalAmountNaira.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            Req: ₦{b.depositRequiredNaira.toLocaleString()}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            b.depositStatus === "PAID"
                              ? "bg-emerald-100 text-emerald-800"
                              : b.depositStatus === "PARTIAL"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}>
                            {b.depositStatus === "PAID" ? "✓ Deposit Paid" : "Unpaid Deposit"}
                          </span>
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            ₦{b.depositPaidNaira.toLocaleString()} paid
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-gray-700">
                          {b.targetDeliveryDate}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider ${
                            b.status === "REQUESTED"
                              ? "bg-amber-100 text-amber-900 border border-amber-300"
                              : b.status === "CONFIRMED"
                              ? "bg-blue-50 text-blue-900 border border-blue-200"
                              : b.status === "DEPOSIT_PAID"
                              ? "bg-emerald-50 text-emerald-900 border border-emerald-300 font-black"
                              : b.status === "READY_FOR_DISPATCH"
                              ? "bg-purple-100 text-purple-900 border border-purple-300"
                              : b.status === "FULFILLED"
                              ? "bg-gray-100 text-gray-700"
                              : "bg-rose-50 text-rose-800"
                          }`}>
                            {b.status.replace(/_/g, " ")}
                          </span>
                        </td>

                        <td className="py-3.5 px-5 text-right space-x-1.5 whitespace-nowrap">
                          {b.status === "REQUESTED" && (
                            <button
                              onClick={() => handleApprove(b.id)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                            >
                              Approve
                            </button>
                          )}

                          {(b.status === "CONFIRMED" || (b.status === "REQUESTED" && b.depositStatus === "UNPAID")) && (
                            <button
                              onClick={() => handleSimulateDeposit(b.id)}
                              className="px-2.5 py-1 rounded-lg bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-bold text-[11px] cursor-pointer"
                            >
                              Simulate Deposit ₦
                            </button>
                          )}

                          {b.status === "DEPOSIT_PAID" && (
                            <button
                              onClick={() => handleMarkReady(b.id)}
                              className="px-2.5 py-1 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-bold text-[11px] cursor-pointer"
                            >
                              Mark Ready
                            </button>
                          )}

                          {b.status === "READY_FOR_DISPATCH" && (
                            <button
                              onClick={() => handleFulfill(b.id)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] cursor-pointer"
                            >
                              Fulfill &amp; Settle
                            </button>
                          )}

                          {b.status !== "FULFILLED" && b.status !== "CANCELLED" && (
                            <button
                              onClick={() => handleCancel(b.id)}
                              className="px-2 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-rose-50 hover:text-rose-700 text-[11px] cursor-pointer"
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}



      {/* TAB 3: BOOKING TERMS & POLICY */}
      {activeTab === "terms" && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-2xs space-y-6 max-w-3xl">
          <div>
            <h2 className="text-base font-bold text-gray-900">Wholesale Advance Booking Policy</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Set standard terms for wholesale orders, escrow deposit requirements, and cancellation rules.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700">Default Booking Deposit %</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={defaultDepositPercent}
                  onChange={(e) => setDefaultDepositPercent(Number(e.target.value))}
                  className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 font-bold w-28 focus:outline-none focus:border-emerald-500"
                />
                <span className="text-xs text-gray-500">% via Monnify Dynamic Account</span>
              </div>
              <p className="text-[11px] text-gray-400">Standard for Nigerian wholesale importers is 30%.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700">Standard Turnaround / Lead Time (Days)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={defaultLeadTimeDays}
                  onChange={(e) => setDefaultLeadTimeDays(Number(e.target.value))}
                  className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 font-bold w-28 focus:outline-none focus:border-emerald-500"
                />
                <span className="text-xs text-gray-500">Business days</span>
              </div>
              <p className="text-[11px] text-gray-400">Target time to prepare and dispatch wholesale booking.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700">Minimum Order Value for Bookings (₦)</label>
              <input
                type="number"
                step={10000}
                value={minimumOrderValueNaira}
                onChange={(e) => setMinimumOrderValueNaira(Number(e.target.value))}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 font-bold w-full focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[11px] text-gray-400">Orders below this amount are routed through immediate retail checkout.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700">Auto-Expiry for Unpaid Deposits (Hours)</label>
              <input
                type="number"
                min={12}
                max={168}
                value={autoExpireHours}
                onChange={(e) => setAutoExpireHours(Number(e.target.value))}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 font-bold w-full focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[11px] text-gray-400">Held reservations are cancelled and stock returned if deposit is not received.</p>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-emerald-800 font-semibold">✓ Settings saved and active</span>
            <button
              onClick={() => showToast("Booking terms and policy updated successfully!")}
              className="bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer shadow-2xs"
            >
              Save Policy Changes
            </button>
          </div>
        </div>
      )}

      {/* NEW BOOKING MODAL */}
      {showNewBookingModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-gray-900">Create Wholesale Booking</h3>
              <button
                onClick={() => setShowNewBookingModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBooking} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Wholesaler / Client Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Chief Emeka Obi"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="w-full bg-gray-50 border rounded-xl px-3 py-2 text-gray-900"
                  />
                </div>
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Business / Organization</label>
                  <input
                    type="text"
                    placeholder="e.g. Onitsha Main Market Store"
                    value={newClientOrg}
                    onChange={(e) => setNewClientOrg(e.target.value)}
                    className="w-full bg-gray-50 border rounded-xl px-3 py-2 text-gray-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">WhatsApp / Phone Number</label>
                  <input
                    type="text"
                    required
                    placeholder="+234..."
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    className="w-full bg-gray-50 border rounded-xl px-3 py-2 text-gray-900"
                  />
                </div>
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Origin Channel</label>
                  <select
                    value={newChannel}
                    onChange={(e) => setNewChannel(e.target.value as WholesaleBookingItem["channel"])}
                    className="w-full bg-gray-50 border rounded-xl px-3 py-2 text-gray-900"
                  >
                    <option value="WHATSAPP">🟢 WhatsApp Business</option>
                    <option value="INSTAGRAM">📸 Instagram Direct</option>
                    <option value="FACEBOOK">🔵 Facebook Messenger</option>
                    <option value="PORTAL">🌐 Direct Wholesale Portal</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Product to Book</label>
                  <select
                    value={newProductSku}
                    onChange={(e) => setNewProductSku(e.target.value)}
                    className="w-full bg-gray-50 border rounded-xl px-3 py-2 text-gray-900 font-semibold"
                  >
                    {products.map((p) => (
                      <option key={p.skuCode} value={p.skuCode}>
                        {p.name} (₦{p.basePriceNaira.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Quantity (Units)</label>
                  <input
                    type="number"
                    min={1}
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(Number(e.target.value))}
                    className="w-full bg-gray-50 border rounded-xl px-3 py-2 text-gray-900 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Target Delivery Date</label>
                <input
                  type="date"
                  required
                  value={newTargetDate}
                  onChange={(e) => setNewTargetDate(e.target.value)}
                  className="w-full bg-gray-50 border rounded-xl px-3 py-2 text-gray-900"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Fulfillment Notes / Terms</label>
                <textarea
                  rows={2}
                  placeholder="Special packaging, transport company, waybill destination..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full bg-gray-50 border rounded-xl px-3 py-2 text-gray-900"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewBookingModal(false)}
                  className="px-4 py-2 border rounded-xl text-gray-600 hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-bold rounded-xl cursor-pointer"
                >
                  Confirm &amp; Record Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
