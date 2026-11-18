import { describe, expect, it } from "vitest";
import { can } from "@/lib/admin/permissions";

const admin = { id: "a", role: "admin" as const };
const manager = { id: "m", role: "account-manager" as const };
const coach = { id: "c", role: "english-coach" as const };
const instructor = { id: "i", role: "instructor" as const };
const learner = { id: "u", role: "user" as const };
const course = { instructors: ["i", "c"] };
const other = { instructors: ["zz"] };

describe("permissions", () => {
  it("lets every staff role enter the admin, not learners", () => {
    for (const a of [admin, manager, coach, instructor]) expect(can.enterAdmin(a)).toBe(true);
    expect(can.enterAdmin(learner)).toBe(false);
  });

  it("splits accounts / content / grading", () => {
    expect(can.manageUsers(manager)).toBe(true);
    expect(can.manageUsers(coach)).toBe(false);
    expect(can.editContent(manager, course)).toBe(false);
    expect(can.manageEnrollments(manager)).toBe(true);
    expect(can.manageEnrollments(instructor)).toBe(false);
    expect(can.grade(manager, course)).toBe(false);
  });

  it("scopes teachers to their courses", () => {
    expect(can.editContent(instructor, course)).toBe(true);
    expect(can.editContent(instructor, other)).toBe(false);
    expect(can.grade(coach, course)).toBe(true);
    expect(can.grade(coach, other)).toBe(false);
    expect(can.viewCourse(coach, other)).toBe(false);
    expect(can.courseScope(coach)).toEqual({ instructors: "c" });
    expect(can.courseScope(manager)).toBeNull();
  });

  it("keeps course creation and settings to admins", () => {
    expect(can.createCourse(admin)).toBe(true);
    expect(can.createCourse(instructor)).toBe(false);
    expect(can.manageCourseSettings(instructor)).toBe(false);
    expect(can.editContent(admin, other)).toBe(true);
  });
});
