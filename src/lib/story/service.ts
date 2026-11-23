import { createHash } from "node:crypto";
import { Types } from "mongoose";
import { Activity, EpisodeProgress, Step, StepProgress, StoryAudio, StoryEntitlement, StoryFact, StoryProfile, StoryProgress, StorySeason, VocabWord, type ActivityDoc, type EpisodeProgressDoc, type StepDoc, type StoryProfileDoc } from "@/models";
import { elevenTts, isElevenLabsConfigured } from "@/lib/ai/elevenlabs";
import { recordUsage } from "@/lib/ai/metering";
import { award, type Reward } from "@/lib/gamification/service";
import { putObject, signedReadUrl } from "@/lib/storage";
import type { RolePlayContent } from "@/lib/lab/types";
import { AvatarSchema, type AvatarConfig, type Episode } from "./schema";
import { findEpisode, getSeason, storyEpisodes, type LoadedSeason } from "./content";
import { ESCAPE_AFTER, episodeDone, episodeLocks, isDone, stagesOf, videoPassed, type StageKey } from "./progress";
import { pricingSettings, voiceMinutes } from "./minutes";
import { fillVars, type StoryVars } from "./vars";

/*
 * Story Mode service (learner side). Framework-free (tests/story.test.ts). Seasons are built in
 * the admin; an episode = video → the lessons and Lab activities of an existing course unit
 * (« learn & practise », played with the regular players, progress in StepProgress) → a « Talk
 * with Coach Ish » role-play played by one of the season's characters; its debrief score proves
 * mastery (owner decision 2026-11-23). Access per season (entitlement, staff, or free preview
 * episodes). Role-play calls use the season's voice minutes. Staff preview everything (drafts,
 * all episodes open); their progress is saved for testing, no XP, no minute limit.
 */

export class StoryError extends Error {}

export type Viewer = { id: string; isStaff: boolean };
const oid = (id: string) => new Types.ObjectId(id);
/** The learner's character is one per learner, used in every season. */
const PROFILE = "default";
/** Facts about the learner everywhere; other facts belong to the season they were learnt in. */
const UNIVERSAL_FACTS = new Set(["learner_job", "learner_country", "learner_hometown", "learner_job_description"]);
export const VOICE_OUT = "Your voice minutes for this season are used up: ask your coach for more.";
/** Lab types played inside an episode (the coach-reviewed writing task and role-plays aren't). */
export const STORY_STEP_TYPES = ["listen_choose", "fill_gaps", "listen_fill_gaps", "sentence_builder", "match_pairs", "listen_match", "true_false_ng", "complete_words", "repeat_after", "dictation"] as const;

// ── Profile (the learner's character) ────────────────────────────────────

export async function getProfile(userId: string, universeId = PROFILE) {
  return StoryProfile.findOne({ userId, universeId }).lean<StoryProfileDoc>();
}

export async function saveProfile(userId: string, raw: { characterName?: unknown; job?: unknown; country?: unknown; avatar?: unknown; pacePerWeek?: unknown }, universeId = PROFILE) {
  const characterName = String(raw.characterName ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
  const job = String(raw.job ?? "").trim().slice(0, 80);
  const country = String(raw.country ?? "").trim().slice(0, 60) || "Burkina Faso";
  if (characterName.length < 2) throw new StoryError("Enter the name to use in the story.");
  if (!job) throw new StoryError("Choose your job.");
  const avatar = AvatarSchema.safeParse(raw.avatar ?? {});
  if (!avatar.success) throw new StoryError("Invalid avatar.");
  const pace = [2, 3, 5].includes(Number(raw.pacePerWeek)) ? Number(raw.pacePerWeek) : 3;
  const p = await StoryProfile.findOneAndUpdate({ userId, universeId }, { $set: { characterName, job, country, avatar: avatar.data, avatarSource: "builder", pacePerWeek: pace }, $setOnInsert: { storyDay: 1 } }, { upsert: true, returnDocument: "after" }).lean<StoryProfileDoc>();
  await setFacts(userId, [
    { key: "learner_job", value: job },
    { key: "learner_country", value: country },
  ]);
  return p!;
}

export async function setFacts(userId: string, facts: { key: string; value: string }[], sourceEpisodeId = "", seasonSlug = "") {
  for (const f of facts) {
    const key = f.key.trim().slice(0, 60);
    const value = f.value.trim().slice(0, 200);
    if (!/^[a-z0-9_]+$/.test(key) || !value) continue;
    const where = UNIVERSAL_FACTS.has(key) ? "" : seasonSlug;
    await StoryFact.updateOne({ userId, universeId: PROFILE, key: where ? `${where}.${key}` : key }, { $set: { value, seasonSlug: where, ...(sourceEpisodeId ? { sourceEpisodeId } : {}) } }, { upsert: true });
  }
}

/** Facts about the learner: the universal ones, plus this season's (all of them without a season). */
export async function listFacts(userId: string, seasonSlug?: string) {
  const rows = await StoryFact.find({ userId, universeId: PROFILE, ...(seasonSlug !== undefined ? { seasonSlug: { $in: ["", seasonSlug, null] } } : {}) }).sort({ key: 1 }).lean();
  return rows.map((f) => ({ ...f, key: f.seasonSlug ? f.key.slice(f.seasonSlug.length + 1) : f.key, storeKey: f.key }));
}
export const deleteFact = (userId: string, storeKey: string) => StoryFact.deleteOne({ userId, universeId: PROFILE, key: storeKey });

export function varsOf(u: Pick<LoadedSeason, "city">, p: Pick<StoryProfileDoc, "characterName" | "job" | "country"> | null): StoryVars {
  return { city: u.city.name, learner_name: p?.characterName ?? "", learner_job: p?.job ?? "", learner_country: p?.country ?? "" };
}

// ── Access (entitlements) ────────────────────────────────────────────────

export async function isEntitled(viewer: Viewer, storyId: string, now = new Date()) {
  if (viewer.isStaff) return true;
  const e = await StoryEntitlement.findOne({ userId: viewer.id, storyId }).lean();
  return !!e && (!e.startsAt || e.startsAt <= now) && (!e.expiresAt || e.expiresAt > now);
}

export async function grantStory(userId: string, storyId: string, by: string, opts: { expiresAt?: Date | null; extraMinutes?: number } = {}) {
  if (!(await StorySeason.exists({ slug: storyId }))) throw new StoryError("Unknown season.");
  const extra = Math.max(0, Math.round(Number(opts.extraMinutes ?? 0)) || 0);
  await StoryEntitlement.updateOne({ userId, storyId }, { $set: { source: "staff", grantedBy: oid(by), expiresAt: opts.expiresAt ?? null, startsAt: new Date(), ...(opts.extraMinutes !== undefined ? { extraMinutes: extra } : {}) } }, { upsert: true });
}
export const revokeStory = (userId: string, storyId: string) => StoryEntitlement.deleteOne({ userId, storyId });

// ── Reading the state ────────────────────────────────────────────────────

/** Season map for the learner: each episode with its lock and stages, the current episode. */
export async function storyState(viewer: Viewer, storyId: string, now = new Date()) {
  const story = await getSeason(storyId, { drafts: viewer.isStaff });
  if (!story) throw new StoryError("Season not found.");
  const episodes = storyEpisodes(story);
  const [entitled, progress, sp] = await Promise.all([isEntitled(viewer, storyId, now), EpisodeProgress.find({ userId: viewer.id, storyId }).lean<EpisodeProgressDoc[]>(), StoryProgress.findOne({ userId: viewer.id, storyId }).lean()]);
  const byId = new Map(progress.map((p) => [p.episodeId, p]));
  const done = new Set(progress.filter((p) => p.status === "completed").map((p) => p.episodeId));
  const locks = viewer.isStaff ? Object.fromEntries(episodes.map((e) => [e.id, "open" as const])) : episodeLocks(episodes.map((e) => e.id), done, { entitled, freeEpisodes: story.free_episodes });
  const items = episodes.map((e) => ({ episode: e, lock: locks[e.id], done: done.has(e.id), stages: stagesOf(byId.get(e.id)) }));
  const current = items.find((x) => x.lock === "open" && !x.done) ?? null;
  return { story, entitled, items, current, completed: !!sp?.completedAt || (items.length > 0 && items.every((x) => x.done)), recapSeen: !!sp?.recapSeen };
}

export async function openEpisode(viewer: Viewer, storyId: string, episodeId: string) {
  const st = await storyState(viewer, storyId);
  const u = st.story;
  const found = findEpisode(u, episodeId);
  if (!found) throw new StoryError("Episode not found.");
  const item = st.items.find((x) => x.episode.id === episodeId)!;
  if (item.lock === "no_access") throw new StoryError("This episode is part of the full season: ask for access on the season's page.");
  if (item.lock === "locked") throw new StoryError("Finish the previous episode first.");
  return { u, ...found, item };
}

async function progressDoc(userId: string, storyId: string, episodeId: string) {
  return EpisodeProgress.findOneAndUpdate({ userId, storyId, episodeId }, { $setOnInsert: { userId, storyId, episodeId, stageVideo: "available" } }, { upsert: true, returnDocument: "after" });
}

const STAGE_FIELD: Record<StageKey, "stageVideo" | "stageLearn" | "stageConversation"> = { video: "stageVideo", learn: "stageLearn", conversation: "stageConversation" };

function requireAvailable(p: EpisodeProgressDoc, stage: StageKey) {
  if (stagesOf(p)[stage] === "locked") throw new StoryError("Finish the previous step first.");
}

async function rewardSafe(userId: string, items: { key: string; source: string; amount: number; counters?: Record<string, number> }[]): Promise<Reward | null> {
  try {
    return await award(userId, items);
  } catch (e) {
    console.error("[story] award", e);
    return null;
  }
}

/** Marks a stage done (completed / completed_with_review); finishing the last one completes the episode. */
async function completeStage(viewer: Viewer, storyId: string, episode: Episode, stage: StageKey, state: "completed" | "completed_with_review", xp: number) {
  const p = await progressDoc(viewer.id, storyId, episode.id);
  const already = isDone(stagesOf(p)[stage]);
  if (!already || state === "completed") p.set(STAGE_FIELD[stage], state);
  await p.save();
  await StoryProgress.updateOne({ userId: viewer.id, storyId }, { $set: { currentEpisodeId: episode.id, currentStage: stage }, $setOnInsert: { startedAt: new Date(), status: "in_progress" } }, { upsert: true });
  const rewards: Reward[] = [];
  if (!viewer.isStaff && xp > 0) {
    const r = await rewardSafe(viewer.id, [{ key: `story:${storyId}:${episode.id}:${stage}`, source: "story", amount: xp }]);
    if (r) rewards.push(r);
  }
  const finished = episodeDone(stagesOf(p)) && p.status !== "completed" ? await finishEpisode(viewer, storyId, episode, p) : null;
  if (finished?.reward) rewards.push(finished.reward);
  return { stages: stagesOf(p), episodeFinished: !!finished, reward: rewards.at(-1) ?? null, storyDay: finished?.storyDay ?? null };
}

/** Episode done: story day + (first time), the role-play's useful phrases into the notebook, XP, the season's end. */
async function finishEpisode(viewer: Viewer, storyId: string, episode: Episode, p: Awaited<ReturnType<typeof progressDoc>>) {
  p.status = "completed";
  p.completedAt = new Date();
  await p.save();
  const prof = await StoryProfile.findOneAndUpdate({ userId: viewer.id, universeId: PROFILE }, { $inc: { storyDay: episode.day_increment } }, { returnDocument: "after" }).lean();
  const rp = episode.conversation.role_play_id ? await Activity.findById(episode.conversation.role_play_id).select("content").lean<ActivityDoc>() : null;
  for (const phrase of ((rp?.content as RolePlayContent | undefined)?.targetPhrases ?? []).slice(0, 8)) await savePhrase(viewer.id, { en: phrase, fr: "", storyRef: `${storyId}/${episode.id}`, situation: episode.situation });
  const story = await getSeason(storyId, { drafts: viewer.isStaff });
  const all = story ? storyEpisodes(story) : [];
  const doneCount = await EpisodeProgress.countDocuments({ userId: viewer.id, storyId, status: "completed" });
  if (doneCount >= all.length) await StoryProgress.updateOne({ userId: viewer.id, storyId }, { $set: { status: "completed", completedAt: new Date() } });
  const reward = viewer.isStaff ? null : await rewardSafe(viewer.id, [{ key: `story-episode:${storyId}:${episode.id}`, source: "story", amount: 10 }]);
  return { reward, storyDay: prof?.storyDay ?? null };
}

// ── Scenes and video ─────────────────────────────────────────────────────

export async function markIntroSeen(viewer: Viewer, storyId: string, episodeId: string) {
  await openEpisode(viewer, storyId, episodeId);
  await EpisodeProgress.updateOne({ userId: viewer.id, storyId, episodeId }, { $set: { introSeen: true }, $setOnInsert: { stageVideo: "available" } }, { upsert: true });
  await StoryProgress.updateOne({ userId: viewer.id, storyId }, { $set: { currentEpisodeId: episodeId }, $setOnInsert: { startedAt: new Date(), status: "in_progress" } }, { upsert: true });
}

export async function markRecapSeen(viewer: Viewer, storyId: string) {
  await StoryProgress.updateOne({ userId: viewer.id, storyId }, { $set: { recapSeen: true }, $setOnInsert: { startedAt: new Date(), status: "in_progress" } }, { upsert: true });
}

export async function recordVideo(viewer: Viewer, storyId: string, episodeId: string, maxSeconds: number) {
  const { episode } = await openEpisode(viewer, storyId, episodeId);
  const p = await progressDoc(viewer.id, storyId, episodeId);
  p.videoMaxSeconds = Math.max(p.videoMaxSeconds ?? 0, Math.max(0, Math.round(Number(maxSeconds) || 0)));
  await p.save();
  const v = episode.video;
  // Only video files can be tracked; YouTube / Vimeo (and « coming soon ») pass with « I've watched it ».
  const passed = v.provider !== "file" || !v.url || videoPassed(p.videoMaxSeconds, v.duration_seconds, v.completion_threshold);
  if (!passed) return { passed: false, stages: stagesOf(p), reward: null, episodeFinished: false, storyDay: null };
  return { passed: true, ...(await completeStage(viewer, storyId, episode, "video", "completed", 5)) };
}

// ── Learn & practise: the unit's lessons and Lab activities ──────────────

export type EpisodeStep = { step: StepDoc; activity: ActivityDoc | null; state: "completed" | "open" | "locked"; score: number | null };

/** The unit's lessons and playable Lab activities (ready), in order, with the learner's progress. */
export async function episodeSteps(viewer: Viewer, episode: Pick<Episode, "unit_id">): Promise<EpisodeStep[]> {
  if (!episode.unit_id || !Types.ObjectId.isValid(episode.unit_id)) return [];
  const steps = await Step.find({ unitId: episode.unit_id, kind: { $in: ["lesson", "activity"] } }).sort({ position: 1 }).lean<StepDoc[]>();
  const acts = await Activity.find({ _id: { $in: steps.flatMap((s) => (s.activityId ? [s.activityId] : [])) } }).lean<ActivityDoc[]>();
  const playable = steps.flatMap((s): { step: StepDoc; activity: ActivityDoc | null }[] => {
    if (s.kind === "lesson") return [{ step: s, activity: null }];
    const a = acts.find((x) => String(x._id) === String(s.activityId));
    return a && a.status === "ready" && (STORY_STEP_TYPES as readonly string[]).includes(a.type) ? [{ step: s, activity: a }] : [];
  });
  const progress = await StepProgress.find({ userId: viewer.id, stepId: { $in: playable.map((x) => x.step._id) } }).select("stepId score").lean();
  const done = new Set(progress.map((p) => String(p.stepId)));
  // Learners move back and forth freely between the lessons and activities (owner request 2026-11-23).
  return playable.map((x) => ({ ...x, state: done.has(String(x.step._id)) ? ("completed" as const) : ("open" as const), score: progress.find((p) => String(p.stepId) === String(x.step._id))?.score ?? null }));
}

/** A unit step opened from an episode (the episode must be open; its steps can be taken in any order). */
export async function storyStep(viewer: Viewer, storyId: string, episodeId: string, stepId: string) {
  const ctx = await openEpisode(viewer, storyId, episodeId);
  const steps = await episodeSteps(viewer, ctx.episode);
  const at = steps.findIndex((s) => String(s.step._id) === stepId);
  if (at < 0) throw new StoryError("Activity not found.");
  return { ...ctx, steps, at, current: steps[at] };
}

/** After a unit step was saved from an episode: every step done → the « learn » stage is complete. */
export async function afterStoryStep(viewer: Viewer, storyId: string, episodeId: string) {
  const { episode } = await openEpisode(viewer, storyId, episodeId);
  const steps = await episodeSteps(viewer, episode);
  if (steps.length && steps.every((s) => s.state === "completed")) return completeStage(viewer, storyId, episode, "learn", "completed", 5);
  return null;
}

// ── The conversation: a Talk with Coach Ish role-play played by a character ──

/**
 * The role-play of an episode as its character plays it (name, role, personality and speaking
 * style; the character's voice; the season's city), with the seconds left in the season's pot.
 */
export async function storyRolePlay(viewer: Viewer, storyId: string, episodeId: string) {
  const { u, episode } = await openEpisode(viewer, storyId, episodeId);
  const p = await progressDoc(viewer.id, storyId, episodeId);
  if (!viewer.isStaff) requireAvailable(p, "conversation");
  const id = episode.conversation.role_play_id;
  const activity = id ? await Activity.findById(id).lean<ActivityDoc>() : null;
  if (!activity || activity.type !== "role_play" || (!viewer.isStaff && activity.status !== "ready")) throw new StoryError("This conversation isn't ready yet.");
  const npc = u.characters.find((c) => c.id === episode.conversation.npc) ?? null;
  const c = activity.content as RolePlayContent;
  const content: RolePlayContent = npc
    ? {
        ...c,
        aiRole: `${npc.name}, ${npc.role}${npc.personality ? `. Personality: ${npc.personality}` : ""}${npc.speaking_style ? `. Speaking style: ${npc.speaking_style}` : ""}`,
        setting: u.city.name && !c.setting.includes(u.city.name) ? `${c.setting} (in ${u.city.name}${u.city.country ? `, ${u.city.country}` : ""})` : c.setting,
        voiceId: npc.voice_id || c.voiceId,
        voiceName: npc.voice_name || c.voiceName,
      }
    : c;
  const vm = await voiceMinutes(viewer, u);
  return { season: u, episode, npc, activity: { ...activity, content } as ActivityDoc, variant: npc ? `story:${u.id}:${npc.id}` : "", leftS: vm ? vm.leftS : null, passScore: episode.conversation.pass_score };
}

/** A debriefed call of the episode's role-play: attempts, best score; at the pass score the conversation stage is complete. */
export async function creditStoryConversation(viewer: Viewer, storyId: string, episodeId: string, score: number) {
  const { episode } = await openEpisode(viewer, storyId, episodeId);
  const p = await progressDoc(viewer.id, storyId, episodeId);
  p.conversationAttempts = (p.conversationAttempts ?? 0) + 1;
  p.conversationBestScore = Math.max(p.conversationBestScore ?? 0, score);
  await p.save();
  const passed = score >= episode.conversation.pass_score;
  const base = { passed, passScore: episode.conversation.pass_score, attempts: p.conversationAttempts, canContinueAnyway: !passed && p.conversationAttempts >= ESCAPE_AFTER.conversation };
  if (!passed) return { ...base, stages: stagesOf(p), reward: null, episodeFinished: false, storyDay: null };
  return { ...base, ...(await completeStage(viewer, storyId, episode, "conversation", "completed", 15)) };
}

/** « Continue anyway »: the conversation after 2 attempts below the pass score, or when the voice minutes are used up. */
export async function continueAnyway(viewer: Viewer, storyId: string, episodeId: string, stage: StageKey) {
  const { u, episode } = await openEpisode(viewer, storyId, episodeId);
  const p = await progressDoc(viewer.id, storyId, episodeId);
  requireAvailable(p, stage);
  if (stage !== "conversation") throw new StoryError("This step completes on its own.");
  const voiceOut = ((await voiceMinutes(viewer, u))?.leftS ?? Infinity) < 60;
  if (!voiceOut && (p.conversationAttempts ?? 0) < ESCAPE_AFTER.conversation) throw new StoryError("Try once more first.");
  return completeStage(viewer, storyId, episode, stage, "completed_with_review", 3);
}

// ── Audio (scene lines) ──────────────────────────────────────────────────

/** TTS once per hash(voice + text), stored in R2; returns a signed URL. Null without ElevenLabs. */
export async function ttsCached(voiceId: string, text: string): Promise<{ url: string; key: string; fresh: boolean; bytes: number } | null> {
  const t = text.trim();
  if (!t) return null;
  const hash = createHash("sha256").update(`${voiceId}\n${t}`).digest("hex").slice(0, 40);
  const hit = await StoryAudio.findOne({ hash }).lean();
  if (hit) return { url: await signedReadUrl(hit.key), key: hit.key, fresh: false, bytes: 0 };
  if (!isElevenLabsConfigured()) return null;
  const audio = await elevenTts(voiceId, t);
  const key = `courses_audios/story/${hash.slice(0, 2)}/${new Types.ObjectId().toString()}.mp3`;
  await putObject(key, audio.data, audio.mime);
  await StoryAudio.create({ hash, key, chars: t.length }).catch(() => {});
  return { url: await signedReadUrl(key), key, fresh: true, bytes: audio.data.length };
}

/** A scene line in its character's voice: `ref` = intro:<i> | outro:<i> | recap:<i> (only content can be voiced). */
export async function contentAudio(viewer: Viewer, storyId: string, episodeId: string, ref: string): Promise<string | null> {
  const { u, episode, story } = await openEpisode(viewer, storyId, episodeId);
  const prof = await getProfile(viewer.id);
  const vars = varsOf(u, prof);
  const voiceOf = (speaker: string) => u.characters.find((c) => c.id === speaker)?.voice_id ?? u.characters.find((c) => c.id === "narrator")?.voice_id ?? "";
  const [kind, arg] = ref.split(":");
  if (kind !== "intro" && kind !== "outro" && kind !== "recap") return null;
  const lines = (kind === "intro" ? episode.intro_scene : kind === "outro" ? episode.outro_scene : story.recap_scene).lines;
  const line = lines[Number(arg)];
  if (!line?.text_en) return null;
  if (line.audio && line.audio !== "auto") return line.audio;
  const text = fillVars(line.text_en, vars);
  const r = await ttsCached(voiceOf(line.speaker), text);
  // Shared content audio: a content cost of the season (not the learner's voice minutes).
  if (r?.fresh) {
    const pricing = await pricingSettings();
    await recordUsage(viewer.id, { kind: "tts", feature: "story_audio", provider: "elevenlabs", costMicros: Math.round((text.length / 1000) * pricing.ttsUsdPerKChar * 1e6), ref: `story-content:${storyId}` }).catch(() => {});
  }
  return r?.url ?? null;
}

// ── Notebook (shared with « The Vocabulary I Need ») ──────────────────────

/** A phrase into the learner's notebook (one notebook: The Vocabulary I Need), first review the next day. */
export async function savePhrase(userId: string, p: { en: string; fr: string; storyRef: string; situation: string }) {
  const display = p.en.replace(/\s+/g, " ").trim().slice(0, 150);
  if (!display) return;
  const key = display.toLowerCase();
  await VocabWord.updateOne(
    { userId, word: key },
    { $setOnInsert: { userId, word: key, display, kind: "phrase", translation: p.fr.slice(0, 200), context: "", source: "story", storyRef: p.storyRef, situation: p.situation, stage: 0, dueAt: new Date(Date.now() + 86_400_000) } },
    { upsert: true },
  );
}

export type { AvatarConfig };
