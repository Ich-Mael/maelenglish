import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/*
 * Object storage for audio (DECISIONS.md: Cloudflare R2, S3-compatible).
 * - « s3 » driver when STORAGE_ENDPOINT / STORAGE_BUCKET / STORAGE_ACCESS_KEY_ID /
 *   STORAGE_SECRET_ACCESS_KEY are set: browsers upload straight to the bucket with a presigned
 *   PUT (the bucket's CORS must allow PUT from APP_URL), files are read with short-lived signed GETs.
 * - « local » driver otherwise, development and tests only (refused in production unless
 *   STORAGE_DRIVER=local is set to test a production build on a laptop): files in
 *   `.uploads/`, served by /api/media/local with HMAC-signed, expiring URLs.
 * Access control happens before a URL is issued (`canReadMedia`); URLs expire within minutes.
 */

const UPLOAD_TTL_S = 15 * 60;
export const READ_TTL_S = 30 * 60;

type Driver = "s3" | "local";

export function storageDriver(): Driver {
  const e = process.env;
  if (e.STORAGE_ENDPOINT && e.STORAGE_BUCKET && e.STORAGE_ACCESS_KEY_ID && e.STORAGE_SECRET_ACCESS_KEY) return "s3";
  // STORAGE_DRIVER=local: explicit opt-in to test a production build locally (never on Render).
  if (process.env.NODE_ENV === "production" && process.env.STORAGE_DRIVER !== "local") throw new Error("Stockage non configuré : définissez STORAGE_ENDPOINT, STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID et STORAGE_SECRET_ACCESS_KEY.");
  return "local";
}

export const isStorageConfigured = () => {
  const e = process.env;
  return Boolean(e.STORAGE_ENDPOINT && e.STORAGE_BUCKET && e.STORAGE_ACCESS_KEY_ID && e.STORAGE_SECRET_ACCESS_KEY);
};

// ── s3 driver ─────────────────────────────────────────────────────────────
let client: S3Client | null = null;
function s3(): S3Client {
  client ??= new S3Client({
    region: process.env.STORAGE_REGION || "auto",
    endpoint: process.env.STORAGE_ENDPOINT,
    credentials: { accessKeyId: process.env.STORAGE_ACCESS_KEY_ID!, secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY! },
  });
  return client;
}
const bucket = () => process.env.STORAGE_BUCKET!;

// ── local driver ──────────────────────────────────────────────────────────
const LOCAL_ROOT = path.join(process.cwd(), ".uploads");
const localSecret = () => process.env.MEDIA_LOCAL_SECRET || process.env.APP_DB || "dev-media-secret";

/** Storage keys look like `recording/2026-11/<id>.webm` — no `..`, no leading slash. */
export function isSafeKey(key: string): boolean {
  // Optional top folder (keys made before the students_audio / courses_audios layout have none).
  return /^(?:(?:students_audio|courses_audios|profile_photos)\/)?[a-z-]+\/\d{4}-\d{2}\/[a-f0-9]{24}\.[a-z0-9]{2,5}$/.test(key);
}
function localPath(key: string) {
  if (!isSafeKey(key)) throw new Error("Clé de fichier invalide.");
  return path.join(LOCAL_ROOT, key);
}
function sign(op: "put" | "get", key: string, exp: number) {
  return createHmac("sha256", localSecret()).update(`${op}:${key}:${exp}`).digest("base64url");
}
export function verifyLocalSignature(op: "put" | "get", key: string, exp: number, sig: string): boolean {
  if (!isSafeKey(key) || !Number.isFinite(exp) || exp < Date.now() / 1000) return false;
  const a = Buffer.from(sign(op, key, exp));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}
function localUrl(op: "put" | "get", key: string, ttl: number) {
  const exp = Math.floor(Date.now() / 1000) + ttl;
  return `/api/media/local?op=${op}&key=${encodeURIComponent(key)}&exp=${exp}&sig=${sign(op, key, exp)}`;
}
export async function writeLocal(key: string, data: Uint8Array) {
  const p = localPath(key);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, data);
}
export const readLocal = (key: string) => readFile(localPath(key));

// ── public API ────────────────────────────────────────────────────────────
/** URL the browser PUTs the file to (with header Content-Type: `mime`). */
export async function presignUpload(key: string, mime: string): Promise<string> {
  if (storageDriver() === "local") return localUrl("put", key, UPLOAD_TTL_S);
  return getSignedUrl(s3(), new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: mime }), { expiresIn: UPLOAD_TTL_S });
}

/** Short-lived URL to play / download a file. Check access (`canReadMedia`) before calling. */
export async function signedReadUrl(key: string, ttl = READ_TTL_S): Promise<string> {
  if (storageDriver() === "local") return localUrl("get", key, ttl);
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn: ttl });
}

/** Size of a stored file, or null when it doesn't exist (upload confirmation). */
export async function objectSize(key: string): Promise<number | null> {
  try {
    if (storageDriver() === "local") return (await stat(localPath(key))).size;
    const r = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return r.ContentLength ?? 0;
  } catch {
    return null;
  }
}

/** Server-side upload (e.g. generated TTS audio). */
export async function putObject(key: string, data: Uint8Array, mime: string) {
  if (storageDriver() === "local") return writeLocal(key, data);
  await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: data, ContentType: mime }));
}

/** Server-side read (e.g. send a recording to a speech provider). */
export async function getObject(key: string): Promise<Uint8Array> {
  if (storageDriver() === "local") return new Uint8Array(await readLocal(key));
  const r = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  return r.Body!.transformToByteArray();
}

export async function deleteObject(key: string) {
  if (storageDriver() === "local") return unlink(localPath(key)).catch(() => {});
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
