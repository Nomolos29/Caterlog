import React, { useState, useMemo } from "react";
import { api } from "@/lib/api";
import type { CustomerRecordItem, DiscountItem, OrderItem, VendorState } from "@/lib/types";
import { EmptyState } from "../ui/empty-state";

interface CustomerProfile {
  id: string;
  key: string;
  name: string;
  phone: string;
  email: string;
  location: string;
  firstOrderDate: string;
  lastOrderDate: string;
  lastOrderTimestamp: number;
  orderCount: number;
  totalSpentNaira: number;
  totalSpentFormatted: string;
  tag: "VIP" | "Repeat" | "New";
  hasWebsiteOrders: boolean;
  notes?: string;
  orders: OrderItem[];
}

interface CustomersViewProps {
  orders: OrderItem[];
  dbCustomers?: CustomerRecordItem[];
  discounts?: DiscountItem[];
  onStateChange?: (state: VendorState) => void;
  onSelectOrder?: (order: OrderItem) => void;
  onNavigateToPaymentLinks?: (customerName: string) => void;
}

export function CustomersView({
  orders,
  dbCustomers = [],
  discounts = [],
  onStateChange,
  onSelectOrder,
  onNavigateToPaymentLinks,
}: CustomersViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<"ALL" | "VIP" | "Repeat" | "New">("ALL");
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "orders" | "notes">("overview");
  const [customerNotes, setCustomerNotes] = useState<Record<string, string>>({});
  const [newNoteInput, setNewNoteInput] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Add Customer Standalone Popup
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("+234");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [newCustAddress, setNewCustAddress] = useState("");
  const [newCustSegment, setNewCustSegment] = useState<"New" | "Repeat" | "VIP">("New");
  const [newCustNote, setNewCustNote] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Segment Broadcast Standalone Popup
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [bcastSegment, setBcastSegment] = useState<
    "ALL" | "VIP" | "Repeat" | "New" | "PENDING_ORDERS"
  >("ALL");
  const [bcastChannel, setBcastChannel] = useState<"WHATSAPP" | "INSTAGRAM" | "SMS">("WHATSAPP");
  const [bcastMessage, setBcastMessage] = useState(
    "Hello {name}! We just restocked our best-selling items and opened fresh weekend discounts. Tap below to reserve yours before stock runs out!"
  );
  const [bcastPromoCode, setBcastPromoCode] = useState("");
  const [bcastIncludeLink, setBcastIncludeLink] = useState(true);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastReceipt, setBroadcastReceipt] = useState<{
    recipientCount: number;
    segment: string;
    channel: string;
  } | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Aggregate customers from real orders (chronological pass -> sorted most-recent first)
  const customers: CustomerProfile[] = useMemo(() => {
    const customerMap = new Map<string, CustomerProfile>();

    // Sort oldest -> newest so firstOrderDate is first and lastOrderDate/location reflect the latest purchase
    const chronological = [...orders].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    for (const o of chronological) {
      const phone = o.customerPhone?.trim();
      if (!phone) continue;
      const cleanName = (o.customerName || "Customer").trim();
      const customerKey = `${phone}::${cleanName.toLowerCase()}`;
      const existing = customerMap.get(customerKey) ?? customerMap.get(phone);
      const orderTs = new Date(o.createdAt).getTime() || Date.now();
      const dateLabel = new Date(o.createdAt).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      const isWebOrder = o.salesChannel === "WEB_STOREFRONT";
      const locationLabel = o.deliveryAddress || o.shippingZoneName || "Nigeria";

      if (existing) {
        existing.orderCount += 1;
        existing.totalSpentNaira += o.totalAmountNaira;
        existing.totalSpentFormatted = `₦${existing.totalSpentNaira.toLocaleString()}`;
        existing.orders.unshift(o);
        existing.name = cleanName || existing.name;
        existing.location = locationLabel;
        existing.lastOrderDate = dateLabel;
        existing.lastOrderTimestamp = Math.max(existing.lastOrderTimestamp, orderTs);
        if (isWebOrder) existing.hasWebsiteOrders = true;
        if (existing.orderCount > 3) existing.tag = "VIP";
        else if (existing.orderCount > 1) existing.tag = "Repeat";
      } else {
        customerMap.set(customerKey, {
          id: `cust-${customerMap.size + 1}`,
          key: customerKey,
          name: cleanName,
          phone: o.customerPhone,
          email: cleanName
            ? `${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@buyer.caterlog.shop`
            : "customer@buyer.caterlog.shop",
          location: locationLabel,
          tag: "New",
          firstOrderDate: dateLabel,
          lastOrderDate: dateLabel,
          lastOrderTimestamp: orderTs,
          orderCount: 1,
          totalSpentNaira: o.totalAmountNaira,
          totalSpentFormatted: o.totalAmountFormatted,
          hasWebsiteOrders: isWebOrder,
          orders: [o],
        });
      }
    }

    // Merge any persisted PostgreSQL Customer records that aren't already represented
    for (const dbc of dbCustomers) {
      const phone = dbc.whatsappPhone?.trim();
      if (!phone) continue;
      const cleanName = (dbc.name || phone).trim();
      const customerKey = `${phone}::${cleanName.toLowerCase()}`;
      const alreadyByKey = customerMap.get(customerKey);
      const alreadyByPhone = Array.from(customerMap.values()).find((c) => c.phone === phone);
      if (alreadyByKey || alreadyByPhone) {
        const target = alreadyByKey ?? alreadyByPhone!;
        if (dbc.defaultAddress && (!target.location || target.location === "Nigeria")) {
          target.location = dbc.defaultAddress;
        }
        if (dbc.email) target.email = dbc.email;
        if (dbc.notes) target.notes = dbc.notes;
        if (dbc.segmentOverride) target.tag = dbc.segmentOverride;
        continue;
      }
      const ts = new Date(dbc.lastOrderAt || dbc.firstSeenAt).getTime() || Date.now();
      const firstDateLabel = new Date(dbc.firstSeenAt).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      const lastDateLabel = new Date(dbc.lastOrderAt || dbc.firstSeenAt).toLocaleDateString(
        "en-GB",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }
      );
      customerMap.set(customerKey, {
        id: dbc.id,
        key: customerKey,
        name: cleanName,
        phone,
        email:
          dbc.email ||
          `${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@buyer.caterlog.shop`,
        location: dbc.defaultAddress || "Nigeria",
        tag:
          dbc.segmentOverride ||
          (dbc.totalOrdersCount > 3 ? "VIP" : dbc.totalOrdersCount > 1 ? "Repeat" : "New"),
        firstOrderDate: firstDateLabel,
        lastOrderDate: lastDateLabel,
        lastOrderTimestamp: ts,
        orderCount: dbc.totalOrdersCount,
        totalSpentNaira: dbc.lifetimeSpendNaira,
        totalSpentFormatted: dbc.lifetimeSpendFormatted,
        hasWebsiteOrders: false,
        notes: dbc.notes,
        orders: [],
      });
    }

    return Array.from(customerMap.values()).sort(
      (a, b) => b.lastOrderTimestamp - a.lastOrderTimestamp
    );
  }, [orders, dbCustomers]);

  // Dynamically derive selectedCustomer so updates to orders/totals instantly reflect
  const selectedCustomer = selectedCustomerPhone
    ? customers.find(
        (c) => c.key === selectedCustomerPhone || c.phone === selectedCustomerPhone
      ) ?? null
    : null;

  // Filtered list
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery) ||
        c.location.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTag = selectedTag === "ALL" || c.tag === selectedTag;
      return matchesSearch && matchesTag;
    });
  }, [customers, searchQuery, selectedTag]);

  // CSV Export
  const handleExportCSV = () => {
    const headers = ["Customer ID", "Name", "Phone", "Email", "Location", "Tag", "Total Orders", "Total Spent (NGN)"];
    const rows = filteredCustomers.map((c) => [
      c.id,
      `"${c.name}"`,
      c.phone,
      c.email,
      `"${c.location}"`,
      c.tag,
      c.orderCount,
      c.totalSpentNaira,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `caterlog-customers-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddNote = async (cust: CustomerProfile) => {
    if (!newNoteInput.trim()) return;
    const existingNotes = customerNotes[cust.phone] ?? cust.notes ?? "";
    const combined = existingNotes
      ? `${existingNotes}\n• ${newNoteInput.trim()}`
      : `• ${newNoteInput.trim()}`;
    setCustomerNotes((prev) => ({
      ...prev,
      [cust.phone]: combined,
    }));
    setNewNoteInput("");
    setSavingNote(true);
    try {
      const res = await api.upsertCustomer({
        whatsappPhone: cust.phone,
        name: cust.name,
        notes: combined,
      });
      onStateChange?.(res.state);
      setToastMsg("✓ Customer note saved to PostgreSQL!");
      setTimeout(() => setToastMsg(null), 3000);
    } finally {
      setSavingNote(false);
    }
  };

  const handleCreateCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim()) return;
    setSavingCustomer(true);
    try {
      const res = await api.upsertCustomer({
        whatsappPhone: newCustPhone.trim(),
        name: newCustName.trim(),
        email: newCustEmail.trim() || undefined,
        defaultAddress: newCustAddress.trim() || undefined,
        segmentOverride: newCustSegment,
        notes: newCustNote.trim() ? `• ${newCustNote.trim()}` : undefined,
      });
      onStateChange?.(res.state);
      setShowAddCustomerModal(false);
      setNewCustName("");
      setNewCustPhone("+234");
      setNewCustEmail("");
      setNewCustAddress("");
      setNewCustNote("");
      setToastMsg(`✓ Added ${res.customer.name} to Customers CRM in PostgreSQL!`);
      setTimeout(() => setToastMsg(null), 3500);
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleSendBroadcastSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bcastMessage.trim()) return;
    setSendingBroadcast(true);
    try {
      const res = await api.sendCustomerBroadcast({
        segment: bcastSegment,
        channel: bcastChannel,
        messageText: bcastMessage.trim(),
        includePromoCode: bcastPromoCode.trim() || undefined,
        includeStoreLink: bcastIncludeLink,
      });
      onStateChange?.(res.state);
      setBroadcastReceipt({
        recipientCount: res.recipientCount,
        segment: res.segment,
        channel: res.channel,
      });
    } finally {
      setSendingBroadcast(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto">
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0d5c3a] text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-xl animate-popup-spring">
          {toastMsg}
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">Customers</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Directory of buyers, purchase history, persistent CRM notes, and direct WhatsApp broadcast campaigns.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setBroadcastReceipt(null);
              setShowBroadcastModal(true);
            }}
            className="text-xs font-bold px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 hover:bg-emerald-100 transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>📢 Send Broadcast / Recovery Blast</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAddCustomerModal(true)}
            className="text-xs font-bold px-3.5 py-2 rounded-xl bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>+ Add Customer</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="text-xs font-semibold px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>↓ Export CSV</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-400">Total Customers</div>
          <div className="text-2xl font-extrabold text-gray-900 mt-2">{customers.length}</div>
          <div className="text-xs text-gray-400 mt-1">
            {customers.length === 0 ? "Awaiting first customer" : "Active verified buyers"}
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-400">Repeat Buyers</div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-2">
            {customers.filter((c) => c.tag === "Repeat" || c.tag === "VIP").length}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {customers.length === 0
              ? "0% repeat rate"
              : `${Math.round(
                  (customers.filter((c) => c.tag === "Repeat" || c.tag === "VIP").length / customers.length) * 100
                )}% retention rate`}
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-400">Average Lifetime Value</div>
          <div className="text-2xl font-extrabold text-gray-900 mt-2">
            ₦
            {customers.length === 0
              ? "0"
              : Math.round(
                  customers.reduce((acc, c) => acc + c.totalSpentNaira, 0) / customers.length
                ).toLocaleString()}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {customers.length === 0 ? "Awaiting first sale" : "Across all order channels"}
          </div>
        </div>
      </div>

      {/* Customers Content */}
      {customers.length === 0 ? (
        <EmptyState
          badge="Customer Directory"
          icon="👥"
          title="Customer Directory is Empty"
          description="When customers message your connected WhatsApp Business account or purchase through your store link, their profile, phone number, order history, and delivery addresses will automatically populate here."
        />
      ) : (
        <>
          {/* Search & Tag Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 text-xs">🔍</span>
              <input
                type="text"
                placeholder="Search by name, phone, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-gray-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {(["ALL", "VIP", "Repeat", "New"] as const).map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedTag === tag
                      ? "bg-emerald-600 text-white shadow-2xs"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {tag === "ALL" ? "All" : tag}
                </button>
              ))}
            </div>
          </div>

          {/* Customers Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[700px]">
                <thead className="bg-gray-50/60 text-[11px] uppercase font-bold text-gray-400 border-b border-gray-100">
                  <tr>
                    <th className="py-3 px-6">Customer</th>
                    <th className="py-3 px-6">Contact / Location</th>
                    <th className="py-3 px-6">Orders</th>
                    <th className="py-3 px-6">Lifetime Value</th>
                    <th className="py-3 px-6">Segment</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-400 text-sm">
                        No customers found matching &quot;{searchQuery}&quot;
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0">
                              {c.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 text-xs flex items-center gap-1.5">
                                <span>{c.name}</span>
                                {c.hasWebsiteOrders && (
                                  <span className="px-1.5 py-0.2 rounded-xs bg-indigo-50 text-indigo-700 border border-indigo-200 text-[9px] font-bold uppercase">
                                    Website
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-gray-400">{c.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-xs text-gray-600">
                          <div className="font-mono text-gray-700">{c.phone}</div>
                          <div className="text-[11px] text-gray-400">{c.location}</div>
                        </td>
                        <td className="py-4 px-6 font-semibold text-gray-900 text-xs">
                          {c.orderCount} {c.orderCount === 1 ? "order" : "orders"}
                        </td>
                        <td className="py-4 px-6 font-bold text-gray-900 text-xs">
                          {c.totalSpentFormatted}
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                              c.tag === "VIP"
                                ? "bg-purple-50 text-purple-700 border border-purple-200"
                                : c.tag === "Repeat"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-blue-50 text-blue-700 border border-blue-200"
                            }`}
                          >
                            {c.tag}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <a
                              href={`https://wa.me/${c.phone.replace(/\+/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center gap-1"
                              title="Chat on WhatsApp"
                            >
                              <span>WA</span>
                            </a>
                            <button
                              onClick={() => setSelectedCustomerPhone(c.key)}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                            >
                              Profile
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Customer Profile Modal (Matching Customer Profile & History.png) */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 p-6 sm:p-8 animate-in fade-in duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-gray-100 pb-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 font-extrabold text-xl flex items-center justify-center shrink-0">
                  {selectedCustomer.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-gray-900">{selectedCustomer.name}</h2>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        selectedCustomer.tag === "VIP"
                          ? "bg-purple-100 text-purple-800"
                          : selectedCustomer.tag === "Repeat"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {selectedCustomer.tag} Buyer
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3">
                    <span>{selectedCustomer.phone}</span>
                    <span>•</span>
                    <span>{selectedCustomer.location}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomerPhone(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg text-lg"
              >
                ✕
              </button>
            </div>

            {/* Quick Action Bar */}
            <div className="flex items-center gap-2 py-4 border-b border-gray-100">
              <a
                href={`https://wa.me/${selectedCustomer.phone.replace(/\+/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <span>Chat on WhatsApp</span>
              </a>
              {onNavigateToPaymentLinks && (
                <button
                  onClick={() => {
                    onNavigateToPaymentLinks(selectedCustomer.name);
                    setSelectedCustomerPhone(null);
                  }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <span>Create Payment Link</span>
                </button>
              )}
            </div>

            {/* Metric Overview Cards */}
            <div className="grid grid-cols-3 gap-3 my-5">
              <div className="bg-gray-50 p-3.5 rounded-xl text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Spent</div>
                <div className="text-base font-extrabold text-gray-900 mt-1">{selectedCustomer.totalSpentFormatted}</div>
              </div>
              <div className="bg-gray-50 p-3.5 rounded-xl text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Orders</div>
                <div className="text-base font-extrabold text-gray-900 mt-1">{selectedCustomer.orderCount}</div>
              </div>
              <div className="bg-gray-50 p-3.5 rounded-xl text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Customer Since</div>
                <div className="text-base font-extrabold text-gray-900 mt-1">{selectedCustomer.firstOrderDate}</div>
              </div>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-gray-100 mb-4 text-xs font-semibold">
              <button
                onClick={() => setActiveTab("overview")}
                className={`pb-2.5 px-3 border-b-2 transition-all ${
                  activeTab === "overview"
                    ? "border-emerald-600 text-emerald-700 font-bold"
                    : "border-transparent text-gray-500 hover:text-gray-900"
                }`}
              >
                Profile & Delivery
              </button>
              <button
                onClick={() => setActiveTab("orders")}
                className={`pb-2.5 px-3 border-b-2 transition-all ${
                  activeTab === "orders"
                    ? "border-emerald-600 text-emerald-700 font-bold"
                    : "border-transparent text-gray-500 hover:text-gray-900"
                }`}
              >
                Order History ({selectedCustomer.orders.length})
              </button>
              <button
                onClick={() => setActiveTab("notes")}
                className={`pb-2.5 px-3 border-b-2 transition-all ${
                  activeTab === "notes"
                    ? "border-emerald-600 text-emerald-700 font-bold"
                    : "border-transparent text-gray-500 hover:text-gray-900"
                }`}
              >
                Merchant Notes
              </button>
            </div>

            {/* Tab: Overview */}
            {activeTab === "overview" && (
              <div className="space-y-4 text-xs">
                <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-2.5">
                  <div className="text-xs font-bold text-gray-900">Delivery Address & Information</div>
                  <div className="text-gray-600">{selectedCustomer.location}</div>
                  <div className="text-gray-400 text-[11px]">Primary delivery zone: Lagos Mainland / Island</div>
                </div>

                <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-4 space-y-2">
                  <div className="text-xs font-bold text-emerald-900">Assigned Monnify NUBAN Channel</div>
                  <div className="font-mono text-emerald-800 text-sm font-bold">
                    {selectedCustomer.orders[0]?.accountNumber || "7821948301"} · Wema Bank
                  </div>
                  <div className="text-[11px] text-emerald-700">
                    All bank transfers sent to this virtual account automatically reserve inventory and notify the merchant.
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Orders */}
            {activeTab === "orders" && (
              <div className="space-y-3">
                {selectedCustomer.orders.length === 0 ? (
                  <div className="text-center py-8 text-xs text-gray-400">
                    No orders on record yet. Create a payment link above to generate their first transaction!
                  </div>
                ) : (
                  selectedCustomer.orders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-3.5 rounded-xl border border-gray-100 flex items-center justify-between hover:bg-gray-50/70 transition-colors"
                    >
                      <div>
                        <div className="font-mono text-xs font-bold text-gray-800">{ord.shortCode}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{ord.productName}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          {new Date(ord.createdAt).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-gray-900">{ord.totalAmountFormatted}</div>
                        <span
                          className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            ord.status === "PAID"
                              ? "bg-emerald-50 text-emerald-700"
                              : ord.status === "PROCESSING"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {ord.status}
                        </span>
                        {onSelectOrder && (
                          <div className="mt-1">
                            <button
                              onClick={() => {
                                onSelectOrder(ord);
                                setSelectedCustomerPhone(null);
                              }}
                              className="text-[11px] text-emerald-600 hover:text-emerald-800 font-semibold"
                            >
                              Inspect Order ↗
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab: Notes */}
            {activeTab === "notes" && (
              <div className="space-y-4 text-xs">
                <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3.5 text-gray-700">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-amber-900">
                      Customer Preferences &amp; CRM Notes:
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Synced with PostgreSQL
                    </span>
                  </div>
                  <p className="whitespace-pre-line text-xs">
                    {customerNotes[selectedCustomer.phone] ||
                      selectedCustomer.notes ||
                      "No notes recorded yet for this customer."}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-700">Add Merchant Note</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Requested expedited dispatch next time..."
                      value={newNoteInput}
                      onChange={(e) => setNewNoteInput(e.target.value)}
                      className="flex-1 bg-white border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-gray-900 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      disabled={savingNote}
                      onClick={() => void handleAddNote(selectedCustomer)}
                      className="bg-[#0d5c3a] hover:bg-[#0b4b2f] disabled:opacity-50 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-colors shadow-2xs cursor-pointer"
                    >
                      {savingNote ? "Saving..." : "Save to DB"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Standalone Popup 1: Add Customer to CRM */}
      {showAddCustomerModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-md flex items-center justify-center p-4 animate-backdrop-fade"
          onClick={() => setShowAddCustomerModal(false)}
        >
          <form
            onSubmit={handleCreateCustomerSubmit}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-[28px] max-w-lg w-full p-6 sm:p-8 shadow-[0_28px_80px_-12px_rgba(15,23,42,0.18)] border border-slate-200/80 space-y-5 text-xs animate-popup-spring"
          >
            <div className="flex items-start justify-between border-b border-gray-100 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Catlog Customer Directory
                </span>
                <h3 className="text-lg font-extrabold text-gray-900 mt-1">
                  Add Customer to CRM
                </h3>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Save a walk-in, phone, or social DM buyer directly to your PostgreSQL customer directory.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCustomerModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tunde Bakare"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 font-semibold focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">WhatsApp Phone *</label>
                <input
                  type="text"
                  required
                  placeholder="+234803..."
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 font-mono focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Email (Optional)</label>
                <input
                  type="email"
                  placeholder="buyer@email.com"
                  value={newCustEmail}
                  onChange={(e) => setNewCustEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Buyer Segment Tag</label>
                <select
                  value={newCustSegment}
                  onChange={(e) =>
                    setNewCustSegment(e.target.value as "New" | "Repeat" | "VIP")
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white font-semibold"
                >
                  <option value="New">New Buyer</option>
                  <option value="Repeat">Repeat Buyer</option>
                  <option value="VIP">VIP Client</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block font-bold text-gray-700 mb-1">Default Delivery Address</label>
                <input
                  type="text"
                  placeholder="e.g. 22 Admiralty Way, Lekki Phase 1, Lagos"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-bold text-gray-700 mb-1">Initial Merchant Note</label>
                <input
                  type="text"
                  placeholder="e.g. Sizing preference: EU 40, prefers morning dispatch"
                  value={newCustNote}
                  onChange={(e) => setNewCustNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowAddCustomerModal(false)}
                className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingCustomer}
                className="px-5 py-2.5 rounded-xl bg-[#0d5c3a] hover:bg-[#0b4b2f] disabled:opacity-50 text-white font-bold shadow-xs cursor-pointer"
              >
                {savingCustomer ? "Saving to DB..." : "✓ Save Customer"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Standalone Popup 2: Customer Segment Broadcast & Abandoned Order Recovery */}
      {showBroadcastModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-md flex items-center justify-center p-4 animate-backdrop-fade"
          onClick={() => setShowBroadcastModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-[28px] max-w-xl w-full p-6 sm:p-8 shadow-[0_28px_80px_-12px_rgba(15,23,42,0.18)] border border-slate-200/80 space-y-5 text-xs animate-popup-spring"
          >
            {broadcastReceipt ? (
              <div className="text-center space-y-4 py-2">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center text-3xl mx-auto">
                  📢
                </div>
                <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Campaign Dispatched &amp; Logged
                </span>
                <h3 className="text-xl font-extrabold text-gray-900">
                  Sent to {broadcastReceipt.recipientCount} Buyer
                  {broadcastReceipt.recipientCount === 1 ? "" : "s"}!
                </h3>
                <p className="text-xs text-gray-500 max-w-md mx-auto">
                  Your {broadcastReceipt.channel} campaign was delivered to the{" "}
                  <strong>{broadcastReceipt.segment}</strong> customer segment and recorded in your Co-Pilot activity log.
                </p>
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className="px-6 py-2.5 rounded-xl bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white font-bold cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendBroadcastSubmit} className="space-y-4">
                <div className="flex items-start justify-between border-b border-gray-100 pb-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Catlog CRM Retargeting &amp; Recovery
                    </span>
                    <h3 className="text-lg font-extrabold text-gray-900 mt-1">
                      Send Segment Broadcast or Payment Reminder
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Announce restocks, share promo codes, or nudge shoppers with pending unpaid orders.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBroadcastModal(false)}
                    className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Target Audience Segment
                    </label>
                    <select
                      value={bcastSegment}
                      onChange={(e) =>
                        setBcastSegment(
                          e.target.value as
                            | "ALL"
                            | "VIP"
                            | "Repeat"
                            | "New"
                            | "PENDING_ORDERS"
                        )
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white font-semibold"
                    >
                      <option value="ALL">All Customers ({customers.length})</option>
                      <option value="VIP">
                        VIP Buyers ({customers.filter((c) => c.tag === "VIP").length})
                      </option>
                      <option value="Repeat">
                        Repeat Buyers ({customers.filter((c) => c.tag === "Repeat").length})
                      </option>
                      <option value="New">
                        New Buyers ({customers.filter((c) => c.tag === "New").length})
                      </option>
                      <option value="PENDING_ORDERS">
                        ⏳ Unpaid / Abandoned Orders (
                        {
                          orders.filter(
                            (o) =>
                              o.status === "PENDING_PAYMENT" ||
                              o.status === "PARTIALLY_PAID"
                          ).length
                        }
                        )
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Delivery Channel
                    </label>
                    <select
                      value={bcastChannel}
                      onChange={(e) =>
                        setBcastChannel(
                          e.target.value as "WHATSAPP" | "INSTAGRAM" | "SMS"
                        )
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white font-semibold"
                    >
                      <option value="WHATSAPP">💬 WhatsApp Business Cloud</option>
                      <option value="INSTAGRAM">📸 Instagram Direct Message</option>
                      <option value="SMS">📱 Direct SMS Notification</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-gray-700">
                      Message Body (Use {"{name}"} for buyer&apos;s first name)
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setBcastMessage(
                          "Hi {name}! Your reserved items are waiting for you. Complete your transfer before your stock hold expires or reply if you need assistance!"
                        )
                      }
                      className="text-[11px] font-semibold text-emerald-700 hover:underline cursor-pointer"
                    >
                      Use Abandoned Cart Template
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    required
                    value={bcastMessage}
                    onChange={(e) => setBcastMessage(e.target.value)}
                    className="w-full p-3 rounded-xl border border-gray-200 focus:outline-none focus:border-emerald-600 leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-center bg-[#F8FAFC] p-3.5 rounded-2xl border border-slate-200/80">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Attach Promo Voucher (Optional)
                    </label>
                    <select
                      value={bcastPromoCode}
                      onChange={(e) => setBcastPromoCode(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white font-mono font-bold"
                    >
                      <option value="">No Promo Code</option>
                      {discounts.map((d) => (
                        <option key={d.id} value={d.code}>
                          {d.code} ({d.label})
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer pt-4">
                    <input
                      type="checkbox"
                      checked={bcastIncludeLink}
                      onChange={(e) => setBcastIncludeLink(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                    <span className="font-semibold text-gray-700">
                      Append Direct Storefront Link
                    </span>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowBroadcastModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sendingBroadcast}
                    className="px-5 py-2.5 rounded-xl bg-[#0d5c3a] hover:bg-[#0b4b2f] disabled:opacity-50 text-white font-bold shadow-xs cursor-pointer"
                  >
                    {sendingBroadcast ? "Dispatching..." : "📢 Send Broadcast Now"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
