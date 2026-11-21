"use client";

import { useState } from "react";
import { Loader2, Mic, Trash2, Upload, X } from "lucide-react";
import { Recorder } from "@/components/audio/recorder";
import { uploadMedia } from "@/components/audio/upload";
import { btn } from "./ui";
import { cn } from "cn";

/*
 * Coach voice note on a speaking challenge: record in the browser (or upload a file), stored as
 * Media kind « voice-note » (private to the coach, shared with the learner it answers by the
 * submission). Sends the media id in a hidden input `name` ("" = no voice note).
 */
export function VoiceNoteField({ name, initialId, initialUrl }: { name: string; initialId: string; initialUrl: string | null }) {
  const [id, setId] = useState(initialId);
  const [url, setUrl] = useState(initialUrl);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const upload = async (blob: Blob, durationS?: number) => {
    setError("");
    setBusy(true);
    try {
      const mediaId = await uploadMedia(blob, { kind: "voice-note", durationS });
      setId(mediaId);
      setUrl(URL.createObjectURL(blob));
      setRecording(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-2 rounded-xl border-2 border-dashed border-primary/25 bg-brand-soft/50 p-3">
      <input type="hidden" name={name} value={id} />
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-brand-deep">
          <Mic className="size-4 text-primary" aria-hidden /> Voice note for the learner (optional)
        </span>
      </div>
      <p className="text-xs text-muted-foreground">Up to 3 minutes. Learners often understand a spoken correction better: model the right pronunciation, then explain in French.</p>

      {id && !recording && (
        <div className="flex items-center gap-2">
          {url ? <audio src={url} controls preload="metadata" className="h-10 w-full" /> : <span className="text-sm text-muted-foreground">Voice note saved.</span>}
          <button type="button" className={btn.icon} onClick={() => (setId(""), setUrl(null))} aria-label="Remove the voice note" title="Remove">
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      )}

      {busy ? (
        <p className="flex items-center gap-2 text-sm font-semibold text-brand-deep" aria-live="polite">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Uploading…
        </p>
      ) : recording ? (
        <div className="grid gap-2">
          <Recorder maxSeconds={180} onUse={(rec) => void upload(rec.blob, rec.durationS)} useLabel="Use this voice note" locale="en" />
          <button type="button" className={cn(btn.secondary, "w-fit")} onClick={() => setRecording(false)}>
            <X className="size-4" aria-hidden /> Cancel
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={cn(btn.secondary, "h-9")} onClick={() => setRecording(true)}>
            <Mic className="size-4" aria-hidden /> {id ? "Record again" : "Record a voice note"}
          </button>
          <label className={cn(btn.secondary, "h-9 cursor-pointer")}>
            <Upload className="size-4" aria-hidden /> Upload
            <input type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/wav,audio/x-wav,audio/ogg,audio/webm" className="sr-only" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
          </label>
        </div>
      )}
      {error && <p className="text-sm font-semibold text-coral-dark">{error}</p>}
    </div>
  );
}
