import { MAX_ACTIVITIES_PER_LESSON, MIN_ACTIVITIES_PER_LESSON, type StepKind } from "./types";

/*
 * Unit rules (owner spec §4), pure. Valid pattern over step kinds: ^(L A{2,3})+ C$.
 * - the first step is a lesson; every lesson is followed by 2 or 3 activities;
 * - each activity practises a lesson placed earlier in the same unit;
 * - exactly one speaking challenge, always last;
 * - lessons have content; the challenge uses a « ready » Lab activity.
 * Staff save freely; a unit with errors is hidden from learners (user decision 2026-11-21) and the
 * admin shows these messages (English: admin only). A practice activity still a draft in the Lab
 * is simply skipped for learners (user decision 2026-11-22: work in progress mustn't hide a live
 * unit): the rules run on the steps learners see (`learnerSteps`), drafts are listed apart
 * (`draftNotices`).
 */

export type UnitStepInput = {
  id: string;
  kind: StepKind;
  title: string;
  /** activity: the lesson step it practises. */
  lessonId?: string | null;
  /** activity / challenge: the Lab activity exists and is « ready ». */
  ready?: boolean;
  /** lesson: has an intro, a video or a section. */
  hasContent?: boolean;
};

export type UnitProblem = { stepId?: string; message: string };

const name = (s: UnitStepInput) => `« ${s.title || "Untitled"} »`;

/** Practice activity whose Lab activity is a draft: not shown to learners. */
export const isDraftActivity = (s: Pick<UnitStepInput, "kind" | "ready">) => s.kind === "activity" && s.ready === false;

/** The steps learners see: draft practice activities left out. */
export const learnerSteps = <T extends Pick<UnitStepInput, "kind" | "ready">>(steps: readonly T[]): T[] => steps.filter((s) => !isDraftActivity(s));

/** Draft practice activities (admin notice, not an error: the unit stays visible without them). */
export const draftNotices = (steps: readonly UnitStepInput[]): UnitProblem[] =>
  steps.filter(isDraftActivity).map((s) => ({ stepId: s.id, message: `Activity ${name(s)} is a draft in the Lab: learners don't see it until you mark it ready.` }));

export function validateUnit(all: readonly UnitStepInput[]): UnitProblem[] {
  const steps = learnerSteps(all);
  const problems: UnitProblem[] = [];
  if (!steps.length) return [{ message: all.length ? "Learners would see nothing: every step is a draft in the Lab." : "The unit is empty: start with a lesson, add 2 or 3 activities, then the speaking challenge." }];

  if (steps[0].kind !== "lesson") problems.push({ stepId: steps[0].id, message: "The unit must start with a lesson." });

  // Lesson blocks: each lesson and the activities right after it.
  steps.forEach((s, i) => {
    if (s.kind !== "lesson") return;
    let n = 0;
    while (steps[i + 1 + n]?.kind === "activity") n++;
    if (n < MIN_ACTIVITIES_PER_LESSON) {
      const after = steps[i + 1 + n];
      const why = n === 1 ? "has only 1 activity" : after?.kind === "lesson" ? "is followed directly by another lesson" : after?.kind === "challenge" ? "is followed directly by the challenge" : "has no activity";
      problems.push({ stepId: s.id, message: `Lesson ${name(s)} ${why}: every lesson needs ${MIN_ACTIVITIES_PER_LESSON} or ${MAX_ACTIVITIES_PER_LESSON} activities after it.` });
    } else if (n > MAX_ACTIVITIES_PER_LESSON) {
      problems.push({ stepId: s.id, message: `Lesson ${name(s)} has ${n} activities: ${MAX_ACTIVITIES_PER_LESSON} at most. Add another lesson between them.` });
    }
    if (s.hasContent === false) problems.push({ stepId: s.id, message: `Lesson ${name(s)} is empty: add an intro, a video or a section.` });
  });

  // Each activity practises a lesson above it.
  const lessonsAbove = new Set<string>();
  for (const s of steps) {
    if (s.kind === "lesson") lessonsAbove.add(s.id);
    if (s.kind === "activity") {
      if (!s.lessonId || !lessonsAbove.has(s.lessonId)) problems.push({ stepId: s.id, message: `Activity ${name(s)} must practise a lesson placed above it in this unit.` });
    }
  }

  // Exactly one challenge, last.
  const challenges = steps.filter((s) => s.kind === "challenge");
  if (!challenges.length) problems.push({ message: "Add the speaking challenge: it closes every unit." });
  if (challenges.length > 1) problems.push({ stepId: challenges[1].id, message: "A unit has exactly one speaking challenge." });
  const last = steps[steps.length - 1];
  for (const c of challenges) {
    if (c !== last) problems.push({ stepId: c.id, message: "The speaking challenge must be the last step of the unit." });
    if (c.ready === false) problems.push({ stepId: c.id, message: `Speaking challenge ${name(c)} is a draft in the Lab: mark it ready.` });
  }

  return problems;
}

/** Shorthand: the unit can be shown to learners. */
export const isUnitValid = (steps: readonly UnitStepInput[]) => validateUnit(steps).length === 0;
