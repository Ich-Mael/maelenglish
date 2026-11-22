"use client";

import { useState } from "react";
import { AudioLines, Image as ImageIcon, Type, Video } from "lucide-react";
import { AudioField } from "@/components/admin/audio-field";
import { inputCls } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/image-field";
import { videoSource } from "@/lib/learn/media";
import type { PromptType } from "@/lib/lab/types";
import { cn } from "cn";

/*
 * Speaking challenge prompt (Labo editor): what the learner reacts to — the instructions alone, a
 * picture to describe (resized to 1600 px WebP in the browser, Media kind « image »), a video link
 * or an audio (Media kind « model-audio »). Sends c_promptType, c_promptMediaId, c_promptVideoUrl
 * and c_promptAlt as hidden fields of the server-rendered activity form.
 */

const TYPES: { value: PromptType; label: string; hint: string; icon: typeof Type }[] = [
  { value: "text", label: "Instructions only", hint: "Answer the instructions", icon: Type },
  { value: "image", label: "Picture", hint: "Describe a picture", icon: ImageIcon },
  { value: "video", label: "Video", hint: "Watch, then give an opinion", icon: Video },
  { value: "audio", label: "Audio", hint: "Listen, then react / answer", icon: AudioLines },
];

export function PromptField({ initial, mediaUrl }: { initial: { type: PromptType; mediaId: string; videoUrl: string; alt: string }; mediaUrl: string | null }) {
  const [type, setType] = useState<PromptType>(initial.type);
  // One media slot per kind, so switching type back and forth doesn't lose the other upload.
  const [image, setImage] = useState({ id: initial.type === "image" ? initial.mediaId : "", url: initial.type === "image" ? mediaUrl : null });
  const [audio, setAudio] = useState({ id: initial.type === "audio" ? initial.mediaId : "", url: initial.type === "audio" ? mediaUrl : null });
  const [videoUrl, setVideoUrl] = useState(initial.videoUrl);
  const [alt, setAlt] = useState(initial.alt);

  const mediaId = type === "image" ? image.id : type === "audio" ? audio.id : "";
  const videoOk = !!videoSource(videoUrl);

  return (
    <section className="grid gap-3 rounded-2xl border border-border p-4">
      <input type="hidden" name="c_promptType" value={type} />
      <input type="hidden" name="c_promptMediaId" value={mediaId} />
      <input type="hidden" name="c_promptVideoUrl" value={type === "video" ? videoUrl : ""} />
      <input type="hidden" name="c_promptAlt" value={type === "image" ? alt : ""} />
      <div>
        <h3 className="font-heading font-extrabold text-brand-deep">Prompt</h3>
        <p className="text-xs text-muted-foreground">What the learner reacts to, shown under the instructions.</p>
      </div>
      <div role="radiogroup" aria-label="Prompt type" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={type === t.value}
            onClick={() => setType(t.value)}
            className={cn("grid justify-items-start gap-1 rounded-xl border-2 p-3 text-left transition", type === t.value ? "border-primary bg-brand-soft" : "border-border bg-card hover:border-primary/40")}
          >
            <t.icon className={cn("size-5", type === t.value ? "text-primary" : "text-muted-foreground")} aria-hidden />
            <span className="text-sm font-semibold text-brand-deep">{t.label}</span>
            <span className="text-xs text-muted-foreground">{t.hint}</span>
          </button>
        ))}
      </div>

      {type === "image" && (
        <div className="grid gap-2">
          <ImageField value={image.id} url={image.url} alt={alt} onChange={(id, url) => setImage({ id, url })} />
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Picture description (optional)</span>
            <input className={inputCls} value={alt} maxLength={300} onChange={(e) => setAlt(e.target.value)} placeholder="Un hall d'aéroport avec des passagers et un tableau des départs" />
            <span className="text-xs text-muted-foreground">In French. Read by screen readers; never shown in place of the picture.</span>
          </label>
          <p className="text-xs text-muted-foreground">JPEG, PNG or WebP. Resized to 1600 px before upload to keep it light for learners.</p>
        </div>
      )}

      {type === "video" && (
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Video link</span>
          <input className={inputCls} type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
          <span className={cn("text-xs", videoUrl && !videoOk ? "font-semibold text-coral-dark" : "text-muted-foreground")}>
            {videoUrl && !videoOk ? "Not a video link we can play: use YouTube, Vimeo or an .mp4 file." : "YouTube, Vimeo or an .mp4 file. Keep it short (under 2 minutes): learners pay for their data."}
          </span>
        </label>
      )}

      {type === "audio" && <AudioField label="Audio the learner listens to" value={audio.id} url={audio.url} onChange={(id, url) => setAudio({ id, url })} />}

    </section>
  );
}
