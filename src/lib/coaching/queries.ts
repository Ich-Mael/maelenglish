import "server-only";
import { Types } from "mongoose";
import { Activity, Course, CoachingEntry, CoachingSession, Media, User, type ActivityDoc, type CoachingDoc } from "@/models";
import { coachLabel } from "@/lib/coach-name";
import { mediaUrlFor } from "@/lib/media";
import { goalsOf, openCoaching, resourcesOf, submissionsOf, taskStates, tasksOf, unreadCount, visibleTo, type CoachingRole, type TaskState, type Viewer } from "./service";

/*
 * Everything a coaching page shows, already filtered for the viewer (a member: the shared items
 * and their own; the coach: everything, optionally narrowed to one member). Media URLs are signed
 * only for items the viewer is allowed to see (checked here through the coaching).
 */

export type Person = { id: string; firstName: string; fullName: string; avatarUrl: string | null; email: string };

const fmtDay = (d: Date | null | undefined) => (d ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: process.env.APP_TZ || "Africa/Ouagadougou" }).format(d) : "");
const fmtWhen = (d: Date) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: process.env.APP_TZ || "Africa/Ouagadougou" }).format(d);
export const coachingDates = { day: fmtDay, when: fmtWhen };

/** A signed URL for a media the viewer may see through the coaching. */
async function signed(viewerId: string, id: unknown): Promise<string | null> {
  if (!id) return null;
  return mediaUrlFor({ id: viewerId, isAdmin: false }, String(id), { sharedWith: [viewerId] }).catch(() => null);
}

export async function loadSpace(v: Viewer, coachingId: string, opts: { member?: string } = {}) {
  const { coaching, role } = await openCoaching(v, coachingId);
  const users = await User.find({ _id: { $in: [...(coaching.memberIds ?? []), coaching.coachId] } }).select("name surname coachName avatarUrl email").lean();
  const person = (u: (typeof users)[number]): Person => ({ id: String(u._id), firstName: u.name, fullName: `${u.name} ${u.surname ?? ""}`.trim(), avatarUrl: u.avatarUrl ?? null, email: role === "coach" ? (u.email ?? "") : "" });
  const coachUser = users.find((u) => String(u._id) === String(coaching.coachId));
  const coach = coachUser ? { ...person(coachUser), label: coachLabel(coachUser) } : null;
  const members = (coaching.memberIds ?? []).map((m) => users.find((u) => String(u._id) === String(m))).filter((u): u is (typeof users)[number] => !!u).map(person);
  const member = role === "coach" && opts.member && members.some((m) => m.id === opts.member) ? opts.member : "";
  // The coach narrowed to one member sees what that member sees.
  const narrow = <T extends { forUserId?: unknown }>(items: T[]) => (member ? items.filter((i) => !i.forUserId || String(i.forUserId) === member) : items);

  const [goals, resources, tasks, sessions, unread] = await Promise.all([
    goalsOf(v, coaching._id, role),
    resourcesOf(v, coaching._id, role),
    tasksOf(v, coaching._id, role),
    CoachingSession.find({ coachingId: coaching._id, ...visibleTo(role, v.id) }).sort({ startsAt: 1 }).lean(),
    unreadCount(v, coaching._id, role),
  ]);
  const activities = await Activity.find({ _id: { $in: tasks.flatMap((t) => (t.activityId ? [t.activityId] : [])) } }).select("title type level content status").lean<ActivityDoc[]>();
  const courses = await Course.find({ _id: { $in: tasks.flatMap((t) => (t.courseId ? [t.courseId] : [])) } }).select("title").lean();
  const memberIds = role === "member" ? [v.id] : members.map((m) => m.id);
  const states = await taskStates(tasks, memberIds);
  const files = await Promise.all(resources.map((r) => (r.mediaId ? signed(v.id, r.mediaId) : null)));
  const fileMeta = await Media.find({ _id: { $in: resources.flatMap((r) => (r.mediaId ? [r.mediaId] : [])) } }).select("mime size").lean();

  return {
    coaching,
    role,
    coach,
    members,
    member,
    unread,
    goals: narrow(goals).map((g) => ({
      id: String(g._id),
      title: g.title,
      details: g.details ?? "",
      forUserId: g.forUserId ? String(g.forUserId) : "",
      status: (role === "member" && !g.forUserId ? ((g.memberStatus as unknown as Record<string, string>)?.[v.id] ?? "todo") : g.status) as "todo" | "in_progress" | "done",
      memberStatus: Object.fromEntries(Object.entries((g.memberStatus as unknown as Record<string, string>) ?? {})) as Record<string, string>,
      targetDate: fmtDay(g.targetDate),
    })),
    resources: narrow(resources).map((r, i) => ({
      id: String(r._id),
      kind: r.kind,
      title: r.title,
      note: r.note ?? "",
      url: r.mediaId ? files[i] : r.url,
      mime: fileMeta.find((m) => String(m._id) === String(r.mediaId))?.mime ?? "",
      forUserId: r.forUserId ? String(r.forUserId) : "",
      added: fmtDay(r.createdAt),
    })),
    tasks: narrow(tasks).map((t) => {
      const a = activities.find((x) => String(x._id) === String(t.activityId));
      return {
        id: String(t._id),
        kind: t.kind,
        title: t.kind === "course" ? (courses.find((c) => String(c._id) === String(t.courseId))?.title ?? "Course") : (a?.title ?? "Activity"),
        type: a?.type ?? "",
        level: a?.level ?? "",
        courseId: t.courseId ? String(t.courseId) : "",
        note: t.note ?? "",
        due: fmtDay(t.dueDate),
        late: !!t.dueDate && t.dueDate.getTime() < Date.now(),
        forUserId: t.forUserId ? String(t.forUserId) : "",
        states: (states[String(t._id)] ?? {}) as Record<string, TaskState>,
      };
    }),
    sessions: narrow(sessions).map((s) => ({
      id: String(s._id),
      title: s.title ?? "",
      startsAt: s.startsAt.toISOString(),
      when: fmtWhen(s.startsAt),
      durationMin: s.durationMin ?? 60,
      status: s.status,
      summary: s.summary ?? "",
      forUserId: s.forUserId ? String(s.forUserId) : "",
      opensAt: new Date(s.startsAt.getTime() - 10 * 60_000).toISOString(),
      closesAt: new Date(s.startsAt.getTime() + ((s.durationMin ?? 60) + 30) * 60_000).toISOString(),
      /** Still to come (scheduled and not past its closing time). */
      upcoming: s.status === "scheduled" && s.startsAt.getTime() + ((s.durationMin ?? 60) + 30) * 60_000 > Date.now(),
    })),
  };
}
export type Space = Awaited<ReturnType<typeof loadSpace>>;

/** A feedback thread with authors and voice notes. `thread` "" = the shared thread. */
export async function loadThread(v: Viewer, coaching: Pick<CoachingDoc, "_id">, role: CoachingRole, thread: string) {
  const q: Record<string, unknown> = { coachingId: coaching._id, ...visibleTo(role, v.id) };
  q.forUserId = thread && Types.ObjectId.isValid(thread) ? new Types.ObjectId(thread) : null;
  if (role === "member" && thread && thread !== v.id) q.forUserId = new Types.ObjectId(v.id);
  const entries = await CoachingEntry.find(q).sort({ createdAt: 1 }).limit(300).lean();
  const audio = await Promise.all(entries.map((e) => signed(v.id, e.audioMediaId)));
  const durations = await Media.find({ _id: { $in: entries.flatMap((e) => (e.audioMediaId ? [e.audioMediaId] : [])) } }).select("durationS").lean();
  return entries.map((e, i) => ({
    id: String(e._id),
    authorId: String(e.authorId),
    kind: e.kind,
    text: e.text ?? "",
    audioUrl: audio[i],
    audioS: durations.find((d) => String(d._id) === String(e.audioMediaId))?.durationS ?? 0,
    when: fmtWhen(e.createdAt),
    unread: !(e.readBy ?? []).some((r) => String(r) === v.id),
  }));
}

/** Speaking challenge submissions in a coaching (a member: their own), with recordings and voice notes. */
export async function loadSubmissions(v: Viewer, coaching: Pick<CoachingDoc, "_id">, role: CoachingRole, taskId?: string) {
  const subs = (await submissionsOf(coaching._id, role === "member" ? v.id : undefined)).filter((s) => !taskId || String(s.taskId) === taskId);
  return Promise.all(
    subs.map(async (s) => ({
      id: String(s._id),
      taskId: String(s.taskId),
      userId: String(s.userId),
      status: s.status,
      grade: s.grade ?? null,
      comment: s.comment ?? "",
      recordingUrl: await signed(v.id, s.mediaId),
      voiceUrl: await signed(v.id, s.feedbackAudioMediaId),
      durationS: s.durationS ?? 0,
      submitted: fmtWhen(s.submittedAt),
      reviewed: s.reviewedAt ? fmtWhen(s.reviewedAt) : "",
      sends: (s.history ?? []).length + 1,
    })),
  );
}

/** Lists for the coach's « Assign » form. */
export async function assignOptions() {
  const [courses, acts] = await Promise.all([
    Course.find({}).select("title isPublished").sort({ title: 1 }).lean(),
    Activity.find({ status: "ready", type: { $in: ["speaking_challenge", "role_play", "listen_choose", "fill_gaps", "listen_fill_gaps", "sentence_builder", "match_pairs", "listen_match", "true_false_ng", "complete_words", "repeat_after", "dictation"] } })
      .select("title type level tags")
      .sort({ title: 1 })
      .lean(),
  ]);
  return {
    courses: courses.map((c) => ({ value: String(c._id), label: `${c.title}${c.isPublished ? "" : " (not published)"}` })),
    lab: acts.filter((a) => a.type !== "speaking_challenge" && a.type !== "role_play").map((a) => ({ value: String(a._id), label: `${a.title}${a.level ? ` · ${a.level}` : ""}` })),
    challenge: acts.filter((a) => a.type === "speaking_challenge").map((a) => ({ value: String(a._id), label: a.title })),
    roleplay: acts.filter((a) => a.type === "role_play" && !(a.tags ?? []).includes("story")).map((a) => ({ value: String(a._id), label: `${a.title}${a.level ? ` · ${a.level}` : ""}` })),
  };
}
