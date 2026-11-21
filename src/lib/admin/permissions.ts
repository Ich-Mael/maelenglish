/**
 * Staff capabilities (pure, unit-tested). Roles: user < english-coach /
 * instructor < account-manager < admin / super-admin.
 *  - admin / super-admin: everything;
 *  - account-manager: accounts and enrolments (no content editing, no grading);
 *  - instructor / english-coach: content editing, grading and teaching
 *    resources only for courses that list them in `Course.instructors`; they also grade the
 *    submissions of the learners whose main coach they are (`User.coachId`).
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
  /** Labo (reusable practice activities): admins and teachers. Adding one to a unit also needs `editContent` on its course. */
  useLab: (a: Actor) => isAdmin(a) || isTeacher(a),
  manageEnrollments: (a: Actor) => isAdmin(a) || a.role === "account-manager",
  grade: (a: Actor, c: CourseLike) => isAdmin(a) || (isTeacher(a) && teaches(a, c)),
  /** One learner's submission: the course team, or the learner's main coach (`User.coachId`). */
  gradeSubmission: (a: Actor, c: CourseLike, learnerCoachId: unknown) => isAdmin(a) || (isTeacher(a) && (teaches(a, c) || (learnerCoachId != null && String(learnerCoachId) === a.id))),
  /** Assign a learner's main coach. */
  assignCoach: (a: Actor) => isAdmin(a) || a.role === "account-manager",
  /** Coach oversight dashboard and digests. */
  overseeCoaches: (a: Actor) => isAdmin(a),
  /** Course list filter: null = all courses, else only the ones they teach. */
  courseScope: (a: Actor): { instructors: string } | null => (isAdmin(a) || a.role === "account-manager" ? null : { instructors: a.id }),
};
