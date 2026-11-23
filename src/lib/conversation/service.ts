import { createHash } from "node:crypto";
import { Types } from "mongoose";
import { AppSettings, ConversationAgent, ConversationSession, type ActivityDoc, type ConversationSessionDoc } from "@/models";
import { aiServices, conversationEngine, type ConversationEngine, type ConversationTurn, type Debrief, type HelpSuggestion, type Persona, type RolePlayBrief } from "@/lib/ai";
import { recordUsage, remainingSeconds } from "@/lib/ai/metering";
import { hitRateLimit } from "@/lib/auth/service";
import { contentProblem } from "@/lib/lab/content";
import type { RolePlayContent } from "@/lib/lab/types";
import { agentSpec, clampDifficulty } from "./prompt";
import { alertIfNeeded, budgetState } from "./budget";

/*
 * AI role-play sessions (spec §5, DECISIONS.md « Conversation engine »). Framework-free, tested in
 * tests/conversation.test.ts with a fake engine.
 * 1. `startRolePlay`: checks the monthly AI minutes, finds or creates the provider agent of the
 *    scenario at that difficulty, returns a signed URL (the browser connects to ElevenLabs).
 * 2. `attachRolePlay`: the browser says which provider conversation it opened.
 * 3. `finishRolePlay`: reads the transcript from the provider (not from the browser), meters the
 *    minutes, asks Claude for the debrief (retried once; without one the transcript is still kept).
 */

export class ConversationError extends Error {}

const ESTIMATE_MICROS_PER_MINUTE = 100_000;
/** Below this the debrief would be meaningless. */
const MIN_LEARNER_TURNS = 2;
const MIN_LEARNER_WORDS = 8;

export const UNAVAILABLE = "The speaking partner isn't available yet: try again later.";

export async function loadPersona(): Promise<Persona> {
  const s = await AppSettings.findOne({ key: "global" }).select("persona").lean();
  return { tone: s?.persona?.tone ?? "", catchphrases: s?.persona?.catchphrases ?? [], tips: s?.persona?.tips ?? [] };
}

export function briefOf(activity: Pick<ActivityDoc, "title" | "level" | "content">, difficulty: number): RolePlayBrief {
  const c = activity.content as RolePlayContent;
  return { title: activity.title, aiRole: c.aiRole, learnerRole: c.learnerRole, setting: c.setting, goals: c.goals, targetPhrases: c.targetPhrases, difficulty, level: activity.level ?? "" };
}

/** Debrief scores → 0–100 (the step's score). Pronunciation isn't scored from a transcript. */
export function debriefScore(d: Debrief): number {
  const s = d.scores;
  const xs = [s.grammar, s.vocabulary, s.fluency, s.tone, s.goalCompletion].map((x) => Math.max(0, Math.min(10, Number(x) || 0)));
  return Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10);
}

const learnerWords = (t: ConversationTurn[]) => t.filter((x) => x.role === "user").reduce((n, x) => n + x.text.split(/\s+/).filter(Boolean).length, 0);
const tooShort = (t: ConversationTurn[]) => t.filter((x) => x.role === "user").length < MIN_LEARNER_TURNS || learnerWords(t) < MIN_LEARNER_WORDS;

/** The provider agent for this scenario version at this difficulty (created once, shared by learners). */
async function agentFor(engine: ConversationEngine, activity: Pick<ActivityDoc, "_id" | "title" | "level" | "content">, difficulty: number): Promise<string> {
  const spec = agentSpec(activity.title, activity.content as RolePlayContent, difficulty, activity.level ?? "");
  const key = createHash("sha256").update(`${engine.name}\n${JSON.stringify(spec)}`).digest("hex").slice(0, 40);
  const found = await ConversationAgent.findOne({ key }).lean();
  if (found) return found.agentId;
  const agentId = await engine.createAgent(spec);
  try {
    await ConversationAgent.create({ key, activityId: activity._id, difficulty, provider: engine.name, agentId });
  } catch (e) {
    // Two learners started at once: keep the first agent, drop ours.
    const winner = await ConversationAgent.findOne({ key }).lean();
    if (winner) {
      void engine.deleteAgent(agentId).catch(() => {});
      return winner.agentId;
    }
    throw e;
  }
  // Older versions of this scenario at this difficulty: no longer used.
  const stale = await ConversationAgent.find({ activityId: activity._id, difficulty, provider: engine.name, key: { $ne: key } }).lean();
  for (const a of stale) {
    await engine.deleteAgent(a.agentId).catch((err) => console.error("[roleplay] delete agent", err));
    await ConversationAgent.deleteOne({ _id: a._id });
  }
  return agentId;
}

/** Deletes every provider agent of a scenario (activity deleted). */
export async function dropAgents(activityId: string) {
  const engine = conversationEngine();
  const agents = await ConversationAgent.find({ activityId }).lean();
  for (const a of agents) {
    if (engine) await engine.deleteAgent(a.agentId).catch((err) => console.error("[roleplay] delete agent", err));
    await ConversationAgent.deleteOne({ _id: a._id });
  }
}

export type StartedRolePlay = { sessionId: string; signedUrl: string; limitS: number };

export async function startRolePlay(
  userId: string,
  input: { activity: Pick<ActivityDoc, "_id" | "title" | "level" | "type" | "content">; difficulty: unknown; courseId?: Types.ObjectId | string | null; stepId?: Types.ObjectId | string | null; preview?: boolean },
  now = new Date(),
): Promise<StartedRolePlay> {
  const engine = conversationEngine();
  if (!engine) throw new ConversationError(UNAVAILABLE);
  const { activity } = input;
  if (activity.type !== "role_play" || contentProblem("role_play", activity.content)) throw new ConversationError("This conversation isn't ready yet.");
  const c = activity.content as RolePlayContent;
  const difficulty = clampDifficulty(input.difficulty, c.difficulty);

  const rl = await hitRateLimit(`roleplay:${userId}`, 30, 24 * 3600_000);
  if (!rl.allowed) throw new ConversationError("You've started many conversations today: come back tomorrow.");
  // Calls the browser never reported finished are metered now, before checking the minutes left.
  await settleOpenSessions(userId, now);
  const left = input.preview ? Infinity : await remainingSeconds(userId, now);
  if (left < 60) throw new ConversationError("You've used your AI minutes for this month. They come back on the 1st of next month.");
  // The platform's monthly ElevenLabs budget, shared by everyone (staff previews included).
  const pool = await budgetState(now);
  if (pool.level === "stopped") throw new ConversationError("The Speaking Partner has reached its limit for this month: it comes back on the 1st.");
  const limitS = Math.floor(Math.min(c.maxMinutes * 60, left, pool.secondsLeft));

  let agentId: string;
  let signedUrl: string;
  try {
    agentId = await agentFor(engine, activity, difficulty);
    signedUrl = await engine.signedUrl(agentId);
  } catch (e) {
    console.error("[roleplay] start", e);
    throw new ConversationError(UNAVAILABLE);
  }
  const s = await ConversationSession.create({
    userId,
    activityId: activity._id,
    courseId: input.courseId ?? null,
    stepId: input.stepId ?? null,
    preview: !!input.preview,
    title: activity.title,
    difficulty,
    provider: engine.name,
    agentId,
    limitS,
    startedAt: now,
  });
  return { sessionId: String(s._id), signedUrl, limitS };
}

async function ownSession(userId: string, sessionId: string) {
  if (!Types.ObjectId.isValid(sessionId)) throw new ConversationError("Conversation not found.");
  const s = await ConversationSession.findOne({ _id: sessionId, userId });
  if (!s) throw new ConversationError("Conversation not found.");
  return s;
}

export async function attachRolePlay(userId: string, sessionId: string, conversationId: string) {
  if (!/^[\w-]{4,100}$/.test(conversationId)) throw new ConversationError("Invalid conversation.");
  const s = await ownSession(userId, sessionId);
  if (s.status !== "started" || (s.providerConversationId && s.providerConversationId !== conversationId)) throw new ConversationError("This conversation has already ended.");
  s.providerConversationId = conversationId;
  await s.save();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Reads the call, meters it and makes the debrief. Idempotent: a finished session is returned as
 * is; an ended one without a debrief (Claude failed) tries the debrief again.
 * `waitMs`: how long to wait for the provider to finish the transcript.
 */
export async function finishRolePlay(userId: string, sessionId: string, opts: { waitMs?: number; pollMs?: number; retryDelayMs?: number; activity?: Pick<ActivityDoc, "title" | "level" | "content"> | null } = {}, now = new Date()): Promise<ConversationSessionDoc> {
  const s = await ownSession(userId, sessionId);
  if (s.status === "debriefed" || s.status === "failed") return s.toObject() as ConversationSessionDoc;

  if (s.status === "started") {
    const engine = conversationEngine();
    if (!s.providerConversationId || !engine) {
      s.status = "failed";
      s.note = "The call didn't start (microphone or connection problem).";
      s.endedAt = now;
      await s.save();
      return s.toObject() as ConversationSessionDoc;
    }
    const deadline = Date.now() + (opts.waitMs ?? 20_000);
    let call = null;
    for (;;) {
      try {
        call = await engine.fetchConversation(s.providerConversationId);
      } catch (e) {
        console.error("[roleplay] fetch", e);
      }
      if ((call && call.status !== "processing") || Date.now() >= deadline) break;
      await sleep(opts.pollMs ?? 2000);
    }
    if (!call || call.agentId !== s.agentId) {
      if (!call) throw new ConversationError("The conversation is still being saved: try again in a moment.");
      s.status = "failed";
      s.note = "This call doesn't belong to this conversation.";
      await s.save();
      return s.toObject() as ConversationSessionDoc;
    }
    s.set("transcript", call.transcript);
    s.durationS = call.durationS || Math.round(call.transcript.at(-1)?.t ?? 0);
    // Real cost from the plan (price ÷ minutes in the plan) when the budget is set, else what ElevenLabs reports, else an estimate.
    const perMinute = (await budgetState(now)).microsPerMinute;
    s.costMicros = perMinute !== null ? Math.round((s.durationS / 60) * perMinute) : (call.costMicros ?? Math.round((s.durationS / 60) * ESTIMATE_MICROS_PER_MINUTE));
    s.endedAt = now;
    s.status = "ended";
    await s.save();
    if (s.durationS > 0) {
      await recordUsage(userId, { kind: "conversation", feature: "roleplay", provider: engine.name, seconds: s.durationS, costMicros: s.costMicros }, now).catch((e) => console.error("[roleplay] usage", e));
      await alertIfNeeded(now).catch((e) => console.error("[roleplay] budget alert", e));
    }
  }

  // status ended: debrief (again).
  const transcript: ConversationTurn[] = (s.transcript ?? []).map((x) => ({ role: x.role as "agent" | "user", text: x.text ?? "", t: x.t ?? 0 }));
  if (tooShort(transcript)) {
    s.note = "The conversation was too short for a debrief: speak a little more next time.";
    await s.save();
    return s.toObject() as ConversationSessionDoc;
  }
  const activity = opts.activity;
  if (!activity) throw new ConversationError("Conversation not found.");
  const input = { brief: briefOf(activity, s.difficulty ?? 2), transcript, persona: await loadPersona() };
  let debrief: Debrief | null = null;
  let lastError = "";
  for (let attempt = 0; attempt < 3 && !debrief; attempt++) {
    // Overloaded / rate-limited: wait a little before trying again (the SDK already retried quickly).
    if (attempt) await sleep(opts.retryDelayMs ?? attempt * 4000);
    try {
      const r = await aiServices().feedback.rolePlayDebrief(input);
      debrief = cleanDebrief(r.debrief, transcript, input.brief.goals);
      await recordUsage(userId, { kind: "llm", feature: "roleplay_debrief", provider: r.usage.provider, tokens: r.usage.inputTokens + r.usage.outputTokens, costMicros: r.usage.costMicros }, now).catch(() => {});
    } catch (e) {
      lastError = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      console.error(`[roleplay] debrief attempt ${attempt + 1} failed for session ${s._id}:`, e);
    }
  }
  if (!debrief) {
    s.note = "The debrief couldn't be prepared: your conversation is saved, try again in a moment.";
    s.debriefError = lastError.slice(0, 500);
    await s.save();
    return s.toObject() as ConversationSessionDoc;
  }
  s.debrief = debrief;
  s.score = debriefScore(debrief);
  s.note = "";
  s.debriefError = "";
  s.status = "debriefed";
  await s.save();
  return s.toObject() as ConversationSessionDoc;
}

/** Keeps the debrief consistent with the transcript (turn indexes on learner turns, one entry per goal). */
export function cleanDebrief(d: Debrief, transcript: ConversationTurn[], goals: string[]): Debrief {
  const clamp = (n: unknown) => Math.max(0, Math.min(10, Math.round(Number(n) || 0)));
  const isLearner = (i: number) => transcript[i]?.role === "user";
  return {
    summary: d.summary.slice(0, 1500),
    scores: { grammar: clamp(d.scores.grammar), vocabulary: clamp(d.scores.vocabulary), fluency: clamp(d.scores.fluency), pronunciation: null, tone: clamp(d.scores.tone), goalCompletion: clamp(d.scores.goalCompletion) },
    goals: goals.map((goal, i) => {
      const g = d.goals[i];
      return { goal, achieved: !!g?.achieved, evidence: (g?.evidence ?? "").slice(0, 500) };
    }),
    corrections: d.corrections
      .filter((c) => c.original && c.corrected)
      .slice(0, 10)
      .map((c) => ({ ...c, turn: isLearner(c.turn) ? c.turn : -1 })),
    betterWays: d.betterWays.filter((b) => b.original && b.improved).slice(0, 6),
    phrasesToReuse: d.phrasesToReuse.filter(Boolean).slice(0, 3),
    maelTip: d.maelTip.slice(0, 800),
  };
}

/** Sessions left « started » with a call (tab closed, connection lost): read and meter them. */
async function settleOpenSessions(userId: string, now: Date) {
  const open = await ConversationSession.find({ userId, status: "started", providerConversationId: { $ne: "" } }).select("_id activityId").limit(3).lean();
  if (!open.length) return;
  const { Activity } = await import("@/models");
  for (const o of open) {
    const activity = await Activity.findById(o.activityId).select("title level content").lean<ActivityDoc>();
    await finishRolePlay(userId, String(o._id), { waitMs: 0, activity }, now).catch((e) => console.error("[roleplay] settle", e));
  }
}

/** « Help » (AIC-01): 2–3 things to say next. The live transcript comes from the browser (only used for the suggestion). */
export async function rolePlayHelp(userId: string, sessionId: string, rawTranscript: unknown, activity: Pick<ActivityDoc, "title" | "level" | "content">, now = new Date()): Promise<HelpSuggestion[]> {
  const s = await ownSession(userId, sessionId);
  if (s.status !== "started") throw new ConversationError("This conversation has ended.");
  const rl = await hitRateLimit(`roleplay-help:${userId}`, 40, 3600_000);
  if (!rl.allowed) throw new ConversationError("Too many help requests: try on your own for a moment!");
  const transcript: ConversationTurn[] = (Array.isArray(rawTranscript) ? rawTranscript : [])
    .slice(-12)
    .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : {}))
    .filter((x) => (x.role === "agent" || x.role === "user") && typeof x.text === "string")
    .map((x) => ({ role: x.role as "agent" | "user", text: String(x.text).slice(0, 500), t: 0 }));
  try {
    const r = await aiServices().feedback.rolePlayHelp({ brief: briefOf(activity, s.difficulty ?? 2), transcript, persona: await loadPersona() });
    await ConversationSession.updateOne({ _id: s._id }, { $inc: { helpCount: 1 } });
    await recordUsage(userId, { kind: "llm", feature: "roleplay_help", provider: r.usage.provider, tokens: r.usage.inputTokens + r.usage.outputTokens, costMicros: r.usage.costMicros }, now).catch(() => {});
    return r.suggestions.map((x) => ({ en: x.en.slice(0, 200), fr: x.fr.slice(0, 200) }));
  } catch (e) {
    console.error("[roleplay] help", e);
    throw new ConversationError("Help isn't available right now.");
  }
}
