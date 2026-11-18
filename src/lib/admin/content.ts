import { Types } from "mongoose";
import { AssignmentSubmission, Course, Enrollment, Lesson, LessonProgress, Module, QuizAttempt, TeachingResource, User, STAFF_ROLES, COURSE_LEVELS, LESSON_TYPES, RESOURCE_TYPES, type CourseDoc, type LessonDoc, type ModuleDoc } from "@/models";
import { AdminError } from "./errors";

/* Course content editing (framework-free; permission checks happen in the actions). */

const oid = (id: string) => {
  if (!Types.ObjectId.isValid(id)) throw new AdminError("Identifiant invalide.");
  return new Types.ObjectId(id);
};
const date = (v?: string | null) => (v ? new Date(`${v}T00:00:00`) : null);

// ── Courses ────────────────────────────────────────────────────────────────

export type CourseInput = {
  title: string;
  description?: string;
  imageUrl?: string;
  program?: string;
  level?: string;
  startDate?: string | null;
  endDate?: string | null;
};
export type CourseSettings = { isPublished?: boolean; isChallenge?: boolean; themeLabel?: string };

export async function createCourse(input: CourseInput): Promise<CourseDoc> {
  const c = await Course.create({
    title: input.title.trim(),
    description: input.description ?? "",
    imageUrl: input.imageUrl ?? "",
    program: input.program ?? "",
    level: (COURSE_LEVELS.includes(input.level as never) ? input.level : "beginner") as CourseDoc["level"],
    startDate: date(input.startDate),
    endDate: date(input.endDate),
  });
  return c.toObject() as CourseDoc;
}

export async function updateCourse(courseId: string, input: CourseInput, settings?: CourseSettings) {
  const c = await Course.findById(oid(courseId));
  if (!c) throw new AdminError("Cours introuvable.");
  c.title = input.title.trim();
  c.description = input.description ?? "";
  c.imageUrl = input.imageUrl?.trim() ?? "";
  c.program = input.program ?? "";
  if (COURSE_LEVELS.includes(input.level as never)) c.level = input.level as CourseDoc["level"];
  c.startDate = date(input.startDate);
  c.endDate = date(input.endDate);
  if (settings) {
    if (settings.isPublished !== undefined) c.isPublished = settings.isPublished;
    if (settings.isChallenge !== undefined) c.isChallenge = settings.isChallenge;
    if (settings.themeLabel !== undefined) c.challenge = { themeLabel: settings.themeLabel };
  }
  await c.save();
}

/** Only staff accounts can be course instructors / coaches. */
export async function setInstructors(courseId: string, userIds: string[]) {
  const ids = [...new Set(userIds)].filter((id) => Types.ObjectId.isValid(id));
  const staff = await User.find({ _id: { $in: ids }, role: { $in: STAFF_ROLES } }).select("_id").lean();
  await Course.updateOne({ _id: oid(courseId) }, { $set: { instructors: staff.map((s) => s._id) } });
}

/** Deleting is refused while learners are enrolled (deactivate the course instead: unpublish). */
export async function deleteCourse(courseId: string) {
  const id = oid(courseId);
  if (await Enrollment.exists({ courseId: id })) throw new AdminError("Des apprenants sont inscrits : dépubliez le cours au lieu de le supprimer.");
  await Promise.all([
    Module.deleteMany({ courseId: id }),
    Lesson.deleteMany({ courseId: id }),
    TeachingResource.deleteMany({ courseId: id }),
    LessonProgress.deleteMany({ courseId: id }),
    QuizAttempt.deleteMany({ courseId: id }),
    AssignmentSubmission.deleteMany({ courseId: id }),
  ]);
  await Course.deleteOne({ _id: id });
}

// ── Ordering helpers ───────────────────────────────────────────────────────

async function moveIn<T extends { _id: Types.ObjectId; order?: number | null }>(
  siblings: T[],
  id: string,
  dir: "up" | "down",
  save: (id: Types.ObjectId, order: number) => Promise<unknown>,
) {
  const list = [...siblings];
  const i = list.findIndex((s) => String(s._id) === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(list.map((s, k) => (s.order === k + 1 ? null : save(s._id, k + 1))));
}

// ── Modules ────────────────────────────────────────────────────────────────

export async function createModule(courseId: string, title: string, summary = ""): Promise<ModuleDoc> {
  const id = oid(courseId);
  const last = await Module.findOne({ courseId: id }).sort({ order: -1 }).select("order").lean();
  const m = await Module.create({ courseId: id, title: title.trim(), summary, order: (last?.order ?? 0) + 1 });
  return m.toObject() as ModuleDoc;
}

export async function updateModule(moduleId: string, data: { title: string; summary?: string; isCheckpointRequired?: boolean }) {
  const m = await Module.findById(oid(moduleId));
  if (!m) throw new AdminError("Module introuvable.");
  m.title = data.title.trim();
  m.summary = data.summary ?? "";
  if (data.isCheckpointRequired !== undefined) m.isCheckpointRequired = data.isCheckpointRequired;
  await m.save();
}

export async function moveModule(moduleId: string, dir: "up" | "down") {
  const m = await Module.findById(oid(moduleId)).lean();
  if (!m) return;
  const siblings = await Module.find({ courseId: m.courseId }).sort({ order: 1, createdAt: 1 }).select("_id order").lean();
  await moveIn(siblings, moduleId, dir, (id, order) => Module.updateOne({ _id: id }, { order }));
}

export async function deleteModule(moduleId: string) {
  const id = oid(moduleId);
  await Promise.all([Lesson.deleteMany({ moduleId: id }), TeachingResource.deleteMany({ moduleId: id })]);
  await Module.deleteOne({ _id: id });
}

// ── Lessons ────────────────────────────────────────────────────────────────

export async function createLesson(moduleId: string, title: string, type: string): Promise<LessonDoc> {
  const m = await Module.findById(oid(moduleId)).select("courseId").lean();
  if (!m) throw new AdminError("Module introuvable.");
  if (!LESSON_TYPES.includes(type as never)) throw new AdminError("Type de leçon inconnu.");
  const last = await Lesson.findOne({ moduleId: m._id }).sort({ order: -1 }).select("order").lean();
  // New lessons start as drafts so learners never see an empty lesson.
  const l = await Lesson.create({ courseId: m.courseId, moduleId: m._id, title: title.trim(), type: type as LessonDoc["type"], order: (last?.order ?? 0) + 1, isPublished: false });
  return l.toObject() as LessonDoc;
}

export type LessonInput = {
  title: string;
  description?: string;
  isPublished?: boolean;
  videoUrl?: string;
  durationMinutes?: number;
  content?: string;
  fileUrl?: string;
  fileName?: string;
  exercises?: unknown[];
};

export async function updateLesson(lessonId: string, data: LessonInput) {
  const l = await Lesson.findById(oid(lessonId));
  if (!l) throw new AdminError("Leçon introuvable.");
  l.title = data.title.trim();
  l.description = data.description ?? "";
  l.isPublished = !!data.isPublished;
  l.videoUrl = data.videoUrl?.trim() ?? "";
  l.durationMinutes = Math.max(0, Number(data.durationMinutes) || 0);
  l.content = data.content ?? "";
  l.fileUrl = data.fileUrl?.trim() ?? "";
  l.fileName = data.fileName?.trim() ?? "";
  if (l.type === "practice") {
    if (data.isPublished && !(data.exercises?.length)) throw new AdminError("Ajoutez au moins un exercice avant de publier.");
    l.set("exercises", data.exercises ?? []);
  }
  if (l.type === "video" && data.isPublished && !l.videoUrl) throw new AdminError("Indiquez le lien de la vidéo avant de publier.");
  if (l.type === "pdf" && data.isPublished && !l.fileUrl) throw new AdminError("Indiquez le lien du PDF avant de publier.");
  await l.save();
}

export async function moveLesson(lessonId: string, dir: "up" | "down") {
  const l = await Lesson.findById(oid(lessonId)).lean();
  if (!l) return;
  const siblings = await Lesson.find({ moduleId: l.moduleId }).sort({ order: 1, createdAt: 1 }).select("_id order").lean();
  await moveIn(siblings, lessonId, dir, (id, order) => Lesson.updateOne({ _id: id }, { order }));
}

export async function deleteLesson(lessonId: string) {
  const id = oid(lessonId);
  await LessonProgress.deleteMany({ lessonId: id });
  await Lesson.deleteOne({ _id: id });
}

// ── Quizzes & assignments ──────────────────────────────────────────────────

export type QuizInput = {
  title?: string;
  passingScore?: number;
  timeLimit?: number;
  questions: { _id?: string; text: string; options: { id: string; text: string }[]; correctOptionId: string; explanation?: string }[];
};

function quizDoc(q: QuizInput) {
  return {
    title: q.title?.trim() ?? "",
    passingScore: Math.max(0, Math.min(100, Math.round(Number(q.passingScore ?? 70)))),
    timeLimit: Math.max(0, Math.round(Number(q.timeLimit ?? 0))),
    questions: q.questions.map((x) => ({
      ...(x._id && Types.ObjectId.isValid(x._id) ? { _id: new Types.ObjectId(x._id) } : {}),
      text: x.text,
      options: x.options.filter((o) => o.text.trim()),
      correctOptionId: x.correctOptionId,
      explanation: x.explanation ?? "",
    })),
  };
}

/** Module quiz (`moduleId`) or final exam (`courseId`). */
export async function saveQuiz(target: { moduleId: string } | { courseId: string }, q: QuizInput) {
  if ("moduleId" in target) {
    const m = await Module.findById(oid(target.moduleId));
    if (!m) throw new AdminError("Module introuvable.");
    m.set("quiz", quizDoc(q));
    await m.save();
  } else {
    const c = await Course.findById(oid(target.courseId));
    if (!c) throw new AdminError("Cours introuvable.");
    c.set("finalExam", quizDoc(q));
    await c.save();
  }
}

export type AssignmentInput = { title?: string; instructions?: string; submissionType?: string; maxScore?: number; dueDate?: string | null };

/** Module assignment / checkpoint (`moduleId`) or final project (`courseId`). Empty instructions = no assignment. */
export async function saveAssignment(target: { moduleId: string } | { courseId: string }, a: AssignmentInput) {
  const doc = {
    title: a.title?.trim() ?? "",
    instructions: a.instructions?.trim() ?? "",
    submissionType: a.submissionType === "link" ? "link" : "text",
    maxScore: Math.max(1, Math.round(Number(a.maxScore ?? 100))),
  };
  if ("moduleId" in target) {
    const m = await Module.findById(oid(target.moduleId));
    if (!m) throw new AdminError("Module introuvable.");
    m.set("assignment", { ...doc, dueDate: date(a.dueDate) });
    await m.save();
  } else {
    const c = await Course.findById(oid(target.courseId));
    if (!c) throw new AdminError("Cours introuvable.");
    c.set("finalProject", doc);
    await c.save();
  }
}

// ── Teaching resources (staff only) ────────────────────────────────────────

export type ResourceInput = { title: string; resourceType?: string; link?: string; notes?: string; isPublished?: boolean };

export async function saveResource(moduleId: string, actorId: string, data: ResourceInput, resourceId?: string) {
  const m = await Module.findById(oid(moduleId)).select("courseId").lean();
  if (!m) throw new AdminError("Module introuvable.");
  const fields = {
    title: data.title.trim(),
    resourceType: (RESOURCE_TYPES.includes(data.resourceType as never) ? data.resourceType : "other") as (typeof RESOURCE_TYPES)[number],
    link: data.link?.trim() ?? "",
    "content.notes": data.notes ?? "",
    isPublished: data.isPublished ?? true,
    lastEditedBy: new Types.ObjectId(actorId),
  };
  if (resourceId) await TeachingResource.updateOne({ _id: oid(resourceId), moduleId: m._id }, { $set: fields }, { runValidators: true });
  else {
    const { "content.notes": notes, ...rest } = fields;
    await TeachingResource.create({ ...rest, content: { notes }, courseId: m.courseId, moduleId: m._id, createdBy: actorId });
  }
}

export async function deleteResource(resourceId: string) {
  await TeachingResource.deleteOne({ _id: oid(resourceId) });
}
