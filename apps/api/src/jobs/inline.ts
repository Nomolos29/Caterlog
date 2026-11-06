import type {
  BackgroundJob,
  BackgroundJobHandler,
  BackgroundJobScheduler,
  BackgroundJobStatus,
  ScheduleOptions,
} from "./types.ts";

/**
 * Development scheduler backed by Node timers.
 *
 * Jobs are lost on restart and only run inside the API process. It keeps
 * `DATA_MODE=memory` and local demos dependency-free; use `JOBS_MODE=redis`
 * for durable jobs.
 */
export class InlineJobScheduler implements BackgroundJobScheduler {
  public readonly mode = "inline" as const;
  private handler: BackgroundJobHandler | null = null;
  private running = false;
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly repeats = new Map<string, NodeJS.Timeout>();

  public async start(handler: BackgroundJobHandler): Promise<void> {
    this.handler = handler;
    this.running = true;
  }

  public async schedule(job: BackgroundJob, options: ScheduleOptions): Promise<void> {
    if (!this.running || !this.handler) {
      throw new Error("Inline job scheduler has not been started.");
    }
    await this.cancel(options.jobId);

    const timer = setTimeout(() => {
      this.timers.delete(options.jobId);
      void this.run(job);
    }, Math.max(0, options.delayMs));
    timer.unref();
    this.timers.set(options.jobId, timer);
  }

  public async scheduleRepeat(
    schedulerId: string,
    job: BackgroundJob,
    everyMs: number
  ): Promise<void> {
    if (!this.running || !this.handler) {
      throw new Error("Inline job scheduler has not been started.");
    }
    await this.cancel(schedulerId);

    const timer = setInterval(() => {
      void this.run(job);
    }, Math.max(1, everyMs));
    timer.unref();
    this.repeats.set(schedulerId, timer);
  }

  public async cancel(jobId: string): Promise<void> {
    const timer = this.timers.get(jobId) ?? this.repeats.get(jobId);
    if (timer) {
      clearTimeout(timer);
      clearInterval(timer);
      this.timers.delete(jobId);
      this.repeats.delete(jobId);
    }
  }

  public async stop(): Promise<void> {
    for (const timer of this.timers.values()) clearTimeout(timer);
    for (const timer of this.repeats.values()) clearInterval(timer);
    this.timers.clear();
    this.repeats.clear();
    this.handler = null;
    this.running = false;
  }

  public getStatus(): BackgroundJobStatus {
    return {
      mode: "inline",
      running: this.running,
      queue: null,
      pending: this.timers.size,
    };
  }

  private async run(job: BackgroundJob): Promise<void> {
    try {
      await this.handler?.(job);
    } catch (err) {
      console.error(`[caterlog:jobs] Inline job "${job.name}" failed:`, err);
    }
  }
}
