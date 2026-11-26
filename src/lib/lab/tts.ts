import { Types } from "mongoose";
import { Media } from "@/models";
import { elevenTts, isElevenLabsConfigured } from "@/lib/ai/elevenlabs";
import { recordUsage } from "@/lib/ai/metering";
import { hitRateLimit } from "@/lib/auth/service";
import { storageKey, visibilityFor } from "@/lib/media-rules";
import { putObject, signedReadUrl } from "@/lib/storage";

/*
 * Model audio made with an ElevenLabs voice in the Lab editors (owner request 2026-11-26: « Repeat
 * after Coach Ish », dictation): the phrase read by the chosen voice becomes a normal Media
 * « model-audio » owned by the staff member — exactly as if it had been uploaded. Framework-free.
 */

export class LabTtsError extends Error {}
/** ElevenLabs Flash ≈ $0.00003 a character (same estimate as the vocabulary voices). */
const MICROS_PER_CHAR = 30;
export const LAB_TTS_PER_HOUR = 200;

export async function generateModelAudio(staffId: string, rawText: string, voiceId: string, opts: { speed?: number } = {}) {
  const text = String(rawText ?? "").replace(/\s+/g, " ").trim();
  if (!text) throw new LabTtsError("Write the phrase first.");
  if (text.length > 400) throw new LabTtsError("Too long for one audio (400 characters at most).");
  if (!isElevenLabsConfigured()) throw new LabTtsError("ElevenLabs isn't configured (ELEVENLABS_API_KEY).");
  const rl = await hitRateLimit(`lab-tts:${staffId}`, LAB_TTS_PER_HOUR, 3600_000);
  if (!rl.allowed) throw new LabTtsError("Many audios this hour: try again a little later.");
  let audio: { data: Uint8Array; mime: string };
  try {
    audio = await elevenTts(String(voiceId ?? "").slice(0, 64), text, { speed: opts.speed });
  } catch (e) {
    console.error("[lab tts]", e);
    throw new LabTtsError("ElevenLabs didn't answer: try again in a moment.");
  }
  const _id = new Types.ObjectId();
  const key = storageKey("model-audio", String(_id), "mp3");
  await putObject(key, audio.data, audio.mime);
  // MP3 at 64 kbit/s: 8 000 bytes a second.
  const durationS = Math.round((audio.data.length / 8000) * 10) / 10;
  await Media.create({ _id, ownerId: new Types.ObjectId(staffId), kind: "model-audio", key, mime: audio.mime, size: audio.data.length, durationS, status: "ready", visibility: visibilityFor("model-audio") });
  await recordUsage(staffId, { kind: "tts", feature: "lab_audio", provider: "elevenlabs", costMicros: text.length * MICROS_PER_CHAR }).catch(() => {});
  return { mediaId: String(_id), url: await signedReadUrl(key), durationS };
}
