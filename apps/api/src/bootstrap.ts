import type { EnvLike } from "@caterlog/integrations";
import { CaterlogStage1Engine } from "./runtime-engine.ts";
import type { DataMode } from "./persistence/types.ts";
import {
  createJobScheduler,
  type BackgroundJobScheduler,
  type JobsConfig,
} from "./jobs/factory.ts";
import { createJobHandler } from "./jobs/handler.ts";

export interface BootOptions {
  env?: EnvLike;
  /** Overrides `PERSISTENCE_VENDOR_SLUG` when supplied. */
  vendorSlug?: string;
}

export interface BootResult {
  engine: CaterlogStage1Engine;
  dataMode: DataMode;
  vendorSlug: string;
  scheduler: BackgroundJobScheduler | null;
  jobsConfig: JobsConfig;
  shutdown: () => Promise<void>;
}

/**
 * Resolves `DATA_MODE` (defaults to `memory`).
 *
 * `memory` keeps the zero-dependency Stage 1 demo. `database` requires a
 * PostgreSQL `DATABASE_URL` and a migrated + seeded database.
 */
export function resolveDataMode(env: EnvLike = process.env): DataMode {
  const raw = (env.DATA_MODE ?? "memory").trim().toLowerCase();
  if (raw === "" || raw === "memory" || raw === "mem" || raw === "in-memory") {
    return "memory";
  }
  if (raw === "database" || raw === "db" || raw === "postgres") {
    return "database";
  }
  throw new Error(
    `Invalid DATA_MODE="${env.DATA_MODE}". Use "memory" or "database".`
  );
}

/**
 * Builds the runtime engine for the selected data mode.
 *
 * The Prisma store is imported lazily so `DATA_MODE=memory` never loads the
 * generated client or needs a `DATABASE_URL`.
 */
export async function createEngineFromEnv(
  options: BootOptions = {}
): Promise<BootResult> {
  const env = options.env ?? process.env;
  const dataMode = resolveDataMode(env);
  const engine = new CaterlogStage1Engine(env);
  const vendorSlug =
    options.vendorSlug ?? env.PERSISTENCE_VENDOR_SLUG?.trim() ?? engine.vendor.slug;

  const { scheduler, config: jobsConfig } = await createJobScheduler(env);
  if (scheduler) {
    await scheduler.start(createJobHandler(engine));
    engine.attachJobScheduler(scheduler);
    console.log(
      `[caterlog:jobs] Background scheduler started in "${jobsConfig.mode}" mode.`
    );
  }

  const shutdown = async (): Promise<void> => {
    if (scheduler) {
      try {
        await scheduler.stop();
      } catch (err) {
        console.error("[caterlog:jobs] Background scheduler stop failed:", err);
      }
    }
    await engine.closePersistence();
  };

  if (dataMode === "database") {
    if (!env.DATABASE_URL || env.DATABASE_URL.trim() === "") {
      throw new Error(
        "DATA_MODE=database requires DATABASE_URL (e.g. a Neon/Supabase PostgreSQL connection string)."
      );
    }
    const { createPrismaPersistence } = await import("./persistence/prisma.ts");
    const store = createPrismaPersistence(vendorSlug);
    await engine.attachPersistence(store, vendorSlug);
    console.log(
      `[caterlog] DATA_MODE=database — hydrated vendor "${vendorSlug}" from PostgreSQL.`
    );
  } else {
    const { createMemoryPersistence } = await import("./persistence/memory.ts");
    const store = createMemoryPersistence();
    await engine.attachPersistence(store, vendorSlug);
    console.log(
      `[caterlog] DATA_MODE=memory — durable state attached (.caterlog-dev-state.json).`
    );
  }

  return { engine, dataMode, vendorSlug, scheduler, jobsConfig, shutdown };
}
