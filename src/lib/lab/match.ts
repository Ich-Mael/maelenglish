import { normalizeEnglish } from "@/lib/ai/text";

/*
 * Typed answers (catalogue: « text input with fuzzy answer matching »): capitals, punctuation and
 * contractions are ignored (I'm = I am), any listed alternative is accepted, and — when allowed
 * (A2–B1) — one typo (one letter added, missing, wrong or two letters swapped) per answer.
 * Shared by browser and server.
 */

/** Optimal string alignment distance (Damerau–Levenshtein restricted), stops early above `max`. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

export type MatchResult = { ok: boolean; exact: boolean; matched: string | null };

/**
 * Does `input` match one of the `accepted` answers? `typo`: tolerate one typo (answers of 4+
 * letters only, so « in » ≠ « on »). `exact` = matched without needing the tolerance.
 */
export function matchAnswer(input: string, accepted: readonly string[], opts: { typo?: boolean } = {}): MatchResult {
  const got = normalizeEnglish(input);
  if (!got) return { ok: false, exact: false, matched: null };
  for (const a of accepted) if (normalizeEnglish(a) === got) return { ok: true, exact: true, matched: a };
  if (opts.typo) {
    for (const a of accepted) {
      const want = normalizeEnglish(a);
      if (want.replace(/ /g, "").length >= 4 && editDistance(got, want, 1) <= 1) return { ok: true, exact: false, matched: a };
    }
  }
  return { ok: false, exact: false, matched: null };
}

/** Typo tolerance by level (catalogue: tolerate 1 typo at A2–B1). */
export const typoAllowed = (level: string | null | undefined) => level === "A2" || level === "B1" || !level;
