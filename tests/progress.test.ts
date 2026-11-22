import { describe, expect, it } from "vitest";
import { computeOutline, gradeQuiz, type OutlineInput } from "@/lib/learn/progress";
import { draftNotices, learnerSteps, validateUnit, type UnitStepInput } from "@/lib/course/validate-unit";
import { cleanLessonContent, lessonHasContent } from "@/lib/course/lesson-content";
import { stepAfter, stepBefore } from "@/lib/learn/sequence";

type In = OutlineInput["modules"][number]["units"][number];

/** A unit from a kind pattern, e.g. "LAAC" → lesson, activity, activity, challenge. */
const unit = (id: string, pattern = "LAAC", valid = true): In => {
  let lesson = "";
  return {
    id,
    title: id,
    valid,
    steps: [...pattern].map((k, i) => {
      const sid = `${id}-${i + 1}`;
      if (k === "L") lesson = sid;
      const kind = k === "L" ? "lesson" : k === "A" ? "activity" : "challenge";
      return { id: sid, kind, title: sid, lessonId: kind === "activity" ? lesson : null, passScore: 60 };
    }),
  };
};

const base = (over: Partial<OutlineInput> = {}): OutlineInput => ({
  modules: [
    { id: "m1", title: "M1", units: [unit("u1"), unit("u2")] },
    { id: "m2", title: "M2", units: [unit("u3")] },
  ],
  completedStepIds: new Set(),
  challenges: new Map(),
  finalExam: { exists: true, bestScore: null, passed: false },
  isChallenge: false,
  start: new Date("2026-11-01T08:00:00"),
  now: new Date("2026-11-03T10:00:00"),
  ...over,
});

const states = (o: ReturnType<typeof computeOutline>, m: number, u: number) => o.modules[m].units[u].steps.map((s) => s.state[0]).join("");

describe("validateUnit (spec §4)", () => {
  const steps = (pattern: string, over: (s: UnitStepInput, i: number) => Partial<UnitStepInput> = () => ({})): UnitStepInput[] => {
    let lesson = "";
    return [...pattern].map((k, i) => {
      const id = `s${i + 1}`;
      if (k === "L") lesson = id;
      const kind = k === "L" ? "lesson" : k === "A" ? "activity" : "challenge";
      const s: UnitStepInput = { id, kind, title: id, lessonId: kind === "activity" ? lesson || null : null, ready: kind === "lesson" ? undefined : true, hasContent: kind === "lesson" ? true : undefined };
      return { ...s, ...over(s, i) };
    });
  };

  it("accepts the valid patterns", () => {
    for (const p of ["LAAC", "LAAALAAC", "LAALAAALAAC", "LAAAAC", "LAAAAAC"]) expect(validateUnit(steps(p)), p).toEqual([]);
  });

  it("rejects each invalid pattern with a message", () => {
    const msg = (p: string) => validateUnit(steps(p)).map((x) => x.message).join(" | ");
    expect(msg("LAC")).toMatch(/only 1 activity/);
    expect(msg("LAAAAAAC")).toMatch(/6 activities: 5 at most/);
    expect(msg("LLAAC")).toMatch(/followed directly by another lesson/);
    expect(msg("LAA")).toMatch(/Add the speaking challenge/);
    expect(msg("AAC")).toMatch(/must start with a lesson/);
    expect(msg("LAACC")).toMatch(/exactly one speaking challenge/);
    expect(msg("LACA")).toMatch(/must be the last step/);
    expect(msg("LC")).toMatch(/followed directly by the challenge/);
    expect(msg("")).toMatch(/empty/);
  });

  it("checks the practised lesson, readiness and lesson content", () => {
    // Activity pointing to a lesson below it (s4 is the second lesson).
    expect(validateUnit(steps("LAALAAC", (s) => (s.id === "s2" ? { lessonId: "s4" } : {})))[0].message).toMatch(/practise a lesson placed above/);
    // A draft practice activity is skipped for learners: the unit stays valid if what remains follows the rules…
    const withDraft = steps("LAAAC", (s) => (s.id === "s4" ? { ready: false } : {}));
    expect(validateUnit(withDraft)).toEqual([]);
    expect(draftNotices(withDraft)).toEqual([{ stepId: "s4", message: expect.stringMatching(/draft in the Lab: learners don't see it/) }]);
    expect(learnerSteps(withDraft).map((s) => s.id)).toEqual(["s1", "s2", "s3", "s5"]);
    // …and invalid when the lesson is left with a single activity.
    expect(validateUnit(steps("LAAC", (s) => (s.id === "s3" ? { ready: false } : {})))[0]).toEqual({ stepId: "s1", message: expect.stringMatching(/has only 1 activity/) });
    expect(validateUnit(steps("LAAC", (s) => (s.kind === "challenge" ? { ready: false } : {})))[0].message).toMatch(/Speaking challenge .* draft/);
    expect(validateUnit(steps("LAAC", (s) => (s.kind === "lesson" ? { hasContent: false } : {})))[0].message).toMatch(/is empty/);
  });

  it("lesson content: intro text, video or a filled section counts", () => {
    expect(lessonHasContent(cleanLessonContent({ intro: "<p> </p>" }))).toBe(false);
    expect(lessonHasContent(cleanLessonContent({ intro: "<p>Hello</p>" }))).toBe(true);
    expect(lessonHasContent(cleanLessonContent({ sections: [{ type: "tip", text: "" }] }))).toBe(false);
    const c = cleanLessonContent({ sections: [{ type: "vocabulary", items: [{ term: "Good morning", meaning: "Bonjour", example: "", extra: 1 }] }, { type: "nope" }, { type: "grammar_rule", table: [["a", "b"], ["c"]] }] });
    expect(lessonHasContent(c)).toBe(true);
    expect(c.sections.map((s) => s.type)).toEqual(["vocabulary", "grammar_rule"]);
    expect(c.sections[1]).toMatchObject({ table: [["a", "b"], ["c", ""]] });
  });
});

describe("computeOutline — steps", () => {
  it("opens only the first step for a new learner", () => {
    const o = computeOutline(base());
    expect(states(o, 0, 0)).toBe("alll");
    expect(states(o, 0, 1)).toBe("llll");
    expect(o.modules[1].state).toBe("locked");
    expect(o.finalExam?.state).toBe("locked");
    expect(o.next).toEqual({ type: "step", stepId: "u1-1" });
    expect(o.stepsTotal).toBe(12);
  });

  it("completing a step opens the next one; sending the challenge completes the unit and opens the next unit", () => {
    let o = computeOutline(base({ completedStepIds: new Set(["u1-1", "u1-2", "u1-3"]) }));
    expect(states(o, 0, 0)).toBe("ccca");
    expect(o.next).toEqual({ type: "step", stepId: "u1-4" });
    o = computeOutline(base({ completedStepIds: new Set(["u1-1", "u1-2", "u1-3"]), challenges: new Map([["u1", "pending"]]) }));
    expect(o.modules[0].units[0]).toMatchObject({ state: "completed", done: 4, total: 4 });
    expect(states(o, 0, 1)).toBe("alll");
  });

  it("a returned challenge can be recorded again, but the next unit stays open", () => {
    const o = computeOutline(base({ completedStepIds: new Set(["u1-1", "u1-2", "u1-3"]), challenges: new Map([["u1", "returned"]]) }));
    expect(states(o, 0, 0)).toBe("ccca");
    expect(states(o, 0, 1)).toBe("alll");
    expect(o.next).toEqual({ type: "step", stepId: "u2-1" });
  });

  it("the next module opens when every unit is complete, then the final exam", () => {
    const done = new Set(["u1-1", "u1-2", "u1-3", "u2-1", "u2-2", "u2-3"]);
    let o = computeOutline(base({ completedStepIds: done, challenges: new Map([["u1", "graded"]]) }));
    expect(o.modules[1].state).toBe("locked");
    o = computeOutline(base({ completedStepIds: done, challenges: new Map([["u1", "graded"], ["u2", "pending"]]) }));
    expect(o.modules[0].state).toBe("completed");
    expect(states(o, 1, 0)).toBe("alll");
    o = computeOutline(base({ completedStepIds: new Set([...done, "u3-1", "u3-2", "u3-3"]), challenges: new Map([["u1", "graded"], ["u2", "pending"], ["u3", "pending"]]) }));
    expect(o.finalExam?.state).toBe("available");
    expect(o.next).toEqual({ type: "final-exam" });
    expect(o.percent).toBe(100);
  });

  it("passes scores and pass marks through for activities", () => {
    const o = computeOutline(base({ completedStepIds: new Set(["u1-1", "u1-2"]), scores: new Map([["u1-2", 40]]) }));
    expect(o.modules[0].units[0].steps[1]).toMatchObject({ kind: "activity", score: 40, passScore: 60, lessonId: "u1-1", state: "completed" });
  });

  it("hides invalid units (and modules left empty) from learners; staff see them flagged", () => {
    const input = base({ modules: [{ id: "m1", title: "M1", units: [unit("u1"), unit("bad", "LAC", false)] }, { id: "m2", title: "M2", units: [unit("u3", "LAA", false)] }] });
    const o = computeOutline(input);
    expect(o.modules.map((m) => m.id)).toEqual(["m1"]);
    expect(o.modules[0].units.map((u) => u.id)).toEqual(["u1"]);
    const p = computeOutline({ ...input, preview: true });
    expect(p.modules[0].units.map((u) => [u.id, u.hidden])).toEqual([["u1", false], ["bad", true]]);
    expect(states(p, 1, 0)).toBe("aaa");
  });

  it("step order for Back / Next", () => {
    const o = computeOutline(base());
    expect(stepAfter("c", o, "/apprendre/c/etapes/u1-4")).toBe("/apprendre/c/etapes/u2-1");
    expect(stepBefore("c", o, "/apprendre/c/etapes/u1-1")).toBe("/apprendre/c");
    expect(stepAfter("c", o, "/apprendre/c/etapes/u3-4")).toBe("/apprendre/c/examen");
  });
});

describe("computeOutline — challenge course", () => {
  const challenge = (over: Partial<OutlineInput> = {}) =>
    base({ isChallenge: true, modules: [{ id: "d1", title: "D1", units: [unit("a")] }, { id: "d2", title: "D2", units: [unit("b")] }, { id: "d3", title: "D3", units: [unit("c")] }], ...over });

  it("time is the ceiling, the coach's validation of the day's challenge the floor", () => {
    let o = computeOutline(challenge({ challenges: new Map([["a", "pending"]]) }));
    expect(o.modules.map((m) => m.day?.state)).toEqual(["pending_review", "locked_checkpoint", "locked_checkpoint"]);
    expect(o.modules[1].state).toBe("locked");
    o = computeOutline(challenge({ challenges: new Map([["a", "graded"], ["b", "graded"]]), now: new Date("2026-11-02T10:00:00") }));
    expect(o.challenge).toEqual({ totalDays: 3, unlockedDay: 2, streak: 2 });
    expect(o.modules[2].day?.state).toBe("locked_time");
  });

  it("a returned challenge asks to redo the day", () => {
    const o = computeOutline(challenge({ challenges: new Map([["a", "returned"]]) }));
    expect(o.modules[0].day?.state).toBe("redo");
  });
});

describe("gradeQuiz", () => {
  it("scores 0–100", () => {
    const q = [
      { id: "a", correctOptionId: "1" },
      { id: "b", correctOptionId: "2" },
      { id: "c", correctOptionId: "3" },
    ];
    expect(gradeQuiz(q, { a: "1", b: "2", c: "x" })).toEqual({ score: 67, correct: 2, total: 3 });
  });
});
