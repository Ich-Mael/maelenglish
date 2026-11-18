/**
 * Progression rules (pure, no database — unit-tested in tests/progress.test.ts).
 *
 * Regular course:
 *  - modules open in order: module N+1 opens once module N is complete
 *    (all its lessons done and, if it has a quiz, the quiz passed);
 *  - inside an open module, lessons open one after the other;
 *  - the module quiz opens once all the module's lessons are done;
 *  - the module assignment can be submitted as soon as the module is open;
 *  - the final exam and final project open once every module is complete.
 * Challenge course (ported from legacy challengeGate): each module is a "day".
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
    hasQuiz: boolean;
    hasAssignment: boolean;
    isCheckpointRequired: boolean;
    lessons: { id: string; title: string; type: string }[];
  }[];
  completedLessonIds: ReadonlySet<string>;
  /** module id → best score / passed */
  quizResults: ReadonlyMap<string, { bestScore: number; passed: boolean }>;
  /** module id → assignment submission status */
  assignments: ReadonlyMap<string, SubmissionStatus>;
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

export type ModuleOutline = {
  id: string;
  title: string;
  index: number;
  state: StepState;
  /** Challenge only. */
  day?: { number: number; state: DayState; opensOn: Date };
  lessons: { id: string; title: string; type: string; state: StepState }[];
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
  next: { type: "lesson"; moduleId: string; lessonId: string } | { type: "quiz" | "assignment"; moduleId: string } | { type: "final-exam" | "final-project" } | null;
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
    const lessonsComplete = m.lessons.every((l) => done.has(l.id));
    const quizPassed = !m.hasQuiz || !!quiz?.passed;
    const complete = lessonsComplete && quizPassed;
    const open = preview || (input.isChallenge ? dayOpen(index) : previousComplete);

    let prevLessonDone = true;
    const lessons = m.lessons.map((l) => {
      const isDone = done.has(l.id);
      const state: StepState = isDone ? "completed" : open && (preview || prevLessonDone) ? "available" : "locked";
      prevLessonDone = isDone;
      return { ...l, state };
    });

    const status = assignments.get(m.id) ?? null;
    const outline: ModuleOutline = {
      id: m.id,
      title: m.title,
      index,
      state: complete && open ? "completed" : open ? "available" : "locked",
      day: dayInfo(index),
      lessons,
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
    const lesson = m.lessons.find((l) => l.state === "available");
    if (lesson) return { type: "lesson", moduleId: m.id, lessonId: lesson.id };
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
