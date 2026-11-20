/**
 * Who may play a stored file (pure, tested in tests/media-access.test.ts). Enforced on the
 * server before any signed read URL is issued — the URL itself expires within minutes.
 * - public media (course content): any signed-in user;
 * - private media (recordings, voice notes): the owner, admins, and the owner's main coach;
 * - a voice note is private to its author (the coach) and is shared with the learner it answers
 *   (`sharedWith`).
 */
export type MediaViewer = { id: string; isAdmin: boolean };
export type MediaAccessInfo = {
  ownerId: string;
  visibility: "private" | "public";
  /** Main coach of the owner, when the owner is a learner. */
  ownerCoachId?: string | null;
  /** Extra users allowed (e.g. the learner a coach's voice note answers). */
  sharedWith?: readonly string[];
};

export function canReadMedia(viewer: MediaViewer | null, m: MediaAccessInfo): boolean {
  if (!viewer) return false;
  if (m.visibility === "public") return true;
  if (viewer.isAdmin || viewer.id === m.ownerId) return true;
  if (m.ownerCoachId && viewer.id === m.ownerCoachId) return true;
  return !!m.sharedWith?.includes(viewer.id);
}
