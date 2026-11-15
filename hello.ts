import { Pool } from "pg";
import { attachDatabasePool } from "@neon/functions";

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL.replace(
        "sslmode=require",
        "sslmode=verify-full"
      ),
      max: 5,
    })
  : null;

if (pool) {
  attachDatabasePool(pool);
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const wantsJson =
      url.pathname === "/status" ||
      url.searchParams.get("format") === "json" ||
      request.headers.get("accept")?.includes("application/json");

    if (!wantsJson) {
      return new Response("Hello from Neon Functions", {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    let dbSummary: Record<string, unknown> = { connected: false };
    if (pool) {
      try {
        const { rows } = await pool.query<{
          db: string;
          vendor_count: number;
          product_count: number;
          order_count: number;
        }>(`
          SELECT
            current_database() AS db,
            (SELECT count(*)::int FROM "Vendor") AS vendor_count,
            (SELECT count(*)::int FROM "Product") AS product_count,
            (SELECT count(*)::int FROM "Order") AS order_count
        `);
        dbSummary = {
          connected: true,
          ...rows[0],
        };
      } catch (err) {
        dbSummary = {
          connected: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    return Response.json({
      ok: true,
      message: "Hello from Neon Functions",
      branch: process.env.NEON_BRANCH ?? "production",
      branchId: process.env.NEON_BRANCH_ID ?? null,
      postgres: dbSummary,
    });
  },
};
