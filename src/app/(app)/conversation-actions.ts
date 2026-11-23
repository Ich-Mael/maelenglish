"use server";

import { Types } from "mongoose";
import { refresh } from "next/cache";
import { after } from "next/server";
import { storeConversationAudio } from "@/lib/conversation/recording";
import { readCurrentUser, type CurrentUser } from "@/lib/auth/dal";
import { courseAccess, courseTree } from "@/lib/learn/queries";
import { allSteps } from "@/lib/learn/progress";
import { Activity, ConversationSession, Enrollment, StepProgress, accessState, type ActivityDoc } from "@/models";
import { award, type AwardInput, type Reward } from "@/lib/gamification/service";
import { XP, dayKey, practiceXp } from "@/lib/gamification/rules";
import { ConversationError, attachRolePlay, finishRolePlay, rolePlayHelp, startRolePlay } from "@/lib/conversation/service";
import type { HelpSuggestion } from "@/lib/ai/types";
import { toFinished, type FinishedRolePlay } from "@/lib/conversation/view";
import { remainingSeconds } from "@/lib/ai/metering";

/*
 * AI role-play (Talk with Coach Ish page, unit activity steps, Lab preview). Every action re-checks the
 * session and the access: a step must be open in the learner's progression; from the Speaking
 * Partner page any « ready » role-play, for learners with an active enrolment and for staff.
 * Staff sessions are marked `preview` (not capped, never progress).
 */

type Where = { activityId: string; courseId?: string | null; stepId?: string | null };
type Allowed = { me: CurrentUser; activity: ActivityDoc; courseId: Types.ObjectId | null; stepId: Types.ObjectId | null; preview: boolean };

async function allowed(where: Where): Promise<Allowed> {
  const me = await readCurrentUser();
  if (!me) throw new ConversationError("Your session has expired: sign in again.");
  if (!Types.ObjectId.isValid(where.activityId)) throw new ConversationError("Conversation not found.");

  if (where.courseId && where.stepId) {
    const access = await courseAccess(me, where.courseId);
    if (!access.ok) throw new ConversationError("You don't have access to this course.");
    if (access.readOnly) throw new ConversationError("This course has ended: you can still view it, but nothing is saved any more.");
    const tree = await courseTree(me, access);
    const outline = allSteps(tree.outline).find((s) => s.id === where.stepId);
    const step = tree.steps.find((s) => String(s._id) === where.stepId);
    if (!outline || !step || step.kind !== "activity" || String(step.activityId) !== where.activityId) throw new ConversationError("Activity not found.");
    if (outline.state === "locked") throw new ConversationError("Finish the previous activity first.");
    const activity = tree.activities.find((a) => String(a._id) === where.activityId) as ActivityDoc | undefined;
    if (!activity || activity.type !== "role_play") throw new ConversationError("Activity not found.");
    return { me, activity, courseId: step.courseId, stepId: step._id, preview: access.preview };
  }

  const activity = await Activity.findById(where.activityId).lean<ActivityDoc>();
  if (!activity || activity.type !== "role_play") throw new ConversationError("Conversation not found.");
  if (!me.isStaff) {
    if (activity.status !== "ready") throw new ConversationError("Conversation not found.");
    const enrolments = await Enrollment.find({ userId: me.id }).select("status startDate endDate").lean();
    if (!enrolments.some((e) => accessState(e) === "active")) throw new ConversationError("Talk with Coach Ish is for learners with an active course.");
  }
  return { me, activity, courseId: null, stepId: null, preview: me.isStaff };
}

const fail = (e: unknown) => ({ ok: false as const, error: e instanceof ConversationError ? e.message : "Something went wrong: try again in a moment." });

export async function startRolePlayAction(where: Where, difficulty: number): Promise<{ ok: true; sessionId: string; signedUrl: string; limitS: number } | { ok: false; error: string }> {
  try {
    const a = await allowed(where);
    const r = await startRolePlay(a.me.id, { activity: a.activity, difficulty, courseId: a.courseId, stepId: a.stepId, preview: a.preview });
    return { ok: true, ...r };
  } catch (e) {
    if (!(e instanceof ConversationError)) console.error("[roleplay] start action", e);
    return fail(e);
  }
}

export async function attachRolePlayAction(sessionId: string, conversationId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const me = await readCurrentUser();
    if (!me) throw new ConversationError("Your session has expired: sign in again.");
    await attachRolePlay(me.id, sessionId, conversationId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function rolePlayHelpAction(sessionId: string, transcript: { role: string; text: string }[]): Promise<{ ok: true; suggestions: HelpSuggestion[] } | { ok: false; error: string }> {
  try {
    const me = await readCurrentUser();
    if (!me) throw new ConversationError("Your session has expired: sign in again.");
    const s = Types.ObjectId.isValid(sessionId) ? await ConversationSession.findOne({ _id: sessionId, userId: me.id }).select("activityId").lean() : null;
    const activity = s ? await Activity.findById(s.activityId).select("title level content").lean<ActivityDoc>() : null;
    if (!activity) throw new ConversationError("Conversation not found.");
    return { ok: true, suggestions: await rolePlayHelp(me.id, sessionId, transcript, activity) };
  } catch (e) {
    return fail(e);
  }
}

/**
 * The call is over (or the learner retries the debrief): transcript, minutes and debrief. A
 * debriefed unit step is completed (best score kept) and earns XP once (a replay the same day: 5).
 */
export async function finishRolePlayAction(sessionId: string): Promise<{ ok: true; result: FinishedRolePlay } | { ok: false; error: string }> {
  try {
    const me = await readCurrentUser();
    if (!me) throw new ConversationError("Your session has expired: sign in again.");
    const own = Types.ObjectId.isValid(sessionId) ? await ConversationSession.findOne({ _id: sessionId, userId: me.id }).select("activityId courseId stepId status preview").lean() : null;
    if (!own) throw new ConversationError("Conversation not found.");
    const activity = await Activity.findById(own.activityId).select("title level content type").lean<ActivityDoc>();
    const wasDebriefed = own.status === "debriefed";
    const s = await finishRolePlay(me.id, sessionId, { activity });
    // The call's recording is copied to our storage after the response (ElevenLabs may need a moment).
    if (s.providerConversationId && !s.audioMediaId) after(() => storeConversationAudio(sessionId).then(() => undefined).catch((e) => console.error("[roleplay] store audio", e)));

    let reward: Reward | null = null;
    if (!wasDebriefed && s.status === "debriefed" && !s.preview) {
      reward = await creditProgress(me, s.activityId, s.stepId ? { stepId: s.stepId, courseId: s.courseId! } : null, s.score ?? 0);
      refresh();
    }
    const minutesLeft = me.isStaff ? null : (await remainingSeconds(me.id)) / 60;
    return { ok: true, result: toFinished(s, reward, minutesLeft) };
  } catch (e) {
    if (!(e instanceof ConversationError)) console.error("[roleplay] finish action", e);
    return fail(e);
  }
}

/**
 * A debriefed conversation counts (owner decision 2026-11-23): it completes the unit step(s) using
 * this scenario that are open in the learner's courses — the step it was played from, or, from the
 * « Talk with Coach Ish » page, every open step with this scenario — keeping the best score and
 * giving the step's XP once (replays: 5 XP a day). A scenario outside the learner's courses gives
 * practice XP once, then 5 XP a day.
 */
async function creditProgress(me: CurrentUser, activityId: unknown, from: { stepId: unknown; courseId: unknown } | null, score: number): Promise<Reward | null> {
  const { Step } = await import("@/models");
  const targets: { stepId: string; courseId: string }[] = [];
  if (from) targets.push({ stepId: String(from.stepId), courseId: String(from.courseId) });
  else {
    const enrolled = (await Enrollment.find({ userId: me.id }).select("courseId status startDate endDate").lean()).filter((e) => accessState(e) === "active").map((e) => e.courseId);
    const steps = await Step.find({ courseId: { $in: enrolled }, kind: "activity", activityId: new Types.ObjectId(String(activityId)) }).select("courseId").lean();
    for (const st of steps) {
      const access = await courseAccess(me, String(st.courseId));
      if (!access.ok || access.readOnly || access.preview) continue;
      const outline = allSteps((await courseTree(me, access)).outline).find((o) => o.id === String(st._id));
      if (outline && outline.state !== "locked") targets.push({ stepId: String(st._id), courseId: String(st.courseId) });
    }
  }
  const items: (AwardInput & { courseId?: unknown })[] = [];
  for (const t of targets) {
    const previous = await StepProgress.findOne({ userId: me.id, stepId: t.stepId }).select("score completedAt").lean();
    await StepProgress.updateOne(
      { userId: me.id, stepId: t.stepId },
      { $set: { score: Math.max(score, previous?.score ?? 0) }, $inc: { attempts: 1 }, $setOnInsert: { courseId: t.courseId, completedAt: new Date() } },
      { upsert: true },
    );
    items.push(
      previous?.completedAt
        ? { courseId: t.courseId, key: `replay:${t.stepId}:${dayKey()}`, source: "practice_replay", amount: XP.practiceReplay }
        : { courseId: t.courseId, key: `step:${t.stepId}`, source: "role_play", amount: practiceXp(score), counters: { lessonsCompleted: 1 } },
    );
  }
  if (!targets.length) {
    const id = String(activityId);
    items.push({ key: `roleplay:${id}`, source: "role_play", amount: practiceXp(score) }, { key: `roleplay:${id}:${dayKey()}`, source: "practice_replay", amount: XP.practiceReplay });
  }
  try {
    return await award(me.id, items as AwardInput[]);
  } catch (e) {
    console.error("award failed", e);
    return null;
  }
}
