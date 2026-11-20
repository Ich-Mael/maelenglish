"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { Maximize, Minimize, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import type { VideoSource } from "@/lib/learn/media";
import { cn } from "cn";

/*
 * Lesson video in a « smart TV » frame: white bezel with the MaelEnglish logo on top, power
 * light, stand. Nothing is downloaded until the learner switches the TV on (data is expensive).
 * Cache Components keeps a page mounted but hidden (<Activity>) after navigating away, so the
 * TV switches itself off when hidden — otherwise the video kept playing in the background.
 * - Video files: custom controls (play, 10 s back, seek, speed for listening practice, sound,
 *   full screen; keyboard Space/K, ←/→, M, F).
 * - YouTube / Vimeo: the provider's own controls inside the screen (their iframes can't be restyled).
 */

const SPEEDS = [0.75, 1, 1.25] as const;

function withAutoplay(src: string): string {
  try {
    const u = new URL(src);
    u.searchParams.set("autoplay", "1");
    if (u.hostname.includes("youtube")) u.searchParams.set("playsinline", "1");
    return u.toString();
  } catch {
    return src;
  }
}

const fmt = (s: number) => {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

export function TvPlayer({ source, title }: { source: NonNullable<VideoSource>; title: string }) {
  const [on, setOn] = useState(false);
  // Runs when the page is hidden by <Activity> (navigation) or unmounted: stop the video.
  useLayoutEffect(() => () => setOn(false), []);
  return (
    <figure className="mx-auto w-full" aria-label={`Vidéo : ${title}`}>
      <div className="relative rounded-[1.4rem] bg-gradient-to-b from-white to-[#eef1fb] px-2 pt-9 pb-2.5 shadow-[0_30px_60px_-25px_rgb(20_31_77/0.45)] ring-1 ring-border sm:rounded-[2rem] sm:px-3.5 sm:pt-12 sm:pb-4">
        {/* top bezel: logo + camera */}
        <div className="absolute inset-x-0 top-0 flex h-9 items-center justify-center sm:h-12">
          <Image src="/images/maelenglish-logo.webp" alt="MaelEnglish" width={800} height={175} className="h-auto w-24 sm:w-32" />
          <span aria-hidden className="absolute top-1/2 right-5 size-1.5 -translate-y-1/2 rounded-full bg-brand-deep/70 ring-2 ring-brand-soft sm:right-7" />
        </div>

        <div className="relative aspect-video overflow-hidden rounded-lg bg-black ring-1 ring-border sm:rounded-xl">
          {on ? (
            <div className="tv-on size-full">
              {source.kind === "iframe" ? (
                <iframe
                  src={withAutoplay(source.src)}
                  title={title}
                  className="size-full"
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              ) : (
                <FileVideo src={source.src} title={title} />
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setOn(true)}
              className="group absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(ellipse_at_center,#ffffff_0%,#eef1fb_75%)] p-4 text-brand-deep"
            >
              <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgb(54_79_171/0.06),transparent_40%)]" />
              <span className="flex size-16 items-center justify-center rounded-full bg-primary text-white shadow-[0_6px_0_0_var(--color-coral)] transition group-hover:scale-105 group-active:translate-y-1 group-active:shadow-[0_2px_0_0_var(--color-coral)] sm:size-20">
                <Play className="ml-1 size-8 fill-current sm:size-9" aria-hidden />
              </span>
              <span className="max-w-md text-center font-heading text-base font-extrabold text-balance sm:text-xl">{title}</span>
              <span className="text-xs font-semibold text-muted-foreground sm:text-sm">Appuyez sur lecture, c&apos;est parti !</span>
            </button>
          )}
        </div>

        {/* power light: red on standby, blue when on */}
        <span
          aria-hidden
          className={cn(
            "absolute right-5 bottom-1 size-1.5 rounded-full transition sm:right-8 sm:bottom-1.5",
            on ? "bg-primary shadow-[0_0_8px_2px_rgb(54_79_171/0.6)]" : "bg-coral shadow-[0_0_8px_2px_rgb(255_87_87/0.6)]",
          )}
        />
      </div>
      {/* stand */}
      <div aria-hidden className="mx-auto h-4 w-14 bg-gradient-to-b from-[#dfe4f4] to-[#eef1fb] sm:h-5 sm:w-20" />
      <div aria-hidden className="mx-auto h-2 w-40 rounded-full bg-white shadow-[0_8px_16px_-6px_rgb(20_31_77/0.35)] ring-1 ring-border sm:h-2.5 sm:w-56" />
    </figure>
  );
}

function FileVideo({ src, title }: { src: string; title: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [full, setFull] = useState(false);
  const [showUi, setShowUi] = useState(true);

  useEffect(() => {
    void video.current?.play().catch(() => {}); // the learner just pressed « on »
    const onFs = () => setFull(document.fullscreenElement === box.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const poke = () => {
    setShowUi(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowUi(false), 2500);
  };
  const v = () => video.current!;
  const toggle = () => (v().paused ? void v().play().catch(() => {}) : v().pause());
  const seek = (t: number) => {
    v().currentTime = Math.max(0, Math.min(duration || 0, t));
    poke();
  };
  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    v().playbackRate = next;
    setSpeed(next);
  };
  const toggleMute = () => {
    v().muted = !v().muted;
    setMuted(v().muted);
  };
  const toggleFull = () => {
    const el = box.current!;
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (el.requestFullscreen) void el.requestFullscreen().catch(() => {});
    else (v() as HTMLVideoElement & { webkitEnterFullscreen?: () => void }).webkitEnterFullscreen?.(); // iOS
  };

  const onKey = (e: React.KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k === " " || k === "k") toggle();
    else if (k === "arrowleft") seek(v().currentTime - 5);
    else if (k === "arrowright") seek(v().currentTime + 5);
    else if (k === "m") toggleMute();
    else if (k === "f") toggleFull();
    else return;
    e.preventDefault();
    poke();
  };

  const uiVisible = showUi || !playing;
  const btn = "flex size-9 shrink-0 items-center justify-center rounded-full text-white hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white";
  return (
    <div
      ref={box}
      tabIndex={0}
      onKeyDown={onKey}
      onMouseMove={poke}
      onTouchStart={poke}
      className={cn("group/v relative size-full bg-black outline-none", !uiVisible && "cursor-none")}
      aria-label={`Lecteur vidéo : ${title}`}
    >
      <video
        ref={video}
        src={src}
        playsInline
        preload="auto"
        className="size-full"
        onClick={toggle}
        onPlay={() => {
          setPlaying(true);
          poke();
        }}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
      />
      {!playing && (
        <button type="button" onClick={toggle} aria-label="Lecture" className="absolute inset-0 m-auto mb-[45%] flex size-12 items-center justify-center rounded-full bg-white/90 text-primary shadow-lg sm:mb-auto sm:size-16">
          <Play className="ml-0.5 size-6 fill-current sm:ml-1 sm:size-8" aria-hidden />
        </button>
      )}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-2 pt-8 pb-1.5 transition-opacity duration-300 sm:px-3 sm:pb-2",
          uiVisible ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={time}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Position dans la vidéo"
          className="tv-range block w-full"
          style={{ ["--p" as string]: `${duration ? (time / duration) * 100 : 0}%` }}
        />
        <div className="mt-1 flex items-center gap-1 text-sm text-white">
          <button type="button" onClick={toggle} className={btn} aria-label={playing ? "Pause" : "Lecture"}>
            {playing ? <Pause className="size-5 fill-current" aria-hidden /> : <Play className="size-5 fill-current" aria-hidden />}
          </button>
          <button type="button" onClick={() => seek(v().currentTime - 10)} className={btn} aria-label="Revenir de 10 secondes" title="Revoir 10 s">
            <RotateCcw className="size-5" aria-hidden />
          </button>
          <button type="button" onClick={toggleMute} className={btn} aria-label={muted ? "Activer le son" : "Couper le son"}>
            {muted ? <VolumeX className="size-5" aria-hidden /> : <Volume2 className="size-5" aria-hidden />}
          </button>
          <span className="ml-1 font-mono text-xs tabular-nums sm:text-sm">
            {fmt(time)} / {fmt(duration)}
          </span>
          <button type="button" onClick={cycleSpeed} className="ml-auto rounded-full px-2.5 py-1 text-xs font-bold text-white ring-1 ring-white/40 hover:bg-white/15" aria-label={`Vitesse de lecture : ${speed}×`} title="Vitesse (pour mieux comprendre)">
            {speed}×
          </button>
          <button type="button" onClick={toggleFull} className={btn} aria-label={full ? "Quitter le plein écran" : "Plein écran"}>
            {full ? <Minimize className="size-5" aria-hidden /> : <Maximize className="size-5" aria-hidden />}
          </button>
        </div>
      </div>
    </div>
  );
}
