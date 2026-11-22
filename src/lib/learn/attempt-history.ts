import "server-only";
import { User } from "@/models";
import { coachLabel } from "@/lib/coach-name";
import { challengeAttempts, type HistoryRow, type ReviewFields } from "./challenge";

/*
 * Earlier speaking-challenge submissions with the coach's review of each, ready for
 * `AttemptHistory` (learner pages and the coach's grading page). `url` resolves a media id
 * (recording or voice note) for the viewer: learners read their own recordings and the voice notes
 * shared with them by the submission, staff use `reviewMediaUrl`.
 */

export type AttemptItem = {
  n: number;
  sentAt: Date | null;
  durationS: number;
  recordingUrl: string | null;
  review: {
    status: "graded" | "returned" | null;
    grade: number | null;
    maxScore: number;
    feedback: string;
    gradedAt: Date | null;
    coach: { name: string; label: string; avatarUrl: string | null } | null;
    note: { url: string; seed: string; durationS: number } | null;
  } | null;
};

type Sub = ReviewFields & { mediaId?: unknown; durationS?: number | null; submittedAt?: Date | null; updatedAt?: Date | null; maxScore?: number | null; history?: HistoryRow[] | null };

/** Earlier submissions (not the current one), newest first. */
export async function previousAttempts(sub: Sub, url: (mediaId: string) => Promise<string | null>): Promise<AttemptItem[]> {
  const earlier = challengeAttempts(sub)
    .filter((a) => !a.current)
    .reverse();
  if (!earlier.length) return [];
  const coachIds = [...new Set(earlier.flatMap((a) => (a.review?.gradedBy ? [String(a.review.gradedBy)] : [])))];
  const coaches = coachIds.length ? await User.find({ _id: { $in: coachIds } }).select("name surname coachName avatarUrl").lean() : [];
  return Promise.all(
    earlier.map(async (a) => {
      const r = a.review;
      const noteId = r?.feedbackAudioMediaId ? String(r.feedbackAudioMediaId) : "";
      const [recordingUrl, noteUrl] = await Promise.all([url(a.mediaId).catch(() => null), noteId ? url(noteId).catch(() => null) : null]);
      const c = r?.gradedBy ? coaches.find((x) => String(x._id) === String(r.gradedBy)) : null;
      return {
        n: a.n,
        sentAt: a.sentAt,
        durationS: a.durationS,
        recordingUrl,
        review: r
          ? {
              status: r.status === "graded" || r.status === "returned" ? r.status : null,
              grade: r.status === "graded" ? (r.grade ?? null) : null,
              maxScore: sub.maxScore || 100,
              feedback: r.feedback ?? "",
              gradedAt: r.gradedAt ?? null,
              coach: c ? { name: `${c.name} ${c.surname}`.trim(), label: coachLabel(c), avatarUrl: c.avatarUrl ?? null } : null,
              note: noteUrl ? { url: noteUrl, seed: noteId, durationS: r.feedbackAudioDurationS ?? 0 } : null,
            }
          : null,
      };
    }),
  );
}
