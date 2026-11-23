import { normalizeEnglish } from "@/lib/ai/text";

/** Typed answers in vocabulary tests (pure, browser + server): case, punctuation and one typo (on words of 5+ letters) are forgiven. */
export function typedMatches(word: string, answer: string): boolean {
  const a = normalizeEnglish(answer);
  const b = normalizeEnglish(word);
  if (a === b) return true;
  if (b.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  // One edit (Levenshtein ≤ 1).
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}
