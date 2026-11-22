import { Types } from "mongoose";
import { ChallengeSubmission, Course, Enrollment, User, WritingSubmission, type ChallengeSubmissionDoc, type WritingSubmissionDoc } from "@/models";
import { AdminError } from "./errors";

/*
 * Coaching (framework-free, tests/coaching.test.ts): each learner may have a main coach
 * (`User.coachId`) who reviews their speaking challenges; without one, the course's teaching team
 * (`Course.instructors`) is responsible. A challenge waiting more than GRADING_DUE_HOURS is late
 * (user decision 2026-11-21: 48 h). Feeds the grading queue, the coach oversight page and the digests.
 */

export const GRADING_DUE_HOURS = 48;
const HOUR = 3_600_000;

/** Roles that can be someone's main coach. */
export const COACH_ROLES = ["english-coach", "instructor", "admin", "super-admin"] as const;

/** Active staff who can coach, by name. */
export async function coachOptions() {
  return User.find({ role: { $in: COACH_ROLES }, isActive: { $ne: false } }).select("name surname role email").sort({ name: 1, surname: 1 }).lean();
}

async function checkCoach(coachId: string | null) {
  if (coachId === null) return null;
  if (!Types.ObjectId.isValid(coachId)) throw new AdminError("Coach not found.");
  const coach = await User.findOne({ _id: coachId, role: { $in: COACH_ROLES }, isActive: { $ne: false } }).select("_id").lean();
  if (!coach) throw new AdminError("This person can't be a coach (coach, instructor or admin accounts only).");
  return coach._id;
}

/** Sets (or clears, with null) a learner's main coach. */
export async function setMainCoach(learnerId: string, coachId: string | null) {
  if (!Types.ObjectId.isValid(learnerId)) throw new AdminError("Account not found.");
  const id = await checkCoach(coachId);
  if (id && String(id) === learnerId) throw new AdminError("A person can't be their own coach.");
  const r = await User.updateOne({ _id: learnerId }, { $set: { coachId: id } });
  if (!r.matchedCount) throw new AdminError("Account not found.");
}

/** Gives every learner enrolled in a course this main coach (only those without one, unless `all`). Returns how many changed. */
export async function assignCourseCoach(courseId: string, coachId: string, opts: { all?: boolean } = {}) {
  if (!Types.ObjectId.isValid(courseId)) throw new AdminError("Course not found.");
  const id = await checkCoach(coachId);
  const learners = (await Enrollment.find({ courseId }).select("userId").lean()).map((e) => e.userId);
  const filter: Record<string, unknown> = { _id: { $in: learners, $ne: id }, role: "user" };
  filter.coachId = opts.all ? { $ne: id } : null; // never count learners who already have this coach
  return (await User.updateMany(filter, { $set: { coachId: id } })).modifiedCount;
}

/** When the current recording was sent. */
export const sentAt = (s: Pick<ChallengeSubmissionDoc, "submittedAt" | "updatedAt" | "history">) => new Date(s.submittedAt ?? s.history?.at(-1)?.sentAt ?? s.updatedAt);
export const hoursWaiting = (s: Parameters<typeof sentAt>[0], now = new Date()) => Math.max(0, (now.getTime() - sentAt(s).getTime()) / HOUR);
export const isLate = (s: Parameters<typeof sentAt>[0] & { status: string }, now = new Date()) => s.status === "pending" && hoursWaiting(s, now) > GRADING_DUE_HOURS;
/** Writing tasks: waiting since the latest version was sent. */
export const writingHoursWaiting = (s: { submittedAt?: Date | null; updatedAt?: Date | null }, now = new Date()) => Math.max(0, (now.getTime() - new Date(s.submittedAt ?? s.updatedAt ?? now).getTime()) / HOUR);
export const isWritingLate = (s: { coachStatus?: string | null; submittedAt?: Date | null; updatedAt?: Date | null }, now = new Date()) => s.coachStatus === "pending" && writingHoursWaiting(s, now) > GRADING_DUE_HOURS;

/** Responsible coach ids per submission: the learner's main coach, else the course team. */
export async function responsibleCoaches(subs: { _id: unknown; userId: Types.ObjectId; courseId: Types.ObjectId }[]) {
  const [learners, courses] = await Promise.all([
    User.find({ _id: { $in: subs.map((s) => s.userId) } }).select("coachId").lean(),
    Course.find({ _id: { $in: subs.map((s) => s.courseId) } }).select("instructors").lean(),
  ]);
  const coachOf = new Map(learners.map((u) => [String(u._id), u.coachId ? String(u.coachId) : null]));
  const teamOf = new Map(courses.map((c) => [String(c._id), (c.instructors ?? []).map(String)]));
  return new Map(subs.map((s) => [String(s._id), coachOf.get(String(s.userId)) ? [coachOf.get(String(s.userId))!] : (teamOf.get(String(s.courseId)) ?? [])]));
}

export type CoachStats = {
  coachId: string;
  name: string;
  email: string | null;
  learners: number;
  pending: number;
  late: number;
  reviewed: number;
  avgResponseH: number | null;
  avgGradePct: number | null;
  returnRatePct: number | null;
  lastReviewAt: Date | null;
};

/**
 * Per-coach figures: assigned learners, speaking challenges and writing tasks waiting (late ones),
 * and over the last `days` days the reviews they made — average response time (sent → reviewed),
 * average grade, share returned (a writing task « asked for a new version » counts as returned).
 */
export async function coachStats(now = new Date(), days = 30): Promise<CoachStats[]> {
  const since = new Date(now.getTime() - days * 24 * HOUR);
  const [coaches, learnerCounts, pending, reviewed, wPending, wReviewed] = await Promise.all([
    coachOptions(),
    User.aggregate<{ _id: Types.ObjectId; n: number }>([{ $match: { coachId: { $ne: null }, isActive: { $ne: false } } }, { $group: { _id: "$coachId", n: { $sum: 1 } } }]),
    ChallengeSubmission.find({ status: "pending" }).select("userId courseId submittedAt updatedAt history status").lean<ChallengeSubmissionDoc[]>(),
    ChallengeSubmission.find({ gradedAt: { $gte: since }, gradedBy: { $ne: null } }).select("gradedBy gradedAt submittedAt updatedAt history status grade maxScore").lean<ChallengeSubmissionDoc[]>(),
    // Writing tasks too (coach-reviewed, decision 2026-11-22).
    WritingSubmission.find({ coachStatus: "pending", submittedAt: { $ne: null } }).select("userId courseId submittedAt updatedAt coachStatus").lean<WritingSubmissionDoc[]>(),
    WritingSubmission.find({ reviewedAt: { $gte: since }, reviewedBy: { $ne: null } }).select("reviewedBy reviewedAt submittedAt coachScore redoAsked").lean<WritingSubmissionDoc[]>(),
  ]);
  const owners = await responsibleCoaches(pending);
  const wOwners = await responsibleCoaches(wPending);
  return coaches
    .map((c) => {
      const id = String(c._id);
      const mine = pending.filter((s) => owners.get(String(s._id))?.includes(id));
      const done = reviewed.filter((s) => String(s.gradedBy) === id);
      const wMine = wPending.filter((s) => wOwners.get(String(s._id))?.includes(id));
      const wDone = wReviewed.filter((s) => String(s.reviewedBy) === id);
      // Response time: sent → reviewed (submittedAt / last history entry; never negative).
      const times = [
        ...done.map((s) => Math.max(0, (new Date(s.gradedAt!).getTime() - new Date(s.submittedAt ?? s.history?.at(-1)?.sentAt ?? s.gradedAt!).getTime()) / HOUR)),
        ...wDone.map((s) => Math.max(0, (new Date(s.reviewedAt!).getTime() - new Date(s.submittedAt ?? s.reviewedAt!).getTime()) / HOUR)),
      ];
      const grades = [...done.filter((s) => s.status === "graded" && s.grade !== null && s.grade !== undefined).map((s) => ((s.grade ?? 0) / (s.maxScore || 100)) * 100), ...wDone.filter((s) => s.coachScore !== null && s.coachScore !== undefined).map((s) => s.coachScore as number)];
      const allDone = done.length + wDone.length;
      const returned = done.filter((s) => s.status === "returned").length + wDone.filter((s) => s.redoAsked).length;
      const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
      return {
        coachId: id,
        name: `${c.name ?? ""} ${c.surname ?? ""}`.trim(),
        email: c.email ?? null,
        learners: learnerCounts.find((l) => String(l._id) === id)?.n ?? 0,
        pending: mine.length + wMine.length,
        late: mine.filter((s) => isLate(s, now)).length + wMine.filter((s) => isWritingLate(s, now)).length,
        reviewed: allDone,
        avgResponseH: avg(times),
        avgGradePct: grades.length ? Math.round(avg(grades)!) : null,
        returnRatePct: allDone ? Math.round((returned / allDone) * 100) : null,
        lastReviewAt: allDone ? new Date(Math.max(...done.map((s) => new Date(s.gradedAt!).getTime()), ...wDone.map((s) => new Date(s.reviewedAt!).getTime()))) : null,
      };
    })
    .filter((s) => s.learners || s.pending || s.reviewed)
    .sort((a, b) => b.late - a.late || b.pending - a.pending || a.name.localeCompare(b.name));
}
