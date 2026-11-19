import crypto from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(crypto.scrypt) as (
  password: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  keylen: number,
  options: crypto.ScryptOptions
) => Promise<Buffer>;

/** scrypt cost parameters (N=2^15, r=8, p=1 ≈ 32 MiB, ~50–100ms per hash). */
const SCRYPT_N = 1 << 15;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 32;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

/**
 * Hashes a low-entropy secret (transaction PIN) with a per-hash random salt.
 * Format: `scrypt$N$r$p$saltB64$hashB64`.
 */
export async function hashSecret(secret: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scryptAsync(secret, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });
  return ["scrypt", SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString("base64"), hash.toString("base64")].join("$");
}

/** Constant-time verification of a secret against a `hashSecret` output. */
export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nRaw, rRaw, pRaw, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scryptAsync(secret, Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(nRaw),
    r: Number(rRaw),
    p: Number(pRaw),
    maxmem: SCRYPT_MAXMEM,
  });
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/** Keyed hash for short-lived or identity values (OTP codes, BVN, date of birth). */
export function hmac(secret: string, value: string): string {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

/** SHA-256 of a high-entropy bearer token (sessions, magic links, lock links). */
export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** Constant-time comparison of two hex/utf8 strings. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** Cryptographically secure 6-digit numeric code (uniform, no modulo bias). */
export function randomNumericCode(digits = 6): string {
  return crypto.randomInt(0, 10 ** digits).toString().padStart(digits, "0");
}

/** URL-safe random bearer token (256 bits). */
export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

/**
 * Rejects transaction PINs that are trivially guessable.
 * Returns a human-readable reason, or null when the PIN is acceptable.
 */
export function weakPinReason(pin: string, phone?: string): string | null {
  if (!/^\d{6}$/.test(pin)) return "Your transaction PIN must be exactly 6 digits.";
  if (/^(\d)\1{5}$/.test(pin)) return "Avoid repeated digits like 111111.";
  const digits = pin.split("").map(Number);
  const ascending = digits.every((d, i) => i === 0 || d === (digits[i - 1] + 1) % 10);
  const descending = digits.every((d, i) => i === 0 || d === (digits[i - 1] + 9) % 10);
  if (ascending || descending) return "Avoid sequences like 123456 or 654321.";
  if (/^(\d\d)\1\1$/.test(pin) || /^(\d{3})\1$/.test(pin)) return "Avoid repeating patterns like 121212.";
  const phoneDigits = phone?.replace(/\D/g, "") ?? "";
  if (phoneDigits.length >= 6 && phoneDigits.endsWith(pin)) {
    return "Do not use the last digits of your phone number.";
  }
  return null;
}
