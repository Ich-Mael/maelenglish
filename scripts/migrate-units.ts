/**
 * One-off migration to the Unit level (Course → Module → Unit → lessons):
 *   npm run migrate:units
 * For every module, lessons without a unit go into the module's first unit (« Unité 1 », created
 * when missing). Idempotent: running it again changes nothing. The admin module page does the same
 * thing for its own module, so running this script is optional (useful when there is a shell).
 */
import mongoose from "mongoose";
import { existsSync } from "node:fs";
import { Module, Unit } from "../src/models";
import { adoptOrphanLessons } from "../src/lib/admin/unit-migration";

for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f); // .env.local wins (no override)

const uri = process.env.APP_DB;
if (!uri) throw new Error("APP_DB manquant (.env.local).");
if (/afrohk/i.test(uri)) {
  console.error("Refus : APP_DB pointe vers la base AfroHK.");
  process.exit(1);
}

async function main() {
  await mongoose.connect(uri!);
  console.log(`Base : ${mongoose.connection.name}`);
  const modules = await Module.find().select("_id courseId").lean();
  let moved = 0;
  let created = 0;
  for (const m of modules) {
    moved += await adoptOrphanLessons(m._id);
    // Modules without any lesson still get their first unit, so staff can add lessons.
    if (!(await Unit.exists({ moduleId: m._id }))) {
      await Unit.create({ courseId: m.courseId, moduleId: m._id, title: "Unité 1", order: 1 });
      created++;
    }
  }
  const units = await Unit.countDocuments();
  console.log(`${modules.length} module(s) · ${moved} leçon(s) rangée(s) · ${created} unité(s) vide(s) créée(s) · ${units} unité(s) au total.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
