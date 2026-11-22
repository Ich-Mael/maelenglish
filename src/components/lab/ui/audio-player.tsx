"use client";

import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { Pause, Play, Undo2 } from "lucide-react";
import { formatTime } from "@/lib/lab/types";
import { cn } from "cn";

/*
 * Lab audio player (catalogue: shared by every listening exercise): play / pause, 5 s back,
 * speeds 0.75× / 1× / 1.25× (pitch preserved), play counter, jump to a moment. Pinned under the
 * app header so it stays at hand while answering.
 * `maxPlays` > 0 and `limited`: each listen from the start counts, no rewinding or seeking.
 */

const SPEEDS = [0.75, 1, 1.25] as const;

export type AudioPlayerHandle = { playFrom: (t: number) => void; pause: () => void };

export function AudioPlayer({
  src,
  maxPlays = 0,
  limited = false,
  onPlaysChange,
  ref,
}: {
  src: string | null;
  maxPlays?: number;
  limited?: boolean;
  onPlaysChange?: (plays: number) => void;
  ref?: React.Ref<AudioPlayerHandle>;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [plays, setPlays] = useState(0);
  const [fresh, setFresh] = useState(true); // the next « play » starts a new listen

  useEffect(() => {
    const a = audio.current;
    // The metadata may have loaded before hydration (the event was missed).
    if (a && a.readyState >= 1 && Number.isFinite(a.duration)) setDuration(a.duration);
    // Hidden by <Activity> (navigation) or unmounted: stop the audio.
    return () => a?.pause();
  }, []);

  useImperativeHandle(ref, () => ({
    playFrom: (t: number) => {
      const a = audio.current;
      if (!a) return;
      a.currentTime = Math.max(0, t);
      void a.play().catch(() => {});
    },
    pause: () => audio.current?.pause(),
  }));

  const capped = limited && maxPlays > 0;
  const exhausted = capped && plays >= maxPlays && fresh && !playing;

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (!a.paused) return a.pause();
    if (exhausted) return;
    void a.play().catch(() => {});
  };
  const seekTo = (t: number) => {
    const a = audio.current;
    if (a) a.currentTime = Math.max(0, Math.min(duration || a.duration || 0, t));
  };
  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    if (audio.current) audio.current.playbackRate = next;
    setSpeed(next);
  };

  if (!src) return <p className="rounded-3xl border-2 border-border bg-card p-4 text-sm text-muted-foreground">The audio isn’t available right now.</p>;

  return (
    <div className="sticky top-16 z-20 rounded-3xl border-2 border-primary/20 bg-white p-3 shadow-[0_10px_25px_-15px_rgb(20_31_77/0.5)] sm:p-4">
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onPlay={() => {
          setPlaying(true);
          if (fresh) {
            setFresh(false);
            setPlays(plays + 1);
            onPlaysChange?.(plays + 1);
          }
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setFresh(true);
          if (audio.current) audio.current.currentTime = 0;
        }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={exhausted}
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-[0_4px_0_0_var(--color-brand-dark)] active:translate-y-1 active:shadow-[0_1px_0_0_var(--color-brand-dark)] disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="size-6 fill-current" aria-hidden /> : <Play className="ml-0.5 size-6 fill-current" aria-hidden />}
        </button>
        <div className="min-w-0 flex-1">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={time}
            disabled={capped}
            onChange={(e) => seekTo(Number(e.target.value))}
            aria-label="Position in the audio"
            className="tv-range on-light block w-full"
            style={{ ["--p" as string]: `${duration ? (time / duration) * 100 : 0}%` }}
          />
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <span className="font-mono tabular-nums">
              {formatTime(time)} / {formatTime(duration || 0)}
            </span>
            {capped ? (
              <span className={cn("ml-2 font-semibold", plays >= maxPlays ? "text-coral-dark" : "text-brand-deep")}>
                Listen {Math.min(plays, maxPlays)}/{maxPlays}
              </span>
            ) : (
              <button type="button" onClick={() => seekTo(time - 5)} className="ml-auto flex items-center gap-1 rounded-full px-2 py-1 font-semibold text-brand-deep hover:bg-brand-soft" aria-label="Back 5 seconds">
                <Undo2 className="size-3.5" aria-hidden /> 5 s
              </button>
            )}
            <button type="button" onClick={cycleSpeed} className={cn("rounded-full px-2 py-1 font-bold text-brand-deep ring-1 ring-border hover:bg-brand-soft", capped && "ml-auto")} aria-label={`Speed: ${speed}×`}>
              {speed}×
            </button>
          </div>
        </div>
      </div>
      {exhausted && <p className="mt-2 text-sm font-semibold text-coral-dark">You’ve used your {maxPlays} listens: answer now.</p>}
    </div>
  );
}
