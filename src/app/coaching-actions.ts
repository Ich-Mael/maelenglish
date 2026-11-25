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
    if (f.has("nextSteps")) {
      const { saveNextSteps } = await import("@/lib/coaching/sessions");
      await saveNextSteps(v, str(f, "sessionId"), String(f.get("nextSteps") ?? ""));
    }
    if (summaryPosted) after(() => notifyMembers(session.coachingId, session.forUserId, "summary"));
    return "Session updated.";
  });
}

export async function prepareSessionAction(_: State, f: FormData): Promise<State> {
  return form(async (v) => {
    const { prepareSession } = await import("@/lib/coaching/sessions");
    const { session, filled } = await prepareSession(v, str(f, "sessionId"), { agenda: String(f.get("agenda") ?? ""), prep: String(f.get("prep") ?? "") });
    if (filled && f.get("notify") === "on") after(() => notifyMembers(session.coachingId, session.forUserId, "prep", sessionWhen(session.startsAt)));
    return filled && f.get("notify") === "on" ? "Saved: the people concerned get an email." : "Saved.";
  });
}

export async function setAttendanceAction(sessionId: string, presentIds: string[]) {
  return call(async (v) => {
    const { setAttendance } = await import("@/lib/coaching/sessions");
    return { attendance: await setAttendance(v, sessionId, (presentIds ?? []).map(String)) };
  });
}

export async function toggleNextStepAction(sessionId: string, stepId: string, done: boolean) {
  return call(async (v) => {
    const { toggleNextStep } = await import("@/lib/coaching/sessions");
    await toggleNextStep(v, sessionId, String(stepId), !!done);
  });
}

export async function joinSessionAction(sessionId: string) {
  return call(async (v) => ({ join: await svc.joinSession(v, sessionId) }));
}

// ── Speaking assessment (start / end) ────────────────────────────────────

export async function setupAssessmentAction(_: State, f: FormData): Promise<State> {
  return form(async (v) => {
    const { setupAssessment } = await import("@/lib/coaching/assessment");
    const phase = str(f, "phase");
    const { coaching, created } = await setupAssessment(v, str(f, "coachingId"), phase, { prompts: String(f.get("prompts") ?? ""), maxSeconds: str(f, "maxSeconds") });
    if (created) after(() => notifyMembers(coaching._id, null, "assessment", phase));
    return created ? "Assessment open: everyone gets an email." : "Saved.";
  });
}
export async function answerAssessmentAction(coachingId: string, phase: string, promptId: string, mediaId: string) {
  return call(async (v) => {
    const { answerPrompt } = await import("@/lib/coaching/assessment");
    return answerPrompt(v, coachingId, phase, promptId, mediaId);
  });
}
export async function submitAssessmentAction(coachingId: string, phase: string) {
  return call(async (v) => {
    const { submitAssessment } = await import("@/lib/coaching/assessment");
    const { coaching } = await submitAssessment(v, coachingId, phase);
    after(() => notifyCoach(coaching._id, v.id, "assessment"));
  });
}
export async function reviewAssessmentAction(_: State, f: FormData): Promise<State> {
  return form(async (v) => {
    const { reviewAssessment, CRITERIA } = await import("@/lib/coaching/assessment");
    const raw = Object.fromEntries(CRITERIA.map((c) => [c, str(f, c)]));
    const { answer } = await reviewAssessment(v, str(f, "answerId"), { ...raw, comment: String(f.get("comment") ?? "") });
    after(() => notifyMembers(answer.coachingId, answer.userId, "assessment_review"));
    return "Scores sent to the learner.";
  });
}

// ── Progress report ──────────────────────────────────────────────────────

export async function saveReportCommentAction(_: State, f: FormData): Promise<State> {
  return form(async (v) => {
    const { saveReportComment } = await import("@/lib/coaching/progress");
    await saveReportComment(v, str(f, "coachingId"), str(f, "month"), String(f.get("comment") ?? ""));
    return "Comment saved: it's in the report.";
  });
}

// ── Daily vocabulary ─────────────────────────────────────────────────────

export async function writeSentenceAction(coachingId: string, vocabId: string, itemId: string, text: string) {
  return call(async (v) => {
    const { writeCoachingSentence } = await import("@/lib/coaching/vocabulary");
    const s = await writeCoachingSentence(v, coachingId, vocabId, itemId, text);
    return { result: { ok: s.ok ?? null, corrected: s.corrected ?? "", explanation: s.explanation ?? "" } };
  });
}
export async function deleteSentenceAction(coachingId: string, sentenceId: string) {
  return call(async (v) => {
    const { deleteCoachingSentence } = await import("@/lib/coaching/vocabulary");
    await deleteCoachingSentence(v, coachingId, sentenceId);
  });
}
export async function saveExpressionAction(coachingId: string, vocabId: string, itemId: string) {
  return call(async (v) => {
    const { saveExpression } = await import("@/lib/coaching/vocabulary");
    await saveExpression(v, coachingId, vocabId, itemId);
  });
}
export async function editVocabItemAction(_: State, f: FormData): Promise<State> {
  return form(async (v) => {
    const { editVocabItem } = await import("@/lib/coaching/vocabulary");
    await editVocabItem(v, str(f, "coachingId"), str(f, "vocabId"), str(f, "itemId"), { text: str(f, "text"), translation: str(f, "translation"), frNote: str(f, "frNote"), example: str(f, "example"), exampleFr: str(f, "exampleFr") });
    return "Expression updated.";
  });
}
