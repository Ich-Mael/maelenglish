"use client";

import { useState } from "react";
import { AudioLines, Loader2, Mic, Upload, X } from "lucide-react";
import { generateModelAudioAction } from "@/app/admin/labo/actions";
import { useTtsVoice } from "@/components/lab/tts-voice";
import { Recorder } from "@/components/audio/recorder";
import { uploadMedia } from "@/components/audio/upload";
import { btn } from "./ui";
import { cn } from "cn";

/*
 * Staff audio for learners (lesson audio, vocabulary words, dialogues, model answers): upload a file
 * or record in the browser, stored as Media kind « model-audio » (public to signed-in users).
 * Controlled: `value` = media id, `url` = playable URL of the current value (null = not loaded).
 */
export function AudioField({ value, url, onChange, label, compact, speakText }: { value: string; url: string | null; onChange: (mediaId: string, url: string | null) => void; label: string; compact?: boolean; /** With an ElevenLabs voice chosen above (TtsVoiceProvider): « Generate with ElevenLabs » reads this text. */ speakText?: string }) {
  const tts = useTtsVoice();
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");

  const upload = async (blob: Blob, durationS?: number) => {
    setError("");
    setBusy(true);
    try {
      const id = await uploadMedia(blob, { kind: "model-audio", durationS });
      onChange(id, URL.createObjectURL(blob));
      setRecording(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    if (!tts || !speakText?.trim()) return;
    setError("");
    setGenerating(true);
    const r = await generateModelAudioAction(speakText, tts.voiceId).catch(() => ({ ok: false as const, error: "Something went wrong: try again." }));
    setGenerating(false);
    if (!r.ok) return setError(r.error);
    onChange(r.mediaId, r.url);
  };

  return (
    <div className={cn("grid gap-2", compact && "text-sm")}>
      <span className="text-sm font-medium">{label}</span>
      {value && !recording && (
        <div className="flex items-center gap-2">
          {url ? <audio src={url} controls preload="none" className="h-9 w-full max-w-sm" /> : <span className="text-xs text-muted-foreground">Audio saved.</span>}
          <button type="button" className={btn.icon} onClick={() => onChange("", null)} aria-label={`Remove: ${label}`} title="Remove">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}
      {busy || generating ? (
        <p className="flex items-center gap-2 text-sm font-semibold text-brand-deep" aria-live="polite">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {generating ? "Generating with ElevenLabs…" : "Uploading…"}
        </p>
      ) : recording ? (
        <div className="grid gap-2">
          <Recorder maxSeconds={180} onUse={(rec) => void upload(rec.blob, rec.durationS)} useLabel="Use this recording" locale="en" />
          <button type="button" className={cn(btn.secondary, "w-fit")} onClick={() => setRecording(false)}>
            <X className="size-4" aria-hidden /> Cancel
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <label className={cn(btn.secondary, "h-9 cursor-pointer")}>
            <Upload className="size-4" aria-hidden /> {value ? "Replace" : "Upload"}
            <input type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/wav,audio/x-wav,audio/ogg,audio/webm" className="sr-only" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
          </label>
          <button type="button" className={cn(btn.secondary, "h-9")} onClick={() => setRecording(true)}>
            <Mic className="size-4" aria-hidden /> Record
          </button>
          {tts && speakText !== undefined && (
            <button type="button" className={cn(btn.secondary, "h-9")} disabled={!speakText.trim()} onClick={() => void generate()} title={speakText.trim() ? "Read this phrase with the ElevenLabs voice chosen above" : "Write the phrase first"}>
              <AudioLines className="size-4" aria-hidden /> {value ? "Regenerate" : "Generate with ElevenLabs"}
            </button>
          )}
        </div>
      )}
      {error && <p className="text-sm font-semibold text-coral-dark">{error}</p>}
    </div>
  );
}
