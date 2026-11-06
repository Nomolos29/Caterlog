#!/usr/bin/env node
/**
 * Runs a command with the repository's `.env` loaded into the child process.
 *
 * Prisma CLI resolves `.env` from the workspace where it runs, but this repo
 * keeps a single root `.env`. This wrapper keeps `npm run db:*` consistent with
 * the API, which also loads the root `.env`.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const envFile = process.env.ENV_FILE ?? ".env";
if (existsSync(envFile)) {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envFile);
  } else {
    const { config } = await import("dotenv");
    config({ path: envFile });
  }
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("Usage: node scripts/with-env.mjs <command> [...args]");
  process.exit(1);
}

const child = spawn(command, args, {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

child.on("error", (err) => {
  console.error(`Failed to run "${command}":`, err);
  process.exit(1);
});
child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
