"use client";

import { useRef, useState } from "react";
import { ChevronRight, Mic, Snail, Volume2, X } from "lucide-react";
import { setVoice, synth, useVoice } from "@/components/learn/word-card";
import { SHADOW_GOAL } from "@/lib/shadowing";
import { cn } from "cn";

/*
 * Read aloud + shadowing modal, shared by the coaching daily vocabulary and The Vocabulary I Need.
 * `Listen` plays `src` (an audio route that redirects to natural voices — Azure, else ElevenLabs,
 * made once and shared — given `voice` / `slow`), the browser's voice when unavailable. The US / UK
 * accent is the same choice as the dictionary's (remembered on the device).
 */

export function Listen({ src, text, slow, label, className, iconClass = "size-4", tone = "light" }: { src: string; text: string; slow?: boolean; label: string; className?: string; iconClass?: string; tone?: "light" | "dark" }) {
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
    el.src = `${src}${src.includes("?") ? "&" : "?"}${new URLSearchParams({ voice, ...(slow ? { slow: "1" } : {}) })}`;
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

/** « Practice Shadowing with Examples »: a card that opens the sentences to practise in a modal (bottom sheet on phones). */
export function ShadowingModal({ title, count, kicker = "The group's sentences", intro, children }: { title: string; count: number; kicker?: string; intro?: string; children: React.ReactNode }) {
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
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        className="group mt-1 mb-1 flex w-full items-center gap-3 rounded-2xl border-2 border-coral bg-white p-3 text-left shadow-[0_4px_0_0_var(--color-coral)] transition-[transform,box-shadow,background-color] hover:bg-coral-soft/60 active:translate-y-1 active:shadow-[0_0_0_0_var(--color-coral)]"
      >
        <span className="relative flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-coral bg-white text-coral" aria-hidden>
          <span className="absolute inset-0 animate-ping rounded-full border-2 border-coral/40 [animation-duration:2.4s] motion-reduce:hidden" />
          <Mic className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-heading text-[17px] leading-tight font-extrabold text-brand-deep">Practice Shadowing with Examples</span>
          <span className="mt-1 block text-sm text-muted-foreground">
            <b className="font-semibold text-coral-dark">
              {count} {count > 1 ? "examples" : "example"}
            </b>{" "}
            to listen to and repeat · goal <b className="text-primary">{SHADOW_GOAL}%</b>
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-coral transition-transform group-hover:translate-x-0.5" aria-hidden />
      </button>
      <dialog
        ref={dialog}
        onClose={onClose}
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        aria-label={`Practice shadowing with « ${title} »`}
        className="m-0 mt-auto max-h-[94dvh] w-full max-w-none rounded-t-3xl bg-background p-0 text-foreground backdrop:bg-ink/50 sm:m-auto sm:max-h-[92dvh] sm:w-[min(56rem,calc(100vw-3rem))] sm:rounded-3xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-background px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
              {kicker} ({count})
            </p>
            <p lang="en" className="font-heading text-2xl font-extrabold text-brand-deep sm:text-3xl">
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
        <div className="px-4 py-4 sm:px-6 sm:py-5">
          <p className="mb-3 text-base text-muted-foreground">{intro ?? `Listen to each sentence and say it the same way: reach ${SHADOW_GOAL}% to master it.`}</p>
          {children}
        </div>
      </dialog>
    </>
  );
}
