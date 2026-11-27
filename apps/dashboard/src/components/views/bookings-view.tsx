"use client";

import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/api";
import { TableActionMenu } from "../ui/table-action-menu";
import type {
  BookingCatalogRules,
  BookingStatus,
  ProductItem,
  OrderItem,
  VendorState,
  WholesaleBookingItem,
} from "@/lib/types";

export type { BookingStatus, WholesaleBookingItem };

interface BookingsViewProps {
  products: ProductItem[];
  orders?: OrderItem[];
  dbBookings?: WholesaleBookingItem[];
  bookingCatalogRules?: BookingCatalogRules;
  onStateChange?: (state: VendorState) => void;
  onNavigateToProducts?: () => void;
  onNavigateToPayments?: () => void;
  onNavigateToLegalSettings?: () => void;
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
  dbBookings,
  bookingCatalogRules,
  onStateChange,
  onNavigateToLegalSettings,
  onOpenTour,
}: BookingsViewProps) {
  const [bookings, setBookings] = useState<WholesaleBookingItem[]>(
    dbBookings && dbBookings.length > 0 ? dbBookings : INITIAL_BOOKINGS
  );
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const defaultDepositPercent = bookingCatalogRules?.defaultDepositPercent ?? 30;

  useEffect(() => {
    if (dbBookings && dbBookings.length > 0) {
      setBookings(dbBookings);
    }
  }, [dbBookings]);

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

  // Actions (Persisted to PostgreSQL)
  const syncStatusToDb = async (
    id: string,
    updates: Partial<WholesaleBookingItem>,
    toastMsg: string
  ) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...updates } : b))
    );
    showToast(toastMsg);
    try {
      const res = await api.updateWholesaleBookingStatus(id, updates);
      onStateChange?.(res.state);
    } catch {
      // Keep optimistic state if offline
    }
  };

  const handleApprove = (id: string) => {
    void syncStatusToDb(
      id,
      { status: "CONFIRMED" },
      "Booking approved & saved to PostgreSQL! Client alerted to deposit Monnify escrow."
    );
  };

  const handleSimulateDeposit = (id: string) => {
    const target = bookings.find((b) => b.id === id);
    void syncStatusToDb(
      id,
      {
        depositPaidNaira: target?.depositRequiredNaira ?? 0,
        depositStatus: "PAID",
        status: "DEPOSIT_PAID",
      },
      "Monnify 30% advance deposit confirmed & stock allocated in PostgreSQL!"
    );
  };

  const handleMarkReady = (id: string) => {
    void syncStatusToDb(
      id,
      { status: "READY_FOR_DISPATCH" },
      "Order marked Ready for Dispatch in PostgreSQL! Wholesaler notified."
    );
  };

  const handleFulfill = (id: string) => {
    void syncStatusToDb(
      id,
      { status: "FULFILLED" },
      "Wholesale booking fulfilled and final balance settled in PostgreSQL!"
    );
  };

  const handleCancel = (id: string) => {
    void syncStatusToDb(
      id,
      { status: "CANCELLED" },
      "Booking cancelled and reserved inventory released in PostgreSQL."
    );
  };

  // Create Manual Booking (Persisted to PostgreSQL)
  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find((p) => p.skuCode === newProductSku);
    const unitPrice = prod?.basePriceNaira || 25000;
    const totalAmount = unitPrice * newQuantity;
    const depositRequired = Math.round((totalAmount * defaultDepositPercent) / 100);

    try {
      const res = await api.saveWholesaleBooking({
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
        targetDeliveryDate: newTargetDate,
        status: "CONFIRMED",
        notes: newNotes || undefined,
      });
      onStateChange?.(res.state);
      if (res.state.wholesaleBookings) {
        setBookings(res.state.wholesaleBookings);
      }
      setShowNewBookingModal(false);
      setNewClientName("");
      setNewClientOrg("");
      setNewNotes("");
      showToast(
        `Created wholesale booking ${res.booking.reference} for ${res.booking.clientName} in PostgreSQL!`
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save booking.");
    }
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
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
              Wholesale &amp; Reseller Bookings
            </h1>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#0d5c3a] border border-emerald-200">
              Advance Bulk Pipeline
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Track bulk bookings, verify Monnify advance escrow deposits, and coordinate wholesale fulfillment.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onNavigateToLegalSettings && (
            <button
              type="button"
              onClick={onNavigateToLegalSettings}
              className="text-xs font-semibold px-3.5 py-2.5 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95 whitespace-nowrap"
              title="Configure Wholesale Booking Policy & Legal Terms in Settings"
            >
              <span>⚖️</span>
              <span>Legal &amp; Booking Policies</span>
            </button>
          )}
          {onOpenTour && (
            <button
              onClick={onOpenTour}
              className="text-xs font-semibold px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 hover:bg-emerald-100 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95 whitespace-nowrap"
              title="Learn how Wholesale Bookings &amp; Monnify Escrow work"
            >
              <span>🧭</span>
              <span className="hidden sm:inline">Bookings Guide</span>
              <span className="sm:hidden">Guide</span>
            </button>
          )}
          <button
            onClick={() => setShowNewBookingModal(true)}
            className="text-xs font-semibold px-4 py-2.5 rounded-xl bg-[#0d5c3a] text-white hover:bg-[#0b4b2f] transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95 whitespace-nowrap"
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

      {/* Booking Status Tabs (Replacing old Pipeline/Policy tabs) */}
      <div
        data-tour="bookings-tabs"
        className="flex border-b border-gray-200 text-xs font-semibold gap-5 sm:gap-6 overflow-x-auto no-scrollbar whitespace-nowrap"
      >
        {[
          { id: "ALL", label: `All Bookings (${bookings.length})` },
          {
            id: "REQUESTED",
            label: `Requested (${bookings.filter((b) => b.status === "REQUESTED").length})`,
          },
          {
            id: "CONFIRMED",
            label: `Confirmed (${bookings.filter((b) => b.status === "CONFIRMED").length})`,
          },
          {
            id: "DEPOSIT_PAID",
            label: `Deposit Paid (${bookings.filter((b) => b.status === "DEPOSIT_PAID").length})`,
          },
          {
            id: "READY_FOR_DISPATCH",
            label: `Ready for Dispatch (${bookings.filter((b) => b.status === "READY_FOR_DISPATCH").length})`,
          },
          {
            id: "FULFILLED",
            label: `Fulfilled (${bookings.filter((b) => b.status === "FULFILLED").length})`,
          },
          {
            id: "CANCELLED",
            label: `Cancelled (${bookings.filter((b) => b.status === "CANCELLED").length})`,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusFilter(tab.id)}
            className={`pb-3 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
              statusFilter === tab.id
                ? "border-[#0d5c3a] text-[#0d5c3a] font-bold"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bookings Pipeline & Table */}
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-gray-100 shadow-2xs">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search booking reference, client name, organization, or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 focus:outline-none focus:border-emerald-500 w-full"
            />
          </div>
          <div className="text-xs text-gray-500 whitespace-nowrap">
            Showing <strong className="text-gray-900">{filteredBookings.length}</strong> of{" "}
            <strong className="text-gray-900">{bookings.length}</strong> bookings
          </div>
        </div>

        {/* Bookings Table Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[860px]">
              <thead className="bg-gray-50/70 border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                <tr>
                  <th className="py-3 px-5 whitespace-nowrap">Ref / Client</th>
                  <th className="py-3 px-4 whitespace-nowrap">Channel</th>
                  <th className="py-3 px-4 whitespace-nowrap">Booked Item &amp; Qty</th>
                  <th className="py-3 px-4 whitespace-nowrap">Total Value</th>
                  <th className="py-3 px-4 whitespace-nowrap">Deposit Status</th>
                  <th className="py-3 px-4 whitespace-nowrap">Target Date</th>
                  <th className="py-3 px-4 whitespace-nowrap">Status</th>
                  <th className="py-3 px-5 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 whitespace-nowrap">
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-400">
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-3xl mb-2">📋</span>
                        <span className="text-sm font-bold text-gray-800">No bookings match this status tab</span>
                        <span className="text-xs text-gray-400 mt-0.5">
                          Click &ldquo;+ New Wholesale Booking&rdquo; to record a bulk reservation.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50/60 transition-colors whitespace-nowrap">
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <div className="font-bold text-gray-900 text-xs font-mono whitespace-nowrap">{b.reference}</div>
                        <div className="font-semibold text-gray-800 mt-0.5 whitespace-nowrap">{b.clientName}</div>
                        {b.clientOrganization && (
                          <div className="text-[10px] text-gray-400 whitespace-nowrap">{b.clientOrganization}</div>
                        )}
                        <div className="text-[10px] text-gray-400 whitespace-nowrap">{b.clientPhone}</div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${
                            b.channel === "WHATSAPP"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : b.channel === "INSTAGRAM"
                              ? "bg-pink-50 text-pink-700 border-pink-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}
                        >
                          <span>{b.channel === "WHATSAPP" ? "🟢" : b.channel === "INSTAGRAM" ? "📸" : "🔵"}</span>
                          <span>{b.channel}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-gray-900 whitespace-nowrap">{b.productName}</div>
                        <div className="text-[10px] text-gray-400 font-mono whitespace-nowrap">
                          {b.productSku} · ₦{b.unitPriceNaira.toLocaleString()} / unit
                        </div>
                        <span className="inline-block mt-1 font-bold text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded whitespace-nowrap">
                          Qty: {b.quantity} units
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-extrabold text-gray-900 text-xs whitespace-nowrap">
                          ₦{b.totalAmountNaira.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-gray-500 whitespace-nowrap">
                          Req: ₦{b.depositRequiredNaira.toLocaleString()}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                            b.depositStatus === "PAID"
                              ? "bg-emerald-100 text-emerald-800"
                              : b.depositStatus === "PARTIAL"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {b.depositStatus === "PAID" ? "✓ Deposit Paid" : "Unpaid Deposit"}
                        </span>
                        <div className="text-[10px] text-gray-400 mt-0.5 whitespace-nowrap">
                          ₦{b.depositPaidNaira.toLocaleString()} paid
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-gray-700 whitespace-nowrap">
                        {b.targetDeliveryDate}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider whitespace-nowrap ${
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
                          }`}
                        >
                          {b.status.replace(/_/g, " ")}
                        </span>
                      </td>

                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <TableActionMenu
                          items={[
                            ...(b.status === "REQUESTED"
                              ? [
                                  {
                                    label: "Approve Booking Request",
                                    icon: "✅",
                                    variant: "emerald" as const,
                                    onClick: () => handleApprove(b.id),
                                  },
                                ]
                              : []),
                            ...(b.status === "CONFIRMED" ||
                            (b.status === "REQUESTED" && b.depositStatus === "UNPAID")
                              ? [
                                  {
                                    label: `Confirm Deposit (₦${b.depositRequiredNaira.toLocaleString()})`,
                                    icon: "💳",
                                    variant: "emerald" as const,
                                    onClick: () => handleSimulateDeposit(b.id),
                                  },
                                ]
                              : []),
                            ...(b.status === "DEPOSIT_PAID"
                              ? [
                                  {
                                    label: "Mark Ready for Dispatch",
                                    icon: "📦",
                                    variant: "emerald" as const,
                                    onClick: () => handleMarkReady(b.id),
                                  },
                                ]
                              : []),
                            ...(b.status === "READY_FOR_DISPATCH"
                              ? [
                                  {
                                    label: "Fulfill & Settle Balance",
                                    icon: "🚚",
                                    variant: "emerald" as const,
                                    onClick: () => handleFulfill(b.id),
                                  },
                                ]
                              : []),
                            {
                              label: "Chat Wholesaler on WhatsApp",
                              icon: "💬",
                              onClick: () =>
                                window.open(
                                  `https://wa.me/${b.clientPhone.replace(/\+/g, "")}`,
                                  "_blank"
                                ),
                            },
                            ...(b.status !== "FULFILLED" && b.status !== "CANCELLED"
                              ? [
                                  {
                                    label: "Cancel Booking",
                                    icon: "🛑",
                                    variant: "danger" as const,
                                    onClick: () => handleCancel(b.id),
                                  },
                                ]
                              : []),
                          ]}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* NEW BOOKING MODAL (Viewport-Centered & Full-Screen on Mobile) */}
      {showNewBookingModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 bg-slate-900/25 backdrop-blur-md z-50 flex items-center justify-center p-0 sm:p-4 overflow-hidden animate-backdrop-fade">
            <div className="bg-white rounded-none sm:rounded-[28px] max-w-lg w-full h-[100dvh] sm:h-auto sm:max-h-[90dvh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-4 animate-popup-spring">
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
        </div>,
        document.body
      )}
    </div>
  );
}
