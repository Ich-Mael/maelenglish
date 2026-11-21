"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { uploadMedia } from "@/components/audio/upload";
import { setAvatarAction } from "@/app/avatar-actions";
import { Avatar } from "./avatar";

/*
 * Choose / change / remove a profile photo. The picture is cropped to a centred square and
 * resized to 320 px in the browser (WebP, else JPEG ≈ 20 KB — cheap on mobile data) before
 * the upload; the server links it to the account (`setAvatarAction`).
 */

const SIZE = 320;
const T = {
  fr: { change: "Changer la photo", add: "Ajouter une photo", remove: "Retirer", sending: "Envoi…", notImage: "Choisissez une image (JPEG, PNG, WebP…).", unreadable: "Image illisible. Essayez une autre photo.", hint: "Une photo de votre visage, bien éclairée." },
  en: { change: "Change photo", add: "Add a photo", remove: "Remove", sending: "Uploading…", notImage: "Choose an image (JPEG, PNG, WebP…).", unreadable: "Couldn't read this image. Try another one.", hint: "A clear photo of the face. Cropped to a square." },
};

async function squareImage(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(SIZE, side);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const toBlob = (type: string) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.85));
  const webp = await toBlob("image/webp");
  // Older Safari can't encode WebP and silently returns PNG.
  const blob = webp?.type === "image/webp" ? webp : await toBlob("image/jpeg");
  if (!blob) throw new Error("encode");
  return blob;
}

export function AvatarPicker({ userId, src, name, locale = "fr" }: { userId: string; src: string | null; name: string; locale?: "fr" | "en" }) {
  const t = T[locale];
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();
  const shown = preview ?? src;
  const working = busy || pending;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) return setError(t.notImage);
    setBusy(true);
    try {
      let blob: Blob;
      try {
        blob = await squareImage(file);
      } catch {
        throw new Error(t.unreadable);
      }
      setPreview(URL.createObjectURL(blob));
      const mediaId = await uploadMedia(blob, { kind: "avatar" });
      const r = await setAvatarAction(userId, mediaId, locale);
      if (!r.ok) throw new Error(r.error);
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  function remove() {
    setError("");
    start(async () => {
      const r = await setAvatarAction(userId, null, locale);
      if (!r.ok) setError(r.error);
      else setPreview(null);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative">
        <Avatar src={shown} name={name} className="size-20 text-2xl" />
        {working && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
            <Loader2 className="size-6 animate-spin text-white" aria-hidden />
          </span>
        )}
      </div>
      <div className="grid gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={working}
            onClick={() => input.current?.click()}
            className="inline-flex h-10 items-center gap-2 rounded-xl border-2 border-primary bg-white px-3 text-sm font-semibold text-primary hover:bg-brand-soft disabled:opacity-60"
          >
            <Camera className="size-4" aria-hidden /> {working ? t.sending : shown ? t.change : t.add}
          </button>
          {shown && !working && (
            <button type="button" onClick={remove} className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-muted">
              <Trash2 className="size-4" aria-hidden /> {t.remove}
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t.hint}</p>
        {error && (
          <p role="alert" className="text-sm font-medium text-coral-dark">
            {error}
          </p>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void onFile(e.target.files?.[0])} />
    </div>
  );
}
