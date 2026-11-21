/*
 * Common details of every Lab activity (catalogue: level-tagged, skill, business theme, short
 * sessions, « Le conseil de Mael »). Shared by browser and server, no imports. Labels: `en` for the
 * admin, `fr` for learners.
 */

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

export const SKILLS = [
  { value: "listening", en: "Listening", fr: "Écoute" },
  { value: "reading", en: "Reading", fr: "Lecture" },
  { value: "writing", en: "Writing", fr: "Écrit" },
  { value: "speaking", en: "Speaking", fr: "Oral" },
  { value: "vocabulary", en: "Vocabulary", fr: "Vocabulaire" },
  { value: "grammar", en: "Grammar", fr: "Grammaire" },
] as const;
export type Skill = (typeof SKILLS)[number]["value"];

export const THEMES = [
  { value: "meetings", en: "Meetings", fr: "Réunions" },
  { value: "emails", en: "Emails", fr: "E-mails" },
  { value: "calls", en: "Phone calls", fr: "Appels" },
  { value: "presentations", en: "Presentations", fr: "Présentations" },
  { value: "interviews", en: "Job interviews", fr: "Entretiens" },
  { value: "negotiation", en: "Negotiation", fr: "Négociation" },
  { value: "customer-service", en: "Customer service", fr: "Service client" },
  { value: "travel", en: "Business travel", fr: "Voyages d'affaires" },
  { value: "small-talk", en: "Small talk & networking", fr: "Échanges informels" },
  { value: "other", en: "Other", fr: "Autre" },
] as const;
export type Theme = (typeof THEMES)[number]["value"];

export const skillLabel = (v: string, lang: "en" | "fr") => SKILLS.find((s) => s.value === v)?.[lang] ?? v;
export const themeLabel = (v: string, lang: "en" | "fr") => THEMES.find((t) => t.value === v)?.[lang] ?? v;

export type ActivityMeta = {
  level: CefrLevel | "";
  skills: Skill[];
  theme: Theme | "";
  /** Estimated minutes (catalogue: 3–8). 0 = not set. */
  durationMin: number;
  /** Short instruction shown at the top of the exercise (French). */
  instructions: string;
  /** « Le conseil de Mael », shown on the results screen (French). */
  maelTip: string;
};

/** Score 0–100 → stars (catalogue: ★ ≥ 50 %, ★★ ≥ 75 %, ★★★ ≥ 90 %). */
export const starsFor = (score: number) => (score >= 90 ? 3 : score >= 75 ? 2 : score >= 50 ? 1 : 0);

/** Cleans the common details sent by the admin form. */
export function cleanMeta(raw: { level?: string; skills?: string[]; theme?: string; durationMin?: unknown; instructions?: string; maelTip?: string }): ActivityMeta {
  const lv = (raw.level ?? "").trim().toUpperCase();
  const level = CEFR_LEVELS.includes(lv as CefrLevel) ? (lv as CefrLevel) : "";
  const skills = [...new Set(raw.skills ?? [])].filter((s): s is Skill => SKILLS.some((x) => x.value === s));
  const theme = THEMES.some((t) => t.value === raw.theme) ? (raw.theme as Theme) : "";
  const d = Math.round(Number(raw.durationMin));
  return {
    level,
    skills,
    theme,
    durationMin: Number.isFinite(d) ? Math.max(0, Math.min(60, d)) : 0,
    instructions: (raw.instructions ?? "").trim().slice(0, 300),
    maelTip: (raw.maelTip ?? "").trim().slice(0, 600),
  };
}
