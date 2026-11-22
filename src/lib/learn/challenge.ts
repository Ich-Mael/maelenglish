/*
 * Speaking challenge sends (shared by browser and server, no imports): a learner may send a unit's
 * challenge 3 times; each time a coach returns it (« À reprendre ») after the limit is reached,
 * one more send is granted, so a learner is never stuck on a returned challenge.
 */

export const MAX_CHALLENGE_SENDS = 3;

type Sends = { attempts?: number | null; extraAttempts?: number | null; mediaId?: unknown } | null | undefined;

/** Sends used (submissions made before the counter existed count as one). */
export const sendsUsed = (s: Sends) => (s ? (s.attempts ?? (s.mediaId ? 1 : 0)) : 0);
export const sendsAllowed = (s: Sends) => MAX_CHALLENGE_SENDS + (s?.extraAttempts ?? 0);
export const sendsLeft = (s: Sends) => Math.max(0, sendsAllowed(s) - sendsUsed(s));

/*
 * Attempts and their reviews. The submission's top-level review (status, grade, feedback, voice
 * note) answers the current recording; each `history` entry keeps the review of its own recording
 * so the coach can see what was asked before. Rows reviewed before entries kept reviews: when a
 * learner re-sent, the old feedback stayed on top while the new recording was pending.
 */

export type ReviewFields = {
  status?: string | null;
  grade?: number | null;
  feedback?: string | null;
  feedbackAudioMediaId?: unknown;
  feedbackAudioDurationS?: number | null;
  gradedBy?: unknown;
  gradedAt?: Date | null;
};
export type HistoryRow = ReviewFields & { mediaId: unknown; durationS?: number | null; sentAt?: Date | null };
type WithHistory = ReviewFields & { mediaId?: unknown; durationS?: number | null; submittedAt?: Date | null; updatedAt?: Date | null; history?: HistoryRow[] | null };

const hasReview = (r: ReviewFields) => !!(r.gradedAt || r.feedback || r.feedbackAudioMediaId);
const reviewOf = (r: ReviewFields): ReviewFields => ({
  status: r.status ?? null,
  grade: r.grade ?? null,
  feedback: r.feedback ?? "",
  feedbackAudioMediaId: r.feedbackAudioMediaId ?? null,
  feedbackAudioDurationS: r.feedbackAudioDurationS ?? 0,
  gradedBy: r.gradedBy ?? null,
  gradedAt: r.gradedAt ?? null,
});

/**
 * `history` with each recording's review filled in: the current (last) one gets the top-level
 * review once reviewed; while a new recording is pending, a review still on top belongs to the
 * previous recording (older rows) and is copied there if that entry has none.
 */
export function historyWithReviews(sub: WithHistory): HistoryRow[] {
  const rows: HistoryRow[] = (sub.history ?? []).map((h) => ({ ...h }));
  if (sub.mediaId && (!rows.length || String(rows[rows.length - 1].mediaId) !== String(sub.mediaId))) rows.push({ mediaId: sub.mediaId, durationS: sub.durationS ?? 0, sentAt: sub.submittedAt ?? sub.updatedAt ?? null });
  const last = rows.length - 1;
  if (last < 0) return rows;
  if (sub.status !== "pending") {
    if (hasReview(sub)) Object.assign(rows[last], reviewOf(sub));
  } else if (last > 0 && hasReview(sub) && !hasReview(rows[last - 1])) {
    Object.assign(rows[last - 1], reviewOf(sub), { status: null });
  }
  return rows;
}

export type ChallengeAttempt = { n: number; mediaId: string; durationS: number; sentAt: Date | null; current: boolean; review: ReviewFields | null };

/** Every recording sent, oldest first (« Submission 1 », « Submission 2 »…), with its review. */
export function challengeAttempts(sub: WithHistory): ChallengeAttempt[] {
  const rows = historyWithReviews(sub);
  return rows.map((r, i) => ({
    n: i + 1,
    mediaId: String(r.mediaId),
    durationS: r.durationS ?? 0,
    sentAt: r.sentAt ?? null,
    current: i === rows.length - 1,
    review: hasReview(r) ? reviewOf(r) : null,
  }));
}
