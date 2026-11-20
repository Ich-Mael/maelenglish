import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AssignmentSubmission, Course, Enrollment, Lesson, Module, User, UserStats, type Role } from "@/models";
import { updateAccount, listUsers, searchLearners } from "@/lib/admin/users";
import * as content from "@/lib/admin/content";
import { enroll, updateEnrollment } from "@/lib/admin/enrollments";
import { gradeSubmission, gradingQueue } from "@/lib/admin/grading";
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
    await expect(updateAccount(manager, String(learner._id), { ...base, role: "account-manager" })).rejects.toThrow(/attribuer/);
    await expect(updateAccount(admin, String(learner._id), { ...base, role: "admin" })).rejects.toThrow(/attribuer/);
    await expect(updateAccount(admin, String(admin._id), { name: "B", surname: "T", username: "boss", email: "boss@example.com", role: "user" })).rejects.toThrow(/base de données/);
    await expect(updateAccount(manager, String(admin._id), { name: "B", surname: "T", username: "boss", email: "boss@example.com" })).rejects.toThrow(/administrateur/);
    await expect(updateAccount(admin, String(learner._id), { ...base, username: "mgr" })).rejects.toThrow(/déjà pris/);
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
    expect(() => content.parsePrice("trente mille")).toThrow(/Prix invalide/);
    expect(() => content.parsePrice("-5")).toThrow(/Prix invalide/);
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

    const l = await content.createLesson(String(m1._id), "Practice", "practice");
    expect(l.isPublished).toBe(false);
    await expect(content.updateLesson(String(l._id), { title: "Practice", isPublished: true, exercises: [] })).rejects.toThrow(/au moins un exercice/);
    await expect(content.updateLesson(String(l._id), { title: "P", exercises: [{ kind: "gap", text: "no blank", answers: ["x"] }] })).rejects.toThrow(/___/);
    await content.updateLesson(String(l._id), { title: "P", isPublished: true, exercises: [{ kind: "speak", text: "Hello" }] });
    expect((await Lesson.findById(l._id))?.exercises).toHaveLength(1);

    await content.deleteModule(String(m1._id));
    expect(await Lesson.countDocuments({ moduleId: m1._id })).toBe(0);
  });

  it("saves quizzes (validated) and assignments", async () => {
    const c = await content.createCourse({ title: "T" });
    const m = await content.createModule(String(c._id), "M");
    const opts = [{ id: "a", text: "A" }, { id: "b", text: "B" }];
    await content.saveQuiz({ moduleId: String(m._id) }, { passingScore: 80, questions: [{ text: "Q", options: opts, correctOptionId: "b" }] });
    expect((await Module.findById(m._id))?.quiz?.passingScore).toBe(80);
    await expect(content.saveQuiz({ moduleId: String(m._id) }, { questions: [{ text: "Q", options: opts, correctOptionId: "z" }] })).rejects.toThrow(/bonne réponse/);
    await content.saveAssignment({ courseId: String(c._id) }, { instructions: "Record yourself", submissionType: "link" });
    expect((await Course.findById(c._id))?.finalProject?.submissionType).toBe("link");
  });

  it("refuses to delete a course with enrolments", async () => {
    const c = await content.createCourse({ title: "T" });
    const u = await mk("awa");
    await Enrollment.create({ userId: u._id, courseId: c._id });
    await expect(content.deleteCourse(String(c._id))).rejects.toThrow(/inscrits/);
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
    await expect(enroll(String(admin._id), String(c._id), { identifier: "awa" })).rejects.toThrow(/déjà inscrit/);
    await expect(enroll(String(admin._id), String(c._id), { identifier: "ghost" })).rejects.toThrow(/Aucun compte/);

    await updateEnrollment(String(enrollment._id), { status: "suspended" });
    expect((await Enrollment.findById(enrollment._id))?.suspendedReason).toBe("admin");
  });
});

describe("grading", () => {
  it("validates with XP once, returns with mandatory feedback, and unlocks the next challenge day", async () => {
    const coach = await mk("coach", "english-coach");
    const learner = await mk("awa");
    const c = await Course.create({ title: "Challenge", isChallenge: true, instructors: [coach._id] });
    const d1 = await Module.create({ courseId: c._id, order: 1, title: "D1", assignment: { instructions: "Write" } });
    const d2 = await Module.create({ courseId: c._id, order: 2, title: "D2", assignment: { instructions: "Write" } });
    const sub = await AssignmentSubmission.create({ userId: learner._id, courseId: c._id, moduleId: d1._id, assignmentType: "module_assignment", submissionType: "text", content: "Hello" });

    expect((await gradingQueue({ courseIds: [c._id as Types.ObjectId] })).map((s) => s.user?.username)).toEqual(["awa"]);
    expect(await gradingQueue({ courseIds: [] })).toHaveLength(0);

    await expect(gradeSubmission(String(coach._id), String(sub._id), { decision: "returned", feedback: "" })).rejects.toThrow(/reprendre/);
    await expect(gradeSubmission(String(coach._id), String(sub._id), { decision: "returned", feedback: "<p>&nbsp;</p>" })).rejects.toThrow(/reprendre/);
    await expect(gradeSubmission(String(coach._id), String(sub._id), { decision: "graded", grade: 150 })).rejects.toThrow(/entre 0 et 100/);

    await gradeSubmission(String(coach._id), String(sub._id), { decision: "graded", grade: 90, feedback: "Great" });
    await gradeSubmission(String(coach._id), String(sub._id), { decision: "graded", grade: 95 });
    expect((await UserStats.findOne({ userId: learner._id }))?.xp).toBe(20);

    const outline = computeOutline({
      modules: [d1, d2].map((m) => ({ id: String(m._id), title: m.title, hasQuiz: false, hasAssignment: true, isCheckpointRequired: true, lessons: [] })),
      completedLessonIds: new Set(),
      quizResults: new Map(),
      assignments: new Map([[String(d1._id), "graded" as const]]),
      finalExam: { exists: false, bestScore: null, passed: false },
      finalProject: { exists: false, status: null },
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
