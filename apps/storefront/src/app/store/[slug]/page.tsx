"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { LiveStorefrontPageClient } from "@caterlog/storefront-blocks";

function StoreSlugInner() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const slug = params?.slug ? decodeURIComponent(params.slug) : "store";
  const tierOverride = searchParams?.get("tier") ?? undefined;

  return <LiveStorefrontPageClient slug={slug} tierOverride={tierOverride} />;
}

export default function StoreSlugStorefrontPage() {
  return (
    <Suspense fallback={null}>
      <StoreSlugInner />
    </Suspense>
  );
}
