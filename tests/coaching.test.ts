import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ChallengeSubmission, Course, DigestLog, Enrollment, Module, Unit, User, WritingSubmission, type Role } from "@/models";
import { GRADING_DUE_HOURS, assignCourseCoach, coachStats, isLate, responsibleCoaches, setMainCoach } from "@/lib/admin/coaching";
import { gradingQueue } from "@/lib/admin/grading";
import { can } from "@/lib/admin/permissions";

vi.mock("server-only", () => ({}));
const sent: { to: string; subject: string }[] = [];
vi.mock("@/lib/email", async (orig) => {
  const real = await orig<typeof import("@/lib/email")>();
  const capture = (to: string | string[], subject: string) => {
    sent.push({ to: Array.isArray(to) ? to.join(", ") : to, subject });
    return Promise.resolve({ simulated: true });
  };
  return {
    ...real,
    sendCoachDigestEmail: (to: string, p: { items: unknown[] }) => capture(to, `coach:${p.items.length}`),
    sendAdminLateDigestEmail: (to: string[], p: { items: unknown[] }) => capture(to, `admin:${p.items.length}`),
    sendChallengeReviewedEmail: (to: string, p: { decision: string }) => capture(to, `learner:${p.decision}`),
    sendWritingReviewedEmail: (to: string, p: { redoAsked: boolean }) => capture(to, `writing:${p.redoAsked ? "redo" : "ok"}`),
  };
});
const { notifyChallengeReviewed, notifyWritingReviewed, runCoachDigest } = await import("@/lib/notifications");

let mongo: MongoMemoryServer;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).syncIndexes()));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  sent.length = 0;
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).deleteMany({})));
});

const mk = (username: string, role: Role = "user", extra: object = {}) => User.create({ name: username, surname: "T", username, email: `${username}@example.com`, role, ...extra });
const HOUR = 3_600_000;

async function setup() {
  const [admin, grace, paul, awa, ali] = [await mk("boss", "admin"), await mk("grace", "english-coach"), await mk("paul", "instructor"), await mk("awa"), await mk("ali")];
  const c = await Course.create({ title: "Business", instructors: [paul._id] });
  const m = await Module.create({ courseId: c._id, order: 1, title: "M" });
  const u = await Unit.create({ courseId: c._id, moduleId: m._id, title: "U" });
  await Enrollment.create([{ userId: awa._id, courseId: c._id, startDate: new Date() }, { userId: ali._id, courseId: c._id, startDate: new Date() }]);
  const sub = (userId: Types.ObjectId, extra: object = {}) =>
    ChallengeSubmission.create({ userId, courseId: c._id, moduleId: m._id, unitId: u._id, stepId: new Types.ObjectId(), mediaId: new Types.ObjectId(), ...extra });
  return { admin, grace, paul, awa, ali, c, sub };
}

describe("coaching", () => {
  it("assigns main coaches (one learner, or a course's learners) and checks the coach", async () => {
    const { grace, paul, awa, ali, c } = await setup();
    await expect(setMainCoach(String(awa._id), String(ali._id))).rejects.toThrow(/can't be a coach/);
    await expect(setMainCoach(String(grace._id), String(grace._id))).rejects.toThrow(/own coach/);
    await setMainCoach(String(awa._id), String(grace._id));
    expect(String((await User.findById(awa._id).lean())?.coachId)).toBe(String(grace._id));

    // Only learners without a coach, unless « all ».
    expect(await assignCourseCoach(String(c._id), String(paul._id))).toBe(1);
    expect(String((await User.findById(awa._id).lean())?.coachId)).toBe(String(grace._id));
    expect(String((await User.findById(ali._id).lean())?.coachId)).toBe(String(paul._id));
    expect(await assignCourseCoach(String(c._id), String(paul._id), { all: true })).toBe(1);
    await setMainCoach(String(awa._id), null);
    expect((await User.findById(awa._id).lean())?.coachId).toBeNull();
  });

  it("makes the main coach (else the course team) responsible; the main coach may grade outside the team", async () => {
    const { grace, paul, awa, ali, c, sub } = await setup();
    await setMainCoach(String(awa._id), String(grace._id));
    const [s1, s2] = [await sub(awa._id), await sub(ali._id)];
    const owners = await responsibleCoaches([s1, s2]);
    expect(owners.get(String(s1._id))).toEqual([String(grace._id)]);
    expect(owners.get(String(s2._id))).toEqual([String(paul._id)]);

    const actor = (u: { _id: unknown; role: Role }) => ({ id: String(u._id), role: u.role });
    expect(can.gradeSubmission(actor(grace), c, grace._id)).toBe(true); // main coach, not in the team
    expect(can.gradeSubmission(actor(grace), c, null)).toBe(false);
    expect(can.gradeSubmission(actor(paul), c, grace._id)).toBe(true); // course team

    // Grace's queue: her learner, even though she doesn't teach the course.
    const q = await gradingQueue({ courseIds: [], myLearnerIds: [awa._id] });
    expect(q.map((s) => String(s.userId))).toEqual([String(awa._id)]);
    expect((await gradingQueue({ courseIds: null, coachId: String(paul._id) })).map((s) => String(s.userId))).toEqual([String(ali._id)]);
  });

  it("flags challenges waiting more than 48 h and measures coaches", async () => {
    const { grace, awa, ali, sub } = await setup();
    await setMainCoach(String(awa._id), String(grace._id));
    await setMainCoach(String(ali._id), String(grace._id));
    const now = new Date("2026-11-21T12:00:00Z");
    const old = await sub(awa._id, { submittedAt: new Date(now.getTime() - (GRADING_DUE_HOURS + 2) * HOUR) });
    expect(isLate(old, now)).toBe(true);
    expect(isLate({ ...old.toObject(), submittedAt: new Date(now.getTime() - HOUR) }, now)).toBe(false);
    // A review 10 h after sending, grade 80 / 100; one returned after 30 h.
    await sub(ali._id, { status: "graded", grade: 80, submittedAt: new Date(now.getTime() - 20 * HOUR), gradedAt: new Date(now.getTime() - 10 * HOUR), gradedBy: grace._id, unitId: new Types.ObjectId() });
    await sub(ali._id, { status: "returned", submittedAt: new Date(now.getTime() - 40 * HOUR), gradedAt: new Date(now.getTime() - 10 * HOUR), gradedBy: grace._id, unitId: new Types.ObjectId() });

    const [g] = await coachStats(now);
    expect(g).toMatchObject({ name: "grace T", learners: 2, pending: 1, late: 1, reviewed: 2, avgResponseH: 20, avgGradePct: 80, returnRatePct: 50 });
    expect((await gradingQueue({ courseIds: null, lateOnly: true }, now)).map((s) => s.late)).toEqual([true]);
  });

  it("emails coaches once a day from 8:00 (late ones to admins too), and learners after a review", async () => {
    const { grace, paul, awa, ali, sub } = await setup();
    await setMainCoach(String(awa._id), String(grace._id));
    const morning = new Date("2026-11-21T07:00:00Z"); // Africa/Ouagadougou = UTC
    const nine = new Date("2026-11-21T09:00:00Z");
    await sub(awa._id, { submittedAt: new Date(nine.getTime() - 50 * HOUR) });
    await sub(ali._id, { submittedAt: new Date(nine.getTime() - 2 * HOUR), unitId: new Types.ObjectId() });

    expect((await runCoachDigest(morning)).ran).toBe(false);
    const r = await runCoachDigest(nine);
    expect(r).toMatchObject({ ran: true, pending: 2, late: 1, emails: 3 });
    expect(sent.map((m) => [m.to, m.subject]).sort()).toEqual([
      ["boss@example.com", "admin:1"],
      ["grace@example.com", "coach:1"],
      ["paul@example.com", "coach:1"],
    ]);
    expect((await runCoachDigest(new Date("2026-11-21T15:00:00Z"))).ran).toBe(false); // once a day
    expect((await runCoachDigest(new Date("2026-11-21T15:00:00Z"), { force: true })).ran).toBe(true); // « Send now »
    expect(await DigestLog.countDocuments()).toBe(2);

    sent.length = 0;
    const s = await sub(paul._id, { status: "returned", gradedBy: grace._id, feedback: "<p>Again</p>", unitId: new Types.ObjectId() });
    await notifyChallengeReviewed(String(s._id));
    expect(sent).toEqual([{ to: "paul@example.com", subject: "learner:returned" }]);
  });

  it("counts writing tasks too: digest, admin late list, coach figures, learner email after the review", async () => {
    const { grace, awa, ali, c } = await setup();
    await setMainCoach(String(awa._id), String(grace._id));
    await setMainCoach(String(ali._id), String(grace._id));
    const nine = new Date("2026-11-21T09:00:00Z");
    const w = (userId: Types.ObjectId, extra: object) => WritingSubmission.create({ userId, courseId: c._id, stepId: new Types.ObjectId(), activityId: new Types.ObjectId(), text: "Dear boss…", ...extra });
    await w(awa._id, { submittedAt: new Date(nine.getTime() - 50 * HOUR), coachStatus: "pending" });
    const done = await w(ali._id, { submittedAt: new Date(nine.getTime() - 30 * HOUR), coachStatus: "reviewed", reviewedBy: grace._id, reviewedAt: new Date(nine.getTime() - 6 * HOUR), coachScore: 70, redoAsked: true });

    const r = await runCoachDigest(nine);
    expect(r).toMatchObject({ ran: true, pending: 1, late: 1 });
    expect(sent.map((m) => [m.to, m.subject]).sort()).toEqual([
      ["boss@example.com", "admin:1"],
      ["grace@example.com", "coach:1"],
    ]);
    const [g] = await coachStats(nine);
    expect(g).toMatchObject({ pending: 1, late: 1, reviewed: 1, avgResponseH: 24, avgGradePct: 70, returnRatePct: 100 });

    sent.length = 0;
    await notifyWritingReviewed(String(done._id));
    expect(sent).toEqual([{ to: "ali@example.com", subject: "writing:redo" }]);
  });
});
