import type { Answers } from "./questions";

/*
 * Learner profiles (DIAGNOSTIC_SPEC.md §6): computed in code — transparent and tested — then given
 * to the AI that writes the report (the AI never chooses the profile). Pure.
 */

export const PROFILES = ["former_good_student", "school_wound", "immersion_returnee", "francophone_bubble", "speaking_block", "inconsistent"] as const;
export type ProfileId = (typeof PROFILES)[number];

export const PROFILE_INFO: Record<ProfileId, { name: string; need: string; max: number }> = {
  former_good_student: { name: "L'ancien bon élève", need: "Transformer sa grammaire en oral ; victoires rapides pour la confiance", max: 9 },
  school_wound: { name: "Le blessé de l'école", need: "Reconstruire la confiance ; petites victoires, pas de grammaire d'abord", max: 8 },
  immersion_returnee: { name: "Le revenant de l'immersion", need: "Réactivation + routine de pratique ; son anglais est en sommeil, pas perdu", max: 8 },
  francophone_bubble: { name: "La bulle francophone", need: "Pratique orale guidée ; l'exposition seule n'a pas suffi", max: 7 },
  speaking_block: { name: "Le bloqué à l'oral", need: "Oral à faible enjeu, mises en situation", max: 9 },
  inconsistent: { name: "L'irrégulier", need: "Micro-sessions quotidiennes, progrès visibles", max: 7 },
};

/** Tie-break order. */
const PRIORITY: ProfileId[] = ["speaking_block", "former_good_student", "immersion_returnee", "school_wound", "francophone_bubble", "inconsistent"];

const one = (a: Answers, id: string, ...values: string[]) => typeof a[id] === "string" && values.includes(a[id] as string);
const has = (a: Answers, id: string, ...values: string[]) => Array.isArray(a[id]) && (a[id] as string[]).some((v) => values.includes(v));
const agree = (a: Answers, id: string) => typeof a[id] === "number" && (a[id] as number) >= 4;
const pts = (cond: boolean, n: number) => (cond ? n : 0);

export function rawScores(a: Answers): Record<ProfileId, number> {
  const immersed = typeof a.q7 === "string" && a.q7 !== "no";
  return {
    former_good_student:
      pts(one(a, "q2", "very_good", "ok"), 2) +
      pts(one(a, "q4", "almost_never"), 1) +
      pts(has(a, "q3", "grammar") && !has(a, "q3", "speaking"), 1) +
      pts(agree(a, "s19"), 2) +
      (one(a, "q5a", "awkward", "ashamed") ? 2 : one(a, "q5a", "bit_frustrating") ? 1 : 0) +
      pts(agree(a, "s17"), 1),
    school_wound:
      pts(one(a, "q2", "struggling", "hated"), 2) +
      pts(one(a, "q6b", "mocked", "humiliated", "fear_board"), 2) +
      pts(one(a, "q5b", "teacher", "fear_asked"), 1) +
      pts(agree(a, "s20"), 2) +
      pts(agree(a, "s18"), 1),
    immersion_returnee: !immersed
      ? 0
      : (one(a, "q9", "much_better") ? 2 : one(a, "q9", "bit_better") ? 1 : 0) +
        (one(a, "q11", "dropped", "dropped_lot") ? 2 : one(a, "q11", "stagnated") ? 1 : 0) +
        pts(has(a, "q12", "frustration", "nostalgia"), 1) +
        pts(one(a, "q10", "all_time"), 1) +
        pts(agree(a, "s22"), 1) +
        pts(one(a, "q7", "1_3m", "gt_3m"), 1),
    francophone_bubble: !immersed
      ? 0
      : (one(a, "q10", "francophone_bubble") ? 3 : one(a, "q10", "class_only") ? 1 : 0) + pts(one(a, "q9", "no_diff"), 2) + pts(agree(a, "s22"), 1) + pts(agree(a, "s24"), 1),
    speaking_block:
      pts(agree(a, "s17"), 2) +
      pts(agree(a, "s24"), 2) +
      pts(agree(a, "s18"), 1) +
      pts(agree(a, "s23"), 1) +
      pts(one(a, "q25b", "let_other", "brief", "pretended", "avoided"), 2) +
      pts(has(a, "q25c", "shame", "embarrassment"), 1),
    inconsistent:
      pts(one(a, "q13", "several"), 2) +
      (one(a, "q15", "lt_1m") ? 2 : one(a, "q15", "1_3m") ? 1 : 0) +
      pts(has(a, "q16", "no_progress", "discouraged", "time"), 1) +
      pts(one(a, "q32", "varies"), 1) +
      pts(agree(a, "s22"), 1),
  };
}

export type ProfileResult = { primary: ProfileId; secondary: ProfileId[]; scores: Record<ProfileId, { points: number; normalized: number }> };

/** Primary = highest normalised score (ties: PRIORITY); secondary = up to 2 others ≥ 0.6 × primary and ≥ 0.4. */
export function computeProfiles(a: Answers): ProfileResult {
  const raw = rawScores(a);
  const scores = Object.fromEntries(PROFILES.map((p) => [p, { points: raw[p], normalized: Math.round((raw[p] / PROFILE_INFO[p].max) * 1000) / 1000 }])) as ProfileResult["scores"];
  const ranked = [...PRIORITY].sort((x, y) => scores[y].normalized - scores[x].normalized || PRIORITY.indexOf(x) - PRIORITY.indexOf(y));
  const primary = ranked[0];
  const top = scores[primary].normalized;
  const secondary = ranked.slice(1).filter((p) => scores[p].normalized >= 0.6 * top && scores[p].normalized >= 0.4).slice(0, 2);
  return { primary, secondary, scores };
}
