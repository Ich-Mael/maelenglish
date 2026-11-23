import { Types } from "mongoose";
import { DictionaryContext, DictionaryEntry, VocabWord, type DictionaryContextDoc, type DictionaryEntryDoc, type VocabWordDoc } from "@/models";
import { aiServices, realTts } from "@/lib/ai";
import { AZURE_TTS_MICROS_PER_CHAR } from "@/lib/ai/azure";
import { putObject, signedReadUrl, storageDriver } from "@/lib/storage";
import { recordUsage } from "@/lib/ai/metering";
import { hitRateLimit } from "@/lib/auth/service";
import { lemmaOf, normalizeWord } from "./dictionary-word";

export { lemmaOf, normalizeWord };

/*
 * Dictionary & vocabulary notebook (framework-free, tested in tests/dictionary.test.ts; owner
 * decision 2026-11-22). A word is looked up once, ever, then served from the `DictionaryEntry`
 * cache: the Free Dictionary API (dictionaryapi.dev, no key) gives the English meanings, phonetic
 * and native audio; the AI layer (Claude Haiku 5.5) adds the French translation, a French note and
 * a business example. Words the dictionary doesn't know: one retry on a simple lemma, else an
 * AI-only entry. « My Notebook » = `VocabWord`. UI and messages in English (owner decision 2026-11-22).
 */

export const DICTIONARY_URL = "https://api.dictionaryapi.dev/api/v2/entries/en/";
/** Lookups per learner and hour that reach the services (cached words don't count). */
export const LOOKUPS_PER_HOUR = 60;

/** Bump when the AI enrichment changes: cached entries of an older version are re-enriched (AI call only). 2 = most common sense, all senses sent. */
export const ENRICH_VERSION = 2;

export class DictionaryError extends Error {}

type ApiEntry = { word?: string; phonetic?: string; phonetics?: { text?: string; audio?: string }[]; meanings?: { partOfSpeech?: string; definitions?: { definition?: string; example?: string }[] }[] };
type Parsed = { headword: string; phonetic: string; audioUrl: string; meanings: { partOfSpeech: string; definitions: { definition: string; example: string }[] }[] };

/** The Free Dictionary API's answer for a word, or null when it doesn't know it (404). */
async function fetchDictionary(word: string): Promise<Parsed | null> {
  let res: Response;
  try {
    res = await fetch(DICTIONARY_URL + encodeURIComponent(word), { signal: AbortSignal.timeout(5000), headers: { Accept: "application/json" } });
  } catch {
    throw new DictionaryError("The dictionary isn't answering: try again in a moment.");
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new DictionaryError("The dictionary is unavailable: try again in a moment.");
  const data = (await res.json().catch(() => [])) as ApiEntry[];
  if (!Array.isArray(data) || !data.length) return null;
  const phonetics = data.flatMap((e) => e.phonetics ?? []);
  // Prefer a US then UK recording, else any.
  const audio = phonetics.map((p) => p.audio ?? "").filter((a) => /^https:\/\//.test(a));
  const audioUrl = audio.find((a) => /-us\.mp3$/.test(a)) ?? audio.find((a) => /-uk\.mp3$/.test(a)) ?? audio[0] ?? "";
  const phonetic = data.find((e) => e.phonetic)?.phonetic ?? phonetics.find((p) => p.text)?.text ?? "";
  const meanings = data
    .flatMap((e) => e.meanings ?? [])
    .map((m) => ({
      partOfSpeech: (m.partOfSpeech ?? "").slice(0, 40),
      definitions: (m.definitions ?? [])
        .filter((d) => d.definition)
        .slice(0, 3)
        .map((d) => ({ definition: (d.definition ?? "").slice(0, 400), example: (d.example ?? "").slice(0, 300) })),
    }))
    .filter((m) => m.definitions.length)
    .slice(0, 3);
  return { headword: data[0].word ?? word, phonetic: phonetic.slice(0, 80), audioUrl: audioUrl.slice(0, 500), meanings };
}

/** The meanings' definitions in order, numbered from 1 (the AI answers with that number). */
const flatSenses = (meanings: Parsed["meanings"]) => meanings.flatMap((m, mi) => m.definitions.map((d, di) => ({ partOfSpeech: m.partOfSpeech, definition: d.definition, mi, di })));

/** French translation (+ note, business example, the sense used); null when the AI fails (never throws). */
async function enrich(userId: string, word: string, meanings: Parsed["meanings"], sentence?: string) {
  try {
    const senses = flatSenses(meanings);
    const { result, usage } = await aiServices().feedback.translateWord({ word, senses: senses.map(({ partOfSpeech, definition }) => ({ partOfSpeech, definition })), sentence });
    await recordUsage(userId, { kind: "llm", feature: "dictionary", provider: usage.provider, tokens: usage.inputTokens + usage.outputTokens, costMicros: usage.costMicros }).catch(() => {});
    const sense = Number.isInteger(result.sense) && result.sense >= 1 && result.sense <= senses.length ? result.sense : 0;
    return { translation: result.translation.slice(0, 120), frNote: result.frNote.slice(0, 400), businessExample: result.businessExample.slice(0, 300), sense };
  } catch (e) {
    console.error("[dictionary] translation", e);
    return null;
  }
}

/** A sense number → its meaning / definition indexes (null for 0 or out of range). */
function senseAt(meanings: Parsed["meanings"], n: number): { m: number; d: number } | null {
  const s = flatSenses(meanings)[n - 1];
  return s ? { m: s.mi, d: s.di } : null;
}

/** The sentence as a cache key: one line, trimmed, lowercased, ≤ 300 chars. */
export const sentenceKey = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 300);

/** Does the sentence contain the word (or its lemma's family)? Otherwise the context is ignored. */
const mentions = (sentence: string, word: string, headword: string) => {
  const s = sentence.toLowerCase().replace(/[’‘`]/g, "'");
  return [word, headword].filter(Boolean).some((w) => new RegExp(`(^|[^a-z])${w.replace(/[-']/g, "\\$&")}`).test(s));
};

/**
 * `sense`: the main meaning (most common); `inContext`: the meaning in the sentence the word was
 * tapped in; `voices`: generated neural audio is available (`/api/dictionary/audio`), else the
 * card uses `audioUrl` (dictionary recording) or the browser's voice.
 */
export type WordEntry = Pick<DictionaryEntryDoc, "word" | "found" | "headword" | "phonetic" | "audioUrl" | "translation" | "frNote" | "businessExample" | "source"> & {
  meanings: Parsed["meanings"];
  sense: { m: number; d: number } | null;
  inContext: { sentence: string; translation: string; frNote: string; sense: { m: number; d: number } | null } | null;
  voices: boolean;
};

const meaningsOf = (e: DictionaryEntryDoc): Parsed["meanings"] => (e.meanings ?? []).map((m) => ({ partOfSpeech: m.partOfSpeech, definitions: (m.definitions ?? []).map((d) => ({ definition: d.definition, example: d.example })) }));

const view = (e: DictionaryEntryDoc): WordEntry => ({
  word: e.word,
  found: e.found,
  headword: e.headword,
  phonetic: e.phonetic,
  audioUrl: e.audioUrl,
  translation: e.translation,
  frNote: e.frNote,
  businessExample: e.businessExample,
  source: e.source,
  meanings: meaningsOf(e),
  sense: senseAt(meaningsOf(e), e.sense ?? 0),
  inContext: null,
  voices: voicesAvailable(),
});

/**
 * Looks a word up (cache first). With `context` (the sentence it was tapped in), also gives its
 * meaning in that sentence. Throws DictionaryError with an English message.
 */
export async function lookup(userId: string, raw: string, context?: string): Promise<WordEntry> {
  const word = normalizeWord(raw);
  if (!word) throw new DictionaryError("Select one English word.");
  let limited = false;
  const spend = async () => {
    if (limited) return;
    limited = true;
    const limit = await hitRateLimit(`dictionary:${userId}`, LOOKUPS_PER_HOUR, 60 * 60_000);
    if (!limit.allowed) throw new DictionaryError("You've looked up a lot of words: try again in a few minutes.");
  };

  let doc = await DictionaryEntry.findOne({ word }).lean<DictionaryEntryDoc>();
  // Fresh enough: translated with the current enrichment (or known to be unknown). Else (new word,
  // the AI failed last time, older enrichment) → fetch what's missing.
  if (!doc || (!doc.translation && doc.source !== "none") || (doc.translation && (doc.enrichVersion ?? 0) < ENRICH_VERSION)) {
    await spend();
    const cached = doc;
    let parsed = cached?.meanings?.length ? null : await fetchDictionary(word);
    if (!parsed && !cached?.meanings?.length) {
      const lemma = lemmaOf(word);
      if (lemma && lemma !== word) parsed = await fetchDictionary(lemma);
    }
    const base = parsed ?? (cached?.meanings?.length ? { headword: cached.headword, phonetic: cached.phonetic, audioUrl: cached.audioUrl, meanings: meaningsOf(cached) } : null);
    const fr = await enrich(userId, word, base?.meanings ?? []);
    const found = !!base;
    doc = await DictionaryEntry.findOneAndUpdate(
      { word },
      {
        $set: {
          found,
          headword: base?.headword ?? word,
          phonetic: base?.phonetic ?? "",
          audioUrl: base?.audioUrl ?? "",
          meanings: base?.meanings ?? [],
          translation: fr?.translation ?? "",
          frNote: fr?.frNote ?? "",
          businessExample: fr?.businessExample ?? "",
          sense: fr?.sense ?? 0,
          enrichVersion: fr ? ENRICH_VERSION : 0,
          // A new business example needs new audio (keys removed below).
          // Not in the dictionary and no AI answer either: cached as unknown.
          source: found ? "dictionary" : fr?.translation ? "ai" : "none",
          fetchedAt: new Date(),
        },
        $unset: { "tts.example-us": 1, "tts.example-gb": 1, "tts.example-us-slow": 1, "tts.example-gb-slow": 1 },
      },
      { upsert: true, returnDocument: "after" },
    ).lean<DictionaryEntryDoc>();
  }
  const entry = view(doc!);

  // The meaning in the sentence (shared cache per word + sentence).
  const sentence = (context ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  if (sentence && entry.source !== "none" && mentions(sentence, word, entry.headword)) {
    const key = sentenceKey(sentence);
    let ctx = await DictionaryContext.findOne({ word, sentence: key }).lean<DictionaryContextDoc>();
    if (!ctx) {
      await spend();
      const fr = await enrich(userId, word, entry.meanings, sentence);
      if (fr?.translation) {
        ctx = await DictionaryContext.findOneAndUpdate({ word, sentence: key }, { $set: { translation: fr.translation, frNote: fr.frNote, sense: fr.sense } }, { upsert: true, returnDocument: "after" }).lean<DictionaryContextDoc>();
      }
    }
    if (ctx) entry.inContext = { sentence, translation: ctx.translation, frNote: ctx.frNote, sense: senseAt(entry.meanings, ctx.sense) };
  }
  return entry;
}

// ── Pronunciation audio (Azure neural voices) ────────────────────────────────

export const AUDIO_VOICES = { us: "american", gb: "british" } as const;
export type AudioVoice = keyof typeof AUDIO_VOICES;
/** Slow version: 25 % slower. */
export const SLOW_RATE = 0.75;
/** Audio generations per learner and hour (stored audio doesn't count). */
export const AUDIO_PER_HOUR = 120;

/** A real voice and somewhere to keep its audio. */
function voicesAvailable() {
  if (!realTts()) return false;
  try {
    storageDriver();
    return true;
  } catch {
    return false;
  }
}

/**
 * Signed URL of the word (or its business example) read by a neural voice; generated on first
 * play, stored (`courses_audios/dictionary/…`) and shared. null when no voice is configured or
 * there is nothing to read: the browser then falls back on the recording / its own voice.
 */
export async function wordAudio(userId: string, raw: string, opts: { voice: AudioVoice; slow?: boolean; what?: "word" | "example" }): Promise<string | null> {
  const word = normalizeWord(raw);
  if (!word || !(opts.voice in AUDIO_VOICES)) return null;
  const what = opts.what ?? "word";
  const name = `${what}-${opts.voice}${opts.slow ? "-slow" : ""}`;
  const doc = await DictionaryEntry.findOne({ word }).lean<DictionaryEntryDoc>();
  if (!doc) return null;
  const stored = (doc.tts as unknown as Record<string, string> | undefined)?.[name];
  if (stored) return signedReadUrl(stored);
  const text = what === "word" ? doc.word : doc.businessExample;
  const tts = realTts();
  if (!text || !tts || !voicesAvailable()) return null;
  const limit = await hitRateLimit(`dictionary-audio:${userId}`, AUDIO_PER_HOUR, 60 * 60_000);
  if (!limit.allowed) throw new DictionaryError("You've played a lot of new words: try again in a few minutes.");
  const audio = await tts.synthesize(text, { accent: AUDIO_VOICES[opts.voice], rate: opts.slow ? SLOW_RATE : 1 });
  const ext = audio.mime === "audio/mpeg" ? "mp3" : audio.mime === "audio/wav" ? "wav" : "bin";
  const key = `courses_audios/dictionary/${new Date().toISOString().slice(0, 7)}/${new Types.ObjectId().toHexString()}.${ext}`;
  await putObject(key, audio.data, audio.mime);
  await DictionaryEntry.updateOne({ word }, { $set: { [`tts.${name}`]: key } });
  await recordUsage(userId, { kind: "tts", feature: "dictionary", provider: tts.name, costMicros: text.length * AZURE_TTS_MICROS_PER_CHAR }).catch(() => {});
  return signedReadUrl(key);
}

// ── Notebook ───────────────────────────────────────────────────────────────

export async function saveWord(userId: string, raw: string, opts: { context?: string; translation?: string; courseId?: string | null; stepId?: string | null; source?: "dictionary" | "daily" } = {}) {
  const word = normalizeWord(raw);
  if (!word) throw new DictionaryError("Invalid word.");
  const id = (v?: string | null) => (v && Types.ObjectId.isValid(v) ? new Types.ObjectId(v) : null);
  await VocabWord.updateOne(
    { userId, word },
    {
      $setOnInsert: {
        userId,
        word,
        context: (opts.context ?? "").replace(/\s+/g, " ").trim().slice(0, 300),
        translation: (opts.translation ?? "").slice(0, 120),
        courseId: id(opts.courseId),
        stepId: id(opts.stepId),
        source: opts.source ?? "dictionary",
        // Spaced review: first test the next day.
        stage: 0,
        dueAt: new Date(Date.now() + 86_400_000),
      },
    },
    { upsert: true },
  );
}

export const removeWord = (userId: string, raw: string) => VocabWord.deleteOne({ userId, word: normalizeWord(raw) ?? "" });

export const hasWord = async (userId: string, raw: string) => !!(await VocabWord.exists({ userId, word: normalizeWord(raw) ?? "" }));

export type NotebookItem = VocabWordDoc & { entry: WordEntry | null };

/** The learner's words, newest first, with their dictionary entry. `filter`: all / learning / known. */
export async function listWords(userId: string, filter: "all" | "learning" | "known" = "all"): Promise<NotebookItem[]> {
  const words = await VocabWord.find({ userId, ...(filter === "known" ? { known: true } : filter === "learning" ? { known: false } : {}) })
    .sort({ createdAt: -1 })
    .limit(500)
    .lean<VocabWordDoc[]>();
  const entries = await DictionaryEntry.find({ word: { $in: words.map((w) => w.word) } }).lean<DictionaryEntryDoc[]>();
  return words.map((w) => {
    const e = entries.find((x) => x.word === w.word);
    return { ...w, entry: e ? view(e) : null };
  });
}

export async function reviewWord(userId: string, raw: string, known: boolean) {
  await VocabWord.updateOne({ userId, word: normalizeWord(raw) ?? "" }, { $set: { known, lastReviewedAt: new Date() }, $inc: { reviews: 1 } });
}
