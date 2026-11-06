import type { EnvLike } from "@caterlog/integrations";
import { InlineJobScheduler } from "./inline.ts";
import type { BackgroundJobScheduler } from "./types.ts";

export type { BackgroundJobScheduler };

export type JobsMode = "off" | "inline" | "bullmq";

export interface JobsConfig {
  mode: JobsMode;
  queueName: string;
  prefix?: string;
  sweepIntervalMs: number;
}

export function resolveJobsConfig(env: EnvLike = process.env): JobsConfig {
  const raw = (env.JOBS_MODE ?? "inline").trim().toLowerCase();
  let mode: JobsMode;
  if (raw === "" || raw === "off" || raw === "disabled" || raw === "none") {
    mode = "off";
  } else if (raw === "inline" || raw === "timer" || raw === "memory") {
    mode = "inline";
  } else if (raw === "redis" || raw === "bullmq") {
    mode = "bullmq";
  } else {
    throw new Error(`Invalid JOBS_MODE="${env.JOBS_MODE}". Use "off", "inline" or "redis".`);
  }

  if (mode === "bullmq" && !env.REDIS_URL?.trim()) {
    throw new Error("JOBS_MODE=redis requires REDIS_URL (e.g. redis://localhost:6379).");
  }

  const sweepRaw = Number(env.ORDER_SWEEP_INTERVAL_MS ?? 30_000);
  const sweepIntervalMs =
    Number.isFinite(sweepRaw) && sweepRaw >= 1_000 ? Math.round(sweepRaw) : 30_000;

  return {
    mode,
    queueName: env.JOBS_QUEUE_NAME?.trim() || "caterlog-jobs",
    prefix: env.JOBS_QUEUE_PREFIX?.trim() || undefined,
    sweepIntervalMs,
  };
}

export async function createJobScheduler(
  env: EnvLike = process.env
): Promise<{ scheduler: BackgroundJobScheduler | null; config: JobsConfig }> {
  const config = resolveJobsConfig(env);
  if (config.mode === "off") {
    return { scheduler: null, config };
  }
  if (config.mode === "inline") {
    return { scheduler: new InlineJobScheduler(), config };
  }

  const { BullMqJobScheduler } = await import("./bullmq.ts");
  return {
    scheduler: new BullMqJobScheduler({
      redisUrl: env.REDIS_URL!.trim(),
      queueName: config.queueName,
      prefix: config.prefix,
    }),
    config,
  };
}
