import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { findProgram } from "@/lib/catalog";
import type { CurrentUser } from "@/lib/auth/dal";
import {
  Activity,
  ChallengeSubmission,
  Course,
  Enrollment,
  Module,
  QuizAttempt,
  Step,
  StepProgress,
  Unit,
  accessState,
  type AccessState,
  type ActivityDoc,
  type CourseDoc,
  type EnrollmentDoc,
  type ModuleDoc,
  type StepDoc,
  type UnitDoc,
} from "@/models";
import { checkUnit } from "@/lib/course/unit-check";
import type { UnitProblem } from "@/lib/course/validate-unit";
import { computeOutline, type Outline, type SubmissionStatus } from "./progress";

/*
 * Learner data access. Every function takes the signed-in user and checks
 * access itself (enrolment window / status, or staff preview).
 */

export type CourseAccess =
  | { ok: true; course: CourseDoc; enrollment: EnrollmentDoc | null; preview: boolean; readOnly: boolean }
  | { ok: false; reason: "not-found" | "not-enrolled" | Exclude<AccessState, "active" | "completed">; course?: CourseDoc; enrollment?: EnrollmentDoc };

const isId = (id: string) => Types.ObjectId.isValid(id) && String(new Types.ObjectId(id)) === id;

export async function courseAccess(me: CurrentUser, courseId: string): Promise<CourseAccess> {
  if (!isId(courseId)) return { ok: false, reason: "not-found" };
  await connectDB();
  const course = await Course.findById(courseId).lean<CourseDoc>();
  if (!course) return { ok: false, reason: "not-found" };
  const enrollment = await Enrollment.findOne({ userId: me.id, courseId }).lean<EnrollmentDoc>();

  // Coaches, instructors and admins preview any course (nothing is saved).
  if (me.isStaff) return { ok: true, course, enrollment, preview: true, readOnly: false };
  if (!enrollment || !course.isPublished) return { ok: false, reason: "not-enrolled", course };

  const state = accessState(enrollment);
  if (state === "active") return { ok: true, course, enrollment, preview: false, readOnly: false };
  if (state === "completed") return { ok: true, course, enrollment, preview: false, readOnly: true };
  return { ok: false, reason: state, course, enrollment };
}

/** A course's structure with each unit's rule check (valid units are the ones learners see). */
export async function courseStructure(courseId: Types.ObjectId | string) {
  const [modules, units, steps] = await Promise.all([
    Module.find({ courseId }).sort({ order: 1, createdAt: 1 }).lean<ModuleDoc[]>(),
    Unit.find({ courseId }).sort({ order: 1, createdAt: 1 }).lean<UnitDoc[]>(),
    Step.find({ courseId }).sort({ position: 1 }).lean<StepDoc[]>(),
  ]);
  const activityIds = steps.flatMap((s) => (s.activityId ? [s.activityId] : []));
  const activities = activityIds.length ? await Activity.find({ _id: { $in: activityIds } }).lean<ActivityDoc[]>() : [];
  const ready = new Set(activities.filter((a) => a.status === "ready").map((a) => String(a._id)));
  const problems = new Map<string, UnitProblem[]>(units.map((u) => [String(u._id), checkUnit(steps.filter((s) => String(s.unitId) === String(u._id)), ready)]));
  return { modules, units, steps, activities, problems };
}

export type CourseTree = Awaited<ReturnType<typeof courseStructure>> & { outline: Outline };

/** The course structure and the learner's computed progression. */
export async function courseTree(me: CurrentUser, access: Extract<CourseAccess, { ok: true }>): Promise<CourseTree> {
  const courseId = access.course._id;
  const structure = await courseStructure(courseId);
  const { modules, units, steps, activities, problems } = structure;
  const activityType = new Map(activities.map((a) => [String(a._id), a.type]));
  const ready = new Set(activities.filter((a) => a.status === "ready").map((a) => String(a._id)));

  const [progress, attempts, submissions] = await Promise.all([
    StepProgress.find({ userId: me.id, courseId }).select("stepId score").lean(),
    QuizAttempt.aggregate<{ best: number; passed: boolean }>([
      { $match: { userId: new Types.ObjectId(me.id), courseId, quizType: "final_exam" } },
      { $group: { _id: null, best: { $max: "$score" }, passed: { $max: "$passed" } } },
    ]),
    ChallengeSubmission.find({ userId: me.id, courseId }).select("unitId status validatedAt").lean(),
  ]);

  const outline = computeOutline({
    modules: modules.map((m) => ({
      id: String(m._id),
      title: m.title,
      summary: m.summary ?? "",
      description: m.description ?? "",
      level: m.level ?? "",
      units: units
        .filter((u) => String(u.moduleId) === String(m._id))
        .map((u) => ({
          id: String(u._id),
          title: u.title,
          objectives: u.objectives ?? [],
          estimatedMinutes: u.estimatedMinutes ?? 0,
          valid: (problems.get(String(u._id)) ?? []).length === 0,
          // Draft practice activities are skipped for learners (the unit stays visible without them).
          steps: steps
            .filter((s) => String(s.unitId) === String(u._id) && !(s.kind === "activity" && !ready.has(String(s.activityId))))
            .map((s) => ({
              id: String(s._id),
              kind: s.kind as "lesson" | "activity" | "challenge",
              title: s.title,
              type: s.kind === "activity" ? (activityType.get(String(s.activityId)) ?? "activity") : s.kind,
              estimatedMinutes: s.estimatedMinutes ?? 0,
              lessonId: s.lessonId ? String(s.lessonId) : null,
              passScore: s.passScore ?? undefined,
            })),
        })),
    })),
    completedStepIds: new Set(progress.map((p) => String(p.stepId))),
    scores: new Map(progress.filter((p) => p.score !== null && p.score !== undefined).map((p) => [String(p.stepId), p.score as number])),
    // A challenge validated once stays validated for the progression, even while a redo is reviewed.
    challenges: new Map(submissions.map((s) => [String(s.unitId), (s.validatedAt ? "graded" : s.status) as SubmissionStatus])),
    finalExam: { exists: (access.course.finalExam?.questions?.length ?? 0) > 0, bestScore: attempts[0]?.best ?? null, passed: !!attempts[0]?.passed },
    isChallenge: !!access.course.isChallenge,
    start: access.enrollment?.startDate ?? new Date(),
    preview: access.preview,
  });

  return { ...structure, outline };
}

export type MyCourse = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  programName: string | null;
  programPhoto: string | null;
  isChallenge: boolean;
  state: AccessState;
  startDate: Date | null;
  endDate: Date | null;
  stepsDone: number;
  stepsTotal: number;
};

/** The learner's enrolments (published courses), with progress counts. */
export async function myCourses(me: CurrentUser): Promise<MyCourse[]> {
  await connectDB();
  const enrollments = await Enrollment.find({ userId: me.id }).sort({ startDate: -1 }).lean<EnrollmentDoc[]>();
  if (!enrollments.length) return [];
  const courses = await Course.find({ _id: { $in: enrollments.map((e) => e.courseId) }, isPublished: true }).lean<CourseDoc[]>();
  const byId = new Map(courses.map((c) => [String(c._id), c]));
  // Progress counts come from the same outline as the course page (valid units only).
  const counts = new Map<string, { done: number; total: number }>();
  for (const e of enrollments) {
    const c = byId.get(String(e.courseId));
    if (!c) continue;
    const { outline } = await courseTree(me, { ok: true, course: c, enrollment: e, preview: false, readOnly: false });
    counts.set(String(c._id), { done: outline.stepsDone, total: outline.stepsTotal });
  }

  return enrollments.flatMap((e) => {
    const c = byId.get(String(e.courseId));
    if (!c) return [];
    const program = findProgram(c.program);
    const id = String(c._id);
    return [
      {
        id,
        title: c.title,
        description: c.description ?? "",
        imageUrl: c.imageUrl ?? "",
        programName: program?.name ?? null,
        programPhoto: program?.photo ?? null,
        isChallenge: !!c.isChallenge,
        state: accessState(e),
        startDate: e.startDate ?? null,
        endDate: e.endDate ?? null,
        stepsDone: counts.get(id)?.done ?? 0,
        stepsTotal: counts.get(id)?.total ?? 0,
      },
    ];
  });
}

/** First accessible course of this learner linked to a catalogue programme (programme page CTA). */
export async function myCourseForProgram(me: CurrentUser, programSlug: string): Promise<string | null> {
  await connectDB();
  const courses = await Course.find({ program: programSlug, isPublished: true }).select("_id").lean();
  if (!courses.length) return null;
  const enrollments = await Enrollment.find({ userId: me.id, courseId: { $in: courses.map((c) => c._id) } }).lean<EnrollmentDoc[]>();
  const usable = enrollments.find((e) => ["active", "completed"].includes(accessState(e)));
  return usable ? String(usable.courseId) : null;
}
