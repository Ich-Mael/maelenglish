import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CoachingSession, CoachingVocab, User } from "@/models";
import { CoachingError, createCoaching, joinSession, postEntry, saveGoal, setGoalStatus, type Viewer } from "@/lib/coaching/service";
import { coachingProgress, flagsFor, monthsOf, periodOf, reportComment, saveReportComment } from "@/lib/coaching/progress";
import { saveExpression, writeCoachingSentence } from "@/lib/coaching/vocabulary";
import { setVideoProviderForTests } from "@/lib/video/daily";

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
  setVideoProviderForTests(undefined);
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).deleteMany({})));
});

let n = 0;
async function user(role: Viewer["role"] = "user"): Promise<Viewer> {
  n++;
  const u = await User.create({ name: `U${n}`, surname: "T", username: `p${n}`, email: `p${n}@example.com`, role });
  return { id: String(u._id), role };
}
const items = (k: string) => [1, 2, 3].map((i) => ({ id: `e${i}`, text: `${k} expression ${i}`, translation: "fr", frNote: "", example: "Example.", exampleFr: "" }));

describe("periods", () => {
  it("months in APP_TZ, the whole coaching, the month list", () => {
    const c = { startDate: new Date("2026-09-15T00:00:00Z"), createdAt: new Date("2026-09-10T00:00:00Z") };
    const now = new Date("2026-11-25T10:00:00Z");
    const p = periodOf("2026-10", c, now);
    expect(p).toMatchObject({ key: "2026-10", month: "2026-10" });
    expect(p.from.toISOString()).toBe("2026-10-01T00:00:00.000Z"); // Africa/Ouagadougou = UTC
    expect(p.to.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(periodOf(undefined, c, now).to).toEqual(now); // this month stops now
    expect(periodOf("2027-01", c, now).key).toBe("2026-11"); // the future → this month
    expect(periodOf("all", c, now).from).toEqual(c.startDate);
    expect(monthsOf(c, now)).toEqual(["2026-11", "2026-10", "2026-09"]);
  });

  it("flags", () => {
    const now = new Date("2026-11-25T10:00:00Z");
    const base = { vocab: { days: 5, expected: 30, written: 30, correct: 30, checked: 30, activeDays: 5, rate: 100 }, tasks: { total: 1, done: 1, late: 0, avgScore: null }, challenges: { sent: 0, validated: 0, redo: 0, avgGrade: null }, lastActive: now.toISOString() };
    const month = { from: new Date("2026-11-01T00:00:00Z") };
    expect(flagsFor(base, now, month)).toEqual([]);
    expect(flagsFor({ ...base, lastActive: null, vocab: { ...base.vocab, rate: 20 }, tasks: { ...base.tasks, late: 1 }, challenges: { ...base.challenges, redo: 1 } }, now, month)).toEqual(["inactive", "vocab_low", "tasks_late", "redo"]);
    // Early in a month nobody is « inactive » yet.
    expect(flagsFor({ ...base, lastActive: null }, new Date("2026-11-03T10:00:00Z"), month)).toEqual([]);
  });
});

describe("coaching progress", () => {
  it("counts each member's month; members see only themselves; the coach writes the report comment", async () => {
    const admin = await user("admin");
    const coach = await user("english-coach");
    const awa = await user();
    const kofi = await user();
    const outsider = await user();
    const id = await createCoaching(admin, { kind: "group", memberIds: [awa.id, kofi.id], coachId: coach.id, title: "Équipe", goal: "<p>x</p>" });
    const cid = new Types.ObjectId(id);
    // A vocabulary day today (6 sentences expected per member), one long ago (outside the period).
    const now = new Date();
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Ouagadougou" }).format(now);
    const v1 = await CoachingVocab.create({ coachingId: cid, day: today, items: items("a") });
    await CoachingVocab.create({ coachingId: cid, day: "2001-01-15", items: items("c") });
    await writeCoachingSentence(awa, id, String(v1._id), "e1", "I can use a expression 1 well.");
    await writeCoachingSentence(awa, id, String(v1._id), "e1", "my team likes a expression 1 too.");
    await saveExpression(awa, id, String(v1._id), "e2");
    // Goals: one group goal done by Awa, one only for Kofi.
    await saveGoal(coach, id, { title: "Pitch" });
    await saveGoal(coach, id, { title: "Kofi's", forUserId: kofi.id });
    const { goalsOf } = await import("@/lib/coaching/service");
    const goals = await goalsOf(coach, cid, "coach");
    await setGoalStatus(awa, id, String(goals.find((g) => g.title === "Pitch")!._id), "done");
    // A session done: Awa joined, Kofi didn't.
    const s = await CoachingSession.create({ coachingId: cid, startsAt: new Date(now.getTime() - 5 * 60_000), durationMin: 60 });
    await joinSession(awa, String(s._id), now);
    await CoachingSession.updateOne({ _id: s._id }, { $set: { status: "done" } });
    await postEntry(awa, id, { text: "Hello coach" });

    const period = periodOf(undefined, { startDate: null, createdAt: new Date() }, new Date(now.getTime() + 1000));
    const p = await coachingProgress(coach, id, period);
    const a = p.members.find((m) => m.id === awa.id)!;
    const k = p.members.find((m) => m.id === kofi.id)!;
    expect(a.vocab).toEqual({ days: 1, expected: 6, written: 2, correct: 1, checked: 2, activeDays: 1, rate: 33 });
    expect(k.vocab.rate).toBe(0);
    expect(a.notebook).toEqual({ saved: 2, known: 0 });
    expect(a.goals).toEqual({ total: 1, done: 1, inProgress: 0 });
    expect(k.goals).toEqual({ total: 2, done: 0, inProgress: 0 });
    expect(a.sessions).toEqual({ held: 1, attended: 1, missedLast: false });
    expect(k.sessions).toEqual({ held: 1, attended: 0, missedLast: true });
    expect(a.messages).toBe(1);
    expect(a.lastActive).not.toBeNull();
    expect(k.lastActive).toBeNull();
    expect(p.group).toMatchObject({ members: 2, sentences: 2, sessionsHeld: 1, attendanceRate: 50, correctRate: 50, goalsDone: 1, goalsTotal: 3 });

    // A member sees only their own row; outsiders nothing.
    expect((await coachingProgress(kofi, id, period)).members.map((m) => m.id)).toEqual([kofi.id]);
    expect((await coachingProgress(coach, id, period, { member: kofi.id })).members.map((m) => m.id)).toEqual([kofi.id]);
    await expect(coachingProgress(outsider, id, period)).rejects.toThrow(CoachingError);

    // The report comment: coach only, per month.
    await saveReportComment(coach, id, "2026-11", "  Bon mois.  ");
    expect(await reportComment(coach, id, "2026-11")).toBe("Bon mois.");
    expect(await reportComment(coach, id, "2026-10")).toBe("");
    await expect(saveReportComment(awa, id, "2026-11", "x")).rejects.toThrow("Only the coach");
    await expect(saveReportComment(coach, id, "bad", "x")).rejects.toThrow("Choose a month");
  });
});
