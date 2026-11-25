import { Types } from "mongoose";
import { DictionaryEntry, ProfessionWords, User, VocabWord, type VocabWordDoc } from "@/models";
import { aiServices, type DailyWord, type SentenceCheck } from "@/lib/ai";
import { recordUsage } from "@/lib/ai/metering";
import { hitRateLimit } from "@/lib/auth/service";
import { dayKey } from "@/lib/gamification/rules";
import { typedMatches } from "@/lib/vocabulary-match";
import { notebookKey, saveWord, speakFor } from "@/lib/dictionary";
import { normalizeWord } from "@/lib/dictionary-word";

/*
 * « The Vocabulary I Need » (owner decision 2026-11-23): the notebook and dictionary plus
 *  - my daily vocabulary: 2 words a day for the learner's profession (AI, shared per profession/day);
 *  - my own sentences: a sentence with a saved word, corrected at once by the AI;
 *  - tests on my own words with spaced review (back after 1, 3, 7, 14, then 30 days; wrong = again tomorrow).
 * Framework-free (tests/vocabulary.test.ts).
 */

export class VocabError extends Error {}

export const DAILY_COUNT = 2;
const DAY = 86_400_000;
/** Days until the next test after 0, 1, 2, 3, 4+ successes in a row. */
export const INTERVALS = [1, 3, 7, 14, 30];
/** A word is « known » after this many successes in a row (it keeps coming back every 30 days). */
export const KNOWN_AT = 4;
export const TEST_SIZE = 10;
export { typedMatches };

export const professionKey = (p: string) =>
  p
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 80);

// ── Profession ───────────────────────────────────────────────────────────

export async function setProfession(userId: string, raw: string) {
  const profession = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (profession.length < 2) throw new VocabError("Enter your job or field of study.");
  await User.updateOne({ _id: userId }, { $set: { profession } });
  // Missed days are caught up from the first day, never before.
  await User.updateOne({ _id: userId, $or: [{ dailyWordsFrom: "" }, { dailyWordsFrom: { $exists: false } }] }, { $set: { dailyWordsFrom: dayKey(new Date()) } });
  return profession;
}

// ── My daily vocabulary ──────────────────────────────────────────────────

/** How far back missed days are caught up (today excluded). */
export const CATCH_UP_DAYS = 6;

type Item = DailyWord;
const itemOf = (i: { word?: string | null; translation?: string | null; frNote?: string | null; example?: string | null; examples?: { en?: string | null; fr?: string | null }[] | null }): Item => {
  const examples = (i.examples ?? []).map((e) => ({ en: e.en ?? "", fr: e.fr ?? "" })).filter((e) => e.en);
  return { word: i.word ?? "", translation: i.translation ?? "", frNote: i.frNote ?? "", example: i.example ?? examples[0]?.en ?? "", examples: examples.length ? examples : i.example ? [{ en: i.example, fr: "" }] : [] };
};

/**
 * The words of these days for a profession: kept in `ProfessionWords` (one row per profession and
 * day, shared). Missing days are made in ONE AI call (DAILY_COUNT words per day, none repeated).
 */
async function ensureDays(userId: string, profession: string, days: string[], now: Date): Promise<Map<string, Item[]>> {
  const key = professionKey(profession);
  const out = new Map<string, Item[]>();
  if (!key || !days.length) return out;
  const have = await ProfessionWords.find({ key, day: { $in: days } }).lean();
  for (const d of have) out.set(d.day, d.items.map(itemOf));
  const missing = days.filter((d) => !out.has(d)).sort();
  if (!missing.length) return out;
  const past = await ProfessionWords.find({ key }).sort({ day: -1 }).limit(60).select("items.word").lean();
  const avoid = past.flatMap((d) => d.items.map((i) => i.word ?? "")).filter(Boolean);
  try {
    const r = await aiServices().feedback.dailyVocabulary({ profession, count: DAILY_COUNT * missing.length, avoid });
    await recordUsage(userId, { kind: "llm", feature: "daily_vocabulary", provider: r.usage.provider, tokens: r.usage.inputTokens + r.usage.outputTokens, costMicros: r.usage.costMicros }, now).catch(() => {});
    const seen = new Set(avoid);
    const items = r.words
      .map((w) => ({
        word: normalizeWord(w.word) ?? "",
        translation: w.translation.slice(0, 80),
        frNote: w.frNote.slice(0, 300),
        examples: (w.examples ?? []).slice(0, 2).map((e) => ({ en: e.en.slice(0, 300), fr: e.fr.slice(0, 300) })),
        example: (w.examples?.[0]?.en ?? w.example ?? "").slice(0, 300),
      }))
      .filter((w) => w.word && !seen.has(w.word) && (seen.add(w.word), true));
    for (const [n, day] of missing.entries()) {
      const chunk = items.slice(n * DAILY_COUNT, (n + 1) * DAILY_COUNT);
      if (!chunk.length) break;
      await ProfessionWords.create({ key, profession, day, items: chunk }).catch(() => {}); // a parallel request may have made it
    }
  } catch (e) {
    console.error("[vocabulary] daily words", e);
  }
  for (const d of await ProfessionWords.find({ key, day: { $in: missing } }).lean()) out.set(d.day, d.items.map(itemOf));
  return out;
}

const savedSet = async (userId: string, words: string[]) => new Set((await VocabWord.find({ userId, word: { $in: words } }).select("word").lean()).map((w) => w.word));

/** Today's words for this profession (made once, shared), each marked if already in the notebook. */
export async function dailyWords(userId: string, profession: string, now = new Date()): Promise<(Item & { saved: boolean })[]> {
  const day = dayKey(now);
  const items = (await ensureDays(userId, profession, [day], now)).get(day) ?? [];
  const saved = await savedSet(userId, items.map((i) => i.word));
  return items.map((i) => ({ ...i, saved: saved.has(i.word) }));
}

/**
 * Words of the last CATCH_UP_DAYS days (never before the learner's first day) not yet in their
 * notebook — e.g. after 2 days without connecting. Newest day first.
 */
export async function missedWords(userId: string, profession: string, from: string, now = new Date()): Promise<{ day: string; words: Item[] }[]> {
  const days: string[] = [];
  for (let n = 1; n <= CATCH_UP_DAYS; n++) {
    const d = dayKey(new Date(now.getTime() - n * DAY));
    if (from && d < from) break;
    days.push(d);
  }
  if (!days.length) return [];
  const byDay = await ensureDays(userId, profession, days, now);
  const saved = await savedSet(userId, [...byDay.values()].flat().map((i) => i.word));
  return days.map((day) => ({ day, words: (byDay.get(day) ?? []).filter((i) => !saved.has(i.word)) })).filter((g) => g.words.length);
}

/** « Add to my notebook » on a daily word (today's or a missed day's, for the learner's profession). */
export async function saveDailyWord(userId: string, word: string, now = new Date()) {
  const u = await User.findById(userId).select("profession").lean();
  const days = Array.from({ length: CATCH_UP_DAYS + 1 }, (_, n) => dayKey(new Date(now.getTime() - n * DAY)));
  const docs = await ProfessionWords.find({ key: professionKey(u?.profession ?? ""), day: { $in: days } }).lean();
  const raw = docs.flatMap((d) => d.items).find((i) => i.word === word);
  if (!raw) throw new VocabError("This word isn't in your recent daily words any more.");
  const item = itemOf(raw);
  await saveWord(userId, item.word, { context: item.examples[0]?.en ?? item.example, translation: item.translation, source: "daily" });
}

// ── My own sentences ─────────────────────────────────────────────────────

export async function writeSentence(userId: string, rawWord: string, rawText: string, now = new Date()): Promise<SentenceCheck> {
  const word = normalizeWord(rawWord);
  const text = String(rawText ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  if (!word) throw new VocabError("Word not found.");
  if (text.split(" ").length < 3) throw new VocabError("Write a full sentence (at least 3 words).");
  const vw = await VocabWord.findOne({ userId, word });
  if (!vw) throw new VocabError("Add this word to your notebook first.");
  const rl = await hitRateLimit(`vocab-sentence:${userId}`, 40, 3600_000);
  if (!rl.allowed) throw new VocabError("Many sentences this hour: take a break and come back later!");
  const entry = vw.translation ? null : await DictionaryEntry.findOne({ word }).select("translation").lean();
  let result: SentenceCheck;
  try {
    const r = await aiServices().feedback.checkSentence({ word, translation: vw.translation || entry?.translation || "", sentence: text });
    result = { ok: !!r.result.ok, corrected: r.result.corrected.slice(0, 300), explanation: r.result.explanation.slice(0, 300) };
    await recordUsage(userId, { kind: "llm", feature: "vocab_sentence", provider: r.usage.provider, tokens: r.usage.inputTokens + r.usage.outputTokens, costMicros: r.usage.costMicros }, now).catch(() => {});
  } catch (e) {
    console.error("[vocabulary] sentence", e);
    throw new VocabError("The correction isn't available right now: try again in a moment.");
  }
  vw.sentences.push({ text, ...result, at: now });
  if (vw.sentences.length > 20) vw.sentences.splice(0, vw.sentences.length - 20);
  await vw.save();
  return result;
}

export async function deleteSentence(userId: string, rawWord: string, sentenceId: string) {
  if (!Types.ObjectId.isValid(sentenceId)) return;
  await VocabWord.updateOne({ userId, word: normalizeWord(rawWord) ?? "" }, { $pull: { sentences: { _id: new Types.ObjectId(sentenceId) } } });
}

/** One of the learner's own sentences read aloud (the corrected one when it was wrong) — for shadowing. Their own words only. */
export async function ownSentenceAudio(userId: string, rawWord: string, sentenceId: string, opts: { voice: "us" | "gb"; slow?: boolean }) {
  if (!Types.ObjectId.isValid(sentenceId)) return null;
  const w = await VocabWord.findOne({ userId, word: normalizeWord(rawWord) ?? "" }).select("sentences").lean<VocabWordDoc>();
  const s = (w?.sentences ?? []).find((x) => String((x as { _id?: unknown })._id) === sentenceId);
  const text = s ? (!s.ok && s.corrected ? s.corrected : s.text) : "";
  if (!text.trim()) return null;
  return speakFor(userId, text.trim(), { voice: opts.voice, slow: opts.slow, feature: "own_sentences" });
}

// ── Tests on my own words (spaced review) ────────────────────────────────

/** After an answer: the next stage and when the word comes back. */
export function nextReview(stage: number, correct: boolean, now = new Date()) {
  if (!correct) return { stage: 0, dueAt: new Date(now.getTime() + INTERVALS[0] * DAY), known: false };
  const s = Math.min(stage + 1, INTERVALS.length);
  return { stage: s, dueAt: new Date(now.getTime() + INTERVALS[Math.min(s, INTERVALS.length - 1)] * DAY), known: s >= KNOWN_AT };
}

const dueFilter = (userId: string, now: Date) => ({ userId, $or: [{ dueAt: null }, { dueAt: { $lte: now } }] });

export const dueCount = (userId: string, now = new Date()) => VocabWord.countDocuments(dueFilter(userId, now));

/** When the next word comes back (no word due now). */
export async function nextDue(userId: string, now = new Date()): Promise<Date | null> {
  const w = await VocabWord.findOne({ userId, dueAt: { $gt: now } }).sort({ dueAt: 1 }).select("dueAt").lean();
  return w?.dueAt ?? null;
}

export type TestQuestion =
  | { kind: "type"; word: string; prompt: string; hint: string }
  | { kind: "choose"; word: string; prompt: string; options: string[]; answer: string }
  | { kind: "blank"; word: string; sentence: string; hint: string };

const shuffle = <T,>(xs: T[], seed: number) => xs.map((x, i) => ({ x, k: Math.sin(seed * 997 + i * 131) })).sort((a, b) => a.k - b.k).map((y) => y.x);

/**
 * Today's test: up to TEST_SIZE due words, oldest due first, one question each, varied by the word's
 * stage and what we know about it: French → type the English word; English → choose the French
 * meaning (4 options, needs 4 translated words); fill the blank in the learner's own (correct) sentence.
 */
export async function buildTest(userId: string, now = new Date()): Promise<TestQuestion[]> {
  const due = await VocabWord.find(dueFilter(userId, now)).sort({ dueAt: 1, createdAt: 1 }).limit(TEST_SIZE).lean<VocabWordDoc[]>();
  if (!due.length) return [];
  const all = await VocabWord.find({ userId }).select("word translation").limit(300).lean();
  const entries = await DictionaryEntry.find({ word: { $in: all.map((w) => w.word) } }).select("word translation").lean();
  const fr = (w: { word: string; translation?: string | null }) => w.translation || entries.find((e) => e.word === w.word)?.translation || "";
  const pool = [...new Set(all.map(fr).filter(Boolean))];
  return due.map((w, i): TestQuestion => {
    const meaning = fr(w);
    const re = new RegExp(`\\b${w.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    const own = [...(w.sentences ?? [])].reverse().find((s) => s.ok && re.test(s.corrected || s.text));
    const kinds = [own ? "blank" : null, meaning ? "type" : null, meaning && pool.length >= 4 ? "choose" : null].filter(Boolean) as string[];
    const kind = kinds.length ? kinds[((w.stage ?? 0) + i) % kinds.length] : "type";
    if (kind === "blank" && own) {
      const s = own.corrected || own.text;
      return { kind: "blank", word: w.word, sentence: s.replace(re, "_____"), hint: meaning };
    }
    if (kind === "choose") {
      const wrong = shuffle(pool.filter((p) => p !== meaning), i + w.word.length).slice(0, 3);
      return { kind: "choose", word: w.display || w.word, prompt: w.display || w.word, options: shuffle([meaning, ...wrong], i + 7), answer: meaning };
    }
    const shown = w.display || w.word;
    return { kind: "type", word: shown, prompt: meaning || w.context || shown, hint: w.kind === "phrase" ? shown.replace(/[A-Za-z]+/g, (x) => x[0] + "_".repeat(x.length - 1)) : `${w.word[0]}${"_".repeat(Math.max(0, w.word.length - 1))}` };
  });
}

/** Records a test: each word moves on (or starts over); returns the score. The browser sends the answers, the server checks them. */
export async function recordTest(userId: string, answers: { word: string; kind: string; answer: string }[], now = new Date()) {
  const words = await VocabWord.find({ userId, word: { $in: answers.map((a) => notebookKey(a.word)) } });
  const entries = await DictionaryEntry.find({ word: { $in: words.map((w) => w.word) } }).select("word translation").lean();
  const results: { word: string; correct: boolean; expected: string }[] = [];
  for (const a of answers.slice(0, TEST_SIZE)) {
    const w = words.find((x) => x.word === notebookKey(a.word));
    if (!w) continue;
    const meaning = w.translation || entries.find((e) => e.word === w.word)?.translation || "";
    // A French meaning (choose) or the English word (type / blank).
    const correct = a.kind === "choose" ? !!meaning && a.answer.trim() === meaning : typedMatches(w.word, a.answer);
    const next = nextReview(w.stage ?? 0, correct, now);
    w.stage = next.stage;
    w.dueAt = next.dueAt;
    w.known = next.known;
    w.reviews = (w.reviews ?? 0) + 1;
    w.lastReviewedAt = now;
    await w.save();
    results.push({ word: w.word, correct, expected: w.word });
  }
  const right = results.filter((r) => r.correct).length;
  return { results, right, total: results.length, score: results.length ? Math.round((right / results.length) * 100) : 0 };
}

export async function vocabularyStats(userId: string, now = new Date()) {
  const [words, due, known, sentences] = await Promise.all([
    VocabWord.countDocuments({ userId }),
    dueCount(userId, now),
    VocabWord.countDocuments({ userId, known: true }),
    VocabWord.aggregate<{ n: number }>([{ $match: { userId: new Types.ObjectId(userId) } }, { $project: { n: { $size: { $ifNull: ["$sentences", []] } } } }, { $group: { _id: null, n: { $sum: "$n" } } }]),
  ]);
  return { words, due, known, sentences: sentences[0]?.n ?? 0 };
}


/**
 * A daily word's example sentence read aloud (`i` = 0 or 1). Only the examples the AI wrote for a
 * profession can be voiced (no arbitrary text). Shared cache: one generation for everyone.
 */
export async function dailyExampleAudio(userId: string, rawWord: string, i: number, opts: { voice: "us" | "gb"; slow?: boolean }) {
  const word = String(rawWord ?? "").trim().toLowerCase().slice(0, 60);
  if (!word || !Number.isInteger(i) || i < 0 || i > 3) return null;
  const doc = await ProfessionWords.findOne({ "items.word": { $regex: `^${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } }).sort({ day: -1 }).lean();
  const item = (doc?.items ?? []).find((x) => String(x.word ?? "").toLowerCase() === word);
  const examples = item?.examples?.length ? item.examples.map((e) => e.en ?? "") : item?.example ? [item.example] : [];
  const text = examples[i];
  if (!text) return null;
  return speakFor(userId, text, { voice: opts.voice, slow: opts.slow, feature: "daily_vocabulary" });
}
