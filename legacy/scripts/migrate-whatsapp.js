/**
 * One-off migration for WhatsApp notifications ("email or phone" accounts).
 *
 * 1. Removes empty-string emails ("" would collide in the unique index).
 * 2. Replaces the unique `email_1` index by a unique + sparse one (several accounts may have no email).
 * 3. Fills `phoneE164` (normalised WhatsApp number) for existing accounts that have a phoneNumber.
 *
 * Run (same APP_DB as the app):
 *   npm run migrate:whatsapp
 * Production / Atlas:
 *   APP_DB="<your-mongodb-uri>" NODE_ENV=production node scripts/migrate-whatsapp.js
 *
 * Safe to run more than once.
 */
if (process.env.NODE_ENV !== "production") require("dotenv").config();

const mongoose = require("mongoose");
const { normalizePhone } = require("../shared/utilities/phone");

(async () => {
  const dbUrl = process.env.APP_DB;
  if (!dbUrl) {
    console.error("❌ APP_DB n'est pas défini. Exportez-le (la même URI que l'app) puis relancez.");
    process.exit(1);
  }
  await mongoose.connect(dbUrl);
  const users = mongoose.connection.collection("users");

  const emptied = await users.updateMany({ email: "" }, { $unset: { email: "" } });
  console.log(`• emails vides supprimés : ${emptied.modifiedCount}`);

  const indexes = await users.indexes();
  const emailIdx = indexes.find((i) => i.key && i.key.email === 1 && Object.keys(i.key).length === 1);
  if (emailIdx && !emailIdx.sparse) {
    await users.dropIndex(emailIdx.name);
    console.log(`• ancien index ${emailIdx.name} supprimé`);
  }
  if (!emailIdx || !emailIdx.sparse) {
    await users.createIndex({ email: 1 }, { unique: true, sparse: true, name: "email_1" });
    console.log("• index email_1 recréé (unique + sparse)");
  } else console.log("• index email_1 déjà unique + sparse");
  await users.createIndex({ phoneE164: 1 }, { name: "phoneE164_1" });

  let filled = 0, invalid = 0;
  const cursor = users.find({ phoneNumber: { $exists: true, $nin: [null, ""] } }, { projection: { phoneNumber: 1, phoneE164: 1 } });
  for await (const u of cursor) {
    const e164 = normalizePhone(u.phoneNumber);
    if (!e164) { invalid++; continue; }
    if (u.phoneE164 !== e164) { await users.updateOne({ _id: u._id }, { $set: { phoneE164: e164 } }); filled++; }
  }
  console.log(`• numéros WhatsApp normalisés : ${filled}${invalid ? ` (${invalid} numéro(s) illisible(s) laissé(s) tel(s) quel(s))` : ""}`);

  await mongoose.disconnect();
  console.log("✅ Migration terminée.");
})().catch((err) => {
  console.error("❌ Migration échouée :", err);
  process.exit(1);
});
