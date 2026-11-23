/*
 * Story Mode paths (pure). A unit step played inside an episode uses the regular lesson / Lab
 * players with a « course id » of the form story~<season>~<episode>: the learn actions recognise it
 * and check Story Mode access instead of a course enrolment.
 */
export const STORY_CTX = "story~";
export const storyCtxId = (storyId: string, episodeId: string) => `${STORY_CTX}${storyId}~${episodeId}`;
export function parseStoryCtx(id: string): { storyId: string; episodeId: string } | null {
  if (!id.startsWith(STORY_CTX)) return null;
  const [storyId, episodeId] = id.slice(STORY_CTX.length).split("~");
  return storyId && episodeId ? { storyId, episodeId } : null;
}
export const seasonPath = (storyId: string) => `/histoire/${storyId}`;
export const episodePath = (storyId: string, episodeId: string) => `/histoire/${storyId}/${episodeId}`;
export const storyStepPath = (storyId: string, episodeId: string, stepId: string) => `/histoire/${storyId}/${episodeId}/${stepId}`;
