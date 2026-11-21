"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, Mic, RotateCcw, Square } from "lucide-react";
import { cn } from "cn";

/*
 * Voice recorder shared by speaking activities, coach submissions and coach voice notes.
 * - MediaRecorder with the best codec the browser offers: Opus in WebM (Chrome, Android, Firefox)
 *   or AAC in MP4 (Safari / iOS). Small files for 3G (≈ 24–32 kbps).
 * - Optional preparation countdown, visible recording countdown, automatic stop at `maxSeconds`.
 * - Live input level, listen back, re-record as many times as wanted, then « use » the take.
 * - The microphone is released as soon as recording stops, and when the page is hidden by
 *   <Activity> (Cache Components) or unmounted.
 */

export type Recording = { blob: Blob; mime: string; durationS: number; url: string };

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"];

export function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

/** Monotonic clock (only called from event handlers and timers). */
const clock = () => performance.now();

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

type Phase = "idle" | "prep" | "recording" | "review" | "error";

/** Learners see French; staff screens (admin, Lab) pass `locale="en"`. */
const TEXT = {
  fr: {
    use: "Utiliser cet enregistrement",
    unsupported: "Votre navigateur ne permet pas d’enregistrer. Essayez avec Chrome ou Safari à jour.",
    noMic: "Micro inaccessible : autorisez l’accès au micro dans votre navigateur, puis réessayez.",
    stop: "Arrêter l’enregistrement",
    again: "Recommencer l’enregistrement",
    start: "Commencer l’enregistrement",
    prep: "Préparez-vous…",
    recording: "Enregistrement",
    idle: (max: string) => `Appuyez sur le micro pour enregistrer (maximum ${max}).`,
    review: "Écoutez-vous, puis gardez cet enregistrement ou recommencez.",
  },
  en: {
    use: "Use this recording",
    unsupported: "This browser can't record. Try an up-to-date Chrome or Safari.",
    noMic: "Microphone unavailable: allow microphone access in your browser, then try again.",
    stop: "Stop recording",
    again: "Record again",
    start: "Start recording",
    prep: "Get ready…",
    recording: "Recording",
    idle: (max: string) => `Press the microphone to record (max ${max}).`,
    review: "Listen back, then keep this recording or record again.",
  },
};

export function Recorder({
  maxSeconds,
  prepSeconds = 0,
  onUse,
  useLabel,
  locale = "fr",
  disabled,
  className,
}: {
  maxSeconds: number;
  prepSeconds?: number;
  /** Called with the chosen take. */
  onUse?: (rec: Recording) => void;
  useLabel?: string;
  locale?: "fr" | "en";
  disabled?: boolean;
  className?: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [left, setLeft] = useState(0);
  const [level, setLevel] = useState(0);
  const [take, setTake] = useState<Recording | null>(null);
  const [error, setError] = useState("");
  const t = TEXT[locale];

  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const raf = useRef(0);
  const ctx = useRef<AudioContext | null>(null);

  const stopTimers = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    cancelAnimationFrame(raf.current);
  };
  const releaseMic = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void ctx.current?.close().catch(() => {});
    ctx.current = null;
    setLevel(0);
  };
  const cleanup = () => {
    stopTimers();
    if (recorder.current?.state === "recording") recorder.current.stop();
    releaseMic();
  };

  // Hidden by <Activity> or unmounted: stop recording and free the microphone.
  useLayoutEffect(
    () => () => {
      cleanup();
      setPhase((p) => (p === "recording" || p === "prep" ? "idle" : p));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useEffect(() => () => (take ? URL.revokeObjectURL(take.url) : undefined), [take]);

  const beginRecording = () => {
    const s = stream.current!;
    const mime = pickMime();
    const rec = new MediaRecorder(s, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32000 });
    recorder.current = rec;
    chunks.current = [];
    rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    rec.onstop = () => {
      const durationS = Math.min(maxSeconds, (clock() - startedAt.current) / 1000);
      const type = rec.mimeType || mime || "audio/webm";
      const blob = new Blob(chunks.current, { type });
      setTake({ blob, mime: type, durationS, url: URL.createObjectURL(blob) });
      setPhase("review");
      releaseMic();
    };
    rec.start(1000);
    startedAt.current = clock();
    setPhase("recording");
    setLeft(maxSeconds);
    timer.current = setInterval(() => {
      const remaining = maxSeconds - (clock() - startedAt.current) / 1000;
      setLeft(Math.max(0, remaining));
      if (remaining <= 0) stop();
    }, 200);
    // Live level meter.
    const ac = new AudioContext();
    ctx.current = ac;
    const analyser = ac.createAnalyser();
    analyser.fftSize = 512;
    ac.createMediaStreamSource(s).connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
      setLevel(Math.min(1, peak / 64));
      raf.current = requestAnimationFrame(tick);
    };
    tick();
  };

  const start = async () => {
    setError("");
    if (take) URL.revokeObjectURL(take.url);
    setTake(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setPhase("error");
      setError(t.unsupported);
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setPhase("error");
      setError(t.noMic);
      return;
    }
    if (prepSeconds > 0) {
      setPhase("prep");
      setLeft(prepSeconds);
      const t0 = clock();
      timer.current = setInterval(() => {
        const remaining = prepSeconds - (clock() - t0) / 1000;
        setLeft(Math.max(0, remaining));
        if (remaining <= 0) {
          stopTimers();
          beginRecording();
        }
      }, 200);
    } else beginRecording();
  };

  const stop = () => {
    stopTimers();
    if (recorder.current?.state === "recording") recorder.current.stop();
  };

  const recording = phase === "recording";
  return (
    <div className={cn("grid gap-3 rounded-3xl border-2 border-border bg-card p-4 sm:p-5", className)}>
      <div className="flex items-center gap-4">
        {recording ? (
          <button
            type="button"
            onClick={stop}
            className="flex size-16 shrink-0 items-center justify-center rounded-full bg-destructive text-white shadow-[0_5px_0_0_#991b1b] active:translate-y-1 active:shadow-[0_1px_0_0_#991b1b]"
            aria-label={t.stop}
          >
            <Square className="size-6 fill-current" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void start()}
            disabled={disabled || phase === "prep"}
            className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-[0_5px_0_0_var(--color-brand-dark)] active:translate-y-1 active:shadow-[0_1px_0_0_var(--color-brand-dark)] disabled:opacity-50"
            aria-label={take ? t.again : t.start}
          >
            {take ? <RotateCcw className="size-6" aria-hidden /> : <Mic className="size-7" aria-hidden />}
          </button>
        )}
        <div className="min-w-0 flex-1" aria-live="polite">
          {phase === "prep" && <p className="font-heading text-lg font-extrabold text-brand-deep">{t.prep} {Math.ceil(left)}</p>}
          {recording && (
            <>
              <p className="flex items-center gap-2 font-heading text-lg font-extrabold text-brand-deep">
                <span className="size-2.5 animate-pulse rounded-full bg-destructive motion-reduce:animate-none" aria-hidden /> {t.recording} · {fmt(left)}
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className="h-full rounded-full bg-primary transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
              </div>
            </>
          )}
          {phase === "idle" && <p className="text-sm text-muted-foreground">{t.idle(fmt(maxSeconds))}</p>}
          {phase === "review" && take && <p className="text-sm font-semibold text-brand-deep">{t.review}</p>}
          {phase === "error" && <p className="text-sm font-semibold text-coral-dark">{error}</p>}
        </div>
      </div>
      {phase === "review" && take && (
        <div className="grid gap-3">
          <audio src={take.url} controls className="w-full" />
          {onUse && (
            <button type="button" onClick={() => onUse(take)} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-5 font-bold text-white hover:brightness-110">
              <Check className="size-5" aria-hidden /> {useLabel ?? t.use}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
