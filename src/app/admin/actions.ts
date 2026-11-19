"use server";

import { Types } from "mongoose";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { actorOf, allowed, staffOrThrow } from "@/lib/admin/context";
import { can } from "@/lib/admin/permissions";
import { errorMessage, AdminError } from "@/lib/admin/errors";
import { revokeDevice, updateAccount } from "@/lib/admin/users";
import * as content from "@/lib/admin/content";
import { enroll, removeEnrollment, updateEnrollment } from "@/lib/admin/enrollments";
import { gradeSubmission } from "@/lib/admin/grading";
import { RequestError, updateRequest } from "@/lib/requests";
import { createAccount, deactivateUser, issueResetForUser, reissueActivation, restoreUser } from "@/lib/auth/accounts";
import { appUrl, sendActivationEmail, sendEnrollmentEmail, sendPasswordResetEmail } from "@/lib/email";
import { isWhatsAppConfigured, sendEnrollment } from "@/lib/whatsapp";
import { AssignmentSubmission, Course, Enrollment, Lesson, Module, TeachingResource, User, type CourseDoc, type Role } from "@/models";
import type { CurrentUser } from "@/lib/auth/dal";

type State = { error?: string; success?: string; data?: Record<string, string> } | undefined;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const fail = (e: unknown): State => ({ error: errorMessage(e) });
const dateFr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

async function courseOf(me: CurrentUser, courseId: string, need: Parameters<typeof allowed>[2]): Promise<CourseDoc> {
  if (!Types.ObjectId.isValid(courseId)) throw new AdminError("Cours introuvable.");
  const course = await Course.findById(courseId).lean<CourseDoc>();
  if (!course) throw new AdminError("Cours introuvable.");
  if (!allowed(me, course, need)) throw new AdminError("Vous n'avez pas les droits sur ce cours.");
  return course;
}
async function moduleCourse(me: CurrentUser, moduleId: string, need: Parameters<typeof allowed>[2]) {
  const m = Types.ObjectId.isValid(moduleId) ? await Module.findById(moduleId).select("courseId").lean() : null;
  if (!m) throw new AdminError("Module introuvable.");
  return courseOf(me, String(m.courseId), need);
}
async function lessonCourse(me: CurrentUser, lessonId: string) {
  const l = Types.ObjectId.isValid(lessonId) ? await Lesson.findById(lessonId).select("courseId moduleId").lean() : null;
  if (!l) throw new AdminError("Leçon introuvable.");
  await courseOf(me, String(l.courseId), "edit");
  return l;
}
async function usersGuard() {
  const me = await staffOrThrow();
  if (!can.manageUsers(actorOf(me))) throw new AdminError("Accès réservé à la gestion des comptes.");
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
    if (!data.name || !data.surname || !data.username) return { error: "Prénom, nom et identifiant sont obligatoires." };
    const { user, activationToken } = await createAccount({ _id: new Types.ObjectId(me.id), role: me.role }, data);
    let emailed = false;
    if (user.email) {
      try {
        await sendActivationEmail(user.email, { firstName: user.name, username: user.username, token: activationToken });
        emailed = true;
      } catch (e) {
        console.error("activation email", e);
      }
    }
    refresh();
    return {
      success: emailed ? `Compte créé. Le lien d'activation a été envoyé à ${user.email}.` : "Compte créé. Transmettez le lien d'activation à la personne.",
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
      about: str(form, "about"),
      maxDevices: Number(str(form, "maxDevices")) || undefined,
    });
    refresh();
    return { success: "Modifications enregistrées." };
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
    if (!user) return { error: "Compte introuvable." };
    const kind = str(form, "kind") === "activation" ? "activation" : "reset";
    const token = kind === "activation" ? await reissueActivation(userId) : await issueResetForUser(userId);
    const url = appUrl(kind === "activation" ? `/activer/${token}` : `/reinitialiser/${token}`);
    let emailed = false;
    if (user.email && form.get("email") === "on") {
      try {
        if (kind === "activation") await sendActivationEmail(user.email, { firstName: user.name, username: user.username, token });
        else await sendPasswordResetEmail(user.email, { firstName: user.name, token });
        emailed = true;
      } catch (e) {
        console.error("link email", e);
      }
    }
    return {
      success: `${kind === "activation" ? "Nouveau lien d'activation (7 jours)" : "Lien de réinitialisation (1 heure)"}${emailed ? ` envoyé à ${user.email}` : ""}.`,
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
    if (!can.createCourse(actorOf(me))) return { error: "Seul un administrateur peut créer un cours." };
    if (!str(form, "title")) return { error: "Donnez un titre au cours." };
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
    if (!str(form, "title")) return { error: "Donnez un titre au cours." };
    const settings = can.manageCourseSettings(actorOf(me))
      ? { isPublished: form.get("isPublished") === "on", isChallenge: form.get("isChallenge") === "on", themeLabel: str(form, "themeLabel") }
      : undefined;
    await content.updateCourse(courseId, courseInput(form), settings);
    refresh();
    return { success: "Cours enregistré." };
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
    return { success: "Équipe pédagogique mise à jour." };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCourseAction(_: State, form: FormData): Promise<State> {
  try {
    const me = await staffOrThrow();
    if (!can.deleteCourse(actorOf(me))) return { error: "Seul un administrateur peut supprimer un cours." };
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
    if (!str(form, "title")) return { error: "Donnez un titre au module." };
    await content.createModule(courseId, str(form, "title"), str(form, "summary"));
    refresh();
    return { success: "Module ajouté." };
  } catch (e) {
    return fail(e);
  }
}

export async function updateModuleAction(_: State, form: FormData): Promise<State> {
  try {
    const me = await staffOrThrow();
    const moduleId = str(form, "moduleId");
    await moduleCourse(me, moduleId, "edit");
    if (!str(form, "title")) return { error: "Donnez un titre au module." };
    await content.updateModule(moduleId, { title: str(form, "title"), summary: str(form, "summary"), description: String(form.get("description") ?? ""), isCheckpointRequired: form.get("isCheckpointRequired") === "on" });
    refresh();
    return { success: "Module enregistré." };
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

// ── Lessons ────────────────────────────────────────────────────────────────

export async function createLessonAction(_: State, form: FormData): Promise<State> {
  let target: string;
  try {
    const me = await staffOrThrow();
    const moduleId = str(form, "moduleId");
    const course = await moduleCourse(me, moduleId, "edit");
    if (!str(form, "title")) return { error: "Donnez un titre à la leçon." };
    const l = await content.createLesson(moduleId, str(form, "title"), str(form, "type"));
    target = `/admin/cours/${course._id}/lecons/${l._id}`;
  } catch (e) {
    return fail(e);
  }
  redirect(target);
}

export async function saveLessonAction(_: State, form: FormData): Promise<State> {
  try {
    const me = await staffOrThrow();
    const lessonId = str(form, "lessonId");
    await lessonCourse(me, lessonId);
    let exercises: unknown[] | undefined;
    const raw = form.get("exercises");
    if (raw) {
      try {
        exercises = JSON.parse(String(raw));
      } catch {
        return { error: "Exercices illisibles." };
      }
    }
    await content.updateLesson(lessonId, {
      title: str(form, "title"),
      description: str(form, "description"),
      isPublished: form.get("isPublished") === "on",
      videoUrl: str(form, "videoUrl"),
      durationMinutes: Number(str(form, "durationMinutes")) || 0,
      content: String(form.get("content") ?? ""),
      fileUrl: str(form, "fileUrl"),
      fileName: str(form, "fileName"),
      exercises,
    });
    refresh();
    return { success: "Leçon enregistrée." };
  } catch (e) {
    return fail(e);
  }
}

export async function moveLessonAction(form: FormData) {
  const me = await staffOrThrow();
  await lessonCourse(me, str(form, "lessonId"));
  await content.moveLesson(str(form, "lessonId"), str(form, "dir") === "up" ? "up" : "down");
  refresh();
}

export async function deleteLessonAction(form: FormData) {
  const me = await staffOrThrow();
  const l = await lessonCourse(me, str(form, "lessonId"));
  await content.deleteLesson(str(form, "lessonId"));
  redirect(`/admin/cours/${l.courseId}/modules/${l.moduleId}`);
}

// ── Quizzes, assignments, resources ────────────────────────────────────────

async function targetOf(me: CurrentUser, form: FormData): Promise<{ moduleId: string } | { courseId: string }> {
  const moduleId = str(form, "moduleId");
  if (moduleId) {
    await moduleCourse(me, moduleId, "edit");
    return { moduleId };
  }
  const courseId = str(form, "courseId");
  await courseOf(me, courseId, "edit");
  return { courseId };
}

export async function saveQuizAction(_: State, form: FormData): Promise<State> {
  try {
    const me = await staffOrThrow();
    const target = await targetOf(me, form);
    let quiz: content.QuizInput;
    try {
      quiz = JSON.parse(String(form.get("quiz") ?? ""));
    } catch {
      return { error: "Quiz illisible." };
    }
    await content.saveQuiz(target, quiz);
    refresh();
    return { success: quiz.questions.length ? "Quiz enregistré." : "Quiz supprimé (aucune question)." };
  } catch (e) {
    return fail(e);
  }
}

export async function saveAssignmentAction(_: State, form: FormData): Promise<State> {
  try {
    const me = await staffOrThrow();
    const target = await targetOf(me, form);
    await content.saveAssignment(target, {
      title: str(form, "title"),
      instructions: String(form.get("instructions") ?? ""),
      submissionType: str(form, "submissionType"),
      maxScore: Number(str(form, "maxScore")) || 100,
      dueDate: str(form, "dueDate") || null,
    });
    refresh();
    return { success: str(form, "instructions") ? "Devoir enregistré." : "Devoir retiré (consignes vides)." };
  } catch (e) {
    return fail(e);
  }
}

export async function saveResourceAction(_: State, form: FormData): Promise<State> {
  try {
    const me = await staffOrThrow();
    const moduleId = str(form, "moduleId");
    await moduleCourse(me, moduleId, "edit");
    if (!str(form, "title")) return { error: "Donnez un titre à la ressource." };
    await content.saveResource(moduleId, me.id, { title: str(form, "title"), resourceType: str(form, "resourceType"), link: str(form, "link"), notes: String(form.get("notes") ?? "") }, str(form, "resourceId") || undefined);
    refresh();
    return { success: "Ressource enregistrée." };
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
      try {
        if (user.phoneE164 && isWhatsAppConfigured()) {
          await sendEnrollment(user.phoneE164, { ...p, endDate: p.endDate ?? "—" });
          notice = " Message WhatsApp envoyé.";
        } else if (user.email) {
          await sendEnrollmentEmail(user.email, p);
          notice = " Email envoyé.";
        }
      } catch (e) {
        console.error("enrolment notice", e);
        notice = " (La notification n'a pas pu être envoyée.)";
      }
    }
    refresh();
    return { success: `${user.name} ${user.surname} est inscrit(e).${notice}` };
  } catch (e) {
    return fail(e);
  }
}

export async function updateEnrollmentAction(_: State, form: FormData): Promise<State> {
  try {
    const me = await staffOrThrow();
    const e = Types.ObjectId.isValid(str(form, "enrollmentId")) ? await Enrollment.findById(str(form, "enrollmentId")).select("courseId").lean() : null;
    if (!e) return { error: "Inscription introuvable." };
    await courseOf(me, String(e.courseId), "enroll");
    const status = str(form, "status");
    await updateEnrollment(str(form, "enrollmentId"), {
      startDate: str(form, "startDate") || null,
      endDate: str(form, "endDate") || null,
      ...(status === "active" || status === "suspended" || status === "completed" ? { status } : {}),
    });
    refresh();
    return { success: "Inscription mise à jour." };
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
    const sub = Types.ObjectId.isValid(id) ? await AssignmentSubmission.findById(id).select("courseId").lean() : null;
    if (!sub) return { error: "Devoir introuvable." };
    await courseOf(me, String(sub.courseId), "grade");
    const decision = str(form, "decision") === "returned" ? "returned" : "graded";
    const gradeRaw = str(form, "grade");
    await gradeSubmission(me.id, id, { decision, grade: gradeRaw === "" ? null : Number(gradeRaw), feedback: str(form, "feedback") });
    next = "/admin/corrections";
  } catch (e) {
    return fail(e);
  }
  redirect(next);
}

// ── Sign-up requests ───────────────────────────────────────────────────────

export async function updateRequestAction(_: State, form: FormData): Promise<State> {
  try {
    const me = await usersGuard();
    await updateRequest(str(form, "requestId"), me.id, { status: str(form, "status"), notes: String(form.get("notes") ?? "") });
    refresh();
    return { success: "Demande mise à jour." };
  } catch (e) {
    if (e instanceof RequestError) return { error: e.message };
    return fail(e);
  }
}
