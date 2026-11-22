/*
 * Word helpers for the dictionary (pure, shared by the browser — the « tap a word » chip — and the
 * server — src/lib/dictionary.ts).
 */

/** « Bookings, » → « bookings »; null when it isn't one word (letters, ' and - only, 1–40 chars). */
export function normalizeWord(raw: string): string | null {
  const w = raw.trim().toLowerCase().replace(/[’‘`]/g, "'").replace(/^[^a-z]+|[^a-z]+$/g, "");
  return /^[a-z][a-z'-]{0,39}$/.test(w) ? w : null;
}

/** A simple lemma to retry with: « bookings » → « booking », « delayed » → « delay », « boxes » → « box ». */
export function lemmaOf(w: string): string | null {
  const rules: [RegExp, string][] = [
    [/ies$/, "y"],
    [/(ss|sh|ch|x|z)es$/, "$1"],
    [/([^s])s$/, "$1"],
    [/ied$/, "y"],
    [/([a-z]{2})ed$/, "$1"],
    [/([a-z]{2})ing$/, "$1"],
  ];
  for (const [re, to] of rules) if (re.test(w)) return w.replace(re, to);
  return null;
}
