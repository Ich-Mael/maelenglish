import type { Outline } from "./progress";

export const coursePath = (c: string) => `/apprendre/${c}`;
/** Step player: lesson, activity or speaking challenge. */
export const stepPath = (c: string, s: string) => `/apprendre/${c}/etapes/${s}`;
export const examPath = (c: string) => `/apprendre/${c}/examen`;

export function nextPath(courseId: string, next: Outline["next"]): string | null {
  if (!next) return null;
  return next.type === "step" ? stepPath(courseId, next.stepId) : examPath(courseId);
}
