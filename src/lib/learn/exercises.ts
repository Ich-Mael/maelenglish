/**
 * Interactive practice exercises — shared types and grading (runs in the
 * browser for instant feedback and on the server to record the score).
 *
 * kinds:
 *  - choice  multiple choice: `text` (question), `options`, `correctOptionId`
 *  - build   tap words to build `text` (target sentence); `distractors` = extra words
 *  - order   drag `items` (given in the correct order) back into order
 *  - match   pair each `pairs[].left` with its `right`
 *  - listen  dictation: hear `text` (speech synthesis or `audioUrl`), type it; `answers` = other accepted spellings
 *  - speak   say `text` aloud (recorded; checked by speech recognition when the browser has it, else self-assessed)
 *  - gap     `text` contains `___`; type the missing word(s); `answers` = accepted answers
 */

export const EXERCISE_KINDS = ["choice", "build", "order", "match", "listen", "speak", "gap"] as const;
export type ExerciseKind = (typeof EXERCISE_KINDS)[number];

export type Exercise = {
  id: string;
  kind: ExerciseKind;
  /** Instruction shown above the exercise (French); a default per kind is used when empty. */
  prompt?: string;
  text?: string;
  translation?: string;
  options?: { id: string; text: string }[];
  correctOptionId?: string;
  distractors?: string[];
  items?: string[];
  pairs?: { left: string; right: string }[];
  answers?: string[];
  audioUrl?: string;
  explanation?: string;
};

export const DEFAULT_PROMPTS: Record<ExerciseKind, string> = {
  choice: "Choisissez la bonne réponse",
  build: "Construisez la phrase",
  order: "Remettez dans l'ordre",
  match: "Associez les paires",
  listen: "Écrivez ce que vous entendez",
  speak: "Dites la phrase à voix haute",
  gap: "Complétez la phrase",
};

export type ExerciseResponse =
  | { kind: "choice"; optionId: string }
  | { kind: "build"; words: string[] }
  | { kind: "order"; items: string[] }
  | { kind: "match"; pairs: { left: string; right: string }[] }
  | { kind: "listen"; text: string }
  | { kind: "speak"; transcript?: string; selfCheck?: boolean }
  | { kind: "gap"; text: string };

/** Lowercase, strip accents, punctuation and extra spaces; unify apostrophes. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Word tokens of a sentence, keeping their original spelling (punctuation dropped). */
export function words(s: string): string[] {
  return s
    .replace(/[“”"«»]/g, "")
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, ""))
    .filter(Boolean);
}

/**
 * Similarity 0–1, tolerant to speech-recognition noise: the best of a
 * word-level score (LCS over words) and a letter-level score ignoring spaces
 * (« seat belt » vs « seatbelt »).
 */
export function similarity(a: string, b: string): number {
  const x = normalize(a).split(" ").filter(Boolean);
  const y = normalize(b).split(" ").filter(Boolean);
  if (!x.length || !y.length) return 0;
  const dp: number[][] = Array.from({ length: x.length + 1 }, () => new Array(y.length + 1).fill(0));
  for (let i = 1; i <= x.length; i++)
    for (let j = 1; j <= y.length; j++)
      dp[i][j] = x[i - 1] === y[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  const wordScore = (2 * dp[x.length][y.length]) / (x.length + y.length);

  const p = x.join(""), q = y.join("");
  let prev = Array.from({ length: q.length + 1 }, (_, j) => j);
  for (let i = 1; i <= p.length; i++) {
    const cur = [i];
    for (let j = 1; j <= q.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (p[i - 1] === q[j - 1] ? 0 : 1));
    prev = cur;
  }
  const letterScore = 1 - prev[q.length] / Math.max(p.length, q.length);
  return Math.max(wordScore, letterScore);
}

export const SPEAK_THRESHOLD = 0.7;

export function expectedAnswer(ex: Exercise): string {
  switch (ex.kind) {
    case "choice":
      return ex.options?.find((o) => o.id === ex.correctOptionId)?.text ?? "";
    case "order":
      return (ex.items ?? []).join(" → ");
    case "match":
      return (ex.pairs ?? []).map((p) => `${p.left} = ${p.right}`).join(" · ");
    case "gap":
      return (ex.answers ?? [])[0] ?? "";
    default:
      return ex.text ?? "";
  }
}

export function checkExercise(ex: Exercise, r: ExerciseResponse | null | undefined): boolean {
  if (!r || r.kind !== ex.kind) return false;
  switch (r.kind) {
    case "choice":
      return r.optionId === ex.correctOptionId;
    case "build":
      return normalize(r.words.join(" ")) === normalize(ex.text ?? "");
    case "order": {
      const target = ex.items ?? [];
      return r.items.length === target.length && r.items.every((it, i) => it === target[i]);
    }
    case "match": {
      const target = ex.pairs ?? [];
      return (
        r.pairs.length === target.length &&
        target.every((p) => r.pairs.some((q) => q.left === p.left && q.right === p.right))
      );
    }
    case "listen": {
      const accepted = [ex.text ?? "", ...(ex.answers ?? [])].map(normalize);
      return accepted.includes(normalize(r.text));
    }
    case "gap":
      return (ex.answers ?? []).map(normalize).includes(normalize(r.text));
    case "speak":
      if (r.transcript) return similarity(r.transcript, ex.text ?? "") >= SPEAK_THRESHOLD;
      return r.selfCheck === true;
  }
}

/** Deterministic shuffle (seeded by a string) — same order on server and client, no hydration mismatch. */
export function seededShuffle<T>(arr: readonly T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  // Never present an "already solved" order when there's a choice.
  if (out.length > 1 && out.every((v, i) => v === arr[i])) out.push(out.shift()!);
  return out;
}

/** Word bank of a build exercise: target words + distractors, shuffled. */
export function wordBank(ex: Exercise): string[] {
  return seededShuffle([...words(ex.text ?? ""), ...(ex.distractors ?? [])], ex.id);
}

/** Problem with an exercise definition (French), or null — used by the model validator. */
export function exerciseProblem(ex: Partial<Exercise>): string | null {
  const need = (cond: boolean, msg: string) => (cond ? null : msg);
  switch (ex.kind) {
    case "choice":
      return (
        need((ex.options?.length ?? 0) >= 2, "Un QCM doit proposer au moins 2 réponses.") ??
        need(!!ex.options?.some((o) => o.id === ex.correctOptionId), "La bonne réponse doit faire partie des réponses proposées.")
      );
    case "build":
      return need(words(ex.text ?? "").length >= 2, "La phrase à construire doit contenir au moins 2 mots.");
    case "order":
      return need((ex.items?.length ?? 0) >= 2 && new Set(ex.items).size === ex.items!.length, "Il faut au moins 2 éléments distincts à remettre dans l'ordre.");
    case "match":
      return need(
        (ex.pairs?.length ?? 0) >= 2 && new Set(ex.pairs!.map((p) => p.left)).size === ex.pairs!.length && new Set(ex.pairs!.map((p) => p.right)).size === ex.pairs!.length,
        "Il faut au moins 2 paires, sans doublon.",
      );
    case "listen":
    case "speak":
      return need(!!ex.text?.trim(), "Indiquez la phrase en anglais.");
    case "gap":
      return need(!!ex.text?.includes("___") && (ex.answers?.length ?? 0) > 0, "La phrase doit contenir ___ et au moins une réponse acceptée.");
    default:
      return "Type d'exercice inconnu.";
  }
}
