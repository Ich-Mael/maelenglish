import { Types } from "mongoose";
import { CoachingSession, type CoachingDoc, type CoachingSessionDoc } from "@/models";
import { CoachingError, openCoaching, openSession, type Viewer } from "./service";

/*
 * Before and after a live session (owner decision 2026-11-25):
 *  - before: the coach writes the agenda and what to prepare (shown on the session, the Overview
 *    and in the reminders; « email them » sends it at once);
 *  - after: the coach confirms who was there (the people who joined from the app are ticked by
 *    default), absences are flagged, and the next steps written with the summary become a small
 *    checklist each member ticks off.
 * Framework-free (tests/coaching-sessions.test.ts).
 */

export const MAX_NEXT_STEPS = 8;

const oid = (id: string) => {
  if (!Types.ObjectId.isValid(id)) throw new CoachingError("Not found.");
  return new Types.ObjectId(id);
};
const text = (v: unknown, max: number) =>
  String(v ?? "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);

async function forCoach(v: Viewer, sessionId: string) {
  const s = await CoachingSession.findById(oid(sessionId));
  if (!s) throw new CoachingError("Session not found.");
  const { coaching, role } = await openCoaching(v, String(s.coachingId));
  if (role !== "coach") throw new CoachingError("Only the coach can do this.");
  return { s, coaching };
}

/** The people a session is for: its member (individual check-in) or the whole coaching. */
export const concerned = (s: Pick<CoachingSessionDoc, "forUserId">, c: Pick<CoachingDoc, "memberIds">) => (s.forUserId ? [String(s.forUserId)] : (c.memberIds ?? []).map(String));

/** Who was there (pure): confirmed by the coach, else the people who joined from the app. */
export function attendanceOf(s: Pick<CoachingSessionDoc, "forUserId" | "attendanceConfirmed" | "presentIds" | "joinedIds">, c: Pick<CoachingDoc, "memberIds">) {
  const people = concerned(s, c);
  const here = new Set(((s.attendanceConfirmed ? s.presentIds : s.joinedIds) ?? []).map(String));
  return { confirmed: !!s.attendanceConfirmed, present: people.filter((p) => here.has(p)), absent: people.filter((p) => !here.has(p)) };
}

/** Before: the agenda and what to prepare. Returns whether there is something to tell the members. */
export async function prepareSession(v: Viewer, sessionId: string, raw: { agenda?: unknown; prep?: unknown }) {
  const { s, coaching } = await forCoach(v, sessionId);
  if (s.status === "cancelled") throw new CoachingError("This session was cancelled.");
  s.agenda = text(raw.agenda, 2000);
  s.prep = text(raw.prep, 1000);
  await s.save();
  return { session: s.toObject() as CoachingSessionDoc, coaching, filled: !!(s.agenda || s.prep) };
}

/** After: who was there (ids outside the session's people are ignored). Closes a session still « scheduled ». */
export async function setAttendance(v: Viewer, sessionId: string, presentIds: string[]) {
  const { s, coaching } = await forCoach(v, sessionId);
  if (s.status === "cancelled") throw new CoachingError("This session was cancelled.");
  if (s.startsAt.getTime() > Date.now()) throw new CoachingError("The session hasn't started yet.");
  const people = new Set(concerned(s, coaching));
  s.presentIds = [...new Set(presentIds.map(String))].filter((id) => people.has(id)).map((id) => new Types.ObjectId(id));
  s.attendanceConfirmed = true;
  if (s.status === "scheduled" || s.status === "missed") s.status = s.presentIds.length ? "done" : "missed";
  await s.save();
  return attendanceOf(s, coaching);
}

/** After: the next steps, one per line (≤ 8). A step kept with the same wording keeps who ticked it. */
export async function saveNextSteps(v: Viewer, sessionId: string, raw: unknown) {
  const { s } = await forCoach(v, sessionId);
  const lines = [...new Set(String(raw ?? "").split("\n").map((l) => l.replace(/^\s*[-•*\d.)]+\s*/, "").replace(/\s+/g, " ").trim().slice(0, 300)).filter(Boolean))].slice(0, MAX_NEXT_STEPS);
  const before = s.nextSteps ?? [];
  let n = before.reduce((m, x) => Math.max(m, Number(x.id.slice(1)) || 0), 0);
  s.set(
    "nextSteps",
    lines.map((l) => before.find((x) => x.text === l) ?? { id: `n${++n}`, text: l, doneBy: [] }),
  );
  await s.save();
  return s.nextSteps.map((x) => x.text);
}

/** A member ticks a next step (only theirs: the session must be for them). */
export async function toggleNextStep(v: Viewer, sessionId: string, stepId: string, done: boolean) {
  const { session, role } = await openSession(v, sessionId);
  if (role !== "member") throw new CoachingError("Only the people coached tick their next steps.");
  if (!(session.nextSteps ?? []).some((x) => x.id === stepId)) throw new CoachingError("Step not found.");
  const me = new Types.ObjectId(v.id);
  await CoachingSession.updateOne({ _id: session._id, "nextSteps.id": stepId }, done ? { $addToSet: { "nextSteps.$.doneBy": me } } : { $pull: { "nextSteps.$.doneBy": me } });
}
