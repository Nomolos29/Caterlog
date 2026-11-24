"use client";

import { useParams, useSearchParams } from "next/navigation";
import { LiveStorefrontPageClient } from "@/lib/storefront-presets";

export default function PublicVendorStorefrontPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const slug = params?.slug ? decodeURIComponent(params.slug) : "store";
  const tierOverride = searchParams?.get("tier") ?? undefined;

  return <LiveStorefrontPageClient slug={slug} tierOverride={tierOverride} />;
}
