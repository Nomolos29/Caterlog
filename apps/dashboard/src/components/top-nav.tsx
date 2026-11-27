import React, { useState, useMemo } from "react";
import {
  SearchIcon,
  BellIcon,
  MenuIcon,
  WhatsAppBadgeIcon,
  InstagramBadgeIcon,
  FacebookMessengerBadgeIcon,
  SparklesIcon,
} from "./icons";
import type {
  VendorProfile,
  OrderItem,
  ProductItem,
  PlatformRole,
} from "@/lib/types";
import type { NavView } from "./sidebar";

interface TopNavProps {
  vendor: VendorProfile;
  connected?: boolean;
  onOpenSimulator?: () => void;
  simulatorOpen?: boolean;
  breadcrumb?: string;
  activeWorkspace?: PlatformRole;
  onOpenMobileNav?: () => void;
  orders?: OrderItem[];
  products?: ProductItem[];
  onSelectOrder?: (order: OrderItem) => void;
  onSelectProduct?: (sku: string) => void;
  onNavigateToView?: (view: string) => void;
  onSignOut?: () => void;
  onOpenTour?: (chapter?: NavView) => void;
  currentView?: NavView;
  onToggleWorkspace?: (role: PlatformRole) => void;
  onSelectRole?: (role: PlatformRole) => void;
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
  activeWorkspace = "growth",
  onOpenMobileNav,
  orders = [],
  products = [],
  onSelectOrder,
  onSelectProduct,
  onNavigateToView,
  onSignOut,
  onOpenTour,
  currentView = "overview",
  onToggleWorkspace,
  onSelectRole,
}: TopNavProps) {
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const initials = vendor.businessName
    ? vendor.businessName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() || "")
        .join("") || (activeWorkspace === "reseller" ? "NS" : "AW")
    : activeWorkspace === "reseller"
      ? "NS"
      : "AW";

  // Search Palette State
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Notifications State (dynamically derived from live orders and catalog)
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readNotifIds, setReadNotifIds] = useState<Set<string>>(
    () => new Set(),
  );

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
      message:
        "Your Nigerian NUBAN settlement channel is fully verified with Monnify.",
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
      o.productName.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const matchingProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.skuCode.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <>
      <header className="h-14 bg-white border-b border-gray-100 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20">
        {/* Left: Mobile Hamburger & Breadcrumb (Breadcrumb hidden on mobile) */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onOpenMobileNav}
            className="p-1.5 -ml-1 text-gray-500 hover:text-gray-800 rounded-lg hover:bg-gray-100 lg:hidden shrink-0"
            title="Open navigation menu"
          >
            <MenuIcon className="w-5 h-5" />
          </button>

          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500 font-medium min-w-0">
            <span className="font-semibold text-gray-900">
              Caterlog
            </span>
            <span className="text-gray-300">/</span>
            <span className="truncate">
              {breadcrumb}
            </span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* View-Aware Platform Tour Guide Trigger (Hidden on mobile header) */}
          {onOpenTour && (
            <button
              onClick={() => onOpenTour(currentView)}
              data-tour="top-tour-guide"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 transition-all cursor-pointer shadow-2xs active:scale-95 group whitespace-nowrap"
              title={`Learn how this screen (${breadcrumb}) works`}
            >
              <span className="text-sm group-hover:rotate-12 transition-transform">
                🧭
              </span>
              <span className="font-bold">Guide</span>
              <span className="hidden xl:inline text-emerald-800 font-normal">
                · {breadcrumb.split("/")[0].trim()}
              </span>
            </button>
          )}

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
                    <span className="text-xs font-bold text-gray-900">
                      Notifications
                    </span>
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
                    const matchingOrder = orders.find((o) =>
                      n.id.includes(o.id),
                    );
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
                          <span className="text-xs font-bold text-gray-900">
                            {n.title}
                          </span>
                          <span className="text-[10px] text-gray-400 shrink-0">
                            {n.timestamp}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                          {n.message}
                        </p>
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
                      onNavigateToView?.("notification-settings");
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
              className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full hover:bg-gray-100 transition-all ml-1 cursor-pointer"
              title="Merchant Account"
            >
              <span className="w-7 h-7 rounded-full bg-[#eef2ff] text-[#1e1b4b] border border-indigo-200 flex items-center justify-center font-bold text-xs">
                {initials}
              </span>
              <svg
                className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-150 ${
                  profileOpen ? "rotate-180" : ""
                }`}
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {/* Profile Dropdown */}
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-gray-100 p-3 z-50">
                <div className="flex items-center gap-3 pb-3 border-b border-gray-100 px-1">
                  <div className="w-9 h-9 rounded-full bg-[#eef2ff] text-[#1e1b4b] flex items-center justify-center font-bold text-xs shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-gray-900 truncate">
                      {vendor.businessName}
                    </div>
                    <div className="text-[11px] font-bold text-indigo-700">
                      {activeWorkspace === "reseller"
                        ? "Reseller"
                        : activeWorkspace === "starter"
                          ? "Starter Vendor"
                          : activeWorkspace === "growth"
                            ? "Growth Vendor"
                            : "Pro Concierge"}
                    </div>
                  </div>
                </div>

                <div className="pt-2 space-y-1">
                  <button
                    onClick={() => {
                      onNavigateToView?.("profile");
                      setProfileOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    Profile Settings
                  </button>

                  <button
                    onClick={() => {
                      onNavigateToView?.("settings");
                      setProfileOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    Settings
                  </button>

                  <div className="pt-1.5 mt-1 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        onSignOut?.();
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <span>Logout</span>
                      <span className="text-[10px] text-gray-400">Esc</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Floating Bottom-Right Omnichannel Simulator Dock */}
      {onOpenSimulator && !simulatorOpen && (
        <button
          type="button"
          onClick={onOpenSimulator}
          data-tour="top-simulator-btn"
          aria-label="Open Omnichannel Live Simulator"
          title="Open Omnichannel Live Simulator (WhatsApp, Instagram & Facebook)"
          className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 group flex items-center gap-3 p-1.5 sm:pr-4 rounded-full bg-white/95 backdrop-blur-xl border border-emerald-200/90 shadow-[0_18px_45px_-10px_rgba(13,92,58,0.28),0_4px_14px_-2px_rgba(15,23,42,0.08)] hover:shadow-[0_22px_50px_-8px_rgba(13,92,58,0.38)] hover:border-emerald-400 transition-all duration-300 cursor-pointer active:scale-95"
        >
          {/* Primary Emerald Chat & AI Co-Pilot Orb */}
          <div className="relative w-11 h-11 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-[#0d5c3a] via-[#0f6b43] to-[#00c068] text-white flex items-center justify-center shadow-inner shrink-0 group-hover:scale-105 transition-transform">
            <svg
              className="w-5 h-5 text-white drop-shadow-2xs"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              <path d="M9.5 11.5h.01" />
              <path d="M12.5 11.5h.01" />
              <path d="M15.5 11.5h.01" />
            </svg>

            {/* Sparkle Badge Top-Left */}
            <span className="absolute -top-0.5 -left-0.5 w-4 h-4 rounded-full bg-white text-[#0d5c3a] shadow-xs flex items-center justify-center">
              <SparklesIcon className="w-2.5 h-2.5 text-[#0d5c3a]" />
            </span>

            {/* Live Connection Status Dot Bottom-Right */}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center">
              {connected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00c068] opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ring-2 ring-white ${
                  connected ? "bg-[#00c068]" : "bg-amber-400"
                }`}
              />
            </span>
          </div>

          {/* Desktop / Tablet Label + Overlapping Vector Channel Stack */}
          <div className="hidden sm:flex items-center gap-2.5">
            <div className="text-left leading-tight">
              <div className="text-[11px] font-extrabold text-gray-900 tracking-tight group-hover:text-[#0d5c3a] transition-colors">
                Live Simulator
              </div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-700">
                Co-Pilot Test Desk
              </div>
            </div>

            {/* Overlapping Vector Channel Avatars (WhatsApp, Instagram, Messenger) */}
            <div className="flex items-center -space-x-1.5 pl-1">
              <span className="w-6 h-6 rounded-full bg-[#075E54] text-white ring-2 ring-white flex items-center justify-center shadow-2xs">
                <WhatsAppBadgeIcon className="w-3 h-3" />
              </span>
              <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 text-white ring-2 ring-white flex items-center justify-center shadow-2xs">
                <InstagramBadgeIcon className="w-3 h-3" />
              </span>
              <span className="w-6 h-6 rounded-full bg-[#0084FF] text-white ring-2 ring-white flex items-center justify-center shadow-2xs">
                <FacebookMessengerBadgeIcon className="w-3 h-3" />
              </span>
            </div>
          </div>
        </button>
      )}

      {/* Quick Search Palette Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/25 backdrop-blur-md">
          <div className="bg-white rounded-none sm:rounded-[28px] shadow-2xl border-0 sm:border border-gray-200 max-w-lg w-full h-[100dvh] sm:h-auto sm:max-h-[85dvh] flex flex-col overflow-hidden animate-popup-spring">
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
                  Type an order reference (e.g. CT-1042), product name, or
                  customer name...
                </div>
              ) : (
                <>
                  {matchingOrders.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase font-bold text-gray-400 px-2 mb-1">
                        Orders
                      </div>
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
                              <div className="text-[11px] text-gray-400">
                                {o.productName}
                              </div>
                            </div>
                            <span className="text-xs font-bold text-gray-900">
                              {o.totalAmountFormatted}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {matchingProducts.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase font-bold text-gray-400 px-2 mb-1">
                        Products
                      </div>
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
                              <div className="text-xs font-bold text-gray-900">
                                {p.name}
                              </div>
                              <div className="text-[11px] text-gray-400 font-mono">
                                {p.skuCode}
                              </div>
                            </div>
                            <span className="text-xs font-bold text-gray-900">
                              {p.basePriceFormatted}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {matchingOrders.length === 0 &&
                    matchingProducts.length === 0 && (
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
