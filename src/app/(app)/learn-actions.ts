"use server";

import { historyWithReviews, sendsAllowed, sendsLeft, sendsUsed } from "@/lib/learn/challenge";
import { Types } from "mongoose";
import { refresh } from "next/cache";
import { readCurrentUser } from "@/lib/auth/dal";
import { courseAccess, courseTree } from "@/lib/learn/queries";
import { allSteps, gradeQuiz, type StepOutline } from "@/lib/learn/progress";
import { ChallengeSubmission, Media, QuizAttempt, StepProgress, type StepDoc } from "@/models";
import { award, type AwardInput, type Reward } from "@/lib/gamification/service";
import { XP, dayKey, practiceXp } from "@/lib/gamification/rules";
import { isActivityType } from "@/lib/lab/types";
import { gradeActivity } from "@/lib/lab/grade";
import { starsFor } from "@/lib/lab/meta";
import { recordAttempt } from "@/lib/lab/attempts";
import { sendWriting, writingSendsLeft, WritingError } from "@/lib/lab/writing";
import type { WritingTaskContent } from "@/lib/lab/types";

/*
 * Learner mutations. Each action re-checks the session, the enrolment and that
 * the step is open in the learner's progression. In staff preview nothing is saved.
 */

type Ctx = Awaited<ReturnType<typeof context>>;

async function context(courseId: string) {
  const me = await readCurrentUser();
  if (!me) throw new Error("Your session has expired: sign in again.");
  const access = await courseAccess(me, courseId);
  if (!access.ok) throw new Error("You don't have access to this course.");
  if (access.readOnly) throw new Error("This course has ended: you can still view it, but nothing is saved any more.");
  const tree = await courseTree(me, access);
  return { me, access, tree, save: !access.preview };
}

/** The step (only if the learner can see it, i.e. its unit is valid) and its state in the progression. */
function stepOf(ctx: Ctx, stepId: string): { step: StepDoc; outline: StepOutline } {
  const outline = allSteps(ctx.tree.outline).find((s) => s.id === stepId);
  const step = ctx.tree.steps.find((s) => String(s._id) === stepId);
  if (!outline || !step) throw new Error("Activity not found.");
  return { step, outline };
}

/** XP & co. — only for saved progress (never in staff preview). */
async function reward(ctx: Ctx, items: AwardInput[]): Promise<Reward | null> {
  if (!ctx.save) return null;
  try {
    return await award(ctx.me.id, items.map((i) => ({ courseId: ctx.access.course._id, ...i })));
  } catch (e) {
    console.error("award failed", e); // gamification must never block learning
    return null;
  }
}

/** Lesson step: « Continuer » at the end of the page completes it. */
export async function completeStep(courseId: string, stepId: string): Promise<{ ok: boolean; error?: string; reward?: Reward | null }> {
  try {
    const ctx = await context(courseId);
    const { step, outline } = stepOf(ctx, stepId);
    if (step.kind !== "lesson") return { ok: false, error: "This activity is completed another way." };
    if (outline.state === "locked") return { ok: false, error: "Finish the previous activity first." };
    if (ctx.save) {
      await StepProgress.updateOne({ userId: ctx.me.id, stepId: step._id }, { $setOnInsert: { courseId: step.courseId, completedAt: new Date() } }, { upsert: true });
    }
    const r = await reward(ctx, [{ key: `step:${stepId}`, source: "lesson", amount: XP.lesson, counters: { lessonsCompleted: 1 } }]);
    refresh();
    return { ok: true, reward: r };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export type LabResult = { score: number; stars: number; bonus: number; items: { id: string; correct: boolean }[]; bestScore: number; reward: Reward | null };

/**
 * Finished activity step (a Lab activity). The browser checked each item for instant feedback; the
 * score is recomputed here from the first-try answers (`gradeActivity`). Completes the step whatever
 * the score (below the pass score the page offers « Revoir la leçon »), keeps the best score and the
 * attempt count, records the attempt and the mistake bank, awards XP. Staff preview: graded, nothing saved.
 */
export async function submitLabAttempt(
  courseId: string,
  stepId: string,
  input: { answers: Record<string, unknown>; bonus?: string[]; timeSpentS?: number; plays?: number },
): Promise<{ ok: true; result: LabResult } | { ok: false; error: string }> {
  try {
    const ctx = await context(courseId);
    const { step, outline } = stepOf(ctx, stepId);
    if (outline.state === "locked") return { ok: false, error: "Finish the previous activity first." };
    const activity = ctx.tree.activities.find((a) => String(a._id) === String(step.activityId));
    if (step.kind !== "activity" || !activity || !isActivityType(activity.type)) return { ok: false, error: "Activity not found." };
    const answers = input.answers && typeof input.answers === "object" ? input.answers : {};
    const graded = gradeActivity(activity.type, activity.content, answers);
    const correctIds = new Set(graded.items.filter((i) => i.correct).map((i) => i.id));
    const bonus = new Set((input.bonus ?? []).filter((id) => correctIds.has(id))).size;
    const stars = starsFor(graded.score);
    const wasDone = outline.state === "completed";

    let best = graded.score;
    if (ctx.save) {
      const previous = await StepProgress.findOne({ userId: ctx.me.id, stepId: step._id }).select("score").lean();
      best = Math.max(graded.score, previous?.score ?? 0);
      await StepProgress.updateOne(
        { userId: ctx.me.id, stepId: step._id },
        { $set: { score: best }, $inc: { attempts: 1 }, $setOnInsert: { courseId: step.courseId, completedAt: new Date() } },
        { upsert: true },
      );
      await recordAttempt({
        userId: ctx.me.id,
        courseId: step.courseId,
        stepId: step._id,
        activityId: activity._id,
        type: activity.type,
        score: graded.score,
        stars,
        bonus,
        timeSpentS: Number(input.timeSpentS) || 0,
        plays: Number(input.plays) || 0,
        items: graded.items,
        answers,
      });
    }
    const items: AwardInput[] = wasDone
      ? [{ key: `replay:${stepId}:${dayKey()}`, source: "practice_replay", amount: XP.practiceReplay }]
      : [{ key: `step:${stepId}`, source: activity.type, amount: practiceXp(graded.score), counters: { lessonsCompleted: 1 } }];
    if (graded.score >= 100) items.push({ key: `perfect:${stepId}`, source: "perfect", amount: 0, counters: { perfectPractices: 1 } });
    const r = await reward(ctx, items);
    refresh();
    return { ok: true, result: { score: graded.score, stars, bonus, items: graded.items, bestScore: best, reward: r } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export type WritingSent = { sentAt: string; sendsLeft: number; reward?: Reward | null };

/**
 * Lab « writing task »: the learner sends a version to their coach (an AI correction draft is made
 * for the coach). Sending completes the step (the coach's score comes later) and awards XP once,
 * like the speaking challenge. 3 versions per activity. Staff preview: nothing sent.
 */
export async function submitWriting(courseId: string, stepId: string, text: string): Promise<{ ok: true; result: WritingSent } | { ok: false; error: string }> {
  try {
    const ctx = await context(courseId);
    const { step, outline } = stepOf(ctx, stepId);
    if (outline.state === "locked") return { ok: false, error: "Finish the previous activity first." };
    const activity = ctx.tree.activities.find((a) => String(a._id) === String(step.activityId));
    if (step.kind !== "activity" || !activity || activity.type !== "writing_task") return { ok: false, error: "Activity not found." };
    if (!ctx.save) return { ok: false, error: "Preview: nothing is sent. Test the correction from the Lab preview." };
    const submission = await sendWriting(ctx.me.id, { courseId: step.courseId, moduleId: step.moduleId, unitId: step.unitId, stepId: step._id, activityId: activity._id, level: activity.level ?? "", content: activity.content as WritingTaskContent }, text);
    await StepProgress.updateOne(
      { userId: ctx.me.id, stepId: step._id },
      { $inc: { attempts: 1 }, $setOnInsert: { courseId: step.courseId, completedAt: new Date(), score: null } },
      { upsert: true },
    );
    const r = await reward(ctx, [{ key: `step:${stepId}`, source: activity.type, amount: XP.practiceBase, counters: { lessonsCompleted: 1 } }]);
    refresh();
    return { ok: true, result: { sentAt: new Date().toISOString(), sendsLeft: writingSendsLeft(submission), reward: r } };
  } catch (e) {
    return { ok: false, error: e instanceof WritingError ? e.message : (e as Error).message };
  }
}

export type ChallengeState = { error?: string; success?: string; reward?: Reward | null } | undefined;

/**
 * Unit speaking challenge: the recording was uploaded first (`uploadMedia`, kind « recording »);
 * this records it as the learner's answer. Sending it completes the unit and opens the next one;
 * a coach then listens and gives feedback in « Corrections ». Re-sending replaces the answer
 * until the coach answers; a validated challenge can be redone (within the sends left) and keeps
 * its validation.
 */
export async function submitUnitChallenge(input: { courseId: string; stepId: string; mediaId: string | null }): Promise<ChallengeState> {
  const { courseId, stepId, mediaId } = input;
  try {
    const ctx = await context(courseId);
    const { step, outline } = stepOf(ctx, stepId);
    if (step.kind !== "challenge") return { error: "Challenge not found." };
    if (outline.state === "locked" && !outline.status) return { error: "Finish the unit's activities first." };
    if (!ctx.save) return { success: "Preview: the recording isn't sent." };

    if (!mediaId || !Types.ObjectId.isValid(mediaId)) return { error: "Recording not found: try again." };
    const media = await Media.findById(mediaId).lean();
    if (!media || String(media.ownerId) !== ctx.me.id || media.kind !== "recording" || media.status !== "ready") return { error: "Recording not found: try again." };
    const existing = await ChallengeSubmission.findOne({ userId: ctx.me.id, unitId: step.unitId }).select("attempts extraAttempts mediaId durationS submittedAt updatedAt status grade feedback feedbackAudioMediaId feedbackAudioDurationS gradedBy gradedAt validatedAt history").lean();
    if (sendsLeft(existing) <= 0) return { error: `You've used your ${sendsAllowed(existing)} sends for this challenge: your coach will listen to the last one.` };

    await ChallengeSubmission.updateOne(
      { userId: ctx.me.id, unitId: step.unitId },
      {
        $set: { courseId: step.courseId, moduleId: step.moduleId, stepId: step._id, activityId: step.activityId, mediaId: media._id, durationS: media.durationS ?? 0, status: "pending", grade: null, gradedAt: null, gradedBy: null, feedback: "", feedbackAudioMediaId: null, feedbackAudioDurationS: 0, attempts: sendsUsed(existing) + 1, submittedAt: new Date(),
          // Redoing a validated challenge keeps the validation (older rows: status « graded »).
          validatedAt: existing?.validatedAt ?? (existing?.status === "graded" ? (existing.gradedAt ?? new Date()) : null),
          // Each earlier recording keeps its review (the top-level one is cleared for the new send).
          history: [...(existing ? historyWithReviews(existing) : []), { mediaId: media._id, durationS: media.durationS ?? 0, sentAt: new Date() }] },
      },
      { upsert: true },
    );
    const r = await reward(ctx, [{ key: `challenge:${String(step.unitId)}`, source: "challenge", amount: XP.challenge, counters: { assignmentsSubmitted: 1 } }]);
    refresh();
    const redo = !!existing?.validatedAt || existing?.status === "graded";
    return { reward: r, success: redo ? "New version sent! Your coach will listen and give you feedback. Your validation still counts." : "Challenge sent! The rest of the course is open. Your coach will listen and give you feedback." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export type QuizResult = {
  score: number;
  passed: boolean;
  passingScore: number;
  correct: number;
  total: number;
  review: { questionId: string; chosen: string | null; correctOptionId: string; explanation: string }[];
  reward: Reward | null;
};

/** Course final exam — graded here, never on the client. */
export async function submitFinalExam(courseId: string, answers: Record<string, string>): Promise<{ ok: true; result: QuizResult } | { ok: false; error: string }> {
  try {
    const ctx = await context(courseId);
    if (!ctx.tree.outline.finalExam || ctx.tree.outline.finalExam.state === "locked") return { ok: false, error: "The final exam opens when every module is completed." };
    const quiz = ctx.access.course.finalExam;
    const questions = (quiz?.questions ?? []) as unknown as { _id: Types.ObjectId; correctOptionId: string; explanation?: string }[];
    if (!questions.length) return { ok: false, error: "Examen introuvable." };

    const graded = gradeQuiz(questions.map((q) => ({ id: String(q._id), correctOptionId: q.correctOptionId })), answers);
    const passingScore = quiz?.passingScore ?? 70;
    const passed = graded.score >= passingScore;
    if (ctx.save) {
      const previous = await QuizAttempt.countDocuments({ userId: ctx.me.id, courseId, quizType: "final_exam" });
      await QuizAttempt.create({
        userId: ctx.me.id,
        courseId,
        quizType: "final_exam",
        score: graded.score,
        passingScore,
        passed,
        answers: questions.map((q) => answers[String(q._id)] ?? ""),
        attemptNumber: previous + 1,
      });
    }
    const r = passed ? await reward(ctx, [{ key: `exam:${courseId}`, source: "exam", amount: XP.examPass, counters: { examsPassed: 1 } }]) : null;
    refresh();
    return {
      ok: true,
      result: {
        reward: r,
        ...graded,
        passed,
        passingScore,
        review: questions.map((q) => ({ questionId: String(q._id), chosen: answers[String(q._id)] ?? null, correctOptionId: q.correctOptionId, explanation: q.explanation ?? "" })),
      },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
