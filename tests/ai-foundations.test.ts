import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AiUsage, AppSettings, User } from "@/models";
import { canReadMedia } from "@/lib/media-access";
import { normalizeEnglish } from "@/lib/ai/text";
import { FakeFeedbackService, FakePronunciationService, FakeSpeechService, FakeTtsService, fakeAudio } from "@/lib/ai/fake";
import { AiQuotaError, assertCanUse, monthlyCapSeconds, recordUsage, remainingSeconds, usedSecondsThisMonth } from "@/lib/ai/metering";

describe("canReadMedia", () => {
  const learner = { id: "L", isAdmin: false };
  const coach = { id: "C", isAdmin: false };
  const other = { id: "X", isAdmin: false };
  const admin = { id: "A", isAdmin: true };
  const rec = { ownerId: "L", visibility: "private" as const, ownerCoachId: "C" };

  it("keeps learner recordings private to the learner, their coach and admins", () => {
    expect(canReadMedia(learner, rec)).toBe(true);
    expect(canReadMedia(coach, rec)).toBe(true);
    expect(canReadMedia(admin, rec)).toBe(true);
    expect(canReadMedia(other, rec)).toBe(false);
    expect(canReadMedia(null, rec)).toBe(false);
    expect(canReadMedia(other, { ...rec, ownerCoachId: null })).toBe(false);
  });

  it("shares a voice note with the learner it answers, and public media with everyone signed in", () => {
    expect(canReadMedia(learner, { ownerId: "C", visibility: "private", sharedWith: ["L"] })).toBe(true);
    expect(canReadMedia(other, { ownerId: "C", visibility: "private", sharedWith: ["L"] })).toBe(false);
    expect(canReadMedia(other, { ownerId: "A", visibility: "public" })).toBe(true);
    expect(canReadMedia(null, { ownerId: "A", visibility: "public" })).toBe(false);
  });
});

describe("text helpers and fake providers", () => {
  it("normalises English for comparison (case, punctuation, contractions both ways)", () => {
    expect(normalizeEnglish("I’m sending the FILE, okay?")).toBe("i am sending the file okay");
    expect(normalizeEnglish("Could you send me the file?")).toBe(normalizeEnglish("could you send me the file"));
  });

  it("gives predictable results without any network call", async () => {
    const t = await new FakeSpeechService().transcribe(fakeAudio("Could you send me the file", 2));
    expect(t.text).toBe("Could you send me the file");
    expect(t.words).toHaveLength(6);
    expect(t.words[5].end).toBeLessThanOrEqual(2);

    const p = await new FakePronunciationService().assess(fakeAudio("send me file"), "Send me the file");
    expect(p.completeness).toBe(75);
    expect(p.words.find((w) => w.word === "the")?.error).toBe("omission");

    const tts = await new FakeTtsService().synthesize("Hello there, nice to meet you");
    expect(tts.mime).toBe("audio/wav");
    expect(new TextDecoder().decode(tts.data.slice(0, 4))).toBe("RIFF");

    const fb = new FakeFeedbackService();
    const base = { prompt: "Make this a polite request: Send me the file.", targetStructure: "Could you + verb", acceptedAnswers: ["Could you send me the file?"], cefrLevel: "B1" };
    expect((await fb.gradeDrill({ ...base, answer: "could you send me the file" })).verdict).toBe("correct");
    expect((await fb.gradeDrill({ ...base, answer: "could you send the file" })).verdict).toBe("almost");
    expect((await fb.gradeDrill({ ...base, answer: "give it" })).verdict).toBe("incorrect");
  });
});

describe("AI metering", () => {
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

  it("counts speech seconds against the monthly cap, not LLM calls, and resets each month", async () => {
    const u = await User.create({ name: "Awa", surname: "T", username: "awa", email: "awa@example.com" });
    const id = String(u._id);
    const nov = new Date("2026-11-20T10:00:00Z");
    expect(await monthlyCapSeconds(id)).toBe(3600); // default 60 min
    await recordUsage(id, { kind: "stt", feature: "drill", provider: "fake", seconds: 600 }, nov);
    await recordUsage(id, { kind: "conversation", feature: "roleplay", provider: "fake", seconds: 1200 }, nov);
    await recordUsage(id, { kind: "llm", feature: "debrief", provider: "fake", tokens: 5000, costMicros: 20000 }, nov);
    expect(await usedSecondsThisMonth(id, nov)).toBe(1800);
    expect(await remainingSeconds(id, nov)).toBe(1800);
    await expect(assertCanUse(id, 1801, nov)).rejects.toBeInstanceOf(AiQuotaError);
    await expect(assertCanUse(id, 1800, nov)).resolves.toBeUndefined();
    expect(await remainingSeconds(id, new Date("2026-12-02T10:00:00Z"))).toBe(3600);
    expect(await AiUsage.countDocuments({ userId: u._id })).toBe(3);
  });

  it("uses the learner override, else the admin default", async () => {
    const u = await User.create({ name: "Kofi", surname: "A", username: "kofi", email: "kofi@example.com" });
    await AppSettings.create({ key: "global", aiMonthlyMinutes: 30 });
    expect(await monthlyCapSeconds(String(u._id))).toBe(1800);
    await User.updateOne({ _id: u._id }, { aiMonthlyMinutes: 120 });
    expect(await monthlyCapSeconds(String(u._id))).toBe(7200);
  });
});
