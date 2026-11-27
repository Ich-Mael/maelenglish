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
 * The coach may add their own expressions to today or queue them for the coming days (owner request 2026-11-26).
 * Framework-free (tests/coaching-space.test.ts, tests/coaching-vocab-suggest.test.ts).
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
  // The coach's suggestions for the coming days come first; the AI completes the day.
  const queued = (coaching.vocabQueue ?? []).slice(0, VOCAB_PER_DAY);
  const items: VocabItem[] = queued.map((q) => ({ id: q.id, text: q.text, translation: q.translation ?? "", frNote: q.frNote ?? "", example: q.example ?? "", exampleFr: q.exampleFr ?? "", by: "coach" }));
  if (items.length < VOCAB_PER_DAY) {
    const [previous, steps] = await Promise.all([
      CoachingVocab.find({ coachingId: coaching._id }).sort({ day: -1 }).limit(60).select("items.text").lean(),
      CoachingGoal.find({ coachingId: coaching._id, forUserId: null }).select("title").limit(12).lean(),
    ]);
    const avoid = [...previous.flatMap((p) => p.items.map((i) => i.text.toLowerCase())), ...(coaching.vocabQueue ?? []).map((q) => q.text.toLowerCase())];
    const count = VOCAB_PER_DAY - items.length;
    try {
      const r = await aiServices().feedback.goalVocabulary({ title: coaching.title, goal: plainText(coaching.goal ?? "").slice(0, 1500), steps: steps.map((g) => g.title), count, avoid });
      await recordUsage(userId, { kind: "llm", feature: "coaching_vocab", provider: r.usage.provider, tokens: r.usage.inputTokens + r.usage.outputTokens, costMicros: r.usage.costMicros }).catch(() => {});
      const seen = new Set(avoid);
      r.items
        .filter((i) => i.text.trim() && !seen.has(i.text.trim().toLowerCase()))
        .slice(0, count)
        .forEach((i, n) => items.push({ id: `e${n + 1}`, text: i.text.trim().slice(0, 120), translation: i.translation.slice(0, 160), frNote: i.frNote.slice(0, 400), example: i.example.slice(0, 300), exampleFr: i.exampleFr.slice(0, 300), by: "ai" }));
    } catch (e) {
      console.error("[coaching vocab]", e); // the coach's expressions alone still make the day
    }
  }
  if (!items.length) return null;
  // Two members opening at the same moment: the unique index keeps the first set (and only that one takes the queued expressions).
  try {
    const created = (await CoachingVocab.create({ coachingId: coaching._id, day, items })).toObject() as CoachingVocabDoc;
    if (queued.length) await Coaching.updateOne({ _id: coaching._id }, { $pull: { vocabQueue: { id: { $in: queued.map((q) => q.id) } } } });
    return created;
  } catch {
    return CoachingVocab.findOne({ coachingId: coaching._id, day }).lean<CoachingVocabDoc>();
  }
}

// ── The coach's own expressions ──────────────────────────────────────────

/** A day holds at most this many expressions (the AI's 3 + the coach's). */
export const MAX_PER_DAY = 6;
export const MAX_QUEUE = 30;
type VocabItem = { id: string; text: string; translation: string; frNote: string; example: string; exampleFr: string; by: "ai" | "coach" };
const newId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** « expression » or « expression = traduction » (or a tab), one per line; duplicates and empty lines left out. */
export function parseSuggestions(raw: string) {
  const seen = new Set<string>();
  return String(raw ?? "")
    .split(/\r?\n/)
    .map((line) => {
      const [text, ...rest] = line.split(/\t|\s=\s|=/);
      return { text: (text ?? "").replace(/\s+/g, " ").trim().slice(0, 120), translation: rest.join(" ").replace(/\s+/g, " ").trim().slice(0, 160) };
    })
    .filter((i) => i.text && !seen.has(i.text.toLowerCase()) && seen.add(i.text.toLowerCase()))
    .slice(0, 10);
}

/**
 * The coach suggests words or expressions: added to today's (« today », up to MAX_PER_DAY a day) or
 * queued for the coming days (« next »: each new day takes up to 3 of them before the AI completes it).
 * The AI writes what the coach left out (translation, French note, example); without it they're kept as typed.
 */
export async function suggestVocab(v: Viewer, coachingId: string, raw: string, when: "today" | "next", now = new Date()) {
  const { coaching, role } = await openCoaching(v, coachingId);
  if (role !== "coach") throw new CoachingError("Only the coach can do this.");
  const wanted = parseSuggestions(raw);
  if (!wanted.length) throw new CoachingError("Write at least one word or expression (one per line).");
  const day = dayKey(now);
  const [recent, todayDoc] = await Promise.all([
    CoachingVocab.find({ coachingId: coaching._id }).sort({ day: -1 }).limit(60).select("items.text").lean(),
    CoachingVocab.findOne({ coachingId: coaching._id, day }).lean<CoachingVocabDoc>(),
  ]);
  const given = new Set([...recent.flatMap((d) => d.items.map((i) => i.text.toLowerCase())), ...(coaching.vocabQueue ?? []).map((q) => q.text.toLowerCase())]);
  const fresh = wanted.filter((i) => !given.has(i.text.toLowerCase()));
  if (!fresh.length) throw new CoachingError(wanted.length > 1 ? "These expressions were already given or are already planned." : "This expression was already given or is already planned.");
  if (when === "today") {
    if (coaching.status !== "active") throw new CoachingError("This coaching is paused or completed: no new expressions today.");
    const room = MAX_PER_DAY - (todayDoc?.items.length ?? 0);
    if (fresh.length > room) throw new CoachingError(room > 0 ? `Today can take ${room} more expression${room > 1 ? "s" : ""} (${MAX_PER_DAY} a day at most): put the others in the coming days.` : `Today already has ${MAX_PER_DAY} expressions: put these in the coming days.`);
  } else if ((coaching.vocabQueue?.length ?? 0) + fresh.length > MAX_QUEUE) {
    throw new CoachingError(`Up to ${MAX_QUEUE} expressions can wait for the coming days.`);
  }
  const rl = await hitRateLimit(`coaching-suggest:${v.id}`, 30, 3600_000);
  if (!rl.allowed) throw new CoachingError("Many suggestions this hour: try again later.");

  let done: VocabItem[] = fresh.map((i) => ({ id: newId(), text: i.text, translation: i.translation, frNote: "", example: "", exampleFr: "", by: "coach" }));
  try {
    const r = await aiServices().feedback.completeExpressions({ title: coaching.title, goal: plainText(coaching.goal ?? "").slice(0, 1500), items: fresh });
    await recordUsage(v.id, { kind: "llm", feature: "coaching_vocab", provider: r.usage.provider, tokens: r.usage.inputTokens + r.usage.outputTokens, costMicros: r.usage.costMicros }).catch(() => {});
    done = done.map((d, n) => {
      const a = r.items[n];
      if (!a) return d;
      return { ...d, translation: (d.translation || a.translation).slice(0, 160), frNote: a.frNote.slice(0, 400), example: a.example.slice(0, 300), exampleFr: a.exampleFr.slice(0, 300) };
    });
  } catch (e) {
    console.error("[coaching suggest]", e); // kept as typed; the coach can complete them with « Edit »
  }

  if (when === "next") {
    await Coaching.updateOne({ _id: coaching._id }, { $push: { vocabQueue: { $each: done.map((q) => ({ id: q.id, text: q.text, translation: q.translation, frNote: q.frNote, example: q.example, exampleFr: q.exampleFr, addedAt: now })) } } });
  } else if (todayDoc) {
    await CoachingVocab.updateOne({ _id: todayDoc._id }, { $push: { items: { $each: done } } });
  } else {
    // Nobody opened the coaching yet today: make the day with the coach's expressions (the AI's are not added on top).
    try {
      await CoachingVocab.create({ coachingId: coaching._id, day, items: done });
    } catch {
      await CoachingVocab.updateOne({ coachingId: coaching._id, day }, { $push: { items: { $each: done } } });
    }
  }
  await Coaching.updateOne({ _id: coaching._id }, { $set: { updatedAt: new Date() } });
  return { added: done.length, skipped: wanted.length - fresh.length };
}

/** The coach removes an expression of a day nobody wrote a sentence with yet (a day keeps at least one). */
export async function removeVocabItem(v: Viewer, coachingId: string, vocabId: string, itemId: string) {
  const { coaching, role } = await openCoaching(v, coachingId);
  if (role !== "coach") throw new CoachingError("Only the coach can do this.");
  const vocab = await CoachingVocab.findOne({ _id: oid(vocabId), coachingId: coaching._id }).lean<CoachingVocabDoc>();
  if (!vocab?.items.some((i) => i.id === itemId)) throw new CoachingError("Expression not found.");
  if (vocab.items.length <= 1) throw new CoachingError("A day keeps at least one expression: edit it instead.");
  if (await CoachingSentence.exists({ vocabId: vocab._id, itemId })) throw new CoachingError("Someone already wrote a sentence with it: edit it instead.");
  await CoachingVocab.updateOne({ _id: vocab._id }, { $pull: { items: { id: itemId } } });
}

/** The coach takes an expression out of the coming days. */
export async function removeQueuedVocab(v: Viewer, coachingId: string, id: string) {
  const { coaching, role } = await openCoaching(v, coachingId);
  if (role !== "coach") throw new CoachingError("Only the coach can do this.");
  await Coaching.updateOne({ _id: coaching._id }, { $pull: { vocabQueue: { id: String(id) } } });
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
