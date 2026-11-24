import { createHash } from "node:crypto";
import { Types } from "mongoose";
import { AppSettings, StoryAudio } from "@/models";
import { putObject, signedReadUrl, storageDriver } from "@/lib/storage";
import { realTts } from "./index";
import { elevenTts, isElevenLabsConfigured } from "./elevenlabs";
import { AZURE_TTS_MICROS_PER_CHAR } from "./azure";

/*
 * English text read by a natural voice, generated once and shared (vocabulary: dictionary words,
 * « At work » sentences, daily words and their examples). Azure neural voices when configured
 * (the intended provider), else ElevenLabs (owner decision 2026-11-23, until Azure arrives).
 * Cached by hash(provider + accent + speed + text) in the TTS cache (StoryAudio collection), the
 * audio in R2 (`courses_audios/speech/…`). null when no voice or no storage: the browser then
 * falls back on its own voice.
 */

export type Accent = "us" | "gb";
/** Default ElevenLabs voices: American (Jessica) and British (George); admins pick others on the AI usage page. */
export const DEFAULT_VOCAB_VOICES: Record<Accent, { id: string; name: string }> = { us: { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica" }, gb: { id: "JBFqnCBsd6RMkjVDRZzb", name: "George" } };

export async function vocabularyVoices(): Promise<Record<Accent, { id: string; name: string }>> {
  const s = await AppSettings.findOne({ key: "global" }).select("vocabularyVoices").lean();
  const v = (s?.vocabularyVoices ?? {}) as Partial<Record<Accent, { id?: string; name?: string }>>;
  return {
    us: v.us?.id ? { id: v.us.id, name: v.us.name ?? "" } : DEFAULT_VOCAB_VOICES.us,
    gb: v.gb?.id ? { id: v.gb.id, name: v.gb.name ?? "" } : DEFAULT_VOCAB_VOICES.gb,
  };
}

export async function saveVocabularyVoices(raw: Partial<Record<Accent, { id?: unknown; name?: unknown }>>) {
  const clean = (x: { id?: unknown; name?: unknown } | undefined, d: { id: string; name: string }) => {
    const id = String(x?.id ?? "").replace(/[^\w-]/g, "").slice(0, 64);
    return id ? { id, name: String(x?.name ?? "").slice(0, 100) } : d;
  };
  const next = { us: clean(raw.us, DEFAULT_VOCAB_VOICES.us), gb: clean(raw.gb, DEFAULT_VOCAB_VOICES.gb) };
  await AppSettings.updateOne({ key: "global" }, { $set: { vocabularyVoices: next } }, { upsert: true });
  return next;
}
/** ElevenLabs Flash on the Pro plan ≈ 0.5 credit / character ≈ $0.00003. */
const ELEVEN_MICROS_PER_CHAR = 30;

export function speechProvider(): "azure" | "elevenlabs" | null {
  try {
    storageDriver();
  } catch {
    return null;
  }
  if (realTts()) return "azure";
  if (isElevenLabsConfigured()) return "elevenlabs";
  return null;
}

/** Signed URL of the text read aloud (generated on first use). `fresh` + `costMicros` for the caller's metering. */
export async function spoken(text: string, opts: { accent: Accent; slow?: boolean; dryRun?: boolean }): Promise<{ url: string; fresh: boolean; costMicros: number; provider: string } | null> {
  const t = text.replace(/\s+/g, " ").trim().slice(0, 500);
  const provider = speechProvider();
  if (!t || !provider) return null;
  const voiceId = provider === "elevenlabs" ? (await vocabularyVoices())[opts.accent].id : opts.accent;
  // The voice is part of the key: choosing another voice makes new audio (the old stays for history).
  const hash = createHash("sha256").update(`${provider}\n${voiceId}\n${opts.slow ? "slow" : "normal"}\n${t}`).digest("hex").slice(0, 40);
  const hit = await StoryAudio.findOne({ hash }).lean();
  if (hit) return { url: await signedReadUrl(hit.key), fresh: false, costMicros: 0, provider };
  // dryRun: only what's already made (no generation).
  if (opts.dryRun) return null;
  let audio: { data: Uint8Array; mime: string };
  let costMicros: number;
  if (provider === "azure") {
    audio = await realTts()!.synthesize(t, { accent: opts.accent === "gb" ? "british" : "american", rate: opts.slow ? 0.75 : 1 });
    costMicros = t.length * AZURE_TTS_MICROS_PER_CHAR;
  } else {
    audio = await elevenTts(voiceId, t, { speed: opts.slow ? 0.75 : 1 });
    costMicros = t.length * ELEVEN_MICROS_PER_CHAR;
  }
  const ext = audio.mime === "audio/mpeg" ? "mp3" : audio.mime === "audio/wav" ? "wav" : "bin";
  const key = `courses_audios/speech/${new Date().toISOString().slice(0, 7)}/${new Types.ObjectId().toHexString()}.${ext}`;
  await putObject(key, audio.data, audio.mime);
  await StoryAudio.create({ hash, key, chars: t.length }).catch(() => {});
  return { url: await signedReadUrl(key), fresh: true, costMicros, provider };
}
