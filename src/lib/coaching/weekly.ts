import { Types } from "mongoose";
import { Activity, Coaching, CoachingAssessment, CoachingAssessmentAnswer, CoachingSentence, CoachingSession, CoachingTask, CoachingVocab, Course, DigestLog, User, VocabWord, type CoachingDoc, type CoachingTaskDoc } from "@/models";
import { coachLabel } from "@/lib/coach-name";
import { appUrl, sendCoachingEmail } from "@/lib/email";
import { dayKey } from "@/lib/gamification/rules";
import { CoachingError, openCoaching, taskStates, type Viewer } from "./service";
import { SENTENCES_PER_ITEM } from "./vocabulary";

/*
 * The weekly coaching summary (owner decision 2026-11-25): every Monday from 8:00 (APP_TZ), each
 * member of an active coaching gets a French email — their daily vocabulary of the last 7 days,
 * coaching expressions to review, next steps not ticked, open tasks (late / due this week), the
 * next session and what to prepare, an assessment waiting. Members can turn it off on their
 * Overview (`Coaching.weeklyOff`). Once per week (`DigestLog` « coaching-weekly:<monday> »).
 * Framework-free (tests/coaching-weekly.test.ts).
 */

const TZ = () => process.env.APP_TZ || "Africa/Ouagadougou";
const DAY = 86_400_000;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const frWhen = (d: Date) => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: TZ() }).format(d);
const frDay = (d: Date) => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ() }).format(d);

export type WeeklySummary = {
  vocab: { written: number; expected: number };
  toReview: number;
  steps: string[];
  tasks: { title: string; due: Date | null; late: boolean }[];
  session: { startsAt: Date; title: string; prep: string } | null;
  assessment: "start" | "end" | null;
};

/** What one member has to hear about this week in one coaching. */
export async function weeklySummary(coaching: Pick<CoachingDoc, "_id">, userId: string, now = new Date()): Promise<WeeklySummary> {
  const me = new Types.ObjectId(userId);
  const days = Array.from({ length: 7 }, (_, i) => dayKey(new Date(now.getTime() - (i + 1) * DAY)));
  const [vocabs, toReview, sessions, next, tasks, tests, answers] = await Promise.all([
    CoachingVocab.find({ coachingId: coaching._id, day: { $in: days } }).select("items.id").lean(),
    VocabWord.countDocuments({ userId: me, source: "coaching", coachingId: coaching._id, $or: [{ dueAt: null }, { dueAt: { $lte: now } }] }),
    CoachingSession.find({ coachingId: coaching._id, status: "done", startsAt: { $gte: new Date(now.getTime() - 45 * DAY) }, forUserId: { $in: [null, me] }, "nextSteps.0": { $exists: true } }).select("nextSteps").lean(),
    CoachingSession.findOne({ coachingId: coaching._id, status: "scheduled", startsAt: { $gt: now, $lte: new Date(now.getTime() + 7 * DAY) }, forUserId: { $in: [null, me] } }).sort({ startsAt: 1 }).select("startsAt title prep").lean(),
    CoachingTask.find({ coachingId: coaching._id, forUserId: { $in: [null, me] } }).lean<CoachingTaskDoc[]>(),
    CoachingAssessment.find({ coachingId: coaching._id }).select("phase").lean(),
    CoachingAssessmentAnswer.find({ coachingId: coaching._id, userId: me, submittedAt: { $ne: null } }).select("phase").lean(),
  ]);
  const written = vocabs.length ? await CoachingSentence.countDocuments({ vocabId: { $in: vocabs.map((x) => x._id) }, userId: me }) : 0;
  const expected = vocabs.reduce((n, d) => n + d.items.length * SENTENCES_PER_ITEM, 0);
  const steps = sessions.flatMap((s) => s.nextSteps.filter((x) => !(x.doneBy ?? []).some((d) => String(d) === userId)).map((x) => x.text));
  // Open tasks that matter this week: late, or due in the next 7 days.
  const states = await taskStates(tasks, [userId]);
  const soon = tasks.filter((t) => !states[String(t._id)]?.[userId]?.done && t.dueDate && t.dueDate.getTime() <= now.getTime() + 7 * DAY);
  const [acts, courses] = await Promise.all([
    Activity.find({ _id: { $in: soon.flatMap((t) => (t.activityId ? [t.activityId] : [])) } }).select("title").lean(),
    Course.find({ _id: { $in: soon.flatMap((t) => (t.courseId ? [t.courseId] : [])) } }).select("title").lean(),
  ]);
  const title = (t: CoachingTaskDoc) => (t.kind === "course" ? courses.find((c) => String(c._id) === String(t.courseId))?.title : acts.find((a) => String(a._id) === String(t.activityId))?.title) ?? "Activité";
  const pending = (["end", "start"] as const).find((p) => tests.some((t) => t.phase === p) && !answers.some((a) => a.phase === p)) ?? null;
  return {
    vocab: { written: Math.min(written, expected), expected },
    toReview,
    steps: steps.slice(0, 5),
    tasks: soon
      .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0))
      .slice(0, 5)
      .map((t) => ({ title: title(t), due: t.dueDate ?? null, late: !!t.dueDate && t.dueDate < now })),
    session: next ? { startsAt: next.startsAt, title: next.title ?? "", prep: next.prep ?? "" } : null,
    assessment: pending,
  };
}

/** The email's blocks (HTML and plain text), French. Empty sections are left out. */
export function weeklyEmail(s: WeeklySummary) {
  const blocks: { title: string; lines: string[] }[] = [];
  if (s.vocab.expected) blocks.push({ title: "Votre vocabulaire de la semaine", lines: [`${s.vocab.written} phrase${s.vocab.written > 1 ? "s" : ""} écrite${s.vocab.written > 1 ? "s" : ""} sur ${s.vocab.expected}${s.vocab.written >= s.vocab.expected ? " : bravo, tout est fait !" : s.vocab.written ? "." : " : les expressions vous attendent."}`] });
  if (s.toReview) blocks.push({ title: "À réviser", lines: [`${s.toReview} expression${s.toReview > 1 ? "s" : ""} du coaching à revoir dans vos tests de vocabulaire.`] });
  if (s.assessment) blocks.push({ title: "Évaluation orale", lines: [s.assessment === "end" ? "Votre évaluation de fin de coaching vous attend (environ 5 minutes)." : "Votre évaluation de début de coaching vous attend (environ 5 minutes)."] });
  if (s.steps.length) blocks.push({ title: "Vos prochaines étapes", lines: s.steps });
  if (s.tasks.length) blocks.push({ title: "Activités à faire", lines: s.tasks.map((t) => `${t.title}${t.due ? ` — ${t.late ? "en retard depuis" : "pour"} ${frDay(t.due)}` : ""}`) });
  if (s.session) blocks.push({ title: "Votre prochaine séance", lines: [`${frWhen(s.session.startsAt)}${s.session.title ? ` · ${s.session.title}` : ""}`, ...(s.session.prep ? [`À préparer : ${s.session.prep}`] : [])] });
  const html = blocks
    .map((b) => `<p style="margin:0 0 4px;font-weight:bold;color:#1a2257">${esc(b.title)}</p><ul style="margin:0 0 16px;padding-left:20px">${b.lines.map((l) => `<li style="margin:0 0 4px">${esc(l)}</li>`).join("")}</ul>`)
    .join("");
  const text = blocks.map((b) => `${b.title}\n${b.lines.map((l) => `- ${l}`).join("\n")}`).join("\n\n");
  return { html, text, empty: !blocks.length };
}

/** A member turns the weekly summary on or off for a coaching. */
export async function setWeeklyEmail(v: Viewer, coachingId: string, on: boolean) {
  const { coaching, role } = await openCoaching(v, coachingId);
  if (role !== "member") throw new CoachingError("Only the people coached choose this.");
  const me = new Types.ObjectId(v.id);
  await Coaching.updateOne({ _id: coaching._id }, on ? { $pull: { weeklyOff: me } } : { $addToSet: { weeklyOff: me } });
}

/** Monday from 8:00 (APP_TZ), once a week: every member of every active coaching (unless turned off). `force` skips the day check. */
export async function runCoachingWeekly(now = new Date(), opts: { force?: boolean } = {}) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TZ(), weekday: "short", hour: "2-digit", hourCycle: "h23" }).formatToParts(now).map((p) => [p.type, p.value]));
  if (!opts.force && (parts.weekday !== "Mon" || Number(parts.hour) < 8)) return { ran: false, emails: 0 };
  const key = `coaching-weekly:${dayKey(now)}`;
  try {
    await DigestLog.create({ key, sentAt: now });
  } catch {
    return { ran: false, emails: 0 }; // already sent this week (another instance or restart)
  }
  let emails = 0;
  const coachings = await Coaching.find({ status: "active" }).lean<CoachingDoc[]>();
  for (const c of coachings) {
    const off = new Set((c.weeklyOff ?? []).map(String));
    const members = await User.find({ _id: { $in: c.memberIds ?? [] }, isActive: { $ne: false }, email: { $nin: [null, ""] } }).select("name email").lean();
    const coach = await User.findById(c.coachId).select("name coachName").lean();
    for (const u of members) {
      if (off.has(String(u._id))) continue;
      try {
        const mail = weeklyEmail(await weeklySummary(c, String(u._id), now));
        if (mail.empty) continue;
        await sendCoachingEmail(u.email!, {
          firstName: u.name,
          subject: `Votre semaine de coaching · ${c.title}`,
          intro: `Voici votre point de la semaine dans « ${esc(c.title)} » avec ${esc(coach ? coachLabel(coach) : "votre coach")}.`,
          extra: mail.html,
          extraText: mail.text,
          button: "Ouvrir mon espace coaching",
          url: appUrl(`/mon-coaching/${String(c._id)}`),
          outro: "Vous ne voulez plus ce point hebdomadaire ? Désactivez-le en bas de la page « Overview » de votre coaching.",
        });
        emails++;
      } catch (e) {
        console.error("[coaching weekly]", e);
      }
    }
  }
  await DigestLog.updateOne({ key }, { $set: { emails } });
  return { ran: true, emails };
}
