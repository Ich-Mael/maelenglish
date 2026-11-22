import { parseGaps, sentenceText, type ActivityType, type GapsContent, type ListeningContent, type MatchContent, type SentenceContent, type TfngContent, type CompleteWordsContent } from "./types";
import { normalizeEnglish } from "@/lib/ai/text";
import { matchAnswer } from "./match";

/*
 * Scoring of Lab activities (shared by browser and server): the browser checks each
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
    case "fill_gaps":
    case "listen_fill_gaps": {
      const c = content as GapsContent;
      const gap = parseGaps(c).gaps.find((g) => g.id === itemId);
      return !!gap && typeof answer === "string" && matchAnswer(answer, gap.answers, { typo: c.typos }).ok;
    }
    case "sentence_builder": {
      // The tiles placed, joined by spaces; punctuation, case and contractions don't matter.
      const it = (content as SentenceContent).items.find((x) => x.id === itemId);
      if (!it || typeof answer !== "string" || !answer.trim()) return false;
      const given = normalizeEnglish(answer);
      return [sentenceText(it.sentence), ...it.alternatives].some((s) => normalizeEnglish(s) === given);
    }
    case "match_pairs":
    case "listen_match":
      // Item = a left card; answer = the first right card it was matched with (its pair id).
      return (content as MatchContent).pairs.some((p) => p.id === itemId) && answer === itemId;
    case "true_false_ng":
      return (content as TfngContent).statements.some((s) => s.id === itemId && s.answer === answer);
    case "complete_words": {
      // The exact letters (capitals ignored): spelling is the point.
      const gap = parseGaps({ text: (content as CompleteWordsContent).text, explanations: [] }).gaps.find((g) => g.id === itemId);
      const got = typeof answer === "string" ? answer.replace(/\s+/g, "").toLowerCase() : "";
      return !!gap && !!got && gap.answers.some((a) => a.toLowerCase() === got);
    }
    default:
      return false;
  }
}

export function itemIds(type: ActivityType, content: unknown): string[] {
  switch (type) {
    case "listen_choose":
      return (content as ListeningContent).questions.map((q) => q.id);
    case "fill_gaps":
    case "listen_fill_gaps":
      return parseGaps(content as GapsContent).gaps.map((g) => g.id);
    case "sentence_builder":
      return (content as SentenceContent).items.map((i) => i.id);
    case "match_pairs":
    case "listen_match":
      return (content as MatchContent).pairs.map((p) => p.id);
    case "true_false_ng":
      return (content as TfngContent).statements.map((s) => s.id);
    case "complete_words":
      return parseGaps({ text: (content as CompleteWordsContent).text, explanations: [] }).gaps.map((g) => g.id);
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
