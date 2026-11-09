import { isNigerianPriceToken, nairaToKobo } from "../domain/money.ts";
import type { DomainCopilotMode } from "../domain/copilot-policy.ts";

export interface ParsedProductVariant {
  name: string;
  stockTotal: number;
  priceKobo?: bigint;
  skuSuffix?: string;
}

export type VendorWhatsAppCommand =
  | { type: "OPEN_DASHBOARD" }
  | { type: "HELP_MENU" }
  | { type: "SALES_SUMMARY"; range: "today" | "week" | "month" }
  | { type: "LIST_PRODUCTS" }
  | { type: "LIST_SHIPPING" }
  | { type: "UPSERT_SHIPPING"; name: string; feeKobo: bigint }
  | { type: "DELETE_SHIPPING"; code: number }
  | { type: "LIST_DISCOUNTS" }
  | {
      type: "CREATE_DISCOUNT";
      code: string;
      discountType: "PERCENTAGE" | "FLAT_KOBO";
      /** Basis points if PERCENTAGE (1000 = 10%), Kobo if FLAT_KOBO */
      value: bigint;
    }
  | { type: "DEACTIVATE_DISCOUNT"; code: string }
  | { type: "UPDATE_STOCK"; skuCode: string; stockTotal: number }
  | { type: "DELETE_PRODUCT"; skuCode: string }
  | {
      type: "QUICK_ADD_PRODUCT";
      name: string;
      priceKobo: bigint;
      stockTotal: number;
      variants?: ParsedProductVariant[];
    }
  | { type: "LIST_ORDERS"; status: "PENDING_PAYMENT" | "PAID" }
  | { type: "REMIND_ORDER"; shortCode: string }
  | { type: "DISPATCH_ORDER"; shortCode: string; riderPhone?: string }
  | { type: "SET_COPILOT_MODE"; mode: DomainCopilotMode; idleSeconds?: number }
  | { type: "SET_RESERVATION_TTL"; minutes: number }
  | { type: "UNKNOWN_COMMAND"; rawInput: string };

function normalizeOrderShortCode(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/^#/, "");
  return cleaned.startsWith("ORD-") ? cleaned : `ORD-${cleaned}`;
}

const SHIPPING_ALIASES = new Set([
  "shipping",
  "ship",
  "shiping",
  "shp",
  "delivery",
  "deliver",
  "deliv",
]);

const DISCOUNT_ALIASES = new Set([
  "discount",
  "disc",
  "discont",
  "discounts",
  "promo",
  "coupon",
]);

const STOCK_ALIASES = new Set([
  "stock",
  "stck",
  "stk",
  "inventory",
  "inv",
  "qty",
]);

const SALES_ALIASES = new Set([
  "sales",
  "sale",
  "revenue",
  "balance",
  "earnings",
  "report",
]);

/**
 * Parses a text message or image caption sent by a Vendor in WhatsApp
 * into a strongly-typed, channel-agnostic command object.
 *
 * Forgivingly handles:
 * - Nigerian currency shorthands: `#6000`, `₦6,000`, `N6000`, `NGN6000`, `6k`, `#6k`
 * - Keyword shorthands & typos: `ship Ibadan #6000`, `shiping Lekki 3500`, `delivery add Mainland N2500`
 * - Optional verbs (`add`, `set`, `create` can be omitted)
 */
export function parseVendorWhatsAppCommand(rawText: string): VendorWhatsAppCommand {
  const trimmed = rawText.trim();
  const lower = trimmed.toLowerCase();
  const tokens = trimmed.split(/\s+/);
  const firstWord = (tokens[0] ?? "").toLowerCase();

  // 1. Dashboard Magic Link
  if (firstWord === "dashboard" || firstWord === "dash" || firstWord === "login" || firstWord === "web") {
    return { type: "OPEN_DASHBOARD" };
  }

  // 2. Help / Menu
  if (firstWord === "help" || firstWord === "menu" || firstWord === "commands") {
    return { type: "HELP_MENU" };
  }

  // 2b. List Catalog / Products (`products`, `catalog`, `items`, `stock` with no args)
  if (
    firstWord === "products" ||
    firstWord === "product" ||
    firstWord === "catalog" ||
    firstWord === "catalogue" ||
    firstWord === "items" ||
    (STOCK_ALIASES.has(firstWord) && tokens.length === 1)
  ) {
    return { type: "LIST_PRODUCTS" };
  }

  // 3. Sales / Transactional Breakdown (`sales`, `sales today`, `sales week`, `sales month`)
  if (SALES_ALIASES.has(firstWord)) {
    const second = (tokens[1] ?? "today").toLowerCase();
    if (second === "week" || second === "weekly" || second === "7d") {
      return { type: "SALES_SUMMARY", range: "week" };
    }
    if (second === "month" || second === "monthly" || second === "30d") {
      return { type: "SALES_SUMMARY", range: "month" };
    }
    return { type: "SALES_SUMMARY", range: "today" };
  }

  // 4. Shipping Zones (`shipping`, `ship Ibadan #6000`, `shipping add Lekki 3500`, `shipping delete 2`)
  if (SHIPPING_ALIASES.has(firstWord)) {
    if (tokens.length === 1) {
      return { type: "LIST_SHIPPING" };
    }
    const subAction = (tokens[1] ?? "").toLowerCase();
    if (subAction === "delete" || subAction === "remove" || subAction === "del") {
      const code = Number.parseInt((tokens[2] ?? "").replace(/^#/, ""), 10);
      if (Number.isInteger(code) && code > 0) {
        return { type: "DELETE_SHIPPING", code };
      }
    }

    const startIdx = subAction === "add" || subAction === "set" || subAction === "to" ? 2 : 1;
    const priceToken = tokens[tokens.length - 1] ?? "";
    const nameTokens = tokens.slice(startIdx, tokens.length - 1);

    if (nameTokens.length > 0 && isNigerianPriceToken(priceToken)) {
      return {
        type: "UPSERT_SHIPPING",
        name: nameTokens.join(" ").replace(/[-:]+$/, "").trim(),
        feeKobo: nairaToKobo(priceToken),
      };
    }
  }

  // 5. Discounts (`discount`, `discount add PAYDAY 10%`, `disc VIP #5000`, `discount end PAYDAY`)
  if (DISCOUNT_ALIASES.has(firstWord)) {
    if (tokens.length === 1) {
      return { type: "LIST_DISCOUNTS" };
    }
    const subAction = (tokens[1] ?? "").toLowerCase();
    if (
      (subAction === "end" ||
        subAction === "stop" ||
        subAction === "delete" ||
        subAction === "remove" ||
        subAction === "off") &&
      tokens[2]
    ) {
      return {
        type: "DEACTIVATE_DISCOUNT",
        code: tokens[2].toUpperCase(),
      };
    }

    const hasVerb = subAction === "add" || subAction === "create" || subAction === "set";
    const codeToken = (hasVerb ? tokens[2] : tokens[1]) ?? "";
    const valToken = (hasVerb ? tokens[3] : tokens[2]) ?? "";
    if (codeToken && valToken) {
      const code = codeToken.toUpperCase();
      if (valToken.endsWith("%")) {
        const pct = Number.parseFloat(valToken.slice(0, -1));
        if (Number.isFinite(pct) && pct > 0 && pct <= 100) {
          return {
            type: "CREATE_DISCOUNT",
            code,
            discountType: "PERCENTAGE",
            value: BigInt(Math.round(pct * 100)), // basis points
          };
        }
      } else if (isNigerianPriceToken(valToken)) {
        return {
          type: "CREATE_DISCOUNT",
          code,
          discountType: "FLAT_KOBO",
          value: nairaToKobo(valToken),
        };
      }
    }
  }

  // 6. Stock Update (`stock SHOE-01 10`, `stk shoe-01 10`)
  if (STOCK_ALIASES.has(firstWord)) {
    const startIdx = (tokens[1] ?? "").toLowerCase() === "set" ? 2 : 1;
    const skuCode = (tokens[startIdx] ?? "").toUpperCase();
    const qty = Number.parseInt(tokens[startIdx + 1] ?? "", 10);
    if (skuCode && Number.isInteger(qty) && qty >= 0) {
      return { type: "UPDATE_STOCK", skuCode, stockTotal: qty };
    }
  }

  // 6b. Delete / Remove Product (`delete SHOE-01`, `remove SHOE-01`, `del SHOE-01`, `product delete SHOE-01`)
  if (
    (firstWord === "delete" || firstWord === "del" || firstWord === "remove" || firstWord === "rm") &&
    tokens[1] &&
    !SHIPPING_ALIASES.has((tokens[1] ?? "").toLowerCase()) &&
    !DISCOUNT_ALIASES.has((tokens[1] ?? "").toLowerCase())
  ) {
    return { type: "DELETE_PRODUCT", skuCode: tokens[1].toUpperCase() };
  }
  if (
    (firstWord === "product" || firstWord === "prod") &&
    (tokens[1]?.toLowerCase() === "delete" || tokens[1]?.toLowerCase() === "del" || tokens[1]?.toLowerCase() === "remove") &&
    tokens[2]
  ) {
    return { type: "DELETE_PRODUCT", skuCode: tokens[2].toUpperCase() };
  }

  // 7. Pending & Paid Orders (`pending`, `paid`, `remind 882`, `dispatch ORD-882 0803...`)
  if (firstWord === "pending" || firstWord === "pendin" || lower === "pending orders") {
    return { type: "LIST_ORDERS", status: "PENDING_PAYMENT" };
  }
  if (firstWord === "paid" || lower === "paid orders") {
    return { type: "LIST_ORDERS", status: "PAID" };
  }
  if ((firstWord === "remind" || firstWord === "nudge") && tokens[1]) {
    return {
      type: "REMIND_ORDER",
      shortCode: normalizeOrderShortCode(tokens[1]),
    };
  }
  if ((firstWord === "dispatch" || firstWord === "shipped" || firstWord === "sent") && tokens[1]) {
    return {
      type: "DISPATCH_ORDER",
      shortCode: normalizeOrderShortCode(tokens[1]),
      riderPhone: tokens[2],
    };
  }

  // 8. Co-Pilot Mode & Idle Timer (`mode copilot`, `mode copilot 90s`, `mode auto`, `mode off`)
  if (firstWord === "mode" || firstWord === "copilot" || firstWord === "copolit") {
    const modeArg = (firstWord.startsWith("cop") ? tokens[1] ?? "copilot" : tokens[1] ?? "").toLowerCase();
    const timerArg = firstWord.startsWith("cop") ? tokens[1] : tokens[2];

    if (modeArg === "auto" || modeArg === "full" || modeArg === "full_auto") {
      return { type: "SET_COPILOT_MODE", mode: "FULL_AUTO" };
    }
    if (modeArg === "off" || modeArg === "manual" || modeArg === "pause") {
      return { type: "SET_COPILOT_MODE", mode: "MANUAL" };
    }
    if (modeArg === "copilot" || modeArg === "on" || /^\d+s?$/.test(modeArg)) {
      const rawSeconds = /^\d+s?$/.test(modeArg) ? modeArg : timerArg;
      const parsedSec = rawSeconds ? Number.parseInt(rawSeconds.replace(/s(ecs?)?$/i, ""), 10) : undefined;
      return {
        type: "SET_COPILOT_MODE",
        mode: "COPILOT",
        idleSeconds: parsedSec && parsedSec >= 5 ? parsedSec : undefined,
      };
    }
  }

  // 9. Stock Reservation Hold Timer (`hold 20` or `hold 20m` or `timer 15`)
  if ((firstWord === "hold" || firstWord === "timer" || firstWord === "ttl") && tokens[1]) {
    const mins = Number.parseInt(tokens[1].replace(/m(ins?)?$/i, ""), 10);
    if (Number.isInteger(mins) && mins >= 5 && mins <= 180) {
      return { type: "SET_RESERVATION_TTL", minutes: mins };
    }
  }

  // 10. Quick Product Caption Format (Simple or Variable Products)
  // Examples:
  // - "Zara Heel, #25000, stock 5"
  // - "Zara Heel, 25k, 5"
  // - "Zara Heel, #25000, sizes: 38 (2), 39 (3), 40 (5)"
  // - "Zara Heel, #25000, Red: 5, Blue: 3, Black: 2"
  // - "Zara Heel, 25k, 38: 2, 39: 3"
  // - "Zara Heel, #25000, sizes: 38, 39, 40"
  // - "Flask, #10000, variants: 750ml #8000 (5), 1000ml #12000 (3)"
  // - Optional verb prefixes: "add product ...", "new product ...", "prod add ..."
  let textToParse = trimmed;
  const prefixMatch =
    textToParse.match(/^(?:add|new|create)\s+product\s+/i) ||
    textToParse.match(/^(?:product|prod)\s+(?:add|new|create)\s+/i);
  if (prefixMatch) {
    textToParse = textToParse.slice(prefixMatch[0].length).trim();
  }

  // 10a. Multi-line caption format
  if (textToParse.includes("\n")) {
    const lines = textToParse.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length >= 2) {
      let name = lines[0] ?? "";
      let priceStr = "";
      let variantStartIdx = 1;

      if (name.includes(",")) {
        const sub = name.split(",").map((s) => s.trim());
        name = sub[0] ?? "";
        priceStr = sub[1] ?? "";
      } else {
        const line1 = lines[1] ?? "";
        if (isNigerianPriceToken(line1)) {
          priceStr = line1;
          variantStartIdx = 2;
        } else {
          const pMatch = line1.match(/(?:price\s*[:=]?\s*)?((?:#|₦|NGN|N)\s*[\d,]+|\b\d+k\b)/i);
          if (pMatch && isNigerianPriceToken(pMatch[1])) {
            priceStr = pMatch[1];
            variantStartIdx = 2;
          }
        }
      }

      // Check if lines[1..N] are variants where each variation has its own price (e.g. "38: #20000 (5)")
      const varLinesOnly = parseProductVariants(lines.slice(1));
      if (varLinesOnly.length > 0 && varLinesOnly.some((v) => v.priceKobo !== undefined)) {
        const stockTotal = varLinesOnly.reduce((sum, v) => sum + v.stockTotal, 0);
        const basePriceKobo = varLinesOnly.find((v) => v.priceKobo !== undefined)?.priceKobo ?? 0n;
        return {
          type: "QUICK_ADD_PRODUCT",
          name,
          priceKobo: basePriceKobo,
          stockTotal,
          variants: varLinesOnly,
        };
      }

      if (name && priceStr && isNigerianPriceToken(priceStr)) {
        const priceKobo = nairaToKobo(priceStr);
        const candidateLines = lines.slice(variantStartIdx);
        const variants = parseProductVariants(candidateLines, priceKobo);
        if (variants.length > 0) {
          const stockTotal = variants.reduce((sum, v) => sum + v.stockTotal, 0);
          return {
            type: "QUICK_ADD_PRODUCT",
            name,
            priceKobo,
            stockTotal,
            variants,
          };
        }
      }
    }
  }

  // 10b. Comma-separated caption format
  if (textToParse.includes(",")) {
    const parts = textToParse.split(",").map((p) => p.trim());
    if (parts.length >= 2) {
      const name = parts[0] ?? "";
      const priceStr = parts[1] ?? "";

      // Case 1: First part after name is an explicit base price (e.g. "Zara Heel, #25000, ...")
      if (name && isNigerianPriceToken(priceStr)) {
        const priceKobo = nairaToKobo(priceStr);
        const remainderParts = parts.slice(2);

        if (remainderParts.length === 0) {
          return {
            type: "QUICK_ADD_PRODUCT",
            name,
            priceKobo,
            stockTotal: 1,
          };
        }

        const singleToken = remainderParts[0] ?? "";
        const isSimpleStock =
          remainderParts.length === 1 &&
          /^(?:stock|qty|total|count)?\s*\d+\s*(?:units?|pcs?|pieces?|items?)?$/i.test(singleToken) &&
          !/(?:variations?|variants?|sizes?|colors?|options?|:|\(|@)/i.test(singleToken);

        if (isSimpleStock) {
          const stockMatch = singleToken.match(/(\d+)/);
          const stockTotal = stockMatch ? Number.parseInt(stockMatch[1] ?? "1", 10) : 1;
          return {
            type: "QUICK_ADD_PRODUCT",
            name,
            priceKobo,
            stockTotal,
          };
        }

        const variants = parseProductVariants(remainderParts, priceKobo);
        if (variants.length > 0) {
          const stockTotal = variants.reduce((sum, v) => sum + v.stockTotal, 0);
          return {
            type: "QUICK_ADD_PRODUCT",
            name,
            priceKobo,
            stockTotal,
            variants,
          };
        }

        const stockMatch = (singleToken || "stock 1").match(/(\d+)/);
        const stockTotal = stockMatch ? Number.parseInt(stockMatch[1] ?? "1", 10) : 1;
        return {
          type: "QUICK_ADD_PRODUCT",
          name,
          priceKobo,
          stockTotal,
        };
      }

      // Case 2: No overall base price provided — each variation has its own price!
      // (e.g. "Zara Heel, 38: #20000 (5), 39: #25000 (3)" or "Zara Heel, sizes: 38 @ 20k (5), 39 @ 25k (3)")
      if (name) {
        const candidateVariants = parseProductVariants(parts.slice(1));
        if (candidateVariants.length > 0) {
          const stockTotal = candidateVariants.reduce((sum, v) => sum + v.stockTotal, 0);
          const basePriceKobo =
            candidateVariants.find((v) => v.priceKobo !== undefined)?.priceKobo ?? 0n;
          return {
            type: "QUICK_ADD_PRODUCT",
            name,
            priceKobo: basePriceKobo,
            stockTotal,
            variants: candidateVariants,
          };
        }
      }
    }
  }

  return { type: "UNKNOWN_COMMAND", rawInput: trimmed };
}

/**
 * Parses individual variant tokens with optional custom variation pricing:
 * - "sizes: 38 (2), 39 (3), 40 (5)"
 * - "38: #20000 (5), 39: #25000 (3)"
 * - "38 (#20000, 5), 39 (#25000, 3)"
 * - "38 @ 20k (5), 39 @ 25k (3)"
 * - "500ml #8000 (10), 750ml #10000 (15)"
 * - "Red: 5, Blue: 3, Black: 2"
 */
export function parseProductVariants(
  candidateStrings: string[],
  defaultPriceKobo?: bigint
): ParsedProductVariant[] {
  const variants: ParsedProductVariant[] = [];

  for (const raw of candidateStrings) {
    if (!raw.trim()) continue;
    const clean = raw.replace(/^(?:variations?|variants?|sizes?|colors?|options?|flavors?)\s*[:=-]?\s*/i, "").trim();
    if (!clean) continue;

    const subTokens = clean.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
    for (let token of subTokens) {
      token = token.replace(/^[•\-\*]\s*/, "").trim();
      if (!token) continue;

      // 1. Extract variant-specific price if present (e.g. "#20000", "20000", "@ 20k", "at #25,000", "₦18500", "N10000")
      let variantPriceKobo: bigint | undefined = undefined;
      const priceRegex = /(?:@|at\s+|[:\-]\s*)?((?:#|₦|NGN|N)\s*[\d,]+|\b\d+k\b|(?<=[:@\s\-])\d{4,7}\b)/i;
      const priceMatch = token.match(priceRegex);
      if (priceMatch && isNigerianPriceToken(priceMatch[1])) {
        variantPriceKobo = nairaToKobo(priceMatch[1]);
        token = token.replace(priceMatch[0], " ").trim();
      }

      // 2. Extract stock count
      let stock = 1;
      const parensMatch = token.match(/\(\s*(?:stock|qty|units?|pcs?)?[:\s,]*(\d+)\s*(?:units?|pcs?|items?)?\s*\)/i);
      const multiMatch = token.match(/[x×*]\s*(\d+)\b/i);
      const keywordMatch = token.match(/\b(?:stock|qty|total|count)\s*[:=]?\s*(\d+)\b/i) || token.match(/\b(\d+)\s*(?:units?|pcs?|items?|pieces?)\b/i);
      const colonDashMatch = token.match(/[:=\-]\s*(\d+)\s*$/);
      const trailingNumMatch = token.match(/\s+(\d+)$/);

      if (parensMatch) {
        stock = Number.parseInt(parensMatch[1], 10);
        token = token.replace(parensMatch[0], " ").trim();
      } else if (multiMatch) {
        stock = Number.parseInt(multiMatch[1], 10);
        token = token.replace(multiMatch[0], " ").trim();
      } else if (keywordMatch) {
        stock = Number.parseInt(keywordMatch[1], 10);
        token = token.replace(keywordMatch[0], " ").trim();
      } else if (colonDashMatch) {
        stock = Number.parseInt(colonDashMatch[1], 10);
        token = token.slice(0, colonDashMatch.index).trim();
      } else if (trailingNumMatch && !/^\d+$/.test(token.trim())) {
        stock = Number.parseInt(trailingNumMatch[1], 10);
        token = token.slice(0, trailingNumMatch.index).trim();
      }

      const name = token.replace(/^[:=,\-@/() ]+|[:=,\-@/() ]+$/g, "").replace(/\s+/g, " ").trim();
      if (name) {
        const skuSuffix = name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
        variants.push({
          name,
          stockTotal: Number.isInteger(stock) && stock >= 0 ? stock : 1,
          priceKobo: variantPriceKobo ?? defaultPriceKobo,
          skuSuffix: skuSuffix || undefined,
        });
      }
    }
  }

  return variants;
}
