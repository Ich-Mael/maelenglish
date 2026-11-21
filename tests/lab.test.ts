import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Activity, LabAttempt, LabMistake, Step, StepProgress, Unit, User } from "@/models";
import * as steps from "@/lib/admin/steps";
import { recordAttempt } from "@/lib/lab/attempts";
import * as content from "@/lib/admin/content";
import * as lab from "@/lib/lab/service";
import { can } from "@/lib/admin/permissions";
import { cleanContent, contentProblem } from "@/lib/lab/content";
import { parseTime, formatTime, parseGaps } from "@/lib/lab/types";
import { gradeActivity } from "@/lib/lab/grade";

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

async function setup() {
  const admin = await User.create({ name: "A", surname: "B", username: "boss", email: "boss@example.com", role: "admin" });
  const c = await content.createCourse({ title: "Aviation" });
  const m = await content.createModule(String(c._id), "M");
  const [u1] = await Unit.find({ moduleId: m._id }).lean();
  const u2 = await content.createUnit(String(m._id), "U2");
  return { actor: String(admin._id), c, m, u1, u2 };
}

describe("Labo", () => {
  it("is open to admins and teachers only", () => {
    expect(can.useLab({ id: "1", role: "admin" })).toBe(true);
    expect(can.useLab({ id: "1", role: "english-coach" })).toBe(true);
    expect(can.useLab({ id: "1", role: "instructor" })).toBe(true);
    expect(can.useLab({ id: "1", role: "account-manager" })).toBe(false);
    expect(can.useLab({ id: "1", role: "user" })).toBe(false);
  });

  it("creates a speaking challenge, validates it before « prête », sanitises and bounds its content", async () => {
    const { actor } = await setup();
    await expect(lab.createActivity("nope", "X", actor)).rejects.toThrow(/Unknown activity type/);
    await expect(lab.createActivity("speaking_challenge", " ", actor)).rejects.toThrow(/title/);
    const a = await lab.createActivity("speaking_challenge", " Accueil ", actor);
    expect([a.title, a.status]).toEqual(["Accueil", "draft"]);
    await expect(lab.updateActivity(String(a._id), { title: "Accueil", ready: true, content: { instructions: "<p>&nbsp;</p>" } }, actor)).rejects.toThrow(/instructions/);
    await lab.updateActivity(String(a._id), { title: "Accueil", ready: true, level: " A2 ", tags: ["aviation", " aviation", "", "accueil"], content: { instructions: "<p>Say hello<script>x()</script></p>", maxSeconds: "999", prepSeconds: "15", mustInclude: "a greeting\n\n your name ", modelAnswerText: " Hello! ", modelAnswerAudioMediaId: "nope" } }, actor);
    const saved = await Activity.findById(a._id).lean();
    expect(saved).toMatchObject({
      status: "ready",
      level: "A2",
      tags: ["aviation", "accueil"],
      content: { instructions: "<p>Say hello</p>", maxSeconds: 60, prepSeconds: 15, mustInclude: ["a greeting", "your name"], modelAnswerText: "Hello!", modelAnswerAudioMediaId: "" },
    });
  });

  it("attaches a challenge to units (reused), lists usages, and refuses deletion while used", async () => {
    const { actor, u1, u2 } = await setup();
    const a = await lab.createActivity("speaking_challenge", "Défi", actor);
    expect(await lab.attachActivity(String(a._id), String(u1._id))).toBe("challenge");
    await lab.attachActivity(String(a._id), String(u2._id));
    expect(await Step.countDocuments({ kind: "challenge", activityId: a._id })).toBe(2);
    const uses = await lab.usagesOf(String(a._id));
    expect(uses.map((u) => [u.kind, u.unitTitle])).toEqual([
      ["challenge", "Unité 1"],
      ["challenge", "U2"],
    ]);
    expect((await lab.listActivities())[0].uses).toBe(2);
    await expect(lab.deleteActivity(String(a._id))).rejects.toThrow(/used in units/);

    // A new challenge replaces the unit's previous one.
    const b = await lab.createActivity("speaking_challenge", "Autre", actor);
    await lab.attachActivity(String(b._id), String(u1._id));
    expect(String((await Step.findOne({ unitId: u1._id, kind: "challenge" }).lean())?.activityId)).toBe(String(b._id));

    await lab.deleteStep(String((await Step.findOne({ unitId: u2._id, kind: "challenge" }).lean())!._id));
    await lab.deleteActivity(String(a._id));
    expect(await Activity.exists({ _id: a._id })).toBeNull();
  });

  it("duplicates as a draft copy", async () => {
    const { actor } = await setup();
    const a = await lab.createActivity("speaking_challenge", "Défi", actor);
    await lab.updateActivity(String(a._id), { title: "Défi", ready: true, content: { instructions: "<p>Go</p>" } }, actor);
    const copy = await lab.duplicateActivity(String(a._id), actor);
    expect(copy).toMatchObject({ title: "Défi (copy)", status: "draft", content: { instructions: "<p>Go</p>" } });
  });

  it("removes an activity step with its progress, and renaming an activity renames its steps", async () => {
    const { actor, u1 } = await setup();
    const a = await lab.createActivity("listen_choose", "Écoute", actor);
    await steps.addLesson(String(u1._id), "L");
    await lab.attachActivity(String(a._id), String(u1._id));
    const placed = (await Step.findOne({ unitId: u1._id, activityId: a._id }).lean())!;
    await StepProgress.create({ userId: actor, courseId: placed.courseId, stepId: placed._id });
    await lab.updateActivity(String(a._id), { title: "Nouveau titre" }, actor);
    expect((await Step.findById(placed._id).lean())?.title).toBe("Nouveau titre");
    await lab.deleteStep(String(placed._id));
    expect(await Step.exists({ _id: placed._id })).toBeNull();
    expect(await StepProgress.countDocuments({ stepId: placed._id })).toBe(0);
  });

  it("listening comprehension: cleans the editor's JSON, checks it before « prête », places it in a unit", async () => {
    const { actor, u1 } = await setup();
    const media = "6b00cb34a2f269ded6b7b932";
    const json = JSON.stringify({
      audioMediaId: media,
      audioDurationS: 41.6,
      maxPlays: 7,
      transcript: "  Flight 512 is now boarding.  ",
      questions: [
        { id: "q1", text: " Which gate? ", options: [{ id: "a", text: "12" }, { id: "b", text: " " }, { id: "c", text: "2" }], correctOptionId: "a", explanation: "« gate twelve »", startS: 12.34 },
        { id: "bad id!", text: "Delay?", options: [{ id: "a", text: "Yes" }, { id: "b", text: "No" }], correctOptionId: "z", startS: "" },
      ],
    });
    const c = cleanContent("listen_choose", { json, context: "<p>À la porte<script>x()</script></p>" });
    expect(c).toMatchObject({ audioMediaId: media, audioDurationS: 42, maxPlays: 0, transcript: "Flight 512 is now boarding.", context: "<p>À la porte</p>" });
    expect(c.questions[0]).toEqual({ id: "q1", text: "Which gate?", options: [{ id: "a", text: "12" }, { id: "c", text: "2" }], correctOptionId: "a", explanation: "« gate twelve »", startS: 12.3 });
    expect(c.questions[1].id).not.toBe("bad id!");
    expect([c.questions[1].correctOptionId, c.questions[1].startS]).toEqual(["", null]);
    expect(contentProblem("listen_choose", c)).toBe("Question 2: tick the correct answer.");
    expect(contentProblem("listen_choose", { ...c, audioMediaId: "" })).toBe("Add the audio.");
    expect(contentProblem("listen_choose", { ...c, questions: [] })).toBe("Add at least one question.");

    const a = await lab.createActivity("listen_choose", "À la porte", actor);
    await expect(lab.updateActivity(String(a._id), { title: "À la porte", ready: true, content: { json, context: "" } }, actor)).rejects.toThrow(/Question 2/);
    const fixed = JSON.stringify({ ...JSON.parse(json), questions: [JSON.parse(json).questions[0]] });
    await lab.updateActivity(String(a._id), { title: "À la porte", ready: true, content: { json: fixed } }, actor);
    expect((await Activity.findById(a._id).lean())?.status).toBe("ready");

    // A practice type becomes an activity step practising the unit's last lesson.
    const lesson = await steps.addLesson(String(u1._id), "Leçon");
    expect(await lab.attachActivity(String(a._id), String(u1._id))).toBe("activity");
    const placed = await Step.findOne({ unitId: u1._id, activityId: a._id }).lean();
    expect(placed).toMatchObject({ kind: "activity", title: "À la porte", position: 2, passScore: 60 });
    expect(String(placed?.lessonId)).toBe(String(lesson._id));
  });

  it("fill the gaps: parses the [bracketed] answers, cleans the editor's JSON, checks and grades", async () => {
    const c = cleanContent("fill_gaps", {
      json: JSON.stringify({ text: "I [am|'m] the new [sales manager].\n\nThis [is] my colleague. [ ] stays text.", explanations: ["I + am.", "", "This + is.", "extra"], hint: "nope", wordBank: true, distractors: ["be", " ", "were"], typos: false }),
    });
    expect(c.hint).toBe("letters");
    expect(c.distractors).toEqual(["be", "were"]);
    expect(c.typos).toBe(false);
    const { lines, gaps } = parseGaps(c);
    expect(lines).toHaveLength(2);
    expect(gaps.map((g) => [g.id, g.answers, g.explanation])).toEqual([
      ["g1", ["am", "'m"], "I + am."],
      ["g2", ["sales manager"], ""],
      ["g3", ["is"], "This + is."],
    ]);
    expect(lines[1].at(-1)).toEqual({ kind: "text", text: " my colleague. [ ] stays text." });
    expect(contentProblem("fill_gaps", c)).toBeNull();
    expect(contentProblem("fill_gaps", cleanContent("fill_gaps", { json: JSON.stringify({ text: "No blank here." }) }))).toMatch(/square brackets/);

    // Alternatives, capitals / punctuation / contractions ignored; typos only when allowed.
    expect(gradeActivity("fill_gaps", c, { g1: "'M", g2: "Sales  manager!", g3: "is" }).score).toBe(100);
    expect(gradeActivity("fill_gaps", c, { g1: "am", g2: "sales manger", g3: "are" }).items.map((i) => i.correct)).toEqual([true, false, false]);
    expect(gradeActivity("fill_gaps", { ...c, typos: true }, { g1: "am", g2: "sales manger", g3: "is" }).score).toBe(100);
    expect(gradeActivity("fill_gaps", c, {}).score).toBe(0);

    // Saved as « ready » once it has a blank.
    const { actor } = await setup();
    const a = await lab.createActivity("fill_gaps", "am, is or are?", actor);
    await expect(lab.updateActivity(String(a._id), { title: "am, is or are?", ready: true, content: { json: JSON.stringify({ text: "No blank." }) } }, actor)).rejects.toThrow(/square brackets/);
    await lab.updateActivity(String(a._id), { title: "am, is or are?", ready: true, content: { json: JSON.stringify({ text: "I [am] here." }) } }, actor);
    expect((await Activity.findById(a._id).lean())?.status).toBe("ready");
  });

  it("parses and formats audio times", () => {
    expect(parseTime("1:05")).toBe(65);
    expect(parseTime("42")).toBe(42);
    expect(parseTime("0:07,5")).toBe(7.5);
    expect(parseTime("1:75")).toBeNull();
    expect(parseTime("abc")).toBeNull();
    expect(parseTime("")).toBeNull();
    expect(formatTime(65.9)).toBe("1:05");
  });

  it("records attempts and keeps a mistake bank (count, resolved on a later right answer)", async () => {
    const { actor, c, m, u1 } = await setup();
    const a = await lab.createActivity("listen_choose", "L1", actor);
    const placed = await Step.create({ courseId: c._id, moduleId: m._id, unitId: u1._id, position: 1, kind: "activity", activityId: a._id, title: "L1" });
    const base = { userId: actor, courseId: c._id, stepId: placed._id, activityId: a._id, type: "listen_choose", stars: 0, bonus: 0, plays: 2 };
    await recordAttempt({ ...base, score: 50, timeSpentS: 95.4, items: [{ id: "q1", correct: true }, { id: "q2", correct: false }], answers: { q1: "a", q2: "c" } });
    const first = await LabAttempt.findOne({ activityId: a._id }).lean();
    expect(first).toMatchObject({ score: 50, timeSpentS: 95, plays: 2, items: [{ itemId: "q1", correct: true, answer: "a" }, { itemId: "q2", correct: false, answer: "c" }] });
    expect(await LabMistake.findOne({ itemId: "q2" }).lean()).toMatchObject({ count: 1, resolved: false });
    expect(await LabMistake.exists({ itemId: "q1" })).toBeNull();

    await recordAttempt({ ...base, score: 0, timeSpentS: 10, items: [{ id: "q1", correct: false }, { id: "q2", correct: false }], answers: {} });
    expect(await LabMistake.findOne({ itemId: "q2" }).lean()).toMatchObject({ count: 2, resolved: false });
    await recordAttempt({ ...base, score: 100, timeSpentS: 10, items: [{ id: "q1", correct: true }, { id: "q2", correct: true }], answers: {} });
    expect((await LabMistake.find({ activityId: a._id }).sort({ itemId: 1 }).lean()).map((x) => [x.itemId, x.count, x.resolved])).toEqual([
      ["q1", 1, true],
      ["q2", 2, true],
    ]);
    expect(await LabAttempt.countDocuments({ activityId: a._id })).toBe(3);
  });
});
