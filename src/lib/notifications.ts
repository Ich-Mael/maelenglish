import { ADMIN_ROLES, Activity, ChallengeSubmission, Course, DigestLog, Unit, User, type ChallengeSubmissionDoc } from "@/models";
import { coachLabel } from "@/lib/coach-name";
import { dayKey } from "@/lib/gamification/rules";
import { plainText } from "@/lib/rich-text";
import { GRADING_DUE_HOURS, hoursWaiting, isLate, responsibleCoaches } from "@/lib/admin/coaching";
import { appUrl, sendAdminLateDigestEmail, sendChallengeReviewedEmail, sendCoachDigestEmail, type DigestItem } from "@/lib/email";

/*
 * Speaking-challenge emails (user decision 2026-11-21):
 *  - learner: as soon as a coach validates or returns their challenge (needs an email address);
 *  - coaches: one daily digest (from 8:00, APP_TZ) of the challenges waiting for them — their own
 *    learners, or the course team's when the learner has no main coach — late ones (> 48 h) first;
 *  - admins: in the same run, the list of late challenges across coaches.
 * Failures are logged and never block grading.
 */

/** Learner email after a review. */
export async function notifyChallengeReviewed(submissionId: string) {
  try {
    const s = await ChallengeSubmission.findById(submissionId).lean<ChallengeSubmissionDoc>();
    if (!s || s.status === "pending") return;
    const [learner, coach, course, activity] = await Promise.all([
      User.findById(s.userId).select("name email isActive").lean(),
      s.gradedBy ? User.findById(s.gradedBy).select("name coachName").lean() : null,
      Course.findById(s.courseId).select("title").lean(),
      s.activityId ? Activity.findById(s.activityId).select("title").lean() : null,
    ]);
    if (!learner?.email || learner.isActive === false) return;
    await sendChallengeReviewedEmail(learner.email, {
      firstName: learner.name,
      challengeTitle: activity?.title || "Défi oral",
      courseTitle: course?.title ?? "",
      decision: s.status as "graded" | "returned",
      grade: s.status === "graded" ? (s.grade ?? null) : null,
      maxScore: s.maxScore ?? 100,
      coachName: coach ? coachLabel(coach) : "",
      feedback: plainText(s.feedback ?? ""),
      voiceNote: !!s.feedbackAudioMediaId,
      url: appUrl(s.status === "returned" ? `/apprendre/${s.courseId}/etapes/${s.stepId}` : "/mes-defis"),
    });
  } catch (e) {
    console.error("[notify] challenge reviewed", e);
  }
}

export type DigestRun = { ran: boolean; emails: number; pending: number; late: number };

/**
 * The daily coach digest. Runs once per day (`DigestLog` key), from 8:00 in APP_TZ, unless `force`
 * (admin « Send now »: a second run the same day gets its own key).
 */
export async function runCoachDigest(now = new Date(), opts: { force?: boolean } = {}): Promise<DigestRun> {
  const day = dayKey(now);
  const key = opts.force ? `coach-digest:${day}:manual:${now.getTime()}` : `coach-digest:${day}`;
  if (!opts.force) {
    const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: process.env.APP_TZ || "Africa/Ouagadougou" }).format(now));
    if (hour < 8) return { ran: false, emails: 0, pending: 0, late: 0 };
  }
  // Claim the run first (unique key): another instance or a restart won't send it twice.
  try {
    await DigestLog.create({ key, sentAt: now });
  } catch {
    return { ran: false, emails: 0, pending: 0, late: 0 };
  }

  const pending = await ChallengeSubmission.find({ status: "pending" }).lean<ChallengeSubmissionDoc[]>();
  const owners = await responsibleCoaches(pending);
  const [learners, courses, units] = await Promise.all([
    User.find({ _id: { $in: pending.map((s) => s.userId) } }).select("name surname").lean(),
    Course.find({ _id: { $in: pending.map((s) => s.courseId) } }).select("title").lean(),
    Unit.find({ _id: { $in: pending.map((s) => s.unitId) } }).select("title").lean(),
  ]);
  const find = <T extends { _id: unknown }>(l: T[], id: unknown) => l.find((x) => String(x._id) === String(id));
  const item = (s: ChallengeSubmissionDoc): DigestItem => {
    const u = find(learners, s.userId);
    return {
      learner: u ? `${u.name} ${u.surname}`.trim() : "Learner",
      course: find(courses, s.courseId)?.title ?? "",
      unit: find(units, s.unitId)?.title ?? "",
      hoursWaiting: hoursWaiting(s, now),
      late: isLate(s, now),
      url: appUrl(`/admin/corrections/${s._id}`),
    };
  };

  const coachIds = [...new Set([...owners.values()].flat())];
  const coaches = await User.find({ _id: { $in: coachIds }, isActive: { $ne: false }, email: { $exists: true, $ne: null } }).select("name surname email").lean();
  let emails = 0;
  for (const c of coaches) {
    const items = pending
      .filter((s) => owners.get(String(s._id))?.includes(String(c._id)))
      .map(item)
      .sort((a, b) => Number(b.late) - Number(a.late) || b.hoursWaiting - a.hoursWaiting);
    if (!items.length || !c.email) continue;
    try {
      await sendCoachDigestEmail(c.email, { firstName: c.name, items, dueHours: GRADING_DUE_HOURS });
      emails++;
    } catch (e) {
      console.error("[digest] coach", e);
    }
  }

  const late = pending.filter((s) => isLate(s, now));
  if (late.length) {
    const admins = await User.find({ role: { $in: ADMIN_ROLES }, isActive: { $ne: false }, email: { $exists: true, $ne: null } }).select("email").lean();
    const names = new Map((await User.find({ _id: { $in: coachIds } }).select("name surname").lean()).map((u) => [String(u._id), `${u.name} ${u.surname}`.trim()]));
    const to = admins.map((a) => a.email).filter((e): e is string => !!e);
    if (to.length) {
      try {
        await sendAdminLateDigestEmail(to, {
          dueHours: GRADING_DUE_HOURS,
          items: late.map((s) => ({ ...item(s), coach: (owners.get(String(s._id)) ?? []).map((id) => names.get(id) ?? "").filter(Boolean).join(", ") })).sort((a, b) => b.hoursWaiting - a.hoursWaiting),
        });
        emails++;
      } catch (e) {
        console.error("[digest] admins", e);
      }
    }
  }
  await DigestLog.updateOne({ key }, { $set: { emails, pending: pending.length, late: late.length } });
  return { ran: true, emails, pending: pending.length, late: late.length };
}

/** Last automatic digest (oversight page). */
export const lastDigest = () => DigestLog.findOne({ key: /^coach-digest:/ }).sort({ sentAt: -1 }).lean();

/** Starts the in-process daily check (production server; every 10 minutes, runs at most once a day). */
export function startDigestScheduler() {
  const g = globalThis as typeof globalThis & { _digestTimer?: ReturnType<typeof setInterval> };
  if (g._digestTimer) return;
  const tick = async () => {
    try {
      const { connectDB } = await import("@/lib/db");
      await connectDB();
      const r = await runCoachDigest();
      if (r.ran) console.info(`[digest] sent ${r.emails} email(s) · ${r.pending} pending · ${r.late} late`);
    } catch (e) {
      console.error("[digest]", e);
    }
  };
  g._digestTimer = setInterval(() => void tick(), 10 * 60 * 1000);
  setTimeout(() => void tick(), 60 * 1000); // first check a minute after start
}
