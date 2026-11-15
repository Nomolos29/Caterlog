import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createNeonAuth } from "@neon/auth/next/server";

// Ensure root .env is loaded when running inside apps/dashboard workspace
if (!process.env.NEON_AUTH_BASE_URL) {
  const rootEnv = resolve(process.cwd(), "../../.env");
  if (existsSync(rootEnv) && typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile(rootEnv);
    } catch {
      // ignore if already loaded
    }
  }
}

export const auth = createNeonAuth({
  baseUrl:
    process.env.NEON_AUTH_BASE_URL ||
    "https://ep-little-shadow-be1fbuks.neonauth.c-9.us-east-2.aws.neon.tech/neondb/auth",
  cookies: {
    secret:
      process.env.NEON_AUTH_COOKIE_SECRET ||
      "caterlog_neon_auth_cookie_secret_key_2026_prod_base64_valid",
  },
});
