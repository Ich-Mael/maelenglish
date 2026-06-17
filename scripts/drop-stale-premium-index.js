/**
 * One-off migration for Kalan Naaba.
 *
 * Drops the legacy unique index `studentId_1_subjectId_1_status_1` on the
 * `premiumrequests` collection. It conflicts with the new kind-scoped indexes
 * (IndexOptionsConflict) and would also make two pending CLASS requests collide
 * on a null subjectId. After dropping it, restart the app — Mongoose recreates
 * the two new partial indexes automatically.
 *
 * Run (uses the same APP_DB as the app):
 *   node scripts/drop-stale-premium-index.js
 * For a production/Atlas DB, pass the URI explicitly, e.g.:
 *   APP_DB="<your-mongodb-uri>" NODE_ENV=production node scripts/drop-stale-premium-index.js
 *
 * Safe to run more than once (no-op if the index is already gone).
 */
if (process.env.NODE_ENV !== "production") require("dotenv").config();

const mongoose = require("mongoose");

const COLLECTION = "premiumrequests";
const INDEX_NAME = "studentId_1_subjectId_1_status_1";

(async () => {
  const dbUrl = process.env.APP_DB;
  if (!dbUrl) {
    console.error("❌ APP_DB n'est pas défini. Exportez-le (la même URI que l'app) puis relancez.");
    process.exit(1);
  }

  await mongoose.connect(dbUrl);
  const coll = mongoose.connection.collection(COLLECTION);

  const indexes = await coll.indexes();
  console.log("Index actuels:", indexes.map((i) => i.name).join(", "));

  if (indexes.some((i) => i.name === INDEX_NAME)) {
    await coll.dropIndex(INDEX_NAME);
    console.log(`✅ Index "${INDEX_NAME}" supprimé.`);
  } else {
    console.log(`ℹ️  Index "${INDEX_NAME}" introuvable — rien à faire (déjà supprimé ?).`);
  }

  await mongoose.disconnect();
  console.log("Terminé. Redémarrez l'app pour recréer les nouveaux index Kalan Naaba.");
  process.exit(0);
})().catch((err) => {
  console.error("Erreur:", err.message);
  process.exit(1);
});
