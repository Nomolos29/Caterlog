"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import type { Discount, Product, ShippingZone } from "@/lib/types";
import {
  resolveVendorStorefrontConfig,
  type StorefrontConfig,
} from "@/lib/storefront-presets";
import {
  StorefrontRenderer,
  type StorefrontVendorSummary,
} from "@/components/storefront/storefront-renderer";

export default function PublicVendorStorefrontPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const slug = params?.slug ? decodeURIComponent(params.slug) : "store";
  const tierOverride = searchParams?.get("tier") ?? undefined;

  const [vendor, setVendor] = useState<StorefrontVendorSummary | null>(null);
  const [config, setConfig] = useState<StorefrontConfig | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [shippingZones, setShippingZones] = useState<ShippingZone[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStorefront = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getPublicStorefront(slug, tierOverride);
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
      setLoading(false);
    }
  }, [slug, tierOverride]);

  useEffect(() => {
    void loadStorefront();
  }, [loadStorefront]);

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
          onClick={() => void loadStorefront()}
          className="px-5 py-2.5 rounded-full text-xs font-bold bg-gray-900 text-white cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <StorefrontRenderer
      vendor={vendor}
      products={products}
      shippingZones={shippingZones}
      discounts={discounts}
      config={config}
    />
  );
}
