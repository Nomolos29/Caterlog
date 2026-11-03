"use client";

import React, { useState, useMemo } from "react";
import { CheckIcon } from "../icons";

export interface NotificationRecord {
  id: string;
  title: string;
  message: string;
  category: "ORDERS" | "PAYOUTS" | "INVENTORY" | "COPILOT" | "SYSTEM";
  timestamp: string;
  read: boolean;
  linkText?: string;
  targetView?: string;
  targetRef?: string;
}

interface NotificationsViewProps {
  onNavigateToOrder?: (code: string) => void;
  onNavigateToPayments?: () => void;
  onNavigateToProducts?: () => void;
}

export function NotificationsView({
  onNavigateToOrder,
  onNavigateToPayments,
  onNavigateToProducts,
}: NotificationsViewProps) {
  const [filter, setFilter] = useState<"ALL" | "UNREAD" | "ORDERS" | "PAYOUTS" | "INVENTORY">("ALL");

  const [notifications, setNotifications] = useState<NotificationRecord[]>([
    {
      id: "n-1",
      title: "Split Settlement Complete",
      message: "Customer paid ₦20,000 for CT-1042. Aroko Wholesale split (₦16,000) routed instantly via Monnify; ₦3,700 net commission credited to your account.",
      category: "PAYOUTS",
      timestamp: "12m ago",
      read: false,
      linkText: "View split transaction",
      targetView: "payments",
      targetRef: "CT-1042",
    },
    {
      id: "n-2",
      title: "New WhatsApp Inquiry via Co-Pilot",
      message: "Tunde Bello (+2348029876543) inquired about 5.5L Digital Air Fryer. AI Co-Pilot provided live price and stock quote.",
      category: "COPILOT",
      timestamp: "45m ago",
      read: false,
      linkText: "View conversation",
      targetView: "settings",
    },
    {
      id: "n-3",
      title: "Supplier Stock Update · Aroko Wholesale",
      message: "Aroko Wholesale updated shared stock for Stainless Flask 750ml (AW-FL750) to 42 available units.",
      category: "INVENTORY",
      timestamp: "2h ago",
      read: false,
      linkText: "Inspect product stock",
      targetView: "products",
    },
    {
      id: "n-4",
      title: "Order Ready for Pickup",
      message: "Order CT-1041 has been packaged by Aroko Wholesale and pickup tag has been generated at the Ikeja hub.",
      category: "ORDERS",
      timestamp: "4h ago",
      read: true,
      linkText: "View order fulfillment",
      targetView: "orders",
      targetRef: "CT-1041",
    },
    {
      id: "n-5",
      title: "Monnify NUBAN Channel Verified",
      message: "Wema Bank settlement account 7821948301 has been fully verified with NIBSS. Automatic daily sweeps are active.",
      category: "PAYOUTS",
      timestamp: "1d ago",
      read: true,
      linkText: "Review payout accounts",
      targetView: "payments",
    },
    {
      id: "n-6",
      title: "Instagram Graph API Token Validated",
      message: "Meta Commerce catalog connection refreshed. 6 products successfully synced to @niastores.ng storefront.",
      category: "SYSTEM",
      timestamp: "2d ago",
      read: true,
      linkText: "Check integrations",
      targetView: "settings",
    },
  ]);

  // Notification Preferences State
  const [waNotifications, setWaNotifications] = useState(true);
  const [emailDigest, setEmailDigest] = useState(true);
  const [soundAlerts, setSoundAlerts] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleMarkAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const handleDeleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (filter === "UNREAD") return !n.read;
      if (filter === "ORDERS") return n.category === "ORDERS" || n.category === "COPILOT";
      if (filter === "PAYOUTS") return n.category === "PAYOUTS";
      if (filter === "INVENTORY") return n.category === "INVENTORY";
      return true;
    });
  }, [notifications, filter]);

  return (
    <div className="space-y-6 sm:space-y-8 max-w-5xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
              Alerts & Activity
            </span>
            {unreadCount > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                {unreadCount} Unread
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
            Notifications & Alerts
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Real-time alerts for customer payments, supplier fulfillment, inventory changes, and WhatsApp inquiries.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs font-semibold px-4 py-2 rounded-xl bg-white border border-gray-300 hover:border-gray-500 hover:bg-gray-100 text-gray-700 hover:text-gray-900 shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 self-start sm:self-center"
          >
            <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />
            <span>Mark All as Read</span>
          </button>
        )}
      </div>

      {/* Main Grid: Notifications Feed on Left, Preferences on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 8 Cols: Filter Strip & Notifications List */}
        <div className="lg:col-span-8 space-y-4">
          {/* Filter Tabs */}
          <div className="flex border-b border-gray-200 text-xs font-semibold gap-4 overflow-x-auto pb-0.5">
            {[
              { id: "ALL", label: `All (${notifications.length})` },
              { id: "UNREAD", label: `Unread (${unreadCount})` },
              { id: "ORDERS", label: "Orders & Chat" },
              { id: "PAYOUTS", label: "Settlements & Splits" },
              { id: "INVENTORY", label: "Supplier Stock" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as any)}
                className={`pb-2.5 border-b-2 whitespace-nowrap transition-all cursor-pointer active:scale-95 ${
                  filter === tab.id
                    ? "border-emerald-600 text-emerald-700 font-bold"
                    : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Notifications Card List */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-2xs overflow-hidden divide-y divide-gray-100">
            {filteredNotifications.length === 0 ? (
              <div className="p-12 text-center text-sm text-gray-400">
                No notifications found in this category.
              </div>
            ) : (
              filteredNotifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-5 transition-colors flex items-start justify-between gap-4 ${
                    !n.read ? "bg-emerald-50/25" : "hover:bg-gray-50/60"
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    {/* Category Icon Pill */}
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold shrink-0 ${
                        n.category === "PAYOUTS"
                          ? "bg-purple-100 text-purple-700"
                          : n.category === "ORDERS"
                          ? "bg-blue-100 text-blue-700"
                          : n.category === "INVENTORY"
                          ? "bg-amber-100 text-amber-700"
                          : n.category === "COPILOT"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {n.category === "PAYOUTS"
                        ? "₦"
                        : n.category === "ORDERS"
                        ? "📦"
                        : n.category === "INVENTORY"
                        ? "📊"
                        : n.category === "COPILOT"
                        ? "💬"
                        : "🔔"}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-gray-900">{n.title}</span>
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500" title="Unread notification" />
                        )}
                        <span className="text-[10px] text-gray-400 font-medium">{n.timestamp}</span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{n.message}</p>

                      {/* Interactive Deep Link */}
                      {n.linkText && (
                        <div className="pt-1.5 flex items-center gap-3">
                          <button
                            onClick={() => {
                              handleMarkAsRead(n.id);
                              if (n.targetView === "orders" && n.targetRef && onNavigateToOrder) {
                                onNavigateToOrder(n.targetRef);
                              } else if (n.targetView === "payments" && onNavigateToPayments) {
                                onNavigateToPayments();
                              } else if (n.targetView === "products" && onNavigateToProducts) {
                                onNavigateToProducts();
                              }
                            }}
                            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>{n.linkText}</span>
                            <span>→</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {!n.read && (
                      <button
                        onClick={() => handleMarkAsRead(n.id)}
                        className="text-[11px] font-semibold text-gray-400 hover:text-gray-700 px-2 py-1 rounded-md hover:bg-gray-100 cursor-pointer"
                        title="Mark as read"
                      >
                        ✓
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteNotification(n.id)}
                      className="text-gray-300 hover:text-rose-600 p-1 rounded-md cursor-pointer text-xs"
                      title="Dismiss alert"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right 4 Cols: Notification Delivery Channels & Preferences */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-2xs space-y-5">
            <div>
              <h2 className="text-base font-bold text-gray-900">Alert Preferences</h2>
              <p className="text-xs text-gray-500 mt-0.5">Control how and where you receive business alerts.</p>
            </div>

            <div className="space-y-4 text-xs">
              {/* WhatsApp Push */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold text-gray-900">WhatsApp Instant Alerts</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Receive 1-tap alerts on your phone whenever an order is paid.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={waNotifications}
                  onChange={(e) => setWaNotifications(e.target.checked)}
                  className="rounded text-emerald-600 cursor-pointer mt-0.5"
                />
              </div>

              {/* Email Digest */}
              <div className="flex items-start justify-between gap-3 border-t border-gray-100 pt-3">
                <div>
                  <div className="font-bold text-gray-900">Daily Financial Digest</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Email summary of Monnify split settlements at 9:00 PM WAT.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={emailDigest}
                  onChange={(e) => setEmailDigest(e.target.checked)}
                  className="rounded text-emerald-600 cursor-pointer mt-0.5"
                />
              </div>

              {/* Audio Chime */}
              <div className="flex items-start justify-between gap-3 border-t border-gray-100 pt-3">
                <div>
                  <div className="font-bold text-gray-900">Dashboard Audio Alert</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Play a sound chime when a live WhatsApp buyer message arrives.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={soundAlerts}
                  onChange={(e) => setSoundAlerts(e.target.checked)}
                  className="rounded text-emerald-600 cursor-pointer mt-0.5"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1.5">
                <CheckIcon className="w-3.5 h-3.5" />
                <span>Preferences saved automatically</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

