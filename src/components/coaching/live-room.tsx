"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { ExternalLink, Headphones, Loader2, LogOut, Maximize2, Minimize2, MonitorUp, Video } from "lucide-react";
import { joinSessionAction } from "@/app/coaching-actions";
import { cn } from "cn";

/*
 * The live session in a MaelEnglish « smart TV » (the lesson video player's look: navy bezel,
 * the logo on the top bezel). Before joining, the TV sits in the page with a standby screen and
 * « Join the session ». Once joined, Daily Prebuilt (camera, microphone, screen sharing, chat — the
 * viewer's own short meeting token; nothing loads before « Join ») fills the whole window above
 * the navbars, with a live timer, browser full screen and « Leave » on the bezel.
 * Without Daily, the coaching's meeting link (Zoom / Google Meet) opens in a new tab.
 */

type Join = { mode: "embed"; url: string; token: string } | { mode: "link"; url: string } | { mode: "none"; reason: string; opensAt?: string };

const Logo = ({ className }: { className?: string }) => <Image src="/images/maelenglish-mark-light.webp" alt="MaelEnglish" width={800} height={175} className={cn("h-auto opacity-95", className)} priority />;

export function LiveRoom({ sessionId, title, opensAt, closesAt, backHref, coach }: { sessionId: string; title: string; opensAt: string; closesAt: string; backHref: string; coach: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  const [join, setJoin] = useState<Join | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  const open = now >= new Date(opensAt).getTime();
  const closed = now > new Date(closesAt).getTime();

  if (join?.mode === "embed") return <InCall src={`${join.url}?t=${encodeURIComponent(join.token)}`} title={title} backHref={backHref} />;

  return (
    <div className="relative mx-auto w-full rounded-[1.4rem] bg-gradient-to-b from-[#1d2650] to-[#0b1030] px-2 pt-9 pb-2.5 shadow-[0_30px_60px_-25px_rgb(20_31_77/0.75)] ring-1 ring-white/10 sm:rounded-[2rem] sm:px-3.5 sm:pt-12 sm:pb-4">
      <div className="absolute inset-x-0 top-0 flex h-9 items-center justify-center sm:h-12">
        <Logo className="w-24 sm:w-32" />
        <span aria-hidden className="absolute top-1/2 right-5 size-1.5 -translate-y-1/2 rounded-full bg-[#2a3466] ring-1 ring-white/10 sm:right-7" />
      </div>
      <div className="relative grid min-h-[22rem] place-items-center overflow-hidden rounded-lg bg-[radial-gradient(ellipse_at_center,#ffffff_0%,#eef1fb_75%)] px-5 py-10 text-center text-brand-deep ring-1 ring-black/60 sm:aspect-video sm:min-h-0 sm:rounded-xl">
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgb(54_79_171/0.06),transparent_40%)]" />
        <div className="relative grid justify-items-center gap-4">
          <span className="flex size-16 items-center justify-center rounded-full border-2 border-coral bg-white text-coral shadow-[0_4px_0_0_var(--color-coral)] sm:size-20">
            <Video className="size-8 sm:size-9" aria-hidden />
          </span>
          {join?.mode === "link" ? (
            <>
              <p className="max-w-md text-lg font-semibold">The session takes place on an external video link.</p>
              <a href={join.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center gap-2 rounded-2xl border-2 border-coral bg-white px-6 text-[19px] font-bold text-coral shadow-[0_4px_0_0_var(--color-coral)] hover:bg-coral-soft">
                Open the video call <ExternalLink className="size-5" aria-hidden />
              </a>
            </>
          ) : join?.mode === "none" && join.reason === "no_video" ? (
            <p className="max-w-md text-lg font-semibold">The video call isn&apos;t set up yet. {coach ? "Add a meeting link (Zoom / Google Meet) in the coaching settings." : "Your coach will send you the link."}</p>
          ) : closed ? (
            <p className="max-w-md text-lg font-semibold">This session is over.</p>
          ) : !open ? (
            <>
              <p className="max-w-md font-heading text-xl font-extrabold">The « Join » button opens 10 minutes before the start.</p>
              <p className="text-sm font-semibold text-muted-foreground">Opens at {new Date(opensAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Settle somewhere quiet, with your earphones.</p>
            </>
          ) : (
            <>
              <p className="max-w-md font-heading text-xl font-extrabold text-balance sm:text-2xl">{title}</p>
              <p className="max-w-md text-sm font-semibold text-muted-foreground">{coach ? "You join as the host: you can mute, remove people and share your screen." : "Your coach will meet you here. Allow your camera and microphone when the call opens."}</p>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setError("");
                    const r = await joinSessionAction(sessionId);
                    if (!r.ok) setError(r.error);
                    else setJoin(r.join as Join);
                  })
                }
                className="inline-flex h-12 items-center gap-2 rounded-2xl bg-primary px-6 text-[19px] font-bold text-white shadow-[0_5px_0_0_var(--color-coral)] transition active:translate-y-1 active:shadow-[0_2px_0_0_var(--color-coral)] disabled:opacity-60"
              >
                {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Video className="size-5" aria-hidden />} Join the session
              </button>
            </>
          )}
          {error && <p className="rounded-xl border border-coral bg-white px-3 py-2 text-sm font-semibold text-coral-dark">{error}</p>}
        </div>
      </div>
    </div>
  );
}

/** The call over the whole window: the TV bezel around Daily Prebuilt, above the navbars (no page scroll behind). */
function InCall({ src, title, backHref }: { src: string; title: string; backHref: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [full, setFull] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = "hidden";
    // The « Join » click still counts as a user gesture for a moment: try the browser's full screen too.
    ref.current?.requestFullscreen?.().catch(() => {});
    const onFs = () => setFull(document.fullscreenElement === ref.current);
    document.addEventListener("fullscreenchange", onFs);
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => {
      html.style.overflow = before;
      document.removeEventListener("fullscreenchange", onFs);
      clearInterval(t);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [startedAt]);

  const toggleFull = () => (document.fullscreenElement ? document.exitFullscreen() : ref.current?.requestFullscreen())?.catch(() => {});
  const leave = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    // A full page load: the call stops at once and the next page gets its usual permissions.
    window.location.assign(backHref);
  };
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label={`Live session: ${title}`} className="fixed inset-0 z-[70] flex flex-col bg-gradient-to-b from-[#1d2650] to-[#0b1030] px-1.5 pt-[max(0px,env(safe-area-inset-top))] pb-[max(0.375rem,env(safe-area-inset-bottom))] sm:px-3 sm:pb-3">
      {/* top bezel: live + timer · logo · full screen + leave */}
      <div className="relative grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 px-1.5 text-white sm:h-14 sm:px-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-coral/70 bg-white/5 px-2 py-0.5 text-xs font-bold tracking-wide uppercase">
            <span aria-hidden className="size-2 animate-pulse rounded-full bg-coral" /> Live
          </span>
          <span className="font-mono text-sm text-white/80 tabular-nums" aria-label={`In the call for ${mm} minutes ${ss} seconds`}>
            {mm}:{ss}
          </span>
          <span className="hidden truncate text-sm font-semibold text-white/80 lg:inline">· {title}</span>
        </div>
        <Logo className="w-24 sm:w-32" />
        <div className="flex items-center justify-end gap-1.5">
          <button type="button" onClick={toggleFull} className="hidden size-9 items-center justify-center rounded-xl text-white/85 hover:bg-white/10 sm:flex" aria-label={full ? "Exit full screen" : "Full screen"} title={full ? "Exit full screen" : "Full screen"}>
            {full ? <Minimize2 className="size-4.5" aria-hidden /> : <Maximize2 className="size-4.5" aria-hidden />}
          </button>
          <button type="button" onClick={leave} className="inline-flex h-9 items-center gap-1.5 rounded-xl border-2 border-coral bg-white px-3 text-sm font-bold text-coral-dark hover:bg-coral-soft">
            <LogOut className="size-4" aria-hidden /> <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </div>
      {/* the screen */}
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg bg-black ring-1 ring-black/60 sm:rounded-xl">
        <iframe title="Live coaching session" src={src} allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write; speaker-selection" className="size-full bg-[#0b1030]" />
      </div>
      {/* bottom bezel: tips (wide screens) */}
      <div className="hidden h-9 shrink-0 items-center justify-center gap-6 text-xs text-white/60 md:flex">
        <span className="inline-flex items-center gap-1.5">
          <MonitorUp className="size-3.5" aria-hidden /> Show your screen with « Share »
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Headphones className="size-3.5" aria-hidden /> Weak connection? Turn your camera off: the sound gets better
        </span>
      </div>
    </div>
  );
}
