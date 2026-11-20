import { Types } from "mongoose";
import { AssignmentSubmission, Course, Enrollment, Lesson, LessonProgress, Module, QuizAttempt, TeachingResource, Unit, User, STAFF_ROLES, COURSE_LEVELS, LESSON_TYPES, RESOURCE_TYPES, type CourseDoc, type LessonDoc, type ModuleDoc, type UnitDoc } from "@/models";
import { AdminError } from "./errors";
import { normalizeRich } from "@/lib/rich-text";
import { adoptOrphanLessons } from "./unit-migration";

export { adoptOrphanLessons };

/* Course content editing (framework-free; permission checks happen in the actions). */

const oid = (id: string) => {
  if (!Types.ObjectId.isValid(id)) throw new AdminError("Identifiant invalide.");
  return new Types.ObjectId(id);
};
const date = (v?: string | null) => (v ? new Date(`${v}T00:00:00`) : null);

/** « 30 000 » / « 30.000 » / « 30000 FCFA » → 30000; empty → null. */
export function parsePrice(v?: string | null): number | null {
  const raw = (v ?? "").replace(/fcfa|f\s*cfa|xof/gi, "").replace(/[\s.\u00a0\u202f]/g, "");
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) throw new AdminError("Prix invalide : indiquez un montant en FCFA, par exemple 30000.");
  return Number(raw);
}

// ── Courses ────────────────────────────────────────────────────────────────

export type CourseInput = {
  title: string;
  description?: string;
  imageUrl?: string;
  program?: string;
  level?: string;
  startDate?: string | null;
  endDate?: string | null;
  /** FCFA, as typed (« 30 000 », « 30000 »); empty = not set. */
  price?: string;
};
export type CourseSettings = { isPublished?: boolean; isChallenge?: boolean; themeLabel?: string };

export async function createCourse(input: CourseInput): Promise<CourseDoc> {
  const c = await Course.create({
    title: input.title.trim(),
    description: normalizeRich(input.description),
    imageUrl: input.imageUrl ?? "",
    program: input.program ?? "",
    level: (COURSE_LEVELS.includes(input.level as never) ? input.level : "beginner") as CourseDoc["level"],
    startDate: date(input.startDate),
    endDate: date(input.endDate),
    price: parsePrice(input.price),
  });
  return c.toObject() as CourseDoc;
}

export async function updateCourse(courseId: string, input: CourseInput, settings?: CourseSettings) {
  const c = await Course.findById(oid(courseId));
  if (!c) throw new AdminError("Cours introuvable.");
  c.title = input.title.trim();
  c.description = normalizeRich(input.description);
  c.imageUrl = input.imageUrl?.trim() ?? "";
  c.program = input.program ?? "";
  if (COURSE_LEVELS.includes(input.level as never)) c.level = input.level as CourseDoc["level"];
  c.startDate = date(input.startDate);
  c.endDate = date(input.endDate);
  if (input.price !== undefined) c.price = parsePrice(input.price);
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
    Unit.deleteMany({ courseId: id }),
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
  // Every module starts with one unit, so lessons can be added straight away.
  await Unit.create({ courseId: id, moduleId: m._id, title: "Unité 1", order: 1 });
  return m.toObject() as ModuleDoc;
}

export async function updateModule(moduleId: string, data: { title: string; summary?: string; description?: string; isCheckpointRequired?: boolean }) {
  const m = await Module.findById(oid(moduleId));
  if (!m) throw new AdminError("Module introuvable.");
  m.title = data.title.trim();
  m.summary = data.summary?.trim() ?? "";
  if (data.description !== undefined) m.description = normalizeRich(data.description);
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
  const lessonIds = (await Lesson.find({ moduleId: id }).select("_id").lean()).map((l) => l._id);
  await Promise.all([
    Lesson.deleteMany({ moduleId: id }),
    LessonProgress.deleteMany({ lessonId: { $in: lessonIds } }),
    Unit.deleteMany({ moduleId: id }),
    TeachingResource.deleteMany({ moduleId: id }),
  ]);
  await Module.deleteOne({ _id: id });
}

// ── Units ──────────────────────────────────────────────────────────────────

export async function createUnit(moduleId: string, title: string, objective = ""): Promise<UnitDoc> {
  const m = await Module.findById(oid(moduleId)).select("courseId").lean();
  if (!m) throw new AdminError("Module introuvable.");
  if (!title.trim()) throw new AdminError("Donnez un titre à l'unité.");
  const last = await Unit.findOne({ moduleId: m._id }).sort({ order: -1 }).select("order").lean();
  const u = await Unit.create({ courseId: m.courseId, moduleId: m._id, title: title.trim(), objective: objective.trim(), order: (last?.order ?? 0) + 1 });
  return u.toObject() as UnitDoc;
}

export async function updateUnit(unitId: string, data: { title: string; objective?: string }) {
  const u = await Unit.findById(oid(unitId));
  if (!u) throw new AdminError("Unité introuvable.");
  if (!data.title.trim()) throw new AdminError("Donnez un titre à l'unité.");
  u.title = data.title.trim();
  u.objective = data.objective?.trim() ?? "";
  await u.save();
}

export type UnitChallengeInput = { title?: string; instructions?: string; maxSeconds?: number; prepSeconds?: number };

/** Speaking challenge closing the unit. Empty instructions = no challenge. */
export async function saveUnitChallenge(unitId: string, c: UnitChallengeInput) {
  const u = await Unit.findById(oid(unitId));
  if (!u) throw new AdminError("Unité introuvable.");
  const clamp = (v: unknown, min: number, max: number, dflt: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : dflt;
  };
  u.set("challenge", {
    title: c.title?.trim() ?? "",
    instructions: normalizeRich(c.instructions),
    maxSeconds: clamp(c.maxSeconds, 15, 300, 60),
    prepSeconds: clamp(c.prepSeconds, 0, 120, 0),
  });
  await u.save();
}

export async function moveUnit(unitId: string, dir: "up" | "down") {
  const u = await Unit.findById(oid(unitId)).lean();
  if (!u) return;
  const siblings = await Unit.find({ moduleId: u.moduleId }).sort({ order: 1, createdAt: 1 }).select("_id order").lean();
  await moveIn(siblings, unitId, dir, (id, order) => Unit.updateOne({ _id: id }, { order }));
}

/** Deletes the unit with its lessons (and the learners' progress on them). A module keeps at least one unit. */
export async function deleteUnit(unitId: string) {
  const u = await Unit.findById(oid(unitId)).lean();
  if (!u) return;
  if ((await Unit.countDocuments({ moduleId: u.moduleId })) <= 1) throw new AdminError("Un module garde au moins une unité : renommez-la plutôt.");
  const lessonIds = (await Lesson.find({ unitId: u._id }).select("_id").lean()).map((l) => l._id);
  await Promise.all([
    LessonProgress.deleteMany({ lessonId: { $in: lessonIds } }),
    Lesson.deleteMany({ unitId: u._id }),
    AssignmentSubmission.deleteMany({ unitId: u._id, assignmentType: "unit_challenge" }),
  ]);
  await Unit.deleteOne({ _id: u._id });
}

// ── Lessons ────────────────────────────────────────────────────────────────

/** New lesson at the end of a unit (`parentId` = unit id; a module id means its first unit). */
export async function createLesson(parentId: string, title: string, type: string): Promise<LessonDoc> {
  if (!LESSON_TYPES.includes(type as never)) throw new AdminError("Type d'activité inconnu.");
  const id = oid(parentId);
  let unit = await Unit.findById(id).lean<UnitDoc>();
  if (!unit && (await Module.exists({ _id: id }))) {
    await adoptOrphanLessons(parentId);
    unit = await Unit.findOne({ moduleId: id }).sort({ order: 1, createdAt: 1 }).lean<UnitDoc>();
    if (!unit) unit = await createUnit(parentId, "Unité 1");
  }
  if (!unit) throw new AdminError("Unité introuvable.");
  const last = await Lesson.findOne({ unitId: unit._id }).sort({ order: -1 }).select("order").lean();
  // New lessons start as drafts so learners never see an empty lesson.
  const l = await Lesson.create({ courseId: unit.courseId, moduleId: unit.moduleId, unitId: unit._id, title: title.trim(), type: type as LessonDoc["type"], order: (last?.order ?? 0) + 1, isPublished: false });
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
  if (!l) throw new AdminError("Activité introuvable.");
  l.title = data.title.trim();
  l.description = data.description ?? "";
  l.isPublished = !!data.isPublished;
  l.videoUrl = data.videoUrl?.trim() ?? "";
  l.durationMinutes = Math.max(0, Number(data.durationMinutes) || 0);
  l.content = normalizeRich(data.content);
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
  const siblings = await Lesson.find(l.unitId ? { unitId: l.unitId } : { moduleId: l.moduleId, unitId: null }).sort({ order: 1, createdAt: 1 }).select("_id order").lean();
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
    instructions: normalizeRich(a.instructions),
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
    "content.notes": normalizeRich(data.notes),
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
