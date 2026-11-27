"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

export interface TableActionMenuItem {
  label: string;
  icon?: string;
  onClick: () => void;
  variant?: "default" | "danger" | "emerald";
  disabled?: boolean;
}

interface TableActionMenuProps {
  items: TableActionMenuItem[];
  primaryAction?: {
    label: string;
    onClick: () => void;
    className?: string;
  };
  ariaLabel?: string;
}

export function TableActionMenu({
  items,
  primaryAction,
  ariaLabel = "Row actions",
}: TableActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; openUp: boolean }>({
    top: 0,
    left: 0,
    openUp: false,
  });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateCoords = () => {
    if (!btnRef.current || typeof window === "undefined") return;
    const rect = btnRef.current.getBoundingClientRect();
    const menuWidth = 210;
    const estimatedHeight = items.length * 38 + 16;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < estimatedHeight && rect.top > estimatedHeight;
    const left = Math.max(12, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12));
    const top = openUp ? rect.top - 6 : rect.bottom + 6;
    setCoords({ top, left, openUp });
  };

  useEffect(() => {
    if (!open) return;
    updateCoords();

    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        btnRef.current &&
        !btnRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      setOpen(false);
    };

    window.addEventListener("mousedown", handleOutside);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open, items.length]);

  const visibleItems = items.filter(Boolean);

  return (
    <div
      className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap"
      onClick={(e) => e.stopPropagation()}
    >
      {primaryAction && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            primaryAction.onClick();
          }}
          className={
            primaryAction.className ||
            "px-2.5 py-1 rounded-lg border border-gray-200 hover:border-emerald-600 hover:bg-emerald-50 text-gray-700 hover:text-emerald-800 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap"
          }
        >
          {primaryAction.label}
        </button>
      )}

      <button
        ref={btnRef}
        type="button"
        aria-label={ariaLabel}
        onClick={(e) => {
          e.stopPropagation();
          if (!open) updateCoords();
          setOpen((prev) => !prev);
        }}
        className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
          open
            ? "border-[#0d5c3a] bg-emerald-50 text-[#0d5c3a] shadow-2xs"
            : "border-gray-200 bg-white hover:bg-gray-100 text-gray-600 hover:text-gray-900"
        }`}
        title="Actions menu"
      >
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 6a1.75 1.75 0 110-3.5A1.75 1.75 0 0110 6zm0 5.75a1.75 1.75 0 110-3.5 1.75 1.75 0 010 3.5zm0 5.75a1.75 1.75 0 110-3.5 1.75 1.75 0 010 3.5z" />
        </svg>
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              transform: coords.openUp ? "translateY(-100%)" : undefined,
              zIndex: 9999,
            }}
            className="w-[210px] bg-white rounded-2xl border border-gray-200 shadow-2xl p-1.5 space-y-0.5 text-left animate-popup-spring"
          >
            {visibleItems.map((item, idx) => (
              <button
                key={idx}
                type="button"
                disabled={item.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  item.onClick();
                }}
                className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                  item.variant === "danger"
                    ? "text-rose-600 hover:bg-rose-50"
                    : item.variant === "emerald"
                      ? "text-[#0d5c3a] hover:bg-emerald-50 font-bold"
                      : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                {item.icon && <span className="text-sm shrink-0">{item.icon}</span>}
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
