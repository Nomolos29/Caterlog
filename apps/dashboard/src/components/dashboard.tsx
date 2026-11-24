"use client";

import React, { useState, useEffect, useCallback } from "react";
import { api, ApiError, getStoredSessionToken, setStoredSessionToken } from "@/lib/api";
import { subscribeToNeonRealtime } from "@/lib/neon-realtime";
import type { VendorState, OrderItem, PlatformRole } from "@/lib/types";
import {
  isResellerRole,
  isVendorRole,
  roleToPlanId,
  planIdToRole,
} from "@/lib/types";

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
import { SettingsView, type SettingsTabId } from "./views/settings-view";
import { ProfileView, type ProfileTabId } from "./views/profile-view";
import { AnalyticsView } from "./views/analytics-view";
import { VerificationView } from "./views/verification-view";
import { TeamView, type StaffRole } from "./views/team-view";
import { NotificationsView } from "./views/notifications-view";
import { SubscriptionsView } from "./views/subscriptions-view";
import { BookingsView } from "./views/bookings-view";
import { StorefrontView } from "./views/storefront-view";
import { AuthView } from "./views/auth-view";
import { ChatDrawer } from "./chat-drawer";
import { PlatformTourGuide } from "./platform-tour";
import type { SubscriptionPlanId, BillingCycle } from "@/lib/types";

export function Dashboard() {
  const [impersonatedStaffRole, setImpersonatedStaffRole] =
    useState<StaffRole | null>(null);
  const [authSession, setAuthSession] = useState<{
    email: string;
    businessName: string;
  } | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("caterlog_auth");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
    }
    return {
      email: "owner@niastores.example",
      businessName: "Nia Stores",
    };
  });
  const [state, setState] = useState<VendorState | null>(null);
  const [currentView, setCurrentView] = useState<NavView>("overview");
  const [settingsTab, setSettingsTab] = useState<SettingsTabId>("setup");
  const [profileTab, setProfileTab] = useState<ProfileTabId>("profile");
  const [productsTab, setProductsTab] = useState<
    "my-inventory" | "reselling" | "all" | "exceptions"
  >("my-inventory");
  const [editResellSku, setEditResellSku] = useState<string | null>(null);
  const [activeWorkspace, setActiveWorkspace] =
    useState<PlatformRole>("growth");

  useEffect(() => {
    const dbRole = state?.vendor?.role;
    if (
      dbRole === "reseller" ||
      dbRole === "starter" ||
      dbRole === "growth" ||
      dbRole === "pro"
    ) {
      setActiveWorkspace(dbRole);
    } else if (state?.subscription?.planId) {
      setActiveWorkspace(planIdToRole(state.subscription.planId));
    }
  }, [state?.vendor?.role, state?.subscription?.planId]);

  const currentPlanId =
    state?.subscription?.planId ||
    state?.vendor?.subscription?.planId ||
    roleToPlanId(activeWorkspace);

  useEffect(() => {
    let allowedViews: NavView[] = [];

    if (impersonatedStaffRole === "Dispatch Coordinator") {
      allowedViews = ["overview", "orders", "notifications", "profile"];
    } else if (impersonatedStaffRole === "Catalog Editor") {
      allowedViews = ["overview", "products", "storefront", "notifications", "profile"];
    } else if (impersonatedStaffRole === "Accountant") {
      allowedViews = ["overview", "payments", "notifications", "profile"];
    } else if (impersonatedStaffRole === "Store Attendant") {
      allowedViews = [
        "overview",
        "orders",
        "products",
        "storefront",
        "customers",
        "notifications",
        "profile",
      ];
    } else if (activeWorkspace === "reseller") {
      // 1. Reseller ($5)
      allowedViews = [
        "overview",
        "orders",
        "products",
        "storefront",
        "network",
        "customers",
        "payments",
        "subscriptions",
        "notifications",
        "settings",
        "profile",
      ];
      if (settingsTab === "shipping") {
        setSettingsTab("setup");
      }
    } else if (activeWorkspace === "starter") {
      // 2. Starter Vendor ($10)
      allowedViews = [
        "overview",
        "orders",
        "products",
        "storefront",
        "network",
        "customers",
        "payments",
        "subscriptions",
        "notifications",
        "settings",
        "profile",
      ];
    } else if (activeWorkspace === "growth") {
      // 3. Growth Vendor ($15) - includes Team & Audit capped at 4
      allowedViews = [
        "overview",
        "orders",
        "products",
        "storefront",
        "market-boost",
        "network",
        "customers",
        "payments",
        "subscriptions",
        "analytics",
        "team",
        "notifications",
        "settings",
        "profile",
      ];
    } else {
      // 4. Pro Concierge Vendor ($20) - includes Bookings and My Resellers
      allowedViews = [
        "overview",
        "orders",
        "products",
        "storefront",
        "bookings",
        "market-boost",
        "network",
        "customers",
        "payments",
        "subscriptions",
        "analytics",
        "team",
        "notifications",
        "settings",
        "profile",
      ];
    }

    if (!allowedViews.includes(currentView)) {
      setCurrentView("overview");
    }
  }, [activeWorkspace, currentView, settingsTab, impersonatedStaffRole]);
  const [ordersFilter, setOrdersFilter] = useState<string>("ALL");
  const [paymentLinkCustomer, setPaymentLinkCustomer] = useState<string>("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const selectedOrder =
    selectedOrderId && state?.orders
      ? (state.orders.find(
          (o) => o.id === selectedOrderId || o.shortCode === selectedOrderId,
        ) ?? null)
      : null;
  const [connected, setConnected] = useState(false);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourInitialChapter, setTourInitialChapter] = useState<NavView | null>(
    null,
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const handleOpenTour = (chapter?: NavView) => {
    setTourInitialChapter(chapter || currentView);
    setTourOpen(true);
  };

  const handleSelectOrder = (order: OrderItem | null) => {
    setSelectedOrderId(order ? order.id : null);
  };

  const handleSelectRole = async (newRole: PlatformRole) => {
    setActiveWorkspace(newRole);
    if (newRole === "reseller") {
      setProductsTab("reselling");
    } else {
      setProductsTab("my-inventory");
    }
    const targetPlan = roleToPlanId(newRole);
    try {
      await api.upgradeSubscription({
        planId: targetPlan,
        billingCycle: "MONTHLY",
      });
      const updated = await api.updateProfile({ role: newRole });
      setState(updated);
    } catch {
      void api
        .updateProfile({ role: newRole })
        .then(setState)
        .catch(() => {});
    }
  };

  const handleToggleWorkspace = () => {
    const roles: PlatformRole[] = ["reseller", "starter", "growth", "pro"];
    const currentIndex = roles.indexOf(activeWorkspace);
    const nextRole = roles[(currentIndex + 1) % roles.length];
    void handleSelectRole(nextRole);
  };

  const loadState = useCallback(async () => {
    try {
      const data = await api.getState();
      setState(data);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        try {
          const demo = await api.requestDemoSession();
          if (demo?.state) {
            setState(demo.state);
            setError(null);
            return;
          }
        } catch {
          // If auto-recovery fails, clear session
        }
        setAuthSession(null);
        setStoredSessionToken(null);
        localStorage.removeItem("caterlog_auth");
      }
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  // Check URL for 1-tap WhatsApp Magic Link Token (?token=...)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      void (async () => {
        try {
          const res = await api.verifyMagicLinkToken(token);
          if (res.authenticated) {
            const user = {
              email: `${res.vendor.whatsappPhone.replace(/\D/g, "")}@caterlog.store`,
              businessName: res.vendor.businessName,
            };
            setAuthSession(user);
            localStorage.setItem("caterlog_auth", JSON.stringify(user));
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname,
            );
            void loadState();
          }
        } catch (err) {
          console.error("Token verification failed:", err);
        }
      })();
    }
  }, [loadState]);

  // Real-time synchronization over Server-Sent Events (SSE) + live background heartbeat sync
  useEffect(() => {
    if (typeof window === "undefined") return;

    let source: EventSource | null = null;
    if ("EventSource" in window) {
      source = new EventSource(api.eventsUrl);
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
    }

    const syncInterval = window.setInterval(() => {
      if (document.visibilityState === "visible" && getStoredSessionToken()) {
        void loadState();
      }
    }, 3000);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible" && getStoredSessionToken()) {
        void loadState();
      }
    };
    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    return () => {
      if (source) source.close();
      window.clearInterval(syncInterval);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, [loadState]);

  // Neon Realtime WebSocket live query subscription on Lakebase Postgres orders
  useEffect(() => {
    const vendorId = state?.vendor?.id;
    if (typeof window === "undefined" || !vendorId) return;

    let cleanup: (() => void) | null = null;
    let active = true;

    void subscribeToNeonRealtime(vendorId, () => {
      if (active) {
        void loadState();
      }
    })
      .then((unsub) => {
        if (active) {
          cleanup = unsub;
        } else {
          unsub();
        }
      })
      .catch(() => {
        // Fallback to SSE when Neon Realtime WebSocket is unreachable
      });

    return () => {
      active = false;
      if (cleanup) cleanup();
    };
  }, [state?.vendor?.id, loadState]);

  if (!authSession) {
    return (
      <AuthView
        initialMode="login"
        onLoginSuccess={(user) => {
          setAuthSession(user);
          if (typeof window !== "undefined") {
            localStorage.setItem("caterlog_auth", JSON.stringify(user));
          }
          if (user.role) {
            const roleMap: Record<string, PlatformRole> = {
              reseller: "reseller",
              starter: "starter",
              growth: "growth",
              pro: "pro",
              vendor: "growth",
              supplier: "growth",
            };
            const target = roleMap[user.role] || "growth";
            setActiveWorkspace(target);
          }
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
        <div className="text-sm font-bold text-gray-900 mt-4">
          Loading Caterlog Business Manager...
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Connecting to live WhatsApp Coexistence engine
        </div>
      </div>
    );
  }

  // Handlers for Views
  const handleAddProduct = async (input: {
    skuCode?: string;
    name: string;
    description?: string;
    category?: string;
    priceNaira: number;
    stockTotal: number;
    primaryImageUrl?: string;
    variants?: any[];
    customFields?: Record<string, string>;
  }) => {
    try {
      const next = await api.addProduct({
        skuCode: input.skuCode || undefined,
        name: input.name,
        description: input.description,
        category: input.category,
        priceNaira: input.priceNaira,
        stockTotal: input.stockTotal,
        primaryImageUrl: input.primaryImageUrl,
        variants: input.variants,
        customFields: input.customFields,
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
      customFields?: Record<string, string>;
    },
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

  const handleUpdateProfile = async (input: {
    businessName?: string;
    whatsappPhone?: string;
    instagramHandle?: string;
    baseState?: string;
    baseCity?: string;
  }) => {
    try {
      const next = await api.updateProfile(input);
      setState(next);
      return true;
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      return false;
    }
  };

  const handleSimulateTransfer = async (
    orderCode: string,
    amountNaira: number,
  ) => {
    try {
      const res = await api.simulateTransfer(orderCode, amountNaira);
      if (res.state) setState(res.state);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleMarkDispatched = async (
    orderCode: string,
    riderPhone?: string,
  ) => {
    try {
      const next = await api.dispatchOrder(orderCode, riderPhone);
      setState(next);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleRefundOrder = async (orderCode: string, reason?: string) => {
    try {
      const res = await api.refundOrder(orderCode, { reason });
      if (res.state) setState(res.state);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      throw err;
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

  const handleAddDiscount = async (
    code: string,
    type: "PERCENTAGE" | "FLAT_KOBO",
    value: number,
  ) => {
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

  const handleSaveMarketBoost = async (
    input: Omit<
      Partial<NonNullable<VendorState["marketBoostListing"]>>,
      "startingPriceNaira"
    > & {
      startingPriceNaira?: number | string;
    },
  ) => {
    try {
      const res = await api.saveMarketBoost(input);
      if (res.state) setState(res.state);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleMirrorSupplier = async (
    supplierIdOrSlug: string,
    productSkus?: string[],
  ) => {
    const res = await api.mirrorSupplierCatalog({
      supplierIdOrSlug,
      productSkus,
    });
    if (res.state) setState(res.state);
  };

  const handleCreatePaymentLink = async (input: {
    customerName?: string;
    customerPhone?: string;
    productSku?: string;
    description?: string;
    amountNaira: number | string;
  }) => {
    try {
      const res = await api.createPaymentLink(input);
      if (res.state) setState(res.state);
      return res.link;
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      return null;
    }
  };

  const handleDeletePaymentLink = async (slug: string) => {
    try {
      const next = await api.deletePaymentLink(slug);
      setState(next);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSaveSplitRule = async (input: {
    name?: string;
    supplierSubAccountCode?: string;
    supplierShareBps: number;
    resellerShareBps: number;
    platformFeeBps?: number;
  }) => {
    try {
      const res = await api.saveSplitRule(input);
      if (res.state) setState(res.state);
      return true;
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      return false;
    }
  };

  const handleSubmitKyc = async (input: {
    businessName: string;
    cacNumber?: string;
    tinNumber?: string;
    businessAddress?: string;
    businessCategory?: string;
    bankCode?: string;
    accountNumber?: string;
    resolvedAccountName?: string;
    whatsappPhone?: string;
    instagramHandle?: string;
  }) => {
    try {
      const res = await api.submitKyc({
        businessName: input.businessName,
        cacNumber: input.cacNumber || "",
        tinNumber: input.tinNumber,
        businessAddress: input.businessAddress,
        businessCategory: input.businessCategory,
        bankCode: input.bankCode || "035",
        accountNumber: input.accountNumber || "",
        resolvedAccountName: input.resolvedAccountName || input.businessName,
        whatsappPhone: input.whatsappPhone,
        instagramHandle: input.instagramHandle,
      });
      if (res.state) setState(res.state);
      return true;
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      return false;
    }
  };

  const handleSaveTeamMember = async (input: {
    name: string;
    email: string;
    phone?: string;
    role: string;
    status?: "Active" | "Invited" | "Suspended";
    canManageOrders?: boolean;
    canManageInventory?: boolean;
    canViewPayouts?: boolean;
    canProcessRefunds?: boolean;
    canOverrideCopilot?: boolean;
  }) => {
    try {
      const res = await api.saveTeamMember(input);
      if (res.state) setState(res.state);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteTeamMember = async (idOrEmail: string) => {
    try {
      const next = await api.deleteTeamMember(idOrEmail);
      setState(next);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSyncNotifications = async (input: {
    readKeys?: string[];
    dismissedKeys?: string[];
    markAllRead?: boolean;
  }) => {
    try {
      const next = await api.syncNotifications(input);
      setState(next);
      return true;
    } catch {
      return false;
    }
  };

  const handleUpgradePlan = async (
    planId: SubscriptionPlanId,
    cycle: BillingCycle,
  ) => {
    try {
      const res = await api.upgradeSubscription({
        planId,
        billingCycle: cycle,
      });
      if (res.state) setState(res.state);
      return true;
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      return false;
    }
  };

  const handleFastTrackTrustTier = async (cacNumber?: string) => {
    try {
      const res = await api.fastTrackTrustTier({ cacNumber });
      if (res.state) setState(res.state);
      return true;
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      return false;
    }
  };

  // WhatsApp Simulator Handlers
  const handleSendVendorKeyword = async (
    text: string,
    attachedImage?: string,
  ) => {
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
    attachedImageUrl?: string,
    sourceChannel?: "WHATSAPP" | "INSTAGRAM" | "FACEBOOK",
  ) => {
    const res = await api.simulateWhatsApp({
      role: "BUYER_INQUIRY",
      text,
      buyerPhone: buyerPhone || undefined,
      buyerName: buyerName || undefined,
      quotedStatusImagePhash: phash,
      attachedImageUrl,
      simulateFastForwardIdleTimer: true,
      sourceChannel,
    });
    if (res.state) setState(res.state);
  };

  const handleSendVendorManualEcho = async (
    text: string,
    buyerPhone?: string,
  ) => {
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
      case "storefront":
        return activeWorkspace === "growth" || activeWorkspace === "pro"
          ? "Storefront & Website / Visual Brand Studio"
          : "Storefront / Catalog Customizer";
      case "bookings":
        return "Bookings / Wholesale & Network";
      case "network":
        return activeWorkspace === "pro"
          ? "My Resellers / Distribution Network"
          : activeWorkspace === "growth"
            ? "Network / Resellers & Suppliers"
            : activeWorkspace === "reseller"
              ? "Find Suppliers / Sourcing Directory"
              : "My Suppliers / Supply Chain";
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
      case "subscriptions":
        return "Plans & Billing / Platform Subscriptions";
      case "profile":
        return profileTab === "billing"
          ? "Profile / Billing & Subscription"
          : profileTab === "trust-tier"
            ? "Profile / Account Trust Tier"
            : profileTab === "verification"
              ? "Profile / Business KYC"
              : profileTab === "plans"
                ? "Profile / Subscription Plans"
                : "Profile / Merchant Identity";
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
        onToggleWorkspace={handleToggleWorkspace}
        onSelectRole={handleSelectRole}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        vendorName={state.vendor.businessName}
        subscription={state.subscription}
        impersonatedStaffRole={impersonatedStaffRole}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <TopNav
          vendor={state.vendor}
          connected={connected}
          onOpenSimulator={() => setSimulatorOpen(true)}
          simulatorOpen={simulatorOpen}
          onOpenTour={handleOpenTour}
          currentView={currentView}
          breadcrumb={getBreadcrumb()}
          activeWorkspace={activeWorkspace}
          onToggleWorkspace={handleToggleWorkspace}
          onSelectRole={handleSelectRole}
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
            } else if (v === "profile-settings" || v === "profile") {
              setProfileTab("profile");
              setCurrentView("profile");
            } else if (v === "verification") {
              setProfileTab("verification");
              setCurrentView("profile");
            } else if (v === "notification-settings") {
              setCurrentView("settings");
              setSettingsTab("notifications");
            } else if (v === "billing") {
              setCurrentView("settings");
              setSettingsTab("billing");
            } else if (v === "trust-tier") {
              setProfileTab("trust-tier");
              setCurrentView("profile");
            } else if (v === "subscriptions" || v === "plans") {
              setCurrentView("subscriptions");
            } else if (v === "settings") {
              setCurrentView("settings");
              setSettingsTab("setup");
            } else {
              setCurrentView(v as NavView);
            }
          }}
          onSignOut={() => {
            setAuthSession(null);
            setStoredSessionToken(null);
            if (typeof window !== "undefined") {
              localStorage.removeItem("caterlog_auth");
            }
          }}
        />

        {/* Staff Role Impersonation Banner */}
        {impersonatedStaffRole && (
          <div className="bg-amber-600 text-white px-4 py-2.5 text-xs font-semibold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-md z-30 sticky top-14">
            <div className="flex items-center gap-2">
              <span className="bg-black/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                Impersonation Testing Mode
              </span>
              <span>
                Viewing dashboard as <strong>{impersonatedStaffRole}</strong>.
                Menus and capabilities are restricted to this role&apos;s RBAC
                scope.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={impersonatedStaffRole}
                onChange={(e) => {
                  const role = e.target.value as StaffRole;
                  setImpersonatedStaffRole(role === "Owner" ? null : role);
                }}
                className="bg-white text-gray-900 text-xs rounded-lg px-2.5 py-1 font-semibold cursor-pointer border-0 shadow-xs"
              >
                <option value="Owner">👑 Return to Owner</option>
                <option value="Store Manager">👔 Store Manager</option>
                <option value="Store Attendant">🛎️ Store Attendant</option>
                <option value="Dispatch Coordinator">
                  🚚 Dispatch Coordinator
                </option>
                <option value="Catalog Editor">📦 Catalog Editor</option>
                <option value="Accountant">💰 Accountant</option>
              </select>
              <button
                onClick={() => setImpersonatedStaffRole(null)}
                className="bg-black/30 hover:bg-black/40 px-3 py-1 rounded-lg text-xs cursor-pointer font-bold transition-colors"
              >
                Exit Preview
              </button>
            </div>
          </div>
        )}

        {/* View Surface */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex justify-between items-center">
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="text-rose-500 hover:text-rose-700"
              >
                ✕
              </button>
            </div>
          )}

          {currentView === "overview" && (
            <OverviewView
              analytics={state.analytics}
              vendor={state.vendor}
              workspaceRole={activeWorkspace}
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
              onNavigateToNetwork={() => setCurrentView("network")}
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
              onOpenTour={() => handleOpenTour("overview")}
            />
          )}

          {currentView === "orders" && (
            <OrdersView
              orders={state.orders}
              selectedOrder={selectedOrder}
              vendor={state.vendor}
              workspaceRole={activeWorkspace}
              onStateChange={setState}
              initialStatusFilter={ordersFilter}
              onSelectOrder={handleSelectOrder}
              onSimulateTransfer={handleSimulateTransfer}
              onMarkDispatched={handleMarkDispatched}
              onRefundOrder={handleRefundOrder}
              onNavigateToPayments={() => setCurrentView("payments")}
              onNavigateToSettings={() => setCurrentView("settings")}
              onOpenTour={() => handleOpenTour("orders")}
            />
          )}

          {currentView === "products" && (
            <ProductsView
              products={state.products}
              suppliers={state.suppliers}
              resellerMirrors={state.resellerMirrors}
              workspaceRole={activeWorkspace}
              initialTab={productsTab}
              initialEditResellSku={editResellSku}
              onConsumeEditResellSku={() => setEditResellSku(null)}
              onAddProduct={handleAddProduct}
              onUpdateProduct={handleUpdateProduct}
              onUpdateStock={handleUpdateStock}
              onDeleteProduct={handleDeleteProduct}
              onNavigateToNetwork={() => setCurrentView("network")}
              onNavigateToSettings={() => setCurrentView("settings")}
              onSyncWhatsAppCatalog={handleSyncWhatsAppCatalog}
              onOpenTour={() => handleOpenTour("products")}
              onNavigateToBookings={() => setCurrentView("bookings")}
            />
          )}

          {currentView === "storefront" && (
            <StorefrontView
              state={state}
              activeWorkspace={activeWorkspace}
              onStateChange={setState}
              onNavigateToPlans={() => setCurrentView("subscriptions")}
            />
          )}

          {currentView === "bookings" && (
            <BookingsView
              products={state.products}
              orders={state.orders}
              onNavigateToProducts={() => setCurrentView("products")}
              onNavigateToPayments={() => setCurrentView("payments")}
              onOpenTour={() => handleOpenTour("bookings")}
            />
          )}

          {currentView === "network" && (
            <NetworkView
              workspaceRole={activeWorkspace}
              suppliers={state.suppliers}
              resellerMirrors={state.resellerMirrors}
              onMirrorSupplier={handleMirrorSupplier}
              onMirrorProducts={(skus) => {
                setProductsTab("reselling");
                setEditResellSku(skus?.[0] ?? null);
                setCurrentView("products");
              }}
              onOpenTour={() => handleOpenTour("network")}
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
              vendor={state.vendor}
              payoutWithdrawals={state.payoutWithdrawals}
              settlementSplitRules={state.settlementSplitRules}
              onSaveSplitRule={handleSaveSplitRule}
              initialOrderCode={selectedOrder?.shortCode}
              onSimulateTransfer={handleSimulateTransfer}
              onOpenTour={() => handleOpenTour("payments")}
              onNavigateToOrder={(code) => {
                const target =
                  state.orders.find((o) => o.shortCode === code) ||
                  state.orders[0];
                if (target) {
                  handleSelectOrder(target);
                  setCurrentView("orders");
                }
              }}
            />
          )}

          {currentView === "market-boost" && (
            <MarketBoostView
              vendorName={state.vendor.businessName}
              listing={state.marketBoostListing}
              products={state.products}
              suppliers={state.suppliers}
              resellerMirrors={state.resellerMirrors}
              onSaveListing={handleSaveMarketBoost}
            />
          )}

          {currentView === "analytics" && (
            <AnalyticsView
              analytics={state.analytics}
              orders={state.orders}
              products={state.products}
              workspaceRole={activeWorkspace}
              trustTier={state.trustTier}
              resellerMirrors={state.resellerMirrors}
              chatMessages={state.chatMessages}
              onNavigateToOrders={() => setCurrentView("orders")}
              onNavigateToPayments={() => setCurrentView("payments")}
              onNavigateToProducts={() => setCurrentView("products")}
              onOpenTour={() => handleOpenTour("analytics")}
            />
          )}

          {currentView === "payment-links" && (
            <PaymentLinksView
              products={state.products}
              orders={state.orders}
              paymentLinks={state.paymentLinks}
              onCreatePaymentLink={handleCreatePaymentLink}
              onDeletePaymentLink={handleDeletePaymentLink}
              vendorName={state.vendor.businessName}
              initialCustomerName={paymentLinkCustomer}
            />
          )}

          {currentView === "team" && (
            <TeamView
              vendorName={state.vendor.businessName}
              workspaceRole={activeWorkspace}
              teamMembers={state.teamMembers}
              commerceEvents={state.commerceEvents}
              activeImpersonatedRole={impersonatedStaffRole}
              onImpersonateRole={setImpersonatedStaffRole}
              onSaveTeamMember={handleSaveTeamMember}
              onDeleteTeamMember={handleDeleteTeamMember}
              onOpenTour={() => handleOpenTour("team")}
            />
          )}

          {currentView === "verification" && (
            <VerificationView
              vendor={state.vendor}
              vendorName={state.vendor.businessName}
              whatsappPhone={state.vendor.whatsappPhone}
              kycSubmissions={state.kycSubmissions}
              onSubmitKyc={handleSubmitKyc}
              onBack={() => setCurrentView("overview")}
              onComplete={() => setCurrentView("overview")}
            />
          )}

          {currentView === "notifications" && (
            <NotificationsView
              orders={state.orders}
              products={state.products}
              chatMessages={state.chatMessages}
              dbNotifications={state.notifications}
              onSyncNotifications={handleSyncNotifications}
              onNavigateToOrder={(code) => {
                const target =
                  state.orders.find((o) => o.shortCode === code) ||
                  state.orders[0];
                if (target) {
                  handleSelectOrder(target);
                  setCurrentView("orders");
                }
              }}
              onNavigateToPayments={() => setCurrentView("payments")}
              onNavigateToProducts={() => setCurrentView("products")}
            />
          )}

          {currentView === "subscriptions" && (
            <SubscriptionsView
              vendor={state.vendor}
              subscription={state.subscription}
              trustTier={state.trustTier}
              onUpgradePlan={handleUpgradePlan}
              onNavigateToKyc={() => {
                setProfileTab("verification");
                setCurrentView("profile");
              }}
              onNavigateToBilling={() => {
                setProfileTab("billing");
                setCurrentView("profile");
              }}
            />
          )}

          {currentView === "profile" && (
            <ProfileView
              key={profileTab}
              initialTab={profileTab}
              vendor={state.vendor}
              kycSubmissions={state.kycSubmissions}
              subscription={state.subscription}
              trustTier={state.trustTier}
              invoices={state.platformInvoices}
              onUpdateProfile={handleUpdateProfile}
              onSubmitKyc={handleSubmitKyc}
              onUpgradePlan={handleUpgradePlan}
              onFastTrackTrustTier={handleFastTrackTrustTier}
            />
          )}

          {currentView === "settings" && (
            <SettingsView
              key={settingsTab}
              initialTab={settingsTab}
              vendor={state.vendor}
              workspaceRole={activeWorkspace}
              onStateChange={setState}
              shippingZones={state.shippingZones}
              discounts={state.discounts}
              chatMessages={state.chatMessages}
              orders={state.orders}
              activeBuyerSession={state.activeBuyerSession}
              subscription={state.subscription}
              trustTier={state.trustTier}
              invoices={state.platformInvoices}
              onNavigateToPlans={() => setCurrentView("subscriptions")}
              onUpgradePlan={handleUpgradePlan}
              onFastTrackTrustTier={handleFastTrackTrustTier}
              onSendVendorManualEcho={handleSendVendorManualEcho}
              onUpdateSettings={handleUpdateSettings}
              onAddShippingZone={handleAddShippingZone}
              onDeleteShippingZone={handleDeleteShippingZone}
              onAddDiscount={handleAddDiscount}
              onDeleteDiscount={handleDeleteDiscount}
              onNavigateToOrder={(code) => {
                const target =
                  state.orders.find((o) => o.shortCode === code) ||
                  state.orders[0];
                if (target) {
                  handleSelectOrder(target);
                  setCurrentView("orders");
                }
              }}
            />
          )}
        </main>
      </div>

      {/* Omnichannel Live Interactive Simulator Drawer & Phone Mockup */}
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
        onNavigateToAnalytics={() => setCurrentView("analytics")}
        onNavigateToOrders={() => setCurrentView("orders")}
      />

      {/* Role-Aware Platform Tour Guide (Owners & Sub-Account Managers) */}
      <PlatformTourGuide
        isOpen={tourOpen}
        onClose={() => setTourOpen(false)}
        activeWorkspace={activeWorkspace}
        impersonatedStaffRole={impersonatedStaffRole}
        vendorName={state.vendor.businessName}
        onNavigate={(view) => setCurrentView(view)}
        onOpenSimulator={() => setSimulatorOpen(true)}
        initialChapter={tourInitialChapter}
      />
    </div>
  );
}
