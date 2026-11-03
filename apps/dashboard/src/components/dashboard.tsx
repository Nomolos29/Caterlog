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
import { ChatDrawer } from "./chat-drawer";

export function Dashboard() {
  const [state, setState] = useState<VendorState | null>(null);
  const [currentView, setCurrentView] = useState<NavView>("overview");
  const [activeWorkspace, setActiveWorkspace] = useState<"reseller" | "supplier">("reseller");
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);
  const [connected, setConnected] = useState(false);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  // Update selected order reference if orders list changes
  useEffect(() => {
    if (selectedOrder && state?.orders) {
      const fresh = state.orders.find((o) => o.id === selectedOrder.id);
      if (fresh) setSelectedOrder(fresh);
    }
  }, [state?.orders, selectedOrder]);

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
  }) => {
    try {
      const next = await api.addProduct({
        skuCode: input.skuCode || `ITEM-${Date.now().toString().slice(-4)}`,
        name: input.name,
        priceNaira: input.priceNaira,
        stockTotal: input.stockTotal,
        primaryImageUrl: input.primaryImageUrl,
      });
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

  const handleSimulateTransfer = async (orderCode: string, amountNaira: number) => {
    try {
      const res = await api.simulateTransfer(orderCode, amountNaira);
      if (res.state) setState(res.state);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleMarkDispatched = async (orderCode: string) => {
    try {
      const next = await api.dispatchOrder(orderCode);
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

  // WhatsApp Simulator Handlers
  const handleSendVendorKeyword = async (text: string, attachedImage?: string) => {
    const res = await api.simulateWhatsApp({
      role: "VENDOR_KEYWORD",
      text,
      attachedImageUrl: attachedImage,
    });
    if (res.state) setState(res.state);
  };

  const handleSendBuyerInquiry = async (text: string, phash?: string) => {
    const res = await api.simulateWhatsApp({
      role: "BUYER_INQUIRY",
      text,
      quotedStatusImagePhash: phash,
      simulateFastForwardIdleTimer: true,
    });
    if (res.state) setState(res.state);
  };

  const handleSendVendorManualEcho = async (text: string) => {
    const res = await api.simulateWhatsApp({
      role: "VENDOR_MANUAL_BUYER_REPLY",
      text,
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
        return "Network / Find suppliers";
      case "customers":
        return "Customers / Directory";
      case "payments":
        return "Payments / Split transactions";
      case "market-boost":
        return "Market Boost / Visibility & performance";
      case "analytics":
        return "Analytics / Performance & reports";
      case "settings":
        return "Settings / Sales co-pilot / Setup";
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
          setSelectedOrder(null);
        }}
        pendingCount={state.analytics.pendingOrdersCount}
        onOpenNewOrder={() => setCurrentView("payment-links")}
        activeWorkspace={activeWorkspace}
        onToggleWorkspace={() =>
          setActiveWorkspace((prev) => (prev === "reseller" ? "supplier" : "reseller"))
        }
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
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
            setSelectedOrder(ord);
            setCurrentView("orders");
          }}
          onSelectProduct={() => {
            setCurrentView("products");
          }}
          onNavigateToView={(v) => setCurrentView(v as NavView)}
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
              onSelectOrder={(ord) => {
                setSelectedOrder(ord);
                setCurrentView("orders");
              }}
              onViewAllOrders={() => setCurrentView("orders")}
              onNavigateToPayments={() => setCurrentView("payments")}
              onFilterOrdersByStatus={() => setCurrentView("orders")}
            />
          )}

          {currentView === "orders" && (
            <OrdersView
              orders={state.orders}
              selectedOrder={selectedOrder}
              onSelectOrder={setSelectedOrder}
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
              onUpdateStock={handleUpdateStock}
              onNavigateToNetwork={() => setCurrentView("network")}
              onNavigateToSettings={() => setCurrentView("settings")}
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
                setSelectedOrder(ord);
                setCurrentView("orders");
              }}
              onNavigateToPaymentLinks={(customerName) => {
                setCurrentView("payment-links");
              }}
            />
          )}

          {currentView === "payments" && (
            <PaymentsView
              onNavigateToOrder={(code) => {
                const target = state.orders.find((o) => o.shortCode === code) || state.orders[0];
                if (target) {
                  setSelectedOrder(target);
                  setCurrentView("orders");
                }
              }}
            />
          )}

          {currentView === "market-boost" && (
            <MarketBoostView />
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
            />
          )}

          {currentView === "settings" && (
            <SettingsView
              vendor={state.vendor}
              shippingZones={state.shippingZones}
              discounts={state.discounts}
              onUpdateSettings={handleUpdateSettings}
              onAddShippingZone={handleAddShippingZone}
              onDeleteShippingZone={handleDeleteShippingZone}
              onAddDiscount={handleAddDiscount}
              onDeleteDiscount={handleDeleteDiscount}
              onNavigateToOrder={(code) => {
                const target = state.orders.find((o) => o.shortCode === code) || state.orders[0];
                if (target) {
                  setSelectedOrder(target);
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
        onSendVendorKeyword={handleSendVendorKeyword}
        onSendBuyerInquiry={handleSendBuyerInquiry}
        onSendVendorManualEcho={handleSendVendorManualEcho}
      />
    </div>
  );
}
