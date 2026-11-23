import { Types } from "mongoose";
import { ConversationSession, Media } from "@/models";
import { conversationEngine } from "@/lib/ai";
import { MAX_BYTES, extensionFor, storageKey } from "@/lib/media-rules";
import { deleteObject, putObject } from "@/lib/storage";

/*
 * Recordings of AI role-play calls (owner decision 2026-11-23, option A): after the call the server
 * copies the audio from ElevenLabs to our storage (R2, `students_audio/conversation/…`), as a
 * private Media owned by the learner — readable by the learner, their main coach and admins
 * (`canReadMedia`). Learners can't delete it; only admins can (`deleteConversationAudio`).
 * Framework-free (tests/conversation.test.ts).
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Copies the call's audio once ElevenLabs has it (it can take a little while after the call):
 * `attempts` tries, `delayMs` apart. Returns the Media id, or null (no audio, or already stored).
 */
export async function storeConversationAudio(sessionId: string, opts: { attempts?: number; delayMs?: number } = {}, now = new Date()): Promise<string | null> {
  const s = await ConversationSession.findById(sessionId).select("userId providerConversationId audioMediaId durationS").lean();
  if (!s || s.audioMediaId || !s.providerConversationId) return s?.audioMediaId ? String(s.audioMediaId) : null;
  const engine = conversationEngine();
  if (!engine) return null;

  let audio: { data: Uint8Array; mime: string } | null = null;
  const attempts = opts.attempts ?? 6;
  for (let i = 0; i < attempts && !audio; i++) {
    if (i) await sleep(opts.delayMs ?? 10_000);
    audio = await engine.fetchAudio(s.providerConversationId).catch((e) => (console.error("[roleplay] audio fetch", e), null));
  }
  if (!audio) return null;
  if (audio.data.length > MAX_BYTES.conversation) {
    console.error(`[roleplay] audio of session ${sessionId} too large (${audio.data.length} bytes): not stored`);
    return null;
  }

  const id = new Types.ObjectId();
  const ext = extensionFor("conversation", audio.mime) ?? "mp3";
  const key = storageKey("conversation", String(id), ext, now);
  await putObject(key, audio.data, audio.mime);
  await Media.create({ _id: id, ownerId: s.userId, kind: "conversation", key, mime: audio.mime, size: audio.data.length, durationS: s.durationS ?? 0, status: "ready", visibility: "private" });
  // Only one copy per call, even if two copies ran at once.
  const r = await ConversationSession.updateOne({ _id: sessionId, audioMediaId: null }, { $set: { audioMediaId: id } });
  if (!r.modifiedCount) {
    await deleteObject(key).catch(() => {});
    await Media.deleteOne({ _id: id });
    const again = await ConversationSession.findById(sessionId).select("audioMediaId").lean();
    return again?.audioMediaId ? String(again.audioMediaId) : null;
  }
  return String(id);
}

/** Admins only (checked by the caller): deletes a call's recording; the transcript and debrief stay. */
export async function deleteConversationAudio(sessionId: string): Promise<boolean> {
  if (!Types.ObjectId.isValid(sessionId)) return false;
  const s = await ConversationSession.findById(sessionId).select("audioMediaId").lean();
  if (!s?.audioMediaId) return false;
  const m = await Media.findById(s.audioMediaId).lean();
  if (m) await deleteObject(m.key).catch((e) => console.error("[roleplay] delete audio", e));
  await Media.deleteOne({ _id: s.audioMediaId });
  await ConversationSession.updateOne({ _id: sessionId }, { $set: { audioMediaId: null } });
  return true;
}
