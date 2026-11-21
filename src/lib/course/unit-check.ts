import { cleanLessonContent, lessonHasContent } from "./lesson-content";
import { validateUnit, type UnitProblem, type UnitStepInput } from "./validate-unit";
import type { StepKind } from "./types";

/*
 * Runs validateUnit on stored steps (any shape with these fields: lean docs or plain objects).
 * `readyActivityIds`: Lab activities marked « ready ». Pure.
 */

type StoredStep = { _id: unknown; kind: string; title: string; position?: number; content?: unknown; activityId?: unknown; lessonId?: unknown };

export function unitStepInputs(steps: readonly StoredStep[], readyActivityIds: ReadonlySet<string>): UnitStepInput[] {
  return [...steps]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((s) => ({
      id: String(s._id),
      kind: s.kind as StepKind,
      title: s.title,
      lessonId: s.lessonId ? String(s.lessonId) : null,
      ready: s.kind === "lesson" ? undefined : !!s.activityId && readyActivityIds.has(String(s.activityId)),
      hasContent: s.kind === "lesson" ? lessonHasContent(cleanLessonContent(s.content)) : undefined,
    }));
}

export function checkUnit(steps: readonly StoredStep[], readyActivityIds: ReadonlySet<string>): UnitProblem[] {
  return validateUnit(unitStepInputs(steps, readyActivityIds));
}
