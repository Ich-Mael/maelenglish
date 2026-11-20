import type { Outline } from "./progress";
import { assignmentPath, challengePath, coursePath, examPath, lessonPath, projectPath, quizPath } from "./paths";

/** Flattened step order of a course: lessons and speaking challenge per unit, then quiz and assignment per module, then the finals. */
export function stepHrefs(courseId: string, outline: Outline): string[] {
  const out: string[] = [];
  for (const m of outline.modules) {
    for (const u of m.units) {
      for (const l of u.lessons) out.push(lessonPath(courseId, l.id));
      if (u.challenge) out.push(challengePath(courseId, u.id));
    }
    if (m.quiz) out.push(quizPath(courseId, m.id));
    if (m.assignment) out.push(assignmentPath(courseId, m.id));
  }
  if (outline.finalExam) out.push(examPath(courseId));
  if (outline.finalProject) out.push(projectPath(courseId));
  return out;
}

/** The step after `href` (or the course page at the end). */
export function stepAfter(courseId: string, outline: Outline, href: string): string {
  const steps = stepHrefs(courseId, outline);
  const i = steps.indexOf(href);
  return (i >= 0 && steps[i + 1]) || coursePath(courseId);
}
