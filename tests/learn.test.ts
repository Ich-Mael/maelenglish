import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AssignmentSubmission, Course, Enrollment, Lesson, LessonProgress, Module, QuizAttempt, User } from "@/models";
import { courseAccess, courseTree, myCourseForProgram, myCourses } from "@/lib/learn/queries";
import type { CurrentUser } from "@/lib/auth/dal";

let mongo: MongoMemoryServer;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  process.env.APP_DB = mongo.getUri();
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).syncIndexes()));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).deleteMany({})));
});

const asMe = (u: { _id: unknown; role?: string | null }, staff = false): CurrentUser => ({
  id: String(u._id),
  sessionId: "s",
  username: "x",
  name: "X",
  surname: "Y",
  role: (u.role ?? "user") as CurrentUser["role"],
  email: null,
  phoneE164: null,
  avatarUrl: null,
  isStaff: staff,
  isAdmin: false,
});

async function setup() {
  const user = await User.create({ name: "A", surname: "B", username: "learner", email: "l@example.com" });
  const course = await Course.create({ title: "Aviation", program: "aviation", isPublished: true });
  const mod = await Module.create({
    courseId: course._id,
    order: 1,
    title: "M1",
    quiz: { questions: [{ text: "?", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correctOptionId: "a" }] },
    assignment: { instructions: "Write" },
  });
  const l1 = await Lesson.create({ courseId: course._id, moduleId: mod._id, order: 1, title: "L1", type: "text" });
  const l2 = await Lesson.create({ courseId: course._id, moduleId: mod._id, order: 2, title: "L2", type: "text" });
  await Lesson.create({ courseId: course._id, moduleId: mod._id, order: 3, title: "Draft", type: "text", isPublished: false });
  return { user, course, mod, l1, l2 };
}

describe("courseAccess", () => {
  it("requires an enrolment in its window, on a published course", async () => {
    const { user, course } = await setup();
    const me = asMe(user);
    expect(await courseAccess(me, String(course._id))).toMatchObject({ ok: false, reason: "not-enrolled" });
    expect(await courseAccess(me, "nope")).toMatchObject({ ok: false, reason: "not-found" });

    const e = await Enrollment.create({ userId: user._id, courseId: course._id });
    expect(await courseAccess(me, String(course._id))).toMatchObject({ ok: true, preview: false, readOnly: false });

    await Enrollment.updateOne({ _id: e._id }, { endDate: new Date(Date.now() - 1000), startDate: new Date(Date.now() - 86400_000) });
    expect(await courseAccess(me, String(course._id))).toMatchObject({ ok: false, reason: "expired" });

    await Enrollment.updateOne({ _id: e._id }, { endDate: null, status: "suspended" });
    expect(await courseAccess(me, String(course._id))).toMatchObject({ ok: false, reason: "suspended" });

    await Enrollment.updateOne({ _id: e._id }, { status: "completed" });
    expect(await courseAccess(me, String(course._id))).toMatchObject({ ok: true, readOnly: true });

    await Enrollment.updateOne({ _id: e._id }, { status: "active" });
    await Course.updateOne({ _id: course._id }, { isPublished: false });
    expect(await courseAccess(me, String(course._id))).toMatchObject({ ok: false, reason: "not-enrolled" });
  });

  it("lets staff preview any course", async () => {
    const { user, course } = await setup();
    await Course.updateOne({ _id: course._id }, { isPublished: false });
    expect(await courseAccess(asMe({ ...user.toObject(), role: "english-coach" }, true), String(course._id))).toMatchObject({ ok: true, preview: true });
  });
});

describe("courseTree", () => {
  it("builds the outline from progress, attempts and submissions (published lessons only)", async () => {
    const { user, course, mod, l1, l2 } = await setup();
    await Enrollment.create({ userId: user._id, courseId: course._id });
    const me = asMe(user);
    const access = await courseAccess(me, String(course._id));
    if (!access.ok) throw new Error("no access");

    let { outline } = await courseTree(me, access);
    expect(outline.lessonsTotal).toBe(2);
    expect(outline.modules[0].lessons.map((l) => l.state)).toEqual(["available", "locked"]);
    expect(outline.modules[0].assignment?.state).toBe("available");

    for (const l of [l1, l2]) await LessonProgress.create({ userId: user._id, courseId: course._id, moduleId: mod._id, lessonId: l._id, status: "completed" });
    await QuizAttempt.create({ userId: user._id, courseId: course._id, moduleId: mod._id, quizType: "module_quiz", score: 40, passed: false });
    await QuizAttempt.create({ userId: user._id, courseId: course._id, moduleId: mod._id, quizType: "module_quiz", score: 100, passed: true });
    await AssignmentSubmission.create({ userId: user._id, courseId: course._id, moduleId: mod._id, assignmentType: "module_assignment", submissionType: "text", content: "x" });

    ({ outline } = await courseTree(me, access));
    expect(outline.percent).toBe(100);
    expect(outline.modules[0].quiz).toEqual({ state: "completed", bestScore: 100 });
    expect(outline.modules[0].assignment).toEqual({ state: "available", status: "pending" });
    expect(outline.modules[0].state).toBe("completed");
  });
});

describe("myCourses / myCourseForProgram", () => {
  it("lists published enrolments with progress and finds the programme course", async () => {
    const { user, course, mod, l1 } = await setup();
    const hidden = await Course.create({ title: "Hidden", program: "aviation", isPublished: false });
    await Enrollment.create({ userId: user._id, courseId: course._id });
    await Enrollment.create({ userId: user._id, courseId: hidden._id });
    await LessonProgress.create({ userId: user._id, courseId: course._id, moduleId: mod._id, lessonId: l1._id, status: "completed" });

    const list = await myCourses(asMe(user));
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ title: "Aviation", lessonsDone: 1, lessonsTotal: 2, state: "active", programName: "MaelEnglish for Aviation" });
    expect(await myCourseForProgram(asMe(user), "aviation")).toBe(String(course._id));
    expect(await myCourseForProgram(asMe(user), "business")).toBeNull();
  });
});
