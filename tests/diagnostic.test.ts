import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Diagnostic } from "@/models";
import { setAiServicesForTests, type FeedbackService } from "@/lib/ai";
import { FakeFeedbackService } from "@/lib/ai/fake";
import { ALL_QUESTIONS, answersInWords, cleanAnswers, fr, isAnswered, visibleQuestions, type Answers } from "@/lib/diagnostic/questions";
import { PROFILES, computeProfiles } from "@/lib/diagnostic/profiles";
import { fallbackReport } from "@/lib/diagnostic/fallback-reports";
import { DiagnosticReportSchema } from "@/lib/diagnostic/report-types";
import { getDiagnostic, saveProgress, startDiagnostic, submitDiagnostic } from "@/lib/diagnostic/service";

const neutral: Answers = { s17: 1, s18: 1, s19: 1, s20: 1, s21: 1, s22: 1, s23: 1, s24: 1, q7: "no", q13: "no", q2: "ok" };

describe("questionnaire logic", () => {
  it("shows conditional questions only when their condition holds", () => {
    const ids = (a: Answers) => visibleQuestions(a).map((q) => q.id);
    expect(ids({ q2: "very_good", q7: "no", q13: "no", q28: "no" })).toEqual(expect.arrayContaining(["q5a", "q6a"]));
    expect(ids({ q2: "very_good", q7: "no" })).not.toContain("q5b");
    expect(ids({ q2: "hated", q7: "no" })).toEqual(expect.arrayContaining(["q5b", "q6b"]));
    expect(ids({ q7: "no" })).not.toContain("q9");
    expect(ids({ q7: "1_3m", q11: "improved" })).not.toContain("q12");
    expect(ids({ q7: "1_3m", q11: "dropped" })).toContain("q12");
    expect(ids({ q13: "no" })).not.toContain("q14");
    expect(ids({ q28: "yes" })).toContain("q29");
  });

  it("cleans answers: unknown values, hidden questions, max 3, « Autre » text", () => {
    const a = cleanAnswers({ q2: "struggling", q5a: "ashamed", q5b: "other", q5b_other: "  Le bruit  ", q7: "no", q9: "much_better", q30: ["present", "negotiate", "tenders", "certification"], s17: 9, s18: 4, q25d: "x".repeat(900), bogus: 1 });
    expect(a.q5a).toBeUndefined(); // hidden (q2 = struggling)
    expect(a.q9).toBeUndefined(); // hidden (no immersion)
    expect([a.q5b, a.q5b_other, (a.q30 as string[]).length, a.s17, a.s18, String(a.q25d).length, a.bogus]).toEqual(["other", "Le bruit", 3, undefined, 4, 600, undefined]);
    expect(isAnswered(ALL_QUESTIONS.find((q) => q.id === "q5b")!, { q5b: "other" })).toBe(false); // « Autre » needs its text
    expect(isAnswered(ALL_QUESTIONS.find((q) => q.id === "q25d")!, {})).toBe(true); // open questions are optional
    expect(answersInWords(a)).toContain("Autre : Le bruit");
    expect(fr("Dans quel cadre ?")).toBe("Dans quel cadre ?");
  });
});

describe("profiles (deterministic)", () => {
  it("finds each profile on a typical set of answers", () => {
    expect(computeProfiles({ ...neutral, q2: "very_good", q3: ["grammar"], q4: "almost_never", s19: 5, q5a: "ashamed" }).primary).toBe("former_good_student");
    expect(computeProfiles({ ...neutral, q2: "hated", q6b: "mocked", q5b: "teacher", s20: 5, s18: 4 }).primary).toBe("school_wound");
    expect(computeProfiles({ ...neutral, q7: "gt_3m", q9: "much_better", q10: "all_time", q11: "dropped_lot", q12: ["nostalgia"] }).primary).toBe("immersion_returnee");
    expect(computeProfiles({ ...neutral, q7: "1_3m", q10: "francophone_bubble", q9: "no_diff", q11: "stagnated" }).primary).toBe("francophone_bubble");
    expect(computeProfiles({ ...neutral, s17: 5, s24: 5, s18: 4, s23: 4, q25b: "let_other", q25c: ["shame"] }).primary).toBe("speaking_block");
    expect(computeProfiles({ ...neutral, q13: "several", q15: "lt_1m", q16: ["time"], q32: "varies" }).primary).toBe("inconsistent");
  });

  it("ignores immersion profiles without immersion; ties follow the priority; secondaries ≥ 0.6 × and ≥ 0.4", () => {
    const r = computeProfiles({ ...neutral, q7: "no", q10: "francophone_bubble", q9: "no_diff" });
    expect([r.scores.francophone_bubble.points, r.scores.immersion_returnee.points]).toEqual([0, 0]);
    expect(computeProfiles({}).primary).toBe("speaking_block"); // all zero: first in priority
    const mixed = computeProfiles({ ...neutral, s17: 5, s24: 5, s18: 4, s23: 4, q25b: "brief", q13: "several", q15: "lt_1m", q16: ["time"] });
    expect(mixed.primary).toBe("speaking_block");
    expect(mixed.secondary).toContain("inconsistent");
    expect(mixed.secondary.length).toBeLessThanOrEqual(2);
  });

  it("has a valid fallback report for every profile", () => {
    for (const p of PROFILES) expect(DiagnosticReportSchema.safeParse(fallbackReport(p, "Awa", ["Présenter un projet"], ["Fier(e) de moi"])).success).toBe(true);
  });
});

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
  await Diagnostic.deleteMany({});
});

describe("diagnostic sessions", () => {
  const lead = { firstName: "Awa", email: "awa@example.com", consentAnalysis: true };

  it("saves progress, needs email + consent, stores profile and AI report, never sends contact details to the AI", async () => {
    const { token } = await startDiagnostic({ source: "facebook" });
    await saveProgress(token, { q2: "very_good" }, 1);
    expect((await Diagnostic.findOne().lean())!).toMatchObject({ lastSection: 1, utmSource: "facebook", answers: { q2: "very_good" } });
    await expect(submitDiagnostic(token, neutral, { ...lead, consentAnalysis: false })).rejects.toThrow(/accepter/);
    await expect(submitDiagnostic(token, neutral, { ...lead, email: "nope" })).rejects.toThrow(/email/);

    let seen = "";
    const fake = new FakeFeedbackService();
    setAiServicesForTests({ feedback: Object.assign(Object.create(fake), { diagnosticReport: async (input: Parameters<FeedbackService["diagnosticReport"]>[0]) => ((seen = JSON.stringify(input)), fake.diagnosticReport(input)) }) });
    const r = await submitDiagnostic(token, { ...neutral, s17: 5, s24: 5 }, { ...lead, phone: "70 12 34 56", consentMarketing: true });
    expect([r.source, r.primary, r.firstName, r.report.profile_name]).toEqual(["ai", "speaking_block", "Awa", "Le bloqué à l'oral"]);
    expect(seen).not.toContain("awa@example.com");
    expect(seen).not.toContain("70 12");
    const d = (await Diagnostic.findOne().lean())!;
    expect([d.lead?.email, d.lead?.consentMarketing, d.reportSource, !!d.completedAt, d.lastSection]).toEqual(["awa@example.com", true, "ai", true, 6]);
    expect((await getDiagnostic(token))?.report.headline).toBe("Awa, voici ce qui vous freine.");
    // Idempotent: a second submit returns the stored report.
    expect((await submitDiagnostic(token, {}, lead)).isNew).toBe(false);
  });

  it("falls back on the profile's report when the AI fails twice", async () => {
    let calls = 0;
    const fake = new FakeFeedbackService();
    setAiServicesForTests({ feedback: Object.assign(Object.create(fake), { diagnosticReport: async () => (calls++, { report: { headline: 1 }, usage: { inputTokens: 0, outputTokens: 0, costMicros: 0, provider: "fake" } }) }) });
    const { token } = await startDiagnostic();
    const r = await submitDiagnostic(token, { ...neutral, q13: "several", q15: "lt_1m", q16: ["time"], q32: "varies", q30: ["present"] }, lead);
    expect([calls, r.source, r.primary]).toEqual([2, "fallback", "inconsistent"]);
    expect(r.report.goal_reminder).toContain("présenter un projet ou un rapport");
  });
});
