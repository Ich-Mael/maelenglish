import { Types } from "mongoose";
import { normalizeRich, plainText } from "@/lib/rich-text";
import { AssignmentSubmission, Course, Module, Unit, User, type AssignmentSubmissionDoc } from "@/models";
import { award } from "@/lib/gamification/service";
import { XP } from "@/lib/gamification/rules";
import { AdminError } from "./errors";

export type QueueFilter = { courseIds: Types.ObjectId[] | null; status?: string };

/** Submissions to grade (oldest first), limited to the courses the grader can see. */
export async function gradingQueue({ courseIds, status = "pending" }: QueueFilter) {
  const filter: Record<string, unknown> = { status: ["pending", "graded", "returned"].includes(status) ? status : "pending" };
  if (courseIds) filter.courseId = { $in: courseIds };
  const subs = await AssignmentSubmission.find(filter).sort({ updatedAt: status === "pending" ? 1 : -1 }).limit(100).lean<AssignmentSubmissionDoc[]>();
  const [users, courses, modules, units] = await Promise.all([
    User.find({ _id: { $in: subs.map((s) => s.userId) } }).select("name surname username").lean(),
    Course.find({ _id: { $in: subs.map((s) => s.courseId) } }).select("title isChallenge").lean(),
    Module.find({ _id: { $in: subs.flatMap((s) => (s.moduleId ? [s.moduleId] : [])) } }).select("title order").lean(),
    Unit.find({ _id: { $in: subs.flatMap((s) => (s.unitId ? [s.unitId] : [])) } }).select("title").lean(),
  ]);
  return subs.map((s) => ({
    ...s,
    user: users.find((u) => String(u._id) === String(s.userId)),
    course: courses.find((c) => String(c._id) === String(s.courseId)),
    module: modules.find((m) => String(m._id) === String(s.moduleId)),
    unit: s.unitId ? units.find((u) => String(u._id) === String(s.unitId)) : undefined,
  }));
}

export type GradeInput = { decision: "graded" | "returned"; grade?: number | null; feedback?: string };

/**
 * Validates (« graded ») or returns a submission. Validation awards the
 * learner XP once (and unlocks the next challenge day, via the progression rules).
 */
export async function gradeSubmission(graderId: string, submissionId: string, input: GradeInput) {
  if (!Types.ObjectId.isValid(submissionId)) throw new AdminError("Identifiant invalide.");
  const sub = await AssignmentSubmission.findById(submissionId);
  if (!sub) throw new AdminError("Devoir introuvable.");
  const feedback = normalizeRich(input.feedback);
  if (input.decision === "returned" && !plainText(feedback)) throw new AdminError("Expliquez à l'apprenant ce qu'il doit reprendre.");
  const grade = input.grade === null || input.grade === undefined || Number.isNaN(input.grade) ? null : Math.round(input.grade);
  if (grade !== null && (grade < 0 || grade > sub.maxScore)) throw new AdminError(`La note doit être entre 0 et ${sub.maxScore}.`);

  sub.status = input.decision;
  sub.grade = input.decision === "graded" ? grade : null;
  sub.feedback = feedback;
  sub.gradedBy = new Types.ObjectId(graderId);
  sub.gradedAt = new Date();
  await sub.save();

  if (input.decision === "graded") {
    try {
      await award(sub.userId, [{ key: `graded:${sub._id}`, source: "assignment_graded", amount: XP.assignmentGraded, courseId: sub.courseId }]);
    } catch (e) {
      console.error("award failed", e);
    }
  }
  return sub.toObject() as AssignmentSubmissionDoc;
}
