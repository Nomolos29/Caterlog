import React, { useState, useMemo } from "react";
import type { OrderItem } from "@/lib/types";

interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  location: string;
  firstOrderDate: string;
  lastOrderDate: string;
  orderCount: number;
  totalSpentNaira: number;
  totalSpentFormatted: string;
  tag: "VIP" | "Repeat" | "New";
  notes?: string;
  orders: OrderItem[];
}

interface CustomersViewProps {
  orders: OrderItem[];
  onSelectOrder?: (order: OrderItem) => void;
  onNavigateToPaymentLinks?: (customerName: string) => void;
}

export function CustomersView({
  orders,
  onSelectOrder,
  onNavigateToPaymentLinks,
}: CustomersViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<"ALL" | "VIP" | "Repeat" | "New">("ALL");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "orders" | "notes">("overview");
  const [customerNotes, setCustomerNotes] = useState<Record<string, string>>({
    "08031234567": "Prefers morning deliveries before 11 AM. Gate code #402.",
  });
  const [newNoteInput, setNewNoteInput] = useState("");

  // Aggregate customers from orders + sample Nigerian shoppers
  const customers: CustomerProfile[] = useMemo(() => {
    const customerMap = new Map<string, CustomerProfile>();

    // Seed realistic Nigerian customers
    const defaultData = [
      {
        id: "cust-1",
        name: "Ada Okafor",
        phone: "+2348031234567",
        email: "ada.okafor@gmail.com",
        location: "Lekki Phase 1, Lagos",
        tag: "VIP" as const,
        firstOrderDate: "12 Aug 2026",
        notes: "Prefers morning deliveries before 11 AM. Gate code #402.",
      },
      {
        id: "cust-2",
        name: "Tunde Bello",
        phone: "+2348029876543",
        email: "tunde.bello@outlook.com",
        location: "Ikeja GRA, Lagos",
        tag: "Repeat" as const,
        firstOrderDate: "04 Sep 2026",
      },
      {
        id: "cust-3",
        name: "Zainab Musa",
        phone: "+2348145556789",
        email: "zainab.musa@yahoo.com",
        location: "Wuse 2, Abuja",
        tag: "New" as const,
        firstOrderDate: "28 Oct 2026",
      },
      {
        id: "cust-4",
        name: "Chukwuma Eze",
        phone: "+2348051122334",
        email: "c.eze@technigeria.ng",
        location: "Yaba, Lagos",
        tag: "Repeat" as const,
        firstOrderDate: "15 Sep 2026",
      },
    ];

    for (const d of defaultData) {
      customerMap.set(d.phone, {
        ...d,
        lastOrderDate: "02 Nov 2026",
        orderCount: 0,
        totalSpentNaira: 0,
        totalSpentFormatted: "₦0",
        orders: [],
      });
    }

    // Process actual orders
    for (const o of orders) {
      const phone = o.customerPhone || "+2348031234567";
      const existing = customerMap.get(phone);
      if (existing) {
        existing.orderCount += 1;
        existing.totalSpentNaira += o.totalAmountNaira;
        existing.totalSpentFormatted = `₦${existing.totalSpentNaira.toLocaleString()}`;
        existing.orders.push(o);
        existing.lastOrderDate = new Date(o.createdAt).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
        if (existing.orderCount > 3) existing.tag = "VIP";
        else if (existing.orderCount > 1) existing.tag = "Repeat";
      } else {
        customerMap.set(phone, {
          id: `cust-${customerMap.size + 1}`,
          name: o.customerName,
          phone: o.customerPhone,
          email: `${o.customerName.toLowerCase().replace(/\s+/g, ".")}@example.com`,
          location: o.shippingZoneName || "Lagos, Nigeria",
          tag: "New",
          firstOrderDate: new Date(o.createdAt).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }),
          lastOrderDate: new Date(o.createdAt).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }),
          orderCount: 1,
          totalSpentNaira: o.totalAmountNaira,
          totalSpentFormatted: o.totalAmountFormatted,
          orders: [o],
        });
      }
    }

    // Default values if no orders attached yet
    for (const c of customerMap.values()) {
      if (c.orderCount === 0) {
        c.orderCount = 2;
        c.totalSpentNaira = 75000;
        c.totalSpentFormatted = "₦75,000";
      }
    }

    return Array.from(customerMap.values());
  }, [orders]);

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

  const handleAddNote = (phone: string) => {
    if (!newNoteInput.trim()) return;
    setCustomerNotes((prev) => ({
      ...prev,
      [phone]: prev[phone] ? `${prev[phone]}\n• ${newNoteInput.trim()}` : `• ${newNoteInput.trim()}`,
    }));
    setNewNoteInput("");
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">Customers</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Directory of buyers, purchase history, and direct WhatsApp communication channels.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="text-xs font-semibold px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors shadow-2xs flex items-center gap-1.5"
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
          <div className="text-xs text-emerald-600 font-semibold mt-1">Active verified Nigerian buyers</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-400">Repeat Buyers</div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-2">
            {customers.filter((c) => c.tag === "Repeat" || c.tag === "VIP").length}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {Math.round(
              (customers.filter((c) => c.tag === "Repeat" || c.tag === "VIP").length / (customers.length || 1)) * 100
            )}
            % retention rate
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-400">Average Lifetime Value</div>
          <div className="text-2xl font-extrabold text-gray-900 mt-2">
            ₦
            {Math.round(
              customers.reduce((acc, c) => acc + c.totalSpentNaira, 0) / (customers.length || 1)
            ).toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">Across all order channels</div>
        </div>
      </div>

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
                          <div className="font-semibold text-gray-900 text-xs">{c.name}</div>
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
                          onClick={() => setSelectedCustomer(c)}
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
                onClick={() => setSelectedCustomer(null)}
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
                    setSelectedCustomer(null);
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
                                setSelectedCustomer(null);
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
                  <div className="font-semibold text-amber-900 mb-1">Customer Preferences:</div>
                  <p className="whitespace-pre-line text-xs">
                    {customerNotes[selectedCustomer.phone] || "No notes recorded yet for this customer."}
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
                      onClick={() => handleAddNote(selectedCustomer.phone)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-colors shadow-2xs"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
