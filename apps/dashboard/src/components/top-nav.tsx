import React from "react";
import { SearchIcon, BellIcon } from "./icons";
import type { VendorProfile } from "@/lib/types";

interface TopNavProps {
  vendor: VendorProfile;
  connected?: boolean;
  onOpenSimulator?: () => void;
  simulatorOpen?: boolean;
  breadcrumb?: string;
  activeWorkspace?: "reseller" | "supplier";
}

export function TopNav({
  vendor,
  connected = true,
  onOpenSimulator,
  simulatorOpen = false,
  breadcrumb = "Overview",
  activeWorkspace = "reseller",
}: TopNavProps) {
  const initials = activeWorkspace === "reseller" ? "NS" : "AW";

  return (
    <header className="h-14 bg-white border-b border-gray-100 px-8 flex items-center justify-between sticky top-0 z-20">
      {/* Left: Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
        <span>{breadcrumb}</span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Toggle WhatsApp Simulator Live Test Drawer */}
        <button
          onClick={onOpenSimulator}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
            simulatorOpen
              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
              : "bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200"
          }`}
          title="Open interactive WhatsApp Buyer/Vendor Simulation Drawer"
        >
          <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`} />
          <span>WhatsApp Simulator</span>
        </button>

        {/* Search Icon */}
        <button className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-50">
          <SearchIcon className="w-4 h-4" />
        </button>

        {/* Notification Bell */}
        <div className="relative">
          <button className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg relative hover:bg-gray-50">
            <BellIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Profile Avatar Pill */}
        <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center font-semibold text-xs ml-1">
          {initials}
        </div>
      </div>
    </header>
  );
}

