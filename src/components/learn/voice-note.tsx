"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Pause, Play } from "lucide-react";
import { formatTime } from "@/lib/lab/types";
import { Avatar } from "@/components/account/avatar";
import { coachInitialName } from "@/lib/coach-name";
import { cn } from "cn";

const SPEEDS = [1, 1.25, 0.75] as const;

/** Stable pseudo-waveform (bar heights in %) from the media id. */
function waveform(seed: string, n = 36): number[] {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    out.push(25 + ((h >>> 16) % 76));
  }
  return out;
}

/**
 * Coach voice note, shown like a WhatsApp voice message (familiar to learners): coach photo with a
 * mic badge, play / pause, bars filling as it plays (a range input over them seeks, keyboard too),
 * elapsed / total time, speed 1× / 1.25× / 0.75×. Nothing loads until play is pressed.
 */
export function VoiceNote({ src, seed, durationS = 0, coachName, coachAvatar }: { src: string; seed: string; durationS?: number; coachName: string; coachAvatar?: string | null }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(durationS);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [started, setStarted] = useState(false);

  const bars = useMemo(() => waveform(seed), [seed]);

  useEffect(() => {
    const a = audio.current;
    return () => a?.pause(); // hidden by <Activity> or unmounted
  }, []);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    setStarted(true);
    if (a.paused) void a.play().catch(() => setPlaying(false));
    else a.pause();
  };
  const nextSpeed = () => {
    const s = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(s);
    if (audio.current) audio.current.playbackRate = s;
  };

  const total = duration || 0;
  const ratio = total ? Math.min(1, time / total) : 0;

  return (
    <div className="flex items-center gap-3 rounded-2xl rounded-tl-sm border-2 border-primary/15 bg-white p-2.5 pr-3 shadow-[0_6px_18px_-12px_rgb(20_31_77/0.45)]">
      <audio
        ref={audio}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => (setPlaying(false), setTime(0))}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDuration(d);
          e.currentTarget.playbackRate = speed;
        }}
      />
      <span className="relative shrink-0">
        <Avatar src={coachAvatar} name={coachInitialName(coachName)} className="size-11 text-base" />
        <span aria-hidden className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full border-2 border-white bg-brand-deep text-white">
          <Mic className="size-2.5" />
        </span>
      </span>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Mettre en pause le message vocal" : `Écouter le message vocal de ${coachName}`}
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-white transition hover:bg-brand-dark active:scale-95"
      >
        {playing ? <Pause className="size-5" aria-hidden /> : <Play className="size-5 translate-x-px" aria-hidden />}
      </button>
      <div className="grid min-w-0 flex-1 gap-1">
        <div className="relative h-8">
          <div aria-hidden className="flex h-full items-center gap-[2px]">
            {bars.map((b, i) => (
              <span key={i} className={cn("w-full min-w-[2px] rounded-full transition-colors", i / bars.length < ratio ? "bg-primary" : "bg-primary/25")} style={{ height: `${b}%` }} />
            ))}
          </div>
          <input
            type="range"
            min={0}
            max={total || 1}
            step={0.1}
            value={Math.min(time, total || 1)}
            disabled={!total}
            aria-label="Position dans le message vocal"
            aria-valuetext={`${formatTime(time)} sur ${formatTime(total)}`}
            onChange={(e) => {
              const t = Number(e.target.value);
              setTime(t);
              if (audio.current) audio.current.currentTime = t;
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
          />
        </div>
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground tabular-nums">
          <span>{started || time ? formatTime(time) : total ? formatTime(total) : "Message vocal"}</span>
          <button type="button" onClick={nextSpeed} aria-label={`Vitesse de lecture : ${speed}×`} className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-primary">
            {String(speed).replace(".", ",")}×
          </button>
        </div>
      </div>
    </div>
  );
}
