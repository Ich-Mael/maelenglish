/*
 * How learners see a coach (pure, tests/coach-name.test.ts): the coach name set on their account
 * (`User.coachName`, e.g. « Coach Ish »), else « Coach <first name> ». A name typed without
 * « Coach » gets it in front (« Ish » → « Coach Ish »). Staff screens keep real names.
 */
export const COACH_NAME_MAX = 40;

export function coachLabel(u: { name?: string | null; coachName?: string | null } | null | undefined): string {
  const raw = (u?.coachName ?? "").trim().replace(/\s+/g, " ") || (u?.name ?? "").trim();
  if (!raw) return "Votre coach";
  return /^coach\b/i.test(raw) ? raw.replace(/^coach\b/i, "Coach") : `Coach ${raw}`;
}

/** The name without « Coach », for the avatar initial. */
export const coachInitialName = (label: string) => label.replace(/^(coach|votre coach)\s*/i, "") || label;
