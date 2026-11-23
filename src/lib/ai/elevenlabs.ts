import "server-only";
import type { AudioInput, ConversationAgentSpec, ConversationEngine, ConversationTurn, FinishedConversation, SpeechService, Transcript, Voice } from "./types";

/*
 * ElevenLabs Agents — the AI speaking partner's voice, listening and turn-taking (DECISIONS.md
 * « Conversation engine »). REST API with the `xi-api-key` header, no server SDK. One private agent
 * per scenario × difficulty (created on first use, reused while the scenario doesn't change), so
 * the browser only ever gets a signed URL: the prompt can't be changed from the client. The LLM is
 * Claude Haiku 5.5, run by ElevenLabs. Needs ELEVENLABS_API_KEY.
 */

const API = "https://api.elevenlabs.io";
export const ROLEPLAY_LLM = "claude-haiku-5-5";
/** Estimate when ElevenLabs doesn't report a cost: ~$0.10 per minute of call (re-check the plan's price). */
export const ELEVENLABS_MICROS_PER_MINUTE = 100_000;

export const isElevenLabsConfigured = () => Boolean(process.env.ELEVENLABS_API_KEY);

async function call<T>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(init.timeoutMs ?? 15_000),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`ElevenLabs ${res.status} on ${path.split("?")[0]}: ${detail}`);
  }
  return (res.status === 204 ? null : await res.json()) as T;
}

/** The body sent to « create agent » (exported for tests). */
export function agentBody(spec: ConversationAgentSpec) {
  return {
    name: spec.name,
    tags: ["maelenglish", "roleplay"],
    conversation_config: {
      agent: {
        first_message: spec.firstMessage,
        language: "en",
        prompt: { prompt: spec.prompt, llm: ROLEPLAY_LLM, temperature: 0.7 },
      },
      tts: { ...(spec.voiceId ? { voice_id: spec.voiceId } : {}), speed: spec.speed },
      conversation: { max_duration_seconds: spec.maxDurationS },
      turn: { turn_timeout: spec.turnTimeoutS, turn_eagerness: spec.eagerness },
    },
    // Private: the browser needs a signed URL from our server.
    platform_settings: { auth: { enable_auth: true } },
  };
}

type RawConversation = {
  agent_id?: string;
  status?: string;
  transcript?: { role?: string; message?: string | null; time_in_call_secs?: number }[];
  metadata?: { call_duration_secs?: number; cost_fiat?: number | null };
};

/**
 * ElevenLabs' expressive voices read audio tags written by the LLM (« [friendly] », « [laughs] »):
 * heard in the voice, removed from the text the learner reads.
 */
export const stripAudioTags = (text: string) => text.replace(/\[[a-z][a-z ,'-]{0,30}\]\s*/gi, "").replace(/\s{2,}/g, " ").trim();

/** ElevenLabs' conversation → our shape (exported for tests). */
export function parseConversation(raw: RawConversation): FinishedConversation {
  const status = raw.status === "done" ? "done" : raw.status === "failed" ? "failed" : "processing";
  const transcript: ConversationTurn[] = (raw.transcript ?? [])
    .filter((t) => (t.role === "agent" || t.role === "user") && typeof t.message === "string" && t.message.trim())
    .map((t) => ({ role: t.role as "agent" | "user", text: (t.role === "agent" ? stripAudioTags(t.message!) : t.message!.trim()).slice(0, 2000), t: Math.max(0, Number(t.time_in_call_secs) || 0) }))
    .filter((t) => t.text);
  const cost = raw.metadata?.cost_fiat;
  return {
    status,
    agentId: raw.agent_id ?? "",
    transcript,
    durationS: Math.max(0, Math.round(Number(raw.metadata?.call_duration_secs) || 0)),
    costMicros: typeof cost === "number" && Number.isFinite(cost) ? Math.round(cost * 1_000_000) : null,
  };
}

export class ElevenLabsConversationEngine implements ConversationEngine {
  readonly name = "elevenlabs";

  async createAgent(spec: ConversationAgentSpec): Promise<string> {
    const r = await call<{ agent_id: string }>("/v1/convai/agents/create", { method: "POST", body: JSON.stringify(agentBody(spec)) });
    if (!r?.agent_id) throw new Error("ElevenLabs: no agent id returned.");
    return r.agent_id;
  }

  async deleteAgent(agentId: string) {
    await call(`/v1/convai/agents/${encodeURIComponent(agentId)}`, { method: "DELETE" });
  }

  async signedUrl(agentId: string): Promise<string> {
    const r = await call<{ signed_url: string }>(`/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`);
    if (!r?.signed_url) throw new Error("ElevenLabs: no signed URL returned.");
    return r.signed_url;
  }

  async fetchConversation(conversationId: string): Promise<FinishedConversation> {
    return parseConversation(await call<RawConversation>(`/v1/convai/conversations/${encodeURIComponent(conversationId)}`));
  }

  async fetchAudio(conversationId: string): Promise<{ data: Uint8Array; mime: string } | null> {
    const res = await fetch(`${API}/v1/convai/conversations/${encodeURIComponent(conversationId)}/audio`, {
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! },
      signal: AbortSignal.timeout(60_000),
      cache: "no-store",
    });
    if (res.status === 404 || res.status === 422 || res.status === 425) return null; // not ready / no audio
    if (!res.ok) throw new Error(`ElevenLabs ${res.status} on conversation audio: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    const data = new Uint8Array(await res.arrayBuffer());
    if (!data.length) return null;
    return { data, mime: (res.headers.get("content-type") ?? "audio/mpeg").split(";")[0].trim() || "audio/mpeg" };
  }

  async listVoices(): Promise<Voice[]> {
    const r = await call<{ voices?: { voice_id: string; name: string; labels?: Record<string, string>; preview_url?: string }[] }>("/v1/voices");
    return (r?.voices ?? [])
      .map((v) => ({ id: v.voice_id, name: v.name, accent: v.labels?.accent ?? "", gender: v.labels?.gender ?? "", previewUrl: v.preview_url ?? "" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}

// ── Speech-to-text (Scribe) and text-to-speech, used by Story Mode ─────────


/** ElevenLabs Scribe: English transcript with word timings; confidence = exp(logprob). */
export class ElevenLabsSpeechService implements SpeechService {
  readonly name = "elevenlabs";
  async transcribe(audio: AudioInput): Promise<Transcript> {
    const fd = new FormData();
    fd.append("model_id", "scribe_v1");
    fd.append("language_code", "en");
    fd.append("timestamps_granularity", "word");
    const ext = audio.mime.includes("mp4") ? "m4a" : audio.mime.includes("ogg") ? "ogg" : audio.mime.includes("mpeg") ? "mp3" : "webm";
    fd.append("file", new Blob([audio.data as BlobPart], { type: audio.mime }), `audio.${ext}`);
    const res = await fetch(`${API}/v1/speech-to-text`, { method: "POST", headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! }, body: fd, signal: AbortSignal.timeout(45_000) });
    if (!res.ok) throw new Error(`ElevenLabs STT ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    const j = (await res.json()) as { text?: string; words?: { text: string; start: number; end: number; type: string; logprob?: number }[] };
    const words = (j.words ?? []).filter((w) => w.type === "word").map((w) => ({ text: w.text.trim(), start: w.start, end: w.end, confidence: typeof w.logprob === "number" ? Math.exp(w.logprob) : undefined }));
    const durationS = words.length ? words[words.length - 1].end : audio.durationS;
    return { text: (j.text ?? "").trim(), words, durationS: Math.max(durationS, audio.durationS || 0) };
  }
}

/** ElevenLabs text-to-speech in a given voice (MP3, 64 kbit/s). */
export async function elevenTts(voiceId: string, text: string): Promise<{ data: Uint8Array; mime: string }> {
  const voice = voiceId || "JBFqnCBsd6RMkjVDRZzb";
  const res = await fetch(`${API}/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_64`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: "eleven_flash_v2_5" }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`ElevenLabs TTS ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  return { data: new Uint8Array(await res.arrayBuffer()), mime: "audio/mpeg" };
}
