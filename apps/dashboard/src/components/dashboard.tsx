"use client";

import React, { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { VendorState, OrderItem } from "@/lib/types";

import { Sidebar, type NavView } from "./sidebar";
import { TopNav } from "./top-nav";
import { OverviewView } from "./views/overview-view";
import { OrdersView } from "./views/orders-view";
import { ProductsView } from "./views/products-view";
import { NetworkView } from "./views/network-view";
import { CustomersView } from "./views/customers-view";
import { PaymentsView } from "./views/payments-view";
import { MarketBoostView } from "./views/market-boost-view";
import { PaymentLinksView } from "./views/payment-links-view";
import { SettingsView } from "./views/settings-view";
import { AnalyticsView } from "./views/analytics-view";
import { VerificationView } from "./views/verification-view";
import { TeamView } from "./views/team-view";
import { NotificationsView } from "./views/notifications-view";
import { AuthView } from "./views/auth-view";
import { ChatDrawer } from "./chat-drawer";

export function Dashboard() {
  const [authSession, setAuthSession] = useState<{
    email: string;
    businessName: string;
  } | null>({
    email: "owner@niastores.example",
    businessName: "Nia Stores",
  });
  const [state, setState] = useState<VendorState | null>(null);
  const [currentView, setCurrentView] = useState<NavView>("overview");
  const [settingsTab, setSettingsTab] = useState<"setup" | "conversations" | "detail" | "shipping" | "general">("setup");
  const [activeWorkspace, setActiveWorkspace] = useState<"reseller" | "supplier">("reseller");
  const [ordersFilter, setOrdersFilter] = useState<string>("ALL");
  const [paymentLinkCustomer, setPaymentLinkCustomer] = useState<string>("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const selectedOrder = selectedOrderId && state?.orders
    ? state.orders.find((o) => o.id === selectedOrderId || o.shortCode === selectedOrderId) ?? null
    : null;
  const [connected, setConnected] = useState(false);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const handleSelectOrder = (order: OrderItem | null) => {
    setSelectedOrderId(order ? order.id : null);
  };

  const loadState = useCallback(async () => {
    try {
      const data = await api.getState();
      setState(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  // Real-time synchronization over Server-Sent Events (SSE)
  useEffect(() => {
    if (typeof window === "undefined" || !("EventSource" in window)) return;

    const source = new EventSource(api.eventsUrl);
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (event) => {
      try {
        const next = JSON.parse(event.data) as VendorState;
        setState(next);
        setConnected(true);
      } catch {
        // Ignore malformed frames
      }
    };

    return () => source.close();
  }, []);

  if (!authSession) {
    return (
      <AuthView
        initialMode="login"
        onLoginSuccess={(user) => {
          setAuthSession(user);
          void loadState();
        }}
      />
    );
  }

  if (loading || !state) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center font-black text-xl animate-bounce shadow-lg">
          C
        </div>
        <div className="text-sm font-bold text-gray-900 mt-4">Loading Caterlog Business Manager...</div>
        <div className="text-xs text-gray-400 mt-1">Connecting to live WhatsApp Coexistence engine</div>
      </div>
    );
  }

  // Handlers for Views
  const handleAddProduct = async (input: {
    skuCode?: string;
    name: string;
    priceNaira: number;
    stockTotal: number;
    primaryImageUrl?: string;
    variants?: any[];
  }) => {
    try {
      const next = await api.addProduct({
        skuCode: input.skuCode || `ITEM-${Date.now().toString().slice(-4)}`,
        name: input.name,
        priceNaira: input.priceNaira,
        stockTotal: input.stockTotal,
        primaryImageUrl: input.primaryImageUrl,
        variants: input.variants,
      });
      setState(next);
      return true;
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      return false;
    }
  };

  const handleUpdateProduct = async (
    sku: string,
    input: {
      name?: string;
      description?: string;
      category?: string;
      priceNaira?: number | string;
      stockTotal?: number;
      primaryImageUrl?: string;
      variants?: any[];
    }
  ) => {
    try {
      const next = await api.updateProduct(sku, input);
      setState(next);
      return true;
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      return false;
    }
  };

  const handleUpdateStock = async (sku: string, stock: number) => {
    try {
      const next = await api.updateStock(sku, stock);
      setState(next);
      return true;
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      return false;
    }
  };

  const handleDeleteProduct = async (sku: string) => {
    try {
      const next = await api.deleteProduct(sku);
      setState(next);
      return true;
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      return false;
    }
  };

  const handleSimulateTransfer = async (orderCode: string, amountNaira: number) => {
    try {
      const res = await api.simulateTransfer(orderCode, amountNaira);
      if (res.state) setState(res.state);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleMarkDispatched = async (orderCode: string, riderPhone?: string) => {
    try {
      const next = await api.dispatchOrder(orderCode, riderPhone);
      setState(next);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleUpdateSettings = async (settings: {
    copilotMode?: "COPILOT" | "FULL_AUTO" | "MANUAL";
    copilotIdleSeconds?: number;
    reservationTtlMinutes?: number;
  }) => {
    try {
      const next = await api.updateSettings(settings);
      setState(next);
      return true;
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      return false;
    }
  };

  const handleAddShippingZone = async (name: string, feeNaira: number) => {
    try {
      const next = await api.addShippingZone(name, feeNaira);
      setState(next);
      return true;
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      return false;
    }
  };

  const handleDeleteShippingZone = async (code: number) => {
    try {
      const next = await api.deleteShippingZone(code);
      setState(next);
      return true;
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      return false;
    }
  };

  const handleAddDiscount = async (code: string, type: "PERCENTAGE" | "FLAT_KOBO", value: number) => {
    try {
      const next = await api.addDiscount({ code, type, value });
      setState(next);
      return true;
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      return false;
    }
  };

  const handleDeleteDiscount = async (code: string) => {
    try {
      const next = await api.deleteDiscount(code);
      setState(next);
      return true;
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      return false;
    }
  };

  const handleSyncWhatsAppCatalog = async () => {
    try {
      const res = await api.syncWhatsAppCatalog(true);
      if (res.state) setState(res.state);
      return res.result;
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      return null;
    }
  };

  // WhatsApp Simulator Handlers
  const handleSendVendorKeyword = async (text: string, attachedImage?: string) => {
    const res = await api.simulateWhatsApp({
      role: "VENDOR_KEYWORD",
      text,
      attachedImageUrl: attachedImage,
    });
    if (res.state) setState(res.state);
  };

  const handleSendBuyerInquiry = async (
    text: string,
    phash?: string,
    buyerPhone?: string,
    buyerName?: string,
    attachedImageUrl?: string
  ) => {
    const res = await api.simulateWhatsApp({
      role: "BUYER_INQUIRY",
      text,
      buyerPhone: buyerPhone || undefined,
      buyerName: buyerName || undefined,
      quotedStatusImagePhash: phash,
      attachedImageUrl,
      simulateFastForwardIdleTimer: true,
    });
    if (res.state) setState(res.state);
  };

  const handleSendVendorManualEcho = async (text: string, buyerPhone?: string) => {
    const res = await api.simulateWhatsApp({
      role: "VENDOR_MANUAL_BUYER_REPLY",
      text,
      buyerPhone,
    });
    if (res.state) setState(res.state);
  };

  const getBreadcrumb = () => {
    switch (currentView) {
      case "overview":
        return "Overview";
      case "orders":
        return selectedOrder ? `Orders / ${selectedOrder.shortCode}` : "Orders";
      case "products":
        return "Products / Reselling";
      case "network":
        return "Network / My suppliers";
      case "customers":
        return "Customers / Directory";
      case "payments":
        return "Payments / Split transactions";
      case "market-boost":
        return "Market Boost / Visibility & performance";
      case "analytics":
        return "Analytics / Performance & reports";
      case "team":
        return "Team & Roles / Activity log";
      case "verification":
        return "Verification / Business KYC";
      case "notifications":
        return "Notifications & Alerts / System & Activity";
      case "settings":
        return settingsTab === "shipping"
          ? "Settings / Delivery & Shipping"
          : "Settings / Sales co-pilot / Setup";
      case "payment-links":
        return "Payment Links";
      default:
        return "Caterlog Business Manager";
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex text-gray-900 font-sans antialiased">
      {/* Sidebar Navigation (Desktop Persistent + Mobile Sliding Drawer) */}
      <Sidebar
        currentView={currentView}
        onSelectView={(v) => {
          setCurrentView(v);
          handleSelectOrder(null);
          if (v === "orders") {
            setOrdersFilter("ALL");
          }
          if (v === "settings") {
            setSettingsTab("setup");
          }
        }}
        pendingCount={state.analytics.pendingOrdersCount}
        onOpenNewOrder={() => setCurrentView("payment-links")}
        activeWorkspace={activeWorkspace}
        onToggleWorkspace={() =>
          setActiveWorkspace((prev) => (prev === "reseller" ? "supplier" : "reseller"))
        }
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        vendorName={state.vendor.businessName}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <TopNav
          vendor={state.vendor}
          connected={connected}
          onOpenSimulator={() => setSimulatorOpen(true)}
          simulatorOpen={simulatorOpen}
          breadcrumb={getBreadcrumb()}
          activeWorkspace={activeWorkspace}
          onToggleWorkspace={() =>
            setActiveWorkspace((prev) => (prev === "reseller" ? "supplier" : "reseller"))
          }
          onOpenMobileNav={() => setMobileNavOpen(true)}
          orders={state.orders}
          products={state.products}
          onSelectOrder={(ord) => {
            handleSelectOrder(ord);
            setCurrentView("orders");
          }}
          onSelectProduct={() => {
            setCurrentView("products");
          }}
          onNavigateToView={(v) => {
            if (v === "shipping") {
              setCurrentView("settings");
              setSettingsTab("shipping");
            } else {
              if (v === "settings") {
                setSettingsTab("setup");
              }
              setCurrentView(v as NavView);
            }
          }}
          onSignOut={() => setAuthSession(null)}
        />

        {/* View Surface */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex justify-between items-center">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">✕</button>
            </div>
          )}

          {currentView === "overview" && (
            <OverviewView
              analytics={state.analytics}
              vendor={state.vendor}
              orders={state.orders}
              products={state.products}
              onSelectOrder={(ord) => {
                handleSelectOrder(ord);
                setCurrentView("orders");
              }}
              onViewAllOrders={() => {
                setOrdersFilter("ALL");
                handleSelectOrder(null);
                setCurrentView("orders");
              }}
              onNavigateToPayments={() => setCurrentView("payments")}
              onFilterOrdersByStatus={(status) => {
                const target =
                  status === "PENDING"
                    ? "PENDING_PAYMENT"
                    : status === "PROCESSING"
                    ? "OUT_FOR_DELIVERY"
                    : status;
                setOrdersFilter(target);
                handleSelectOrder(null);
                setCurrentView("orders");
              }}
              onNavigateToProducts={() => setCurrentView("products")}
              onNavigateToSettings={(tab) => {
                if (tab) setSettingsTab(tab);
                setCurrentView("settings");
              }}
              onOpenSimulator={() => setSimulatorOpen(true)}
            />
          )}

          {currentView === "orders" && (
            <OrdersView
              orders={state.orders}
              selectedOrder={selectedOrder}
              initialStatusFilter={ordersFilter}
              onSelectOrder={handleSelectOrder}
              onSimulateTransfer={handleSimulateTransfer}
              onMarkDispatched={handleMarkDispatched}
              onNavigateToPayments={() => setCurrentView("payments")}
              onNavigateToSettings={() => setCurrentView("settings")}
            />
          )}

          {currentView === "products" && (
            <ProductsView
              products={state.products}
              onAddProduct={handleAddProduct}
              onUpdateProduct={handleUpdateProduct}
              onUpdateStock={handleUpdateStock}
              onDeleteProduct={handleDeleteProduct}
              onNavigateToNetwork={() => setCurrentView("network")}
              onNavigateToSettings={() => setCurrentView("settings")}
              onSyncWhatsAppCatalog={handleSyncWhatsAppCatalog}
            />
          )}

          {currentView === "network" && (
            <NetworkView
              onMirrorProducts={() => setCurrentView("products")}
            />
          )}

          {currentView === "customers" && (
            <CustomersView
              orders={state.orders}
              onSelectOrder={(ord) => {
                handleSelectOrder(ord);
                setCurrentView("orders");
              }}
              onNavigateToPaymentLinks={(customerName) => {
                setPaymentLinkCustomer(customerName);
                setCurrentView("payment-links");
              }}
            />
          )}

          {currentView === "payments" && (
            <PaymentsView
              orders={state.orders}
              initialOrderCode={selectedOrder?.shortCode}
              onNavigateToOrder={(code) => {
                const target = state.orders.find((o) => o.shortCode === code) || state.orders[0];
                if (target) {
                  handleSelectOrder(target);
                  setCurrentView("orders");
                }
              }}
            />
          )}

          {currentView === "market-boost" && (
            <MarketBoostView vendorName={state.vendor.businessName} />
          )}

          {currentView === "analytics" && (
            <AnalyticsView
              analytics={state.analytics}
              orders={state.orders}
              products={state.products}
              onNavigateToOrders={() => setCurrentView("orders")}
              onNavigateToPayments={() => setCurrentView("payments")}
            />
          )}

          {currentView === "payment-links" && (
            <PaymentLinksView
              products={state.products}
              orders={state.orders}
              vendorName={state.vendor.businessName}
              initialCustomerName={paymentLinkCustomer}
            />
          )}

          {currentView === "team" && (
            <TeamView vendorName={state.vendor.businessName} />
          )}

          {currentView === "verification" && (
            <VerificationView
              onBack={() => setCurrentView("overview")}
              onComplete={() => setCurrentView("overview")}
            />
          )}

          {currentView === "notifications" && (
            <NotificationsView
              orders={state.orders}
              products={state.products}
              chatMessages={state.chatMessages}
              onNavigateToOrder={(code) => {
                const target = state.orders.find((o) => o.shortCode === code) || state.orders[0];
                if (target) {
                  handleSelectOrder(target);
                  setCurrentView("orders");
                }
              }}
              onNavigateToPayments={() => setCurrentView("payments")}
              onNavigateToProducts={() => setCurrentView("products")}
            />
          )}

          {currentView === "settings" && (
            <SettingsView
              key={settingsTab}
              initialTab={settingsTab}
              vendor={state.vendor}
              shippingZones={state.shippingZones}
              discounts={state.discounts}
              chatMessages={state.chatMessages}
              orders={state.orders}
              activeBuyerSession={state.activeBuyerSession}
              onSendVendorManualEcho={handleSendVendorManualEcho}
              onUpdateSettings={handleUpdateSettings}
              onAddShippingZone={handleAddShippingZone}
              onDeleteShippingZone={handleDeleteShippingZone}
              onAddDiscount={handleAddDiscount}
              onDeleteDiscount={handleDeleteDiscount}
              onNavigateToOrder={(code) => {
                const target = state.orders.find((o) => o.shortCode === code) || state.orders[0];
                if (target) {
                  handleSelectOrder(target);
                  setCurrentView("orders");
                }
              }}
            />
          )}
        </main>
      </div>

      {/* Slide-over WhatsApp Live Simulator Drawer */}
      <ChatDrawer
        isOpen={simulatorOpen}
        onClose={() => setSimulatorOpen(false)}
        chatMessages={state.chatMessages}
        orders={state.orders}
        products={state.products}
        vendor={state.vendor}
        activeBuyerSession={state.activeBuyerSession}
        onSendVendorKeyword={handleSendVendorKeyword}
        onSendBuyerInquiry={handleSendBuyerInquiry}
        onSendVendorManualEcho={handleSendVendorManualEcho}
        onSimulateTransfer={handleSimulateTransfer}
      />
    </div>
  );
}
