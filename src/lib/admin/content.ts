import { Types } from "mongoose";
import { Course, Enrollment, Module, QuizAttempt, TeachingResource, Unit, User, STAFF_ROLES, COURSE_LEVELS, RESOURCE_TYPES, type CourseDoc, type ModuleDoc, type UnitDoc } from "@/models";
import { CEFR_LEVELS } from "@/lib/lab/meta";
import { AdminError } from "./errors";
import { normalizeRich } from "@/lib/rich-text";
import { deleteUnitSteps } from "./steps";

/* Course content editing: courses, modules, units (steps: ./steps.ts). Framework-free; permission checks happen in the actions. */

const oid = (id: string) => {
  if (!Types.ObjectId.isValid(id)) throw new AdminError("Invalid ID.");
  return new Types.ObjectId(id);
};
const date = (v?: string | null) => (v ? new Date(`${v}T00:00:00`) : null);

/** « 30 000 » / « 30.000 » / « 30000 FCFA » → 30000; empty → null. */
export function parsePrice(v?: string | null): number | null {
  const raw = (v ?? "").replace(/fcfa|f\s*cfa|xof/gi, "").replace(/[\s.\u00a0\u202f]/g, "");
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) throw new AdminError("Invalid price: enter an amount in FCFA, e.g. 30000.");
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
  if (!c) throw new AdminError("Course not found.");
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
  if (await Enrollment.exists({ courseId: id })) throw new AdminError("Learners are enrolled: unpublish the course instead of deleting it.");
  const unitIds = (await Unit.find({ courseId: id }).select("_id").lean()).map((u) => u._id);
  await deleteUnitSteps(unitIds);
  await Promise.all([Module.deleteMany({ courseId: id }), Unit.deleteMany({ courseId: id }), TeachingResource.deleteMany({ courseId: id }), QuizAttempt.deleteMany({ courseId: id })]);
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
  // Every module starts with one unit, so steps can be added straight away.
  await Unit.create({ courseId: id, moduleId: m._id, title: "Unité 1", order: 1 });
  return m.toObject() as ModuleDoc;
}

export async function updateModule(moduleId: string, data: { title: string; summary?: string; description?: string; level?: string }) {
  const m = await Module.findById(oid(moduleId));
  if (!m) throw new AdminError("Module not found.");
  m.title = data.title.trim();
  m.summary = data.summary?.trim() ?? "";
  if (data.description !== undefined) m.description = normalizeRich(data.description);
  if (data.level !== undefined) m.level = (CEFR_LEVELS.includes(data.level as never) ? data.level : "") as ModuleDoc["level"];
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
  await deleteUnitSteps((await Unit.find({ moduleId: id }).select("_id").lean()).map((u) => u._id));
  await Promise.all([Unit.deleteMany({ moduleId: id }), TeachingResource.deleteMany({ moduleId: id })]);
  await Module.deleteOne({ _id: id });
}

// ── Units ──────────────────────────────────────────────────────────────────

/** One objective per line → list (empty lines dropped). */
const objectiveList = (v: string | string[] = []) => (Array.isArray(v) ? v : v.split("\n")).map((x) => x.trim()).filter(Boolean).slice(0, 8);

export async function createUnit(moduleId: string, title: string, objectives: string | string[] = []): Promise<UnitDoc> {
  const m = await Module.findById(oid(moduleId)).select("courseId").lean();
  if (!m) throw new AdminError("Module not found.");
  if (!title.trim()) throw new AdminError("Give the unit a title.");
  const last = await Unit.findOne({ moduleId: m._id }).sort({ order: -1 }).select("order").lean();
  const u = await Unit.create({ courseId: m.courseId, moduleId: m._id, title: title.trim(), objectives: objectiveList(objectives), order: (last?.order ?? 0) + 1 });
  return u.toObject() as UnitDoc;
}

export async function updateUnit(unitId: string, data: { title: string; objectives?: string | string[]; estimatedMinutes?: number }) {
  const u = await Unit.findById(oid(unitId));
  if (!u) throw new AdminError("Unit not found.");
  if (!data.title.trim()) throw new AdminError("Give the unit a title.");
  u.title = data.title.trim();
  if (data.objectives !== undefined) u.objectives = objectiveList(data.objectives);
  if (data.estimatedMinutes !== undefined) u.estimatedMinutes = Math.max(0, Math.round(Number(data.estimatedMinutes) || 0));
  await u.save();
}

export async function moveUnit(unitId: string, dir: "up" | "down") {
  const u = await Unit.findById(oid(unitId)).lean();
  if (!u) return;
  const siblings = await Unit.find({ moduleId: u.moduleId }).sort({ order: 1, createdAt: 1 }).select("_id order").lean();
  await moveIn(siblings, unitId, dir, (id, order) => Unit.updateOne({ _id: id }, { order }));
}

/** Deletes the unit with its steps (and the learners' progress on them). A module keeps at least one unit. */
export async function deleteUnit(unitId: string) {
  const u = await Unit.findById(oid(unitId)).lean();
  if (!u) return;
  if ((await Unit.countDocuments({ moduleId: u.moduleId })) <= 1) throw new AdminError("A module keeps at least one unit: rename it instead.");
  await deleteUnitSteps([u._id]);
  await Unit.deleteOne({ _id: u._id });
}

// ── Final exam ──────────────────────────────────────────────────

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

/** The course final exam (opens once every module is complete). */
export async function saveFinalExam(courseId: string, q: QuizInput) {
  const c = await Course.findById(oid(courseId));
  if (!c) throw new AdminError("Course not found.");
  c.set("finalExam", quizDoc(q));
  await c.save();
}

// ── Teaching resources (staff only) ────────────────────────────────────────

export type ResourceInput = { title: string; resourceType?: string; link?: string; notes?: string; isPublished?: boolean };

export async function saveResource(moduleId: string, actorId: string, data: ResourceInput, resourceId?: string) {
  const m = await Module.findById(oid(moduleId)).select("courseId").lean();
  if (!m) throw new AdminError("Module not found.");
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
