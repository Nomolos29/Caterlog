import { Queue, Worker, type ConnectionOptions, type Job } from "bullmq";
import type {
  BackgroundJob,
  BackgroundJobHandler,
  BackgroundJobScheduler,
  BackgroundJobStatus,
  ScheduleOptions,
} from "./types.ts";

export interface BullMqSchedulerOptions {
  redisUrl: string;
  queueName?: string;
  prefix?: string;
}

/**
 * Durable scheduler backed by BullMQ + Redis.
 *
 * Delayed order jobs and repeatable sweep jobs survive API restarts. The job
 * handler is still executed by this API process, so multi-instance deployments
 * should keep the engine's working set in sync until the domain layer moves
 * fully into PostgreSQL.
 */
export class BullMqJobScheduler implements BackgroundJobScheduler {
  public readonly mode = "bullmq" as const;
  private readonly connection: ConnectionOptions;
  private readonly queueName: string;
  private readonly prefix?: string;
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private handler: BackgroundJobHandler | null = null;
  private running = false;

  constructor(options: BullMqSchedulerOptions) {
    this.connection = redisConnectionFromUrl(options.redisUrl);
    this.queueName = options.queueName ?? "caterlog-jobs";
    this.prefix = options.prefix;
  }

  public async start(handler: BackgroundJobHandler): Promise<void> {
    this.handler = handler;
    this.queue = new Queue(this.queueName, {
      connection: this.connection,
      prefix: this.prefix,
    });
    this.worker = new Worker(
      this.queueName,
      async (job) => this.process(job),
      {
        connection: this.connection,
        prefix: this.prefix,
        concurrency: 1,
      }
    );
    this.worker.on("failed", (job, err) => {
      console.error(
        `[caterlog:jobs] BullMQ job "${job?.name ?? "unknown"}" (${job?.id ?? "?"}) failed:`,
        err
      );
    });
    this.worker.on("error", (err) => {
      console.error("[caterlog:jobs] BullMQ worker error:", err);
    });
    await this.worker.waitUntilReady();
    this.running = true;
  }

  public async schedule(
    job: BackgroundJob,
    options: ScheduleOptions
  ): Promise<void> {
    const queue = this.requireQueue();
    await queue.add(job.name, job.payload, {
      jobId: options.jobId,
      delay: Math.max(0, options.delayMs),
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: 1_000,
      removeOnFail: 5_000,
    });
  }

  public async scheduleRepeat(
    schedulerId: string,
    job: BackgroundJob,
    everyMs: number
  ): Promise<void> {
    const queue = this.requireQueue();
    await queue.upsertJobScheduler(
      schedulerId,
      { every: Math.max(1, everyMs) },
      { name: job.name, data: job.payload }
    );
  }

  public async cancel(jobId: string): Promise<void> {
    const queue = this.requireQueue();
    const job = await queue.getJob(jobId);
    if (job) {
      try {
        await job.remove();
      } catch (err) {
        // Active jobs cannot be removed; the handler is idempotent instead.
        console.warn(`[caterlog:jobs] Could not cancel job ${jobId}:`, err);
      }
    }
  }

  public async stop(): Promise<void> {
    this.running = false;
    await this.worker?.close();
    await this.queue?.close();
    this.worker = null;
    this.queue = null;
    this.handler = null;
  }

  public getStatus(): BackgroundJobStatus {
    return {
      mode: "bullmq",
      running: this.running,
      queue: this.queueName,
      pending: null,
    };
  }

  private async process(job: Job): Promise<void> {
    if (!this.handler) {
      throw new Error("BullMQ job scheduler has no handler.");
    }
    await this.handler(toBackgroundJob(job.name, job.data));
  }

  private requireQueue(): Queue {
    if (!this.queue || !this.running) {
      throw new Error("BullMQ job scheduler has not been started.");
    }
    return this.queue;
  }
}

export function redisConnectionFromUrl(redisUrl: string): ConnectionOptions {
  let parsed: URL;
  try {
    parsed = new URL(redisUrl);
  } catch {
    throw new Error(`Invalid REDIS_URL: "${redisUrl}"`);
  }
  if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") {
    throw new Error(
      `Unsupported REDIS_URL protocol "${parsed.protocol}". Use redis:// or rediss://.`
    );
  }

  const dbRaw = parsed.pathname.replace(/^\//, "");
  const db = dbRaw === "" ? 0 : Number(dbRaw);
  if (!Number.isInteger(db) || db < 0) {
    throw new Error(`Invalid Redis database in REDIS_URL: "${dbRaw}"`);
  }

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db,
    ...(parsed.protocol === "rediss:" ? { tls: {} } : {}),
    // BullMQ Workers require blocking connections to disable the request timeout.
    maxRetriesPerRequest: null,
  };
}

function toBackgroundJob(name: string, data: unknown): BackgroundJob {
  const record =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  switch (name) {
    case "order-expiry":
      return {
        name,
        payload: { orderShortCode: String(record.orderShortCode ?? "") },
      };
    case "payment-reminder":
      return {
        name,
        payload: { orderShortCode: String(record.orderShortCode ?? "") },
      };
    case "order-expiry-sweep":
      return { name, payload: {} };
    default:
      throw new Error(`Unknown background job "${name}".`);
  }
}
