"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LiveStorefrontPageClient } from "@/lib/storefront-blocks";

function StorefrontRootInner() {
  const searchParams = useSearchParams();
  const tierOverride = searchParams?.get("tier") ?? undefined;
  return <LiveStorefrontPageClient slug="store" tierOverride={tierOverride} />;
}

export default function StorefrontHomePage() {
  return (
    <Suspense fallback={null}>
      <StorefrontRootInner />
    </Suspense>
  );
}
