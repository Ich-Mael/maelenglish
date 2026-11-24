"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, Headphones, Loader2, MonitorUp, Video } from "lucide-react";
import { joinSessionAction } from "@/app/coaching-actions";

/*
 * The live session: Daily Prebuilt embedded in an iframe (camera, microphone, screen sharing,
 * chat), joined with the viewer's own short meeting token — nothing loads before « Join ».
 * Without Daily, the coaching's meeting link (Zoom / Google Meet) opens in a new tab.
 */

type Join = { mode: "embed"; url: string; token: string } | { mode: "link"; url: string } | { mode: "none"; reason: string; opensAt?: string };

export function LiveRoom({ sessionId, opensAt, closesAt, backHref, coach }: { sessionId: string; opensAt: string; closesAt: string; backHref: string; coach: boolean }) {
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

  if (join?.mode === "embed") {
    const src = `${join.url}?t=${encodeURIComponent(join.token)}`;
    return (
      <div className="grid gap-3">
        <div className="overflow-hidden rounded-3xl border-4 border-brand-deep bg-brand-deep shadow-xl">
          <iframe title="Live coaching session" src={src} allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write; speaker-selection" className="h-[min(78vh,760px)] min-h-[480px] w-full bg-brand-deep" />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <MonitorUp className="size-4 text-primary" aria-hidden /> Share your screen with the « Share » button in the call.
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Headphones className="size-4 text-primary" aria-hidden /> Weak connection? Turn your camera off: the sound gets better.
          </span>
          <Link href={backHref} className="ml-auto font-semibold text-primary hover:underline">
            Leave and go back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid place-items-center gap-4 rounded-3xl bg-gradient-to-br from-brand-deep to-brand-dark px-6 py-12 text-center text-white">
      <span className="flex size-16 items-center justify-center rounded-full border-2 border-coral bg-white text-coral">
        <Video className="size-8" aria-hidden />
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
          <p className="max-w-md text-lg font-semibold">The « Join » button opens 10 minutes before the start.</p>
          <p className="text-sm text-white/75">Opens at {new Date(opensAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Settle somewhere quiet, with your earphones.</p>
        </>
      ) : (
        <>
          <p className="max-w-md text-lg font-semibold">{coach ? "You join as the host: you can mute, remove people and share your screen." : "Your coach will meet you here. Check your microphone and camera when the call opens."}</p>
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
            className="inline-flex h-12 items-center gap-2 rounded-2xl border-2 border-coral bg-white px-6 text-[19px] font-bold text-coral shadow-[0_4px_0_0_var(--color-coral)] hover:bg-coral-soft disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Video className="size-5" aria-hidden />} Join the session
          </button>
        </>
      )}
      {error && <p className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-coral-dark">{error}</p>}
    </div>
  );
}
