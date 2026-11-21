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
    // Missing STORAGE_* settings: say so (staff need to see it to fix the server configuration).
    if (e instanceof Error && e.message.startsWith("Stockage non configuré")) return { ok: false, error: e.message };
    return { ok: false, error: "Envoi impossible pour le moment. Réessayez." };
  }
}

export async function requestUpload(input: { kind: string; mime: string; size: number; durationS?: number }) {
  return run(async () => {
    const me = await readCurrentUser();
    if (!me) throw new MediaError("Connectez-vous pour envoyer un fichier.");
    if (!MEDIA_KINDS.includes(input.kind as MediaKind)) throw new MediaError("Type de fichier inconnu.");
    return startUpload({ id: me.id, isStaff: me.isStaff }, input.kind as MediaKind, String(input.mime), Number(input.size), Number(input.durationS ?? 0));
  });
}

export async function finishUpload(mediaId: string) {
  return run(async () => {
    const me = await readCurrentUser();
    if (!me) throw new MediaError("Connectez-vous pour envoyer un fichier.");
    const m = await confirmUpload({ id: me.id, isStaff: me.isStaff }, String(mediaId));
    return { mediaId: String(m._id) };
  });
}

/** Playback URL for a file the current user may read (own uploads, public content…). */
export async function getMediaUrl(mediaId: string) {
  return run(async () => {
    const me = await readCurrentUser();
    const url = await mediaUrlFor(me ? { id: me.id, isAdmin: me.isAdmin } : null, String(mediaId));
    if (!url) throw new MediaError("Fichier indisponible.");
    return { url };
  });
}
