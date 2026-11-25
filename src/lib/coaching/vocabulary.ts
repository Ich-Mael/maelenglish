import { Types } from "mongoose";
import { Coaching, CoachingGoal, CoachingSentence, CoachingVocab, User, VocabWord, type CoachingDoc, type CoachingSentenceDoc, type CoachingVocabDoc } from "@/models";
import { aiServices } from "@/lib/ai";
import { recordUsage } from "@/lib/ai/metering";
import { notebookKey, speakFor } from "@/lib/dictionary";
import { hitRateLimit } from "@/lib/auth/service";
import { dayKey } from "@/lib/gamification/rules";
import { plainText } from "@/lib/rich-text";
import { CoachingError, openCoaching, type Viewer } from "./service";

/*
 * Coaching daily vocabulary (owner decision 2026-11-24): every day, 3 words or expressions chosen
 * for the coaching's goal (Claude Haiku, made on the first visit of the day, shared by the whole
 * group). Each member writes 2 sentences of their own per expression; each sentence is corrected
 * at once and the group reads everyone's. Past days stay in the « Learning space ».
 * Each expression a member writes with (or saves) goes into their notebook (VocabWord, source
 * « coaching ») with their sentences, so it comes back in the spaced-review tests of The Vocabulary I Need.
 * Framework-free (tests/coaching-space.test.ts).
 */

export const VOCAB_PER_DAY = 3;
export const SENTENCES_PER_ITEM = 2;

const oid = (id: string) => {
  if (!Types.ObjectId.isValid(id)) throw new CoachingError("Not found.");
  return new Types.ObjectId(id);
};

/** Today's expressions; made now if nobody opened the coaching yet today (active coachings only). Null when the AI isn't available. */
export async function todayVocab(v: Viewer, coachingId: string, now = new Date()): Promise<CoachingVocabDoc | null> {
  const { coaching } = await openCoaching(v, coachingId);
  const day = dayKey(now);
  const existing = await CoachingVocab.findOne({ coachingId: coaching._id, day }).lean<CoachingVocabDoc>();
  if (existing || coaching.status !== "active") return existing;
  return generate(coaching, day, v.id);
}

async function generate(coaching: CoachingDoc, day: string, userId: string): Promise<CoachingVocabDoc | null> {
  const [previous, steps] = await Promise.all([
    CoachingVocab.find({ coachingId: coaching._id }).sort({ day: -1 }).limit(60).select("items.text").lean(),
    CoachingGoal.find({ coachingId: coaching._id, forUserId: null }).select("title").limit(12).lean(),
  ]);
  const avoid = previous.flatMap((p) => p.items.map((i) => i.text.toLowerCase()));
  try {
    const r = await aiServices().feedback.goalVocabulary({ title: coaching.title, goal: plainText(coaching.goal ?? "").slice(0, 1500), steps: steps.map((g) => g.title), count: VOCAB_PER_DAY, avoid });
    await recordUsage(userId, { kind: "llm", feature: "coaching_vocab", provider: r.usage.provider, tokens: r.usage.inputTokens + r.usage.outputTokens, costMicros: r.usage.costMicros }).catch(() => {});
    const seen = new Set(avoid);
    const items = r.items
      .filter((i) => i.text.trim() && !seen.has(i.text.trim().toLowerCase()))
      .slice(0, VOCAB_PER_DAY)
      .map((i, n) => ({ id: `e${n + 1}`, text: i.text.trim().slice(0, 120), translation: i.translation.slice(0, 160), frNote: i.frNote.slice(0, 400), example: i.example.slice(0, 300), exampleFr: i.exampleFr.slice(0, 300) }));
    if (!items.length) return null;
    // Two members opening at the same moment: the unique index keeps the first set.
    try {
      return (await CoachingVocab.create({ coachingId: coaching._id, day, items })).toObject() as CoachingVocabDoc;
    } catch {
      return CoachingVocab.findOne({ coachingId: coaching._id, day }).lean<CoachingVocabDoc>();
    }
  } catch (e) {
    console.error("[coaching vocab]", e);
    return null;
  }
}

/** Earlier days (newest first), for the Learning space. */
export async function pastVocab(v: Viewer, coachingId: string, now = new Date(), limit = 60) {
  const { coaching } = await openCoaching(v, coachingId);
  return CoachingVocab.find({ coachingId: coaching._id, day: { $lt: dayKey(now) } }).sort({ day: -1 }).limit(limit).lean<CoachingVocabDoc[]>();
}

/** Everyone's sentences on these days (the group shares them), with first names. */
export async function sentencesOn(vocabIds: Types.ObjectId[]) {
  const rows = await CoachingSentence.find({ vocabId: { $in: vocabIds } }).sort({ createdAt: 1 }).lean<CoachingSentenceDoc[]>();
  const users = await User.find({ _id: { $in: [...new Set(rows.map((r) => String(r.userId)))] } }).select("name avatarUrl").lean();
  return rows.map((r) => {
    const u = users.find((x) => String(x._id) === String(r.userId));
    return { id: String(r._id), vocabId: String(r.vocabId), itemId: r.itemId, userId: String(r.userId), firstName: u?.name ?? "—", avatarUrl: u?.avatarUrl ?? null, text: r.text, ok: r.ok ?? null, corrected: r.corrected ?? "", explanation: r.explanation ?? "" };
  });
}
export type SharedSentence = Awaited<ReturnType<typeof sentencesOn>>[number];

/** A member's sentence with an expression (2 per expression, any day of the coaching), corrected at once. */
export async function writeCoachingSentence(v: Viewer, coachingId: string, vocabId: string, itemId: string, raw: string) {
  const { coaching, role } = await openCoaching(v, coachingId);
  if (role !== "member") throw new CoachingError("Only the people coached write sentences here.");
  const vocab = await CoachingVocab.findOne({ _id: oid(vocabId), coachingId: coaching._id }).lean<CoachingVocabDoc>();
  const item = vocab?.items.find((i) => i.id === itemId);
  if (!vocab || !item) throw new CoachingError("Expression not found.");
  const text = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  if (text.split(" ").length < 4) throw new CoachingError("Write a full sentence (at least 4 words).");
  const mine = await CoachingSentence.countDocuments({ vocabId: vocab._id, itemId, userId: v.id });
  if (mine >= SENTENCES_PER_ITEM) throw new CoachingError(`You already wrote ${SENTENCES_PER_ITEM} sentences with this expression.`);
  const rl = await hitRateLimit(`coaching-sentence:${v.id}`, 40, 3600_000);
  if (!rl.allowed) throw new CoachingError("Many sentences this hour: take a break and come back later!");
  let check: { ok: boolean | null; corrected: string; explanation: string } = { ok: null, corrected: "", explanation: "" };
  try {
    const r = await aiServices().feedback.checkSentence({ word: item.text, translation: item.translation, sentence: text });
    check = { ok: !!r.result.ok, corrected: r.result.corrected.slice(0, 300), explanation: r.result.explanation.slice(0, 300) };
    await recordUsage(v.id, { kind: "llm", feature: "coaching_sentence", provider: r.usage.provider, tokens: r.usage.inputTokens + r.usage.outputTokens, costMicros: r.usage.costMicros }).catch(() => {});
  } catch (e) {
    console.error("[coaching sentence]", e); // shared without correction rather than lost
  }
  const s = await CoachingSentence.create({ coachingId: coaching._id, vocabId: vocab._id, itemId, userId: new Types.ObjectId(v.id), text, ...check });
  await Coaching.updateOne({ _id: coaching._id }, { $set: { updatedAt: new Date() } });
  // Into the learner's notebook, with this sentence (the « fill the blank » test question uses correct ones).
  await toNotebook(v.id, coaching, item)
    .then(() =>
      VocabWord.updateOne(
        { userId: v.id, word: notebookKey(item.text), "sentences.19": { $exists: false } },
        { $push: { sentences: { _id: s._id, text, corrected: check.corrected, ok: check.ok === true, explanation: check.explanation, at: new Date() } } },
      ),
    )
    .catch((e) => console.error("[coaching notebook]", e));
  return s.toObject() as CoachingSentenceDoc;
}

/** The author removes their sentence (and may write it again); the coach removes any. */
export async function deleteCoachingSentence(v: Viewer, coachingId: string, sentenceId: string) {
  const { coaching, role } = await openCoaching(v, coachingId);
  const s = await CoachingSentence.findOne({ _id: oid(sentenceId), coachingId: coaching._id });
  if (!s) return;
  if (role !== "coach" && String(s.userId) !== v.id) throw new CoachingError("You can only delete your own sentences.");
  await s.deleteOne();
  // The expression stays in the notebook; only this sentence leaves it.
  await VocabWord.updateOne({ userId: s.userId, "sentences._id": s._id }, { $pull: { sentences: { _id: s._id } } });
}

/** The coach adjusts an expression of the day (wording, translation, note, example). */
export async function editVocabItem(v: Viewer, coachingId: string, vocabId: string, itemId: string, raw: { text?: unknown; translation?: unknown; frNote?: unknown; example?: unknown; exampleFr?: unknown }) {
  const { coaching, role } = await openCoaching(v, coachingId);
  if (role !== "coach") throw new CoachingError("Only the coach can do this.");
  const text = String(raw.text ?? "").trim().slice(0, 120);
  if (!text) throw new CoachingError("Write the expression.");
  const s = (x: unknown, n: number) => String(x ?? "").trim().slice(0, n);
  const r = await CoachingVocab.updateOne(
    { _id: oid(vocabId), coachingId: coaching._id, "items.id": itemId },
    { $set: { "items.$.text": text, "items.$.translation": s(raw.translation, 160), "items.$.frNote": s(raw.frNote, 400), "items.$.example": s(raw.example, 300), "items.$.exampleFr": s(raw.exampleFr, 300) } },
  );
  if (!r.matchedCount) throw new CoachingError("Expression not found.");
}

/** A member's progress today: sentences written / expected. */
export const dayProgress = (vocab: Pick<CoachingVocabDoc, "_id" | "items"> | null, sentences: Pick<SharedSentence, "vocabId" | "userId">[], userId: string) =>
  vocab ? { done: Math.min(vocab.items.length * SENTENCES_PER_ITEM, sentences.filter((s) => s.vocabId === String(vocab._id) && s.userId === userId).length), total: vocab.items.length * SENTENCES_PER_ITEM } : { done: 0, total: 0 };

/** The expression, its example or a group sentence (the corrected one when it was wrong) read aloud; text from the database only. */
export async function vocabAudio(v: Viewer, coachingId: string, vocabId: string, itemId: string, opts: { what: "text" | "example" | "sentence"; sentenceId?: string; voice: "us" | "gb"; slow?: boolean }) {
  const { coaching } = await openCoaching(v, coachingId);
  const vocab = await CoachingVocab.findOne({ _id: oid(vocabId), coachingId: coaching._id }).lean<CoachingVocabDoc>();
  const item = vocab?.items.find((i) => i.id === itemId);
  if (!vocab || !item) throw new CoachingError("Expression not found.");
  let text = opts.what === "example" ? item.example : item.text;
  if (opts.what === "sentence") {
    const s = await CoachingSentence.findOne({ _id: oid(opts.sentenceId ?? ""), vocabId: vocab._id, itemId }).lean<CoachingSentenceDoc>();
    if (!s) throw new CoachingError("Sentence not found.");
    text = s.ok === false && s.corrected ? s.corrected : s.text;
  }
  if (!text?.trim()) return null;
  return speakFor(v.id, text.trim(), { voice: opts.voice, slow: opts.slow, feature: "coaching_vocab" });
}

// ── Notebook & spaced review ─────────────────────────────────────────────

type Expression = Pick<CoachingVocabDoc["items"][number], "text" | "translation" | "example">;

/** Saves an expression in a learner's notebook (once; first test the next day, like every saved word). */
async function toNotebook(userId: string, coaching: Pick<CoachingDoc, "_id" | "title">, item: Expression, now = new Date()) {
  const display = item.text.replace(/\s+/g, " ").trim();
  const word = notebookKey(display);
  if (!word) return;
  await VocabWord.updateOne(
    { userId, word },
    {
      $setOnInsert: {
        userId,
        word,
        display,
        kind: /\s/.test(display) ? "phrase" : "word",
        translation: (item.translation ?? "").slice(0, 160),
        context: (item.example ?? "").slice(0, 300),
        source: "coaching",
        coachingId: coaching._id,
        situation: (coaching.title ?? "").slice(0, 120),
        stage: 0,
        dueAt: new Date(now.getTime() + 86_400_000),
      },
    },
    { upsert: true },
  );
}

/** « Add to my notebook » on an expression (members; also done automatically when they write a sentence with it). */
export async function saveExpression(v: Viewer, coachingId: string, vocabId: string, itemId: string) {
  const { coaching, role } = await openCoaching(v, coachingId);
  if (role !== "member") throw new CoachingError("Only the people coached save expressions here.");
  const vocab = await CoachingVocab.findOne({ _id: oid(vocabId), coachingId: coaching._id }).lean<CoachingVocabDoc>();
  const item = vocab?.items.find((i) => i.id === itemId);
  if (!vocab || !item) throw new CoachingError("Expression not found.");
  await toNotebook(v.id, coaching, item);
}

/** The expressions of these days already in the learner's notebook, as « vocabId:itemId ». */
export async function savedItems(userId: string, days: Pick<CoachingVocabDoc, "_id" | "items">[]) {
  const all = days.flatMap((d) => d.items.map((i) => ({ ref: `${String(d._id)}:${i.id}`, key: notebookKey(i.text) })));
  if (!all.length) return [];
  const rows = await VocabWord.find({ userId, word: { $in: [...new Set(all.map((a) => a.key))] } }).select("word").lean();
  const keys = new Set(rows.map((r) => r.word));
  return all.filter((a) => keys.has(a.key)).map((a) => a.ref);
}

/** The learner's coaching expressions in the notebook: how many, and how many are due for a test now. */
export async function reviewState(userId: string, coachingId: string, now = new Date()) {
  if (!Types.ObjectId.isValid(coachingId)) return { saved: 0, due: 0 };
  const base = { userId, source: "coaching" as const, coachingId: new Types.ObjectId(coachingId) };
  const [saved, due] = await Promise.all([VocabWord.countDocuments(base), VocabWord.countDocuments({ ...base, $or: [{ dueAt: null }, { dueAt: { $lte: now } }] })]);
  return { saved, due };
}
