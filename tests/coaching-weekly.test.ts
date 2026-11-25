import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Coaching, CoachingAssessment, CoachingSentence, CoachingSession, CoachingVocab, User, VocabWord } from "@/models";
import { createCoaching, type Viewer } from "@/lib/coaching/service";
import { runCoachingWeekly, setWeeklyEmail, weeklyEmail, weeklySummary } from "@/lib/coaching/weekly";
import { dayKey } from "@/lib/gamification/rules";

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

let n = 0;
async function user(role: Viewer["role"] = "user"): Promise<Viewer> {
  n++;
  const u = await User.create({ name: `W${n}`, surname: "T", username: `w${n}`, email: `w${n}@example.com`, role });
  return { id: String(u._id), role };
}
const items = [1, 2, 3].map((i) => ({ id: `e${i}`, text: `x${i}`, translation: "", frNote: "", example: "", exampleFr: "" }));
// Monday 30 November 2026, 9:00 in Africa/Ouagadougou (UTC).
const MONDAY = new Date("2026-11-30T09:00:00Z");

describe("weekly coaching summary", () => {
  it("collects the week: vocabulary, reviews, next steps, next session and an assessment waiting", async () => {
    const admin = await user("admin");
    const coach = await user("english-coach");
    const awa = await user();
    const id = await createCoaching(admin, { kind: "individual", memberIds: [awa.id], coachId: coach.id, title: "Entretien", goal: "<p>x</p>" });
    const cid = new Types.ObjectId(id);
    const uid = new Types.ObjectId(awa.id);
    const v = await CoachingVocab.create({ coachingId: cid, day: dayKey(new Date(MONDAY.getTime() - 86_400_000)), items });
    await CoachingVocab.create({ coachingId: cid, day: dayKey(new Date(MONDAY.getTime() - 3 * 86_400_000)), items });
    await CoachingVocab.create({ coachingId: cid, day: "2026-10-01", items }); // older than a week
    await CoachingSentence.create({ coachingId: cid, vocabId: v._id, itemId: "e1", userId: uid, text: "A sentence with x1." });
    await VocabWord.create({ userId: uid, word: "x1", source: "coaching", coachingId: cid, dueAt: new Date(MONDAY.getTime() - 1000) });
    await CoachingSession.create({ coachingId: cid, startsAt: new Date(MONDAY.getTime() - 5 * 86_400_000), status: "done", nextSteps: [{ id: "n1", text: "Refaire le pitch" }, { id: "n2", text: "Fait", doneBy: [uid] }] });
    await CoachingSession.create({ coachingId: cid, startsAt: new Date(MONDAY.getTime() + 2 * 86_400_000), title: "Simulation", prep: "Relire l'offre" });
    await CoachingAssessment.create({ coachingId: cid, phase: "start", prompts: [{ id: "p1", text: "a" }, { id: "p2", text: "b" }] });

    const s = await weeklySummary({ _id: cid }, awa.id, MONDAY);
    expect(s.vocab).toEqual({ written: 1, expected: 12 });
    expect(s.toReview).toBe(1);
    expect(s.steps).toEqual(["Refaire le pitch"]);
    expect(s.session).toMatchObject({ title: "Simulation", prep: "Relire l'offre" });
    expect(s.assessment).toBe("start");
    const mail = weeklyEmail(s);
    expect(mail.empty).toBe(false);
    expect(mail.text).toContain("1 phrase écrite sur 12");
    expect(mail.text).toContain("- Refaire le pitch");
    expect(mail.text).toContain("À préparer : Relire l'offre");
    expect(mail.html).toContain("Évaluation orale");
    expect(weeklyEmail({ vocab: { written: 0, expected: 0 }, toReview: 0, steps: [], tasks: [], session: null, assessment: null }).empty).toBe(true);
  });

  it("runs on Mondays from 8:00, once a week, skipping members who turned it off and inactive coachings", async () => {
    const admin = await user("admin");
    const coach = await user("english-coach");
    const awa = await user();
    const kofi = await user();
    const id = await createCoaching(admin, { kind: "group", memberIds: [awa.id, kofi.id], coachId: coach.id, title: "Équipe", goal: "<p>x</p>" });
    await CoachingVocab.create({ coachingId: new Types.ObjectId(id), day: dayKey(new Date(MONDAY.getTime() - 86_400_000)), items });
    const paused = await createCoaching(admin, { kind: "individual", memberIds: [awa.id], coachId: coach.id, title: "Pause", goal: "<p>x</p>" });
    await Coaching.updateOne({ _id: paused }, { $set: { status: "paused" } });
    await setWeeklyEmail(kofi, id, false);
    await expect(setWeeklyEmail(coach, id, false)).rejects.toThrow("Only the people coached");

    expect(await runCoachingWeekly(new Date("2026-12-01T09:00:00Z"))).toEqual({ ran: false, emails: 0 }); // Tuesday
    expect(await runCoachingWeekly(new Date("2026-11-30T07:00:00Z"))).toEqual({ ran: false, emails: 0 }); // before 8:00
    expect(await runCoachingWeekly(MONDAY)).toEqual({ ran: true, emails: 1 }); // Awa only
    expect(await runCoachingWeekly(new Date("2026-11-30T15:00:00Z"))).toEqual({ ran: false, emails: 0 }); // already sent
    await setWeeklyEmail(kofi, id, true);
    expect((await Coaching.findById(id).lean())!.weeklyOff).toEqual([]);
  });
});
