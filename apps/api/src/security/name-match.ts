/**
 * Account-holder name matching for payout identity locks.
 *
 * Nigerian bank and BVN names differ in word order ("OBI CHUKWUDI EMMANUEL" vs
 * "CHUKWUDI E. OBI"), use initials, carry honorifics, and contain occasional
 * one-letter typos. The rule is deliberately strict about *foreign* names: every
 * word in the candidate account name must belong to the verified identity, and
 * at least two full words must match. A mule account ("TUNDE BAKARE") can never
 * pass against "CHUKWUDI EMMANUEL OBI".
 */

const HONORIFICS = new Set([
  "MR", "MRS", "MS", "MISS", "DR", "PROF", "ENGR", "ARC", "BARR", "CHIEF", "ALHAJI",
  "ALHAJA", "ALH", "HAJIA", "PASTOR", "REV", "SIR", "LADY", "PRINCE", "PRINCESS",
  "HRH", "OTUNBA", "BLESSED", "MALAM", "MALLAM",
]);

export interface NameMatchResult {
  matched: boolean;
  /** 0–1: fraction of candidate tokens accounted for by the anchor name. */
  score: number;
  fullTokenMatches: number;
  unmatchedTokens: string[];
}

export function normalizeNameTokens(name: string): string[] {
  return name
    .toUpperCase()
    .replace(/[^A-Z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0 && !HONORIFICS.has(t));
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/**
 * Checks whether `candidate` (resolved bank account name) belongs to the person
 * identified by `anchor` (BVN-verified legal name).
 */
export function matchAccountName(anchor: string, candidate: string): NameMatchResult {
  const anchorTokens = normalizeNameTokens(anchor);
  const candidateTokens = normalizeNameTokens(candidate);
  const available = [...anchorTokens];
  let fullTokenMatches = 0;
  const unmatchedTokens: string[] = [];
  const initials: string[] = [];

  // Pass 1: full words (exact, then one-typo tolerance for long words).
  for (const token of candidateTokens) {
    if (token.length === 1) {
      initials.push(token);
      continue;
    }
    let idx = available.indexOf(token);
    if (idx < 0 && token.length >= 5) {
      idx = available.findIndex((a) => a.length >= 5 && levenshtein(a, token) <= 1);
    }
    if (idx >= 0) {
      available.splice(idx, 1);
      fullTokenMatches += 1;
    } else {
      unmatchedTokens.push(token);
    }
  }

  // Pass 2: initials must correspond to a remaining anchor word.
  for (const initial of initials) {
    const idx = available.findIndex((a) => a.startsWith(initial));
    if (idx >= 0) {
      available.splice(idx, 1);
    } else {
      unmatchedTokens.push(initial);
    }
  }

  const total = Math.max(1, candidateTokens.length);
  const score = (total - unmatchedTokens.length) / total;
  const requiredFull = Math.min(2, anchorTokens.length);
  return {
    matched: candidateTokens.length > 0 && unmatchedTokens.length === 0 && fullTokenMatches >= requiredFull,
    score: Number(score.toFixed(2)),
    fullTokenMatches,
    unmatchedTokens,
  };
}
