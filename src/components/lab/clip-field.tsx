"use client";

import { useState } from "react";
import { Loader2, Mic, Upload, X } from "lucide-react";
import { Recorder } from "@/components/audio/recorder";
import { uploadMedia } from "@/components/audio/upload";
import { btn, inputCls } from "@/components/admin/ui";
import { MAX_PLAYS } from "@/lib/lab/types";
import { cn } from "cn";

/*
 * Audio of a listening activity (Labo editors: listen & choose, listen & fill the gaps): upload a
 * file or record in the browser (Media kind « clip »), and the play limit. `audioRef` gives the
 * editor the player (to read its position or play from a moment).
 */

export type Clip = { id: string; durationS: number; url: string | null };

export function ClipField({
  clip,
  onChange,
  maxPlays,
  onMaxPlays,
  audioRef,
}: {
  clip: Clip;
  onChange: (c: Clip) => void;
  maxPlays: number;
  onMaxPlays: (n: number) => void;
  audioRef?: React.Ref<HTMLAudioElement>;
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);

  const upload = async (blob: Blob, durationS?: number) => {
    setError("");
    setBusy("Uploading the audio…");
    try {
      const id = await uploadMedia(blob, { kind: "clip", durationS, onProgress: (s) => setBusy(s === "retrying" ? "Unstable connection: retrying…" : "Uploading the audio…") });
      onChange({ id, url: URL.createObjectURL(blob), durationS: durationS ? Math.round(durationS) : clip.durationS });
      setRecording(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="grid gap-3 rounded-2xl border border-border p-4">
      <h3 className="font-heading font-extrabold text-brand-deep">Audio</h3>
      {clip.url && !recording && (
        <audio
          ref={audioRef}
          src={clip.url}
          controls
          preload="metadata"
          className="w-full"
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && Math.round(d) !== clip.durationS) onChange({ ...clip, durationS: Math.round(d) });
          }}
        />
      )}
      {busy ? (
        <p className="flex items-center gap-2 text-sm font-semibold text-brand-deep" aria-live="polite">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {busy}
        </p>
      ) : recording ? (
        <div className="grid gap-2">
          <Recorder maxSeconds={300} onUse={(rec) => void upload(rec.blob, rec.durationS)} useLabel="Use this recording" locale="en" />
          <button type="button" className={cn(btn.secondary, "w-fit")} onClick={() => setRecording(false)}>
            <X className="size-4" aria-hidden /> Cancel
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <label className={cn(btn.secondary, "cursor-pointer")}>
            <Upload className="size-4" aria-hidden /> {clip.id ? "Replace with a file" : "Upload an audio file"}
            <input type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/wav,audio/x-wav,audio/ogg,audio/webm" className="sr-only" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
          </label>
          <button type="button" className={btn.secondary} onClick={() => setRecording(true)}>
            <Mic className="size-4" aria-hidden /> {clip.id ? "Record again" : "Record my voice"}
          </button>
        </div>
      )}
      {error && <p className="text-sm font-semibold text-coral-dark">{error}</p>}
      <p className="text-xs text-muted-foreground">MP3, M4A, WAV… 30 MB max. A native voice at natural speed: that&apos;s the point of the exercise.</p>
      <label className="grid content-start gap-1 text-sm sm:max-w-xs">
        <span className="font-medium">Number of plays</span>
        <select className={inputCls} value={maxPlays} onChange={(e) => onMaxPlays(Number(e.target.value))}>
          {MAX_PLAYS.map((n) => (
            <option key={n} value={n}>
              {n === 0 ? "Unlimited" : `${n} plays max`}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">Unlimited for practice; 2 or 3 for an exam-style test. The limit is lifted at correction.</span>
      </label>
    </section>
  );
}
