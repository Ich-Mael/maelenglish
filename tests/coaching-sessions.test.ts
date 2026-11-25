import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CoachingSession, User } from "@/models";
import { CoachingError, createCoaching, joinSession, updateSession, type Viewer } from "@/lib/coaching/service";
import { attendanceOf, prepareSession, saveNextSteps, setAttendance, toggleNextStep } from "@/lib/coaching/sessions";
import { coachingProgress } from "@/lib/coaching/progress";
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
  const u = await User.create({ name: `S${n}`, surname: "T", username: `s${n}`, email: `s${n}@example.com`, role });
  return { id: String(u._id), role };
}
async function setup() {
  const admin = await user("admin");
  const coach = await user("english-coach");
  const awa = await user();
  const kofi = await user();
  const id = await createCoaching(admin, { kind: "group", memberIds: [awa.id, kofi.id], coachId: coach.id, title: "Équipe", goal: "<p>x</p>" });
  return { coach, awa, kofi, id };
}

describe("before and after a session", () => {
  it("agenda and preparation: coach only, cleaned", async () => {
    const { coach, awa, id } = await setup();
    const s = await CoachingSession.create({ coachingId: new Types.ObjectId(id), startsAt: new Date(Date.now() + 86_400_000) });
    const r = await prepareSession(coach, String(s._id), { agenda: "  Pitch\r\n\n\n\nQuestions  ", prep: "Relire l'offre" });
    expect(r.filled).toBe(true);
    expect(r.session).toMatchObject({ agenda: "Pitch\n\nQuestions", prep: "Relire l'offre" });
    await expect(prepareSession(awa, String(s._id), { agenda: "x" })).rejects.toThrow("Only the coach");
    expect((await prepareSession(coach, String(s._id), { agenda: "", prep: "" })).filled).toBe(false);
  });

  it("attendance: joined from the app by default, then confirmed by the coach; progress follows", async () => {
    const { coach, awa, kofi, id } = await setup();
    const now = new Date();
    const s = await CoachingSession.create({ coachingId: new Types.ObjectId(id), startsAt: new Date(now.getTime() - 5 * 60_000), durationMin: 60 });
    await joinSession(awa, String(s._id), now);
    const c = { memberIds: [new Types.ObjectId(awa.id), new Types.ObjectId(kofi.id)] };
    expect(attendanceOf((await CoachingSession.findById(s._id).lean())!, c)).toEqual({ confirmed: false, present: [awa.id], absent: [kofi.id] });
    // Kofi was there on the backup link: the coach ticks him; strangers are ignored.
    const outsider = new Types.ObjectId().toString();
    expect(await setAttendance(coach, String(s._id), [awa.id, kofi.id, outsider])).toEqual({ confirmed: true, present: [awa.id, kofi.id], absent: [] });
    expect((await CoachingSession.findById(s._id).lean())!.status).toBe("done");
    await expect(setAttendance(awa, String(s._id), [])).rejects.toThrow("Only the coach");
    let p = await coachingProgress(coach, id, undefined, { now: new Date(now.getTime() + 1000) });
    expect(p.members.find((m) => m.id === kofi.id)!.sessions).toEqual({ held: 1, attended: 1, missedLast: false });
    // Nobody came: « missed », and the progress flags it.
    await setAttendance(coach, String(s._id), [awa.id]);
    p = await coachingProgress(coach, id, undefined, { now: new Date(now.getTime() + 1000) });
    const k = p.members.find((m) => m.id === kofi.id)!;
    expect(k.sessions.missedLast).toBe(true);
    expect(k.flags).toContain("missed_session");
    // A future session can't get attendance.
    const later = await CoachingSession.create({ coachingId: new Types.ObjectId(id), startsAt: new Date(now.getTime() + 86_400_000) });
    await expect(setAttendance(coach, String(later._id), [awa.id])).rejects.toThrow("hasn't started");
  });

  it("next steps: one per line, kept ticks when unchanged, members tick their own", async () => {
    const { coach, awa, kofi, id } = await setup();
    const s = await CoachingSession.create({ coachingId: new Types.ObjectId(id), startsAt: new Date(Date.now() - 3600_000), status: "done", forUserId: new Types.ObjectId(awa.id) });
    expect(await saveNextSteps(coach, String(s._id), "- Refaire le pitch\n2. Apprendre 5 phrases\n\nRefaire le pitch")).toEqual(["Refaire le pitch", "Apprendre 5 phrases"]);
    const steps = (await CoachingSession.findById(s._id).lean())!.nextSteps;
    await toggleNextStep(awa, String(s._id), steps[0].id, true);
    // Kofi isn't concerned by Awa's check-in.
    await expect(toggleNextStep(kofi, String(s._id), steps[0].id, true)).rejects.toThrow(CoachingError);
    await expect(toggleNextStep(coach, String(s._id), steps[0].id, true)).rejects.toThrow("Only the people coached");
    await expect(toggleNextStep(awa, String(s._id), "n99", true)).rejects.toThrow("Step not found");
    // Editing: the unchanged step keeps Awa's tick, the new one starts empty with a new id.
    await saveNextSteps(coach, String(s._id), "Refaire le pitch\nPréparer 3 questions");
    const after = (await CoachingSession.findById(s._id).lean())!.nextSteps;
    expect(after.map((x) => [x.id, x.text, x.doneBy.map(String)])).toEqual([
      [steps[0].id, "Refaire le pitch", [awa.id]],
      ["n3", "Préparer 3 questions", []],
    ]);
    await toggleNextStep(awa, String(s._id), steps[0].id, false);
    expect((await CoachingSession.findById(s._id).lean())!.nextSteps[0].doneBy).toEqual([]);
    // The summary still works alongside.
    const r = await updateSession(coach, String(s._id), { summary: "Bonne séance." });
    expect(r.summaryPosted).toBe(true);
  });
});
