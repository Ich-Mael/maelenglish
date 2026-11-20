import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { findProgram } from "@/lib/catalog";
import type { CurrentUser } from "@/lib/auth/dal";
import {
  AssignmentSubmission,
  Course,
  Enrollment,
  Lesson,
  LessonProgress,
  Module,
  QuizAttempt,
  Unit,
  accessState,
  type AccessState,
  type CourseDoc,
  type EnrollmentDoc,
  type LessonDoc,
  type ModuleDoc,
  type UnitDoc,
} from "@/models";
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

export type CourseTree = {
  modules: ModuleDoc[];
  units: UnitDoc[];
  lessons: LessonDoc[];
  outline: Outline;
};

/** Modules, published lessons and the learner's computed progression. */
export async function courseTree(me: CurrentUser, access: Extract<CourseAccess, { ok: true }>): Promise<CourseTree> {
  const courseId = access.course._id;
  const [modules, units, lessons] = await Promise.all([
    Module.find({ courseId }).sort({ order: 1, createdAt: 1 }).lean<ModuleDoc[]>(),
    Unit.find({ courseId }).sort({ order: 1, createdAt: 1 }).lean<UnitDoc[]>(),
    Lesson.find({ courseId, isPublished: true }).sort({ order: 1, createdAt: 1 }).lean<LessonDoc[]>(),
  ]);

  const [progress, attempts, submissions] = await Promise.all([
    LessonProgress.find({ userId: me.id, courseId, status: "completed" }).select("lessonId").lean(),
    QuizAttempt.aggregate<{ _id: { moduleId: Types.ObjectId | null; quizType: string }; best: number; passed: boolean }>([
      { $match: { userId: new Types.ObjectId(me.id), courseId } },
      { $group: { _id: { moduleId: "$moduleId", quizType: "$quizType" }, best: { $max: "$score" }, passed: { $max: "$passed" } } },
    ]),
    AssignmentSubmission.find({ userId: me.id, courseId }).select("moduleId unitId assignmentType status").lean(),
  ]);

  const quizResults = new Map<string, { bestScore: number; passed: boolean }>();
  let finalBest: number | null = null;
  let finalPassed = false;
  for (const a of attempts) {
    if (a._id.quizType === "final_exam") {
      finalBest = a.best;
      finalPassed = a.passed;
    } else if (a._id.moduleId) quizResults.set(String(a._id.moduleId), { bestScore: a.best, passed: a.passed });
  }
  const assignments = new Map<string, SubmissionStatus>();
  const unitChallenges = new Map<string, SubmissionStatus>();
  let projectStatus: SubmissionStatus | null = null;
  for (const s of submissions) {
    if (s.assignmentType === "final_project") projectStatus = s.status as SubmissionStatus;
    else if (s.assignmentType === "unit_challenge") {
      if (s.unitId) unitChallenges.set(String(s.unitId), s.status as SubmissionStatus);
    }
    else if (s.moduleId) assignments.set(String(s.moduleId), s.status as SubmissionStatus);
  }

  const outline = computeOutline({
    modules: modules.map((m) => ({
      id: String(m._id),
      title: m.title,
      summary: m.summary ?? "",
      description: m.description ?? "",
      hasQuiz: (m.quiz?.questions?.length ?? 0) > 0,
      hasAssignment: !!m.assignment?.instructions?.trim(),
      isCheckpointRequired: m.isCheckpointRequired !== false,
      units: units.filter((u) => String(u.moduleId) === String(m._id)).map((u) => ({ id: String(u._id), title: u.title, objective: u.objective ?? "", hasChallenge: !!u.challenge?.instructions?.trim() })),
      lessons: lessons
        .filter((l) => String(l.moduleId) === String(m._id))
        .map((l) => ({ id: String(l._id), title: l.title, type: l.type, unitId: l.unitId ? String(l.unitId) : null })),
    })),
    completedLessonIds: new Set(progress.map((p) => String(p.lessonId))),
    quizResults,
    assignments,
    unitChallenges,
    finalExam: { exists: (access.course.finalExam?.questions?.length ?? 0) > 0, bestScore: finalBest, passed: finalPassed },
    finalProject: { exists: !!access.course.finalProject?.instructions?.trim(), status: projectStatus },
    isChallenge: !!access.course.isChallenge,
    start: access.enrollment?.startDate ?? new Date(),
    preview: access.preview,
  });

  return { modules, units, lessons, outline };
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
  lessonsDone: number;
  lessonsTotal: number;
};

/** The learner's enrolments (published courses), with progress counts. */
export async function myCourses(me: CurrentUser): Promise<MyCourse[]> {
  await connectDB();
  const enrollments = await Enrollment.find({ userId: me.id }).sort({ startDate: -1 }).lean<EnrollmentDoc[]>();
  if (!enrollments.length) return [];
  const courseIds = enrollments.map((e) => e.courseId);
  const [courses, totals, done] = await Promise.all([
    Course.find({ _id: { $in: courseIds }, isPublished: true }).lean<CourseDoc[]>(),
    Lesson.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { courseId: { $in: courseIds }, isPublished: true } },
      { $group: { _id: "$courseId", n: { $sum: 1 } } },
    ]),
    LessonProgress.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { userId: new Types.ObjectId(me.id), courseId: { $in: courseIds }, status: "completed" } },
      { $group: { _id: "$courseId", n: { $sum: 1 } } },
    ]),
  ]);
  const byId = new Map(courses.map((c) => [String(c._id), c]));
  const count = (rows: { _id: Types.ObjectId; n: number }[], id: string) => rows.find((r) => String(r._id) === id)?.n ?? 0;

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
        lessonsDone: count(done, id),
        lessonsTotal: count(totals, id),
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
