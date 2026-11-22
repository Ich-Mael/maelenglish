import { AudioLines, Expand, Image as ImageIcon, MessageCircleQuestion, Video } from "lucide-react";
import type { SpeakingChallengeContent } from "@/lib/lab/types";
import { videoSource } from "@/lib/learn/media";
import { AudioPlayer } from "@/components/lab/ui/audio-player";
import { TvPlayer } from "./tv-player";
import { cn } from "cn";

/*
 * What a speaking challenge asks the learner to react to — a picture to describe, a video or an
 * audio — and the questions to answer in the recording. Challenge step (French) and the coach's
 * grading page (English). `mediaUrl`: signed URL of the picture / audio (null = unavailable).
 */

const TEXT = {
  fr: { image: "Regardez l'image", video: "Regardez la vidéo", audio: "Écoutez l'audio", zoom: "Agrandir l'image", missing: "Support indisponible pour le moment.", questions: "Répondez à ces questions dans votre enregistrement" },
  en: { image: "Picture", video: "Video", audio: "Audio", zoom: "Open full size", missing: "Prompt unavailable (file missing or storage not configured).", questions: "Questions to answer" },
} as const;

export function hasChallengePrompt(c: Partial<SpeakingChallengeContent>) {
  return (!!c.promptType && c.promptType !== "text") || !!c.questions?.length;
}

export function ChallengePrompt({ c, mediaUrl, title, locale = "fr", className }: { c: Partial<SpeakingChallengeContent>; mediaUrl: string | null; title: string; locale?: "fr" | "en"; className?: string }) {
  const t = TEXT[locale];
  const type = c.promptType ?? "text";
  const video = type === "video" ? videoSource(c.promptVideoUrl) : null;
  const questions = c.questions ?? [];
  if (!hasChallengePrompt(c)) return null;
  const Icon = type === "image" ? ImageIcon : type === "video" ? Video : AudioLines;

  return (
    <div className={cn("grid gap-4", className)}>
      {type !== "text" && (
        <div className="grid gap-2">
          <p className="flex items-center gap-2 text-sm font-bold tracking-wide text-primary uppercase">
            <Icon className="size-4" aria-hidden /> {t[type]}
          </p>
          {type === "image" &&
            (mediaUrl ? (
              <a href={mediaUrl} target="_blank" rel="noopener" className="group relative block overflow-clip rounded-2xl border border-border bg-muted" aria-label={t.zoom}>
                {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL, no image optimiser */}
                <img src={mediaUrl} alt={c.promptAlt || ""} className="mx-auto max-h-[70vh] w-full object-contain" />
                <span aria-hidden className="absolute right-2 bottom-2 flex size-9 items-center justify-center rounded-full bg-white/90 text-brand-deep shadow transition group-hover:scale-105">
                  <Expand className="size-4" />
                </span>
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">{t.missing}</p>
            ))}
          {type === "video" && (video ? <TvPlayer source={video} title={title} /> : <p className="text-sm text-muted-foreground">{t.missing}</p>)}
          {type === "audio" && (mediaUrl ? <AudioPlayer src={mediaUrl} /> : <p className="text-sm text-muted-foreground">{t.missing}</p>)}
        </div>
      )}
      {questions.length > 0 && (
        <div className="grid gap-2">
          <p className="flex items-center gap-2 font-heading font-extrabold text-brand-deep">
            <MessageCircleQuestion className="size-5 text-primary" aria-hidden /> {t.questions}
          </p>
          <ol className="grid gap-2">
            {questions.map((q, i) => (
              <li key={i} className="flex gap-3 rounded-xl bg-brand-soft/60 px-3 py-2.5 text-ink">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">{i + 1}</span>
                <span>{q}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
