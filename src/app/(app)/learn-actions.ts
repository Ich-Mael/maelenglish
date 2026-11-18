"use server";

import { Types } from "mongoose";
import { refresh } from "next/cache";
import { readCurrentUser } from "@/lib/auth/dal";
import { courseAccess, courseTree } from "@/lib/learn/queries";
import { checkExercise, type Exercise, type ExerciseResponse } from "@/lib/learn/exercises";
import { gradeQuiz } from "@/lib/learn/progress";
import { AssignmentSubmission, LessonProgress, QuizAttempt, type LessonDoc } from "@/models";

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

function lessonOf(ctx: Ctx, lessonId: string): { lesson: LessonDoc; open: boolean } {
  const lesson = ctx.tree.lessons.find((l) => String(l._id) === lessonId);
  if (!lesson) throw new Error("Leçon introuvable.");
  const state = ctx.tree.outline.modules.flatMap((m) => m.lessons).find((l) => l.id === lessonId)?.state;
  return { lesson, open: state !== "locked" };
}

async function markDone(ctx: Ctx, lesson: LessonDoc, practiceScore: number | null = null) {
  if (!ctx.save) return;
  await LessonProgress.updateOne(
    { userId: ctx.me.id, lessonId: lesson._id },
    {
      $set: { courseId: lesson.courseId, moduleId: lesson.moduleId, status: "completed", completedAt: new Date(), ...(practiceScore !== null ? { practiceScore } : {}) },
    },
    { upsert: true },
  );
}

export async function completeLesson(courseId: string, lessonId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const ctx = await context(courseId);
    const { lesson, open } = lessonOf(ctx, lessonId);
    if (!open) return { ok: false, error: "Terminez d'abord la leçon précédente." };
    await markDone(ctx, lesson);
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** First-try responses of a practice lesson → score recorded, lesson completed. */
export async function submitPractice(
  courseId: string,
  lessonId: string,
  responses: Record<string, ExerciseResponse>,
): Promise<{ ok: boolean; score?: number; error?: string }> {
  try {
    const ctx = await context(courseId);
    const { lesson, open } = lessonOf(ctx, lessonId);
    if (!open) return { ok: false, error: "Terminez d'abord la leçon précédente." };
    const exercises = (lesson.exercises ?? []) as unknown as (Exercise & { _id: Types.ObjectId })[];
    const correct = exercises.filter((ex) => checkExercise({ ...ex, id: String(ex._id) }, responses[String(ex._id)])).length;
    const score = exercises.length ? Math.round((correct / exercises.length) * 100) : 100;
    await markDone(ctx, lesson, score);
    refresh();
    return { ok: true, score };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export type QuizResult = {
  score: number;
  passed: boolean;
  passingScore: number;
  correct: number;
  total: number;
  review: { questionId: string; chosen: string | null; correctOptionId: string; explanation: string }[];
};

/** Graded module quiz (`moduleId`) or final exam (`moduleId` null) — graded here, never on the client. */
export async function submitQuiz(
  courseId: string,
  moduleId: string | null,
  answers: Record<string, string>,
): Promise<{ ok: true; result: QuizResult } | { ok: false; error: string }> {
  try {
    const ctx = await context(courseId);
    let quiz;
    if (moduleId) {
      const outline = ctx.tree.outline.modules.find((m) => m.id === moduleId);
      if (!outline?.quiz || outline.quiz.state === "locked") return { ok: false, error: "Terminez d'abord les leçons du module." };
      quiz = ctx.tree.modules.find((m) => String(m._id) === moduleId)?.quiz;
    } else {
      if (!ctx.tree.outline.finalExam || ctx.tree.outline.finalExam.state === "locked") {
        return { ok: false, error: "L'examen final s'ouvre quand tous les modules sont terminés." };
      }
      quiz = ctx.access.course.finalExam;
    }
    const questions = (quiz?.questions ?? []) as unknown as { _id: Types.ObjectId; correctOptionId: string; explanation?: string }[];
    if (!questions.length) return { ok: false, error: "Quiz introuvable." };

    const graded = gradeQuiz(questions.map((q) => ({ id: String(q._id), correctOptionId: q.correctOptionId })), answers);
    const passingScore = quiz?.passingScore ?? 70;
    const passed = graded.score >= passingScore;

    if (ctx.save) {
      const quizType = moduleId ? "module_quiz" : "final_exam";
      const previous = await QuizAttempt.countDocuments({ userId: ctx.me.id, courseId, quizType, moduleId: moduleId ?? null });
      await QuizAttempt.create({
        userId: ctx.me.id,
        courseId,
        moduleId: moduleId ?? null,
        quizType,
        score: graded.score,
        passingScore,
        passed,
        answers: questions.map((q) => answers[String(q._id)] ?? ""),
        attemptNumber: previous + 1,
      });
    }
    refresh();
    return {
      ok: true,
      result: {
        ...graded,
        passed,
        passingScore,
        review: questions.map((q) => ({
          questionId: String(q._id),
          chosen: answers[String(q._id)] ?? null,
          correctOptionId: q.correctOptionId,
          explanation: q.explanation ?? "",
        })),
      },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export type AssignmentState = { error?: string; success?: string } | undefined;

/** Module assignment (`moduleId` field) or final project (`moduleId` = "final"). Resubmitting replaces the answer. */
export async function submitAssignment(_: AssignmentState, form: FormData): Promise<AssignmentState> {
  const courseId = String(form.get("courseId") ?? "");
  const moduleId = String(form.get("moduleId") ?? "");
  const content = String(form.get("content") ?? "").trim();
  try {
    const ctx = await context(courseId);
    const isFinal = moduleId === "final";
    let def;
    if (isFinal) {
      if (!ctx.tree.outline.finalProject || ctx.tree.outline.finalProject.state === "locked") return { error: "Le projet final s'ouvre quand tous les modules sont terminés." };
      def = ctx.access.course.finalProject;
    } else {
      const outline = ctx.tree.outline.modules.find((m) => m.id === moduleId);
      if (!outline?.assignment || outline.assignment.state === "locked") return { error: "Ce devoir n'est pas encore ouvert." };
      def = ctx.tree.modules.find((m) => String(m._id) === moduleId)?.assignment;
    }
    if (!def) return { error: "Devoir introuvable." };
    if (!content) return { error: "Votre réponse ne peut pas être vide." };
    if (content.length > 20000) return { error: "Votre réponse est trop longue (20 000 caractères maximum)." };
    if (def.submissionType === "link" && !/^https?:\/\/\S+$/i.test(content)) return { error: "Indiquez un lien complet, commençant par https://" };

    const filter = { userId: ctx.me.id, courseId, moduleId: isFinal ? null : moduleId, assignmentType: (isFinal ? "final_project" : "module_assignment") as "final_project" | "module_assignment" };
    const existing = await AssignmentSubmission.findOne(filter).lean();
    if (existing?.status === "graded") return { error: "Ce devoir est déjà corrigé." };
    if (!ctx.save) return { success: "Aperçu : la réponse n'est pas enregistrée." };

    await AssignmentSubmission.updateOne(
      filter,
      {
        $set: { submissionType: def.submissionType ?? "text", content, status: "pending", maxScore: def.maxScore ?? 100, grade: null, gradedAt: null, gradedBy: null },
      },
      { upsert: true },
    );
    refresh();
    return { success: ctx.access.course.isChallenge ? "Point de contrôle envoyé. Votre coach va le valider." : "Devoir envoyé. Votre coach va le corriger." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

