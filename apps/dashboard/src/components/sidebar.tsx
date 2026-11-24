import React from "react";
import type { SubscriptionInfo, PlatformRole } from "@/lib/types";
import { isResellerRole } from "@/lib/types";
import {
  CaterlogIcon,
  OverviewIcon,
  OrdersIcon,
  ProductsIcon,
  NetworkIcon,
  CustomersIcon,
  PaymentsIcon,
  MarketBoostIcon,
  SettingsIcon,
  AnalyticsIcon,
  TeamIcon,
  ShieldCheckIcon,
  BellIcon,
  PlusIcon,
  SparklesIcon,
  BookingsIcon,
} from "./icons";

export type NavView =
  | "overview"
  | "orders"
  | "products"
  | "storefront"
  | "bookings"
  | "network"
  | "customers"
  | "payments"
  | "profile"
  | "market-boost"
  | "analytics"
  | "team"
  | "verification"
  | "notifications"
  | "settings"
  | "payment-links"
  | "subscriptions";

interface SidebarProps {
  currentView: NavView;
  onSelectView: (view: NavView) => void;
  pendingCount?: number;
  onOpenNewOrder?: () => void;
  activeWorkspace?: PlatformRole;
  onToggleWorkspace?: () => void;
  onSelectRole?: (role: PlatformRole) => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  vendorName?: string;
  subscription?: SubscriptionInfo;
  impersonatedStaffRole?: string | null;
}

export function Sidebar({
  currentView,
  onSelectView,
  pendingCount = 0,
  onOpenNewOrder,
  activeWorkspace = "growth",
  onToggleWorkspace,
  onSelectRole,
  mobileOpen = false,
  onCloseMobile,
  vendorName,
  subscription,
  impersonatedStaffRole,
}: SidebarProps) {
  const planId = subscription?.planId || "GROWTH";

  const isPro = activeWorkspace === "pro";
  const isGrowth = activeWorkspace === "growth";
  const isReseller = activeWorkspace === "reseller";

  const networkLabel = isPro
    ? "My Resellers"
    : isGrowth
      ? "Network"
      : isReseller
        ? "Find Suppliers"
        : "My Suppliers";

  const navItems: Array<{
    id: NavView;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }> = [
    {
      id: "overview",
      label: "Overview",
      icon: <OverviewIcon className="w-5 h-5" />,
    },
    {
      id: "orders",
      label: "Orders",
      icon: <OrdersIcon className="w-5 h-5" />,
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
    {
      id: "products",
      label: "Products",
      icon: <ProductsIcon className="w-5 h-5" />,
    },
    {
      id: "storefront",
      label: isPro || isGrowth ? "Storefront & Website" : "Storefront",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l2-5h14l2 5M3 9c0 1.657 1.343 3 3 3s3-1.343 3-3m-6 0h18M9 9c0 1.657 1.343 3 3 3s3-1.343 3-3m0 0c0 1.657 1.343 3 3 3s3-1.343 3-3M5 12v8a1 1 0 001 1h12a1 1 0 001-1v-8" />
        </svg>
      ),
    },
    {
      id: "bookings",
      label: "Bookings",
      icon: <BookingsIcon className="w-5 h-5" />,
    },
    {
      id: "network",
      label: networkLabel,
      icon: <NetworkIcon className="w-5 h-5" />,
    },
    {
      id: "customers",
      label: "Customers",
      icon: <CustomersIcon className="w-5 h-5" />,
    },
    {
      id: "payments",
      label: "Payments",
      icon: <PaymentsIcon className="w-5 h-5" />,
    },
    {
      id: "subscriptions",
      label: "Plans & Pricing",
      icon: <SparklesIcon className="w-5 h-5" />,
    },
    {
      id: "market-boost",
      label: "Market Boost",
      icon: <MarketBoostIcon className="w-5 h-5" />,
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: <AnalyticsIcon className="w-5 h-5" />,
    },
    {
      id: "team",
      label: "Team & Audit",
      icon: <TeamIcon className="w-5 h-5" />,
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: <BellIcon className="w-5 h-5" />,
    },
    {
      id: "settings",
      label: "Settings",
      icon: <SettingsIcon className="w-5 h-5" />,
    },
  ];

  let allowedViews: NavView[] = [];
  if (impersonatedStaffRole === "Dispatch Coordinator") {
    allowedViews = ["overview", "orders", "notifications"];
  } else if (impersonatedStaffRole === "Catalog Editor") {
    allowedViews = ["overview", "products", "storefront", "notifications"];
  } else if (impersonatedStaffRole === "Accountant") {
    allowedViews = ["overview", "payments", "notifications"];
  } else if (impersonatedStaffRole === "Store Attendant") {
    allowedViews = [
      "overview",
      "orders",
      "products",
      "storefront",
      "customers",
      "notifications",
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
    ];
  } else if (activeWorkspace === "starter") {
    // 2. Starter Vendor ($10) - My Suppliers and Find Suppliers only, NO reseller network
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
    ];
  } else if (activeWorkspace === "growth") {
    // 3. Growth Vendor ($15) - My Suppliers and Find Suppliers, Market Boost, Team & Audit capped to 4
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
    ];
  } else {
    // 4. Pro Concierge Vendor ($20) - My Resellers, Bookings, Analytics, Team & Audit (Suppliers removed)
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
    ];
  }

  const visibleNavItems = navItems.filter((item) =>
    allowedViews.includes(item.id),
  );

  const handleItemClick = (id: NavView) => {
    onSelectView(id);
    if (onCloseMobile) onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full overflow-y-auto">
      <div>
        {/* Brand Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CaterlogIcon className="w-8 h-8 shrink-0" />
            <div>
              <div className="font-bold text-gray-900 tracking-tight text-lg leading-tight">
                Caterlog
              </div>
              <div className="text-[10px] font-semibold tracking-wider uppercase text-gray-400">
                BUSINESS MANAGER
              </div>
            </div>
          </div>
          {/* Close button on mobile */}
          {mobileOpen && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer transition-all"
            >
              ✕
            </button>
          )}
        </div>

        {/* Main Navigation List */}
        <nav className="p-3 space-y-1">
          {visibleNavItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                data-tour={`nav-${item.id}`}
                onClick={() => handleItemClick(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all active:scale-[0.98] ${
                  isActive
                    ? "bg-[#eef2ff] text-[#1e1b4b] font-semibold shadow-2xs"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={isActive ? "text-[#1e1b4b]" : "text-gray-400"}
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge ? (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Navigation & Merchant Store Card */}
      <div className="p-4 space-y-3">
        {/* Merchant Store Card with 4-Role Switcher */}
        <div
          data-tour="sidebar-role-card"
          className="bg-[#f3f4f8] rounded-2xl p-3 border border-gray-200/60 shadow-2xs space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-xs text-gray-900 truncate pr-2">
              {vendorName ||
                (activeWorkspace === "reseller"
                  ? "Nia Stores"
                  : "Aroko Wholesale")}
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 uppercase tracking-wide ${
                activeWorkspace === "reseller"
                  ? "bg-blue-100 text-blue-800"
                  : activeWorkspace === "starter"
                    ? "bg-amber-100 text-amber-900"
                    : activeWorkspace === "growth"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-purple-100 text-purple-900"
              }`}
            >
              {activeWorkspace === "reseller"
                ? "Reseller"
                : activeWorkspace === "starter"
                  ? "Starter"
                  : activeWorkspace === "growth"
                    ? "Growth"
                    : "Pro"}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-gray-700">
              {activeWorkspace === "reseller"
                ? "Reseller ($5/mo)"
                : activeWorkspace === "starter"
                  ? "Starter ($10/mo)"
                  : activeWorkspace === "growth"
                    ? "Growth ($15/mo)"
                    : "Pro Concierge ($20/mo)"}
            </span>
            <button
              type="button"
              onClick={() => handleItemClick("subscriptions")}
              className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
            >
              Plans →
            </button>
          </div>

          {/* 4-Role Interactive Switcher Pills */}
          <div
            className="pt-2 border-t border-gray-200/80"
            data-tour="sidebar-role-pills"
          >
            <div className="text-[10px] uppercase font-bold text-gray-400 mb-1.5 flex items-center justify-between">
              <span>Platform Role</span>
              <span className="font-normal text-[9px] text-gray-400">
                1-tap switch
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[11px]">
              <button
                type="button"
                onClick={() =>
                  onSelectRole
                    ? onSelectRole("reseller")
                    : onToggleWorkspace?.()
                }
                className={`py-1.5 px-2 rounded-lg font-semibold text-center transition-all cursor-pointer ${
                  activeWorkspace === "reseller"
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
                title="Reseller / Dropshipper ($5/mo)"
              >
                Reseller ($5)
              </button>
              <button
                type="button"
                onClick={() =>
                  onSelectRole ? onSelectRole("starter") : onToggleWorkspace?.()
                }
                className={`py-1.5 px-2 rounded-lg font-semibold text-center transition-all cursor-pointer ${
                  activeWorkspace === "starter"
                    ? "bg-amber-600 text-white shadow-2xs"
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
                title="Starter Vendor ($10/mo)"
              >
                Starter ($10)
              </button>
              <button
                type="button"
                onClick={() =>
                  onSelectRole ? onSelectRole("growth") : onToggleWorkspace?.()
                }
                className={`py-1.5 px-2 rounded-lg font-semibold text-center transition-all cursor-pointer ${
                  activeWorkspace === "growth"
                    ? "bg-emerald-700 text-white shadow-2xs"
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
                title="Growth Vendor ($15/mo)"
              >
                Growth ($15)
              </button>
              <button
                type="button"
                onClick={() =>
                  onSelectRole ? onSelectRole("pro") : onToggleWorkspace?.()
                }
                className={`py-1.5 px-2 rounded-lg font-semibold text-center transition-all cursor-pointer ${
                  activeWorkspace === "pro"
                    ? "bg-purple-700 text-white shadow-2xs"
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
                title="Pro Concierge Vendor ($20/mo)"
              >
                Pro ($20)
              </button>
            </div>
          </div>
        </div>

        {/* Solid Green Primary Action Button */}
        <button
          onClick={() => {
            onOpenNewOrder?.();
            if (onCloseMobile) onCloseMobile();
          }}
          className="w-full bg-[#0d5c3a] hover:bg-[#0b4b2f] active:scale-[0.98] text-white font-medium text-xs py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-2xs cursor-pointer hover:shadow-xs"
        >
          <PlusIcon className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>New Order</span>
        </button>

        {/* Help Center */}
        <a
          href="https://wa.me/2348000000000"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2.5 px-2.5 py-2 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
        >
          <svg
            className="w-4 h-4 text-gray-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>Help Center</span>
        </a>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-gray-100 flex-col justify-between shrink-0 min-h-screen select-none sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (with backdrop) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            onClick={onCloseMobile}
            className="fixed inset-0 bg-black/40 backdrop-blur-2xs transition-opacity animate-in fade-in duration-200"
          />

          {/* Drawer Surface */}
          <div className="relative w-72 bg-white flex flex-col justify-between h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200 select-none">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
