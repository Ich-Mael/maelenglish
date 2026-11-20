"use client";

import type { MediaKind } from "@/models/Media";
import { finishUpload, requestUpload } from "@/app/media-actions";

/*
 * Uploads a file straight to storage: ask the server for a presigned URL, PUT the bytes,
 * confirm. Retries with back-off and waits for the connection to come back (3G, dropped
 * networks). Features that must survive a page reload (coach submissions) also persist the
 * pending upload — see the submission flow.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const online = () =>
  navigator.onLine ? Promise.resolve() : new Promise<void>((r) => window.addEventListener("online", () => r(), { once: true }));

export async function uploadMedia(blob: Blob, opts: { kind: MediaKind; durationS?: number; onProgress?: (state: "uploading" | "retrying") => void }): Promise<string> {
  const mime = blob.type || "audio/webm";
  const start = await requestUpload({ kind: opts.kind, mime, size: blob.size, durationS: opts.durationS });
  if (!start.ok) throw new Error(start.error);
  const { mediaId, uploadUrl } = start.data;
  for (let attempt = 0; ; attempt++) {
    await online();
    try {
      opts.onProgress?.(attempt ? "retrying" : "uploading");
      const res = await fetch(uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type": mime } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      break;
    } catch (e) {
      if (attempt >= 5) throw new Error("L’envoi a échoué. Vérifiez votre connexion et réessayez.", { cause: e });
      await sleep(Math.min(15000, 1000 * 2 ** attempt));
    }
  }
  const done = await finishUpload(mediaId);
  if (!done.ok) throw new Error(done.error);
  return mediaId;
}
