import type { Types } from "mongoose";
import { Activity, Course, Unit, User, WritingSubmission, type WritingSubmissionDoc } from "@/models";
import { responsibleCoaches } from "./coaching";

/*
 * Coach review of Lab « writing task » answers (framework-free): the queue of answers the grader
 * can see — their courses, plus the learners they coach —, pending (not reviewed since the last
 * try) or reviewed, oldest first / latest first.
 */
export async function writingQueue({ courseIds, myLearnerIds = [], status = "pending", coachId = null }: { courseIds: Types.ObjectId[] | null; myLearnerIds?: Types.ObjectId[]; status?: string; coachId?: string | null }) {
  const st = status === "reviewed" ? "reviewed" : "pending";
  const filter: Record<string, unknown> = { coachStatus: st, submittedAt: { $ne: null } };
  if (courseIds) filter.$or = [{ courseId: { $in: courseIds } }, { userId: { $in: myLearnerIds } }];
  const all = await WritingSubmission.find(filter)
    .sort(st === "pending" ? { submittedAt: 1 } : { reviewedAt: -1 })
    .limit(coachId ? 500 : 100)
    .lean<WritingSubmissionDoc[]>();
  // « My learners »: the answers this coach is responsible for (main coach, else course team).
  const owners = coachId ? await responsibleCoaches(all) : null;
  const subs = (owners ? all.filter((s) => owners.get(String(s._id))?.includes(coachId!)) : all).slice(0, 100);
  const [users, courses, units, activities] = await Promise.all([
    User.find({ _id: { $in: subs.map((s) => s.userId) } }).select("name surname username").lean(),
    Course.find({ _id: { $in: subs.map((s) => s.courseId) } }).select("title").lean(),
    Unit.find({ _id: { $in: subs.flatMap((s) => (s.unitId ? [s.unitId] : [])) } }).select("title").lean(),
    Activity.find({ _id: { $in: subs.map((s) => s.activityId) } }).select("title").lean(),
  ]);
  const by = <T extends { _id: unknown }>(list: T[], id: unknown) => list.find((x) => String(x._id) === String(id));
  return subs.map((s) => ({ ...s, user: by(users, s.userId), course: by(courses, s.courseId), unit: by(units, s.unitId), activity: by(activities, s.activityId) }));
}

/** Answers waiting for a review, for the Grading header. */
export const pendingWritingCount = (courseIds: Types.ObjectId[] | null, myLearnerIds: Types.ObjectId[] = []) =>
  WritingSubmission.countDocuments({ coachStatus: "pending", submittedAt: { $ne: null }, ...(courseIds ? { $or: [{ courseId: { $in: courseIds } }, { userId: { $in: myLearnerIds } }] } : {}) });
