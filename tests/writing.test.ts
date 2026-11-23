import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AiUsage, StepProgress, User, WritingSubmission } from "@/models";
import { cleanContent, contentProblem } from "@/lib/lab/content";
import { cleanFeedback, previewCorrection, reviewWriting, sendWriting, wordCount, writingSendsLeft, MAX_WRITING_SENDS } from "@/lib/lab/writing";
import { setAiServicesForTests, type FeedbackService } from "@/lib/ai";
import { FakeFeedbackService } from "@/lib/ai/fake";

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

const content = cleanContent("writing_task", { prompt: "<p>Écrivez à votre chef pour demander un jour de congé.</p>", checklist: "the reason\nyour work", minWords: "20", maxWords: "60", modelAnswer: "Dear Mr Traoré, ..." });
const target = () => ({ courseId: new Types.ObjectId(), stepId: new Types.ObjectId(), activityId: new Types.ObjectId(), level: "A2", content });
const answer = "Dear Mr Traore, I would like a day off on Friday because of a family reason. My colleague Awa will do my work while I am away. Thank you for your understanding. Best regards.";
const learner = () => User.create({ name: "Awa", surname: "T", username: "awa", email: "awa@example.com" });

describe("writing task (sent to the coach, AI draft for the coach)", () => {
  it("cleans the content: prompt required, word range kept sensible", () => {
    expect([content.minWords, content.maxWords, content.checklist]).toEqual([20, 60, ["the reason", "your work"]]);
    expect(cleanContent("writing_task", { prompt: "<p>x</p>", minWords: "150", maxWords: "60" }).maxWords).toBe(170);
    expect(contentProblem("writing_task", content)).toBeNull();
    expect(contentProblem("writing_task", cleanContent("writing_task", { prompt: "<p> </p>" }))).toMatch(/Write the prompt/);
    expect(wordCount("I'm here — at the office, OK?")).toBe(6);
  });

  it("sends versions with an AI draft (cost recorded), 3 sends, and still sends when the AI fails", async () => {
    const u = await learner();
    const t = target();
    await expect(sendWriting(String(u._id), t, "Too short.")).rejects.toThrow(/at least 6 words/);
    const first = await sendWriting(String(u._id), t, answer);
    expect([first.coachStatus, first.attempts, (first.correction as { checklist: { met: boolean }[] }).checklist.map((c) => c.met), writingSendsLeft(first)]).toEqual(["pending", 1, [true, true], 2]);
    expect(await AiUsage.countDocuments({ userId: u._id, kind: "llm", feature: "writing_task" })).toBe(1);

    // The AI fails: the version still reaches the coach, without a draft.
    const broken: FeedbackService = { name: "broken", gradeDrill: async () => ({ verdict: "incorrect", explanation: "", modelAnswer: "" }), correctWriting: async () => Promise.reject(new Error("down")), translateWord: async () => Promise.reject(new Error("down")), rolePlayDebrief: async () => Promise.reject(new Error("down")), rolePlayHelp: async () => Promise.reject(new Error("down")), diagnosticReport: async () => Promise.reject(new Error("down")), dailyVocabulary: async () => Promise.reject(new Error("down")), checkSentence: async () => Promise.reject(new Error("down")) };
    setAiServicesForTests({ feedback: broken });
    const second = await sendWriting(String(u._id), t, answer + " Again.");
    expect([second.attempts, second.correction, second.history.length]).toEqual([2, null, 2]);
    setAiServicesForTests({ feedback: new FakeFeedbackService() });
    await sendWriting(String(u._id), t, answer);
    await expect(sendWriting(String(u._id), t, answer)).rejects.toThrow(new RegExp(`your ${MAX_WRITING_SENDS} versions`));
    // Staff preview: the draft, nothing saved.
    const draft = await previewCorrection(String(u._id), target(), answer);
    expect([draft.score > 0, await WritingSubmission.countDocuments()]).toEqual([true, 1]);
  });

  it("coach review: edited feedback + comment + score go to the learner; asking for a new version grants one when none is left", async () => {
    const u = await learner();
    const coach = await User.create({ name: "Ish", surname: "Z", username: "ish", email: "ish@example.com", role: "english-coach" });
    const t = target();
    for (let i = 0; i < MAX_WRITING_SENDS; i++) await sendWriting(String(u._id), t, answer);
    const sub = (await WritingSubmission.findOne({ userId: u._id }).lean())!;
    await StepProgress.create({ userId: u._id, courseId: t.courseId, stepId: t.stepId, score: null });
    await expect(reviewWriting(String(coach._id), String(sub._id), { feedback: {}, comment: "<p> </p>" })).rejects.toThrow(/Write a comment/);
    const edited = { score: 81, summary: "Très clair.", strengths: ["Poli", ""], errors: [{ quote: "a family reason", correction: "family reasons", explanation: "Plus naturel." }, { quote: "", correction: "" }], checklist: [{ item: "the reason", met: true, comment: "OK" }], corrected: "Dear Mr Traoré, …", extra: "x" };
    const reviewed = await reviewWriting(String(coach._id), String(sub._id), { feedback: edited, comment: "<p>Bravo !</p>", askNewVersion: true });
    expect([reviewed.coachStatus, reviewed.coachScore, reviewed.redoAsked, reviewed.extraAttempts, writingSendsLeft(reviewed)]).toEqual(["reviewed", 81, true, 1, 1]);
    expect(reviewed.feedback).toEqual({ score: 81, summary: "Très clair.", strengths: ["Poli"], errors: [{ quote: "a family reason", correction: "family reasons", explanation: "Plus naturel." }], checklist: [{ item: "the reason", met: true, comment: "OK" }], corrected: "Dear Mr Traoré, …" });
    expect(reviewed.history.at(-1)?.coachScore).toBe(81);
    expect((await StepProgress.findOne({ userId: u._id }).lean())?.score).toBe(81);
    // The new version goes back to the coach.
    const again = await sendWriting(String(u._id), t, answer);
    expect([again.coachStatus, again.redoAsked]).toEqual(["pending", false]);
    expect(cleanFeedback({ score: 140 }).score).toBe(100);
  });
});
