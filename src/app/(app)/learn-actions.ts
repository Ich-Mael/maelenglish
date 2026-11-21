"use server";

import { sendsAllowed, sendsLeft, sendsUsed } from "@/lib/learn/challenge";
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

/*
 * Learner mutations. Each action re-checks the session, the enrolment and that
 * the step is open in the learner's progression. In staff preview nothing is saved.
 */

type Ctx = Awaited<ReturnType<typeof context>>;

async function context(courseId: string) {
  const me = await readCurrentUser();
  if (!me) throw new Error("Session expirée : reconnectez-vous.");
  const access = await courseAccess(me, courseId);
  if (!access.ok) throw new Error("Vous n'avez pas accès à ce cours.");
  if (access.readOnly) throw new Error("Ce cours est terminé : il reste consultable, mais plus rien n'est enregistré.");
  const tree = await courseTree(me, access);
  return { me, access, tree, save: !access.preview };
}

/** The step (only if the learner can see it, i.e. its unit is valid) and its state in the progression. */
function stepOf(ctx: Ctx, stepId: string): { step: StepDoc; outline: StepOutline } {
  const outline = allSteps(ctx.tree.outline).find((s) => s.id === stepId);
  const step = ctx.tree.steps.find((s) => String(s._id) === stepId);
  if (!outline || !step) throw new Error("Activité introuvable.");
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
    if (step.kind !== "lesson") return { ok: false, error: "Cette activité se termine autrement." };
    if (outline.state === "locked") return { ok: false, error: "Terminez d'abord l'activité précédente." };
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
    if (outline.state === "locked") return { ok: false, error: "Terminez d'abord l'activité précédente." };
    const activity = ctx.tree.activities.find((a) => String(a._id) === String(step.activityId));
    if (step.kind !== "activity" || !activity || !isActivityType(activity.type)) return { ok: false, error: "Activité introuvable." };
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

export type ChallengeState = { error?: string; success?: string; reward?: Reward | null } | undefined;

/**
 * Unit speaking challenge: the recording was uploaded first (`uploadMedia`, kind « recording »);
 * this records it as the learner's answer. Sending it completes the unit and opens the next one;
 * a coach then listens and gives feedback in « Corrections ». Re-sending replaces the answer
 * until the coach validates it.
 */
export async function submitUnitChallenge(input: { courseId: string; stepId: string; mediaId: string | null }): Promise<ChallengeState> {
  const { courseId, stepId, mediaId } = input;
  try {
    const ctx = await context(courseId);
    const { step, outline } = stepOf(ctx, stepId);
    if (step.kind !== "challenge") return { error: "Défi introuvable." };
    if (outline.state === "locked" && !outline.status) return { error: "Terminez d'abord les activités de l'unité." };
    if (outline.status === "graded") return { error: "Ce défi est déjà validé par votre coach." };
    if (!ctx.save) return { success: "Aperçu : l'enregistrement n'est pas envoyé." };

    if (!mediaId || !Types.ObjectId.isValid(mediaId)) return { error: "Enregistrement introuvable : réessayez." };
    const media = await Media.findById(mediaId).lean();
    if (!media || String(media.ownerId) !== ctx.me.id || media.kind !== "recording" || media.status !== "ready") return { error: "Enregistrement introuvable : réessayez." };
    const existing = await ChallengeSubmission.findOne({ userId: ctx.me.id, unitId: step.unitId }).select("attempts extraAttempts mediaId").lean();
    if (sendsLeft(existing) <= 0) return { error: `Vous avez utilisé vos ${sendsAllowed(existing)} envois pour ce défi : votre coach va écouter le dernier.` };

    await ChallengeSubmission.updateOne(
      { userId: ctx.me.id, unitId: step.unitId },
      {
        $set: { courseId: step.courseId, moduleId: step.moduleId, stepId: step._id, activityId: step.activityId, mediaId: media._id, durationS: media.durationS ?? 0, status: "pending", grade: null, gradedAt: null, gradedBy: null, attempts: sendsUsed(existing) + 1 },
        $push: { history: { mediaId: media._id, durationS: media.durationS ?? 0, sentAt: new Date() } },
      },
      { upsert: true },
    );
    const r = await reward(ctx, [{ key: `challenge:${String(step.unitId)}`, source: "challenge", amount: XP.challenge, counters: { assignmentsSubmitted: 1 } }]);
    refresh();
    return { reward: r, success: "Défi envoyé ! La suite du parcours est ouverte. Votre coach va vous écouter et vous faire un retour." };
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
    if (!ctx.tree.outline.finalExam || ctx.tree.outline.finalExam.state === "locked") return { ok: false, error: "L'examen final s'ouvre quand tous les modules sont terminés." };
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
