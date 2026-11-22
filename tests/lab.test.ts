import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Activity, LabAttempt, LabMistake, Step, StepProgress, Unit, User } from "@/models";
import * as steps from "@/lib/admin/steps";
import { recordAttempt } from "@/lib/lab/attempts";
import * as content from "@/lib/admin/content";
import * as lab from "@/lib/lab/service";
import { can } from "@/lib/admin/permissions";
import { cleanContent, contentProblem } from "@/lib/lab/content";
import { parseTime, formatTime, parseGaps, lineOfGap, autoBlank, docSentences, matchScreens, sentenceText, sentenceTiles } from "@/lib/lab/types";
import { gradeActivity } from "@/lib/lab/grade";
import { partnerColumn } from "@/components/lab/shell/shuffle";

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

  it("listen and fill the gaps: audio + timed transcript lines, same blanks and scoring as fill the gaps", () => {
    const audioMediaId = String(new Types.ObjectId());
    const c = cleanContent("listen_fill_gaps", {
      context: "<p>Fatou présente son travail.</p><script>x</script>",
      json: JSON.stringify({ audioMediaId, audioDurationS: 21.6, maxPlays: 7, text: "@0:03 I [work] for a telecom company.\n@ 1:05.5   My team [manages] accounts.\nThe meeting is at [3:30].", hint: "first" }),
    });
    expect([c.audioMediaId, c.audioDurationS, c.maxPlays, c.hint, c.typos]).toEqual([audioMediaId, 22, 0, "first", false]); // typos off unless ticked
    expect(c.context).not.toContain("script");
    const timed = parseGaps(c, { timed: true });
    expect(timed.times).toEqual([3, 65.5, null]);
    expect(timed.lines[0][0]).toEqual({ kind: "text", text: "I " }); // the « @0:03 » is removed
    expect(timed.gaps.map((g) => g.answers[0])).toEqual(["work", "manages", "3:30"]); // a time as an answer stays a blank
    expect(lineOfGap(timed.lines, "g3")).toBe(2);
    // Same blank ids with or without times (the server grades without them).
    expect(parseGaps(c).gaps.map((g) => g.id)).toEqual(timed.gaps.map((g) => g.id));
    expect(gradeActivity("listen_fill_gaps", c, { g1: "work", g2: "manage", g3: "3:30" }).items.map((i) => i.correct)).toEqual([true, false, true]);

    expect(contentProblem("listen_fill_gaps", c)).toBeNull();
    expect(contentProblem("listen_fill_gaps", { ...c, audioMediaId: "" })).toMatch(/audio/);
    expect(contentProblem("listen_fill_gaps", { ...c, text: "No blank." })).toMatch(/square brackets/);
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

    // V4 sentence builder: tiles with « / » (a tile may hold several words), distractors, other accepted orders.
    expect([sentenceTiles(" I / would like /to book / a meeting. "), sentenceTiles("I work for a bank."), sentenceText("She / manages / the IT team.")]).toEqual([["I", "would like", "to book", "a meeting."], ["I", "work", "for", "a", "bank."], "She manages the IT team."]);
    const sb = cleanContent("sentence_builder", {
      json: JSON.stringify({
        audioWhen: "nope",
        items: [
          { id: "a", sentence: "I / would like / to book / a meeting / on Monday.", distractors: "booking / at", alternatives: "On Monday, I would like to book a meeting.\n", explanation: "would like + to" },
          { id: "a", sentence: "She manages the IT team." },
        ],
      }),
    });
    expect([sb.audioWhen, sb.items.map((i) => i.id), sb.items[0].distractors, sb.items[0].alternatives]).toEqual(["after", ["a", "s2-1"], ["booking", "at"], ["On Monday, I would like to book a meeting."]]);
    expect(contentProblem("sentence_builder", sb)).toBeNull();
    expect(contentProblem("sentence_builder", { ...sb, items: [] })).toMatch(/at least one sentence/);
    expect(contentProblem("sentence_builder", { ...sb, items: [{ ...sb.items[0], sentence: "Hello" }] })).toMatch(/at least 2 tiles/);
    expect(contentProblem("sentence_builder", { ...sb, items: [{ ...sb.items[0], distractors: ["to book"] }] })).toMatch(/distractor/);
    expect(contentProblem("sentence_builder", { ...sb, audioWhen: "before" })).toMatch(/audio/);
    // Tiles placed in order (joined by spaces): case, punctuation and contractions ignored; alternatives accepted; a distractor fails.
    const g = gradeActivity("sentence_builder", sb, { a: "on monday , I would like to book a meeting", "s2-1": "She manages the team IT." });
    expect([g.items.map((i) => i.correct), g.score]).toEqual([[true, false], 50]);
    expect(gradeActivity("sentence_builder", sb, { a: "I would like booking a meeting on Monday.", "s2-1": "She manages the IT team" }).items.map((i) => i.correct)).toEqual([false, true]);

    // V1 matching pairs: balanced screens, unique cards per side, first match per left card counts.
    expect(matchScreens([1, 2, 3, 4, 5, 6, 7], 5).map((x) => x.length)).toEqual([4, 3]);
    expect(matchScreens([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 5).map((x) => x.length)).toEqual([4, 4, 3]);
    expect(matchScreens([1, 2], 6).map((x) => x.length)).toEqual([2]);
    // The right column never puts a card on its partner's row (whatever the seed and the size).
    for (let n = 1; n <= 6; n++)
      for (let k = 0; k < 40; k++) {
        const left = Array.from({ length: n }, (_, i) => i);
        const right = partnerColumn(left, `s${k}`);
        expect([...right].sort()).toEqual(left);
        if (n > 1) expect(right.some((x, row) => x === left[row])).toBe(false);
      }
    const mp = cleanContent("match_pairs", { json: JSON.stringify({ perScreen: 9, pairs: [{ id: "a", left: " gate ", right: "porte" }, { id: "a", left: "delay", right: "retard", explanation: "Faux ami : pas « délai »." }, { left: "luggage", right: "bagages" }] }) });
    expect([mp.perScreen, mp.pairs.map((p) => p.id), mp.pairs[0].left]).toEqual([5, ["a", "p2-1", "p3"], "gate"]);
    expect(contentProblem("match_pairs", mp)).toBeNull();
    expect(contentProblem("match_pairs", { ...mp, pairs: mp.pairs.slice(0, 1) })).toMatch(/at least 2/);
    expect(contentProblem("match_pairs", { ...mp, pairs: [...mp.pairs, { ...mp.pairs[0], id: "z", left: "Gate" }] })).toMatch(/twice on the left/);
    expect(contentProblem("match_pairs", { ...mp, pairs: [{ ...mp.pairs[0], right: "" }, mp.pairs[1]] })).toMatch(/both sides/);
    const gm = gradeActivity("match_pairs", mp, { a: "a", "p2-1": "p3", p3: "p3" });
    expect([gm.items.map((i) => i.correct), gm.score]).toEqual([[true, false, true], 67]);

    // Listen and match: same rules and grading, plus an audio for every meaning (its text = transcript).
    const audio = String(new Types.ObjectId());
    const lm = cleanContent("listen_match", { json: JSON.stringify({ pairs: [{ id: "a", left: "gate", right: "Where you get on the plane.", rightAudioMediaId: audio }, { id: "b", left: "delay", right: "When the flight leaves late.", rightAudioMediaId: "bad" }] }) });
    expect([lm.pairs[0].rightAudioMediaId, lm.pairs[1].rightAudioMediaId]).toEqual([audio, ""]);
    expect(contentProblem("listen_match", lm)).toMatch(/Pair 2: add the audio/);
    expect(contentProblem("listen_match", { ...lm, pairs: lm.pairs.map((p) => ({ ...p, rightAudioMediaId: audio })) })).toBeNull();
    expect(gradeActivity("listen_match", lm, { a: "a", b: "a" }).score).toBe(50);

    // R1 true / false / not given: sentences = lines, proof required for true / false, dropped for « not given ».
    const tf = cleanContent("true_false_ng", {
      json: JSON.stringify({
        docTitle: "E-mail de la DRH",
        text: "Dear team,\n\nThe Monday meeting is moved to Tuesday at 10 a.m.\nPlease bring your sales figures.",
        statements: [
          { id: "a", text: "The meeting is on Monday.", answer: "false", evidence: 1 },
          { id: "b", text: "Lunch is served.", answer: "not_given", evidence: 2 },
          { id: "c", text: "Bring your figures.", answer: "true", evidence: 9 },
          { id: "d", text: "Odd", answer: "maybe", evidence: "2" },
        ],
      }),
    });
    expect(docSentences(tf.text)).toHaveLength(3);
    expect(tf.statements.map((x) => [x.answer, x.evidence])).toEqual([["false", 1], ["not_given", null], ["true", null], ["true", 2]]);
    expect(contentProblem("true_false_ng", tf)).toMatch(/Statement 3: pick the sentence/);
    expect(contentProblem("true_false_ng", { ...tf, statements: [tf.statements[0], tf.statements[1]] })).toBeNull();
    expect(contentProblem("true_false_ng", { ...tf, text: "One line." })).toMatch(/at least 2 sentences/);
    expect(gradeActivity("true_false_ng", tf, { a: "false", b: "true", c: "true", d: "true" }).score).toBe(75);
    // A picture instead of the text: no sentence to pick, the proof is an optional typed quote.
    const docImg = String(new Types.ObjectId());
    const tfi = cleanContent("true_false_ng", { json: JSON.stringify({ imageMediaId: docImg, imageAlt: "Capture", text: "", statements: [{ id: "a", text: "He leaves at 1 p.m.", answer: "true", quote: "from 1:00 PM" }, { id: "b", text: "He is ill.", answer: "not_given", quote: "x" }] }) });
    expect([tfi.imageMediaId, tfi.imageAlt, tfi.statements[0].quote, tfi.statements[1].quote]).toEqual([docImg, "Capture", "from 1:00 PM", ""]);
    expect(contentProblem("true_false_ng", tfi)).toBeNull();
    const tfa = cleanContent("true_false_ng", { json: JSON.stringify({ imageMediaId: docImg, statements: [{ id: "a", text: "x", answer: "true", audioMediaId: docImg }, { id: "b", text: "y", answer: "false", audioMediaId: "bad" }] }) });
    expect(tfa.statements.map((x) => x.audioMediaId)).toEqual([docImg, ""]);
    expect(contentProblem("true_false_ng", { ...tfi, imageMediaId: "" })).toMatch(/Add the document/);

    // Complete the words: brackets after the stem, exact letters (capitals ignored), automatic C-test blanking.
    const cw = cleanContent("complete_words", { text: "Traveling to new destin[ations] has long been one of the most reward[ing] experiences." });
    expect(contentProblem("complete_words", cw)).toBeNull();
    expect([cw.audioMediaId, cleanContent("complete_words", { text: "x", audioMediaId: String(audio) }).audioMediaId, cleanContent("complete_words", { text: "x", audioMediaId: "nope" }).audioMediaId]).toEqual(["", String(audio), ""]);
    expect(contentProblem("complete_words", { text: "Only destin[ations] here." })).toMatch(/at least 2 words/);
    expect(contentProblem("complete_words", { text: "a[b c] and d[e]" })).toMatch(/no spaces/);
    expect(gradeActivity("complete_words", cw, { g1: "ATIONS", g2: "in" }).items.map((i) => i.correct)).toEqual([true, false]);
    expect(autoBlank("Budget travel is popular. Hostels make it affordable to visit places once reserved for the wealthy.")).toBe("Budget travel is popular. Hostels ma[ke] it affordable to vi[sit] places on[ce] reserved f[or] the wea[lthy].");
    expect(autoBlank("Already cut[ting].")).toBe("Already cut[ting].");

    // Speaking challenge prompts: picture / video / audio, questions one per line; only what the type uses is kept.
    const id = String(new Types.ObjectId());
    const base = { instructions: "<p>Décrivez la photo.</p>" };
    const img = cleanContent("speaking_challenge", { ...base, promptType: "image", promptMediaId: id, promptAlt: " Un hall ", promptVideoUrl: "https://youtu.be/abcdefgh", questions: "Where is it?\n\n What do you see? " });
    expect([img.promptType, img.promptMediaId, img.promptAlt, img.promptVideoUrl, img.questions]).toEqual(["image", id, "Un hall", "", ["Where is it?", "What do you see?"]]);
    expect(contentProblem("speaking_challenge", img)).toBeNull();
    expect(contentProblem("speaking_challenge", cleanContent("speaking_challenge", { ...base, promptType: "image" }))).toMatch(/picture/);
    expect(contentProblem("speaking_challenge", cleanContent("speaking_challenge", { ...base, promptType: "audio", promptMediaId: "nope" }))).toMatch(/audio/);
    const vid = cleanContent("speaking_challenge", { ...base, promptType: "video", promptMediaId: id, promptVideoUrl: "https://youtu.be/abcdefgh" });
    expect([vid.promptMediaId, contentProblem("speaking_challenge", vid)]).toEqual(["", null]);
    expect(contentProblem("speaking_challenge", { ...vid, promptVideoUrl: "https://example.com/page" })).toMatch(/video link/);
    expect(cleanContent("speaking_challenge", { ...base, promptType: "gif" }).promptType).toBe("text");

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
