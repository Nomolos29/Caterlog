import React from "react";
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
} from "./icons";

export type NavView =
  | "overview"
  | "orders"
  | "products"
  | "network"
  | "customers"
  | "payments"
  | "market-boost"
  | "analytics"
  | "team"
  | "verification"
  | "notifications"
  | "settings"
  | "payment-links";

interface SidebarProps {
  currentView: NavView;
  onSelectView: (view: NavView) => void;
  pendingCount?: number;
  onOpenNewOrder?: () => void;
  activeWorkspace?: "reseller" | "supplier";
  onToggleWorkspace?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({
  currentView,
  onSelectView,
  pendingCount = 0,
  onOpenNewOrder,
  activeWorkspace = "reseller",
  onToggleWorkspace,
  mobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const navItems: Array<{ id: NavView; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: "overview", label: "Overview", icon: <OverviewIcon className="w-5 h-5" /> },
    { id: "orders", label: "Orders", icon: <OrdersIcon className="w-5 h-5" />, badge: pendingCount > 0 ? pendingCount : undefined },
    { id: "products", label: "Products", icon: <ProductsIcon className="w-5 h-5" /> },
    { id: "network", label: "Network", icon: <NetworkIcon className="w-5 h-5" /> },
    { id: "customers", label: "Customers", icon: <CustomersIcon className="w-5 h-5" /> },
    { id: "payments", label: "Payments", icon: <PaymentsIcon className="w-5 h-5" /> },
    { id: "market-boost", label: "Market Boost", icon: <MarketBoostIcon className="w-5 h-5" /> },
    { id: "analytics", label: "Analytics", icon: <AnalyticsIcon className="w-5 h-5" /> },
    { id: "team", label: "Team & Audit", icon: <TeamIcon className="w-5 h-5" /> },
    { id: "verification", label: "Verification", icon: <ShieldCheckIcon className="w-5 h-5" /> },
    { id: "notifications", label: "Notifications", icon: <BellIcon className="w-5 h-5" /> },
    { id: "settings", label: "Settings", icon: <SettingsIcon className="w-5 h-5" /> },
  ];

  const isReseller = activeWorkspace === "reseller";

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
              <div className="font-bold text-gray-900 tracking-tight text-lg leading-tight">Caterlog</div>
              <div className="text-[10px] font-semibold tracking-wider uppercase text-gray-400">BUSINESS MANAGER</div>
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
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all active:scale-[0.98] ${
                  isActive
                    ? "bg-[#eef2ff] text-[#1e1b4b] font-semibold shadow-2xs"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={isActive ? "text-[#1e1b4b]" : "text-gray-400"}>{item.icon}</span>
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
        {/* Merchant Store Card */}
        <div className="bg-[#f3f4f8] rounded-xl p-3 border border-transparent">
          <div className="font-semibold text-xs text-gray-900 flex items-center justify-between">
            <span>Nia Stores</span>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded-full">
              ✓ Verified
            </span>
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            Active Store · NGN Escrow
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
          <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
