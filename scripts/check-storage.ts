/**
 * Checks the file storage settings end to end (Cloudflare R2 / S3 API):
 *   npm run check:storage            (reads .env.local, then .env)
 *   npm run check:storage -- https://maelenglish.com   (origin to test CORS for; default APP_URL)
 * 1. the four STORAGE_* variables are set (names only — values are never printed);
 * 2. the server can write, read and delete a test object;
 * 3. a browser on the origin may PUT to a presigned URL (CORS preflight), as the recorder does.
 */
import { existsSync } from "node:fs";
import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f);

const NAMES = ["STORAGE_ENDPOINT", "STORAGE_BUCKET", "STORAGE_ACCESS_KEY_ID", "STORAGE_SECRET_ACCESS_KEY"] as const;
const ok = (m: string) => console.log(`✓ ${m}`);
const bad = (m: string) => {
  console.log(`✗ ${m}`);
  process.exitCode = 1;
};

async function main() {
  const missing = NAMES.filter((n) => !process.env[n]);
  if (missing.length) {
    bad(`Missing: ${missing.join(", ")}`);
    const r2 = Object.keys(process.env).filter((k) => /^R2_/i.test(k));
    if (r2.length) console.log(`  Found ${r2.join(", ")}: the app only reads the STORAGE_* names above — rename them.`);
    return;
  }
  ok("STORAGE_* variables are set");
  const endpoint = process.env.STORAGE_ENDPOINT!;
  if (!/^https:\/\/[a-f0-9]{32}\.(eu\.)?r2\.cloudflarestorage\.com\/?$/.test(endpoint)) console.log("  ! STORAGE_ENDPOINT doesn't look like https://<account-id>.r2.cloudflarestorage.com (no bucket name, no path).");
  const bucket = process.env.STORAGE_BUCKET!;
  const s3 = new S3Client({ region: process.env.STORAGE_REGION || "auto", endpoint, credentials: { accessKeyId: process.env.STORAGE_ACCESS_KEY_ID!, secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY! } });
  const key = `students_audio/_check/${Date.now()}.txt`;

  try {
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: "check", ContentType: "text/plain" }));
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    ok(`Server write / read / delete in bucket « ${bucket} »`);
  } catch (e) {
    const err = e as { name?: string; message?: string };
    bad(`Server access failed: ${err.name ?? ""} ${err.message ?? ""}`.trim());
    console.log("  Check the bucket name, the endpoint and that the R2 API token has « Object Read & Write » on this bucket.");
    return;
  }

  const origin = (process.argv[2] || process.env.APP_URL || "").replace(/\/$/, "");
  if (!origin) return console.log("  (no origin to test CORS: pass one, e.g. npm run check:storage -- https://maelenglish.com)");
  const url = await getSignedUrl(s3, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: "audio/webm" }), { expiresIn: 300 });
  const pre = await fetch(url, { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "content-type" } });
  const allowed = pre.headers.get("access-control-allow-origin");
  if (pre.ok && (allowed === origin || allowed === "*")) ok(`CORS allows PUT from ${origin}`);
  else {
    bad(`CORS refuses PUT from ${origin} (HTTP ${pre.status}, allow-origin: ${allowed ?? "none"})`);
    console.log('  In Cloudflare → R2 → bucket → Settings → CORS policy, add:\n  [{ "AllowedOrigins": ["' + origin + '"], "AllowedMethods": ["GET", "PUT"], "AllowedHeaders": ["*"], "MaxAgeSeconds": 3600 }]');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
