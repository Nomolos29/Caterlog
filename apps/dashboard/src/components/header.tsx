"use client";

import { useEffect, useState } from "react";
import type { CopilotMode, Vendor } from "@/lib/types";

export interface SettingsInput {
  copilotMode?: CopilotMode;
  copilotIdleSeconds?: number;
  reservationTtlMinutes?: number;
}

interface HeaderProps {
  vendor: Vendor;
  connected: boolean;
  syncing: boolean;
  onSaveSettings: (input: SettingsInput) => void;
}

export function Header({ vendor, connected, syncing, onSaveSettings }: HeaderProps) {
  const [idleSeconds, setIdleSeconds] = useState(vendor.copilotIdleSeconds);
  const [ttlMinutes, setTtlMinutes] = useState(vendor.reservationTtlMinutes);

  // Keep drafts in sync when the server broadcasts updated settings.
  useEffect(() => setIdleSeconds(vendor.copilotIdleSeconds), [vendor.copilotIdleSeconds]);
  useEffect(() => setTtlMinutes(vendor.reservationTtlMinutes), [vendor.reservationTtlMinutes]);

  const commitIdle = () => {
    const value = Number(idleSeconds);
    if (Number.isFinite(value) && value !== vendor.copilotIdleSeconds) {
      onSaveSettings({ copilotIdleSeconds: value });
    }
  };

  const commitTtl = () => {
    const value = Number(ttlMinutes);
    if (Number.isFinite(value) && value !== vendor.reservationTtlMinutes) {
      onSaveSettings({ reservationTtlMinutes: value });
    }
  };

  return (
    <header className="border-b border-gray-800 bg-gray-900/90 backdrop-blur sticky top-0 z-30 px-4 sm:px-6 py-3.5">
      <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black text-lg">
            D
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-bold text-lg text-white">{vendor.businessName}</h1>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-950 text-emerald-400 border border-emerald-700/60">
                ✓ {vendor.verificationStatus === "VERIFIED" ? "Verified Seller" : "Seller"}
              </span>
              <span
                className={
                  connected
                    ? "px-2 py-0.5 text-[11px] rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    : "px-2 py-0.5 text-[11px] rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30"
                }
                title={connected ? "Receiving live state over SSE" : "SSE disconnected; retrying"}
              >
                {connected ? "● Live Sync Connected" : "○ Reconnecting…"}
              </span>
              {syncing ? (
                <span className="px-2 py-0.5 text-[11px] rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/30">
                  Syncing…
                </span>
              ) : null}
            </div>
            <p className="text-xs text-gray-400">
              Stage 1 Command Center • WhatsApp Coexistence &amp; Monnify Server-Verified Escrow
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-gray-950/90 border border-gray-800 rounded-xl px-3.5 py-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 font-medium">Co-Pilot:</span>
            <select
              value={vendor.copilotMode}
              onChange={(event) =>
                onSaveSettings({ copilotMode: event.target.value as CopilotMode })
              }
              className="bg-gray-900 border border-gray-700 text-xs font-semibold text-emerald-400 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
            >
              <option value="COPILOT">🟢 Co-Pilot (Idle Takeover)</option>
              <option value="FULL_AUTO">⚡ Full Auto (&lt;2s Reply)</option>
              <option value="MANUAL">⏸️ Manual Only</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 border-l border-gray-800 pl-3">
            <label className="text-xs text-gray-400" htmlFor="copilot-idle-input">
              Idle Timer (s):
            </label>
            <input
              id="copilot-idle-input"
              type="number"
              min={5}
              max={600}
              value={idleSeconds}
              onChange={(event) => setIdleSeconds(Number(event.target.value))}
              onBlur={commitIdle}
              className="w-16 bg-gray-900 border border-gray-700 text-xs text-white font-mono rounded-lg px-2 py-1 text-center"
            />
          </div>

          <div className="flex items-center gap-1.5 border-l border-gray-800 pl-3">
            <label className="text-xs text-gray-400" htmlFor="reservation-ttl-input">
              Stock Hold (m):
            </label>
            <input
              id="reservation-ttl-input"
              type="number"
              min={5}
              max={180}
              value={ttlMinutes}
              onChange={(event) => setTtlMinutes(Number(event.target.value))}
              onBlur={commitTtl}
              className="w-16 bg-gray-900 border border-gray-700 text-xs text-white font-mono rounded-lg px-2 py-1 text-center"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
