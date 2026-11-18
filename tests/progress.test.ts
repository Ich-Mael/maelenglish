import { describe, expect, it } from "vitest";
import { computeOutline, gradeQuiz, type OutlineInput } from "@/lib/learn/progress";
import { checkExercise, normalize, seededShuffle, similarity, wordBank, words, type Exercise } from "@/lib/learn/exercises";

const mod = (id: string, n: number, extra: Partial<OutlineInput["modules"][number]> = {}) => ({
  id,
  title: id,
  hasQuiz: false,
  hasAssignment: false,
  isCheckpointRequired: true,
  lessons: Array.from({ length: n }, (_, i) => ({ id: `${id}-l${i + 1}`, title: `L${i + 1}`, type: "text" })),
  ...extra,
});

const base = (over: Partial<OutlineInput> = {}): OutlineInput => ({
  modules: [mod("m1", 2, { hasQuiz: true }), mod("m2", 2)],
  completedLessonIds: new Set(),
  quizResults: new Map(),
  assignments: new Map(),
  finalExam: { exists: true, bestScore: null, passed: false },
  finalProject: { exists: false, status: null },
  isChallenge: false,
  start: new Date("2026-11-01T08:00:00"),
  now: new Date("2026-11-03T10:00:00"),
  ...over,
});

describe("computeOutline — regular course", () => {
  it("opens the first lesson only", () => {
    const o = computeOutline(base());
    expect(o.modules[0].lessons.map((l) => l.state)).toEqual(["available", "locked"]);
    expect(o.modules[0].quiz?.state).toBe("locked");
    expect(o.modules[1].state).toBe("locked");
    expect(o.finalExam?.state).toBe("locked");
    expect(o.next).toEqual({ type: "lesson", moduleId: "m1", lessonId: "m1-l1" });
  });

  it("opens the quiz after the lessons, and the next module after the quiz", () => {
    let o = computeOutline(base({ completedLessonIds: new Set(["m1-l1", "m1-l2"]) }));
    expect(o.modules[0].quiz?.state).toBe("available");
    expect(o.modules[1].state).toBe("locked");
    expect(o.next).toEqual({ type: "quiz", moduleId: "m1" });
    expect(o.percent).toBe(50);

    o = computeOutline(
      base({ completedLessonIds: new Set(["m1-l1", "m1-l2"]), quizResults: new Map([["m1", { bestScore: 80, passed: true }]]) }),
    );
    expect(o.modules[0].state).toBe("completed");
    expect(o.modules[1].lessons[0].state).toBe("available");
    expect(o.next).toEqual({ type: "lesson", moduleId: "m2", lessonId: "m2-l1" });
  });

  it("a failed quiz keeps the next module locked", () => {
    const o = computeOutline(
      base({ completedLessonIds: new Set(["m1-l1", "m1-l2"]), quizResults: new Map([["m1", { bestScore: 40, passed: false }]]) }),
    );
    expect(o.modules[0].quiz).toEqual({ state: "available", bestScore: 40 });
    expect(o.modules[1].state).toBe("locked");
  });

  it("opens the final exam once everything is complete", () => {
    const o = computeOutline(
      base({
        completedLessonIds: new Set(["m1-l1", "m1-l2", "m2-l1", "m2-l2"]),
        quizResults: new Map([["m1", { bestScore: 90, passed: true }]]),
      }),
    );
    expect(o.percent).toBe(100);
    expect(o.finalExam?.state).toBe("available");
    expect(o.next).toEqual({ type: "final-exam" });
  });

  it("staff preview opens everything", () => {
    const o = computeOutline(base({ preview: true }));
    expect(o.modules.flatMap((m) => m.lessons.map((l) => l.state)).every((s) => s === "available")).toBe(true);
    expect(o.finalExam?.state).toBe("available");
  });
});

describe("computeOutline — challenge", () => {
  const challenge = (over: Partial<OutlineInput> = {}) =>
    base({
      isChallenge: true,
      modules: [mod("d1", 1, { hasAssignment: true }), mod("d2", 1, { hasAssignment: true }), mod("d3", 1, { hasAssignment: true })],
      finalExam: { exists: false, bestScore: null, passed: false },
      ...over,
    });

  it("time is the ceiling, checkpoints the floor", () => {
    // Day 3 of the calendar, nothing approved: only day 1 open.
    let o = computeOutline(challenge());
    expect(o.modules.map((m) => m.day?.state)).toEqual(["current", "locked_checkpoint", "locked_checkpoint"]);
    expect(o.challenge).toEqual({ totalDays: 3, unlockedDay: 1, streak: 0 });

    o = computeOutline(challenge({ assignments: new Map([["d1", "graded"], ["d2", "pending"]]) }));
    expect(o.modules.map((m) => m.day?.state)).toEqual(["done", "pending_review", "locked_checkpoint"]);

    // First day: approved checkpoints can't open tomorrow's day.
    o = computeOutline(challenge({ now: new Date("2026-11-01T20:00:00"), assignments: new Map([["d1", "graded"]]) }));
    expect(o.modules.map((m) => m.day?.state)).toEqual(["current", "locked_time", "locked_time"]);
    expect(o.modules[1].lessons[0].state).toBe("locked");
  });

  it("a returned checkpoint asks to redo", () => {
    const o = computeOutline(challenge({ assignments: new Map([["d1", "returned"]]) }));
    expect(o.modules[0].day?.state).toBe("redo");
  });
});

describe("gradeQuiz", () => {
  it("scores 0–100", () => {
    const qs = [{ id: "a", correctOptionId: "1" }, { id: "b", correctOptionId: "2" }, { id: "c", correctOptionId: "3" }];
    expect(gradeQuiz(qs, { a: "1", b: "2", c: "x" })).toEqual({ score: 67, correct: 2, total: 3 });
    expect(gradeQuiz([], {})).toEqual({ score: 0, correct: 0, total: 0 });
  });
});

describe("exercises", () => {
  it("normalises answers", () => {
    expect(normalize("  Don’t   STOP! ")).toBe("don't stop");
    expect(normalize("Café")).toBe("cafe");
    expect(words("“Nice to meet you,” she said.")).toEqual(["Nice", "to", "meet", "you", "she", "said"]);
  });

  it("checks each kind", () => {
    const ex = (e: Partial<Exercise>) => ({ id: "x", ...e }) as Exercise;
    const choice = ex({ kind: "choice", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correctOptionId: "b" });
    expect(checkExercise(choice, { kind: "choice", optionId: "b" })).toBe(true);
    expect(checkExercise(choice, { kind: "choice", optionId: "a" })).toBe(false);

    const build = ex({ kind: "build", text: "Nice to meet you." });
    expect(checkExercise(build, { kind: "build", words: ["Nice", "to", "meet", "you"] })).toBe(true);
    expect(checkExercise(build, { kind: "build", words: ["to", "Nice", "meet", "you"] })).toBe(false);

    const order = ex({ kind: "order", items: ["a", "b", "c"] });
    expect(checkExercise(order, { kind: "order", items: ["a", "b", "c"] })).toBe(true);
    expect(checkExercise(order, { kind: "order", items: ["b", "a", "c"] })).toBe(false);

    const match = ex({ kind: "match", pairs: [{ left: "pilot", right: "pilote" }, { left: "runway", right: "piste" }] });
    expect(checkExercise(match, { kind: "match", pairs: [{ left: "runway", right: "piste" }, { left: "pilot", right: "pilote" }] })).toBe(true);
    expect(checkExercise(match, { kind: "match", pairs: [{ left: "runway", right: "pilote" }, { left: "pilot", right: "piste" }] })).toBe(false);

    const listen = ex({ kind: "listen", text: "I don't know.", answers: ["I do not know"] });
    expect(checkExercise(listen, { kind: "listen", text: "i dont know" })).toBe(false);
    expect(checkExercise(listen, { kind: "listen", text: "I don't know" })).toBe(true);
    expect(checkExercise(listen, { kind: "listen", text: "i do not know." })).toBe(true);

    const gap = ex({ kind: "gap", text: "I ___ a pilot", answers: ["am", "'m"] });
    expect(checkExercise(gap, { kind: "gap", text: " AM " })).toBe(true);
    expect(checkExercise(gap, { kind: "gap", text: "is" })).toBe(false);

    const speak = ex({ kind: "speak", text: "Please fasten your seatbelt" });
    expect(checkExercise(speak, { kind: "speak", transcript: "please fasten your seat belt" })).toBe(true);
    expect(checkExercise(speak, { kind: "speak", transcript: "hello" })).toBe(false);
    expect(checkExercise(speak, { kind: "speak", selfCheck: true })).toBe(true);

    expect(checkExercise(choice, { kind: "gap", text: "b" })).toBe(false);
  });

  it("similarity tolerates small recognition errors", () => {
    expect(similarity("please fasten your seatbelt", "Please fasten your seatbelt.")).toBe(1);
    expect(similarity("please fasten seatbelt", "Please fasten your seatbelt")).toBeGreaterThan(0.8);
    expect(similarity("good morning", "Please fasten your seatbelt")).toBeLessThan(0.4);
    expect(similarity("please fasten your seat belt", "Please fasten your seatbelt")).toBe(1);
  });

  it("shuffles deterministically and never returns the solved order", () => {
    expect(seededShuffle(["a", "b", "c", "d"], "seed")).toEqual(seededShuffle(["a", "b", "c", "d"], "seed"));
    for (const seed of ["1", "2", "3", "4", "5", "6"]) expect(seededShuffle(["a", "b"], seed)).toEqual(["b", "a"]);
    const bank = wordBank({ id: "e1", kind: "build", text: "Nice to meet you", distractors: ["see"] });
    expect([...bank].sort()).toEqual(["Nice", "meet", "see", "to", "you"].sort());
  });
});
