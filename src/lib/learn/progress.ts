/**
 * Progression rules (pure, no database — unit-tested in tests/progress.test.ts).
 *
 * Course → Module → Unit → Steps (owner spec COURSE_STRUCTURE.md §8):
 *  - only **valid** units reach learners (validateUnit); staff preview also shows the others,
 *    flagged `hidden`. A module without any valid unit is left out for learners (it doesn't block);
 *  - inside a module, steps open one after the other, across its units in order;
 *  - a lesson is completed with « Continuer », an activity when submitted (whatever the score —
 *    below its pass score the learner is offered « Revoir la leçon »), the speaking challenge when
 *    **sent** (the coach reviews it afterwards; « returned » = can re-record, the next unit stays open);
 *  - a unit is complete when its challenge is sent; a module when all its units are;
 *  - module N+1 opens once module N is complete; the final exam once every module is.
 * Challenge course (`isChallenge`, each module is a "day"):
 *  - time is the ceiling: day N opens N−1 days after the enrolment start;
 *  - the coach is the floor: day N+1 opens only once day N's last unit challenge is **validated** (graded).
 * Staff preview: everything is open.
 */

import type { StepKind } from "@/lib/course/types";

export type SubmissionStatus = "pending" | "graded" | "returned";

export type OutlineInput = {
  modules: {
    id: string;
    title: string;
    summary?: string;
    description?: string;
    level?: string;
    units: {
      id: string;
      title: string;
      objectives?: string[];
      estimatedMinutes?: number;
      /** validateUnit passed (only valid units reach learners). */
      valid: boolean;
      steps: {
        id: string;
        kind: StepKind;
        title: string;
        /** Icon key on the course map: "lesson", the Lab activity type, or "challenge". */
        type?: string;
        estimatedMinutes?: number;
        /** activity: lesson practised and pass score. */
        lessonId?: string | null;
        passScore?: number;
      }[];
    }[];
  }[];
  /** Lesson and activity steps completed. */
  completedStepIds: ReadonlySet<string>;
  /** Activity step id → best score. */
  scores?: ReadonlyMap<string, number>;
  /** Unit id → speaking challenge submission status. */
  challenges: ReadonlyMap<string, SubmissionStatus>;
  finalExam: { exists: boolean; bestScore: number | null; passed: boolean };
  isChallenge: boolean;
  /** Enrolment start (challenge Day 1). */
  start: Date;
  now?: Date;
  preview?: boolean;
};

export type StepState = "locked" | "available" | "completed";
export type DayState = "done" | "current" | "pending_review" | "redo" | "locked_checkpoint" | "locked_time";

export type StepOutline = {
  id: string;
  kind: StepKind;
  title: string;
  type: string;
  state: StepState;
  estimatedMinutes: number;
  /** activity */
  lessonId: string | null;
  score: number | null;
  passScore: number | null;
  /** challenge */
  status: SubmissionStatus | null;
};

/** `done` / `total` count the unit's steps. `hidden`: staff preview of a unit learners don't see (breaks the rules). */
export type UnitOutline = {
  id: string;
  title: string;
  objectives: string[];
  estimatedMinutes: number;
  index: number;
  state: StepState;
  done: number;
  total: number;
  steps: StepOutline[];
  hidden: boolean;
};

export type ModuleOutline = {
  id: string;
  title: string;
  summary: string;
  description: string;
  level: string;
  index: number;
  state: StepState;
  /** Challenge only. */
  day?: { number: number; state: DayState; opensOn: Date };
  units: UnitOutline[];
};

export type Outline = {
  modules: ModuleOutline[];
  stepsDone: number;
  stepsTotal: number;
  percent: number;
  finalExam: { state: StepState; bestScore: number | null } | null;
  /** Where « Continuer » goes. */
  next: { type: "step"; stepId: string } | { type: "final-exam" } | null;
  challenge?: { totalDays: number; unlockedDay: number; streak: number };
};

const DAY_MS = 24 * 60 * 60 * 1000;
const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export function computeOutline(input: OutlineInput): Outline {
  const { completedStepIds: done, challenges, preview = false } = input;
  const scores = input.scores ?? new Map<string, number>();
  const now = input.now ?? new Date();

  // What the viewer sees: learners only get valid units, and modules that have one.
  const visible = input.modules
    .map((m) => ({ ...m, units: m.units.filter((u) => preview || u.valid) }))
    .filter((m) => preview || m.units.length > 0);

  // Challenge gating (which days are open).
  let dayOpen: (i: number) => boolean = () => true;
  let challenge: Outline["challenge"];
  let dayInfo: (i: number) => ModuleOutline["day"] = () => undefined;
  if (input.isChallenge) {
    const startDay = startOfDay(input.start);
    const elapsed = Math.max(0, Math.floor((startOfDay(now).getTime() - startDay.getTime()) / DAY_MS));
    const total = visible.length;
    const timeCeiling = preview ? total : elapsed + 1;
    const checkpoint = (i: number) => {
      const last = visible[i].units.at(-1);
      return last ? (challenges.get(last.id) ?? null) : "graded";
    };
    let approved = 0;
    for (let i = 0; i < total && checkpoint(i) === "graded"; i++) approved++;
    const unlocked = preview ? total : Math.min(timeCeiling, approved + 1);
    challenge = { totalDays: total, unlockedDay: Math.min(unlocked, total), streak: Math.min(approved, total) };
    dayOpen = (i) => preview || i + 1 <= unlocked;
    dayInfo = (i) => {
      const n = i + 1;
      const status = checkpoint(i);
      let state: DayState;
      if (preview || n < unlocked) state = "done";
      else if (n === unlocked) state = status === "pending" ? "pending_review" : status === "returned" ? "redo" : "current";
      else state = n <= timeCeiling ? "locked_checkpoint" : "locked_time";
      return { number: n, state, opensOn: new Date(startDay.getTime() + i * DAY_MS) };
    };
  }

  let previousComplete = true;
  let allComplete = true;
  let stepsDone = 0;
  let stepsTotal = 0;
  const modules: ModuleOutline[] = visible.map((m, index) => {
    const open = preview || (input.isChallenge ? dayOpen(index) : previousComplete);
    let prevDone = true;
    const units: UnitOutline[] = m.units.map((u, unitIndex) => {
      const steps: StepOutline[] = u.steps.map((s) => {
        const status = s.kind === "challenge" ? (challenges.get(u.id) ?? null) : null;
        const isDone = s.kind === "challenge" ? status === "pending" || status === "graded" : done.has(s.id);
        const state: StepState = isDone ? "completed" : open && (preview || prevDone) ? "available" : "locked";
        // The next step opens once this one is done — for the challenge, once it's sent (even if returned).
        prevDone = s.kind === "challenge" ? status !== null : isDone;
        return {
          id: s.id,
          kind: s.kind,
          title: s.title,
          type: s.type ?? s.kind,
          state,
          estimatedMinutes: s.estimatedMinutes ?? 0,
          lessonId: s.kind === "activity" ? (s.lessonId ?? null) : null,
          score: s.kind === "activity" ? (scores.get(s.id) ?? null) : null,
          passScore: s.kind === "activity" ? (s.passScore ?? null) : null,
          status,
        };
      });
      const doneCount = steps.filter((s) => s.state === "completed" || (s.kind === "challenge" && s.status)).length;
      const complete = steps.length > 0 && doneCount === steps.length;
      stepsDone += doneCount;
      stepsTotal += steps.length;
      return {
        id: u.id,
        title: u.title,
        objectives: u.objectives ?? [],
        estimatedMinutes: u.estimatedMinutes ?? 0,
        index: unitIndex,
        state: complete ? "completed" : steps.some((s) => s.state !== "locked") ? "available" : "locked",
        done: doneCount,
        total: steps.length,
        steps,
        hidden: !u.valid,
      };
    });
    const complete = units.every((u) => u.state === "completed");
    previousComplete = previousComplete && complete;
    allComplete = allComplete && complete;
    return {
      id: m.id,
      title: m.title,
      summary: m.summary ?? "",
      description: m.description ?? "",
      level: m.level ?? "",
      index,
      state: complete && open ? "completed" : open ? "available" : "locked",
      day: dayInfo(index),
      units,
    };
  });

  const finalsOpen = preview || (allComplete && modules.length > 0);
  const finalExam = input.finalExam.exists
    ? { state: (input.finalExam.passed ? "completed" : finalsOpen ? "available" : "locked") as StepState, bestScore: input.finalExam.bestScore }
    : null;

  return {
    modules,
    stepsDone,
    stepsTotal,
    percent: stepsTotal ? Math.round((stepsDone / stepsTotal) * 100) : 0,
    finalExam,
    next: nextStep(modules, finalExam),
    challenge,
  };
}

function nextStep(modules: ModuleOutline[], exam: Outline["finalExam"]): Outline["next"] {
  for (const m of modules) {
    if (m.state === "locked") break;
    for (const u of m.units) {
      const step = u.steps.find((s) => s.state === "available" && !(s.kind === "challenge" && s.status));
      if (step) return { type: "step", stepId: step.id };
    }
  }
  if (exam?.state === "available") return { type: "final-exam" };
  return null;
}

/** All steps of the outline in learning order. */
export const allSteps = (outline: Outline): StepOutline[] => outline.modules.flatMap((m) => m.units.flatMap((u) => u.steps));

/** Score 0–100 of a graded quiz (answers = chosen option id per question id). */
export function gradeQuiz(
  questions: { id: string; correctOptionId: string }[],
  answers: Readonly<Record<string, string | undefined>>,
): { score: number; correct: number; total: number } {
  const total = questions.length;
  const correct = questions.filter((q) => answers[q.id] === q.correctOptionId).length;
  return { score: total ? Math.round((correct / total) * 100) : 0, correct, total };
}
