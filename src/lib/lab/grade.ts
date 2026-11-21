import type { ActivityType, ListeningContent } from "./types";

/*
 * Scoring of Lab activities (shared by browser and server, no imports): the browser checks each
 * item for instant feedback, the server recomputes the score from the same answers before saving.
 * One rule across the Lab: score 0–100 = first-try answers right / items (see `starsFor`).
 */

export type ItemResult = { id: string; correct: boolean };
export type Graded = { items: ItemResult[]; score: number };

/** Is one answer right? (`answer` = what the learner gave for that item.) */
export function checkItem(type: ActivityType, content: unknown, itemId: string, answer: unknown): boolean {
  switch (type) {
    case "listen_choose": {
      const q = (content as ListeningContent).questions.find((x) => x.id === itemId);
      return !!q && answer === q.correctOptionId;
    }
    default:
      return false;
  }
}

export function itemIds(type: ActivityType, content: unknown): string[] {
  switch (type) {
    case "listen_choose":
      return (content as ListeningContent).questions.map((q) => q.id);
    default:
      return [];
  }
}

/** First-try answers (item id → answer) → per-item results and score. */
export function gradeActivity(type: ActivityType, content: unknown, answers: Readonly<Record<string, unknown>>): Graded {
  const items = itemIds(type, content).map((id) => ({ id, correct: checkItem(type, content, id, answers[id]) }));
  const right = items.filter((i) => i.correct).length;
  return { items, score: items.length ? Math.round((right / items.length) * 100) : 0 };
}
