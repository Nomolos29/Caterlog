"use client";

import { Suspense } from "react";
import { LiveStorefrontPageClient } from "@caterlog/storefront-blocks";

export default function StorefrontTrackPage() {
  return (
    <Suspense fallback={null}>
      <LiveStorefrontPageClient slug="store" initialPage="track" />
    </Suspense>
  );
}
