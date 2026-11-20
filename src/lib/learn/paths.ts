import type { Outline } from "./progress";

export const coursePath = (c: string) => `/apprendre/${c}`;
export const lessonPath = (c: string, l: string) => `/apprendre/${c}/lecons/${l}`;
export const quizPath = (c: string, m: string) => `/apprendre/${c}/modules/${m}/quiz`;
export const assignmentPath = (c: string, m: string) => `/apprendre/${c}/modules/${m}/devoir`;
export const challengePath = (c: string, u: string) => `/apprendre/${c}/unites/${u}/defi`;
export const examPath = (c: string) => `/apprendre/${c}/examen`;
export const projectPath = (c: string) => `/apprendre/${c}/projet`;

export function nextPath(courseId: string, next: Outline["next"]): string | null {
  if (!next) return null;
  switch (next.type) {
    case "lesson":
      return lessonPath(courseId, next.lessonId);
    case "challenge":
      return challengePath(courseId, next.unitId);
    case "quiz":
      return quizPath(courseId, next.moduleId);
    case "assignment":
      return assignmentPath(courseId, next.moduleId);
    case "final-exam":
      return examPath(courseId);
    case "final-project":
      return projectPath(courseId);
  }
}
