/*
 * Story Mode progression rules (pure, shared). Episodes unlock in order inside a season; the 3
 * stages of an episode unlock in order (owner decision 2026-11-23): the video, « learn & practise »
 * (the lessons and Lab activities of a course unit), then the conversation (a Talk with Coach Ish
 * role-play whose debrief score proves mastery). After 2 conversations below the pass score
 * « Continue anyway » marks it completed_with_review, so no learner is ever stuck.
 */

export const STAGE_KEYS = ["video", "learn", "conversation"] as const;
export type StageKey = (typeof STAGE_KEYS)[number];
export type StageState = "locked" | "available" | "completed" | "waived" | "completed_with_review";

export const STAGE_LABEL: Record<StageKey, string> = { video: "Video", learn: "Learn & practise", conversation: "Conversation" };
/** Attempts before « Continue anyway » (only the conversation: the video and the activities always complete). */
export const ESCAPE_AFTER: Record<StageKey, number> = { video: 0, learn: 0, conversation: 2 };

export const isDone = (s: StageState | undefined | null) => s === "completed" || s === "waived" || s === "completed_with_review";

export type EpisodeStages = Record<StageKey, StageState>;

/** Stage states from what's stored: a stage is available once the previous one is done. */
export function stagesOf(p: Partial<Record<"stageVideo" | "stageLearn" | "stageConversation", string | null>> | null | undefined): EpisodeStages {
  const stored: Record<StageKey, StageState> = {
    video: (p?.stageVideo as StageState) || "locked",
    learn: (p?.stageLearn as StageState) || "locked",
    conversation: (p?.stageConversation as StageState) || "locked",
  };
  const out = {} as EpisodeStages;
  let prevDone = true;
  for (const k of STAGE_KEYS) {
    out[k] = isDone(stored[k]) ? stored[k] : prevDone ? "available" : "locked";
    prevDone = isDone(out[k]);
  }
  return out;
}

export const episodeDone = (s: EpisodeStages) => STAGE_KEYS.every((k) => isDone(s[k]));
/** The stage to resume: the first not done (null when the episode is finished). */
export const currentStage = (s: EpisodeStages): StageKey | null => STAGE_KEYS.find((k) => !isDone(s[k])) ?? null;

export type EpisodeLock = "open" | "locked" | "no_access";

/**
 * Which episodes of a story the learner can open: in order (an episode opens when the previous one
 * is done), and only with access (entitlement, staff, or one of the free episodes).
 */
export function episodeLocks(episodeIds: string[], done: Set<string>, access: { entitled: boolean; freeEpisodes: number }): Record<string, EpisodeLock> {
  const out: Record<string, EpisodeLock> = {};
  episodeIds.forEach((id, i) => {
    const allowed = access.entitled || i < access.freeEpisodes;
    if (!allowed) out[id] = "no_access";
    else if (i === 0 || done.has(episodeIds[i - 1]) || done.has(id)) out[id] = "open";
    else out[id] = "locked";
  });
  return out;
}

/** Video: passes at the threshold of the duration actually watched (furthest point reached). */
export const videoPassed = (maxSeconds: number, duration: number, threshold = 0.9) => duration <= 0 || maxSeconds >= duration * threshold;

/**
 * The unit's steps inside an episode: open one after another (a step is open once the previous
 * one is done). Lab activities complete whatever the score, as in courses.
 */
export function learnStates(stepIds: string[], done: Set<string>): Record<string, "completed" | "open" | "locked"> {
  const out: Record<string, "completed" | "open" | "locked"> = {};
  let prevDone = true;
  for (const id of stepIds) {
    out[id] = done.has(id) ? "completed" : prevDone ? "open" : "locked";
    prevDone = done.has(id);
  }
  return out;
}
