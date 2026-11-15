"use client";

import { createRealtimeClient, type SealedLiveQuery } from "@neon/realtime/client";
import { api } from "./api";

const NEON_REALTIME_URL =
  process.env.NEXT_PUBLIC_NEON_REALTIME_URL ||
  "wss://ep-little-shadow-be1fbuks.rt.c-9.us-east-2.aws.neon.tech/";

/**
 * Subscribes to a sealed Neon Realtime live query on Lakebase Postgres (`orders` or `products`)
 * and triggers `onUpdate` whenever the query result changes.
 */
export async function subscribeToNeonRealtime(
  vendorId: string,
  onUpdate: (rows: readonly Record<string, unknown>[]) => void
): Promise<() => void> {
  const sealedResult = await api.sealRealtimeQuery("orders", vendorId, 50);
  if (!sealedResult?.sealed) {
    return () => {};
  }

  const client = createRealtimeClient({
    url: sealedResult.realtimeUrl || NEON_REALTIME_URL,
  });

  const subscription = client.subscribe(
    sealedResult.sealed as SealedLiveQuery<Record<string, unknown>>
  );

  const removeListener = subscription.onChange((snapshot) => {
    if (snapshot.data) {
      onUpdate(snapshot.data);
    }
  });

  return () => {
    removeListener();
    subscription.unsubscribe();
    client.close();
  };
}
