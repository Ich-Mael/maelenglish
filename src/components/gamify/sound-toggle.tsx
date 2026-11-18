"use client";

import { Volume2, VolumeX } from "lucide-react";
import { playSound, setMuted, useMuted } from "./sound";

export function SoundToggle() {
  const muted = useMuted();
  return (
    <button
      type="button"
      onClick={() => {
        setMuted(!muted);
        if (muted) playSound("tap");
      }}
      className="flex size-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted"
      aria-label={muted ? "Activer les sons" : "Couper les sons"}
      aria-pressed={!muted}
    >
      {muted ? <VolumeX className="size-5" aria-hidden /> : <Volume2 className="size-5" aria-hidden />}
    </button>
  );
}
