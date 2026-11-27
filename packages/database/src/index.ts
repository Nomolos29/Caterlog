/// <reference path="./externals.d.ts" />
import dns from "node:dns";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { attachDatabasePool } from "@neon/functions";

dns.setDefaultResultOrder("ipv4first");

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

function buildPrismaDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  const separator = raw.includes("?") ? "&" : "?";
  const extras: string[] = [];
  if (!raw.includes("connect_timeout=")) extras.push("connect_timeout=30");
  if (!raw.includes("pool_timeout=")) extras.push("pool_timeout=30");
  return extras.length > 0 ? `${raw}${separator}${extras.join("&")}` : raw;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: buildPrismaDatabaseUrl()
      ? { db: { url: buildPrismaDatabaseUrl() } }
      : undefined,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

export function getNeonPgPool(): Pool {
  if (!globalForPrisma.pgPool) {
    const rawUrl = process.env.DATABASE_URL ?? "";
    const connectionString = rawUrl.replace("sslmode=require", "sslmode=verify-full");
    const pool = new Pool({
      connectionString,
      max: 5,
      connectionTimeoutMillis: 30000,
    });
    attachDatabasePool(pool);
    globalForPrisma.pgPool = pool;
  }
  return globalForPrisma.pgPool;
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "@prisma/client";
export * from "@caterlog/shared";


