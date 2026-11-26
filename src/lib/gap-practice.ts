import { Types } from "mongoose";
import { CoachingVocab, GapPractice, User, VocabWord, type GapPracticeDoc, type VocabWordDoc } from "@/models";
import { aiServices } from "@/lib/ai";
import { recordUsage } from "@/lib/ai/metering";
import { hitRateLimit } from "@/lib/auth/service";
import { dayKey } from "@/lib/gamification/rules";
import { notebookKey } from "@/lib/dictionary";
import { gradeActivity } from "@/lib/lab/grade";
import { starsFor } from "@/lib/lab/meta";
import type { GapsContent } from "@/lib/lab/types";
import { plainText } from "@/lib/rich-text";
import { CoachingError, openCoaching, type Viewer } from "@/lib/coaching/service";
import { nextReview } from "@/lib/vocabulary";

/*
 * Fill the gaps with my expressions (owner decision 2026-11-26). The AI (Claude Haiku) writes a
 * text with the learner's expressions in [brackets]: « sentences » = one unrelated sentence at work
 * per expression, « story » = a short story of a working day using them all. Every blank is checked
 * here (`cleanPractice`: it must be one of the expressions, possibly inflected) before learners see
 * it. Played with the Lab fill-the-gaps player; graded on the server like `fill_gaps`.
 *  - The Vocabulary I Need: the learner's notebook words (due for review first, then the newest),
 *    one practice per learner, day and mode (« New practice » makes another, 8 a day).
 *  - A coaching: the last 7 days' daily expressions, shared by the group (one per coaching + day + mode).
 * Results feed the spaced review: a wrong blank brings the word back tomorrow, a right one moves it
 * on when it was due. Framework-free (tests/gap-practice.test.ts).
 */

export class GapPracticeError extends Error {}
export type GapMode = "sentences" | "story";
export const isGapMode = (m: unknown): m is GapMode => m === "sentences" || m === "story";
export const PRACTICE_ITEMS = 6;
export const MIN_ITEMS = 3;
export const NEW_PER_DAY = 8;
const DAY = 86_400_000;

// ── Checking the AI's text (pure) ────────────────────────────────────────

const PLACEHOLDERS = new Set(["someone", "somebody", "something", "sb", "sth", "one's", "oneself"]);
const wordsOf = (s: string) => s.toLowerCase().replace(/[’‘]/g, "'").match(/[a-z']+/g) ?? [];

/** Is this bracketed answer the expression (as given, or inflected: tense, plural, -s; placeholders replaced)? */
export function answerMatches(answer: string, expression: string): boolean {
  const a = wordsOf(answer);
  const all = wordsOf(expression);
  const w = all.filter((x) => !PLACEHOLDERS.has(x));
  if (!w.length || !a.length || a.length > all.length + 3) return false;
  return w.every((x) => {
    const stem = x.length > 3 ? x.replace(/(ie|e|y)$/, "") : x;
    return a.some((y) => y === x || (x.length > 3 && y.startsWith(stem) && y.length - x.length <= 4));
  });
}

type Item = { key: string; text: string; translation: string };

/**
 * Keeps only blanks that are one of the expressions (each used once; others lose their brackets),
 * removes characters the gap parser reads (« | », a leading « @ »), and in « sentences » mode keeps
 * one blank per sentence and drops sentences without one.
 */
export function cleanPractice(raw: { title: string; lines: { en: string; fr: string }[] }, items: Item[], mode: GapMode) {
  const used = new Set<string>();
  const gapItems: string[] = [];
  const lines: { en: string; fr: string }[] = [];
  for (const l of raw.lines.slice(0, 12)) {
    let blanks = 0;
    const en = String(l.en ?? "")
      .replace(/[\r\n\u0001\u0002]+/g, " ")
      .replace(/\|/g, "/")
      .replace(/^\s*@/, "")
      .trim()
      .slice(0, 900)
      .replace(/\[([^\[\]]*)\]/g, (_, inner: string) => {
        const text = inner.replace(/\s+/g, " ").trim();
        const item = mode === "sentences" && blanks ? null : items.find((i) => !used.has(i.key) && answerMatches(text, i.text));
        if (!item || !text) return text;
        used.add(item.key);
        gapItems.push(item.key);
        blanks++;
        return `\u0001${text}\u0002`; // kept blank (stray brackets are removed below)
      })
      .replace(/[\[\]\u0001\u0002]/g, (c) => (c === "\u0001" ? "[" : c === "\u0002" ? "]" : ""));
    if (!en || (mode === "sentences" && !blanks)) continue;
    lines.push({ en, fr: String(l.fr ?? "").replace(/\s+/g, " ").trim().slice(0, 900) });
  }
  return { title: String(raw.title ?? "").trim().slice(0, 120), lines, gapItems };
}

/** The practice as the Lab fill-the-gaps content (answers included: checked in the browser, re-graded here). */
export function practiceContent(p: Pick<GapPracticeDoc, "lines" | "explanations">, opts: { wordBank?: boolean } = {}): GapsContent {
  const bank = opts.wordBank ?? true;
  return { text: p.lines.map((l) => l.en ?? "").join("\n"), explanations: [...(p.explanations ?? [])], hint: bank ? "letters" : "first", wordBank: bank, distractors: [], typos: true };
}

// ── Making a practice ────────────────────────────────────────────────────

async function write(userId: string, mode: GapMode, items: Item[], context: string) {
  const ai = aiServices().feedback;
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await ai.gapPractice({ mode, items: items.map(({ text, translation }) => ({ text, translation })), context });
    await recordUsage(userId, { kind: "llm", feature: "gap_practice", provider: r.usage.provider, tokens: r.usage.inputTokens + r.usage.outputTokens, costMicros: r.usage.costMicros }).catch(() => {});
    const clean = cleanPractice(r.text, items, mode);
    if (clean.gapItems.length >= Math.min(MIN_ITEMS, items.length)) {
      const explanations = clean.gapItems.map((k) => {
        const i = items.find((x) => x.key === k)!;
        return i.translation ? `« ${i.text} » : ${i.translation}` : "";
      });
      return { ...clean, explanations };
    }
  }
  throw new GapPracticeError("The practice couldn't be written right now: try again in a moment.");
}

export type PublicPractice = {
  id: string;
  mode: GapMode;
  title: string;
  lines: { en: string; fr: string }[];
  explanations: string[];
  words: { text: string; translation: string }[];
  /** The viewer's attempts on it (best and count). */
  best: number | null;
  tries: number;
};

export function publicPractice(p: GapPracticeDoc, viewerId: string): PublicPractice {
  const mine = (p.attempts ?? []).filter((a) => String(a.userId) === viewerId);
  return {
    id: String(p._id),
    mode: p.mode as GapMode,
    title: p.title ?? "",
    lines: p.lines.map((l) => ({ en: l.en ?? "", fr: l.fr ?? "" })),
    explanations: [...(p.explanations ?? [])],
    words: p.items.filter((i) => p.gapItems.includes(i.key ?? "")).map((i) => ({ text: i.text ?? "", translation: i.translation ?? "" })),
    best: mine.length ? Math.max(...mine.map((a) => a.score ?? 0)) : null,
    tries: mine.length,
  };
}

/** The learner's words for a practice: due for review first (oldest first), then the newest saved. */
export async function pickWords(userId: string, now = new Date()): Promise<Item[]> {
  const due = await VocabWord.find({ userId, $or: [{ dueAt: null }, { dueAt: { $lte: now } }] }).sort({ dueAt: 1, createdAt: 1 }).limit(PRACTICE_ITEMS).lean<VocabWordDoc[]>();
  const more = due.length < PRACTICE_ITEMS ? await VocabWord.find({ userId, _id: { $nin: due.map((w) => w._id) } }).sort({ createdAt: -1 }).limit(PRACTICE_ITEMS - due.length).lean<VocabWordDoc[]>() : [];
  return [...due, ...more].map((w) => ({ key: w.word, text: w.display || w.word, translation: w.translation ?? "" }));
}

/** The Vocabulary I Need: today's practice in this mode (made now if none; `fresh` = a new one). */
export async function vocabPractice(userId: string, mode: GapMode, opts: { fresh?: boolean } = {}, now = new Date()): Promise<GapPracticeDoc | { notEnough: number }> {
  const day = dayKey(now);
  if (!opts.fresh) {
    const last = await GapPractice.findOne({ userId, day, mode }).sort({ createdAt: -1 }).lean<GapPracticeDoc>();
    if (last) return last;
  }
  const items = await pickWords(userId, now);
  if (items.length < MIN_ITEMS) return { notEnough: items.length };
  const rl = await hitRateLimit(`gap-practice:${userId}`, NEW_PER_DAY, DAY);
  if (!rl.allowed) throw new GapPracticeError("That's a lot of practice today! New texts come back tomorrow: redo this one meanwhile.");
  const u = await User.findById(userId).select("profession").lean();
  const made = await write(userId, mode, items, u?.profession ?? "");
  return (await GapPractice.create({ userId, day, mode, items, ...made })).toObject() as GapPracticeDoc;
}

/** A coaching: today's practice on the last 7 days' expressions, shared by the group. */
export async function coachingPractice(v: Viewer, coachingId: string, mode: GapMode, now = new Date()): Promise<GapPracticeDoc | { notEnough: number }> {
  const { coaching } = await openCoaching(v, coachingId);
  const day = dayKey(now);
  const existing = await GapPractice.findOne({ coachingId: coaching._id, day, mode }).lean<GapPracticeDoc>();
  if (existing) return existing;
  const days = Array.from({ length: 7 }, (_, i) => dayKey(new Date(now.getTime() - i * DAY)));
  const vocab = await CoachingVocab.find({ coachingId: coaching._id, day: { $in: days } }).sort({ day: -1 }).lean();
  const seen = new Set<string>();
  const items: Item[] = [];
  for (const d of vocab)
    for (const i of d.items) {
      const key = notebookKey(i.text);
      if (items.length < PRACTICE_ITEMS && key && !seen.has(key)) {
        seen.add(key);
        items.push({ key, text: i.text, translation: i.translation ?? "" });
      }
    }
  if (items.length < MIN_ITEMS) return { notEnough: items.length };
  const rl = await hitRateLimit(`gap-practice-coaching:${String(coaching._id)}`, 6, DAY);
  if (!rl.allowed) throw new GapPracticeError("Try again in a moment.");
  const made = await write(v.id, mode, items, `${coaching.title}. ${plainText(coaching.goal ?? "").slice(0, 600)}`);
  try {
    return (await GapPractice.create({ coachingId: coaching._id, day, mode, items, ...made })).toObject() as GapPracticeDoc;
  } catch {
    // Two members at the same moment: the unique index keeps the first.
    const first = await GapPractice.findOne({ coachingId: coaching._id, day, mode }).lean<GapPracticeDoc>();
    if (!first) throw new GapPracticeError("Try again in a moment.");
    return first;
  }
}

// ── Sending the answers ──────────────────────────────────────────────────

/**
 * Grades the answers (first check) on the server and feeds the spaced review of the viewer's
 * notebook words. `saved` = false for a coach trying the group's practice (nothing kept).
 */
export async function submitPractice(v: Viewer, practiceId: string, answers: Record<string, unknown>, now = new Date()) {
  if (!Types.ObjectId.isValid(practiceId)) throw new GapPracticeError("Practice not found.");
  const p = await GapPractice.findById(practiceId).lean<GapPracticeDoc>();
  if (!p) throw new GapPracticeError("Practice not found.");
  let saved = true;
  if (p.coachingId) {
    try {
      saved = (await openCoaching(v, String(p.coachingId))).role === "member";
    } catch (e) {
      if (e instanceof CoachingError) throw new GapPracticeError("Practice not found.");
      throw e;
    }
  } else if (String(p.userId) !== v.id) throw new GapPracticeError("Practice not found.");

  const clean = Object.fromEntries(Object.entries(answers ?? {}).map(([k, a]) => [k, String(a ?? "").slice(0, 120)]));
  const graded = gradeActivity("fill_gaps", practiceContent(p), clean);
  const right = graded.items.filter((i) => i.correct).length;
  if (saved) {
    const keys = graded.items.map((i) => p.gapItems[Number(i.id.slice(1)) - 1]).filter(Boolean);
    const words = await VocabWord.find({ userId: v.id, word: { $in: keys } });
    for (const it of graded.items) {
      const w = words.find((x) => x.word === p.gapItems[Number(it.id.slice(1)) - 1]);
      if (!w) continue;
      const due = !w.dueAt || w.dueAt <= now;
      if (it.correct && !due) continue; // practising early doesn't move a word on
      const next = nextReview(w.stage ?? 0, it.correct, now);
      w.stage = next.stage;
      w.dueAt = next.dueAt;
      w.known = next.known;
      w.reviews = (w.reviews ?? 0) + 1;
      w.lastReviewedAt = now;
      await w.save();
    }
    await GapPractice.updateOne({ _id: p._id }, { $push: { attempts: { $each: [{ userId: new Types.ObjectId(v.id), score: graded.score, right, total: graded.items.length, at: now }], $slice: -200 } } });
  }
  return { score: graded.score, stars: starsFor(graded.score), items: graded.items, right, total: graded.items.length, saved };
}

/** The coach's view of a coaching practice: each member's best score and tries. */
export function attemptsByMember(p: GapPracticeDoc) {
  const out = new Map<string, { best: number; tries: number }>();
  for (const a of p.attempts ?? []) {
    const id = String(a.userId);
    const cur = out.get(id) ?? { best: 0, tries: 0 };
    out.set(id, { best: Math.max(cur.best, a.score ?? 0), tries: cur.tries + 1 });
  }
  return out;
}
