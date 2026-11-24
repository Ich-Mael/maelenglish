/*
 * Coaching paths (pure). A Lab task played in a coaching uses the regular players with a « course
 * id » coaching~<taskId>: the learn actions recognise it and check the coaching instead of a course.
 */
export const COACHING_CTX = "coaching~";
export const coachingCtxId = (taskId: string) => `${COACHING_CTX}${taskId}`;
export const parseCoachingCtx = (id: string): string | null => (id.startsWith(COACHING_CTX) && id.length > COACHING_CTX.length ? id.slice(COACHING_CTX.length) : null);
export const coachingPath = (id: string, tab?: string) => `/mon-coaching/${id}${tab ? `?tab=${tab}` : ""}`;
export const coachingTaskPath = (id: string, taskId: string) => `/mon-coaching/${id}/taches/${taskId}`;
export const coachingSessionPath = (id: string, sessionId: string) => `/mon-coaching/${id}/seance/${sessionId}`;
export const adminCoachingPath = (id: string, tab?: string) => `/admin/coaching/${id}${tab ? `?tab=${tab}` : ""}`;
