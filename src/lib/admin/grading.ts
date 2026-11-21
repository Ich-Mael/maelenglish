import { sendsLeft } from "@/lib/learn/challenge";
import { Types } from "mongoose";
import { normalizeRich, plainText } from "@/lib/rich-text";
import { ChallengeSubmission, Course, Module, Unit, User, type ChallengeSubmissionDoc } from "@/models";
import { award } from "@/lib/gamification/service";
import { XP } from "@/lib/gamification/rules";
import { AdminError } from "./errors";
import { hoursWaiting, isLate, responsibleCoaches, sentAt } from "./coaching";

export type QueueFilter = {
  /** Courses the grader sees (null = all, admins). */
  courseIds: Types.ObjectId[] | null;
  /** Also the learners whose main coach the grader is (outside their courses). */
  myLearnerIds?: Types.ObjectId[];
  status?: string;
  /** Only the submissions this coach is responsible for (main coach, else course team). */
  coachId?: string | null;
  lateOnly?: boolean;
};

/** Speaking challenges to review (oldest first), within what the grader can see; with responsible coaches and lateness. */
export async function gradingQueue({ courseIds, myLearnerIds = [], status = "pending", coachId = null, lateOnly = false }: QueueFilter, now = new Date()) {
  const st = ["pending", "graded", "returned"].includes(status) ? status : "pending";
  const filter: Record<string, unknown> = { status: st };
  if (courseIds) filter.$or = [{ courseId: { $in: courseIds } }, { userId: { $in: myLearnerIds } }];
  const all = await ChallengeSubmission.find(filter)
    .sort(st === "pending" ? { submittedAt: 1, updatedAt: 1 } : { gradedAt: -1, updatedAt: -1 })
    .limit(coachId || lateOnly ? 1000 : 100)
    .lean<ChallengeSubmissionDoc[]>();
  const owners = await responsibleCoaches(all);
  const subs = all.filter((s) => (!coachId || owners.get(String(s._id))?.includes(coachId)) && (!lateOnly || isLate(s, now))).slice(0, 100);
  const coachIds = [...new Set(subs.flatMap((s) => [...(owners.get(String(s._id)) ?? []), ...(s.gradedBy ? [String(s.gradedBy)] : [])]))];
  const [users, courses, modules, units, coaches] = await Promise.all([
    User.find({ _id: { $in: subs.map((s) => s.userId) } }).select("name surname username").lean(),
    Course.find({ _id: { $in: subs.map((s) => s.courseId) } }).select("title isChallenge").lean(),
    Module.find({ _id: { $in: subs.map((s) => s.moduleId) } }).select("title order").lean(),
    Unit.find({ _id: { $in: subs.map((s) => s.unitId) } }).select("title").lean(),
    User.find({ _id: { $in: coachIds } }).select("name surname").lean(),
  ]);
  const coachName = (id: string) => {
    const c = coaches.find((x) => String(x._id) === id);
    return c ? `${c.name} ${c.surname}`.trim() : "";
  };
  return subs.map((s) => ({
    ...s,
    user: users.find((u) => String(u._id) === String(s.userId)),
    course: courses.find((c) => String(c._id) === String(s.courseId)),
    module: modules.find((m) => String(m._id) === String(s.moduleId)),
    unit: units.find((u) => String(u._id) === String(s.unitId)),
    responsible: (owners.get(String(s._id)) ?? []).map((id) => ({ id, name: coachName(id) })),
    reviewer: s.gradedBy ? coachName(String(s.gradedBy)) : "",
    sentAt: sentAt(s),
    hoursWaiting: hoursWaiting(s, now),
    late: isLate(s, now),
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

  // Returned with no send left: grant one more, so the learner can redo it.
  if (input.decision === "returned" && sendsLeft(sub) <= 0) sub.extraAttempts = (sub.extraAttempts ?? 0) + 1;
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
