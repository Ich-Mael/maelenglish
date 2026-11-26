import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CoachingVocab, GapPractice, User, VocabWord } from "@/models";
import { setAiServicesForTests } from "@/lib/ai";
import { FakeFeedbackService } from "@/lib/ai/fake";
import { saveWord } from "@/lib/dictionary";
import { createCoaching, type Viewer } from "@/lib/coaching/service";
import { dayKey } from "@/lib/gamification/rules";
import { parseGaps } from "@/lib/lab/types";
import { answerMatches, attemptsByMember, cleanPractice, coachingPractice, practiceContent, submitPractice, vocabPractice } from "@/lib/gap-practice";

let mongo: MongoMemoryServer;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).syncIndexes()));
});
afterAll(async () => {
  setAiServicesForTests(null);
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  setAiServicesForTests({ feedback: new FakeFeedbackService() });
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).deleteMany({})));
});

let n = 0;
async function user(role: Viewer["role"] = "user"): Promise<Viewer> {
  n++;
  const u = await User.create({ name: `G${n}`, surname: "T", username: `g${n}`, email: `g${n}@example.com`, role });
  return { id: String(u._id), role };
}
const DAY = 86_400_000;

describe("checking the AI's blanks", () => {
  it("accepts the expression as given or inflected, placeholders replaced", () => {
    expect(answerMatches("negotiate", "negotiate")).toBe(true);
    expect(answerMatches("negotiated", "negotiate")).toBe(true);
    expect(answerMatches("studies", "study")).toBe(true);
    expect(answerMatches("followed up on", "follow up on")).toBe(true);
    expect(answerMatches("remind my manager of", "remind someone of")).toBe(true);
    expect(answerMatches("meeting", "deadline")).toBe(false);
    expect(answerMatches("follow", "follow up on")).toBe(false);
  });

  it("keeps one blank per expression, drops sentences without one, removes parser characters", () => {
    const items = [
      { key: "deadline", text: "deadline", translation: "échéance" },
      { key: "follow up on", text: "follow up on", translation: "faire le suivi de" },
    ];
    const r = cleanPractice(
      {
        title: "At work",
        lines: [
          { en: "The [deadline] is Friday and the [deadline] is close.", fr: "a" },
          { en: "I will [send] the report | today.", fr: "b" },
          { en: "@0:12 Please [follow up on] the order [now].", fr: "c" },
        ],
      },
      items,
      "sentences",
    );
    expect(r.lines.map((l) => l.en)).toEqual(["The [deadline] is Friday and the deadline is close.", "0:12 Please [follow up on] the order now."]);
    expect(r.gapItems).toEqual(["deadline", "follow up on"]);
    expect(parseGaps(practiceContent({ lines: r.lines, explanations: [] } as never)).gaps.map((g) => g.answers)).toEqual([["deadline"], ["follow up on"]]);
  });
});

describe("fill the gaps with my words", () => {
  it("needs 3 words; due words first; one practice per day and mode; grading feeds the spaced review", async () => {
    const u = await user();
    const now = new Date("2026-11-26T10:00:00Z");
    await saveWord(u.id, "invoice", { translation: "facture" });
    await saveWord(u.id, "deadline", { translation: "échéance" });
    expect(await vocabPractice(u.id, "sentences", {}, now)).toEqual({ notEnough: 2 });
    await saveWord(u.id, "supplier", { translation: "fournisseur" });
    await VocabWord.updateMany({ userId: u.id }, { $set: { dueAt: new Date(now.getTime() + 3 * DAY), stage: 1 } });
    await VocabWord.updateOne({ userId: u.id, word: "deadline" }, { $set: { dueAt: new Date(now.getTime() - DAY) } });

    const p = await vocabPractice(u.id, "sentences", {}, now);
    if ("notEnough" in p) throw new Error("expected a practice");
    expect(p.items[0].key).toBe("deadline");
    expect(p.gapItems).toHaveLength(3);
    expect(p.explanations[0]).toBe("« deadline » : échéance");
    expect(String((await vocabPractice(u.id, "sentences", {}, now) as { _id: unknown })._id)).toBe(String(p._id));
    expect(String((await vocabPractice(u.id, "sentences", { fresh: true }, now) as { _id: unknown })._id)).not.toBe(String(p._id));

    // Someone else can't send it.
    const other = await user();
    await expect(submitPractice(other, String(p._id), {})).rejects.toThrow("Practice not found");

    // deadline (due) right → moves on; invoice wrong → tomorrow; supplier right but not due → unchanged.
    const gapOf = (k: string) => `g${p.gapItems.indexOf(k) + 1}`;
    const r = await submitPractice(u, String(p._id), { [gapOf("deadline")]: "deadline", [gapOf("invoice")]: "bill", [gapOf("supplier")]: "suplier" }, now);
    expect([r.right, r.total, r.score, r.saved]).toEqual([2, 3, 67, true]);
    const words = await VocabWord.find({ userId: u.id }).lean();
    const w = (k: string) => words.find((x) => x.word === k)!;
    expect([w("deadline").stage, w("deadline").dueAt!.getTime()]).toEqual([2, now.getTime() + 7 * DAY]);
    expect([w("invoice").stage, w("invoice").dueAt!.getTime()]).toEqual([0, now.getTime() + DAY]);
    expect([w("supplier").stage, w("supplier").dueAt!.getTime()]).toEqual([1, now.getTime() + 3 * DAY]);
    expect((await GapPractice.findById(p._id).lean())!.attempts).toHaveLength(1);
  });

  it("a coaching: the week's expressions, shared by the group; the coach tries it without saving", async () => {
    const admin = await user("admin");
    const coach = await user("english-coach");
    const awa = await user();
    const kofi = await user();
    const outsider = await user();
    const id = await createCoaching(admin, { kind: "group", memberIds: [awa.id, kofi.id], coachId: coach.id, title: "Pitch", goal: "<p>x</p>" });
    const now = new Date("2026-11-26T10:00:00Z");
    const items = (d: number) => [1, 2].map((i) => ({ id: `e${i}`, text: `expression ${d}${i}`, translation: "fr", frNote: "", example: "", exampleFr: "" }));
    await CoachingVocab.create({ coachingId: new Types.ObjectId(id), day: dayKey(now), items: items(1) });
    expect(await coachingPractice(awa, id, "story", now)).toEqual({ notEnough: 2 });
    await CoachingVocab.create({ coachingId: new Types.ObjectId(id), day: dayKey(new Date(now.getTime() - 2 * DAY)), items: items(2) });
    await CoachingVocab.create({ coachingId: new Types.ObjectId(id), day: "2026-10-01", items: items(3) }); // too old

    const p = await coachingPractice(awa, id, "story", now);
    if ("notEnough" in p) throw new Error("expected a practice");
    expect(p.items.map((i) => i.text)).toEqual(["expression 11", "expression 12", "expression 21", "expression 22"]);
    expect(String(((await coachingPractice(kofi, id, "story", now)) as { _id: unknown })._id)).toBe(String(p._id));
    await expect(coachingPractice(outsider, id, "story", now)).rejects.toThrow();
    await expect(submitPractice(outsider, String(p._id), {})).rejects.toThrow("Practice not found");

    // A member with the expression in their notebook: reviewed. The coach: graded, nothing kept.
    await VocabWord.create({ userId: awa.id, word: "expression 11", kind: "phrase", source: "coaching", coachingId: new Types.ObjectId(id), dueAt: null });
    const answers = Object.fromEntries(p.gapItems.map((k, i) => [`g${i + 1}`, k]));
    expect((await submitPractice(awa, String(p._id), answers, now)).score).toBe(100);
    expect((await VocabWord.findOne({ userId: awa.id }).lean())!.stage).toBe(1);
    expect((await submitPractice(coach, String(p._id), answers, now)).saved).toBe(false);
    const scores = attemptsByMember((await GapPractice.findById(p._id).lean())!);
    expect([scores.get(awa.id), scores.has(coach.id)]).toEqual([{ best: 100, tries: 1 }, false]);
  });
});
