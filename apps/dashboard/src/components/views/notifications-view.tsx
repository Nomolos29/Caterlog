"use client";

import React, { useState, useMemo, useEffect } from "react";
import { CheckIcon } from "../icons";
import { EmptyState } from "../ui/empty-state";
import type { OrderItem, ProductItem, ChatMessageItem, VendorNotificationItem } from "@/lib/types";

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
  orders?: OrderItem[];
  products?: ProductItem[];
  chatMessages?: ChatMessageItem[];
  dbNotifications?: VendorNotificationItem[];
  onSyncNotifications?: (input: {
    readKeys?: string[];
    dismissedKeys?: string[];
    markAllRead?: boolean;
  }) => Promise<boolean>;
  onNavigateToOrder?: (code: string) => void;
  onNavigateToPayments?: () => void;
  onNavigateToProducts?: () => void;
}

export function NotificationsView({
  orders = [],
  products = [],
  chatMessages = [],
  dbNotifications = [],
  onSyncNotifications,
  onNavigateToOrder,
  onNavigateToPayments,
  onNavigateToProducts,
}: NotificationsViewProps) {
  const [filter, setFilter] = useState<"ALL" | "UNREAD" | "ORDERS" | "PAYOUTS" | "INVENTORY">("ALL");

  // Track user reads & dismissals hydrated from DB
  const [readIds, setReadIds] = useState<Set<string>>(
    () => new Set(dbNotifications.filter((n) => n.isRead).map((n) => n.notificationKey))
  );
  const [deletedIds, setDeletedIds] = useState<Set<string>>(
    () => new Set(dbNotifications.filter((n) => n.isDismissed).map((n) => n.notificationKey))
  );

  useEffect(() => {
    if (dbNotifications && dbNotifications.length > 0) {
      setReadIds((prev) => {
        const next = new Set(prev);
        for (const n of dbNotifications) {
          if (n.isRead) next.add(n.notificationKey);
        }
        return next;
      });
      setDeletedIds((prev) => {
        const next = new Set(prev);
        for (const n of dbNotifications) {
          if (n.isDismissed) next.add(n.notificationKey);
        }
        return next;
      });
    }
  }, [dbNotifications]);

  // Dynamically derive live notification items from orders, products, and chat
  const notifications: NotificationRecord[] = useMemo(() => {
    const list: NotificationRecord[] = [];

    // 1. Orders and Escrow settlements
    for (const o of orders) {
      const orderDate = new Date(o.paidAt || o.createdAt);
      const timeStr = orderDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      if (o.status === "PAID") {
        list.push({
          id: `notif-paid-${o.shortCode}`,
          title: `Payment Verified: ${o.shortCode}`,
          message: `Monnify verified ₦${(o.amountPaidNaira || o.totalAmountNaira).toLocaleString()} transfer from ${o.customerName} (${o.customerPhone}). Escrow split allocated.`,
          category: "PAYOUTS",
          timestamp: timeStr,
          read: readIds.has(`notif-paid-${o.shortCode}`),
          linkText: "View Settlement",
          targetView: "payments",
          targetRef: o.shortCode,
        });
      }

      const itemsSummary =
        o.items && o.items.length > 0
          ? o.items.map((it) => `${it.quantity}× ${it.productName}${it.variantName ? ` (${it.variantName})` : ""}`).join(", ")
          : `${o.quantity}× ${o.productName}${o.variantName ? ` (${o.variantName})` : ""}`;

      list.push({
        id: `notif-ord-${o.shortCode}`,
        title: `Order Placed: ${o.shortCode}`,
        message: `${o.customerName} ordered ${itemsSummary} (${o.totalAmountFormatted}). Status: ${o.status}. Delivery to ${o.shippingZoneName || "Local Delivery"}.`,
        category: "ORDERS",
        timestamp: timeStr,
        read: readIds.has(`notif-ord-${o.shortCode}`) || o.status === "PAID",
        linkText: "Inspect Order",
        targetView: "orders",
        targetRef: o.shortCode,
      });
    }

    // 2. Inventory / Low Stock Alerts
    for (const p of products) {
      if (p.variants && p.variants.length > 0) {
        for (const v of p.variants) {
          if (v.stock <= 5) {
            const notifId = `notif-stock-${v.sku}`;
            list.push({
              id: notifId,
              title: `Low Stock: ${p.name} (${v.name})`,
              message: `Variant SKU ${v.sku} has only ${v.stock} unit${v.stock === 1 ? "" : "s"} left.`,
              category: "INVENTORY",
              timestamp: "Live Alert",
              read: readIds.has(notifId),
              linkText: "Update Stock",
              targetView: "products",
              targetRef: p.skuCode,
            });
          }
        }
      } else if (p.availableStock <= 5) {
        const notifId = `notif-stock-${p.skuCode}`;
        list.push({
          id: notifId,
          title: `Low Stock: ${p.name}`,
          message: `SKU ${p.skuCode} has only ${p.availableStock} unit${p.availableStock === 1 ? "" : "s"} left.`,
          category: "INVENTORY",
          timestamp: "Live Alert",
          read: readIds.has(notifId),
          linkText: "Update Stock",
          targetView: "products",
          targetRef: p.skuCode,
        });
      }
    }

    // 3. Buyer WhatsApp Inquiries / Handoffs
    if (chatMessages && chatMessages.length > 0) {
      const recentBuyerMessages = chatMessages.filter((m) => m.sender === "BUYER").slice(-5);
      for (const msg of recentBuyerMessages) {
        const notifId = `notif-chat-${msg.id}`;
        const isAssist = /talk|human|owner|vendor|support|help|assistance|care|agent/i.test(msg.text);
        list.push({
          id: notifId,
          title: isAssist
            ? `🔔 Customer Assistance: ${msg.fromPhone || "Buyer"}`
            : `WhatsApp Inquiry: ${msg.fromPhone || "Buyer"}`,
          message: `"${msg.text}"`,
          category: "COPILOT",
          timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          read: readIds.has(notifId),
          linkText: isAssist ? "Assist Customer" : "Open Co-Pilot",
          targetView: "orders",
        });
      }
    }

    return list.filter((n) => !deletedIds.has(n.id));
  }, [orders, products, chatMessages, readIds, deletedIds]);

  // Notification Preferences State
  const [waNotifications, setWaNotifications] = useState(true);
  const [emailDigest, setEmailDigest] = useState(true);
  const [soundAlerts, setSoundAlerts] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = () => {
    const allIds = notifications.map((n) => n.id);
    setReadIds(new Set(allIds));
    if (onSyncNotifications) {
      void onSyncNotifications({ readKeys: allIds, markAllRead: true });
    }
  };

  const handleMarkAsRead = (id: string) => {
    setReadIds((prev) => new Set([...prev, id]));
    if (onSyncNotifications) {
      void onSyncNotifications({ readKeys: [id] });
    }
  };

  const handleDeleteNotification = (id: string) => {
    setDeletedIds((prev) => new Set([...prev, id]));
    if (onSyncNotifications) {
      void onSyncNotifications({ dismissedKeys: [id] });
    }
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

      {/* Main Notifications Feed */}
      <div className="space-y-4">
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

          {/* Notifications Feed */}
          {filteredNotifications.length === 0 ? (
            <EmptyState
              badge="Alerts & Live Activity"
              icon="🔔"
              title="No Notifications Yet"
              description="Instant escrow payout confirmations, buyer WhatsApp inquiry alerts, and low stock notices will stream here in real time as events occur."
            />
          ) : (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-2xs overflow-hidden divide-y divide-gray-100">
              {filteredNotifications.map((n) => (
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
              ))}
            </div>
          )}
        </div>
    </div>
  );
}

