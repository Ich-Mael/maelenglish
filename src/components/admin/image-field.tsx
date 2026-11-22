"use client";

import { useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { uploadMedia } from "@/components/audio/upload";
import { btn } from "./ui";
import { cn } from "cn";

/*
 * Staff picture for learners (speaking challenge prompt, reading documents): upload a JPEG / PNG /
 * WebP, resized in the browser (longest side `maxSide` px, WebP — JPEG where the browser can't
 * encode WebP) and stored as Media kind « image » (public to signed-in users). Controlled:
 * `value` = media id, `url` = displayable URL of the current value (null = not loaded).
 */

/** Picture resized so its longest side is at most `maxSide` px. */
export async function resizeImage(file: File, maxSide = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const toBlob = (type: string) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.85));
  const webp = await toBlob("image/webp");
  const blob = webp?.type === "image/webp" ? webp : await toBlob("image/jpeg");
  if (!blob) throw new Error("This picture could not be read: try a JPEG or PNG.");
  return blob;
}

export function ImageField({ value, url, onChange, alt, maxSide = 1600, noun = "picture" }: { value: string; url: string | null; onChange: (mediaId: string, url: string | null) => void; alt?: string; maxSide?: number; noun?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const upload = async (file: File) => {
    setError("");
    setBusy(true);
    try {
      const blob = await resizeImage(file, maxSide);
      const id = await uploadMedia(blob, { kind: "image" });
      onChange(id, URL.createObjectURL(blob));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-2">
      {value && (
        <div className="relative w-fit max-w-full">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed / blob URL, no image optimiser
            <img src={url} alt={alt || noun} className="max-h-80 max-w-full rounded-xl border border-border object-contain" />
          ) : (
            <p className="text-sm text-muted-foreground">Picture saved.</p>
          )}
          <button type="button" className={cn(btn.icon, "absolute top-2 right-2 bg-card")} onClick={() => onChange("", null)} aria-label={`Remove the ${noun}`} title="Remove">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}
      {busy ? (
        <p className="flex items-center gap-2 text-sm font-semibold text-brand-deep" aria-live="polite">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Uploading the {noun}…
        </p>
      ) : (
        <label className={cn(btn.secondary, "w-fit cursor-pointer")}>
          <Upload className="size-4" aria-hidden /> {value ? `Replace the ${noun}` : `Upload a ${noun}`}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
        </label>
      )}
      {error && <p className="text-sm font-semibold text-coral-dark">{error}</p>}
    </div>
  );
}
