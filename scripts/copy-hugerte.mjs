// Copies the parts of HugeRTE the admin editor uses from node_modules to public/hugerte
// (served as static files and loaded only by the admin editor; gitignored).
// Runs before `next dev` / `next build` (predev / prebuild).
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "hugerte");
const out = join(root, "public", "hugerte");
if (!existsSync(src)) {
  console.error("hugerte is not installed (npm install).");
  process.exit(1);
}
const PARTS = [
  "hugerte.min.js",
  "license.txt",
  "models/dom",
  "themes/silver",
  "icons/default",
  "skins/ui/oxide",
  "skins/content/default",
  ...["lists", "link", "autolink", "table", "autoresize"].map((p) => `plugins/${p}`),
];
rmSync(out, { recursive: true, force: true });
for (const part of PARTS) {
  mkdirSync(dirname(join(out, part)), { recursive: true });
  cpSync(join(src, part), join(out, part), { recursive: true });
}
console.log(`HugeRTE copied to public/hugerte (${PARTS.length} parts).`);
