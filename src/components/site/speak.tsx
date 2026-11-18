"use client";

import { useSyncExternalStore } from "react";
import { Volume2 } from "lucide-react";
import { cn } from "cn";

const noop = () => () => {};

/** Browser text-to-speech (Web Speech API), English voice. Hidden where unsupported. */
export function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 0.92;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("en"));
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
}

export function useCanSpeak() {
  return useSyncExternalStore(noop, () => "speechSynthesis" in window, () => false);
}

export function ListenButton({ text, className }: { text: string; className?: string }) {
  const canSpeak = useCanSpeak();
  if (!canSpeak) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        speak(text);
      }}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-primary transition hover:bg-primary hover:text-white focus-visible:outline-2 focus-visible:outline-ring",
        className,
      )}
      aria-label={`Écouter : ${text}`}
    >
      <Volume2 className="size-4.5" aria-hidden />
    </button>
  );
}
