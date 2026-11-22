import "server-only";
import type { ConversationAgentSpec, ConversationEngine, ConversationTurn, FinishedConversation, Voice } from "./types";

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

/** ElevenLabs' conversation → our shape (exported for tests). */
export function parseConversation(raw: RawConversation): FinishedConversation {
  const status = raw.status === "done" ? "done" : raw.status === "failed" ? "failed" : "processing";
  const transcript: ConversationTurn[] = (raw.transcript ?? [])
    .filter((t) => (t.role === "agent" || t.role === "user") && typeof t.message === "string" && t.message.trim())
    .map((t) => ({ role: t.role as "agent" | "user", text: t.message!.trim().slice(0, 2000), t: Math.max(0, Number(t.time_in_call_secs) || 0) }));
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

  async listVoices(): Promise<Voice[]> {
    const r = await call<{ voices?: { voice_id: string; name: string; labels?: Record<string, string>; preview_url?: string }[] }>("/v1/voices");
    return (r?.voices ?? [])
      .map((v) => ({ id: v.voice_id, name: v.name, accent: v.labels?.accent ?? "", gender: v.labels?.gender ?? "", previewUrl: v.preview_url ?? "" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}
