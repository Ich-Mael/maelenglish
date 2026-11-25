/*
 * Shadowing practice (coaching daily vocabulary, The Vocabulary I Need — components/shadowing/):
 * the goal and the animated cheer for a score. Pure, shared by server and browser.
 */

/** Share of the words understood to reach (owner decision 2026-11-25). */
export const SHADOW_GOAL = 80;

/** The cheer for a score (text, emoji, colour). */
export function cheerFor(percent: number): { text: string; emoji: string; good: boolean } {
  if (percent >= 98) return { text: "Excellent!", emoji: "🏆", good: true };
  if (percent >= 90) return { text: "Awesome!", emoji: "🤩", good: true };
  if (percent >= SHADOW_GOAL) return { text: "Well done!", emoji: "🎉", good: true };
  if (percent >= 60) return { text: "Not bad!", emoji: "👍", good: false };
  if (percent >= 40) return { text: "Almost there!", emoji: "💪", good: false };
  return { text: "Try again!", emoji: "🔁", good: false };
}

/** Audio route of the coaching vocabulary (`/api/coaching/vocab-audio`). */
export const coachingAudioSrc = (t: { coachingId: string; vocabId: string; itemId: string; what: "text" | "example" | "sentence"; sentenceId?: string }) =>
  `/api/coaching/vocab-audio?${new URLSearchParams({ c: t.coachingId, v: t.vocabId, i: t.itemId, what: t.what, ...(t.sentenceId ? { s: t.sentenceId } : {}) })}`;
