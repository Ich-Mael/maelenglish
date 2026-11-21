import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Activity, ChallengeSubmission, Course, Enrollment, Module, Step, StepProgress, Unit, User, UserStats, type Role } from "@/models";
import { updateAccount, listUsers, searchLearners } from "@/lib/admin/users";
import * as content from "@/lib/admin/content";
import * as steps from "@/lib/admin/steps";
import { enroll, updateEnrollment } from "@/lib/admin/enrollments";
import { gradeSubmission, gradingQueue } from "@/lib/admin/grading";
import { sendsAllowed, sendsLeft, sendsUsed } from "@/lib/learn/challenge";
import { computeOutline } from "@/lib/learn/progress";

let mongo: MongoMemoryServer;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).syncIndexes()));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).deleteMany({})));
});

const mk = (username: string, role: Role = "user", extra: object = {}) => User.create({ name: username, surname: "Test", username, email: `${username}@example.com`, role, ...extra });

describe("updateAccount", () => {
  it("applies role rules", async () => {
    const admin = await mk("boss", "admin");
    const manager = await mk("mgr", "account-manager");
    const learner = await mk("awa");
    const base = { name: "Awa", surname: "T", username: "awa", email: "awa@example.com" };

    await updateAccount(admin, String(learner._id), { ...base, role: "instructor" });
    expect((await User.findById(learner._id))?.role).toBe("instructor");
    await expect(updateAccount(manager, String(learner._id), { ...base, role: "account-manager" })).rejects.toThrow(/assign this role/);
    await expect(updateAccount(admin, String(learner._id), { ...base, role: "admin" })).rejects.toThrow(/assign this role/);
    await expect(updateAccount(admin, String(admin._id), { name: "B", surname: "T", username: "boss", email: "boss@example.com", role: "user" })).rejects.toThrow(/only be changed in the database/);
    await expect(updateAccount(manager, String(admin._id), { name: "B", surname: "T", username: "boss", email: "boss@example.com" })).rejects.toThrow(/Only an administrator/);
    await expect(updateAccount(admin, String(learner._id), { ...base, username: "mgr" })).rejects.toThrow(/already taken/);
  });

  it("lists and searches users", async () => {
    await mk("awa", "user", { phoneNumber: "70112233" });
    await mk("bintou");
    expect((await listUsers({ q: "bin" })).items.map((u) => u.username)).toEqual(["bintou"]);
    expect((await listUsers({ q: "7011" })).items.map((u) => u.username)).toEqual(["awa"]);
    expect((await listUsers({})).total).toBe(2);
  });
});

describe("content", () => {
  it("creates, orders and deletes modules and lessons", async () => {
    const c = await content.createCourse({ title: "Aviation", program: "aviation", price: "30 000" });
    expect(c.price).toBe(30000);
    expect(content.parsePrice("")).toBeNull();
    expect(content.parsePrice("45.000 FCFA")).toBe(45000);
    expect(() => content.parsePrice("trente mille")).toThrow(/Invalid price/);
    expect(() => content.parsePrice("-5")).toThrow(/Invalid price/);
    const id = String(c._id);
    const m1 = await content.createModule(id, "M1");
    const m2 = await content.createModule(id, "M2");
    const m3 = await content.createModule(id, "M3");
    expect([m1.order, m2.order, m3.order]).toEqual([1, 2, 3]);
    await content.moveModule(String(m3._id), "up");
    const order = (await Module.find({ courseId: id }).sort({ order: 1 }).lean()).map((m) => m.title);
    expect(order).toEqual(["M1", "M3", "M2"]);

    await content.updateModule(String(m2._id), { title: "M2", summary: " Se présenter ", description: '<p>Intro <script>x()</script><span style="color:#b02a2a">rouge</span></p>' });
    const saved = await Module.findById(m2._id).lean();
    expect(saved?.summary).toBe("Se présenter");
    expect(saved?.description).toBe('<p>Intro <span style="color:#b02a2a">rouge</span></p>');
    await content.updateModule(String(m2._id), { title: "M2", description: "<p>&nbsp;</p>" });
    expect((await Module.findById(m2._id).lean())?.description).toBe("");

    await content.updateModule(String(m2._id), { title: "M2", level: "B1" });
    expect((await Module.findById(m2._id).lean())?.level).toBe("B1");
    await content.updateModule(String(m2._id), { title: "M2", level: "Z9" });
    expect((await Module.findById(m2._id).lean())?.level).toBe("");

    const [u] = await Unit.find({ moduleId: m1._id }).lean();
    await steps.addLesson(String(u._id), "L");
    await content.deleteModule(String(m1._id));
    expect(await Step.countDocuments({ moduleId: m1._id })).toBe(0);
    expect(await Unit.countDocuments({ moduleId: m1._id })).toBe(0);
  });

  it("manages units: first unit per module, objectives, order, delete with their steps", async () => {
    const c = await content.createCourse({ title: "Units" });
    const m = await content.createModule(String(c._id), "M");
    const [first] = await Unit.find({ moduleId: m._id }).lean();
    expect(first.title).toBe("Unité 1");
    const u2 = await content.createUnit(String(m._id), " Annoncer ", "Faire une annonce\n\n Saluer ");
    expect([u2.title, u2.order, u2.objectives]).toEqual(["Annoncer", 2, ["Faire une annonce", "Saluer"]]);
    await content.moveUnit(String(u2._id), "up");
    expect((await Unit.find({ moduleId: m._id }).sort({ order: 1 }).lean()).map((x) => x.title)).toEqual(["Annoncer", "Unité 1"]);
    await content.updateUnit(String(first._id), { title: "Accueillir", objectives: ["A", " "], estimatedMinutes: 45 });
    expect(await Unit.findById(first._id).lean()).toMatchObject({ objectives: ["A"], estimatedMinutes: 45 });
    await expect(content.updateUnit(String(first._id), { title: " " })).rejects.toThrow(/title/);

    const l = await steps.addLesson(String(u2._id), "L");
    const learner = await mk("awa");
    await StepProgress.create({ userId: learner._id, courseId: c._id, stepId: l._id });
    await content.deleteUnit(String(u2._id));
    expect(await Step.countDocuments({ unitId: u2._id })).toBe(0);
    expect(await StepProgress.countDocuments({ stepId: l._id })).toBe(0);
    await expect(content.deleteUnit(String(first._id))).rejects.toThrow(/at least one unit/);
  });

  it("builds a unit's steps: lessons and activities before the challenge, practised lesson, reorder, delete", async () => {
    const c = await content.createCourse({ title: "Steps" });
    const m = await content.createModule(String(c._id), "M");
    const [u] = await Unit.find({ moduleId: m._id }).lean();
    const unitId = String(u._id);
    const listen = async (title: string, status: "draft" | "ready" = "ready") => (await Activity.create({ type: "listen_choose", title, status })).toObject();
    const [a1, a2, a3] = await Promise.all([listen("A1"), listen("A2"), listen("A3", "draft")]);
    const ch = await Activity.create({ type: "speaking_challenge", title: "Défi", status: "ready" });

    await expect(steps.addLesson(unitId, " ")).rejects.toThrow(/title/);
    const l1 = await steps.addLesson(unitId, "L1");
    expect(await steps.attachActivity(String(ch._id), unitId)).toBe("challenge");
    // New steps go before the challenge; an activity practises the last lesson by default.
    expect(await steps.attachActivity(String(a1._id), unitId)).toBe("activity");
    await steps.attachActivity(String(a2._id), unitId);
    const kinds = async () => (await steps.stepsOf(unitId)).map((s) => `${s.position}${s.kind[0]}`).join(" ");
    expect(await kinds()).toBe("1l 2a 3a 4c");
    const acts = (await steps.stepsOf(unitId)).filter((s) => s.kind === "activity");
    expect(acts.every((s) => String(s.lessonId) === String(l1._id))).toBe(true);
    // The empty lesson keeps the unit hidden.
    expect((await steps.unitProblems(unitId)).map((p) => p.message)).toEqual([expect.stringMatching(/is empty/)]);
    await steps.updateLesson(String(l1._id), { title: "L1", content: { intro: "<p>Hello<script>x()</script></p>", sections: [{ type: "tip", text: "Astuce" }] } });
    expect((await Step.findById(l1._id).lean())?.content).toMatchObject({ intro: "<p>Hello</p>", sections: [{ type: "tip", text: "Astuce" }] });
    expect(await steps.unitProblems(unitId)).toEqual([]);

    // A second challenge replaces the first (one per unit).
    const ch2 = await Activity.create({ type: "speaking_challenge", title: "Défi 2", status: "draft" });
    await steps.attachActivity(String(ch2._id), unitId);
    expect(await Step.countDocuments({ unitId, kind: "challenge" })).toBe(1);
    expect((await steps.unitProblems(unitId))[0].message).toMatch(/Speaking challenge .* draft/);
    await steps.attachActivity(String(ch._id), unitId);

    // Reorder: anything goes, the rules are reported afterwards.
    const ids = (await steps.stepsOf(unitId)).map((s) => String(s._id));
    await steps.reorderSteps(unitId, [ids[1], ids[0], ids[2], ids[3]]);
    expect(await kinds()).toBe("1a 2l 3a 4c");
    expect((await steps.unitProblems(unitId)).map((p) => p.message).join(" ")).toMatch(/start with a lesson/);
    await expect(steps.reorderSteps(unitId, ids.slice(1))).rejects.toThrow(/reload/);
    await steps.moveStep(ids[1], "down");
    expect(await kinds()).toBe("1l 2a 3a 4c");

    // Activity step settings; a lesson of another unit is refused.
    const other = await content.createUnit(String(m._id), "U2");
    const foreign = await steps.addLesson(String(other._id), "X");
    await expect(steps.updateActivityStep(ids[1], { lessonId: String(foreign._id) })).rejects.toThrow(/isn't in this unit/);
    await steps.updateActivityStep(ids[1], { passScore: 150, estimatedMinutes: 4 });
    expect(await Step.findById(ids[1]).lean()).toMatchObject({ passScore: 100, estimatedMinutes: 4 });

    // Deleting the lesson leaves its activities without a lesson; positions stay 1…n.
    await steps.attachActivity(String(a3._id), unitId);
    await steps.deleteStep(String(l1._id));
    expect(await kinds()).toBe("1a 2a 3a 4c");
    expect(await Step.countDocuments({ unitId, lessonId: { $ne: null } })).toBe(0);
  });

  it("keeps one challenge submission per learner and unit", async () => {
    const c = await content.createCourse({ title: "Défi" });
    const m = await content.createModule(String(c._id), "M");
    const [u1] = await Unit.find({ moduleId: m._id }).lean();
    const u2 = await content.createUnit(String(m._id), "U2");
    const learner = await mk("awa");
    const sub = { userId: learner._id, courseId: c._id, moduleId: m._id, stepId: new Types.ObjectId(), mediaId: new Types.ObjectId() };
    await ChallengeSubmission.create({ ...sub, unitId: u1._id });
    await ChallengeSubmission.create({ ...sub, unitId: u2._id });
    await expect(ChallengeSubmission.create({ ...sub, unitId: u2._id })).rejects.toThrow(/duplicate key/);
    await content.deleteUnit(String(u2._id));
    expect(await ChallengeSubmission.countDocuments({ userId: learner._id })).toBe(1);
  });

  it("saves the final exam (validated)", async () => {
    const c = await content.createCourse({ title: "T" });
    const opts = [{ id: "a", text: "A" }, { id: "b", text: "B" }];
    await content.saveFinalExam(String(c._id), { passingScore: 80, questions: [{ text: "Q", options: opts, correctOptionId: "b" }] });
    expect((await Course.findById(c._id))?.finalExam?.passingScore).toBe(80);
    await expect(content.saveFinalExam(String(c._id), { questions: [{ text: "Q", options: opts, correctOptionId: "z" }] })).rejects.toThrow(/correct answer/);
  });

  it("refuses to delete a course with enrolments", async () => {
    const c = await content.createCourse({ title: "T" });
    const u = await mk("awa");
    await Enrollment.create({ userId: u._id, courseId: c._id });
    await expect(content.deleteCourse(String(c._id))).rejects.toThrow(/Learners are enrolled/);
  });

  it("only keeps staff accounts as instructors", async () => {
    const c = await content.createCourse({ title: "T" });
    const coach = await mk("coach", "english-coach");
    const learner = await mk("awa");
    await content.setInstructors(String(c._id), [String(coach._id), String(learner._id)]);
    expect((await Course.findById(c._id))?.instructors.map(String)).toEqual([String(coach._id)]);
  });
});

describe("enroll", () => {
  it("finds the learner, defaults to the cohort dates, refuses duplicates", async () => {
    const admin = await mk("boss", "admin");
    await mk("awa", "user", { phoneNumber: "70000001" });
    const c = await Course.create({ title: "T", startDate: new Date("2026-12-01"), endDate: new Date("2027-02-28") });
    const { enrollment } = await enroll(String(admin._id), String(c._id), { identifier: "70 00 00 01" });
    expect(enrollment.startDate?.toISOString().slice(0, 10)).toBe("2026-12-01");
    await expect(enroll(String(admin._id), String(c._id), { identifier: "awa" })).rejects.toThrow(/already enrolled/);
    await expect(enroll(String(admin._id), String(c._id), { identifier: "ghost" })).rejects.toThrow(/No account found/);

    await updateEnrollment(String(enrollment._id), { status: "suspended" });
    expect((await Enrollment.findById(enrollment._id))?.suspendedReason).toBe("admin");
  });
});

describe("grading", () => {
  it("limits a challenge to 3 sends; a return after the last send grants one more", async () => {
    const coach = await mk("coach2", "english-coach");
    const learner = await mk("ali");
    const c = await Course.create({ title: "C", instructors: [coach._id] });
    const m = await Module.create({ courseId: c._id, order: 1, title: "M" });
    const u = await Unit.create({ courseId: c._id, moduleId: m._id, title: "U" });
    expect([sendsUsed(null), sendsLeft(null)]).toEqual([0, 3]);
    // Submissions made before the counter count as one send.
    expect(sendsLeft({ mediaId: new Types.ObjectId() })).toBe(2);
    const sub = await ChallengeSubmission.create({ userId: learner._id, courseId: c._id, moduleId: m._id, unitId: u._id, stepId: new Types.ObjectId(), mediaId: new Types.ObjectId(), attempts: 2 });
    await gradeSubmission(String(coach._id), String(sub._id), { decision: "returned", feedback: "Again" });
    expect(sendsLeft(await ChallengeSubmission.findById(sub._id).lean())).toBe(1); // sends left: nothing granted
    await ChallengeSubmission.updateOne({ _id: sub._id }, { attempts: 3 });
    expect(sendsLeft(await ChallengeSubmission.findById(sub._id).lean())).toBe(0);
    await gradeSubmission(String(coach._id), String(sub._id), { decision: "returned", feedback: "Once more" });
    const after = await ChallengeSubmission.findById(sub._id).lean();
    expect([after?.extraAttempts, sendsAllowed(after), sendsLeft(after)]).toEqual([1, 4, 1]);
  });

  it("validates with XP once, returns with mandatory feedback, and unlocks the next challenge day", async () => {
    const coach = await mk("coach", "english-coach");
    const learner = await mk("awa");
    const c = await Course.create({ title: "Challenge", isChallenge: true, instructors: [coach._id] });
    const d1 = await Module.create({ courseId: c._id, order: 1, title: "D1" });
    const d2 = await Module.create({ courseId: c._id, order: 2, title: "D2" });
    const u1 = await Unit.create({ courseId: c._id, moduleId: d1._id, title: "U1" });
    const u2 = await Unit.create({ courseId: c._id, moduleId: d2._id, title: "U2" });
    const sub = await ChallengeSubmission.create({ userId: learner._id, courseId: c._id, moduleId: d1._id, unitId: u1._id, stepId: new Types.ObjectId(), mediaId: new Types.ObjectId() });

    expect((await gradingQueue({ courseIds: [c._id as Types.ObjectId] })).map((s) => [s.user?.username, s.unit?.title])).toEqual([["awa", "U1"]]);
    expect(await gradingQueue({ courseIds: [] })).toHaveLength(0);

    await expect(gradeSubmission(String(coach._id), String(sub._id), { decision: "returned", feedback: "" })).rejects.toThrow(/what they need to redo/);
    await expect(gradeSubmission(String(coach._id), String(sub._id), { decision: "returned", feedback: "<p>&nbsp;</p>" })).rejects.toThrow(/what they need to redo/);
    await expect(gradeSubmission(String(coach._id), String(sub._id), { decision: "graded", grade: 150 })).rejects.toThrow(/between 0 and 100/);

    await gradeSubmission(String(coach._id), String(sub._id), { decision: "graded", grade: 90, feedback: "Great" });
    await gradeSubmission(String(coach._id), String(sub._id), { decision: "graded", grade: 95 });
    expect((await UserStats.findOne({ userId: learner._id }))?.xp).toBe(20);

    const unit = (id: string) => ({ id, title: id, valid: true, steps: [{ id: `${id}-c`, kind: "challenge" as const, title: "C" }] });
    const outline = computeOutline({
      modules: [
        { id: String(d1._id), title: "D1", units: [unit(String(u1._id))] },
        { id: String(d2._id), title: "D2", units: [unit(String(u2._id))] },
      ],
      completedStepIds: new Set(),
      challenges: new Map([[String(u1._id), "graded" as const]]),
      finalExam: { exists: false, bestScore: null, passed: false },
      isChallenge: true,
      start: new Date(Date.now() - 3 * 86400_000),
    });
    expect(outline.modules[1].day?.state).toBe("current");
  });
});

describe("searchLearners (enrolment picker)", () => {
  it("finds active accounts by name, full name, email or number, learners first, flags enrolled ones", async () => {
    const c = await Course.create({ title: "C" });
    const awa = await mk("awa.diallo", "user", { name: "Awa", surname: "Diallo", phoneNumber: "70112233" });
    await mk("awa.coach", "english-coach", { name: "Awa", surname: "Coach" });
    const enrolled = await mk("awa.k", "user", { name: "Awa", surname: "Kaboré" });
    await mk("awa.off", "user", { name: "Awa", surname: "Off", isActive: false });
    await Enrollment.create({ userId: enrolled._id, courseId: c._id });

    const r = await searchLearners("awa", String(c._id));
    expect(r.map((m) => m.username)).toEqual(["awa.diallo", "awa.k", "awa.coach"]);
    expect(r.find((m) => m.username === "awa.k")?.enrolled).toBe(true);
    expect(r.find((m) => m.username === "awa.coach")?.staff).toBe(true);
    expect((await searchLearners("Awa Diallo", String(c._id))).map((m) => m.id)).toEqual([String(awa._id)]);
    expect((await searchLearners("awa.diallo@example", String(c._id)))[0]?.username).toBe("awa.diallo");
    expect((await searchLearners("70 11 22", String(c._id)))[0]?.username).toBe("awa.diallo");
    expect(await searchLearners("a", String(c._id))).toEqual([]);
    expect(await searchLearners("(.*", String(c._id))).toEqual([]);
  });
});
