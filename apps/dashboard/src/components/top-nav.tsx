import React, { useState, useMemo } from "react";
import { SearchIcon, BellIcon, MenuIcon, CheckIcon } from "./icons";
import type { VendorProfile, OrderItem, ProductItem } from "@/lib/types";

interface TopNavProps {
  vendor: VendorProfile;
  connected?: boolean;
  onOpenSimulator?: () => void;
  simulatorOpen?: boolean;
  breadcrumb?: string;
  activeWorkspace?: "reseller" | "supplier";
  onToggleWorkspace?: () => void;
  onOpenMobileNav?: () => void;
  orders?: OrderItem[];
  products?: ProductItem[];
  onSelectOrder?: (order: OrderItem) => void;
  onSelectProduct?: (sku: string) => void;
  onNavigateToView?: (view: string) => void;
  onSignOut?: () => void;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: "settlement" | "order" | "stock" | "verification";
}

export function TopNav({
  vendor,
  connected = true,
  onOpenSimulator,
  simulatorOpen = false,
  breadcrumb = "Overview",
  activeWorkspace = "reseller",
  onToggleWorkspace,
  onOpenMobileNav,
  orders = [],
  products = [],
  onSelectOrder,
  onSelectProduct,
  onNavigateToView,
  onSignOut,
}: TopNavProps) {
  const initials = vendor.businessName
    ? vendor.businessName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() || "")
        .join("") || (activeWorkspace === "reseller" ? "NS" : "AW")
    : activeWorkspace === "reseller" ? "NS" : "AW";

  // Search Palette State
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Notifications State (dynamically derived from live orders and catalog)
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readNotifIds, setReadNotifIds] = useState<Set<string>>(() => new Set());

  const notifications = useMemo<NotificationItem[]>(() => {
    const list: NotificationItem[] = [];

    const getTimeAgo = (dateStr?: string) => {
      if (!dateStr) return "Just now";
      try {
        const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
        if (diff < 60) return "Just now";
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
      } catch {
        return "Recently";
      }
    };

    // 1. Confirmed / Paid orders
    orders
      .filter((o) => o.status === "PAID")
      .slice(0, 4)
      .forEach((o) => {
        const id = `notif-paid-${o.id}`;
        list.push({
          id,
          title: `Payment Confirmed · ${o.shortCode}`,
          message: `₦${o.totalAmountNaira.toLocaleString()} received from ${o.customerName} via Monnify.`,
          timestamp: getTimeAgo(o.paidAt || o.createdAt),
          read: readNotifIds.has(id),
          type: "settlement",
        });
      });

    // 2. Dispatched / En Route
    orders
      .filter((o) => o.status === "OUT_FOR_DELIVERY")
      .slice(0, 2)
      .forEach((o) => {
        const id = `notif-dispatch-${o.id}`;
        list.push({
          id,
          title: `Order Dispatched · ${o.shortCode}`,
          message: `Package en route to ${o.customerName}${o.deliveryAddress ? ` (${o.deliveryAddress})` : ""}.`,
          timestamp: getTimeAgo(o.createdAt),
          read: readNotifIds.has(id),
          type: "order",
        });
      });

    // 3. New Orders Placed
    orders
      .filter((o) => o.status === "PENDING_PAYMENT")
      .slice(0, 3)
      .forEach((o) => {
        const id = `notif-pending-${o.id}`;
        list.push({
          id,
          title: `New Order Placed · ${o.shortCode}`,
          message: `${o.customerName} placed order for ${o.quantity}x ${o.productName}. Awaiting transfer.`,
          timestamp: getTimeAgo(o.createdAt),
          read: readNotifIds.has(id),
          type: "order",
        });
      });

    // 4. Low stock products
    products
      .filter((p) => p.stockTotal <= 3)
      .slice(0, 2)
      .forEach((p) => {
        const id = `notif-stock-${p.id}`;
        list.push({
          id,
          title: `Low Stock Alert · ${p.skuCode}`,
          message: `${p.name} has only ${p.stockTotal} items remaining.`,
          timestamp: "Alert",
          read: readNotifIds.has(id),
          type: "stock",
        });
      });

    // 5. System verification notice
    const verifId = "notif-cac-verified";
    list.push({
      id: verifId,
      title: "CAC Business Verified",
      message: "Your Nigerian NUBAN settlement channel is fully verified with Monnify.",
      timestamp: "Active",
      read: readNotifIds.has(verifId),
      type: "verification",
    });

    return list;
  }, [orders, products, readNotifIds]);

  // Profile Menu State
  const [profileOpen, setProfileOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = () => {
    setReadNotifIds(new Set(notifications.map((n) => n.id)));
  };

  // Search Results
  const matchingOrders = orders.filter(
    (o) =>
      o.shortCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.productName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const matchingProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.skuCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <header className="h-14 bg-white border-b border-gray-100 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20">
        {/* Left: Mobile Hamburger & Breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobileNav}
            className="p-1.5 -ml-1 text-gray-500 hover:text-gray-800 rounded-lg hover:bg-gray-100 lg:hidden"
            title="Open navigation menu"
          >
            <MenuIcon className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
            <span className="font-semibold text-gray-900 hidden sm:inline">Caterlog</span>
            <span className="text-gray-300 hidden sm:inline">/</span>
            <span className="truncate max-w-[160px] sm:max-w-none">{breadcrumb}</span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Toggle WhatsApp Simulator Live Test Drawer */}
          <button
            onClick={onOpenSimulator}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              simulatorOpen
                ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                : "bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200"
            }`}
            title="Open interactive WhatsApp Simulation Drawer"
          >
            <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`} />
            <span className="hidden sm:inline">WhatsApp Simulator</span>
            <span className="sm:hidden">Simulator</span>
          </button>

          {/* Quick Search Button */}
          <button
            onClick={() => setSearchOpen(true)}
            className="p-1.5 text-gray-500 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors"
            title="Quick search (orders, SKUs, customers)"
          >
            <SearchIcon className="w-4 h-4" />
          </button>

          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => {
                setNotificationsOpen(!notificationsOpen);
                setProfileOpen(false);
              }}
              className="p-1.5 text-gray-500 hover:text-gray-800 rounded-lg hover:bg-gray-100 relative transition-colors"
              title="Notifications"
            >
              <BellIcon className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
              )}
            </button>

            {/* Notification Popover Dropdown (Matching Notifications & Alerts.png) */}
            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-sm bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-50 animate-in fade-in duration-100">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-900">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto my-2">
                  {notifications.map((n) => {
                    const matchingOrder = orders.find((o) => n.id.includes(o.id));
                    return (
                      <div
                        key={n.id}
                        onClick={() => {
                          if (matchingOrder && onSelectOrder) {
                            onSelectOrder(matchingOrder);
                            setNotificationsOpen(false);
                          }
                          setReadNotifIds((prev) => new Set([...prev, n.id]));
                        }}
                        className={`py-3 px-2 rounded-xl transition-colors cursor-pointer hover:bg-gray-50 ${
                          !n.read ? "bg-emerald-50/40" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-bold text-gray-900">{n.title}</span>
                          <span className="text-[10px] text-gray-400 shrink-0">{n.timestamp}</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1 leading-relaxed">{n.message}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                  <button
                    onClick={() => {
                      setNotificationsOpen(false);
                      onNavigateToView?.("notifications");
                    }}
                    className="font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                  >
                    View All in Alerts Center →
                  </button>
                  <button
                    onClick={() => {
                      setNotificationsOpen(false);
                      onNavigateToView?.("settings");
                    }}
                    className="text-gray-400 hover:text-gray-700 cursor-pointer"
                  >
                    Preferences
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Profile Avatar & Account Menu */}
          <div className="relative">
            <button
              onClick={() => {
                setProfileOpen(!profileOpen);
                setNotificationsOpen(false);
              }}
              className="w-7 h-7 rounded-full bg-[#eef2ff] text-[#1e1b4b] border border-indigo-200 flex items-center justify-center font-bold text-xs hover:ring-2 hover:ring-emerald-400 transition-all ml-1 cursor-pointer"
              title="Merchant Account"
            >
              {initials}
            </button>

            {/* Profile Dropdown */}
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-50">
                <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                  <div className="w-10 h-10 rounded-full bg-[#eef2ff] text-[#1e1b4b] flex items-center justify-center font-bold text-sm shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-gray-900 truncate">{vendor.businessName}</div>
                    <button
                      onClick={() => {
                        onNavigateToView?.("verification");
                        setProfileOpen(false);
                      }}
                      className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <CheckIcon className="w-3 h-3" />
                      <span>CAC Verified Merchant →</span>
                    </button>
                  </div>
                </div>

                <div className="py-2 space-y-1">
                  <button
                    onClick={() => {
                      onNavigateToView?.("verification");
                      setProfileOpen(false);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    Business Verification (KYC)
                  </button>

                  <button
                    onClick={() => {
                      onNavigateToView?.("shipping");
                      setProfileOpen(false);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    Delivery &amp; Shipping Zones
                  </button>

                  <button
                    onClick={() => {
                      onNavigateToView?.("team");
                      setProfileOpen(false);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    Team &amp; Activity Audit Log
                  </button>

                  <button
                    onClick={() => {
                      onNavigateToView?.("notifications");
                      setProfileOpen(false);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    Notification Center
                  </button>

                  <button
                    onClick={() => {
                      onNavigateToView?.("settings");
                      setProfileOpen(false);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    Settings &amp; Webhooks
                  </button>

                  <a
                    href="https://wa.me/2348000000000"
                    target="_blank"
                    rel="noreferrer"
                    className="block px-2 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    Merchant Support (WhatsApp)
                  </a>

                  <div className="pt-2 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        onSignOut?.();
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <span>Sign out</span>
                      <span className="text-[10px] text-gray-400">Esc</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Quick Search Palette Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="p-4 border-b border-gray-100 flex items-center gap-3">
              <SearchIcon className="w-5 h-5 text-gray-400" />
              <input
                type="text"
                autoFocus
                placeholder="Search orders, products, or customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm text-gray-900 focus:outline-none"
              />
              <button
                onClick={() => setSearchOpen(false)}
                className="text-xs font-bold text-gray-400 hover:text-gray-700 px-2 py-1 rounded-md"
              >
                ESC
              </button>
            </div>

            <div className="p-3 max-h-80 overflow-y-auto space-y-4">
              {searchQuery.trim() === "" ? (
                <div className="py-8 text-center text-xs text-gray-400">
                  Type an order reference (e.g. CT-1042), product name, or customer name...
                </div>
              ) : (
                <>
                  {matchingOrders.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase font-bold text-gray-400 px-2 mb-1">Orders</div>
                      <div className="space-y-1">
                        {matchingOrders.slice(0, 4).map((o) => (
                          <div
                            key={o.id}
                            onClick={() => {
                              onSelectOrder?.(o);
                              setSearchOpen(false);
                            }}
                            className="p-2 rounded-xl hover:bg-emerald-50/60 cursor-pointer flex items-center justify-between transition-colors"
                          >
                            <div>
                              <div className="text-xs font-bold text-gray-900">
                                {o.shortCode} — {o.customerName}
                              </div>
                              <div className="text-[11px] text-gray-400">{o.productName}</div>
                            </div>
                            <span className="text-xs font-bold text-gray-900">{o.totalAmountFormatted}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {matchingProducts.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase font-bold text-gray-400 px-2 mb-1">Products</div>
                      <div className="space-y-1">
                        {matchingProducts.slice(0, 4).map((p) => (
                          <div
                            key={p.id}
                            onClick={() => {
                              onSelectProduct?.(p.skuCode);
                              setSearchOpen(false);
                            }}
                            className="p-2 rounded-xl hover:bg-emerald-50/60 cursor-pointer flex items-center justify-between transition-colors"
                          >
                            <div>
                              <div className="text-xs font-bold text-gray-900">{p.name}</div>
                              <div className="text-[11px] text-gray-400 font-mono">{p.skuCode}</div>
                            </div>
                            <span className="text-xs font-bold text-gray-900">{p.basePriceFormatted}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {matchingOrders.length === 0 && matchingProducts.length === 0 && (
                    <div className="py-6 text-center text-xs text-gray-400">
                      No results matching &quot;{searchQuery}&quot;
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
