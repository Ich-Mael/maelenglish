"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, Pause, Play, Square } from "lucide-react";
import { phraseAccuracy } from "@/lib/lab/speech";
import { SHADOW_GOAL, cheerFor } from "@/lib/shadowing";

export { SHADOW_GOAL };
import { useVoice } from "@/components/learn/word-card";
import { playSound } from "@/components/gamify/sound";
import { cn } from "cn";

/*
 * Shadowing practice on a group sentence (the corrected version when it was wrong), in the
 * « See all the examples » modal: hear the model, say it, get the share of words understood
 * (the browser's free speech recognition — words, not the accent; goal SHADOW_GOAL %) with an
 * animated cheer, and listen back to yourself. **Nothing is uploaded or saved**: the recording
 * stays in the page's memory (a blob URL, released on the next try / when closed) — owner
 * decision 2026-11-25, practice only.
 */


type SR = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
const recognitionCtor = (): (new () => SR) | null => {
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};
const noSubscribe = () => () => {};
const useSupport = () =>
  useSyncExternalStore(
    noSubscribe,
    () => (recognitionCtor() ? "recognition" : typeof MediaRecorder !== "undefined" ? "record" : "none"),
    () => "recognition",
  );

export function Shadowing({ text, fr, listen }: { text: string; fr?: string; listen?: React.ReactNode }) {
  const support = useSupport();
  const voice = useVoice();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [heard, setHeard] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [best, setBest] = useState(0);
  const [error, setError] = useState("");
  const [mine, setMine] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const rec = useRef<SR | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const back = useRef<HTMLAudioElement>(null);
  // Some phones can't record and recognise at once: after a clash, recognition only.
  const noRecord = useRef(false);
  const cheerBox = useRef<HTMLDivElement>(null);
  // Show the cheer (it may be below the fold on phones).
  useEffect(() => {
    if (tries) cheerBox.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [tries]);

  const stopMic = () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };
  // Release the microphone and the recording when the row goes away (modal closed).
  useEffect(
    () => () => {
      rec.current?.abort();
      stopMic();
    },
    [],
  );
  useEffect(() => () => void (mine && URL.revokeObjectURL(mine)), [mine]);

  // The recording to listen back to: in memory only.
  const startRecorder = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      stream.current = s;
      const r = new MediaRecorder(s);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        if (chunks.length) setMine(URL.createObjectURL(new Blob(chunks, { type: r.mimeType || "audio/webm" })));
      };
      recorder.current = r;
      r.start();
      return true;
    } catch {
      return false;
    }
  };

  const finish = (alternatives: string[]) => {
    if (!alternatives.length) return;
    const top = alternatives.map((h) => ({ h, p: phraseAccuracy(text, h).percent })).reduce((a, b) => (b.p > a.p ? b : a));
    setHeard(top.h);
    setTries((n) => n + 1);
    setBest((b) => Math.max(b, top.p));
    playSound(top.p >= SHADOW_GOAL ? "correct" : "wrong");
  };

  const start = async () => {
    if (listening) return;
    setError("");
    setInterim("");
    back.current?.pause();
    document.querySelectorAll("dialog audio").forEach((a) => (a as HTMLAudioElement).pause());
    if (mine) setMine(null);
    const Ctor = recognitionCtor();
    if (!Ctor) {
      // No speech recognition (Firefox, some iPhones): record and compare by ear.
      if (await startRecorder()) setListening(true);
      else setError("Allow the microphone in your browser to record yourself.");
      return;
    }
    const r = new Ctor();
    r.lang = voice === "gb" ? "en-GB" : "en-US";
    r.interimResults = true;
    r.maxAlternatives = 3;
    r.continuous = false;
    const finals: string[] = [];
    r.onresult = (e) => {
      let t = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) for (let k = 0; k < res.length; k++) finals.push(res[k].transcript);
        else t += res[0].transcript;
      }
      setInterim(t);
    };
    r.onerror = (e) =>
      setError(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Allow the microphone in your browser to record yourself."
          : e.error === "no-speech"
            ? "We didn't hear anything: speak a little louder, close to the phone."
            : e.error === "network"
              ? "Speech recognition needs the internet: check your connection."
              : e.error === "audio-capture"
                ? noRecord.current
                  ? "The microphone is busy: close other apps using it and try again."
                  : ((noRecord.current = true), "Tap the mic again (listening back is off on this phone).")
                : "",
      );
    r.onend = () => {
      setListening(false);
      setInterim("");
      rec.current = null;
      stopMic();
      finish(finals);
    };
    rec.current = r;
    setListening(true);
    try {
      r.start();
      // Listening back is a bonus: if the phone can't record and recognise at once, recognition wins.
      if (!noRecord.current) void startRecorder();
    } catch {
      setListening(false);
    }
  };
  const stop = () => {
    if (rec.current) rec.current.stop();
    else {
      stopMic();
      setListening(false);
    }
  };

  const acc = heard !== null ? phraseAccuracy(text, heard) : null;
  const cheer = acc ? cheerFor(acc.percent) : null;

  return (
    <div className="mt-3 grid gap-3 rounded-2xl border-2 border-primary/15 bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold tracking-wide text-brand-deep uppercase">Shadowing practice</p>
        {support === "recognition" && (
          <p className="text-sm text-muted-foreground">
            Goal: <b className="text-primary">{SHADOW_GOAL}%</b>
            {tries > 0 && (
              <>
                {" "}
                · Best: <b className={best >= SHADOW_GOAL ? "text-primary" : "text-coral-dark"}>{best}%</b>
              </>
            )}
          </p>
        )}
      </div>
      <p className="text-[15px] text-muted-foreground">Listen to the sentence, then tap the mic and say it the same way.</p>

      {/* The sentence: each word blue (understood) or red (missed) after a try. */}
      <p lang="en" className="text-xl leading-relaxed font-semibold text-ink sm:text-2xl">
        {acc
          ? acc.words.map((w, i) => (
              <span key={i} className={cn("mr-1.5 inline-block", w.heard ? "text-primary" : "text-coral-dark underline decoration-coral decoration-2 underline-offset-4")}>
                {w.word}
              </span>
            ))
          : text}
      </p>
      {fr && (
        <p lang="fr" className="-mt-2 text-base text-muted-foreground italic">
          {fr}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {listen}
        <button
          type="button"
          onClick={listening ? stop : start}
          disabled={support === "none"}
          aria-label={listening ? "Stop" : "Record myself"}
          className={cn(
            "inline-flex h-14 items-center gap-2 rounded-full px-5 text-base font-bold transition-colors disabled:opacity-50",
            listening ? "bg-destructive text-white" : "border-2 border-coral bg-white text-coral-dark shadow-[0_3px_0_0_var(--color-coral)] hover:bg-coral-soft",
          )}
        >
          {listening ? <Square className="size-5 fill-current" aria-hidden /> : <Mic className="size-6" aria-hidden />}
          {listening ? "Stop" : tries ? "Try again" : "Record myself"}
          {listening && <span className="size-2.5 animate-pulse rounded-full bg-white" aria-hidden />}
        </button>
        {mine && !listening && (
          <button
            type="button"
            onClick={() => {
              const a = back.current;
              if (!a) return;
              if (playing) a.pause();
              else void a.play();
            }}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-brand-soft px-4 text-base font-semibold text-primary hover:bg-primary hover:text-white"
          >
            {playing ? <Pause className="size-5" aria-hidden /> : <Play className="size-5" aria-hidden />} My recording
          </button>
        )}
        <audio ref={back} src={mine ?? undefined} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} className="hidden" />
      </div>

      {listening && <p className="min-h-6 text-base text-muted-foreground italic">{interim || "Listening…"}</p>}
      {error && <p className="text-base font-semibold text-coral-dark">{error}</p>}
      {support === "record" && !error && <p className="text-sm text-muted-foreground">This browser can&apos;t check what you say: record yourself and compare with the model by ear (Chrome gives a score).</p>}

      {acc && cheer && !listening && (
        <div key={tries} ref={cheerBox} role="status" className={cn("flex items-center gap-4 rounded-2xl p-4", cheer.good ? "bg-gradient-to-br from-brand-deep to-primary text-white" : "border-2 border-coral/40 bg-coral-soft/50 text-ink")}>
          <span className="animate-cheer-icon text-5xl leading-none" aria-hidden>
            {cheer.emoji}
          </span>
          <div className="animate-cheer min-w-0 flex-1">
            <p className="font-heading text-2xl font-extrabold sm:text-3xl">{cheer.text}</p>
            <p className={cn("text-base", cheer.good ? "text-white/85" : "text-muted-foreground")}>
              <b className={cn("text-xl", cheer.good ? "text-white" : "text-coral-dark")}>{acc.percent}%</b> of the words understood
              {cheer.good ? "" : ` · aim for ${SHADOW_GOAL}%`}
            </p>
            {heard && (
              <p lang="en" className={cn("mt-1 text-sm italic", cheer.good ? "text-white/75" : "text-muted-foreground")}>
                We heard: « {heard} »
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
