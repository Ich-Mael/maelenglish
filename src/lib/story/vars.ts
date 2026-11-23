/*
 * Story variables (pure, browser + server): {city}, {learner_name}, {learner_job},
 * {learner_country} — replaced at display time and in AI prompts. Unknown variables stay as typed.
 */
export type StoryVars = { city: string; learner_name: string; learner_job: string; learner_country: string };

export const fillVars = (text: string, v: StoryVars) => text.replace(/\{(city|learner_name|learner_job|learner_country)\}/g, (_, k: keyof StoryVars) => v[k] || "");
