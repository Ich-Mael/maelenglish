import { normalizeEnglish } from "@/lib/ai/text";

/*
 * « Répétez après Mael » scoring (pure, shared by browser and server): what the browser's speech
 * recognition heard is compared word by word with the phrase (case, punctuation and contractions
 * ignored, words in order — longest common subsequence). It checks that the words were
 * understood, not the accent (precise pronunciation scoring = a paid service, later).
 */

/** A phrase counts as said right from this share of its words. */
export const REPEAT_PASS = 70;

/** Self-assessment answers, used where the browser has no speech recognition. */
export const SELF_OK = "self:ok";
export const SELF_REDO = "self:redo";

/** Which words of `target` were heard (in order), and the share of them (0–100). */
export function phraseAccuracy(target: string, heard: string): { words: { word: string; heard: boolean }[]; percent: number } {
  // Display words keep their spelling; matching uses the normalised form (I'm = I am → split).
  const display = target.trim().split(/\s+/).filter(Boolean);
  const norm = display.map((w) => normalizeEnglish(w));
  const got = normalizeEnglish(heard).split(" ").filter(Boolean);
  // Flatten normalised display words (a contraction may give 2 words) with their display index.
  const flat: { w: string; at: number }[] = norm.flatMap((n, at) => n.split(" ").filter(Boolean).map((w) => ({ w, at })));
  if (!flat.length) return { words: display.map((word) => ({ word, heard: false })), percent: 0 };
  // LCS table between the phrase words and what was heard.
  const m = flat.length;
  const n = got.length;
  const L: number[][] = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) L[i][j] = flat[i].w === got[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const hit = Array<boolean>(m).fill(false);
  for (let i = 0, j = 0; i < m && j < n; ) {
    if (flat[i].w === got[j]) {
      hit[i] = true;
      i++;
      j++;
    } else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  // A display word counts as heard when all its parts were.
  const words = display.map((word, at) => ({ word, heard: flat.some((f) => f.at === at) && flat.every((f, i) => f.at !== at || hit[i]) }));
  return { words, percent: Math.round((hit.filter(Boolean).length / m) * 100) };
}

/** Is a learner's answer for a phrase a success? (a transcript at REPEAT_PASS % or more, or self-assessed « ok »). */
export function repeatPassed(target: string, answer: unknown): boolean {
  if (answer === SELF_OK) return true;
  if (typeof answer !== "string" || answer === SELF_REDO) return false;
  return phraseAccuracy(target, answer).percent >= REPEAT_PASS;
}
