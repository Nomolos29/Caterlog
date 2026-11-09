"use client";

import React from "react";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  badge?: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  children?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon = "📦",
  badge,
  title,
  description,
  action,
  secondaryAction,
  children,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`py-16 sm:py-24 max-w-xl mx-auto px-4 text-center flex flex-col items-center justify-center ${className}`}
    >
      {badge && (
        <span className="text-[10px] font-extrabold uppercase tracking-widest px-3.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/60 mb-5">
          {badge}
        </span>
      )}

      {icon && (
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-b from-emerald-500/10 to-emerald-500/5 text-emerald-700 flex items-center justify-center text-3xl sm:text-4xl mb-6 ring-8 ring-emerald-500/[0.04] transition-transform duration-300 hover:scale-105 select-none">
          {icon}
        </div>
      )}

      <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-3">
        {title}
      </h2>

      <p className="text-sm sm:text-base text-gray-500 leading-relaxed max-w-lg mb-8 font-normal">
        {description}
      </p>

      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0d5c3a] hover:bg-[#0b4b2f] text-white text-sm font-semibold shadow-xs hover:shadow transition-all active:scale-95 cursor-pointer"
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          )}

          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold transition-all cursor-pointer"
            >
              {secondaryAction.icon}
              <span>{secondaryAction.label}</span>
            </button>
          )}
        </div>
      )}

      {children && <div className="mt-8 w-full">{children}</div>}
    </div>
  );
}
