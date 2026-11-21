import { Types } from "mongoose";
import { Activity, ChallengeSubmission, LabAttempt, LabMistake, Step, StepProgress, Unit, type ActivityDoc, type StepDoc, type UnitDoc } from "@/models";
import { ACTIVITY_INFO, isActivityType } from "@/lib/lab/types";
import { cleanLessonContent } from "@/lib/course/lesson-content";
import { DEFAULT_PASS_SCORE } from "@/lib/course/types";
import { checkUnit } from "@/lib/course/unit-check";
import { normalizeRich } from "@/lib/rich-text";
import { AdminError } from "./errors";

/*
 * Unit steps (owner spec COURSE_STRUCTURE.md): framework-free, permission checks happen in the
 * actions. Positions are always 1…n without gaps (`renumber`). New lessons and activities go
 * before the speaking challenge, which stays last. Staff save freely: the unit rules are shown
 * (unitProblems) and an invalid unit is simply hidden from learners.
 */

const oid = (id: string, what = "Step") => {
  if (!Types.ObjectId.isValid(id)) throw new AdminError(`${what} not found.`);
  return new Types.ObjectId(id);
};

async function unitOf(unitId: string): Promise<UnitDoc> {
  const u = await Unit.findById(oid(unitId, "Unit")).lean<UnitDoc>();
  if (!u) throw new AdminError("Unit not found.");
  return u;
}

export async function stepsOf(unitId: string | Types.ObjectId): Promise<StepDoc[]> {
  return Step.find({ unitId }).sort({ position: 1, createdAt: 1 }).lean<StepDoc[]>();
}

/** Positions back to 1…n in the given order (default: current order), the challenge last. */
async function renumber(unitId: Types.ObjectId, order?: string[]) {
  const steps = await stepsOf(unitId);
  const rank = (s: StepDoc) => (order ? order.indexOf(String(s._id)) : -1);
  const sorted = order ? [...steps].sort((a, b) => (rank(a) < 0 ? 1e6 : rank(a)) - (rank(b) < 0 ? 1e6 : rank(b))) : steps;
  await Promise.all(sorted.map((s, i) => (s.position === i + 1 ? null : Step.updateOne({ _id: s._id }, { position: i + 1 }))));
}

/** Where a new lesson / activity goes: before the challenge if there is one, else at the end. */
async function insertPosition(unitId: Types.ObjectId): Promise<number> {
  const steps = await stepsOf(unitId);
  const challenge = steps.find((s) => s.kind === "challenge");
  if (challenge) {
    await Step.updateMany({ unitId, position: { $gte: challenge.position } }, { $inc: { position: 1 } });
    return challenge.position;
  }
  return steps.length + 1;
}

/** The unit's rule problems (empty = learners see the unit). */
export async function unitProblems(unitId: string | Types.ObjectId) {
  const steps = await stepsOf(unitId);
  const ids = steps.flatMap((s) => (s.activityId ? [s.activityId] : []));
  const ready = ids.length ? await Activity.find({ _id: { $in: ids }, status: "ready" }).select("_id").lean() : [];
  return checkUnit(steps, new Set(ready.map((a) => String(a._id))));
}

// ── Create ─────────────────────────────────────────────────────────────────

export async function addLesson(unitId: string, title: string): Promise<StepDoc> {
  const u = await unitOf(unitId);
  if (!title.trim()) throw new AdminError("Give the lesson a title.");
  const position = await insertPosition(u._id);
  const s = await Step.create({ courseId: u.courseId, moduleId: u.moduleId, unitId: u._id, position, kind: "lesson", title: title.trim(), content: cleanLessonContent({}) });
  return s.toObject() as StepDoc;
}

/**
 * Adds a Lab activity to a unit. A challenge type becomes (or replaces) the unit's speaking
 * challenge, the last step. Any other type becomes an activity step before the challenge,
 * practising `lessonId` (default: the last lesson of the unit). Drafts can be added.
 */
export async function attachActivity(activityId: string, unitId: string, lessonId?: string | null): Promise<"challenge" | "activity"> {
  const [a, u] = await Promise.all([Activity.findById(oid(activityId, "Activity")).lean<ActivityDoc>(), unitOf(unitId)]);
  if (!a || !isActivityType(a.type)) throw new AdminError("Activity not found.");
  if (ACTIVITY_INFO[a.type].role === "challenge") {
    const existing = await Step.findOne({ unitId: u._id, kind: "challenge" });
    if (existing) {
      existing.activityId = a._id;
      existing.title = a.title;
      await existing.save();
    } else {
      const n = await Step.countDocuments({ unitId: u._id });
      await Step.create({ courseId: u.courseId, moduleId: u.moduleId, unitId: u._id, position: n + 1, kind: "challenge", title: a.title, activityId: a._id, estimatedMinutes: a.durationMin ?? 0 });
    }
    return "challenge";
  }
  const steps = await stepsOf(u._id);
  let lesson = lessonId ? steps.find((s) => String(s._id) === lessonId && s.kind === "lesson") : undefined;
  if (lessonId && !lesson) throw new AdminError("That lesson isn't in this unit.");
  lesson ??= steps.filter((s) => s.kind === "lesson").at(-1);
  const position = await insertPosition(u._id);
  await Step.create({
    courseId: u.courseId,
    moduleId: u.moduleId,
    unitId: u._id,
    position,
    kind: "activity",
    title: a.title,
    activityId: a._id,
    lessonId: lesson?._id ?? null,
    passScore: DEFAULT_PASS_SCORE,
    estimatedMinutes: a.durationMin ?? 0,
  });
  return "activity";
}

// ── Edit ───────────────────────────────────────────────────────────────────

export async function updateLesson(stepId: string, data: { title: string; estimatedMinutes?: number; content: unknown }) {
  const s = await Step.findOne({ _id: oid(stepId), kind: "lesson" });
  if (!s) throw new AdminError("Lesson not found.");
  if (!data.title.trim()) throw new AdminError("Give the lesson a title.");
  const content = cleanLessonContent(data.content);
  content.intro = normalizeRich(content.intro);
  s.title = data.title.trim();
  s.estimatedMinutes = Math.max(0, Math.round(Number(data.estimatedMinutes) || 0));
  s.set("content", content);
  s.markModified("content");
  await s.save();
}

/** Activity step settings: the lesson it practises (a lesson of the same unit), pass score, minutes. */
export async function updateActivityStep(stepId: string, data: { lessonId?: string | null; passScore?: number; estimatedMinutes?: number }) {
  const s = await Step.findOne({ _id: oid(stepId), kind: "activity" });
  if (!s) throw new AdminError("Activity step not found.");
  if (data.lessonId !== undefined) {
    if (data.lessonId && !(await Step.exists({ _id: oid(data.lessonId, "Lesson"), unitId: s.unitId, kind: "lesson" }))) throw new AdminError("That lesson isn't in this unit.");
    s.lessonId = data.lessonId ? new Types.ObjectId(data.lessonId) : null;
  }
  if (data.passScore !== undefined) s.passScore = Math.max(0, Math.min(100, Math.round(Number(data.passScore) || 0)));
  if (data.estimatedMinutes !== undefined) s.estimatedMinutes = Math.max(0, Math.round(Number(data.estimatedMinutes) || 0));
  await s.save();
}

/** New order of a unit's steps (all its step ids). The rules are checked afterwards, not here. */
export async function reorderSteps(unitId: string, orderedIds: string[]) {
  const u = await unitOf(unitId);
  const steps = await stepsOf(u._id);
  const known = new Set(steps.map((s) => String(s._id)));
  if (orderedIds.length !== steps.length || !orderedIds.every((id) => known.has(id))) throw new AdminError("The unit changed meanwhile: reload the page.");
  await renumber(u._id, orderedIds);
}

export async function moveStep(stepId: string, dir: "up" | "down") {
  const s = await Step.findById(oid(stepId)).lean<StepDoc>();
  if (!s) return;
  const ids = (await stepsOf(s.unitId)).map((x) => String(x._id));
  const i = ids.indexOf(stepId);
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await renumber(s.unitId, ids);
}

/**
 * Deletes a step with the learners' progress on it. Activities practising a deleted lesson keep
 * their place without a lesson (the unit shows the problem until staff pick another one).
 */
export async function deleteStep(stepId: string) {
  const s = await Step.findById(oid(stepId)).lean<StepDoc>();
  if (!s) return;
  await Promise.all([
    StepProgress.deleteMany({ stepId: s._id }),
    LabAttempt.deleteMany({ stepId: s._id }),
    LabMistake.deleteMany({ stepId: s._id }),
    s.kind === "challenge" ? ChallengeSubmission.deleteMany({ stepId: s._id }) : null,
    s.kind === "lesson" ? Step.updateMany({ lessonId: s._id }, { lessonId: null }) : null,
  ]);
  await Step.deleteOne({ _id: s._id });
  await renumber(s.unitId);
}

/** Every step of a unit (unit deletion). */
export async function deleteUnitSteps(unitIds: Types.ObjectId[]) {
  const stepIds = (await Step.find({ unitId: { $in: unitIds } }).select("_id").lean()).map((s) => s._id);
  await Promise.all([
    StepProgress.deleteMany({ stepId: { $in: stepIds } }),
    LabAttempt.deleteMany({ stepId: { $in: stepIds } }),
    LabMistake.deleteMany({ stepId: { $in: stepIds } }),
    ChallengeSubmission.deleteMany({ unitId: { $in: unitIds } }),
    Step.deleteMany({ unitId: { $in: unitIds } }),
  ]);
}
