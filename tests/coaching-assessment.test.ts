import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Media, User } from "@/models";
import { CoachingError, createCoaching, type Viewer } from "@/lib/coaching/service";
import { DEFAULT_PROMPTS, answerPrompt, assessmentsFor, levelsFor, overall, reviewAssessment, setupAssessment, submitAssessment, suggestedPrompts } from "@/lib/coaching/assessment";

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
  const u = await User.create({ name: `A${n}`, surname: "T", username: `a${n}`, email: `a${n}@example.com`, role });
  return { id: String(u._id), role };
}
const recording = async (owner: Viewer) => String((await Media.create({ ownerId: owner.id, kind: "recording", key: `k${++n}`, mime: "audio/webm", size: 10, status: "ready", durationS: 30 }))._id);

describe("speaking assessment", () => {
  it("overall score", () => {
    expect(overall({ fluency: 6, vocabulary: 7, grammar: null, pronunciation: 5, clarity: 8 })).toBe(6.5);
    expect(overall({})).toBeNull();
  });

  it("start then end with the same questions; members answer, send; the coach scores; levels show start → end", async () => {
    const admin = await user("admin");
    const coach = await user("english-coach");
    const awa = await user();
    const kofi = await user();
    const id = await createCoaching(admin, { kind: "group", memberIds: [awa.id, kofi.id], coachId: coach.id, title: "Équipe", goal: "<p>x</p>" });

    // Setup: coach only, 2–5 questions.
    await expect(setupAssessment(awa, id, "start", { prompts: "a\nb" })).rejects.toThrow("Only the coach");
    await expect(setupAssessment(coach, id, "start", { prompts: "only one" })).rejects.toThrow("at least 2");
    await expect(setupAssessment(coach, id, "middle", { prompts: "a\nb" })).rejects.toThrow(CoachingError);
    expect((await suggestedPrompts(new Types.ObjectId(id), "start")).prompts).toEqual(DEFAULT_PROMPTS);
    const r = await setupAssessment(coach, id, "start", { prompts: "Présentez-vous\n\nVotre travail\nVotre objectif", maxSeconds: "120" });
    expect(r.created).toBe(true);
    expect(r.assessment.prompts.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
    expect(r.assessment.maxSeconds).toBe(120);

    // Answering: own recordings only; re-recording replaces; sending needs every answer.
    const m1 = await recording(awa);
    await expect(answerPrompt(awa, id, "start", "p1", await recording(kofi))).rejects.toThrow("Recording not found");
    await expect(answerPrompt(coach, id, "start", "p1", m1)).rejects.toThrow("Only the people coached");
    await expect(answerPrompt(awa, id, "end", "p1", m1)).rejects.toThrow("isn't open yet");
    await expect(answerPrompt(awa, id, "start", "p9", m1)).rejects.toThrow("Question not found");
    await answerPrompt(awa, id, "start", "p1", m1);
    expect(await answerPrompt(awa, id, "start", "p1", await recording(awa))).toEqual({ answered: 1, total: 3 });
    await expect(submitAssessment(awa, id, "start")).rejects.toThrow("2 left");
    // Questions are frozen once someone answered.
    await expect(setupAssessment(coach, id, "start", { prompts: "x\ny" })).rejects.toThrow("can't change");
    await answerPrompt(awa, id, "start", "p2", await recording(awa));
    await answerPrompt(awa, id, "start", "p3", await recording(awa));
    await expect(reviewAssessment(coach, String((await assessmentsFor(coach, id)).start.rows[0].id), { fluency: 5 })).rejects.toThrow("Not sent yet");
    await submitAssessment(awa, id, "start");
    await expect(answerPrompt(awa, id, "start", "p1", await recording(awa))).rejects.toThrow("Already sent");

    // A member sees only themselves; the coach everyone.
    expect((await assessmentsFor(kofi, id)).start.rows.map((x) => x.userId)).toEqual([kofi.id]);
    const view = await assessmentsFor(coach, id);
    const row = view.start.rows.find((x) => x.userId === awa.id)!;
    expect(row).toMatchObject({ submitted: true, reviewed: false, scores: null });
    expect(row.answers).toHaveLength(3);

    // Scoring: coach only, 0–10, at least one.
    await expect(reviewAssessment(awa, row.id!, { fluency: 5 })).rejects.toThrow("Only the coach");
    await expect(reviewAssessment(coach, row.id!, {})).rejects.toThrow("at least one score");
    await reviewAssessment(coach, row.id!, { fluency: "5", vocabulary: "6", grammar: "4", pronunciation: "15", clarity: "", comment: " Bon début. " });
    const scored = (await assessmentsFor(awa, id)).start.rows[0];
    expect(scored.scores).toEqual({ fluency: 5, vocabulary: 6, grammar: 4, pronunciation: 10, clarity: null });
    expect(scored).toMatchObject({ overall: 6.3, comment: "Bon début.", reviewed: true });

    // End: the start's questions are suggested.
    expect((await suggestedPrompts(new Types.ObjectId(id), "end")).prompts).toEqual(["Présentez-vous", "Votre travail", "Votre objectif"]);
    await setupAssessment(coach, id, "end", { prompts: "Présentez-vous\nVotre travail\nVotre objectif" });
    for (const p of ["p1", "p2", "p3"]) await answerPrompt(awa, id, "end", p, await recording(awa));
    await submitAssessment(awa, id, "end");
    const endRow = (await assessmentsFor(coach, id)).end.rows.find((x) => x.userId === awa.id)!;
    await reviewAssessment(coach, endRow.id!, { fluency: 8, vocabulary: 8, grammar: 7, pronunciation: 9, clarity: 8 });
    const levels = await levelsFor({ _id: new Types.ObjectId(id) }, [awa.id, kofi.id]);
    expect(levels[awa.id].start!.overall).toBe(6.3);
    expect(levels[awa.id].end!.overall).toBe(8);
    expect(levels[kofi.id]).toEqual({ start: null, end: null });
  });
});
