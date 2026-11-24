import { Types } from "mongoose";
import { Coaching, CoachingSession, User, type CoachingDoc, type CoachingSessionDoc } from "@/models";
import { coachLabel } from "@/lib/coach-name";
import { appUrl, sendCoachingEmail } from "@/lib/email";

/*
 * Coaching emails. Learners (French): new feedback or message from the coach, new resource, new
 * task, a session scheduled, session reminders (the day before and 1 h before). Coach (English):
 * a member's message or speaking challenge. Never blocks the action (failures are logged).
 */

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const fmt = (d: Date) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short", timeZone: process.env.APP_TZ || "Africa/Ouagadougou" }).format(d);

async function recipients(c: Pick<CoachingDoc, "memberIds">, forUserId: unknown) {
  const ids: Types.ObjectId[] = forUserId ? [new Types.ObjectId(String(forUserId))] : (c.memberIds ?? []);
  return User.find({ _id: { $in: ids }, isActive: { $ne: false }, email: { $nin: [null, ""] } }).select("name email").lean();
}

export type CoachingEvent = "feedback" | "resource" | "task" | "session" | "summary";

/** Members concerned by something the coach added. */
export async function notifyMembers(coachingId: unknown, forUserId: unknown, event: CoachingEvent, detail = "") {
  try {
    const c = await Coaching.findById(coachingId).lean<CoachingDoc>();
    if (!c || c.status === "completed") return;
    const coach = await User.findById(c.coachId).select("name coachName").lean();
    const who = coach ? coachLabel(coach) : "Votre coach";
    const url = appUrl(`/mon-coaching/${String(c._id)}`);
    const text: Record<CoachingEvent, { subject: string; intro: string }> = {
      feedback: { subject: `${who} vous a écrit`, intro: `<strong>${esc(who)}</strong> a laissé un message dans votre espace coaching « ${esc(c.title)} ».` },
      resource: { subject: "Nouvelle ressource dans votre coaching", intro: `${esc(who)} a ajouté une ressource dans « ${esc(c.title)} »${detail ? ` : <strong>${esc(detail)}</strong>` : ""}.` },
      task: { subject: "Nouvelle activité à faire", intro: `${esc(who)} vous a donné une activité dans « ${esc(c.title)} »${detail ? ` : <strong>${esc(detail)}</strong>` : ""}.` },
      session: { subject: "Séance de coaching programmée", intro: `Une séance est prévue ${esc(detail)} avec ${esc(who)} (« ${esc(c.title)} »). Vous la rejoindrez directement depuis votre espace coaching.` },
      summary: { subject: "Le résumé de votre séance", intro: `${esc(who)} a ajouté le résumé de votre séance dans « ${esc(c.title)} ».` },
    };
    for (const u of await recipients(c, forUserId)) {
      await sendCoachingEmail(u.email!, { firstName: u.name, subject: text[event].subject, intro: text[event].intro, button: "Ouvrir mon espace coaching", url });
    }
  } catch (e) {
    console.error("[coaching] notify members", e);
  }
}

/** The coach, when a member writes or sends a speaking challenge. */
export async function notifyCoach(coachingId: unknown, fromUserId: string, what: "message" | "challenge") {
  try {
    const c = await Coaching.findById(coachingId).lean<CoachingDoc>();
    if (!c) return;
    const [coach, from] = await Promise.all([User.findById(c.coachId).select("name email").lean(), User.findById(fromUserId).select("name surname").lean()]);
    if (!coach?.email) return;
    const name = from ? `${from.name} ${from.surname ?? ""}`.trim() : "A learner";
    await sendCoachingEmail(coach.email, {
      firstName: coach.name,
      lang: "en",
      subject: what === "message" ? `${name} wrote in « ${c.title} »` : `${name} sent a speaking challenge`,
      intro: what === "message" ? `<strong>${esc(name)}</strong> left a message in the coaching « ${esc(c.title)} ».` : `<strong>${esc(name)}</strong> sent a speaking challenge in « ${esc(c.title)} »: it's waiting for your feedback.`,
      button: "Open the coaching",
      url: appUrl(`/admin/coaching/${String(c._id)}`),
    });
  } catch (e) {
    console.error("[coaching] notify coach", e);
  }
}

/** Session reminders: the day before (≤ 24 h) and 1 h before; each sent once per session (`remindersSent`). */
export async function runSessionReminders(now = new Date()) {
  const soon = await CoachingSession.find({ status: "scheduled", startsAt: { $gt: now, $lte: new Date(now.getTime() + 24 * 3600_000) } }).lean<CoachingSessionDoc[]>();
  let sent = 0;
  for (const s of soon) {
    const kind = s.startsAt.getTime() - now.getTime() <= 75 * 60_000 ? "hour" : "day";
    if ((s.remindersSent ?? []).includes(kind)) continue;
    // Claim it first: a second instance won't send it twice.
    const claimed = await CoachingSession.updateOne({ _id: s._id, remindersSent: { $ne: kind } }, { $addToSet: { remindersSent: kind } });
    if (!claimed.modifiedCount) continue;
    const c = await Coaching.findById(s.coachingId).lean<CoachingDoc>();
    if (!c || c.status !== "active") continue;
    const coach = await User.findById(c.coachId).select("name coachName email").lean();
    const when = fmt(s.startsAt);
    for (const u of await recipients(c, s.forUserId)) {
      await sendCoachingEmail(u.email!, {
        firstName: u.name,
        subject: kind === "hour" ? "Votre séance commence dans 1 heure" : "Rappel : séance de coaching demain",
        intro: `Votre séance avec ${esc(coach ? coachLabel(coach) : "votre coach")} est prévue ${esc(when)}. Le bouton « Rejoindre » s'active 10 minutes avant.`,
        button: "Ouvrir mon espace coaching",
        url: appUrl(`/mon-coaching/${String(c._id)}`),
        outro: "Pensez à vous installer dans un endroit calme, avec vos écouteurs.",
      });
      sent++;
    }
    if (coach?.email && kind === "hour") {
      await sendCoachingEmail(coach.email, { firstName: coach.name, lang: "en", subject: `Session in 1 hour: ${c.title}`, intro: `Your session « ${esc(c.title)} » starts ${esc(when)}.`, button: "Open the coaching", url: appUrl(`/admin/coaching/${String(c._id)}`) });
      sent++;
    }
  }
  return { sent };
}

export const sessionWhen = (d: Date) => fmt(d);
export const isObjectId = (v: unknown) => Types.ObjectId.isValid(String(v));
