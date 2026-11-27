declare module "pg" {
  export interface PoolConfig {
    connectionString?: string;
    max?: number;
    connectionTimeoutMillis?: number;
    idleTimeoutMillis?: number;
    ssl?: boolean | Record<string, unknown>;
  }

  export interface QueryResult<R = any> {
    rows: R[];
    rowCount: number | null;
  }

  export class Pool {
    constructor(config?: PoolConfig);
    query<R = any>(text: string, values?: unknown[]): Promise<QueryResult<R>>;
    connect(): Promise<any>;
    end(): Promise<void>;
    on(event: string, listener: (...args: any[]) => void): this;
  }
}

declare module "@neon/functions" {
  export function attachDatabasePool(pool: unknown): void;
  export function waitUntil(promise: Promise<unknown>): void;
}
