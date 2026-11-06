import type { CaterlogStage1Engine } from "../runtime-engine.ts";
import type { BackgroundJobHandler } from "./types.ts";

/**
 * Translates queued job names into idempotent engine operations.
 *
 * Every handler tolerates stale jobs: an order that was already paid or expired
 * simply becomes a no-op when the delayed job eventually runs.
 */

export function createJobHandler(engine: CaterlogStage1Engine): BackgroundJobHandler {
  return async (job) => {
    switch (job.name) {
      case "order-expiry": {
        const expired = await engine.expireOrderReservation(job.payload.orderShortCode);
        if (expired) {
          console.log(`[caterlog:jobs] Released expired reservation ${expired.shortCode}.`);
        }
        return;
      }
      case "payment-reminder": {
        await engine.sendPaymentReminder(job.payload.orderShortCode);
        return;
      }
      case "order-expiry-sweep": {
        const expired = await engine.expireOverdueOrders();
        if (expired.length > 0) {
          console.log(
            `[caterlog:jobs] Sweep released ${expired.length} expired reservation(s): ${expired
              .map((order) => order.shortCode)
              .join(", ")}`
          );
        }
        return;
      }
    }
  };
}
