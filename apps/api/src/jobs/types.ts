export type BackgroundJob =
  | { name: "order-expiry"; payload: { orderShortCode: string } }
  | { name: "payment-reminder"; payload: { orderShortCode: string; minutesRemaining?: number } }
  | { name: "payment-reminder-2min"; payload: { orderShortCode: string } }
  | { name: "order-expiry-sweep"; payload: Record<string, never> };

export type BackgroundJobName = BackgroundJob["name"];

export type BackgroundJobHandler = (job: BackgroundJob) => Promise<void>;

export interface ScheduleOptions {
  /** Unique id so duplicate schedules are ignored (or replaced). */
  jobId: string;
  /** Delay from now before the job runs. */
  delayMs: number;
}

export interface BackgroundJobStatus {
  mode: "off" | "inline" | "bullmq";
  running: boolean;
  queue: string | null;
  pending: number | null;
}

/**
 * Small scheduler contract shared by the in-process development scheduler and
 * the durable BullMQ/Redis implementation.
 */
export interface BackgroundJobScheduler {
  readonly mode: "inline" | "bullmq";
  start(handler: BackgroundJobHandler): Promise<void>;
  schedule(job: BackgroundJob, options: ScheduleOptions): Promise<void>;
  scheduleRepeat(
    schedulerId: string,
    job: BackgroundJob,
    everyMs: number
  ): Promise<void>;
  cancel(jobId: string): Promise<void>;
  stop(): Promise<void>;
  getStatus(): BackgroundJobStatus;
}
