import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Activity, ChallengeSubmission, Course, Enrollment, Module, QuizAttempt, Step, StepProgress, Unit, User } from "@/models";
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
  const course = await Course.create({
    title: "Aviation",
    program: "aviation",
    isPublished: true,
    finalExam: { questions: [{ text: "?", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correctOptionId: "a" }] },
  });
  const mod = await Module.create({ courseId: course._id, order: 1, title: "M1" });
  const unit = await Unit.create({ courseId: course._id, moduleId: mod._id, order: 1, title: "U1" });
  const broken = await Unit.create({ courseId: course._id, moduleId: mod._id, order: 2, title: "Broken" });
  const [a1, a2, ch] = await Promise.all([
    Activity.create({ type: "listen_choose", title: "A1", status: "ready" }),
    Activity.create({ type: "listen_choose", title: "A2", status: "ready" }),
    Activity.create({ type: "speaking_challenge", title: "C", status: "ready" }),
  ]);
  const base = { courseId: course._id, moduleId: mod._id, unitId: unit._id };
  const lesson = await Step.create({ ...base, position: 1, kind: "lesson", title: "L1", content: { intro: "<p>Hi</p>" } });
  const s2 = await Step.create({ ...base, position: 2, kind: "activity", title: "A1", activityId: a1._id, lessonId: lesson._id });
  const s3 = await Step.create({ ...base, position: 3, kind: "activity", title: "A2", activityId: a2._id, lessonId: lesson._id });
  const s4 = await Step.create({ ...base, position: 4, kind: "challenge", title: "C", activityId: ch._id });
  // Breaks the rules (one activity, no challenge): hidden from learners.
  const bl = await Step.create({ courseId: course._id, moduleId: mod._id, unitId: broken._id, position: 1, kind: "lesson", title: "X", content: { intro: "<p>X</p>" } });
  await Step.create({ courseId: course._id, moduleId: mod._id, unitId: broken._id, position: 2, kind: "activity", title: "A1", activityId: a1._id, lessonId: bl._id });
  return { user, course, mod, unit, steps: [lesson, s2, s3, s4] };
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
  it("builds the outline from step progress, scores and the challenge (valid units only)", async () => {
    const { user, course, mod, unit, steps } = await setup();
    await Enrollment.create({ userId: user._id, courseId: course._id });
    const me = asMe(user);
    const access = await courseAccess(me, String(course._id));
    if (!access.ok) throw new Error("no access");

    let tree = await courseTree(me, access);
    expect(tree.outline.modules[0].units.map((u) => u.title)).toEqual(["U1"]);
    expect(tree.problems.get(String(unit._id))).toEqual([]);
    expect(tree.outline.stepsTotal).toBe(4);
    expect(tree.outline.modules[0].units[0].steps.map((s) => s.state)).toEqual(["available", "locked", "locked", "locked"]);
    expect(tree.outline.modules[0].units[0].steps[1]).toMatchObject({ type: "listen_choose", passScore: 60 });

    for (const s of steps.slice(0, 3)) await StepProgress.create({ userId: user._id, courseId: course._id, stepId: s._id, score: s.kind === "activity" ? 40 : null });
    await ChallengeSubmission.create({ userId: user._id, courseId: course._id, moduleId: mod._id, unitId: unit._id, stepId: steps[3]._id, mediaId: steps[3]._id });
    await QuizAttempt.create({ userId: user._id, courseId: course._id, score: 100, passed: true });

    tree = await courseTree(me, access);
    expect(tree.outline.percent).toBe(100);
    expect(tree.outline.modules[0].units[0].steps[1].score).toBe(40);
    expect(tree.outline.modules[0].state).toBe("completed");
    expect(tree.outline.finalExam).toEqual({ state: "completed", bestScore: 100 });

    // Staff preview also shows the broken unit, flagged.
    const preview = await courseAccess(asMe(user, true), String(course._id));
    if (!preview.ok) throw new Error("no access");
    const staff = await courseTree(asMe(user, true), preview);
    expect(staff.outline.modules[0].units.map((u) => [u.title, u.hidden])).toEqual([["U1", false], ["Broken", true]]);
  });
});

describe("myCourses / myCourseForProgram", () => {
  it("lists published enrolments with progress and finds the programme course", async () => {
    const { user, course, steps } = await setup();
    const hidden = await Course.create({ title: "Hidden", program: "aviation", isPublished: false });
    await Enrollment.create({ userId: user._id, courseId: course._id });
    await Enrollment.create({ userId: user._id, courseId: hidden._id });
    await StepProgress.create({ userId: user._id, courseId: course._id, stepId: steps[0]._id });

    const list = await myCourses(asMe(user));
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ title: "Aviation", stepsDone: 1, stepsTotal: 4, state: "active", programName: "MaelEnglish for Aviation" });
    expect(await myCourseForProgram(asMe(user), "aviation")).toBe(String(course._id));
    expect(await myCourseForProgram(asMe(user), "business")).toBeNull();
  });
});
