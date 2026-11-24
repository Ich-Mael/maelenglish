import { Types } from "mongoose";
import {
  Activity,
  Coaching,
  CoachingEntry,
  CoachingGoal,
  CoachingResource,
  CoachingSession,
  CoachingSubmission,
  CoachingTask,
  CoachingTaskProgress,
  ConversationSession,
  Course,
  Enrollment,
  Media,
  Step,
  StepProgress,
  User,
  type ActivityDoc,
  type CoachingDoc,
  type CoachingEntryDoc,
  type CoachingGoalDoc,
  type CoachingResourceDoc,
  type CoachingSessionDoc,
  type CoachingSubmissionDoc,
  type CoachingTaskDoc,
  type Role,
} from "@/models";
import { normalizeRich, plainText } from "@/lib/rich-text";
import { STORY_STEP_TYPES } from "@/lib/story/service";

/*
 * MaelEnglish Coaching (owner decisions 2026-11-24): the space between a coach and the person —
 * or the group — they coach. Framework-free (tests/coaching-space.test.ts). Roles inside a
 * coaching: « coach » (its coach, admins, account managers) and « member ». Items with
 * `forUserId` empty are for everyone in the coaching; set, only for that member and the coach.
 * A member never sees another member's private items.
 */

export class CoachingError extends Error {}

export type Viewer = { id: string; role: Role };
export type CoachingRole = "coach" | "member";

const COACH_ROLES: Role[] = ["english-coach", "instructor", "admin", "super-admin"];
const MANAGER_ROLES: Role[] = ["admin", "super-admin", "account-manager"];
export const isManager = (v: Viewer) => MANAGER_ROLES.includes(v.role);
/** Lab practice types a coach can assign (the coach-reviewed writing task and role-plays have their own kinds). */
export const COACHING_LAB_TYPES = STORY_STEP_TYPES;

const oid = (id: string) => {
  if (!Types.ObjectId.isValid(id)) throw new CoachingError("Not found.");
  return new Types.ObjectId(id);
};
/** Text typed in a plain box becomes paragraphs; HTML from the rich editor is sanitised as is. */
export function richOrPlain(raw: unknown): string {
  const t = String(raw ?? "").trim().slice(0, 20000);
  if (!t) return "";
  if (/<[a-z][\s\S]*>/i.test(t)) return normalizeRich(t);
  const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return normalizeRich(t.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join(""));
}
const str = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const dateOrNull = (v: unknown) => {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};

// ── Access ───────────────────────────────────────────────────────────────

/** The viewer's role in a coaching: its coach, an admin / account manager (as coach), or a member. */
export function roleIn(c: Pick<CoachingDoc, "coachId" | "memberIds">, v: Viewer): CoachingRole | null {
  if (String(c.coachId) === v.id || isManager(v)) return "coach";
  if ((c.memberIds ?? []).some((m) => String(m) === v.id)) return "member";
  return null;
}

export async function openCoaching(v: Viewer, coachingId: string) {
  const c = await Coaching.findById(oid(coachingId)).lean<CoachingDoc>();
  if (!c) throw new CoachingError("Coaching not found.");
  const role = roleIn(c, v);
  if (!role) throw new CoachingError("Coaching not found.");
  return { coaching: c, role };
}

/** What a viewer may see: the coach everything, a member the shared items and their own. */
export const visibleTo = (role: CoachingRole, viewerId: string) => (role === "coach" ? {} : { forUserId: { $in: [null, new Types.ObjectId(viewerId)] } });

/** `forUserId` sent by the coach must be a member (or empty = everyone). */
function forUserOf(c: Pick<CoachingDoc, "memberIds">, raw: unknown) {
  const id = String(raw ?? "");
  if (!id) return null;
  if (!(c.memberIds ?? []).some((m) => String(m) === id)) throw new CoachingError("This person isn't in the coaching.");
  return new Types.ObjectId(id);
}

function requireCoach(role: CoachingRole) {
  if (role !== "coach") throw new CoachingError("Only the coach can do this.");
}

// ── Coachings ────────────────────────────────────────────────────────────

export type CoachingInput = { kind?: unknown; memberIds?: unknown; coachId?: unknown; title?: unknown; goal?: unknown; startDate?: unknown; endDate?: unknown; sessionsPlanned?: unknown; meetingUrl?: unknown };

async function checkMembers(ids: string[]) {
  const unique = [...new Set(ids.filter((x) => Types.ObjectId.isValid(x)))];
  if (!unique.length) throw new CoachingError("Add at least one person.");
  const users = await User.find({ _id: { $in: unique } }).select("role isActive").lean();
  if (users.length !== unique.length) throw new CoachingError("Some people weren't found.");
  if (users.some((u) => u.isActive === false)) throw new CoachingError("A deactivated account can't join a coaching.");
  return unique.map((x) => new Types.ObjectId(x));
}

async function checkCoach(id: string) {
  const u = Types.ObjectId.isValid(id) ? await User.findById(id).select("role").lean() : null;
  if (!u || !COACH_ROLES.includes(u.role as Role)) throw new CoachingError("Choose a coach (English coach, instructor or admin).");
  return new Types.ObjectId(id);
}

const meetingUrlOf = (v: unknown) => {
  const u = str(v, 500);
  if (!u) return "";
  if (!/^https:\/\//i.test(u)) throw new CoachingError("The meeting link must start with https://");
  return u;
};

/** Opens a coaching (admins and account managers). */
export async function createCoaching(v: Viewer, raw: CoachingInput) {
  if (!isManager(v)) throw new CoachingError("Only admins and account managers open a coaching.");
  const title = str(raw.title, 120);
  if (!title) throw new CoachingError("Give the coaching a title.");
  const members = await checkMembers(Array.isArray(raw.memberIds) ? raw.memberIds.map(String) : String(raw.memberIds ?? "").split(",").filter(Boolean));
  const kind = raw.kind === "group" || members.length > 1 ? "group" : "individual";
  const c = await Coaching.create({
    kind,
    memberIds: members,
    coachId: await checkCoach(String(raw.coachId ?? "")),
    title,
    goal: normalizeRich(String(raw.goal ?? "")),
    startDate: dateOrNull(raw.startDate) ?? new Date(),
    endDate: dateOrNull(raw.endDate),
    sessionsPlanned: raw.sessionsPlanned ? Math.max(0, Math.round(Number(raw.sessionsPlanned))) || null : null,
    meetingUrl: meetingUrlOf(raw.meetingUrl),
    createdBy: new Types.ObjectId(v.id),
  });
  return String(c._id);
}

/** The coach edits the title, goal, dates, sessions planned and fallback link; managers also the coach and the status. */
export async function updateCoaching(v: Viewer, coachingId: string, raw: CoachingInput & { status?: unknown }) {
  const { coaching, role } = await openCoaching(v, coachingId);
  requireCoach(role);
  const set: Record<string, unknown> = {};
  if (raw.title !== undefined) {
    const t = str(raw.title, 120);
    if (!t) throw new CoachingError("Give the coaching a title.");
    set.title = t;
  }
  if (raw.goal !== undefined) set.goal = normalizeRich(String(raw.goal));
  if (raw.startDate !== undefined) set.startDate = dateOrNull(raw.startDate);
  if (raw.endDate !== undefined) set.endDate = dateOrNull(raw.endDate);
  if (raw.sessionsPlanned !== undefined) set.sessionsPlanned = raw.sessionsPlanned === "" || raw.sessionsPlanned === null ? null : Math.max(0, Math.round(Number(raw.sessionsPlanned))) || 0;
  if (raw.meetingUrl !== undefined) set.meetingUrl = meetingUrlOf(raw.meetingUrl);
  if (raw.status !== undefined && ["active", "paused", "completed"].includes(String(raw.status))) set.status = String(raw.status);
  if (raw.coachId !== undefined && String(raw.coachId) !== String(coaching.coachId)) {
    if (!isManager(v)) throw new CoachingError("Only admins and account managers change the coach.");
    set.coachId = await checkCoach(String(raw.coachId));
  }
  await Coaching.updateOne({ _id: coaching._id }, { $set: set });
}

/** Adds / removes a member (managers and the coach). A coaching keeps at least one member. */
export async function setMembers(v: Viewer, coachingId: string, memberIds: string[]) {
  const { coaching, role } = await openCoaching(v, coachingId);
  requireCoach(role);
  const members = await checkMembers(memberIds);
  await Coaching.updateOne({ _id: coaching._id }, { $set: { memberIds: members, kind: members.length > 1 ? "group" : coaching.kind } });
}

/** The coachings a viewer sees: managers all (filterable), coaches theirs, members theirs. */
export async function listCoachings(v: Viewer, filter: { coachId?: string; status?: string; memberOnly?: boolean } = {}) {
  const q: Record<string, unknown> = {};
  if (filter.memberOnly) q.memberIds = new Types.ObjectId(v.id);
  else if (!isManager(v)) q.coachId = new Types.ObjectId(v.id);
  else if (filter.coachId && Types.ObjectId.isValid(filter.coachId)) q.coachId = new Types.ObjectId(filter.coachId);
  if (filter.status) q.status = filter.status;
  return Coaching.find(q).sort({ status: 1, updatedAt: -1 }).limit(300).lean<CoachingDoc[]>();
}

// ── Goals ────────────────────────────────────────────────────────────────

export async function saveGoal(v: Viewer, coachingId: string, raw: { id?: unknown; title?: unknown; details?: unknown; targetDate?: unknown; forUserId?: unknown; status?: unknown }) {
  const { coaching, role } = await openCoaching(v, coachingId);
  requireCoach(role);
  const title = str(raw.title, 200);
  if (!title) throw new CoachingError("Write the goal.");
  const data = { title, details: String(raw.details ?? "").trim().slice(0, 2000), targetDate: dateOrNull(raw.targetDate), forUserId: forUserOf(coaching, raw.forUserId), ...(["todo", "in_progress", "done"].includes(String(raw.status)) ? { status: String(raw.status) as GoalStatus } : {}) };
  if (raw.id) {
    const r = await CoachingGoal.updateOne({ _id: oid(String(raw.id)), coachingId: coaching._id }, { $set: data });
    if (!r.matchedCount) throw new CoachingError("Goal not found.");
    return String(raw.id);
  }
  const order = await CoachingGoal.countDocuments({ coachingId: coaching._id });
  return String((await CoachingGoal.create({ coachingId: coaching._id, order, ...data }))._id);
}

/** The coach sets a goal's status; a member sets their own progress on a shared goal (or the status of their own goal). */
type GoalStatus = "todo" | "in_progress" | "done";
export async function setGoalStatus(v: Viewer, coachingId: string, goalId: string, raw: string) {
  if (!["todo", "in_progress", "done"].includes(raw)) throw new CoachingError("Invalid status.");
  const status = raw as GoalStatus;
  const { coaching, role } = await openCoaching(v, coachingId);
  const g = await CoachingGoal.findOne({ _id: oid(goalId), coachingId: coaching._id, ...visibleTo(role, v.id) });
  if (!g) throw new CoachingError("Goal not found.");
  if (role === "coach" || (g.forUserId && String(g.forUserId) === v.id)) g.status = status;
  else g.memberStatus.set(v.id, status);
  await g.save();
}

export async function deleteGoal(v: Viewer, coachingId: string, goalId: string) {
  const { coaching, role } = await openCoaching(v, coachingId);
  requireCoach(role);
  await CoachingGoal.deleteOne({ _id: oid(goalId), coachingId: coaching._id });
}

// ── Feedback timeline ────────────────────────────────────────────────────

async function checkAudio(v: Viewer, raw: unknown, kind: "voice-note" | "recording") {
  const id = String(raw ?? "");
  if (!id) return null;
  const m = Types.ObjectId.isValid(id) ? await Media.findOne({ _id: id, ownerId: v.id, kind, status: "ready" }).select("_id").lean() : null;
  if (!m) throw new CoachingError("Voice note not found: record it again.");
  return m._id;
}

/**
 * A message or feedback in a thread: `thread` = "" (the coaching's shared thread) or a member's
 * id (their private thread with the coach). Members post in the shared thread or their own.
 */
export async function postEntry(v: Viewer, coachingId: string, raw: { thread?: unknown; text?: unknown; audioMediaId?: unknown; kind?: unknown }) {
  const { coaching, role } = await openCoaching(v, coachingId);
  const thread = String(raw.thread ?? "");
  let forUserId: Types.ObjectId | null;
  if (role === "member") {
    if (thread && thread !== v.id) throw new CoachingError("You can only write in your own thread.");
    forUserId = thread ? new Types.ObjectId(v.id) : null;
  } else forUserId = forUserOf(coaching, thread);
  const text = richOrPlain(raw.text);
  const audioMediaId = await checkAudio(v, raw.audioMediaId, role === "coach" ? "voice-note" : "recording");
  if (!plainText(text).trim() && !audioMediaId) throw new CoachingError("Write a message or record a voice note.");
  const kind = role === "coach" && (raw.kind === "feedback" || raw.kind === "session_summary") ? raw.kind : "message";
  const e = await CoachingEntry.create({ coachingId: coaching._id, forUserId, authorId: new Types.ObjectId(v.id), kind, text, audioMediaId, readBy: [new Types.ObjectId(v.id)] });
  await Coaching.updateOne({ _id: coaching._id }, { $set: { updatedAt: new Date() } });
  return { entry: e.toObject() as CoachingEntryDoc, coaching, role };
}

export async function listEntries(v: Viewer, coachingId: string, opts: { thread?: string } = {}) {
  const { coaching, role } = await openCoaching(v, coachingId);
  const q: Record<string, unknown> = { coachingId: coaching._id, ...visibleTo(role, v.id) };
  if (opts.thread !== undefined) q.forUserId = opts.thread ? oid(opts.thread) : null;
  return CoachingEntry.find(q).sort({ createdAt: 1 }).limit(500).lean<CoachingEntryDoc[]>();
}

/** Marks what the viewer can see as read. */
export async function markRead(v: Viewer, coachingId: string) {
  const { coaching, role } = await openCoaching(v, coachingId);
  await CoachingEntry.updateMany({ coachingId: coaching._id, ...visibleTo(role, v.id), readBy: { $ne: new Types.ObjectId(v.id) } }, { $addToSet: { readBy: new Types.ObjectId(v.id) } });
}

export async function unreadCount(v: Viewer, coachingId: Types.ObjectId | string, role: CoachingRole) {
  return CoachingEntry.countDocuments({ coachingId, ...visibleTo(role, v.id), readBy: { $ne: new Types.ObjectId(v.id) } });
}

export async function deleteEntry(v: Viewer, coachingId: string, entryId: string) {
  const { coaching } = await openCoaching(v, coachingId);
  const e = await CoachingEntry.findOne({ _id: oid(entryId), coachingId: coaching._id });
  if (!e) throw new CoachingError("Message not found.");
  if (String(e.authorId) !== v.id && !isManager(v)) throw new CoachingError("You can only delete your own messages.");
  await e.deleteOne();
}

// ── Resources ────────────────────────────────────────────────────────────

export async function addResource(v: Viewer, coachingId: string, raw: { title?: unknown; note?: unknown; url?: unknown; mediaId?: unknown; forUserId?: unknown }) {
  const { coaching, role } = await openCoaching(v, coachingId);
  requireCoach(role);
  const title = str(raw.title, 200);
  if (!title) throw new CoachingError("Give the resource a title.");
  const mediaId = String(raw.mediaId ?? "");
  let kind: "file" | "link" | "video" = "link";
  let url = "";
  let media: Types.ObjectId | null = null;
  if (mediaId) {
    const m = Types.ObjectId.isValid(mediaId) ? await Media.findOne({ _id: mediaId, ownerId: v.id, kind: "document", status: "ready" }).select("_id").lean() : null;
    if (!m) throw new CoachingError("File not found: upload it again.");
    kind = "file";
    media = m._id;
  } else {
    url = str(raw.url, 1000);
    if (!/^https?:\/\//i.test(url)) throw new CoachingError("Add a file or a link starting with https://");
    kind = /youtube\.com|youtu\.be|vimeo\.com|\.mp4($|\?)/i.test(url) ? "video" : "link";
  }
  const r = await CoachingResource.create({ coachingId: coaching._id, forUserId: forUserOf(coaching, raw.forUserId), kind, title, note: String(raw.note ?? "").trim().slice(0, 1000), url, mediaId: media, addedBy: new Types.ObjectId(v.id) });
  return { resource: r.toObject() as CoachingResourceDoc, coaching };
}

export async function deleteResource(v: Viewer, coachingId: string, resourceId: string) {
  const { coaching, role } = await openCoaching(v, coachingId);
  requireCoach(role);
  await CoachingResource.deleteOne({ _id: oid(resourceId), coachingId: coaching._id });
}

/** Who may open a coaching file: the coaching's members concerned and its coach (managers too). */
export async function fileAccess(v: Viewer, coachingId: string, mediaId: string) {
  const { coaching, role } = await openCoaching(v, coachingId);
  const r = await CoachingResource.findOne({ coachingId: coaching._id, mediaId: oid(mediaId), ...visibleTo(role, v.id) }).lean();
  return !!r;
}

// ── Tasks (existing content) ─────────────────────────────────────────────

export const TASK_KINDS = ["course", "lab", "challenge", "roleplay"] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export async function addTask(v: Viewer, coachingId: string, raw: { kind?: unknown; courseId?: unknown; activityId?: unknown; note?: unknown; dueDate?: unknown; forUserId?: unknown }) {
  const { coaching, role } = await openCoaching(v, coachingId);
  requireCoach(role);
  const kind = String(raw.kind ?? "") as TaskKind;
  if (!TASK_KINDS.includes(kind)) throw new CoachingError("Choose what to assign.");
  const forUserId = forUserOf(coaching, raw.forUserId);
  let courseId: Types.ObjectId | null = null;
  let activityId: Types.ObjectId | null = null;
  if (kind === "course") {
    const course = Types.ObjectId.isValid(String(raw.courseId)) ? await Course.findById(String(raw.courseId)).select("_id isPublished").lean() : null;
    if (!course) throw new CoachingError("Course not found.");
    courseId = course._id;
    // The members concerned get the course (enrolment for the coaching's dates, or reactivated).
    const members = forUserId ? [forUserId] : coaching.memberIds;
    for (const m of members) {
      await Enrollment.updateOne(
        { userId: m, courseId },
        { $set: { status: "active", endDate: coaching.endDate ?? null }, $setOnInsert: { startDate: coaching.startDate ?? new Date(), enrolledBy: new Types.ObjectId(v.id) } },
        { upsert: true },
      );
    }
  } else {
    const a = Types.ObjectId.isValid(String(raw.activityId)) ? await Activity.findById(String(raw.activityId)).select("type status").lean<ActivityDoc>() : null;
    if (!a) throw new CoachingError("Activity not found.");
    const ok = kind === "lab" ? (COACHING_LAB_TYPES as readonly string[]).includes(a.type) : kind === "challenge" ? a.type === "speaking_challenge" : a.type === "role_play";
    if (!ok) throw new CoachingError("This activity doesn't match the kind of task.");
    if (a.status !== "ready") throw new CoachingError("This activity is still a draft in the Lab: mark it ready first.");
    activityId = a._id;
  }
  const order = await CoachingTask.countDocuments({ coachingId: coaching._id });
  const t = await CoachingTask.create({ coachingId: coaching._id, forUserId, kind, courseId, activityId, note: String(raw.note ?? "").trim().slice(0, 1000), dueDate: dateOrNull(raw.dueDate), order });
  return { task: t.toObject() as CoachingTaskDoc, coaching };
}

export async function deleteTask(v: Viewer, coachingId: string, taskId: string) {
  const { coaching, role } = await openCoaching(v, coachingId);
  requireCoach(role);
  await CoachingTask.deleteOne({ _id: oid(taskId), coachingId: coaching._id });
}

/** A task the viewer can open (member: shared or theirs). */
export async function openTask(v: Viewer, taskId: string) {
  const t = await CoachingTask.findById(oid(taskId)).lean<CoachingTaskDoc>();
  if (!t) throw new CoachingError("Task not found.");
  const { coaching, role } = await openCoaching(v, String(t.coachingId));
  if (role === "member" && t.forUserId && String(t.forUserId) !== v.id) throw new CoachingError("Task not found.");
  const activity = t.activityId ? await Activity.findById(t.activityId).lean<ActivityDoc>() : null;
  return { task: t, coaching, role, activity };
}

export type TaskState = { done: boolean; label: string; score: number | null };

/** Each member's state on each task (member × task grid), from existing progress records. */
export async function taskStates(tasks: CoachingTaskDoc[], memberIds: string[]): Promise<Record<string, Record<string, TaskState>>> {
  const out: Record<string, Record<string, TaskState>> = {};
  const users = memberIds.map((m) => new Types.ObjectId(m));
  const ids = tasks.map((t) => t._id);
  const courseIds = tasks.flatMap((t) => (t.kind === "course" && t.courseId ? [t.courseId] : []));
  const [labDone, subs, steps, stepDone, calls] = await Promise.all([
    CoachingTaskProgress.find({ taskId: { $in: ids }, userId: { $in: users } }).lean(),
    CoachingSubmission.find({ taskId: { $in: ids }, userId: { $in: users } }).select("taskId userId status grade").lean(),
    courseIds.length ? Step.find({ courseId: { $in: courseIds }, kind: { $in: ["lesson", "activity", "challenge"] } }).select("courseId").lean() : [],
    courseIds.length ? StepProgress.find({ courseId: { $in: courseIds }, userId: { $in: users } }).select("courseId userId").lean() : [],
    ConversationSession.find({ activityId: { $in: tasks.flatMap((t) => (t.kind === "roleplay" && t.activityId ? [t.activityId] : [])) }, userId: { $in: users }, status: "debriefed" }).select("activityId userId score createdAt").lean(),
  ]);
  for (const t of tasks) {
    const per: Record<string, TaskState> = {};
    const concerned = t.forUserId ? [String(t.forUserId)] : memberIds;
    for (const m of concerned) {
      if (t.kind === "lab") {
        const p = labDone.find((x) => String(x.taskId) === String(t._id) && String(x.userId) === m);
        per[m] = p ? { done: true, label: p.score != null ? `${p.score}%` : "Done", score: p.score ?? null } : { done: false, label: "To do", score: null };
      } else if (t.kind === "challenge") {
        const s = subs.find((x) => String(x.taskId) === String(t._id) && String(x.userId) === m);
        per[m] = !s ? { done: false, label: "To do", score: null } : s.status === "validated" ? { done: true, label: s.grade != null ? `Validated · ${s.grade}/10` : "Validated", score: s.grade ?? null } : s.status === "returned" ? { done: false, label: "To redo", score: null } : { done: true, label: "Sent · waiting for feedback", score: null };
      } else if (t.kind === "roleplay") {
        const mine = calls.filter((x) => String(x.activityId) === String(t.activityId) && String(x.userId) === m && x.createdAt >= t.createdAt);
        const best = mine.reduce<number | null>((b, x) => (x.score != null && (b == null || x.score > b) ? x.score : b), null);
        per[m] = mine.length ? { done: true, label: best != null ? `Best score ${best}` : "Done", score: best } : { done: false, label: "To do", score: null };
      } else {
        const total = steps.filter((s) => String(s.courseId) === String(t.courseId)).length;
        const done = stepDone.filter((s) => String(s.courseId) === String(t.courseId) && String(s.userId) === m).length;
        per[m] = { done: total > 0 && done >= total, label: total ? `${Math.min(done, total)} / ${total} activities` : "Enrolled", score: total ? Math.round((Math.min(done, total) / total) * 100) : null };
      }
    }
    out[String(t._id)] = per;
  }
  return out;
}

/** A Lab task done in the coaching: best score kept (the regular player sends it, see learn-actions). */
export async function saveLabProgress(userId: string, taskId: string, score: number) {
  const prev = await CoachingTaskProgress.findOne({ taskId, userId }).lean();
  await CoachingTaskProgress.updateOne({ taskId, userId }, { $set: { score: Math.max(score, prev?.score ?? 0) }, $inc: { attempts: 1 }, $setOnInsert: { completedAt: new Date() } }, { upsert: true });
  return { first: !prev, best: Math.max(score, prev?.score ?? 0) };
}

// ── Speaking challenges in a coaching ────────────────────────────────────

export async function submitChallenge(v: Viewer, taskId: string, mediaId: string) {
  const { task, coaching, role } = await openTask(v, taskId);
  if (role !== "member") throw new CoachingError("Only the people coached send a challenge.");
  if (task.kind !== "challenge") throw new CoachingError("This task isn't a speaking challenge.");
  const m = Types.ObjectId.isValid(mediaId) ? await Media.findOne({ _id: mediaId, ownerId: v.id, kind: "recording", status: "ready" }).lean() : null;
  if (!m) throw new CoachingError("Recording not found: record it again.");
  const prev = await CoachingSubmission.findOne({ taskId: task._id, userId: v.id });
  if (prev?.status === "pending") {
    prev.mediaId = m._id;
    prev.durationS = m.durationS ?? 0;
    prev.submittedAt = new Date();
    await prev.save();
    return { submission: prev.toObject() as CoachingSubmissionDoc, coaching };
  }
  const history = prev ? [...(prev.history ?? []), { mediaId: prev.mediaId, submittedAt: prev.submittedAt, status: prev.status, comment: prev.comment, grade: prev.grade, feedbackAudioMediaId: prev.feedbackAudioMediaId }] : [];
  const s = await CoachingSubmission.findOneAndUpdate(
    { taskId: task._id, userId: v.id },
    { $set: { coachingId: coaching._id, mediaId: m._id, durationS: m.durationS ?? 0, status: "pending", comment: "", grade: null, feedbackAudioMediaId: null, submittedAt: new Date(), reviewedAt: null, history } },
    { upsert: true, returnDocument: "after" },
  ).lean<CoachingSubmissionDoc>();
  return { submission: s!, coaching };
}

export async function reviewChallenge(v: Viewer, submissionId: string, raw: { decision?: unknown; comment?: unknown; grade?: unknown; audioMediaId?: unknown }) {
  const s = await CoachingSubmission.findById(oid(submissionId));
  if (!s) throw new CoachingError("Submission not found.");
  const { coaching, role } = await openCoaching(v, String(s.coachingId));
  requireCoach(role);
  const decision = raw.decision === "returned" ? "returned" : "validated";
  const comment = richOrPlain(raw.comment);
  const audio = await checkAudio(v, raw.audioMediaId, "voice-note");
  if (decision === "returned" && !plainText(comment).trim() && !audio) throw new CoachingError("Explain what to redo (comment or voice note).");
  const g = raw.grade === "" || raw.grade == null ? null : Math.max(0, Math.min(10, Math.round(Number(raw.grade))));
  s.status = decision;
  s.comment = comment;
  s.grade = Number.isFinite(g as number) ? g : null;
  s.feedbackAudioMediaId = audio;
  s.reviewedAt = new Date();
  await s.save();
  return { submission: s.toObject() as CoachingSubmissionDoc, coaching };
}

// ── Sessions (live) ──────────────────────────────────────────────────────

export async function scheduleSession(v: Viewer, coachingId: string, raw: { startsAt?: unknown; durationMin?: unknown; title?: unknown; forUserId?: unknown }) {
  const { coaching, role } = await openCoaching(v, coachingId);
  requireCoach(role);
  const startsAt = dateOrNull(raw.startsAt);
  if (!startsAt) throw new CoachingError("Choose the date and time.");
  if (startsAt.getTime() < Date.now() - 60 * 60_000) throw new CoachingError("This date is in the past.");
  const durationMin = Math.min(240, Math.max(15, Math.round(Number(raw.durationMin) || 60)));
  const s = await CoachingSession.create({ coachingId: coaching._id, forUserId: forUserOf(coaching, raw.forUserId), title: str(raw.title, 120), startsAt, durationMin });
  return { session: s.toObject() as CoachingSessionDoc, coaching };
}

export async function updateSession(v: Viewer, sessionId: string, raw: { status?: unknown; summary?: unknown; startsAt?: unknown; durationMin?: unknown }) {
  const s = await CoachingSession.findById(oid(sessionId));
  if (!s) throw new CoachingError("Session not found.");
  const { coaching, role } = await openCoaching(v, String(s.coachingId));
  requireCoach(role);
  if (raw.status !== undefined && ["scheduled", "done", "cancelled", "missed"].includes(String(raw.status))) s.status = String(raw.status) as "scheduled" | "done" | "cancelled" | "missed";
  if (raw.startsAt !== undefined) {
    const d = dateOrNull(raw.startsAt);
    if (!d) throw new CoachingError("Choose the date and time.");
    s.startsAt = d;
    s.remindersSent = [];
  }
  if (raw.durationMin !== undefined) s.durationMin = Math.min(240, Math.max(15, Math.round(Number(raw.durationMin) || 60)));
  let summaryPosted = false;
  if (raw.summary !== undefined) {
    const summary = richOrPlain(raw.summary);
    if (plainText(summary).trim() && summary !== s.summary) {
      s.summary = summary;
      await CoachingEntry.create({ coachingId: coaching._id, forUserId: s.forUserId ?? null, authorId: new Types.ObjectId(v.id), kind: "session_summary", text: summary, readBy: [new Types.ObjectId(v.id)] });
      summaryPosted = true;
    }
    if (s.status === "scheduled") s.status = "done";
  }
  await s.save();
  return { session: s.toObject() as CoachingSessionDoc, coaching, summaryPosted };
}

/** Sessions the viewer sees (a member: the coaching's sessions and their individual check-ins). */
export async function listSessions(v: Viewer, coachingId: string) {
  const { coaching, role } = await openCoaching(v, coachingId);
  return CoachingSession.find({ coachingId: coaching._id, ...visibleTo(role, v.id) }).sort({ startsAt: 1 }).lean<CoachingSessionDoc[]>();
}

/** The call opens 10 minutes before and stays open until 30 minutes after the planned end. */
export const sessionWindow = (s: Pick<CoachingSessionDoc, "startsAt" | "durationMin">) => ({ opens: new Date(s.startsAt.getTime() - 10 * 60_000), closes: new Date(s.startsAt.getTime() + ((s.durationMin ?? 60) + 30) * 60_000) });

export async function openSession(v: Viewer, sessionId: string) {
  const s = await CoachingSession.findById(oid(sessionId)).lean<CoachingSessionDoc>();
  if (!s) throw new CoachingError("Session not found.");
  const { coaching, role } = await openCoaching(v, String(s.coachingId));
  if (role === "member" && s.forUserId && String(s.forUserId) !== v.id) throw new CoachingError("Session not found.");
  return { session: s, coaching, role };
}

// ── Overview helpers ─────────────────────────────────────────────────────

/** Names and avatars of the people in a coaching (members see first names only). */
export async function people(c: Pick<CoachingDoc, "memberIds" | "coachId">) {
  const users = await User.find({ _id: { $in: [...(c.memberIds ?? []), c.coachId] } }).select("name surname username coachName avatarUrl email role").lean();
  return users;
}

export const goalsOf = (v: Viewer, coachingId: Types.ObjectId, role: CoachingRole) => CoachingGoal.find({ coachingId, ...visibleTo(role, v.id) }).sort({ order: 1 }).lean<CoachingGoalDoc[]>();
export const resourcesOf = (v: Viewer, coachingId: Types.ObjectId, role: CoachingRole) => CoachingResource.find({ coachingId, ...visibleTo(role, v.id) }).sort({ createdAt: -1 }).lean<CoachingResourceDoc[]>();
export const tasksOf = (v: Viewer, coachingId: Types.ObjectId, role: CoachingRole) => CoachingTask.find({ coachingId, ...visibleTo(role, v.id) }).sort({ order: 1 }).lean<CoachingTaskDoc[]>();
export const submissionsOf = (coachingId: Types.ObjectId, userId?: string) => CoachingSubmission.find({ coachingId, ...(userId ? { userId } : {}) }).sort({ submittedAt: -1 }).lean<CoachingSubmissionDoc[]>();

// ── Joining a live session ───────────────────────────────────────────────

export type JoinInfo =
  | { mode: "embed"; url: string; token: string }
  | { mode: "link"; url: string }
  | { mode: "none"; reason: "not_open" | "closed" | "cancelled" | "no_video"; opensAt?: string };

/**
 * What the viewer needs to join a session: an embedded call (Daily room + their token; the coach
 * as owner), else the coaching's meeting link, else why it can't be joined yet.
 */
export async function joinSession(v: Viewer, sessionId: string, now = new Date()): Promise<JoinInfo> {
  const { session, coaching, role } = await openSession(v, sessionId);
  if (session.status === "cancelled") return { mode: "none", reason: "cancelled" };
  const w = sessionWindow(session);
  if (now < w.opens) return { mode: "none", reason: "not_open", opensAt: w.opens.toISOString() };
  if (now > w.closes) return { mode: "none", reason: "closed" };
  const { videoProvider } = await import("@/lib/video/daily");
  const video = videoProvider();
  if (!video) return coaching.meetingUrl ? { mode: "link", url: coaching.meetingUrl } : { mode: "none", reason: "no_video" };
  const name = session.roomName || `me-${String(session._id)}`;
  const participants = (session.forUserId ? 1 : (coaching.memberIds ?? []).length) + 1;
  const room = await video.room(name, { expiresAt: w.closes, maxParticipants: participants + 2 });
  if (!session.roomName) await CoachingSession.updateOne({ _id: session._id }, { $set: { roomName: room.name, roomUrl: room.url } });
  const me = await User.findById(v.id).select("name surname coachName").lean();
  const userName = role === "coach" ? me?.coachName || `${me?.name ?? ""} ${me?.surname ?? ""}`.trim() : (me?.name ?? "");
  const token = await video.token(room.name, { userId: v.id, userName: userName || "Participant", owner: role === "coach", expiresAt: w.closes });
  return { mode: "embed", url: room.url, token };
}
