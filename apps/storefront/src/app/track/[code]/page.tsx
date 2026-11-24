"use client";

import { Suspense } from "react";
import { LiveStorefrontPageClient } from "@/lib/storefront-blocks";

export default function StorefrontTrackPage() {
  return (
    <Suspense fallback={null}>
      <LiveStorefrontPageClient slug="store" initialPage="track" />
    </Suspense>
  );
}
