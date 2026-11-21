"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Volume2 } from "lucide-react";

/** Small play / pause button for a short audio (vocabulary word). Stops when the page is hidden (Cache Components <Activity>). */
export function AudioButton({ src, label }: { src: string; label: string }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => () => audio.current?.pause(), []);

  const toggle = () => {
    audio.current ??= Object.assign(new Audio(src), { onended: () => setPlaying(false), onpause: () => setPlaying(false) });
    if (playing) return audio.current.pause();
    audio.current.currentTime = 0;
    void audio.current.play().then(() => setPlaying(true), () => setPlaying(false));
  };

  return (
    <button type="button" onClick={toggle} aria-label={label} aria-pressed={playing} className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-primary transition hover:bg-primary hover:text-white">
      {playing ? <Pause className="size-4" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
    </button>
  );
}
