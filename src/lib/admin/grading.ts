import { historyWithReviews, sendsLeft } from "@/lib/learn/challenge";
import { Types } from "mongoose";
import { normalizeRich, plainText } from "@/lib/rich-text";
import { ChallengeSubmission, Course, Media, Module, Unit, User, type ChallengeSubmissionDoc } from "@/models";
import { deleteObject } from "@/lib/storage";
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

/** `feedbackAudioMediaId`: the coach's voice note ("" / null = none, undefined = keep the current one). */
export type GradeInput = { decision: "graded" | "returned"; grade?: number | null; feedback?: string; feedbackAudioMediaId?: string | null };

/**
 * Validates (« graded ») or returns a speaking challenge. Validation awards the
 * learner XP once (and unlocks the next challenge day, via the progression rules).
 */
export async function gradeSubmission(graderId: string, submissionId: string, input: GradeInput) {
  if (!Types.ObjectId.isValid(submissionId)) throw new AdminError("Invalid ID.");
  const sub = await ChallengeSubmission.findById(submissionId);
  if (!sub) throw new AdminError("Submission not found.");
  const feedback = normalizeRich(input.feedback);

  // A review still on top of a pending recording answers the previous one (older rows): keep it
  // on that recording's history entry and start this review blank.
  const rows = historyWithReviews(sub.toObject());
  if (sub.status === "pending" && rows.length > 1 && (sub.feedback || sub.feedbackAudioMediaId)) {
    sub.set("history", rows);
    sub.feedback = "";
    sub.feedbackAudioMediaId = null;
    sub.feedbackAudioDurationS = 0;
  }

  // Voice note: a new one must be the grader's own ready « voice-note » upload.
  const current = sub.feedbackAudioMediaId ? String(sub.feedbackAudioMediaId) : "";
  const wanted = input.feedbackAudioMediaId === undefined ? current : input.feedbackAudioMediaId || "";
  let audio: { _id: Types.ObjectId; durationS?: number | null } | null = null;
  if (wanted && wanted !== current) {
    const m = Types.ObjectId.isValid(wanted) ? await Media.findById(wanted).select("kind status ownerId durationS").lean() : null;
    if (!m || m.kind !== "voice-note" || m.status !== "ready" || String(m.ownerId) !== graderId) throw new AdminError("Voice note not found: record it again.");
    audio = m;
  }

  if (input.decision === "returned" && !plainText(feedback) && !wanted) throw new AdminError("Tell the learner what they need to redo (comment or voice note).");
  const grade = input.grade === null || input.grade === undefined || Number.isNaN(input.grade) ? null : Math.round(input.grade);
  if (grade !== null && (grade < 0 || grade > sub.maxScore)) throw new AdminError(`The grade must be between 0 and ${sub.maxScore}.`);

  // Returned with no send left: grant one more, so the learner can redo it.
  if (input.decision === "returned" && sendsLeft(sub) <= 0) sub.extraAttempts = (sub.extraAttempts ?? 0) + 1;
  sub.status = input.decision;
  sub.grade = input.decision === "graded" ? grade : null;
  sub.feedback = feedback;
  if (wanted !== current) {
    sub.feedbackAudioMediaId = audio ? audio._id : null;
    sub.feedbackAudioDurationS = audio ? Math.round(audio.durationS ?? 0) : 0;
  }
  sub.gradedBy = new Types.ObjectId(graderId);
  sub.gradedAt = new Date();
  if (input.decision === "graded" && !sub.validatedAt) sub.validatedAt = sub.gradedAt;
  // This recording's history entry keeps the review (the coach's « Submission N »).
  sub.set("history", historyWithReviews(sub.toObject()));
  await sub.save();

  // The previous voice note is no longer used: remove it (best effort).
  if (current && wanted !== current) {
    const old = await Media.findOneAndDelete({ _id: current, kind: "voice-note" }).lean();
    if (old) await deleteObject(old.key).catch((e) => console.error("[grading] delete voice note", e));
  }

  if (input.decision === "graded") {
    try {
      await award(sub.userId, [{ key: `graded:${sub._id}`, source: "challenge_validated", amount: XP.challengeValidated, courseId: sub.courseId }]);
    } catch (e) {
      console.error("award failed", e);
    }
  }
  return sub.toObject() as ChallengeSubmissionDoc;
}
