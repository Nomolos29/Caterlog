/**
 * Pure shared value utilities: Kobo / Naira conversion and formatting.
 * Rule: All monetary values in Caterlog are stored and computed in integer Kobo (BigInt).
 * ₦1.00 = 100 Kobo.
 *
 * Supports Nigerian chat currency notations:
 * - "6000", "6,000"
 * - "#6000", "#6,000" (Nigerian keyboard shorthand for ₦)
 * - "₦6000", "N6000", "NGN6000"
 * - "6k", "#6k", "N6.5k", "₦25k" (thousand shorthand)
 */

export const KOBO_PER_NAIRA = 100n;

/**
 * Checks whether a token looks like a valid Nigerian price token (e.g. "#6000", "₦3,500", "N5000", "6k", "3500").
 */
export function isNigerianPriceToken(raw: string): boolean {
  const trimmed = raw.trim();
  return /^(?:₦|#|NGN|N)?\s*\d[\d,]*(?:\.\d+)?k?$/i.test(trimmed);
}

/**
 * Converts a whole, decimal, or Nigerian shorthand Naira amount into integer Kobo (BigInt).
 * Examples:
 * - 25000 -> 2500000n
 * - "#6000" -> 600000n
 * - "N3,500" -> 350000n
 * - "#6k" or "6.5k" -> 600000n / 650000n
 */
export function nairaToKobo(nairaAmount: number | string): bigint {
  let cleaned = String(nairaAmount)
    .trim()
    .replace(/^(?:NGN|₦|#|N)\s*/i, "")
    .replace(/[,_\s]/g, "")
    .trim();

  let multiplier = 1;
  if (/k$/i.test(cleaned)) {
    multiplier = 1000;
    cleaned = cleaned.slice(0, -1);
  }

  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0 || cleaned === "") {
    throw new Error(`Invalid Naira amount: "${nairaAmount}"`);
  }
  return BigInt(Math.round(parsed * multiplier * 100));
}

/**
 * Converts integer Kobo (BigInt) into a standard Naira number for display or JSON serialization.
 */
export function koboToNaira(koboAmount: bigint | number): number {
  return Number(koboAmount) / 100;
}

/**
 * Formats integer Kobo (BigInt) as a human-readable Nigerian Naira string (e.g., "₦25,000").
 */
export function formatNaira(koboAmount: bigint | number, includeDecimals = false): string {
  const naira = koboToNaira(koboAmount);
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0,
  }).format(naira);
}
