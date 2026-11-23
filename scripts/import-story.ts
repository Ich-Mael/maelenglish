/**
 * Imports a Story Mode season file (the admin's « Import JSON » format):
 *   npm run story:import -- scripts/seed/story-s1-accra.json [--replace]
 * New seasons arrive as drafts (publish them in Admin → Story Mode). `--replace` updates an existing
 * season with the same slug (episodes upserted by id; learner progress kept).
 */
import mongoose from "mongoose";
import { existsSync, readFileSync } from "node:fs";
import { importSeason } from "../src/lib/story/admin";

for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f);

const uri = process.env.APP_DB;
if (!uri) throw new Error("APP_DB missing (.env.local).");
if (/afrohk/i.test(uri)) {
  console.error("Refused: APP_DB points to the AfroHK database.");
  process.exit(1);
}
// A trailing « . » (copied from a sentence) is ignored.
const file = process.argv.slice(2).find((a) => !a.startsWith("--"))?.replace(/\.$/, "");
if (!file || !existsSync(file)) {
  console.error("Usage: npm run story:import -- <season.json> [--replace]");
  process.exit(1);
}

async function main() {
  await mongoose.connect(uri!);
  try {
    const r = await importSeason(JSON.parse(readFileSync(file!, "utf8")), { replace: process.argv.includes("--replace") });
    console.log(`✓ Season imported (${r.episodes} episodes) as a draft: /admin/story/${r.id}`);
  } catch (e) {
    console.error(`✖ ${(e as Error).message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void main();
