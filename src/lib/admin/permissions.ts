/**
 * Staff capabilities (pure, unit-tested). Roles: user < english-coach /
 * instructor < account-manager < admin / super-admin.
 *  - admin / super-admin: everything;
 *  - account-manager: accounts and enrolments (no content editing, no grading);
 *  - instructor / english-coach: content editing, grading and teaching
 *    resources only for courses that list them in `Course.instructors`.
 */
import type { Role } from "@/models/User";

type Actor = { id: string; role: Role };
type CourseLike = { instructors?: readonly unknown[] | null };

const isAdmin = (a: Actor) => a.role === "admin" || a.role === "super-admin";
const teaches = (a: Actor, c: CourseLike) => (c.instructors ?? []).some((i) => String(i) === a.id);
const isTeacher = (a: Actor) => a.role === "instructor" || a.role === "english-coach";

export const can = {
  /** /admin at all. */
  enterAdmin: (a: Actor) => isAdmin(a) || a.role === "account-manager" || isTeacher(a),
  manageUsers: (a: Actor) => isAdmin(a) || a.role === "account-manager",
  createCourse: (a: Actor) => isAdmin(a),
  deleteCourse: (a: Actor) => isAdmin(a),
  /** Course settings that affect access: publication, instructors, challenge mode. */
  manageCourseSettings: (a: Actor) => isAdmin(a),
  viewCourse: (a: Actor, c: CourseLike) => isAdmin(a) || a.role === "account-manager" || (isTeacher(a) && teaches(a, c)),
  editContent: (a: Actor, c: CourseLike) => isAdmin(a) || (isTeacher(a) && teaches(a, c)),
  manageEnrollments: (a: Actor) => isAdmin(a) || a.role === "account-manager",
  grade: (a: Actor, c: CourseLike) => isAdmin(a) || (isTeacher(a) && teaches(a, c)),
  /** Course list filter: null = all courses, else only the ones they teach. */
  courseScope: (a: Actor): { instructors: string } | null => (isAdmin(a) || a.role === "account-manager" ? null : { instructors: a.id }),
};
