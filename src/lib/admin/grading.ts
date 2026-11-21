import { Types } from "mongoose";
import { normalizeRich, plainText } from "@/lib/rich-text";
import { ChallengeSubmission, Course, Module, Unit, User, type ChallengeSubmissionDoc } from "@/models";
import { award } from "@/lib/gamification/service";
import { XP } from "@/lib/gamification/rules";
import { AdminError } from "./errors";

export type QueueFilter = { courseIds: Types.ObjectId[] | null; status?: string };

/** Speaking challenges to review (oldest first), limited to the courses the grader can see. */
export async function gradingQueue({ courseIds, status = "pending" }: QueueFilter) {
  const filter: Record<string, unknown> = { status: ["pending", "graded", "returned"].includes(status) ? status : "pending" };
  if (courseIds) filter.courseId = { $in: courseIds };
  const subs = await ChallengeSubmission.find(filter).sort({ updatedAt: status === "pending" ? 1 : -1 }).limit(100).lean<ChallengeSubmissionDoc[]>();
  const [users, courses, modules, units] = await Promise.all([
    User.find({ _id: { $in: subs.map((s) => s.userId) } }).select("name surname username").lean(),
    Course.find({ _id: { $in: subs.map((s) => s.courseId) } }).select("title isChallenge").lean(),
    Module.find({ _id: { $in: subs.map((s) => s.moduleId) } }).select("title order").lean(),
    Unit.find({ _id: { $in: subs.map((s) => s.unitId) } }).select("title").lean(),
  ]);
  return subs.map((s) => ({
    ...s,
    user: users.find((u) => String(u._id) === String(s.userId)),
    course: courses.find((c) => String(c._id) === String(s.courseId)),
    module: modules.find((m) => String(m._id) === String(s.moduleId)),
    unit: units.find((u) => String(u._id) === String(s.unitId)),
  }));
}

export type GradeInput = { decision: "graded" | "returned"; grade?: number | null; feedback?: string };

/**
 * Validates (« graded ») or returns a speaking challenge. Validation awards the
 * learner XP once (and unlocks the next challenge day, via the progression rules).
 */
export async function gradeSubmission(graderId: string, submissionId: string, input: GradeInput) {
  if (!Types.ObjectId.isValid(submissionId)) throw new AdminError("Invalid ID.");
  const sub = await ChallengeSubmission.findById(submissionId);
  if (!sub) throw new AdminError("Submission not found.");
  const feedback = normalizeRich(input.feedback);
  if (input.decision === "returned" && !plainText(feedback)) throw new AdminError("Tell the learner what they need to redo.");
  const grade = input.grade === null || input.grade === undefined || Number.isNaN(input.grade) ? null : Math.round(input.grade);
  if (grade !== null && (grade < 0 || grade > sub.maxScore)) throw new AdminError(`The grade must be between 0 and ${sub.maxScore}.`);

  sub.status = input.decision;
  sub.grade = input.decision === "graded" ? grade : null;
  sub.feedback = feedback;
  sub.gradedBy = new Types.ObjectId(graderId);
  sub.gradedAt = new Date();
  await sub.save();

  if (input.decision === "graded") {
    try {
      await award(sub.userId, [{ key: `graded:${sub._id}`, source: "challenge_validated", amount: XP.challengeValidated, courseId: sub.courseId }]);
    } catch (e) {
      console.error("award failed", e);
    }
  }
  return sub.toObject() as ChallengeSubmissionDoc;
}
