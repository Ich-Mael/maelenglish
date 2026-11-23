import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Activity, AiUsage, AppSettings, ConversationAgent, ConversationSession, DigestLog, User, type ActivityDoc } from "@/models";
import { alertIfNeeded, budgetState, microsPerMinute, saveBudget } from "@/lib/conversation/budget";
import { cleanContent, contentProblem } from "@/lib/lab/content";
import { setAiServicesForTests, type Debrief, type FeedbackService } from "@/lib/ai";
import { FakeConversationEngine, FakeFeedbackService } from "@/lib/ai/fake";
import { agentBody, parseConversation } from "@/lib/ai/elevenlabs";
import { agentSpec, rolePlayPrompt } from "@/lib/conversation/prompt";
import { attachRolePlay, cleanDebrief, debriefScore, finishRolePlay, rolePlayHelp, startRolePlay } from "@/lib/conversation/service";
import type { RolePlayContent } from "@/lib/lab/types";

let mongo: MongoMemoryServer;
let engine: FakeConversationEngine;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).syncIndexes()));
});
afterAll(async () => {
  setAiServicesForTests(null);
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  engine = new FakeConversationEngine();
  setAiServicesForTests({ feedback: new FakeFeedbackService(), conversation: engine });
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).deleteMany({})));
});

const content = cleanContent("role_play", {
  situation: "<p>Entretien RH</p>",
  aiRole: "HR manager at an international NGO",
  learnerRole: "Candidate for a Project Officer position",
  setting: "Video call, first-round interview",
  goals: "Introduce yourself in under 60 seconds\nExplain your motivation for the role",
  targetPhrases: "I have X years of experience in...\nWhat attracted me to this role is...",
  twists: "Ask about a gap in the CV",
  openingLine: "Hello, thanks for joining. Can you hear me well?",
  difficulty: "2",
  maxMinutes: "5",
}) as RolePlayContent;

const scenario = () => Activity.create({ type: "role_play", title: "HR screening interview", level: "B1", status: "ready", content }).then((a) => a.toObject() as ActivityDoc);
const learner = () => User.create({ name: "Awa", surname: "T", username: "awa", email: "awa@example.com" }).then((u) => String(u._id));

const talk = [
  { role: "agent" as const, text: "Hello, thanks for joining. Can you hear me well?", t: 0 },
  { role: "user" as const, text: "Yes, I hear you well. My name is Awa, I have five years of experience in project management.", t: 4 },
  { role: "agent" as const, text: "Great. Why this role?", t: 12 },
  { role: "user" as const, text: "My motivation is to help communities, and I am agree with your mission.", t: 15 },
];

describe("role-play scenario content and prompt", () => {
  it("cleans the content and requires roles, setting, a goal and the opening line", () => {
    expect([content.goals.length, content.twists, content.difficulty, content.maxMinutes]).toEqual([2, ["Ask about a gap in the CV"], 2, 5]);
    expect(contentProblem("role_play", content)).toBeNull();
    expect(contentProblem("role_play", { ...content, goals: [] })).toMatch(/goal/);
    expect(cleanContent("role_play", { difficulty: "9", maxMinutes: "60", voiceId: "a b<c>" })).toMatchObject({ difficulty: 2, maxMinutes: 5, voiceId: "abc" });
  });

  it("builds a prompt whose behaviour changes with difficulty, and a deterministic agent spec", () => {
    const easy = rolePlayPrompt(content, 1, "A2");
    const hard = rolePlayPrompt(content, 5, "A2");
    expect(easy).toMatch(/slowly/);
    expect(hard).toMatch(/interrupt/);
    expect(easy).toMatch(/Do NOT correct/);
    expect(easy).toContain("Ask about a gap in the CV");
    expect(agentSpec("T", content, 1).speed).toBeLessThan(agentSpec("T", content, 5).speed);
    expect(agentSpec("T", content, 3)).toEqual(agentSpec("T", content, 3));
    const body = agentBody(agentSpec("T", content, 3));
    expect(body.platform_settings.auth.enable_auth).toBe(true);
    expect(body.conversation_config.agent.prompt.llm).toBe("claude-haiku-5-5");
  });

  it("parses an ElevenLabs conversation", () => {
    const c = parseConversation({ agent_id: "a1", status: "done", transcript: [{ role: "agent", message: "Hi", time_in_call_secs: 0 }, { role: "user", message: null }, { role: "user", message: " Hello ", time_in_call_secs: 3 }], metadata: { call_duration_secs: 42.4, cost_fiat: 0.07 } });
    expect(c).toEqual({ status: "done", agentId: "a1", transcript: [{ role: "agent", text: "Hi", t: 0 }, { role: "user", text: "Hello", t: 3 }], durationS: 42, costMicros: 70000 });
    expect(parseConversation({ status: "in-progress" }).status).toBe("processing");
    // Audio tags are for the voice only.
    expect(parseConversation({ status: "done", transcript: [{ role: "agent", message: "[friendly] Hello, [laughs] yes!" }, { role: "agent", message: "[sighs]" }] }).transcript).toEqual([{ role: "agent", text: "Hello, yes!", t: 0 }]);
  });
});

describe("role-play sessions", () => {
  it("starts with a signed URL, reuses the agent, and makes a new one when the scenario changes", async () => {
    const [u, a] = [await learner(), await scenario()];
    const s1 = await startRolePlay(u, { activity: a, difficulty: 2 });
    expect(s1.signedUrl).toMatch(/^wss:/);
    expect(s1.limitS).toBe(300);
    await startRolePlay(u, { activity: a, difficulty: 2 });
    expect(engine.agents.size).toBe(1);
    await startRolePlay(u, { activity: a, difficulty: 4 });
    expect(engine.agents.size).toBe(2);
    const changed = { ...a, content: { ...content, openingLine: "Good morning!" } };
    await startRolePlay(u, { activity: changed, difficulty: 2 });
    expect(engine.deleted).toHaveLength(1); // the old level-2 agent
    expect(await ConversationAgent.countDocuments()).toBe(2);
  });

  it("checks the monthly minutes (limits the call to what's left)", async () => {
    const [u, a] = [await learner(), await scenario()];
    await AppSettings.create({ key: "global", aiMonthlyMinutes: 3 });
    expect((await startRolePlay(u, { activity: a, difficulty: 2 })).limitS).toBe(180);
    await AiUsage.create({ userId: u, kind: "conversation", seconds: 150, day: "2026-11-22", month: "2026-11" });
    await expect(startRolePlay(u, { activity: a, difficulty: 2 }, new Date("2026-11-22T12:00:00Z"))).rejects.toThrow(/AI minutes/);
    // Staff preview isn't capped.
    expect((await startRolePlay(u, { activity: a, difficulty: 2, preview: true }, new Date("2026-11-22T12:00:00Z"))).limitS).toBe(300);
  });

  it("finishes: reads the provider transcript, meters it and stores the debrief", async () => {
    const [u, a] = [await learner(), await scenario()];
    const s = await startRolePlay(u, { activity: a, difficulty: 2 });
    const agentId = (await ConversationSession.findById(s.sessionId))!.agentId;
    await attachRolePlay(u, s.sessionId, "conv_123");
    await expect(attachRolePlay(u, s.sessionId, "conv_other")).rejects.toThrow(/ended/);
    engine.script("conv_123", { agentId, transcript: talk, durationS: 95, costMicros: null });
    const done = await finishRolePlay(u, s.sessionId, { activity: a, waitMs: 0 });
    expect(done.status).toBe("debriefed");
    const d = done.debrief as Debrief;
    expect(d.goals.map((g) => g.achieved)).toEqual([false, true]);
    expect(d.corrections[0]).toMatchObject({ turn: 3, corrected: "I agree" });
    expect(done.score).toBe(debriefScore(d));
    expect(await AiUsage.findOne({ userId: u, kind: "conversation" }).lean()).toMatchObject({ seconds: 95, costMicros: Math.round((95 / 60) * 100_000) });
    // Idempotent.
    expect((await finishRolePlay(u, s.sessionId, { activity: a })).status).toBe("debriefed");
    expect(await AiUsage.countDocuments({ kind: "conversation" })).toBe(1);
  });

  it("refuses a call from another agent, fails without a call, keeps a too-short call without debrief", async () => {
    const [u, a] = [await learner(), await scenario()];
    const s = await startRolePlay(u, { activity: a, difficulty: 2 });
    await attachRolePlay(u, s.sessionId, "conv_x");
    engine.script("conv_x", { agentId: "someone_else", transcript: talk, durationS: 60 });
    expect((await finishRolePlay(u, s.sessionId, { activity: a, waitMs: 0 })).status).toBe("failed");

    const s2 = await startRolePlay(u, { activity: a, difficulty: 2 });
    expect((await finishRolePlay(u, s2.sessionId, { activity: a })).note).toMatch(/didn't start/);

    const s3 = await startRolePlay(u, { activity: a, difficulty: 2 });
    const agentId = (await ConversationSession.findById(s3.sessionId))!.agentId;
    await attachRolePlay(u, s3.sessionId, "conv_short");
    engine.script("conv_short", { agentId, transcript: talk.slice(0, 2), durationS: 10 });
    const short = await finishRolePlay(u, s3.sessionId, { activity: a, waitMs: 0 });
    expect([short.status, short.debrief]).toEqual(["ended", null]);
    expect(short.note).toMatch(/too short/);
  });

  it("keeps the transcript when the debrief fails, and retries it later", async () => {
    const [u, a] = [await learner(), await scenario()];
    const s = await startRolePlay(u, { activity: a, difficulty: 2 });
    const agentId = (await ConversationSession.findById(s.sessionId))!.agentId;
    await attachRolePlay(u, s.sessionId, "conv_9");
    engine.script("conv_9", { agentId, transcript: talk, durationS: 60 });
    const fake = new FakeFeedbackService();
    let calls = 0;
    const flaky: FeedbackService = Object.assign(Object.create(fake), { rolePlayDebrief: async () => (calls++, Promise.reject(new Error("down"))) });
    setAiServicesForTests({ feedback: flaky, conversation: engine });
    const first = await finishRolePlay(u, s.sessionId, { activity: a, waitMs: 0, retryDelayMs: 0 });
    expect([first.status, calls, first.transcript.length]).toEqual(["ended", 3, 4]);
    expect(first.debriefError).toMatch(/down/);
    setAiServicesForTests({ feedback: fake, conversation: engine });
    expect((await finishRolePlay(u, s.sessionId, { activity: a })).status).toBe("debriefed");
  });

  it("meters a call the browser never finished when the learner starts the next one", async () => {
    const [u, a] = [await learner(), await scenario()];
    const s = await startRolePlay(u, { activity: a, difficulty: 2 });
    const agentId = (await ConversationSession.findById(s.sessionId))!.agentId;
    await attachRolePlay(u, s.sessionId, "conv_lost");
    engine.script("conv_lost", { agentId, transcript: talk, durationS: 120 });
    await startRolePlay(u, { activity: a, difficulty: 2 });
    expect(await AiUsage.countDocuments({ userId: u, kind: "conversation" })).toBe(1);
    expect((await ConversationSession.findById(s.sessionId))!.status).toBe("debriefed");
  });

  it("gives help suggestions during the call only", async () => {
    const [u, a] = [await learner(), await scenario()];
    const s = await startRolePlay(u, { activity: a, difficulty: 2 });
    const tips = await rolePlayHelp(u, s.sessionId, [{ role: "agent", text: "Why this role?" }, { role: "bogus", text: 1 }], a);
    expect(tips[0]).toEqual({ en: "I have X years of experience in...", fr: "[FR] I have X years of experience in..." });
    expect((await ConversationSession.findById(s.sessionId))!.helpCount).toBe(1);
    await expect(rolePlayHelp(String(new Types.ObjectId()), s.sessionId, [], a)).rejects.toThrow(/not found/);
  });

  it("cleans a debrief: goals follow the scenario, corrections point at learner turns", () => {
    const d = cleanDebrief(
      { summary: "ok", scores: { grammar: 12, vocabulary: 5, fluency: -1, pronunciation: 3, tone: 7, goalCompletion: 5 }, goals: [{ goal: "x", achieved: true, evidence: "e" }], corrections: [{ turn: 0, original: "a", corrected: "b", explanation: "", category: "grammar" }], betterWays: [], phrasesToReuse: ["a", "b", "c", "d"], maelTip: "t" },
      talk,
      ["G1", "G2"],
    );
    expect(d.scores).toEqual({ grammar: 10, vocabulary: 5, fluency: 0, pronunciation: null, tone: 7, goalCompletion: 5 });
    expect(d.goals).toEqual([{ goal: "G1", achieved: true, evidence: "e" }, { goal: "G2", achieved: false, evidence: "" }]);
    expect(d.corrections[0].turn).toBe(-1);
    expect(d.phrasesToReuse).toHaveLength(3);
  });
});

describe("Speaking Partner budget (shared ElevenLabs plan)", () => {
  const month = (d: Date) => d.toISOString().slice(0, 7);
  const use = (userId: string, seconds: number, now: Date) => AiUsage.create({ userId, kind: "conversation", seconds, day: now.toISOString().slice(0, 10), month: month(now) });

  it("validates and computes the pool and the real cost of a minute", async () => {
    await expect(saveBudget({ planCredits: "600000", warnPercent: 95, stopPercent: 80 })).rejects.toThrow(/before the stop/);
    const b = await saveBudget({ planCredits: "600 000", creditsPerMinute: "455", planPriceUsd: "37.13", warnPercent: "80", stopPercent: "95" });
    expect(b.planCredits).toBe(600000);
    expect(microsPerMinute(b)).toBe(Math.round((37.13 * 1e6 * 455) / 600000)); // ≈ $0.028
    expect((await budgetState()).poolMinutes).toBeCloseTo(600000 / 455);
    await saveBudget({ planCredits: "0" });
    expect((await budgetState()).level).toBe("off");
  });

  it("limits calls to the pool, warns admins once, then refuses new calls", async () => {
    const now = new Date("2026-11-22T12:00:00Z");
    const [u, a] = [await learner(), await scenario()];
    await User.create({ name: "Admin", surname: "A", username: "boss", email: "boss@example.com", role: "admin" });
    await AppSettings.create({ key: "global", aiMonthlyMinutes: 1000 });
    await saveBudget({ planCredits: "4550", creditsPerMinute: "455", warnPercent: "50", stopPercent: "90" }); // 10-minute pool, stop at 9
    expect((await startRolePlay(u, { activity: a, difficulty: 2 }, now)).limitS).toBe(300);
    await use(u, 6 * 60, now); // 6 min: warn
    expect((await budgetState(now)).level).toBe("warn");
    expect((await startRolePlay(u, { activity: a, difficulty: 2 }, now)).limitS).toBe(180); // 3 min left before the stop
    await alertIfNeeded(now);
    await alertIfNeeded(now);
    expect(await DigestLog.countDocuments({ key: "ai-budget-warn:2026-11" })).toBe(1);
    await use(u, 3 * 60, now); // 9 min: stopped
    await expect(startRolePlay(u, { activity: a, difficulty: 2 }, now)).rejects.toThrow(/limit for this month/);
    await expect(startRolePlay(u, { activity: a, difficulty: 2, preview: true }, now)).rejects.toThrow(/limit for this month/);
  });

  it("costs a call at the plan's real price per minute", async () => {
    await saveBudget({ planCredits: "600000", creditsPerMinute: "455", planPriceUsd: "37.13" });
    const [u, a] = [await learner(), await scenario()];
    const s = await startRolePlay(u, { activity: a, difficulty: 2 });
    const agentId = (await ConversationSession.findById(s.sessionId))!.agentId;
    await attachRolePlay(u, s.sessionId, "conv_cost");
    engine.script("conv_cost", { agentId, transcript: talk, durationS: 120, costMicros: 999_999 });
    const done = await finishRolePlay(u, s.sessionId, { activity: a, waitMs: 0 });
    expect(done.costMicros).toBe(Math.round(2 * Math.round((37.13 * 1e6 * 455) / 600000)));
  });
});
