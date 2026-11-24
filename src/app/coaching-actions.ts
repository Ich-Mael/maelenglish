"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { readCurrentUser } from "@/lib/auth/dal";
import { searchLearners, type LearnerMatch } from "@/lib/admin/users";
import * as svc from "@/lib/coaching/service";
import { notifyCoach, notifyMembers, sessionWhen } from "@/lib/coaching/notify";
import { adminCoachingPath } from "@/lib/coaching/paths";

/*
 * Coaching actions, for coaches and the people coached alike: every rule (who is coach, who is a
 * member, what each may see or change) is checked by the service (src/lib/coaching/service.ts).
 */

type State = { error?: string; success?: string; data?: Record<string, string> } | undefined;
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function viewer(): Promise<svc.Viewer> {
  const me = await readCurrentUser();
  if (!me) throw new svc.CoachingError("Your session has expired: sign in again.");
  return { id: me.id, role: me.role };
}
function message(e: unknown) {
  if (e instanceof svc.CoachingError) return e.message;
  console.error("[coaching]", e);
  return "Something went wrong: try again in a moment.";
}
async function form(fn: (v: svc.Viewer) => Promise<string | void>): Promise<State> {
  try {
    const v = await viewer();
    const success = (await fn(v)) || "Saved.";
    refresh();
    return { success };
  } catch (e) {
    return { error: message(e) };
  }
}
async function call<T extends object = object>(fn: (v: svc.Viewer) => Promise<T | void>): Promise<({ ok: true } & T) | { ok: false; error: string }> {
  try {
    const r = (await fn(await viewer())) ?? ({} as T);
    refresh();
    return { ok: true, ...(r as T) };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

// ── Opening and settings ─────────────────────────────────────────────────

export async function searchPeopleAction(q: string): Promise<LearnerMatch[]> {
  const v = await viewer();
  if (!svc.isManager(v)) return [];
  return searchLearners(String(q).slice(0, 80), "");
}

export async function createCoachingAction(_: State, f: FormData): Promise<State> {
  let id = "";
  try {
    const v = await viewer();
    id = await svc.createCoaching(v, {
      kind: str(f, "kind"),
      memberIds: f.getAll("memberIds").map(String),
      coachId: str(f, "coachId"),
      title: str(f, "title"),
      goal: str(f, "goal"),
      startDate: str(f, "startDate"),
      endDate: str(f, "endDate"),
      sessionsPlanned: str(f, "sessionsPlanned"),
      meetingUrl: str(f, "meetingUrl"),
    });
  } catch (e) {
    return { error: message(e) };
  }
  redirect(adminCoachingPath(id));
}

export async function updateCoachingAction(_: State, f: FormData): Promise<State> {
  return form(async (v) => {
    await svc.updateCoaching(v, str(f, "coachingId"), {
      title: str(f, "title"),
      goal: str(f, "goal"),
      startDate: str(f, "startDate"),
      endDate: str(f, "endDate"),
      sessionsPlanned: str(f, "sessionsPlanned"),
      meetingUrl: str(f, "meetingUrl"),
      status: str(f, "status") || undefined,
      coachId: f.has("coachId") ? str(f, "coachId") : undefined,
    });
  });
}

export async function setMembersAction(coachingId: string, memberIds: string[]) {
  return call((v) => svc.setMembers(v, coachingId, memberIds.map(String)));
}

// ── Goals ────────────────────────────────────────────────────────────────

export async function saveGoalAction(_: State, f: FormData): Promise<State> {
  return form(async (v) => {
    await svc.saveGoal(v, str(f, "coachingId"), { id: str(f, "id") || undefined, title: str(f, "title"), details: str(f, "details"), targetDate: str(f, "targetDate"), forUserId: str(f, "forUserId") });
    return "Goal saved.";
  });
}
export async function setGoalStatusAction(coachingId: string, goalId: string, status: string) {
  return call((v) => svc.setGoalStatus(v, coachingId, goalId, status));
}
export async function deleteGoalAction(coachingId: string, goalId: string) {
  return call((v) => svc.deleteGoal(v, coachingId, goalId));
}

// ── Feedback ─────────────────────────────────────────────────────────────

export async function postEntryAction(_: State, f: FormData): Promise<State> {
  return form(async (v) => {
    const r = await svc.postEntry(v, str(f, "coachingId"), { thread: str(f, "thread"), text: str(f, "text"), audioMediaId: str(f, "audioMediaId"), kind: str(f, "kind") });
    const { entry, role } = r;
    after(() => (role === "coach" ? notifyMembers(entry.coachingId, entry.forUserId, "feedback") : notifyCoach(entry.coachingId, v.id, "message")));
    return "Sent.";
  });
}
export async function deleteEntryAction(coachingId: string, entryId: string) {
  return call((v) => svc.deleteEntry(v, coachingId, entryId));
}
export async function markReadAction(coachingId: string) {
  try {
    await svc.markRead(await viewer(), coachingId);
  } catch {
    /* best effort */
  }
}

// ── Resources ────────────────────────────────────────────────────────────

export async function addResourceAction(_: State, f: FormData): Promise<State> {
  return form(async (v) => {
    const { resource } = await svc.addResource(v, str(f, "coachingId"), { title: str(f, "title"), note: str(f, "note"), url: str(f, "url"), mediaId: str(f, "mediaId"), forUserId: str(f, "forUserId") });
    after(() => notifyMembers(resource.coachingId, resource.forUserId, "resource", resource.title));
    return "Resource added.";
  });
}
export async function deleteResourceAction(coachingId: string, resourceId: string) {
  return call((v) => svc.deleteResource(v, coachingId, resourceId));
}

// ── Tasks ────────────────────────────────────────────────────────────────

export async function addTaskAction(_: State, f: FormData): Promise<State> {
  return form(async (v) => {
    const kind = str(f, "kind");
    const { task } = await svc.addTask(v, str(f, "coachingId"), { kind, courseId: str(f, "courseId"), activityId: str(f, `activityId_${kind}`) || str(f, "activityId"), note: str(f, "note"), dueDate: str(f, "dueDate"), forUserId: str(f, "forUserId") });
    after(() => notifyMembers(task.coachingId, task.forUserId, "task"));
    return "Task assigned.";
  });
}
export async function deleteTaskAction(coachingId: string, taskId: string) {
  return call((v) => svc.deleteTask(v, coachingId, taskId));
}

export async function submitCoachingChallengeAction(taskId: string, mediaId: string) {
  return call(async (v) => {
    const { submission } = await svc.submitChallenge(v, taskId, mediaId);
    after(() => notifyCoach(submission.coachingId, v.id, "challenge"));
  });
}

export async function reviewCoachingChallengeAction(_: State, f: FormData): Promise<State> {
  return form(async (v) => {
    const { submission } = await svc.reviewChallenge(v, str(f, "submissionId"), { decision: str(f, "decision"), comment: str(f, "comment"), grade: str(f, "grade"), audioMediaId: str(f, "audioMediaId") });
    after(() => notifyMembers(submission.coachingId, submission.userId, "feedback"));
    return submission.status === "validated" ? "Validated." : "Sent back with your feedback.";
  });
}

// ── Sessions ─────────────────────────────────────────────────────────────

export async function scheduleSessionAction(_: State, f: FormData): Promise<State> {
  return form(async (v) => {
    const { session } = await svc.scheduleSession(v, str(f, "coachingId"), { startsAt: str(f, "startsAt"), durationMin: str(f, "durationMin"), title: str(f, "title"), forUserId: str(f, "forUserId") });
    after(() => notifyMembers(session.coachingId, session.forUserId, "session", sessionWhen(session.startsAt)));
    return "Session scheduled: the people concerned get an email.";
  });
}

export async function updateSessionAction(_: State, f: FormData): Promise<State> {
  return form(async (v) => {
    const raw: Parameters<typeof svc.updateSession>[2] = {};
    if (f.has("status")) raw.status = str(f, "status");
    if (f.has("summary")) raw.summary = str(f, "summary");
    const { session, summaryPosted } = await svc.updateSession(v, str(f, "sessionId"), raw);
    if (summaryPosted) after(() => notifyMembers(session.coachingId, session.forUserId, "summary"));
    return "Session updated.";
  });
}

export async function joinSessionAction(sessionId: string) {
  return call(async (v) => ({ join: await svc.joinSession(v, sessionId) }));
}
