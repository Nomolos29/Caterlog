"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { VendorState } from "@/lib/types";
import { AnalyticsStrip } from "./analytics-strip";
import { CatalogPanel } from "./catalog-panel";
import { ChatPanel } from "./chat-panel";
import { Header, type SettingsInput } from "./header";
import { OrdersPanel } from "./orders-panel";
import { ShippingPanel } from "./shipping-panel";

type Tab = "orders" | "catalog" | "shipping";

export type RunAction = (action: () => Promise<VendorState>) => Promise<boolean>;

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "orders", label: "🧾 Orders & Monnify Escrow" },
  { id: "catalog", label: "📦 Inventory & OG Card Preview" },
  { id: "shipping", label: "🚚 Shipping Zones & Discounts" },
];

export function Dashboard() {
  const [state, setState] = useState<VendorState | null>(null);
  const [tab, setTab] = useState<Tab>("orders");
  const [connected, setConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const load = useCallback(async () => {
    try {
      const next = await api.getState();
      setState(next);
      setError(null);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, reloadToken]);

  // Live state synchronization over Server-Sent Events.
  useEffect(() => {
    if (typeof window === "undefined" || !("EventSource" in window)) return;

    const source = new EventSource(api.eventsUrl);
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (event) => {
      try {
        setState(JSON.parse(event.data) as VendorState);
        setConnected(true);
        setError(null);
      } catch {
        // Ignore malformed SSE frames; the next valid frame will resync.
      }
    };

    return () => source.close();
  }, [reloadToken]);

  const run: RunAction = useCallback(async (action) => {
    setSyncing(true);
    setError(null);
    try {
      setState(await action());
      return true;
    } catch (err) {
      setError(describeError(err));
      return false;
    } finally {
      setSyncing(false);
    }
  }, []);

  const saveSettings = useCallback(
    (input: SettingsInput) => {
      void run(() => api.updateSettings(input));
    },
    [run]
  );

  const retry = useCallback(() => {
    setError(null);
    setInitialLoading(true);
    setReloadToken((token) => token + 1);
  }, []);

  const tabButtons = useMemo(
    () =>
      TABS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => setTab(id)}
          className={
            id === tab
              ? "px-4 py-2.5 text-sm font-semibold border-b-2 border-emerald-500 text-emerald-400"
              : "px-4 py-2.5 text-sm font-semibold border-b-2 border-transparent text-gray-400 hover:text-white"
          }
        >
          {label}
        </button>
      )),
    [tab]
  );

  if (initialLoading && !state) {
    return <LoadingScreen />;
  }

  if (!state) {
    return <FatalErrorScreen message={error} onRetry={retry} />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        vendor={state.vendor}
        connected={connected}
        syncing={syncing}
        onSaveSettings={saveSettings}
      />

      {error ? (
        <div className="border-b border-rose-900/60 bg-rose-950/40 px-6 py-2.5">
          <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-2 text-xs text-rose-200">
            <span>⚠️ {error}</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={retry}
                className="font-semibold text-rose-100 underline underline-offset-2"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-rose-300 hover:text-white"
                aria-label="Dismiss error"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <main className="max-w-[1600px] w-full mx-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
        <section className="lg:col-span-7 flex flex-col gap-6">
          <AnalyticsStrip analytics={state.analytics} />

          <div className="flex border-b border-gray-800 gap-2 overflow-x-auto">{tabButtons}</div>

          <div className="animate-fade-up">
            {tab === "orders" ? (
              <OrdersPanel orders={state.orders} run={run} />
            ) : null}
            {tab === "catalog" ? (
              <CatalogPanel products={state.products} run={run} />
            ) : null}
            {tab === "shipping" ? (
              <ShippingPanel
                zones={state.shippingZones}
                discounts={state.discounts}
                run={run}
              />
            ) : null}
          </div>
        </section>

        <ChatPanel
          messages={state.chatMessages}
          activeBuyerSession={state.activeBuyerSession}
          run={run}
        />
      </main>
    </div>
  );
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black text-lg animate-pulse">
          D
        </div>
        <p className="text-sm text-gray-300">Connecting to Caterlog Vendor API…</p>
        <p className="text-xs text-gray-500">Loading orders, catalog and WhatsApp threads.</p>
      </div>
    </div>
  );
}

function FatalErrorScreen({
  message,
  onRetry,
}: {
  message: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center space-y-3">
        <div className="text-3xl">📡</div>
        <h1 className="text-lg font-bold text-white">Cannot reach the Caterlog API</h1>
        <p className="text-xs text-gray-400 break-words">
          {message ?? "The API did not respond. Is it running on port 4000?"}
        </p>
        <p className="text-xs text-gray-500">
          Start it with <code className="text-emerald-400">npm run dev:api</code>, then retry.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-lg"
        >
          Retry connection
        </button>
      </div>
    </div>
  );
}
