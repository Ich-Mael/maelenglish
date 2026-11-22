"use server";

import { Types } from "mongoose";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { actorOf, allowed, staffOrThrow } from "@/lib/admin/context";
import { can } from "@/lib/admin/permissions";
import { errorMessage, AdminError } from "@/lib/admin/errors";
import { revokeDevice, searchLearners, updateAccount, type LearnerMatch } from "@/lib/admin/users";
import * as content from "@/lib/admin/content";
import * as steps from "@/lib/admin/steps";
import { setDefaultMonthlyMinutes } from "@/lib/ai/metering";
import { enroll, removeEnrollment, updateEnrollment } from "@/lib/admin/enrollments";
import { gradeSubmission } from "@/lib/admin/grading";
import { notifyChallengeReviewed, runCoachDigest } from "@/lib/notifications";
import { assignCourseCoach, setMainCoach } from "@/lib/admin/coaching";
import { RequestError, updateRequest } from "@/lib/requests";
import { createAccount, deactivateUser, issueResetForUser, reissueActivation, restoreUser } from "@/lib/auth/accounts";
import { appUrl, sendActivationEmail, sendEnrollmentEmail, sendPasswordResetEmail } from "@/lib/email";
import { findProgram, programPhoto } from "@/lib/catalog";
import { plainText } from "@/lib/rich-text";
import { isWhatsAppConfigured, sendEnrollment } from "@/lib/whatsapp";
import { ChallengeSubmission, Course, Enrollment, Module, Step, TeachingResource, Unit, User, WritingSubmission, type CourseDoc, type Role } from "@/models";
import { reviewWriting, WritingError } from "@/lib/lab/writing";
import type { CurrentUser } from "@/lib/auth/dal";

type State = { error?: string; success?: string; data?: Record<string, string> } | undefined;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const fail = (e: unknown): State => ({ error: errorMessage(e) });
const dateFr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

async function courseOf(me: CurrentUser, courseId: string, need: Parameters<typeof allowed>[2]): Promise<CourseDoc> {
  if (!Types.ObjectId.isValid(courseId)) throw new AdminError("Course not found.");
  const course = await Course.findById(courseId).lean<CourseDoc>();
  if (!course) throw new AdminError("Course not found.");
  if (!allowed(me, course, need)) throw new AdminError("You don't have rights on this course.");
  return course;
}
async function moduleCourse(me: CurrentUser, moduleId: string, need: Parameters<typeof allowed>[2]) {
  const m = Types.ObjectId.isValid(moduleId) ? await Module.findById(moduleId).select("courseId").lean() : null;
  if (!m) throw new AdminError("Module not found.");
  return courseOf(me, String(m.courseId), need);
}
async function unitCourse(me: CurrentUser, unitId: string) {
  const u = Types.ObjectId.isValid(unitId) ? await Unit.findById(unitId).select("courseId moduleId").lean() : null;
  if (!u) throw new AdminError("Unit not found.");
  const course = await courseOf(me, String(u.courseId), "edit");
  return { course, unit: u };
}
async function stepCourse(me: CurrentUser, stepId: string) {
  const s = Types.ObjectId.isValid(stepId) ? await Step.findById(stepId).select("courseId moduleId unitId kind").lean() : null;
  if (!s) throw new AdminError("Step not found.");
  await courseOf(me, String(s.courseId), "edit");
  return s;
}
async function usersGuard() {
  const me = await staffOrThrow();
  if (!can.manageUsers(actorOf(me))) throw new AdminError("Account managers only.");
  return me;
}

// ── Users ──────────────────────────────────────────────────────────────────

export async function createUserAction(_: State, form: FormData): Promise<State> {
  try {
    const me = await usersGuard();
    const data = {
      name: str(form, "name"),
      surname: str(form, "surname"),
      username: str(form, "username").toLowerCase(),
      email: str(form, "email") || undefined,
      phoneNumber: str(form, "phoneNumber") || undefined,
      role: (str(form, "role") || "user") as Role,
    };
    if (!data.name || !data.surname || !data.username) return { error: "First name, last name and username are required." };
    const { user, activationToken } = await createAccount({ _id: new Types.ObjectId(me.id), role: me.role }, data);
    let emailed = false;
    if (user.email) {
      try {
        emailed = !(await sendActivationEmail(user.email, { firstName: user.name, username: user.username, token: activationToken })).simulated;
      } catch (e) {
        console.error("activation email", e);
      }
    }
    refresh();
    return {
      success: emailed ? `Account created. The activation link was sent to ${user.email}.` : "Account created. Pass the activation link on to the person.",
      data: { userId: String(user._id), url: appUrl(`/activer/${activationToken}`), phone: user.phoneE164 ?? "", name: user.name, username: user.username },
    };
  } catch (e) {
    return fail(e);
  }
}

export async function updateUserAction(_: State, form: FormData): Promise<State> {
  try {
    const me = await usersGuard();
    await updateAccount({ _id: new Types.ObjectId(me.id), role: me.role }, str(form, "userId"), {
      name: str(form, "name"),
      surname: str(form, "surname"),
      username: str(form, "username"),
      email: str(form, "email"),
      phoneNumber: str(form, "phoneNumber"),
      role: (str(form, "role") || undefined) as Role | undefined,
      englishLevel: str(form, "englishLevel"),
      coachName: form.has("coachName") ? str(form, "coachName") : undefined,
      about: str(form, "about"),
      maxDevices: Number(str(form, "maxDevices")) || undefined,
      aiMonthlyMinutes: form.has("aiMonthlyMinutes") ? (str(form, "aiMonthlyMinutes") === "" ? null : Number(str(form, "aiMonthlyMinutes"))) : undefined,
    });
    refresh();
    return { success: "Changes saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleUserAction(form: FormData) {
  const me = await usersGuard();
  const userId = str(form, "userId");
  if (str(form, "op") === "restore") await restoreUser(userId);
  else await deactivateUser({ _id: new Types.ObjectId(me.id), role: me.role }, userId);
  refresh();
}

/** New activation link (never activated) or reset link; emailed when possible, always shown to copy. */
export async function accountLinkAction(_: State, form: FormData): Promise<State> {
  try {
    await usersGuard();
    const userId = str(form, "userId");
    const user = await User.findById(userId).lean();
    if (!user) return { error: "Account not found." };
    const kind = str(form, "kind") === "activation" ? "activation" : "reset";
    const token = kind === "activation" ? await reissueActivation(userId) : await issueResetForUser(userId);
    const url = appUrl(kind === "activation" ? `/activer/${token}` : `/reinitialiser/${token}`);
    let emailed = false;
    if (user.email && form.get("email") === "on") {
      try {
        const sent =
          kind === "activation"
            ? await sendActivationEmail(user.email, { firstName: user.name, username: user.username, token })
            : await sendPasswordResetEmail(user.email, { firstName: user.name, token });
        emailed = !sent.simulated;
      } catch (e) {
        console.error("link email", e);
      }
    }
    return {
      success: `${kind === "activation" ? "New activation link (7 days)" : "Password reset link (1 hour)"}${emailed ? ` sent to ${user.email}` : ""}.`,
      data: { url, phone: user.phoneE164 ?? "", name: user.name, kind },
    };
  } catch (e) {
    return fail(e);
  }
}

export async function revokeDeviceAction(form: FormData) {
  await usersGuard();
  await revokeDevice(str(form, "userId"), str(form, "deviceId"));
  refresh();
}

// ── Courses ────────────────────────────────────────────────────────────────

function courseInput(form: FormData): content.CourseInput {
  return {
    title: str(form, "title"),
    description: str(form, "description"),
    imageUrl: str(form, "imageUrl"),
    program: str(form, "program"),
    level: str(form, "level"),
    startDate: str(form, "startDate") || null,
    endDate: str(form, "endDate") || null,
    price: str(form, "price"),
  };
}

export async function createCourseAction(_: State, form: FormData): Promise<State> {
  let id: string;
  try {
    const me = await staffOrThrow();
    if (!can.createCourse(actorOf(me))) return { error: "Only an administrator can create a course." };
    if (!str(form, "title")) return { error: "Give the course a title." };
    const c = await content.createCourse(courseInput(form));
    await content.updateCourse(String(c._id), courseInput(form), { isChallenge: form.get("isChallenge") === "on", themeLabel: str(form, "themeLabel") });
    id = String(c._id);
  } catch (e) {
    return fail(e);
  }
  redirect(`/admin/cours/${id}`);
}

export async function updateCourseAction(_: State, form: FormData): Promise<State> {
  try {
    const me = await staffOrThrow();
    const courseId = str(form, "courseId");
    await courseOf(me, courseId, "edit");
    if (!str(form, "title")) return { error: "Give the course a title." };
    const settings = can.manageCourseSettings(actorOf(me))
      ? { isPublished: form.get("isPublished") === "on", isChallenge: form.get("isChallenge") === "on", themeLabel: str(form, "themeLabel") }
      : undefined;
    await content.updateCourse(courseId, courseInput(form), settings);
    refresh();
    return { success: "Course saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function setInstructorsAction(_: State, form: FormData): Promise<State> {
  try {
    const me = await staffOrThrow();
    const courseId = str(form, "courseId");
    await courseOf(me, courseId, "settings");
    await content.setInstructors(courseId, form.getAll("instructors").map(String));
    refresh();
    return { success: "Teaching team updated." };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCourseAction(_: State, form: FormData): Promise<State> {
  try {
    const me = await staffOrThrow();
    if (!can.deleteCourse(actorOf(me))) return { error: "Only an administrator can delete a course." };
    await content.deleteCourse(str(form, "courseId"));
  } catch (e) {
    return fail(e);
  }
  redirect("/admin/cours");
}

// ── Modules ────────────────────────────────────────────────────────────────

export async function createModuleAction(_: State, form: FormData): Promise<State> {
  try {
    const me = await staffOrThrow();
    const courseId = str(form, "courseId");
    await courseOf(me, courseId, "edit");
    if (!str(form, "title")) return { error: "Give the module a title." };
    await content.createModule(courseId, str(form, "title"), str(form, "summary"));
    refresh();
    return { success: "Module added." };
  } catch (e) {
    return fail(e);
  }
}

export async function updateModuleAction(_: State, form: FormData): Promise<State> {
  try {
    const me = await staffOrThrow();
    const moduleId = str(form, "moduleId");
    await moduleCourse(me, moduleId, "edit");
    if (!str(form, "title")) return { error: "Give the module a title." };
    await content.updateModule(moduleId, { title: str(form, "title"), summary: str(form, "summary"), description: String(form.get("description") ?? ""), level: str(form, "level") });
    refresh();
    return { success: "Module saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function moveModuleAction(form: FormData) {
  const me = await staffOrThrow();
  await moduleCourse(me, str(form, "moduleId"), "edit");
  await content.moveModule(str(form, "moduleId"), str(form, "dir") === "up" ? "up" : "down");
  refresh();
}

export async function deleteModuleAction(form: FormData) {
  const me = await staffOrThrow();
  const course = await moduleCourse(me, str(form, "moduleId"), "edit");
  await content.deleteModule(str(form, "moduleId"));
  redirect(`/admin/cours/${course._id}`);
}

// ── Units ──────────────────────────────────────────────────────────────────

export async function createUnitAction(_: State, form: FormData): Promise<State> {
  try {
    const me = await staffOrThrow();
    const moduleId = str(form, "moduleId");
    await moduleCourse(me, moduleId, "edit");
    if (!str(form, "title")) return { error: "Give the unit a title." };
    await content.createUnit(moduleId, str(form, "title"), String(form.get("objectives") ?? ""));
    refresh();
    return { success: "Unit added." };
  } catch (e) {
    return fail(e);
  }
}

export async function updateUnitAction(_: State, form: FormData): Promise<State> {
  try {
    const me = await staffOrThrow();
    const unitId = str(form, "unitId");
    await unitCourse(me, unitId);
    await content.updateUnit(unitId, { title: str(form, "title"), objectives: String(form.get("objectives") ?? ""), estimatedMinutes: Number(str(form, "estimatedMinutes")) || 0 });
    refresh();
    return { success: "Unit saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function moveUnitAction(form: FormData) {
  const me = await staffOrThrow();
  await unitCourse(me, str(form, "unitId"));
  await content.moveUnit(str(form, "unitId"), str(form, "dir") === "up" ? "up" : "down");
  refresh();
}

export async function deleteUnitAction(_: State, form: FormData): Promise<State> {
  let target: string;
  try {
    const me = await staffOrThrow();
    const { course, unit } = await unitCourse(me, str(form, "unitId"));
    await content.deleteUnit(str(form, "unitId"));
    target = `/admin/cours/${course._id}/modules/${unit.moduleId}`;
  } catch (e) {
    return fail(e);
  }
  redirect(target);
}

// ── Steps (lesson + at least 2 activities, …, speaking challenge) ─────────────────

export async function addLessonAction(_: State, form: FormData): Promise<State> {
  let target: string;
  try {
    const me = await staffOrThrow();
    const unitId = str(form, "unitId");
    const { course } = await unitCourse(me, unitId);
    const s = await steps.addLesson(unitId, str(form, "title"));
    target = `/admin/cours/${course._id}/etapes/${s._id}`;
  } catch (e) {
    return fail(e);
  }
  redirect(target);
}

/** Lesson step editor: title, minutes and the structured content (JSON in « content »). */
export async function saveLessonStepAction(_: State, form: FormData): Promise<State> {
  try {
    const me = await staffOrThrow();
    const stepId = str(form, "stepId");
    await stepCourse(me, stepId);
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(String(form.get("content") ?? "{}"));
    } catch {
      return { error: "Unreadable lesson content." };
    }
    await steps.updateLesson(stepId, { title: str(form, "title"), estimatedMinutes: Number(str(form, "estimatedMinutes")) || 0, content: { ...data, intro: String(form.get("intro") ?? "") } });
    refresh();
    return { success: "Lesson saved." };
  } catch (e) {
    return fail(e);
  }
}

/** Adds a Lab activity to a unit (an activity step practising a lesson, or the speaking challenge). */
export async function addStepActivityAction(_: State, form: FormData): Promise<State> {
  try {
    const me = await staffOrThrow();
    const unitId = str(form, "unitId");
    await unitCourse(me, unitId);
    if (!str(form, "activityId")) return { error: "Pick an activity." };
    const kind = await steps.attachActivity(str(form, "activityId"), unitId, str(form, "lessonId") || null);
    refresh();
    return { success: kind === "challenge" ? "Speaking challenge set." : "Activity added." };
  } catch (e) {
    return fail(e);
  }
}

export async function saveActivityStepAction(_: State, form: FormData): Promise<State> {
  try {
    const me = await staffOrThrow();
    const stepId = str(form, "stepId");
    await stepCourse(me, stepId);
    await steps.updateActivityStep(stepId, { lessonId: str(form, "lessonId") || null, passScore: Number(str(form, "passScore")), estimatedMinutes: Number(str(form, "estimatedMinutes")) || 0 });
    refresh();
    return { success: "Saved." };
  } catch (e) {
    return fail(e);
  }
}

/** Drag-and-drop order of a unit's steps. */
export async function reorderStepsAction(unitId: string, orderedIds: string[]): Promise<{ error?: string }> {
  try {
    const me = await staffOrThrow();
    await unitCourse(me, String(unitId));
    await steps.reorderSteps(String(unitId), orderedIds.map(String));
    refresh();
    return {};
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function moveStepAction(form: FormData) {
  const me = await staffOrThrow();
  await stepCourse(me, str(form, "stepId"));
  await steps.moveStep(str(form, "stepId"), str(form, "dir") === "up" ? "up" : "down");
  refresh();
}

export async function deleteStepAction(form: FormData) {
  const me = await staffOrThrow();
  const s = await stepCourse(me, str(form, "stepId"));
  await steps.deleteStep(str(form, "stepId"));
  if (form.get("redirect") === "unit") redirect(`/admin/cours/${s.courseId}/unites/${s.unitId}`);
  refresh();
}

// ── Final exam, resources ──────────────────────────────────────────────────

export async function saveFinalExamAction(_: State, form: FormData): Promise<State> {
  try {
    const me = await staffOrThrow();
    const courseId = str(form, "courseId");
    await courseOf(me, courseId, "edit");
    let quiz: content.QuizInput;
    try {
      quiz = JSON.parse(String(form.get("quiz") ?? ""));
    } catch {
      return { error: "Unreadable exam." };
    }
    await content.saveFinalExam(courseId, quiz);
    refresh();
    return { success: quiz.questions.length ? "Final exam saved." : "Final exam removed (no questions)." };
  } catch (e) {
    return fail(e);
  }
}

export async function saveResourceAction(_: State, form: FormData): Promise<State> {
  try {
    const me = await staffOrThrow();
    const moduleId = str(form, "moduleId");
    await moduleCourse(me, moduleId, "edit");
    if (!str(form, "title")) return { error: "Give the resource a title." };
    await content.saveResource(moduleId, me.id, { title: str(form, "title"), resourceType: str(form, "resourceType"), link: str(form, "link"), notes: String(form.get("notes") ?? "") }, str(form, "resourceId") || undefined);
    refresh();
    return { success: "Resource saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteResourceAction(form: FormData) {
  const me = await staffOrThrow();
  const r = Types.ObjectId.isValid(str(form, "resourceId")) ? await TeachingResource.findById(str(form, "resourceId")).select("moduleId").lean() : null;
  if (!r) return;
  await moduleCourse(me, String(r.moduleId), "edit");
  await content.deleteResource(str(form, "resourceId"));
  refresh();
}

// ── Enrolments ─────────────────────────────────────────────────────────────

/** Enrolment picker: accounts matching what staff type (name, email, number…). */
export async function searchLearnersAction(courseId: string, q: string): Promise<LearnerMatch[]> {
  const me = await staffOrThrow();
  await courseOf(me, String(courseId), "enroll");
  return searchLearners(String(q).slice(0, 80), String(courseId));
}

export async function enrollAction(_: State, form: FormData): Promise<State> {
  try {
    const me = await staffOrThrow();
    const courseId = str(form, "courseId");
    await courseOf(me, courseId, "enroll");
    const { user, course, enrollment } = await enroll(me.id, courseId, {
      identifier: str(form, "identifier"),
      startDate: str(form, "startDate") || null,
      endDate: str(form, "endDate") || null,
    });
    let notice = "";
    if (form.get("notify") === "on") {
      const p = {
        firstName: user.name,
        courseTitle: course.title,
        startDate: dateFr.format(enrollment.startDate ?? new Date()),
        endDate: enrollment.endDate ? dateFr.format(enrollment.endDate) : null,
      };
      const program = findProgram(course.program);
      const image = /^https?:\/\/.+\.(jpe?g|png|gif)(\?.*)?$/i.test(course.imageUrl ?? "") ? course.imageUrl! : program ? appUrl(programPhoto(program).fallback) : null;
      const emailDetails = {
        courseUrl: appUrl(`/apprendre/${courseId}`),
        imageUrl: image,
        objectives: program?.objectives ?? [],
        summary: plainText(course.description).slice(0, 280),
      };
      try {
        if (user.phoneE164 && isWhatsAppConfigured()) {
          await sendEnrollment(user.phoneE164, { ...p, endDate: p.endDate ?? "—" });
          notice = " WhatsApp message sent.";
        } else if (user.email) {
          if (!(await sendEnrollmentEmail(user.email, { ...p, ...emailDetails })).simulated) notice = " Email sent.";
        }
      } catch (e) {
        console.error("enrolment notice", e);
        notice = " (The notification could not be sent.)";
      }
    }
    refresh();
    return { success: `${user.name} ${user.surname} is enrolled.${notice}` };
  } catch (e) {
    return fail(e);
  }
}

export async function updateEnrollmentAction(_: State, form: FormData): Promise<State> {
  try {
    const me = await staffOrThrow();
    const e = Types.ObjectId.isValid(str(form, "enrollmentId")) ? await Enrollment.findById(str(form, "enrollmentId")).select("courseId").lean() : null;
    if (!e) return { error: "Enrolment not found." };
    await courseOf(me, String(e.courseId), "enroll");
    const status = str(form, "status");
    await updateEnrollment(str(form, "enrollmentId"), {
      startDate: str(form, "startDate") || null,
      endDate: str(form, "endDate") || null,
      ...(status === "active" || status === "suspended" || status === "completed" ? { status } : {}),
    });
    refresh();
    return { success: "Enrolment updated." };
  } catch (err) {
    return fail(err);
  }
}

export async function removeEnrollmentAction(form: FormData) {
  const me = await staffOrThrow();
  const e = Types.ObjectId.isValid(str(form, "enrollmentId")) ? await Enrollment.findById(str(form, "enrollmentId")).select("courseId").lean() : null;
  if (!e) return;
  await courseOf(me, String(e.courseId), "enroll");
  await removeEnrollment(str(form, "enrollmentId"));
  refresh();
}

// ── Grading ────────────────────────────────────────────────────────────────

export async function gradeAction(_: State, form: FormData): Promise<State> {
  let next: string;
  try {
    const me = await staffOrThrow();
    const id = str(form, "submissionId");
    const sub = Types.ObjectId.isValid(id) ? await ChallengeSubmission.findById(id).select("courseId userId").lean() : null;
    if (!sub) return { error: "Submission not found." };
    // The course team, or the learner's main coach.
    const [course, learner] = await Promise.all([Course.findById(sub.courseId).select("instructors").lean(), User.findById(sub.userId).select("coachId").lean()]);
    if (!course || !can.gradeSubmission(actorOf(me), course, learner?.coachId)) return { error: "You can't grade this learner's work." };
    const decision = str(form, "decision") === "returned" ? "returned" : "graded";
    const gradeRaw = str(form, "grade");
    await gradeSubmission(me.id, id, { decision, grade: gradeRaw === "" ? null : Number(gradeRaw), feedback: str(form, "feedback"), feedbackAudioMediaId: str(form, "feedbackAudio") });
    await notifyChallengeReviewed(id);
    next = "/admin/corrections";
  } catch (e) {
    return fail(e);
  }
  redirect(next);
}

/** Coach review of a writing task version: the edited correction, a comment and a score, sent to the learner. */
export async function reviewWritingAction(_: State, form: FormData): Promise<State> {
  let next: string;
  try {
    const me = await staffOrThrow();
    const id = str(form, "submissionId");
    const sub = Types.ObjectId.isValid(id) ? await WritingSubmission.findById(id).select("courseId userId").lean() : null;
    if (!sub) return { error: "Answer not found." };
    const [course, learner] = await Promise.all([Course.findById(sub.courseId).select("instructors").lean(), User.findById(sub.userId).select("coachId").lean()]);
    if (!course || !can.gradeSubmission(actorOf(me), course, learner?.coachId)) return { error: "You can't review this learner's work." };
    let feedback: unknown = null;
    try {
      feedback = JSON.parse(str(form, "feedback") || "null");
    } catch {
      return { error: "The correction couldn't be read: reload the page." };
    }
    await reviewWriting(me.id, id, { feedback, comment: str(form, "comment"), askNewVersion: form.get("askNewVersion") === "on" });
    next = "/admin/corrections/ecrits";
  } catch (e) {
    return e instanceof WritingError ? { error: e.message } : fail(e);
  }
  redirect(next);
}

// ── Sign-up requests ───────────────────────────────────────────────────────

export async function updateRequestAction(_: State, form: FormData): Promise<State> {
  try {
    const me = await usersGuard();
    await updateRequest(str(form, "requestId"), me.id, { status: str(form, "status"), notes: String(form.get("notes") ?? "") });
    refresh();
    return { success: "Request updated." };
  } catch (e) {
    if (e instanceof RequestError) return { error: e.message };
    return fail(e);
  }
}

// ── AI usage settings (admins) ─────────────────────────────────────────────

export async function saveAiSettingsAction(_: State, form: FormData): Promise<State> {
  try {
    const me = await staffOrThrow();
    if (!me.isAdmin) throw new AdminError("Administrators only.");
    const minutes = Number(str(form, "aiMonthlyMinutes"));
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 10000) throw new AdminError("Enter a number of minutes between 0 and 10,000.");
    await setDefaultMonthlyMinutes(minutes);
    refresh();
    return { success: "Setting saved." };
  } catch (e) {
    return fail(e);
  }
}

// ── Coaching ───────────────────────────────────────────────────────────────

/** A learner's main coach (user page). Empty = none. */
export async function setCoachAction(_: State, form: FormData): Promise<State> {
  try {
    const me = await staffOrThrow();
    if (!can.assignCoach(actorOf(me))) return { error: "Only admins and account managers assign coaches." };
    await setMainCoach(str(form, "userId"), str(form, "coachId") || null);
    refresh();
    return { success: str(form, "coachId") ? "Main coach saved." : "Main coach removed." };
  } catch (e) {
    return fail(e);
  }
}

/** Gives a course's enrolled learners a main coach (only those without one, unless « all »). */
export async function assignCourseCoachAction(_: State, form: FormData): Promise<State> {
  try {
    const me = await staffOrThrow();
    if (!can.assignCoach(actorOf(me))) return { error: "Only admins and account managers assign coaches." };
    await courseOf(me, str(form, "courseId"), "enroll");
    const n = await assignCourseCoach(str(form, "courseId"), str(form, "coachId"), { all: form.get("all") === "on" });
    refresh();
    return { success: n ? `Main coach set for ${n} learner(s).` : "No learner to update." };
  } catch (e) {
    return fail(e);
  }
}

/** Coach oversight: send the coach digest now (also tests the email setup). */
export async function sendDigestNowAction(): Promise<State> {
  try {
    const me = await staffOrThrow();
    if (!can.overseeCoaches(actorOf(me))) return { error: "Admins only." };
    const r = await runCoachDigest(new Date(), { force: true });
    refresh();
    return { success: r.pending ? `Digest sent: ${r.emails} email(s) for ${r.pending} challenge(s) waiting (${r.late} late).` : "Nothing is waiting: no email sent." };
  } catch (e) {
    return fail(e);
  }
}
