/*
 * Course structure (owner spec COURSE_STRUCTURE.md, 2026-11-21): Course (the spec's « Program ») →
 * Module → Unit → ordered Steps. A step is a lesson (teaches), an activity (practises the lesson it
 * points to, scored) or the unit's speaking challenge (always last, exactly one). Pattern of a valid
 * unit: lesson + 2–3 activities, repeated, then the challenge (see validate-unit.ts).
 * Shared by the browser and the server (no imports).
 */

export const STEP_KINDS = ["lesson", "activity", "challenge"] as const;
export type StepKind = (typeof STEP_KINDS)[number];

export const DEFAULT_PASS_SCORE = 60;
export const MIN_ACTIVITIES_PER_LESSON = 2;
export const MAX_ACTIVITIES_PER_LESSON = 3;

export const SECTION_TYPES = ["vocabulary", "grammar_rule", "dialogue", "tip"] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export type VocabularyItem = { id: string; term: string; meaning: string; example: string; audioMediaId: string };
export type DialogueLine = { id: string; speaker: string; text: string };

/** A block of a lesson page, shown in order. Learner-facing labels are French; the content is English. */
export type LessonSection =
  | { id: string; type: "vocabulary"; items: VocabularyItem[] }
  | { id: string; type: "grammar_rule"; rule: string; table: string[][]; examples: string[] }
  | { id: string; type: "dialogue"; lines: DialogueLine[]; audioMediaId: string }
  | { id: string; type: "tip"; text: string };

/** Lesson step content. `intro`: rich text (HTML, sanitised on save). Media are optional. */
export type LessonContent = { intro: string; videoUrl: string; audioMediaId: string; sections: LessonSection[] };

export const SECTION_LABEL: Record<SectionType, { admin: string; learner: string }> = {
  vocabulary: { admin: "Vocabulary", learner: "Vocabulaire" },
  grammar_rule: { admin: "Grammar rule", learner: "La règle" },
  dialogue: { admin: "Dialogue", learner: "Dialogue" },
  tip: { admin: "Mael's tip", learner: "Le conseil de Mael" },
};
