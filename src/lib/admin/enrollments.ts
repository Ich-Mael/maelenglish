import { Types } from "mongoose";
import { Course, Enrollment, User, isAccountActive, type CourseDoc, type EnrollmentDoc, type UserDoc } from "@/models";
import { findByIdentifier } from "@/lib/auth/service";
import { AdminError } from "./errors";

const date = (v?: string | null) => (v ? new Date(`${v}T00:00:00`) : null);
const endOfDay = (v?: string | null) => (v ? new Date(`${v}T23:59:59`) : null);

export type EnrollInput = { identifier: string; startDate?: string | null; endDate?: string | null };

/** Enrols a learner (found by username, email or WhatsApp number). Dates default to the course's cohort dates. */
export async function enroll(actorId: string, courseId: string, input: EnrollInput): Promise<{ user: UserDoc; course: CourseDoc; enrollment: EnrollmentDoc }> {
  const course = await Course.findById(courseId).lean<CourseDoc>();
  if (!course) throw new AdminError("Course not found.");
  const found = await findByIdentifier(input.identifier);
  if (found.ambiguous) throw new AdminError("Several accounts use this number: enter the username.");
  const user = found.user;
  if (!user) throw new AdminError("No account found with this identifier. Create the account first.");
  if (!isAccountActive(user)) throw new AdminError("This account is deactivated.");
  if (await Enrollment.exists({ userId: user._id, courseId: course._id })) throw new AdminError(`${user.name} is already enrolled in this course.`);

  const enrollment = await Enrollment.create({
    userId: user._id,
    courseId: course._id,
    startDate: date(input.startDate) ?? course.startDate ?? new Date(),
    endDate: endOfDay(input.endDate) ?? course.endDate ?? null,
    enrolledBy: actorId,
  });
  return { user, course, enrollment: enrollment.toObject() as EnrollmentDoc };
}

export type EnrollmentChange = { startDate?: string | null; endDate?: string | null; status?: "active" | "suspended" | "completed" };

export async function updateEnrollment(enrollmentId: string, change: EnrollmentChange) {
  if (!Types.ObjectId.isValid(enrollmentId)) throw new AdminError("Invalid ID.");
  const e = await Enrollment.findById(enrollmentId);
  if (!e) throw new AdminError("Enrolment not found.");
  if (change.startDate !== undefined) e.startDate = date(change.startDate) ?? e.startDate;
  if (change.endDate !== undefined) e.endDate = endOfDay(change.endDate);
  if (change.status) {
    e.status = change.status;
    e.suspendedReason = change.status === "suspended" ? "admin" : "";
  }
  await e.save();
}

export async function removeEnrollment(enrollmentId: string) {
  if (!Types.ObjectId.isValid(enrollmentId)) throw new AdminError("Invalid ID.");
  await Enrollment.deleteOne({ _id: enrollmentId });
}

export async function courseEnrollments(courseId: string) {
  const rows = await Enrollment.find({ courseId })
    .populate<{ userId: Pick<UserDoc, "_id" | "name" | "surname" | "username" | "email" | "phoneE164" | "isActive" | "coachId"> }>("userId", "name surname username email phoneE164 isActive coachId")
    .sort({ createdAt: -1 })
    .lean();
  return rows.filter((r) => r.userId);
}

/** Learners that can still be enrolled (for the picker): active, not staff-only filtering. */
export async function searchLearners(q: string, limit = 8) {
  const s = q.trim();
  if (s.length < 2) return [];
  const re = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  return User.find({ isActive: { $ne: false }, $or: [{ name: re }, { surname: re }, { username: re }, { email: re }] })
    .select("name surname username")
    .limit(limit)
    .lean();
}
