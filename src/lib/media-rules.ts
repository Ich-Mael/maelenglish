import type { MediaKind } from "@/models/Media";

/*
 * Upload rules (pure, tested in tests/media.test.ts): accepted formats, size limits, who may
 * upload which kind, storage key and visibility. Enforced by `requestUpload` (src/app/media-actions.ts).
 */

const AUDIO: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};
const VIDEO: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm" };
const IMAGE: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

const MB = 1024 * 1024;
export const MAX_BYTES: Record<MediaKind, number> = {
  recording: 10 * MB, // a 60 s take is ≈ 0.2 MB at 32 kbps
  "voice-note": 10 * MB,
  "model-audio": 10 * MB,
  clip: 30 * MB,
  instruction: 60 * MB, // short instruction video recorded by Mael
  avatar: 2 * MB, // resized to 320 px in the browser (≈ 20 KB)
  image: 3 * MB, // challenge prompt pictures, resized to 1600 px in the browser (≈ 150 KB)
};

/** Base type without parameters: "audio/webm;codecs=opus" → "audio/webm". */
export const baseMime = (mime: string) => mime.split(";")[0].trim().toLowerCase();

export function extensionFor(kind: MediaKind, mime: string): string | null {
  const m = baseMime(mime);
  if (kind === "avatar" || kind === "image") return IMAGE[m] ?? null;
  return AUDIO[m] ?? (kind === "instruction" ? VIDEO[m] : undefined) ?? null;
}

/** Learners upload their own recordings and profile photo; everything else is staff work. */
export function canUpload(kind: MediaKind, viewer: { isStaff: boolean }): boolean {
  return kind === "recording" || kind === "avatar" || viewer.isStaff;
}

/** Course content and profile photos are readable by any signed-in user; recordings and voice notes are private. */
export const visibilityFor = (kind: MediaKind): "private" | "public" => (kind === "recording" || kind === "voice-note" ? "private" : "public");

/**
 * Top-level bucket folder (owner's R2 layout): learners' audio (their recordings, coach voice
 * notes to them — private) vs course audio uploaded by staff (clips, model answers, instructions),
 * plus profile photos.
 */
export const MEDIA_FOLDER: Record<MediaKind, "students_audio" | "courses_audios" | "courses_images" | "profile_photos"> = {
  recording: "students_audio",
  "voice-note": "students_audio",
  clip: "courses_audios",
  "model-audio": "courses_audios",
  instruction: "courses_audios",
  avatar: "profile_photos",
  image: "courses_images",
};

/** `<folder>/<kind>/<yyyy-mm>/<id>.<ext>`, e.g. `students_audio/recording/2026-11/…webm`. Older files keep their stored key. */
export function storageKey(kind: MediaKind, id: string, ext: string, now = new Date()): string {
  return `${MEDIA_FOLDER[kind]}/${kind}/${now.toISOString().slice(0, 7)}/${id}.${ext}`;
}

/** Problem with an upload request, or null when it's fine. */
export function uploadProblem(kind: MediaKind, mime: string, size: number, viewer: { isStaff: boolean }): string | null {
  if (!canUpload(kind, viewer)) return "Envoi non autorisé.";
  if (!extensionFor(kind, mime)) return "Format de fichier non pris en charge.";
  if (!Number.isFinite(size) || size <= 0) return "Fichier vide.";
  if (size > MAX_BYTES[kind]) return `Fichier trop lourd (maximum ${Math.round(MAX_BYTES[kind] / MB)} Mo).`;
  return null;
}

/** Content type to serve for a stored key (local driver). */
export function mimeForKey(key: string): string {
  const ext = key.split(".").pop() ?? "";
  const all = { ...AUDIO, ...VIDEO, ...IMAGE };
  const hit = Object.entries(all).find(([, e]) => e === ext);
  if (ext === "webm" && /(^|\/)instruction\//.test(key)) return "video/webm";
  return hit?.[0] ?? "application/octet-stream";
}
