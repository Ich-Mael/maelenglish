import { allSteps, type Outline } from "./progress";
import { coursePath, examPath, stepPath } from "./paths";

/** Flattened order of a course: every unit's steps, then the final exam. */
export function stepHrefs(courseId: string, outline: Outline): string[] {
  const out = allSteps(outline).map((s) => stepPath(courseId, s.id));
  if (outline.finalExam) out.push(examPath(courseId));
  return out;
}

/** The step after `href` (or the course page at the end). */
export function stepAfter(courseId: string, outline: Outline, href: string): string {
  const steps = stepHrefs(courseId, outline);
  const i = steps.indexOf(href);
  return (i >= 0 && steps[i + 1]) || coursePath(courseId);
}

/** The step before `href` (or the course page at the start). */
export function stepBefore(courseId: string, outline: Outline, href: string): string {
  const steps = stepHrefs(courseId, outline);
  const i = steps.indexOf(href);
  return (i > 0 && steps[i - 1]) || coursePath(courseId);
}
