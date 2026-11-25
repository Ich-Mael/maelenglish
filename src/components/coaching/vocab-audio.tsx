"use client";

import { useRef, useState } from "react";
import { MessageSquareQuote, Snail, Volume2, X } from "lucide-react";
import { setVoice, synth, useVoice } from "@/components/learn/word-card";
import { cn } from "cn";

/*
 * Coaching daily vocabulary, read aloud: natural voices from /api/coaching/vocab-audio (Azure,
 * else ElevenLabs — made once, shared), the browser's voice when unavailable. The US / UK accent
 * is the same choice as the dictionary's (remembered on the device).
 */

type Target = { coachingId: string; vocabId: string; itemId: string; what: "text" | "example" | "sentence"; sentenceId?: string };

export function Listen({ target, text, slow, label, className, iconClass = "size-4", tone = "light" }: { target: Target; text: string; slow?: boolean; label: string; className?: string; iconClass?: string; tone?: "light" | "dark" }) {
  const audio = useRef<HTMLAudioElement>(null);
  const voice = useVoice();
  const [playing, setPlaying] = useState(false);
  const play = () => {
    const el = audio.current;
    if (!el) return synth(text, voice, !!slow);
    let fellBack = false;
    const fallback = () => {
      if (fellBack) return;
      fellBack = true;
      el.onerror = null;
      setPlaying(false);
      synth(text, voice, !!slow);
    };
    el.onerror = fallback;
    el.onended = () => setPlaying(false);
    const q = new URLSearchParams({ c: target.coachingId, v: target.vocabId, i: target.itemId, what: target.what, voice, ...(target.sentenceId ? { s: target.sentenceId } : {}), ...(slow ? { slow: "1" } : {}) });
    el.src = `/api/coaching/vocab-audio?${q}`;
    setPlaying(true);
    void el.play().catch((err: Error) => err.name !== "AbortError" && fallback());
  };
  const Icon = slow ? Snail : Volume2;
  return (
    <button
      type="button"
      onClick={play}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full transition-colors",
        tone === "dark" ? "bg-white/15 text-white hover:bg-white hover:text-primary" : "text-primary hover:bg-brand-soft",
        playing && (tone === "dark" ? "bg-white text-primary" : "bg-brand-soft"),
        className,
      )}
    >
      <audio ref={audio} preload="none" className="hidden" />
      <Icon className={iconClass} aria-hidden />
    </button>
  );
}

/** US / UK accent switch (shared with the dictionary). */
export function AccentSwitch({ tone = "light" }: { tone?: "light" | "dark" }) {
  const voice = useVoice();
  return (
    <span className="inline-flex gap-1 text-[11px] font-bold" role="group" aria-label="Accent">
      {(["us", "gb"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => setVoice(v)}
          aria-pressed={voice === v}
          className={cn("rounded-full px-2 py-0.5", voice === v ? (tone === "dark" ? "bg-white text-primary" : "bg-brand-deep text-white") : tone === "dark" ? "bg-white/15 text-white hover:bg-white/25" : "bg-muted text-muted-foreground hover:bg-brand-soft")}
        >
          {v === "us" ? "US" : "UK"}
        </button>
      ))}
    </span>
  );
}

/** « See all the examples »: every sentence of the group for one expression, in a modal (bottom sheet on phones). */
export function AllSentences({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const open = () => {
    const d = dialog.current;
    if (!d || d.open) return;
    d.showModal();
    document.documentElement.style.overflow = "hidden";
  };
  const onClose = () => {
    document.documentElement.style.overflow = "";
    dialog.current?.querySelectorAll("audio").forEach((m) => m.pause());
  };
  return (
    <>
      <button type="button" onClick={open} aria-haspopup="dialog" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border-2 border-primary/20 bg-white px-4 text-sm font-semibold text-primary hover:bg-brand-soft">
        <MessageSquareQuote className="size-4" aria-hidden /> See all the examples ({count})
      </button>
      <dialog
        ref={dialog}
        onClose={onClose}
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        aria-label={`The group's sentences with « ${title} »`}
        className="m-0 mt-auto max-h-[88dvh] w-full max-w-none rounded-t-3xl bg-background p-0 text-foreground backdrop:bg-ink/50 sm:m-auto sm:max-w-xl sm:rounded-3xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-background px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">The group&apos;s sentences ({count})</p>
            <p lang="en" className="font-heading text-xl font-extrabold text-brand-deep">
              {title}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AccentSwitch />
            <button type="button" onClick={() => dialog.current?.close()} className="inline-flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-brand-soft hover:text-primary" aria-label="Close">
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>
        <div className="px-5 py-4">{children}</div>
      </dialog>
    </>
  );
}
