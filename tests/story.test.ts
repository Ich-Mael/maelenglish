import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Activity, AiUsage, ConversationAgent, ConversationSession, Course, EpisodeProgress, Module, Step, StepProgress, StoryFact, StoryProfile, Unit, User, VocabWord } from "@/models";
import { setAiServicesForTests } from "@/lib/ai";
import { FakeConversationEngine, FakeFeedbackService } from "@/lib/ai/fake";
import { usedSecondsThisMonth } from "@/lib/ai/metering";
import { cleanContent } from "@/lib/lab/content";
import { finishRolePlay, startRolePlay } from "@/lib/conversation/service";
import { getSeason, findEpisode, storyEpisodes } from "@/lib/story/content";
import { importSeason, setSeasonStatus } from "@/lib/story/admin";
import { episodeLocks, learnStates, stagesOf, currentStage, videoPassed } from "@/lib/story/progress";
import { parseStoryCtx, storyCtxId } from "@/lib/story/paths";
import { fillVars } from "@/lib/story/vars";
import { afterStoryStep, continueAnyway, creditStoryConversation, episodeSteps, grantStory, recordVideo, saveProfile, storyRolePlay, storyState, storyStep } from "@/lib/story/service";

let mongo: MongoMemoryServer;
let engine: FakeConversationEngine;
beforeAll(async () => {
  delete process.env.ELEVENLABS_API_KEY;
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).syncIndexes()));
});
afterAll(async () => {
  setAiServicesForTests(null);
  await mongoose.disconnect();
  await mongo?.stop();
});

const S = "s1-arrival";
const FILE = JSON.parse(readFileSync("scripts/seed/story-s1-accra.json", "utf8"));
let unitId = "";
let rolePlayId = "";
let lessonId = "";
let activityStepId = "";

/** A course unit (a lesson + a Lab activity) and a ready role-play, used by every episode. */
async function fixtures() {
  const c = await Course.create({ title: "Everyday English" });
  const m = await Module.create({ courseId: c._id, order: 1, title: "Arriving" });
  const u = await Unit.create({ courseId: c._id, moduleId: m._id, order: 1, title: "Introductions" });
  const match = await Activity.create({ type: "match_pairs", title: "Greetings", status: "ready", content: cleanContent("match_pairs", { pairs: [{ id: "p1", left: "Hello", right: "Bonjour" }, { id: "p2", left: "Goodbye", right: "Au revoir" }], perScreen: 4 }) });
  const lesson = await Step.create({ courseId: c._id, moduleId: m._id, unitId: u._id, position: 1, kind: "lesson", title: "Saying hello", content: {} });
  const act = await Step.create({ courseId: c._id, moduleId: m._id, unitId: u._id, position: 2, kind: "activity", title: "Greetings", activityId: match._id, lessonId: lesson._id, passScore: 60 });
  const rp = await Activity.create({
    type: "role_play",
    title: "Passport control",
    level: "A1",
    status: "ready",
    content: cleanContent("role_play", { aiRole: "an immigration officer", learnerRole: "a traveller", setting: "Passport control", goals: ["Give your name", "Explain why you came"], openingLine: "Good morning. Passport, please.", difficulty: 1, maxMinutes: 5, voiceId: "scenario-voice" }),
  });
  unitId = String(u._id);
  rolePlayId = String(rp._id);
  lessonId = String(lesson._id);
  activityStepId = String(act._id);
}

beforeEach(async () => {
  engine = new FakeConversationEngine();
  setAiServicesForTests({ feedback: new FakeFeedbackService(), conversation: engine });
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).deleteMany({})));
  await fixtures();
  // Season 1: every episode uses the unit and the role-play; 2 preview episodes, published.
  const episodes = FILE.episodes.map((e: Record<string, unknown>) => {
    const { role_play_draft: _d, ...rest } = e;
    void _d;
    return { ...rest, unit_id: unitId, conversation: { ...(e.conversation as object), role_play_id: rolePlayId }, status: "ready" };
  });
  const { id } = await importSeason({ ...FILE, episodes, free_episodes: 2, ai_minutes_included: 30 });
  await setSeasonStatus(id, "published");
});

let n = 0;
const learner = async () => {
  n++;
  return { id: String((await User.create({ name: "Awa", surname: "T", username: `awa${n}`, email: `awa${n}@example.com` }))._id), isStaff: false };
};
const AVATAR = { face: "oval", skin: 3, hair: "braids", hairColor: 0, outfit: "blazer", outfitColor: 2, glasses: false, beard: "none", earrings: true, bg: 1 };

describe("rules", () => {
  it("stages open one after another: video, learn, conversation", () => {
    expect(stagesOf(null)).toEqual({ video: "available", learn: "locked", conversation: "locked" });
    const s = stagesOf({ stageVideo: "completed" });
    expect(s.learn).toBe("available");
    expect(currentStage(s)).toBe("learn");
  });
  it("episodes unlock in order within access; unit steps one after another", () => {
    expect(episodeLocks(["a", "b", "c"], new Set(), { entitled: false, freeEpisodes: 2 })).toEqual({ a: "open", b: "locked", c: "no_access" });
    expect(learnStates(["x", "y", "z"], new Set(["x"]))).toEqual({ x: "completed", y: "open", z: "locked" });
  });
  it("video at 90 %; variables; story context ids", () => {
    expect(videoPassed(80, 100)).toBe(false);
    expect(videoPassed(91, 100)).toBe(true);
    expect(fillVars("Welcome to {city}, {learner_name}!", { city: "Accra", learner_name: "Awa", learner_job: "", learner_country: "" })).toBe("Welcome to Accra, Awa!");
    expect(parseStoryCtx(storyCtxId("s1", "ep1"))).toEqual({ storyId: "s1", episodeId: "ep1" });
    expect(parseStoryCtx("65f0c0ffee0000000000abcd")).toBeNull();
  });
});

describe("episode flow", () => {
  it("season 1 imports with its role-plays as Lab drafts", async () => {
    await mongoose.model("StorySeason").deleteMany({});
    await mongoose.model("StoryEpisode").deleteMany({});
    const before = await Activity.countDocuments({ type: "role_play", status: "draft", tags: "story" });
    await importSeason(FILE);
    expect(await Activity.countDocuments({ type: "role_play", status: "draft", tags: "story" })).toBe(before + FILE.episodes.length);
    const s = (await getSeason(S, { drafts: true }))!;
    expect(storyEpisodes(s).every((e) => e.conversation.role_play_id && !e.unit_id)).toBe(true);
    expect(s.episodeStatus["ep01-airport"]).toBe("draft"); // no unit yet
  });

  it("video → the unit's lesson and activity → a role-play by the character → episode done", async () => {
    const me = await learner();
    await saveProfile(me.id, { characterName: "Awa", job: "accountant", country: "Burkina Faso", avatar: AVATAR, pacePerWeek: 3 });
    expect((await storyState(me, S)).items.map((x) => x.lock)).toEqual(["open", "locked", "no_access"]);
    const ep = findEpisode((await getSeason(S))!, "ep01-airport")!.episode;

    expect((await recordVideo(me, S, ep.id, 0)).passed).toBe(true);

    // Learn & practise: the unit's lesson then its activity (the activity opens after the lesson).
    let steps = await episodeSteps(me, ep);
    // Back and forth: every step is open, in any order.
    expect(steps.map((s) => [s.step.kind, s.state])).toEqual([["lesson", "open"], ["activity", "open"]]);
    expect((await storyStep(me, S, ep.id, activityStepId)).current.step.kind).toBe("activity");
    await StepProgress.create({ userId: me.id, stepId: lessonId, courseId: new Types.ObjectId(), completedAt: new Date() });
    expect(await afterStoryStep(me, S, ep.id)).toBeNull();
    await StepProgress.create({ userId: me.id, stepId: activityStepId, courseId: new Types.ObjectId(), score: 80, completedAt: new Date() });
    const learnt = await afterStoryStep(me, S, ep.id);
    expect(learnt!.stages.conversation).toBe("available");
    steps = await episodeSteps(me, ep);
    expect(steps.every((s) => s.state === "completed")).toBe(true);

    // The conversation: the role-play as the officer plays it, with the character's voice.
    const rp = await storyRolePlay(me, S, ep.id);
    const officer = (await getSeason(S))!.characters.find((c) => c.id === "officer")!;
    expect((rp.activity.content as { aiRole: string }).aiRole).toContain("Officer Asante");
    expect((rp.activity.content as { voiceId: string }).voiceId).toBe(officer.voice_id);
    expect(rp.leftS).toBe(30 * 60);
    const started = await startRolePlay(me.id, { activity: rp.activity, difficulty: 1, story: { storyId: S, episodeId: ep.id, variant: rp.variant, leftS: rp.leftS } });
    const session = await ConversationSession.findById(started.sessionId);
    expect(session!.storyId).toBe(S);
    session!.providerConversationId = "conv_1";
    await session!.save();
    engine.script("conv_1", { agentId: session!.agentId, durationS: 120, transcript: [{ role: "agent", text: "Good morning. Passport, please.", t: 0 }, { role: "user", text: "Good morning, my name is Awa, I give my name.", t: 5 }, { role: "agent", text: "Why are you here?", t: 10 }, { role: "user", text: "I came here because I explain why I came: for work.", t: 15 }] });
    const done = await finishRolePlay(me.id, started.sessionId, { activity: rp.activity, waitMs: 0 });
    expect(done.status).toBe("debriefed");

    // The call used the season's minutes, not the monthly ones.
    expect((await AiUsage.findOne({ kind: "conversation" }))!.ref).toBe(`story:${S}`);
    expect(await usedSecondsThisMonth(me.id)).toBe(0);
    expect((await storyRolePlay(me, S, ep.id)).leftS).toBe(30 * 60 - 120);

    // Below the pass score: try again; at 2 attempts « Continue anyway » is allowed.
    const low = await creditStoryConversation(me, S, ep.id, 40);
    expect(low.passed).toBe(false);
    await expect(continueAnyway(me, S, ep.id, "conversation")).rejects.toThrow("once more");
    const pass = await creditStoryConversation(me, S, ep.id, 75);
    expect(pass.passed).toBe(true);
    expect(pass.episodeFinished).toBe(true);

    // Episode done: story day +1, the role-play's useful phrases in the notebook, next episode open.
    expect((await StoryProfile.findOne({ userId: me.id }))!.storyDay).toBe(2);
    expect(await StoryFact.countDocuments({ userId: me.id })).toBe(2);
    expect((await storyState(me, S)).items.map((x) => x.lock)).toEqual(["open", "open", "no_access"]);
    void VocabWord;

    await grantStory(me.id, S, me.id);
    expect((await storyState(me, S)).items[2].lock).toBe("locked");
  });

  it("a story character gets its own agent; the plain scenario keeps its own", async () => {
    const me = await learner();
    await saveProfile(me.id, { characterName: "Awa", job: "accountant", avatar: AVATAR });
    await EpisodeProgress.create({ userId: me.id, storyId: S, episodeId: "ep01-airport", stageVideo: "completed", stageLearn: "completed" });
    const rp = await storyRolePlay(me, S, "ep01-airport");
    const plain = await Activity.findById(rolePlayId).lean();
    await startRolePlay(me.id, { activity: plain!, difficulty: 1 });
    await startRolePlay(me.id, { activity: rp.activity, difficulty: 1, story: { storyId: S, episodeId: "ep01-airport", variant: rp.variant, leftS: rp.leftS } });
    await startRolePlay(me.id, { activity: plain!, difficulty: 1 });
    expect(await ConversationAgent.countDocuments({ activityId: rolePlayId })).toBe(2);
    expect(engine.deleted).toEqual([]);
  });

  it("the conversation needs the learn stage; no minutes left blocks the call", async () => {
    const me = await learner();
    await saveProfile(me.id, { characterName: "Awa", job: "accountant", avatar: AVATAR });
    await expect(storyRolePlay(me, S, "ep01-airport")).rejects.toThrow("previous step");
    await EpisodeProgress.updateOne({ userId: me.id, storyId: S, episodeId: "ep01-airport" }, { $set: { stageVideo: "completed", stageLearn: "completed" } }, { upsert: true });
    await AiUsage.create({ userId: me.id, kind: "conversation", feature: "story_roleplay", seconds: 30 * 60, ref: `story:${S}`, day: "2026-11-23", month: "2026-11" });
    const rp = await storyRolePlay(me, S, "ep01-airport");
    expect(rp.leftS).toBe(0);
    await expect(startRolePlay(me.id, { activity: rp.activity, difficulty: 1, story: { storyId: S, episodeId: "ep01-airport", variant: rp.variant, leftS: rp.leftS } })).rejects.toThrow("minutes for this season");
    // Out of minutes: the learner can go on.
    const r = await continueAnyway(me, S, "ep01-airport", "conversation");
    expect(r.episodeFinished).toBe(true);
  });
});

describe("role-play pictures", () => {
  it("keeps valid pictures (JSON from the editor) and tells the AI what's in them", async () => {
    const { rolePlayPrompt } = await import("@/lib/conversation/prompt");
    const id = String(new Types.ObjectId());
    const c = cleanContent("role_play", { aiRole: "a waiter", learnerRole: "a customer", setting: "A restaurant", goals: ["Order a meal"], openingLine: "Good evening!", images: JSON.stringify([{ mediaId: id, caption: "The menu", description: "Jollof rice 6,500 FCFA" }, { mediaId: "nope", caption: "x" }]) }) as { images: { mediaId: string; caption: string }[] };
    expect(c.images).toEqual([{ mediaId: id, caption: "The menu", description: "Jollof rice 6,500 FCFA" }]);
    expect(rolePlayPrompt(c as never, 2)).toContain("Picture 1 (The menu): Jollof rice 6,500 FCFA");
  });
});
