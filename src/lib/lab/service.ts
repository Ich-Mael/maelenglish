import { Types } from "mongoose";
import { Activity, Course, Module, Step, Unit, type ActivityDoc } from "@/models";
import { AdminError } from "@/lib/admin/errors";
import { isActivityType, type ActivityType } from "./types";
import { cleanContent, contentProblem } from "./content";
import { cleanMeta } from "./meta";

/* Labo service (framework-free; permission checks happen in the actions). Activities are reusable:
 * one activity can be placed in several units; editing it changes it everywhere. */

const oid = (id: string, what = "Activity") => {
  if (!Types.ObjectId.isValid(id)) throw new AdminError(`${what} not found.`);
  return new Types.ObjectId(id);
};

export type ActivityFilter = { type?: string; status?: string; q?: string; level?: string; skill?: string; theme?: string };

export async function listActivities(f: ActivityFilter = {}) {
  const filter: Record<string, unknown> = {};
  if (isActivityType(f.type)) filter.type = f.type;
  if (f.status === "draft" || f.status === "ready") filter.status = f.status;
  if (f.level) filter.level = f.level;
  if (f.skill) filter.skills = f.skill;
  if (f.theme) filter.theme = f.theme;
  if (f.q?.trim()) filter.title = { $regex: f.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  const items = await Activity.find(filter).sort({ updatedAt: -1 }).limit(200).lean<ActivityDoc[]>();
  const ids = items.map((a) => a._id);
  const placed = await Step.aggregate<{ _id: Types.ObjectId; n: number }>([{ $match: { activityId: { $in: ids } } }, { $group: { _id: "$activityId", n: { $sum: 1 } } }]);
  const uses = (id: Types.ObjectId) => placed.find((p) => p._id.equals(id))?.n ?? 0;
  return items.map((a) => ({ ...a, uses: uses(a._id) }));
}

export async function createActivity(type: string, title: string, actorId: string): Promise<ActivityDoc> {
  if (!isActivityType(type)) throw new AdminError("Unknown activity type.");
  if (!title.trim()) throw new AdminError("Give the activity a title.");
  const a = await Activity.create({ type, title: title.trim(), content: cleanContent(type, {}), createdBy: actorId, updatedBy: actorId });
  return a.toObject() as ActivityDoc;
}

export type ActivityInput = { title: string; level?: string; skills?: string[]; theme?: string; durationMin?: unknown; instructions?: string; maelTip?: string; tags?: string[]; ready?: boolean; content?: unknown };

/** Saves an activity. « Prête » requires complete content; the new title is copied to its placements. */
export async function updateActivity(activityId: string, data: ActivityInput, actorId: string) {
  const a = await Activity.findById(oid(activityId));
  if (!a) throw new AdminError("Activity not found.");
  const type = a.type as ActivityType;
  if (!data.title.trim()) throw new AdminError("Give the activity a title.");
  const content = data.content === undefined ? a.content : cleanContent(type, data.content);
  const problem = contentProblem(type, content);
  if (data.ready && problem) throw new AdminError(`${problem} (required to mark the activity as ready)`);
  const renamed = a.title !== data.title.trim();
  a.title = data.title.trim();
  const meta = cleanMeta(data);
  a.level = meta.level;
  a.set("skills", meta.skills);
  a.theme = meta.theme;
  a.durationMin = meta.durationMin;
  a.instructions = meta.instructions;
  a.maelTip = meta.maelTip;
  a.tags = [...new Set((data.tags ?? []).map((t) => t.trim()).filter(Boolean))].slice(0, 10);
  a.set("content", content);
  a.status = data.ready ? "ready" : "draft";
  a.updatedBy = new Types.ObjectId(actorId);
  a.markModified("content");
  await a.save();
  if (renamed) await Step.updateMany({ activityId: a._id }, { title: a.title });
}

export async function duplicateActivity(activityId: string, actorId: string): Promise<ActivityDoc> {
  const a = await Activity.findById(oid(activityId)).lean<ActivityDoc>();
  if (!a) throw new AdminError("Activity not found.");
  const copy = await Activity.create({ type: a.type, title: `${a.title} (copy)`, level: a.level, skills: a.skills, theme: a.theme, durationMin: a.durationMin, instructions: a.instructions, maelTip: a.maelTip, tags: a.tags, content: a.content, status: "draft", createdBy: actorId, updatedBy: actorId });
  return copy.toObject() as ActivityDoc;
}

/** Refused while the activity is used in a unit (remove it from its units first). */
export async function deleteActivity(activityId: string) {
  const id = oid(activityId);
  if (await Step.exists({ activityId: id })) {
    throw new AdminError("This activity is used in units: remove it from those units first.");
  }
  await Activity.deleteOne({ _id: id });
}

export type Usage = { kind: "practice" | "challenge"; stepId: string; unitId: string; unitTitle: string; moduleTitle: string; courseId: string; courseTitle: string };

/** Where an activity is used (activity steps and unit challenges). */
export async function usagesOf(activityId: string): Promise<Usage[]> {
  const steps = await Step.find({ activityId: oid(activityId) }).select("unitId moduleId courseId kind").lean();
  const [units, modules, courses] = await Promise.all([
    Unit.find({ _id: { $in: steps.map((s) => s.unitId) } }).select("title").lean(),
    Module.find({ _id: { $in: steps.map((s) => s.moduleId) } }).select("title").lean(),
    Course.find({ _id: { $in: steps.map((s) => s.courseId) } }).select("title").lean(),
  ]);
  return steps.map((s) => ({
    kind: s.kind === "challenge" ? ("challenge" as const) : ("practice" as const),
    stepId: String(s._id),
    unitId: String(s.unitId),
    unitTitle: units.find((u) => u._id.equals(s.unitId))?.title ?? "",
    moduleTitle: modules.find((m) => m._id.equals(s.moduleId))?.title ?? "",
    courseId: String(s.courseId),
    courseTitle: courses.find((c) => c._id.equals(s.courseId))?.title ?? "",
  }));
}

/** Adding to a unit and removing are step operations (src/lib/admin/steps.ts). */
export { attachActivity, deleteStep } from "@/lib/admin/steps";
