/**
 * One-off migration: add expiry to existing Kalan premium access.
 *
 * Converts the legacy bare-ObjectId entries in `subjects.premiumStudents` and
 * `classes.naabaStudents` into the new subdoc shape
 *   { student: ObjectId, grantedAt: Date, expiresAt: Date }
 * Existing (legacy) grants are set to expire ONE YEAR from when this runs.
 *
 * Runs via the raw collections (bypassing the schema, which can't cast the old
 * arrays). Idempotent: entries already in subdoc form are left untouched.
 *
 * Run (uses the same APP_DB as the app):
 *   node scripts/add-premium-expiry.js
 *   APP_DB="<uri>" NODE_ENV=production node scripts/add-premium-expiry.js
 */
if (process.env.NODE_ENV !== "production") require("dotenv").config();

const mongoose = require("mongoose");

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function convertList(arr, now, expiresAt) {
  if (!Array.isArray(arr) || arr.length === 0) return { changed: false, value: arr || [] };
  let changed = false;
  const value = arr.map((e) => {
    if (e && typeof e === "object" && e.student) return e; // already migrated
    changed = true;
    return { student: e, grantedAt: now, expiresAt };
  });
  return { changed, value };
}

async function migrateCollection(coll, field, now, expiresAt) {
  const docs = await coll.find({ [field]: { $exists: true, $ne: [] } }).toArray();
  let updated = 0;
  for (const doc of docs) {
    const { changed, value } = convertList(doc[field], now, expiresAt);
    if (changed) {
      await coll.updateOne({ _id: doc._id }, { $set: { [field]: value } });
      updated++;
    }
  }
  return { scanned: docs.length, updated };
}

(async () => {
  const dbUrl = process.env.APP_DB;
  if (!dbUrl) {
    console.error("❌ APP_DB n'est pas défini. Exportez-le puis relancez.");
    process.exit(1);
  }

  await mongoose.connect(dbUrl);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ONE_YEAR_MS);
  console.log(`Les accès existants expireront le ${expiresAt.toLocaleDateString("fr-FR")}.`);

  const subjects = mongoose.connection.collection("subjects");
  const classes = mongoose.connection.collection("classes");

  const s = await migrateCollection(subjects, "premiumStudents", now, expiresAt);
  console.log(`✅ subjects.premiumStudents : ${s.updated} mis à jour (sur ${s.scanned} avec accès).`);

  const c = await migrateCollection(classes, "naabaStudents", now, expiresAt);
  console.log(`✅ classes.naabaStudents : ${c.updated} mis à jour (sur ${c.scanned} avec accès).`);

  await mongoose.disconnect();
  console.log("Terminé. (Idempotent — relançable sans risque.)");
  process.exit(0);
})().catch((err) => {
  console.error("Erreur:", err.message);
  process.exit(1);
});
