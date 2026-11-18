import "server-only";
import { Types } from "mongoose";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { readCurrentUser, requireUser, type CurrentUser } from "@/lib/auth/dal";
import { Course, type CourseDoc } from "@/models";
import { can } from "./permissions";

export const actorOf = (me: CurrentUser) => ({ id: me.id, role: me.role });

/** Pages: a staff member, else redirect (learners go home). */
export async function requireStaff(next = "/admin"): Promise<CurrentUser> {
  const me = await requireUser(next);
  if (!can.enterAdmin(actorOf(me))) redirect("/mes-cours");
  await connectDB();
  return me;
}

/** Actions: the staff member or an error message. */
export async function staffOrThrow(): Promise<CurrentUser> {
  const me = await readCurrentUser();
  if (!me || !can.enterAdmin(actorOf(me))) throw new Error("Accès réservé à l'équipe.");
  await connectDB();
  return me;
}

export type CourseNeed = "view" | "edit" | "settings" | "grade" | "enroll";

export function allowed(me: CurrentUser, course: Pick<CourseDoc, "instructors">, need: CourseNeed): boolean {
  const a = actorOf(me);
  switch (need) {
    case "view":
      return can.viewCourse(a, course);
    case "edit":
      return can.editContent(a, course);
    case "settings":
      return can.manageCourseSettings(a);
    case "grade":
      return can.grade(a, course);
    case "enroll":
      return can.manageEnrollments(a);
  }
}

export async function courseFor(me: CurrentUser, courseId: string, need: CourseNeed): Promise<CourseDoc | null> {
  if (!Types.ObjectId.isValid(courseId)) return null;
  const course = await Course.findById(courseId).lean<CourseDoc>();
  if (!course || !allowed(me, course, need)) return null;
  return course;
}

/** Course ids visible to this staff member (null = all). */
export async function visibleCourseIds(me: CurrentUser): Promise<Types.ObjectId[] | null> {
  const scope = can.courseScope(actorOf(me));
  if (!scope) return null;
  return (await Course.find({ instructors: me.id }).select("_id").lean()).map((c) => c._id);
}
