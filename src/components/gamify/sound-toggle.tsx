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
      className="flex size-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted group-data-[scrolled=true]/hdr:text-white/80 group-data-[scrolled=true]/hdr:hover:bg-white/10"
      aria-label={muted ? "Turn sounds on" : "Turn sounds off"}
      aria-pressed={!muted}
    >
      {muted ? <VolumeX className="size-5" aria-hidden /> : <Volume2 className="size-5" aria-hidden />}
    </button>
  );
}
