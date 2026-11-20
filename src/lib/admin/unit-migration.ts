import { Types } from "mongoose";
import { Lesson, Module, Unit, type UnitDoc } from "@/models";

/**
 * Lessons created before units existed have no `unitId`: put them, in their current order,
 * into the module's first unit (created as « Unité 1 » when the module has none). Idempotent.
 * Runs when staff open the module page, and for every module in `scripts/migrate-units.ts`.
 * (No server-only imports, so the script can use it.)
 */
export async function adoptOrphanLessons(moduleId: string | Types.ObjectId): Promise<number> {
  if (!Types.ObjectId.isValid(moduleId)) return 0;
  const m = await Module.findById(moduleId).select("courseId").lean();
  if (!m) return 0;
  const orphans = await Lesson.find({ moduleId: m._id, unitId: null }).sort({ order: 1, createdAt: 1 }).select("_id").lean();
  if (!orphans.length) return 0;
  let unit = await Unit.findOne({ moduleId: m._id }).sort({ order: 1, createdAt: 1 }).lean<UnitDoc>();
  unit ??= (await Unit.create({ courseId: m.courseId, moduleId: m._id, title: "Unité 1", order: 1 })).toObject() as UnitDoc;
  const unitId = unit._id;
  // Orphans go after the lessons already in that unit.
  const last = await Lesson.findOne({ unitId }).sort({ order: -1 }).select("order").lean();
  const start = last?.order ?? 0;
  await Promise.all(orphans.map((l, i) => Lesson.updateOne({ _id: l._id, unitId: null }, { unitId, order: start + i + 1 })));
  return orphans.length;
}
