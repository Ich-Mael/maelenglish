/*
 * A learner's English level: the six CEFR levels (Common European Framework of Reference).
 * Shared by browser and server, no imports. `en` for the admin, `fr` for learners.
 */

export const ENGLISH_LEVELS = [
  { value: "A1", en: "Beginner", fr: "Débutant" },
  { value: "A2", en: "Elementary", fr: "Élémentaire" },
  { value: "B1", en: "Intermediate", fr: "Intermédiaire" },
  { value: "B2", en: "Upper intermediate", fr: "Intermédiaire avancé" },
  { value: "C1", en: "Advanced", fr: "Avancé" },
  { value: "C2", en: "Proficient", fr: "Maîtrise" },
] as const;
export type EnglishLevel = (typeof ENGLISH_LEVELS)[number]["value"];

export const isEnglishLevel = (v: string): v is EnglishLevel => ENGLISH_LEVELS.some((l) => l.value === v);

/** « B1 · Intermédiaire » (fr) / « B1 · Intermediate » (en); older free-text values are shown as typed. */
export function levelLabel(v: string | null | undefined, lang: "en" | "fr" = "fr"): string {
  if (!v) return "";
  const l = ENGLISH_LEVELS.find((x) => x.value === v);
  return l ? `${l.value} · ${l[lang]}` : v;
}
