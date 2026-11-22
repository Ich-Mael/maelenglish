"use server";

import { readCurrentUser } from "@/lib/auth/dal";
import { MEDIA_KINDS, type MediaKind } from "@/models";
import { MediaError, confirmUpload, mediaUrlFor, startUpload } from "@/lib/media";

/** Server actions for uploads (src/components/audio/upload.ts) and playback URLs. */

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof MediaError) return { ok: false, error: e.message };
    console.error("media action", e);
    // Missing STORAGE_* settings: the technical reason for staff (they fix the server), a plain message for learners.
    if (e instanceof Error && e.message.startsWith("Storage not configured")) {
      const me = await readCurrentUser().catch(() => null);
      return {
        ok: false,
        error: me?.isStaff ? `${e.message} (message visible to staff only)` : "Uploading recordings is unavailable right now. Keep the page open and try again in a few minutes, or tell your coach.",
      };
    }
    return { ok: false, error: "Can't upload right now. Try again." };
  }
}

export async function requestUpload(input: { kind: string; mime: string; size: number; durationS?: number }) {
  return run(async () => {
    const me = await readCurrentUser();
    if (!me) throw new MediaError("Sign in to upload a file.");
    if (!MEDIA_KINDS.includes(input.kind as MediaKind)) throw new MediaError("Unknown file type.");
    return startUpload({ id: me.id, isStaff: me.isStaff }, input.kind as MediaKind, String(input.mime), Number(input.size), Number(input.durationS ?? 0));
  });
}

export async function finishUpload(mediaId: string) {
  return run(async () => {
    const me = await readCurrentUser();
    if (!me) throw new MediaError("Sign in to upload a file.");
    const m = await confirmUpload({ id: me.id, isStaff: me.isStaff }, String(mediaId));
    return { mediaId: String(m._id) };
  });
}

/** Playback URL for a file the current user may read (own uploads, public content…). */
export async function getMediaUrl(mediaId: string) {
  return run(async () => {
    const me = await readCurrentUser();
    const url = await mediaUrlFor(me ? { id: me.id, isAdmin: me.isAdmin } : null, String(mediaId));
    if (!url) throw new MediaError("File unavailable.");
    return { url };
  });
}
