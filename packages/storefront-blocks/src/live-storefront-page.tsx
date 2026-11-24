"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  PublicStorefrontPayload,
  StorefrontActivePage,
  StorefrontDiscount,
  StorefrontProduct,
  StorefrontShippingZone,
  StorefrontVendorSummary,
} from "./types";
import {
  resolveVendorStorefrontConfig,
  type StorefrontConfig,
} from "./presets";
import { StorefrontRenderer } from "./storefront-renderer";

export interface LiveStorefrontPageClientProps {
  slug?: string;
  tierOverride?: string;
  initialPage?: StorefrontActivePage;
}

export function LiveStorefrontPageClient({
  slug = "store",
  tierOverride,
  initialPage,
}: LiveStorefrontPageClientProps) {
  const [vendor, setVendor] = useState<StorefrontVendorSummary | null>(null);
  const [config, setConfig] = useState<StorefrontConfig | null>(null);
  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  const [shippingZones, setShippingZones] = useState<StorefrontShippingZone[]>([]);
  const [discounts, setDiscounts] = useState<StorefrontDiscount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);

  const getApiHost = useCallback(() => {
    if (typeof window !== "undefined") {
      return `http://${window.location.hostname}:4000`;
    }
    return "http://127.0.0.1:4000";
  }, []);

  const loadStorefront = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      const slugSegment = slug ? `/${encodeURIComponent(slug)}` : "";
      const query = tierOverride ? `?tier=${encodeURIComponent(tierOverride)}` : "";
      const relativeUrl = `/api/v1/public/storefront${slugSegment}${query}`;
      const directUrl = `${getApiHost()}${relativeUrl}`;

      try {
        let res: Response;
        try {
          res = await fetch(relativeUrl, { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } catch {
          res = await fetch(directUrl, { cache: "no-store" });
        }
        if (!res.ok) {
          throw new Error(`Storefront request failed with HTTP ${res.status}`);
        }
        const data = (await res.json()) as PublicStorefrontPayload;
        setVendor(data.vendor);
        setConfig(
          resolveVendorStorefrontConfig(
            data.storefrontConfig,
            tierOverride || data.vendor.subscriptionPlanId || data.vendor.role,
            data.vendor.businessName
          )
        );
        setProducts(data.products ?? []);
        setShippingZones(data.shippingZones ?? []);
        setDiscounts(data.discounts ?? []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load storefront.");
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [slug, tierOverride, getApiHost]
  );

  useEffect(() => {
    void loadStorefront(true);
  }, [loadStorefront]);

  // Real-Time Synchronization via Server-Sent Events (SSE) + BroadcastChannel
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Server-Sent Events from Backend API (Port 4000)
    let source: EventSource | null = null;
    if ("EventSource" in window) {
      source = new EventSource(`${getApiHost()}/api/v1/events`);
      source.onopen = () => setLiveConnected(true);
      source.onerror = () => setLiveConnected(false);
      source.onmessage = (event) => {
        try {
          const snapshot = JSON.parse(event.data);
          if (snapshot?.vendor) {
            const v = snapshot.vendor;
            const roleOrPlan =
              tierOverride ||
              snapshot.subscription?.planId ||
              v.subscription?.planId ||
              v.role;
            setVendor((prev) => ({
              id: v.id,
              slug: v.slug,
              businessName: v.businessName,
              role: v.role,
              whatsappPhone: v.whatsappPhone,
              verificationStatus: v.verificationStatus,
              cacNumber: v.cacNumber,
              instagramHandle: v.instagramHandle,
              facebookPageName: v.facebookPageName,
              baseState: v.baseState ?? prev?.baseState ?? "Lagos",
              baseCity: v.baseCity ?? prev?.baseCity ?? "Ikeja",
              reservationTtlMinutes: v.reservationTtlMinutes ?? 15,
              subscriptionPlanId: roleOrPlan,
            }));
            setConfig(
              resolveVendorStorefrontConfig(
                snapshot.storefrontConfig ?? v.storefrontConfig,
                roleOrPlan,
                v.businessName
              )
            );
          }
          if (Array.isArray(snapshot?.products)) {
            setProducts(snapshot.products);
          }
          if (Array.isArray(snapshot?.shippingZones)) {
            setShippingZones(snapshot.shippingZones);
          }
          if (Array.isArray(snapshot?.discounts)) {
            setDiscounts(snapshot.discounts);
          }
          setLiveConnected(true);
        } catch {
          // Ignore malformed SSE frame
        }
      };
    }

    // 2. Same-Browser Instant Draft & Publish BroadcastChannel from Dashboard Studio
    let bc: BroadcastChannel | null = null;
    if ("BroadcastChannel" in window) {
      bc = new BroadcastChannel("caterlog_realtime_sync");
      bc.onmessage = (ev) => {
        if (ev.data?.type === "STOREFRONT_CONFIG_DRAFT" && ev.data?.config) {
          setConfig(ev.data.config);
        } else {
          void loadStorefront(false);
        }
      };
    }

    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        void loadStorefront(false);
      }
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      if (source) source.close();
      if (bc) bc.close();
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [getApiHost, loadStorefront, tierOverride]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white text-gray-900 p-6">
        <div className="w-9 h-9 rounded-full border-2 border-gray-900 border-t-transparent animate-spin mb-3" />
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Loading Storefront...
        </p>
      </div>
    );
  }

  if (error || !vendor || !config) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-900 p-6 text-center">
        <h1 className="text-xl font-bold mb-2">Storefront Unavailable</h1>
        <p className="text-xs text-gray-500 mb-4 max-w-md">
          {error || "Could not load this vendor storefront."}
        </p>
        <button
          type="button"
          onClick={() => void loadStorefront(true)}
          className="px-5 py-2.5 rounded-full text-xs font-bold bg-gray-900 text-white cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <StorefrontRenderer
        vendor={vendor}
        products={products}
        shippingZones={shippingZones}
        discounts={discounts}
        config={config}
        initialPage={initialPage}
        onOrderCompleted={() => void loadStorefront(false)}
      />
      {liveConnected && (
        <div
          title="Realtime Storefront Sync Active"
          className="fixed bottom-3 left-3 z-40 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md text-white text-[10px] font-semibold flex items-center gap-1.5 pointer-events-none select-none opacity-65"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Live Sync</span>
        </div>
      )}
    </div>
  );
}
