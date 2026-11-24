import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ProfessionWords, User, VocabWord } from "@/models";
import { setAiServicesForTests } from "@/lib/ai";
import { FakeFeedbackService } from "@/lib/ai/fake";
import { saveWord } from "@/lib/dictionary";
import { buildTest, dailyWords, missedWords, dueCount, nextReview, professionKey, recordTest, saveDailyWord, setProfession, typedMatches, vocabularyStats, writeSentence } from "@/lib/vocabulary";

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

const learner = () => User.create({ name: "Awa", surname: "T", username: "awa", email: "awa@example.com" }).then((u) => String(u._id));
const DAY = 86_400_000;

describe("spaced review rules", () => {
  it("comes back after 1, 3, 7, 14, 30 days; a mistake starts over", () => {
    const now = new Date("2026-11-23T10:00:00Z");
    const days = (d: Date) => Math.round((d.getTime() - now.getTime()) / DAY);
    let s = 0;
    const seen: number[] = [];
    for (let i = 0; i < 5; i++) {
      const n = nextReview(s, true, now);
      seen.push(days(n.dueAt));
      s = n.stage;
    }
    expect(seen).toEqual([3, 7, 14, 30, 30]);
    expect(nextReview(3, true, now).known).toBe(true);
    expect(nextReview(4, false, now)).toMatchObject({ stage: 0, known: false });
    expect(days(nextReview(4, false, now).dueAt)).toBe(1);
  });

  it("forgives case, punctuation and one typo on longer words", () => {
    expect(typedMatches("passenger", "Passenger!")).toBe(true);
    expect(typedMatches("passenger", "pasenger")).toBe(true);
    expect(typedMatches("passenger", "pasengr")).toBe(false);
    expect(typedMatches("gate", "gat")).toBe(false); // short words: exact
    expect(professionKey("  Infirmière / Santé ")).toBe("infirmiere sante");
  });
});

describe("the vocabulary I need", () => {
  it("catches up missed days (in one AI call), never before the learner's first day, and gives two examples with French", async () => {
    const u = await learner();
    let calls = 0;
    const fake = new FakeFeedbackService();
    setAiServicesForTests({ feedback: Object.assign(Object.create(fake), { dailyVocabulary: (i: Parameters<FakeFeedbackService["dailyVocabulary"]>[0]) => (calls++, fake.dailyVocabulary(i)) }) });
    await setProfession(u, "Comptable");
    const day1 = new Date("2026-11-20T10:00:00Z");
    const today = await dailyWords(u, "Comptable", day1);
    expect(today[0].examples).toHaveLength(2);
    expect(today[0].examples[0].fr).toBeTruthy();
    // Back 3 days later: the 2 days in between are made in one call; nothing before the first day.
    const later = new Date("2026-11-23T10:00:00Z");
    const missed = await missedWords(u, "Comptable", "2026-11-20", later);
    expect(calls).toBe(2);
    expect(missed.map((g) => g.day)).toEqual(["2026-11-22", "2026-11-21", "2026-11-20"]);
    expect(missed.flatMap((g) => g.words.map((w) => w.word))).toHaveLength(6);
    expect(new Set(missed.flatMap((g) => g.words.map((w) => w.word))).size).toBe(6); // never repeated
    // Saved words leave the catch-up list.
    await saveDailyWord(u, missed[0].words[0].word, later);
    expect((await missedWords(u, "Comptable", "2026-11-20", later)).flatMap((g) => g.words)).toHaveLength(5);
    expect(calls).toBe(2);
  });

  it("gives 2 daily words per profession, shared and never repeated, and adds them to the notebook", async () => {
    const u = await learner();
    await expect(setProfession(u, " ")).rejects.toThrow(/job/);
    await setProfession(u, "Infirmière");
    const day1 = new Date("2026-11-23T10:00:00Z");
    const w1 = await dailyWords(u, "Infirmière", day1);
    expect(w1.map((w) => w.word)).toEqual(["infirmireworda", "infirmirewordb"]);
    expect(await ProfessionWords.countDocuments()).toBe(1);
    await dailyWords(u, "infirmiere", day1); // same key, same day: reused
    expect(await ProfessionWords.countDocuments()).toBe(1);
    const w2 = await dailyWords(u, "Infirmière", new Date("2026-11-24T10:00:00Z"));
    expect(w2.map((w) => w.word)).toEqual(["infirmirewordc", "infirmirewordd"]);
    await saveDailyWord(u, "infirmirewordc", new Date("2026-11-24T10:00:00Z"));
    expect((await VocabWord.findOne({ userId: u }).lean())).toMatchObject({ word: "infirmirewordc", source: "daily", translation: "[FR] infirmirewordc" });
    await saveDailyWord(u, "infirmireworda", new Date("2026-11-24T10:00:00Z")); // yesterday's word: still allowed
    await expect(saveDailyWord(u, "infirmireworda", new Date("2026-12-10T10:00:00Z"))).rejects.toThrow(/recent/);
  });

  it("corrects my own sentences and keeps them with the word", async () => {
    const u = await learner();
    await saveWord(u, "delay", { translation: "retard" });
    await expect(writeSentence(u, "gate", "The gate is open.")).rejects.toThrow(/notebook/);
    await expect(writeSentence(u, "delay", "delay")).rejects.toThrow(/full sentence/);
    expect(await writeSentence(u, "delay", "there is a delay today")).toMatchObject({ ok: false, corrected: "There is a delay today" });
    expect((await writeSentence(u, "delay", "The flight has a delay.")).ok).toBe(true);
    expect((await VocabWord.findOne({ userId: u }).lean())!.sentences).toHaveLength(2);
    expect((await vocabularyStats(u)).sentences).toBe(2);
  });

  it("tests due words with varied questions and moves them on", async () => {
    const u = await learner();
    for (const [w, t] of [["delay", "retard"], ["gate", "porte"], ["boarding", "embarquement"], ["luggage", "bagages"]]) await saveWord(u, w, { translation: t });
    await writeSentence(u, "delay", "The flight has a delay.");
    const now = new Date(Date.now() + 2 * DAY);
    expect(await dueCount(u)).toBe(0); // first test the next day
    expect(await dueCount(u, now)).toBe(4);
    const test = await buildTest(u, now);
    expect(test).toHaveLength(4);
    expect(new Set(test.map((q) => q.kind)).size).toBeGreaterThan(1);
    const blank = test.find((q) => q.kind === "blank");
    if (blank && blank.kind === "blank") expect(blank.sentence).toContain("_____");
    const answers = test.map((q) => ({ word: q.word, kind: q.kind, answer: q.word === "gate" ? "wrong" : q.kind === "choose" ? q.answer : q.word }));
    const r = await recordTest(u, answers, now);
    expect([r.total, r.right]).toEqual([4, 3]);
    expect(await dueCount(u, now)).toBe(0);
    const gate = (await VocabWord.findOne({ userId: u, word: "gate" }).lean())!;
    expect([gate.stage, Math.round((gate.dueAt!.getTime() - now.getTime()) / DAY)]).toEqual([0, 1]);
    // A « choose » answer must be the meaning, not the English word.
    expect((await recordTest(u, [{ word: "delay", kind: "choose", answer: "delay" }], now)).right).toBe(0);
  });
});

describe("daily word examples read aloud", () => {
  it("voices only the examples written for a profession, once (shared)", async () => {
    const { FakeTtsService } = await import("@/lib/ai/fake");
    const { dailyExampleAudio } = await import("@/lib/vocabulary");
    setAiServicesForTests({ feedback: new FakeFeedbackService(), tts: new FakeTtsService() });
    const u = await learner();
    await ProfessionWords.create({ key: "nurse", profession: "Nurse", day: "2026-11-23", items: [{ word: "shift", translation: "garde", frNote: "", examples: [{ en: "I am working the night shift this week.", fr: "Je fais la garde de nuit." }] }] });
    const url = await dailyExampleAudio(u, "Shift", 0, { voice: "us" });
    expect(url).toMatch(/\/api\/media\/local\?/);
    expect(await dailyExampleAudio(u, "shift", 0, { voice: "us" })).toBe(url);
    expect(await dailyExampleAudio(u, "shift", 1, { voice: "us" })).toBeNull();
    expect(await dailyExampleAudio(u, "other", 0, { voice: "us" })).toBeNull();
  });
});
