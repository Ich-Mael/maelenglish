/**
 * Progression rules (pure, no database — unit-tested in tests/progress.test.ts).
 *
 * Units group a module's lessons (Course → Module → Unit → lessons). Inside a module, lessons open
 * one after the other in unit order. A unit may end with a speaking challenge (recorded answer,
 * feedback from a coach): it opens once the unit's lessons are done, and **sending it** (whatever
 * the coach's later decision) completes the unit and opens the next one.
 *
 * Regular course:
 *  - modules open in order: module N+1 opens once module N is complete
 *    (all its lessons done and, if it has a quiz, the quiz passed);
 *  - inside an open module, lessons open one after the other;
 *  - the module quiz opens once all the module's lessons are done;
 *  - the module assignment can be submitted as soon as the module is open;
 *  - the final exam and final project open once every module is complete.
 * Challenge course (rules of the original app's challenge gate): each module is a "day".
 *  - time is the ceiling: day N opens N−1 days after the enrolment start;
 *  - checkpoints are the floor: day N+1 opens only once day N's checkpoint
 *    (module assignment, when `isCheckpointRequired`) is approved (status graded).
 * Staff preview: everything is open.
 */

export type SubmissionStatus = "pending" | "graded" | "returned";

export type OutlineInput = {
  modules: {
    id: string;
    title: string;
    /** Objective (one line) and rich-text description, passed through for display. */
    summary?: string;
    description?: string;
    hasQuiz: boolean;
    hasAssignment: boolean;
    isCheckpointRequired: boolean;
    /** Units in order (optional: without them, all lessons form one untitled group). */
    units?: { id: string; title: string; objective?: string; hasChallenge?: boolean }[];
    /** `unitId` absent or unknown = older lesson not yet placed in a unit (shown first, untitled). */
    lessons: { id: string; title: string; type: string; unitId?: string | null }[];
  }[];
  completedLessonIds: ReadonlySet<string>;
  /** module id → best score / passed */
  quizResults: ReadonlyMap<string, { bestScore: number; passed: boolean }>;
  /** module id → assignment submission status */
  assignments: ReadonlyMap<string, SubmissionStatus>;
  /** unit id → speaking challenge submission status */
  unitChallenges?: ReadonlyMap<string, SubmissionStatus>;
  finalExam: { exists: boolean; bestScore: number | null; passed: boolean };
  finalProject: { exists: boolean; status: SubmissionStatus | null };
  isChallenge: boolean;
  /** Enrolment start (challenge Day 1). */
  start: Date;
  now?: Date;
  preview?: boolean;
};

export type StepState = "locked" | "available" | "completed";
export type DayState = "done" | "current" | "pending_review" | "redo" | "locked_checkpoint" | "locked_time";

export type LessonOutline = { id: string; title: string; type: string; state: StepState };

/** `id` "" = lessons not yet placed in a unit (no header on the course map). */
/** Speaking challenge closing a unit. `state` completed = sent (pending) or validated; returned = available again. */
export type ChallengeOutline = { state: StepState; status: SubmissionStatus | null };

/** `done` / `total` count the lessons plus the challenge. */
export type UnitOutline = { id: string; title: string; objective: string; index: number; state: StepState; done: number; total: number; lessons: LessonOutline[]; challenge: ChallengeOutline | null };

export type ModuleOutline = {
  id: string;
  title: string;
  summary: string;
  description: string;
  index: number;
  state: StepState;
  /** Challenge only. */
  day?: { number: number; state: DayState; opensOn: Date };
  /** All lessons in learning order (units in order). */
  lessons: LessonOutline[];
  /** Units that have at least one lesson. */
  units: UnitOutline[];
  quiz: { state: StepState; bestScore: number | null } | null;
  assignment: { state: StepState; status: SubmissionStatus | null } | null;
};

export type Outline = {
  modules: ModuleOutline[];
  lessonsDone: number;
  lessonsTotal: number;
  percent: number;
  finalExam: { state: StepState; bestScore: number | null } | null;
  finalProject: { state: StepState; status: SubmissionStatus | null } | null;
  /** Where « Continuer » goes. */
  next:
    | { type: "lesson"; moduleId: string; lessonId: string }
    | { type: "challenge"; moduleId: string; unitId: string }
    | { type: "quiz" | "assignment"; moduleId: string }
    | { type: "final-exam" | "final-project" } | null;
  challenge?: { totalDays: number; unlockedDay: number; streak: number };
};

const DAY_MS = 24 * 60 * 60 * 1000;
const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export function computeOutline(input: OutlineInput): Outline {
  const { completedLessonIds: done, quizResults, assignments, preview = false } = input;
  const unitChallenges = input.unitChallenges ?? new Map<string, SubmissionStatus>();
  const now = input.now ?? new Date();

  // Challenge gating (which days are open).
  let dayOpen: (i: number) => boolean = () => true;
  let challenge: Outline["challenge"];
  let dayInfo: (i: number) => ModuleOutline["day"] = () => undefined;
  if (input.isChallenge) {
    const startDay = startOfDay(input.start);
    const elapsed = Math.max(0, Math.floor((startOfDay(now).getTime() - startDay.getTime()) / DAY_MS));
    const total = input.modules.length;
    const timeCeiling = preview ? total : elapsed + 1;
    let approved = 0;
    for (const m of input.modules) {
      if (!m.isCheckpointRequired || !m.hasAssignment || assignments.get(m.id) === "graded") approved++;
      else break;
    }
    const unlocked = preview ? total : Math.min(timeCeiling, approved + 1);
    challenge = { totalDays: total, unlockedDay: Math.min(unlocked, total), streak: Math.min(approved, total) };
    dayOpen = (i) => preview || i + 1 <= unlocked;
    dayInfo = (i) => {
      const n = i + 1;
      const m = input.modules[i];
      const status = assignments.get(m.id);
      let state: DayState;
      if (preview || n < unlocked) state = "done";
      else if (n === unlocked) state = m.isCheckpointRequired && status === "pending" ? "pending_review" : m.isCheckpointRequired && status === "returned" ? "redo" : "current";
      else state = n <= timeCeiling ? "locked_checkpoint" : "locked_time";
      return { number: n, state, opensOn: new Date(startDay.getTime() + i * DAY_MS) };
    };
  }

  let previousComplete = true;
  let allComplete = true;
  const modules: ModuleOutline[] = input.modules.map((m, index) => {
    const quiz = quizResults.get(m.id);
    const open = preview || (input.isChallenge ? dayOpen(index) : previousComplete);

    // Group by unit: untitled group (no or unknown unit) first, then the units in order.
    const unitIds = new Set((m.units ?? []).map((u) => u.id));
    const groups = [
      { id: "", title: "", objective: "", hasChallenge: false },
      ...(m.units ?? []).map((u) => ({ id: u.id, title: u.title, objective: u.objective ?? "", hasChallenge: !!u.hasChallenge })),
    ].map((u) => ({ ...u, lessons: m.lessons.filter((l) => (l.unitId && unitIds.has(l.unitId) ? l.unitId : "") === u.id) }));

    let prevLessonDone = true;
    let unitIndex = 0;
    const units: UnitOutline[] = groups
      .filter((g) => g.lessons.length || g.hasChallenge)
      .map((g) => {
        const lessons: LessonOutline[] = g.lessons.map((l) => {
          const isDone = done.has(l.id);
          const state: StepState = isDone ? "completed" : open && (preview || prevLessonDone) ? "available" : "locked";
          prevLessonDone = isDone;
          return { id: l.id, title: l.title, type: l.type, state };
        });
        let challenge: ChallengeOutline | null = null;
        if (g.hasChallenge) {
          const status = unitChallenges.get(g.id) ?? null;
          const sent = status !== null;
          const state: StepState = status === "pending" || status === "graded" ? "completed" : open && (preview || prevLessonDone) ? "available" : "locked";
          challenge = { state, status };
          prevLessonDone = sent; // the next unit opens once the challenge is sent
        }
        const steps = lessons.length + (challenge ? 1 : 0);
        const doneCount = lessons.filter((l) => l.state === "completed").length + (challenge?.status ? 1 : 0);
        const state: StepState = doneCount === steps ? "completed" : lessons.some((l) => l.state !== "locked") || (challenge && challenge.state !== "locked") ? "available" : "locked";
        return { id: g.id, title: g.title, objective: g.objective, index: g.id ? unitIndex++ : -1, state, done: doneCount, total: steps, lessons, challenge };
      });
    const lessons = units.flatMap((u) => u.lessons);
    // Every lesson done and every challenge sent.
    const lessonsComplete = m.lessons.every((l) => done.has(l.id)) && units.every((u) => !u.challenge || u.challenge.status !== null);
    const quizPassed = !m.hasQuiz || !!quiz?.passed;
    const complete = lessonsComplete && quizPassed;

    const status = assignments.get(m.id) ?? null;
    const outline: ModuleOutline = {
      id: m.id,
      title: m.title,
      summary: m.summary ?? "",
      description: m.description ?? "",
      index,
      state: complete && open ? "completed" : open ? "available" : "locked",
      day: dayInfo(index),
      lessons,
      units,
      quiz: m.hasQuiz
        ? { state: quiz?.passed ? "completed" : open && (preview || lessonsComplete) ? "available" : "locked", bestScore: quiz?.bestScore ?? null }
        : null,
      assignment: m.hasAssignment
        ? { state: status === "graded" ? "completed" : open ? "available" : "locked", status }
        : null,
    };
    previousComplete = previousComplete && complete;
    allComplete = allComplete && complete;
    return outline;
  });

  const lessonsTotal = input.modules.reduce((n, m) => n + m.lessons.length, 0);
  const lessonsDone = input.modules.reduce((n, m) => n + m.lessons.filter((l) => done.has(l.id)).length, 0);
  const finalsOpen = preview || allComplete;

  const finalExam = input.finalExam.exists
    ? { state: (input.finalExam.passed ? "completed" : finalsOpen ? "available" : "locked") as StepState, bestScore: input.finalExam.bestScore }
    : null;
  const finalProject = input.finalProject.exists
    ? { state: (input.finalProject.status === "graded" ? "completed" : finalsOpen ? "available" : "locked") as StepState, status: input.finalProject.status }
    : null;

  return {
    modules,
    lessonsDone,
    lessonsTotal,
    percent: lessonsTotal ? Math.round((lessonsDone / lessonsTotal) * 100) : 0,
    finalExam,
    finalProject,
    next: nextStep(modules, finalExam, finalProject),
    challenge,
  };
}

function nextStep(modules: ModuleOutline[], exam: Outline["finalExam"], project: Outline["finalProject"]): Outline["next"] {
  for (const m of modules) {
    if (m.state === "locked") break;
    for (const u of m.units) {
      const lesson = u.lessons.find((l) => l.state === "available");
      if (lesson) return { type: "lesson", moduleId: m.id, lessonId: lesson.id };
      if (u.challenge?.state === "available" && !u.challenge.status) return { type: "challenge", moduleId: m.id, unitId: u.id };
    }
    if (m.quiz?.state === "available") return { type: "quiz", moduleId: m.id };
    if (m.assignment?.state === "available" && !m.assignment.status) return { type: "assignment", moduleId: m.id };
  }
  if (exam?.state === "available") return { type: "final-exam" };
  if (project?.state === "available" && !project.status) return { type: "final-project" };
  return null;
}

/** Score 0–100 of a graded quiz (answers = chosen option id per question id). */
export function gradeQuiz(
  questions: { id: string; correctOptionId: string }[],
  answers: Readonly<Record<string, string | undefined>>,
): { score: number; correct: number; total: number } {
  const total = questions.length;
  const correct = questions.filter((q) => answers[q.id] === q.correctOptionId).length;
  return { score: total ? Math.round((correct / total) * 100) : 0, correct, total };
}
