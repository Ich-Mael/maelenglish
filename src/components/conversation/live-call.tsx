"use client";

import { useEffect, useRef, useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { Captions, CaptionsOff, LifeBuoy, Loader2, Mic, MicOff, PhoneOff, X } from "lucide-react";
import { attachRolePlayAction, rolePlayHelpAction } from "@/app/(app)/conversation-actions";
import type { HelpSuggestion } from "@/lib/ai/types";
import { cn } from "cn";

/*
 * The live call (ElevenLabs Agents over a WebSocket, signed URL from our server). Loaded with
 * next/dynamic only when the learner presses « Start », so the SDK never weighs on other pages.
 * Hands-free turn-taking (ElevenLabs has no push-to-talk: « Mute » pauses the microphone), live
 * transcript (can be hidden for a harder challenge), « Help » (2–3 things to say, AIC-01), a
 * countdown that ends the call at the session limit. `onEnded` fires once, however the call ends.
 */

export type LiveLine = { role: "agent" | "user"; text: string };

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

type Props = { sessionId: string; signedUrl: string; limitS: number; aiName: string; avatarSrc: string; onEnded: (reason: "user" | "time" | "agent" | "error", error?: string) => void };

export default function LiveCall(props: Props) {
  return (
    <ConversationProvider>
      <Call {...props} />
    </ConversationProvider>
  );
}

function Call({ sessionId, signedUrl, limitS, aiName, avatarSrc, onEnded }: Props) {
  const [lines, setLines] = useState<LiveLine[]>([]);
  const [showText, setShowText] = useState(true);
  const [left, setLeft] = useState(limitS);
  const [help, setHelp] = useState<HelpSuggestion[] | null>(null);
  const [helpBusy, setHelpBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const ended = useRef(false);
  const linesRef = useRef<LiveLine[]>([]);
  const scroller = useRef<HTMLOListElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  const finish = (reason: "user" | "time" | "agent" | "error", error?: string) => {
    if (ended.current) return;
    ended.current = true;
    onEnded(reason, error);
  };

  const conv = useConversation({
    onConnect: ({ conversationId }) => {
      void attachRolePlayAction(sessionId, conversationId).then((r) => !r.ok && setNotice(r.error ?? ""));
    },
    onMessage: ({ message, role }) => {
      // Audio tags (« [friendly] ») are for the voice, not for reading.
      const text = (role === "agent" ? message?.replace(/\[[a-z][a-z ,'-]{0,30}\]\s*/gi, "") : message)?.replace(/\s{2,}/g, " ").trim();
      if (!text) return;
      const next = [...linesRef.current, { role, text }];
      linesRef.current = next;
      setLines(next);
      if (role === "agent") setHelp(null);
    },
    onDisconnect: () => finish("agent"),
    onError: (message) => {
      console.error("[roleplay] call error", message);
      finish("error", "The connection was lost. Your conversation so far is saved.");
    },
  });
  const { startSession, endSession, status, isSpeaking, isMuted, setMuted, getOutputVolume, getInputVolume } = conv;

  // Avatar animation: the real audio levels → CSS variables, every frame (smoothed). No re-render.
  useEffect(() => {
    if (status !== "connected") return;
    let raf = 0;
    let out = 0;
    let inp = 0;
    const tick = () => {
      const o = Math.min(1, (getOutputVolume?.() ?? 0) * 1.6);
      const i = Math.min(1, (getInputVolume?.() ?? 0) * 2);
      out += (o - out) * (o > out ? 0.5 : 0.15);
      inp += (i - inp) * (i > inp ? 0.5 : 0.15);
      stage.current?.style.setProperty("--out", out.toFixed(3));
      stage.current?.style.setProperty("--in", inp.toFixed(3));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status, getOutputVolume, getInputVolume]);

  // Start once (the component is mounted for one call).
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    startSession({ signedUrl, connectionType: "websocket" });
  }, [startSession, signedUrl]);

  // Countdown (from when the call is connected).
  useEffect(() => {
    if (status !== "connected") return;
    const t0 = performance.now();
    const id = setInterval(() => {
      const remaining = limitS - (performance.now() - t0) / 1000;
      setLeft(Math.max(0, remaining));
      if (remaining <= 0) {
        clearInterval(id);
        endSession();
        finish("time");
      }
    }, 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Hidden by <Activity> or unmounted: hang up.
  useEffect(
    () => () => {
      if (!ended.current) {
        endSession();
        finish("user");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    scroller.current?.lastElementChild?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [lines, showText]);

  const askHelp = async () => {
    setHelpBusy(true);
    const r = await rolePlayHelpAction(sessionId, linesRef.current);
    setHelpBusy(false);
    if (r.ok) setHelp(r.suggestions);
    else setNotice(r.error);
  };

  const hangUp = () => {
    endSession();
    finish("user");
  };

  const connecting = status !== "connected";
  return (
    <div className="grid gap-4">
      <div ref={stage} className={cn("partner-stage relative grid place-items-center gap-4 overflow-clip rounded-[2rem] bg-gradient-to-b from-brand-deep via-brand-deep to-brand-dark px-4 pt-10 pb-7 text-white", !isSpeaking && "partner-idle")}>
        <span aria-hidden className="pointer-events-none absolute -top-20 left-1/2 size-80 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgb(54_79_171/0.9),transparent_70%)]" />
        <p className="absolute top-3 right-4 rounded-full bg-white/15 px-2.5 py-1 font-mono text-sm font-bold tabular-nums" aria-label={`Time left ${fmt(left)}`}>
          {fmt(left)}
        </p>
        <span className="relative flex size-44 items-center justify-center sm:size-52">
          {/* Rings driven by the partner's voice level. */}
          <span aria-hidden className="partner-ring-2 absolute inset-0 rounded-full border-2 border-white/60" />
          <span aria-hidden className="partner-ring absolute inset-0 rounded-full bg-white/15" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatarSrc} alt="" width={256} height={256} className={cn("partner-face relative size-40 rounded-full object-cover ring-4 sm:size-48", isSpeaking ? "ring-white" : "ring-white/40")} />
          {/* The learner's own voice: the red mic pulses with it. */}
          {!connecting && !isSpeaking && !isMuted && (
            <span className="absolute -right-1 -bottom-1 flex size-12 items-center justify-center rounded-full border-4 border-brand-deep bg-white">
              <span aria-hidden className="partner-mic absolute inset-0 rounded-full bg-coral/40" />
              <Mic className="relative size-5 text-coral" aria-hidden />
            </span>
          )}
        </span>
        <div className="relative grid gap-1 text-center">
          <p className="font-heading text-xl font-extrabold">{aiName}</p>
          <p className="flex items-center justify-center gap-2 text-sm text-white/80" aria-live="polite">
            {connecting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden /> Connecting…
              </>
            ) : isMuted ? (
              "Microphone paused"
            ) : isSpeaking ? (
              "Speaking…"
            ) : (
              <>
                <span className="size-2 animate-pulse rounded-full bg-coral motion-reduce:animate-none" aria-hidden /> Your turn: speak
              </>
            )}
          </p>
        </div>
      </div>

      {notice && (
        <p role="alert" className="flex items-start gap-2 rounded-2xl border-2 border-coral bg-white px-3 py-2 text-sm font-semibold text-coral-dark">
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice("")} aria-label="Dismiss">
            <X className="size-4" aria-hidden />
          </button>
        </p>
      )}

      {help && (
        <div className="grid gap-2 rounded-2xl border-2 border-primary/30 bg-brand-soft p-3" role="status">
          <p className="flex items-center justify-between text-sm font-bold text-primary">
            You could say…
            <button type="button" onClick={() => setHelp(null)} aria-label="Close the suggestions" className="rounded-lg p-1 hover:bg-white">
              <X className="size-4" aria-hidden />
            </button>
          </p>
          <ul className="grid gap-1.5">
            {help.map((s, i) => (
              <li key={i} className="rounded-xl bg-white px-3 py-2">
                <p lang="en" className="font-semibold text-brand-deep">
                  {s.en}
                </p>
                <p lang="fr" className="text-xs text-muted-foreground">
                  {s.fr}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-4 gap-2">
        <CallButton onClick={() => setMuted(!isMuted)} disabled={connecting} active={isMuted} label={isMuted ? "Unmute" : "Mute"} icon={isMuted ? MicOff : Mic} />
        <CallButton onClick={() => void askHelp()} disabled={connecting || helpBusy} label="Help" icon={helpBusy ? Loader2 : LifeBuoy} spin={helpBusy} />
        <CallButton onClick={() => setShowText((v) => !v)} label={showText ? "Hide text" : "Show text"} icon={showText ? CaptionsOff : Captions} />
        <button type="button" onClick={hangUp} className="grid h-16 place-items-center gap-0.5 rounded-2xl bg-destructive px-2 text-xs font-bold text-white shadow-[0_4px_0_0_#991b1b] active:translate-y-1 active:shadow-none">
          <PhoneOff className="size-5" aria-hidden /> End
        </button>
      </div>

      {showText ? (
        <ol ref={scroller} className="grid max-h-[45vh] gap-2 overflow-y-auto rounded-3xl border border-border bg-card p-3" aria-label="Live transcript" aria-live="polite">
          {lines.length === 0 && <li className="text-center text-sm text-muted-foreground">The conversation will appear here.</li>}
          {lines.map((l, i) => (
            <li key={i} lang="en" className={cn("max-w-[88%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug", l.role === "user" ? "justify-self-end rounded-tr-sm bg-brand-soft text-brand-deep" : "justify-self-start rounded-tl-sm bg-muted text-ink")}>
              <span className="sr-only">{l.role === "user" ? "You: " : `${aiName}: `}</span>
              {l.text}
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-3xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">Text hidden: listen carefully. You&apos;ll get the full transcript in your debrief.</p>
      )}
    </div>
  );
}

function CallButton({ onClick, disabled, active, label, icon: Icon, spin }: { onClick: () => void; disabled?: boolean; active?: boolean; label: string; icon: React.ComponentType<{ className?: string }>; spin?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn("grid h-16 place-items-center gap-0.5 rounded-2xl border-2 px-2 text-xs font-bold disabled:opacity-50", active ? "border-coral bg-coral-soft text-coral-dark" : "border-border bg-card text-brand-deep hover:bg-brand-soft")}
    >
      <Icon className={cn("size-5", spin && "animate-spin")} aria-hidden /> {label}
    </button>
  );
}
