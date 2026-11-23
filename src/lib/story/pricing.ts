import type { LoadedSeason } from "./content";

/* Story Mode pricing helpers (pure, browser + server): see src/lib/story/minutes.ts. */

/** Typical voice minutes of one episode: its role-play (≈ 5 min) played ≈ 1.5 times. */
export const MINUTES_PER_EPISODE = 1.5 * 5;

export type StoryPricing = { convUsdPerMin: number; ttsUsdPerKChar: number; usdToFcfa: number; defaultMarginPct: number };
export const DEFAULT_PRICING: StoryPricing = { convUsdPerMin: 0.06, ttsUsdPerKChar: 0.03, usdToFcfa: 600, defaultMarginPct: 200 };

/** Price suggestion (FCFA, rounded to 500): minutes × cost per minute × (1 + margin). */
export function suggestedPriceFcfa(minutes: number, costPerMinUsd: number, marginPct: number, usdToFcfa: number) {
  const fcfa = minutes * costPerMinUsd * (1 + marginPct / 100) * usdToFcfa;
  return Math.max(500, Math.ceil(fcfa / 500) * 500);
}

/** Characters voiced once for the whole season (the characters' scene lines). */
export function voicingChars(s: Pick<LoadedSeason, "chapterList" | "recap_scene">) {
  let n = s.recap_scene.lines.reduce((a, l) => a + (l.text_en?.length ?? 0), 0);
  for (const c of s.chapterList) for (const e of c.episodeList) for (const sc of [e.intro_scene, e.outro_scene]) for (const l of sc.lines) if (l.speaker !== "narrator") n += l.text_en?.length ?? 0;
  return n;
}
