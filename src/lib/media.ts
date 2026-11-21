import "server-only";
import { Types } from "mongoose";
import { Media, User, type MediaDoc, type MediaKind } from "@/models";
import { canReadMedia, type MediaViewer } from "./media-access";
import { extensionFor, storageKey, uploadProblem, visibilityFor } from "./media-rules";
import { objectSize, presignUpload, signedReadUrl } from "./storage";

/*
 * Media service: start an upload (presigned URL), confirm it, issue read URLs after the access
 * check. Called from src/app/media-actions.ts and from feature actions (submissions, clips…).
 */

export class MediaError extends Error {}

type Uploader = { id: string; isStaff: boolean };

export async function startUpload(viewer: Uploader, kind: MediaKind, mime: string, size: number, durationS = 0) {
  const problem = uploadProblem(kind, mime, size, viewer);
  if (problem) throw new MediaError(problem);
  const _id = new Types.ObjectId();
  const key = storageKey(kind, String(_id), extensionFor(kind, mime)!);
  await Media.create({ _id, ownerId: new Types.ObjectId(viewer.id), kind, key, mime, size, durationS: Math.max(0, durationS || 0), visibility: visibilityFor(kind) });
  return { mediaId: String(_id), uploadUrl: await presignUpload(key, mime) };
}

/** Marks an upload ready once the file is really in storage (size checked). */
export async function confirmUpload(viewer: Uploader, mediaId: string): Promise<MediaDoc> {
  const m = await Media.findById(mediaId);
  if (!m || String(m.ownerId) !== viewer.id) throw new MediaError("Fichier introuvable.");
  if (m.status === "ready") return m.toObject();
  const size = await objectSize(m.key);
  if (size == null) throw new MediaError("Le fichier n’est pas encore arrivé. Réessayez.");
  m.size = size;
  m.status = "ready";
  await m.save();
  return m.toObject();
}

/** Signed URL to play a file, or null when the viewer may not read it. */
export async function mediaUrlFor(viewer: MediaViewer | null, mediaId: string, opts: { sharedWith?: string[] } = {}): Promise<string | null> {
  if (!Types.ObjectId.isValid(mediaId)) return null;
  const m = await Media.findById(mediaId).lean();
  if (!m || m.status !== "ready") return null;
  const owner = m.visibility === "private" ? await User.findById(m.ownerId).select("coachId").lean() : null;
  const ok = canReadMedia(viewer, {
    ownerId: String(m.ownerId),
    visibility: m.visibility as "private" | "public",
    ownerCoachId: owner?.coachId ? String(owner.coachId) : null,
    sharedWith: opts.sharedWith,
  });
  return ok ? signedReadUrl(m.key) : null;
}

/**
 * Signed URL for staff reviewing a submission. The caller has already checked the grading right
 * on the submission's course (`courseFor(me, courseId, "grade")`), which is the access rule here.
 */
export async function reviewMediaUrl(mediaId: string): Promise<string | null> {
  if (!Types.ObjectId.isValid(mediaId)) return null;
  const m = await Media.findById(mediaId).select("key status").lean();
  return m?.status === "ready" ? signedReadUrl(m.key) : null;
}

/**
 * A coach's voice note on a learner's speaking challenge, for that learner: the note belongs to the
 * coach and is shared with the learner the submission belongs to (and only them).
 */
export async function feedbackAudioUrl(viewerId: string, sub: { userId: unknown; feedbackAudioMediaId?: unknown }): Promise<string | null> {
  if (!sub.feedbackAudioMediaId || String(sub.userId) !== viewerId) return null;
  return mediaUrlFor({ id: viewerId, isAdmin: false }, String(sub.feedbackAudioMediaId), { sharedWith: [String(sub.userId)] }).catch(() => null);
}
