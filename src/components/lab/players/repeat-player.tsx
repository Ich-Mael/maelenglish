"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Mic, Pause, Play, Speech, Volume2 } from "lucide-react";
import { submitLabAttempt } from "@/app/(app)/learn-actions";
import { pushReward } from "@/components/gamify/reward-store";
import { playSound } from "@/components/gamify/sound";
import { gradeActivity } from "@/lib/lab/grade";
import { starsFor } from "@/lib/lab/meta";
import { REPEAT_PASS, SELF_OK, SELF_REDO, phraseAccuracy } from "@/lib/lab/speech";
import type { RepeatContent, RepeatPhrase } from "@/lib/lab/types";
import { Recorder } from "@/components/audio/recorder";
import { ExerciseHeader, ResultsScreen, type ExerciseMeta } from "../shell/parts";
import { cn } from "cn";

/*
 * S1 — Répétez après Mael (catalogue): one phrase per screen. The learner hears Mael's model, taps
 * the mic and repeats; the browser's speech recognition (free, en-US) gives what it heard, and each
 * word of the phrase is shown heard (blue) or missed (red) with a percentage — the words
 * understood, not the accent. Retries allowed, the best try counts (≥ REPEAT_PASS % = right).
 * Browsers without recognition (some Android browsers, older iPhones): record, listen back next to
 * the model and self-assess — never a made-up score. The server re-scores the transcripts
 * (`submitLabAttempt`). `preview` (Lab page): graded locally.
 */

type Result = { score: number; stars: number; bestScore?: number; xp?: number; items: { id: string; correct: boolean }[] };
type Attempt = { heard: string; percent: number } | { self: "ok" | "redo" };

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

/** The phrase, each word blue (heard) or red (missed) once tried. */
function Words({ text, heard }: { text: string; heard?: string }) {
  const acc = heard !== undefined ? phraseAccuracy(text, heard) : null;
  return (
    <p lang="en" className="flex flex-wrap gap-x-1.5 gap-y-1 font-heading text-xl leading-snug font-extrabold sm:text-2xl">
      {(acc?.words ?? text.split(/\s+/).map((word) => ({ word, heard: true }))).map((w, i) => (
        <span key={i} className={cn("rounded-md px-1", !acc ? "text-brand-deep" : w.heard ? "bg-brand-soft text-primary" : "bg-coral-soft text-coral-dark underline decoration-coral decoration-2 underline-offset-4")}>
          {w.word}
        </span>
      ))}
    </p>
  );
}

export function RepeatPlayer({
  courseId,
  stepId,
  passScore,
  lessonHref,
  title,
  level,
  skills,
  instructions,
  maelTip,
  content,
  audioUrls,
  courseHref,
  nextHref,
  readOnly,
  preview,
}: {
  courseId?: string;
  stepId?: string;
  passScore?: number | null;
  lessonHref?: string | null;
  title: string;
  level?: string;
  skills?: string[];
  instructions?: string;
  maelTip?: string;
  content: RepeatContent;
  audioUrls: Record<string, string>;
  courseHref: string;
  nextHref: string;
  readOnly?: boolean;
  preview?: boolean;
}) {
  const router = useRouter();
  // null while server-rendering / hydrating, then whether the browser has speech recognition.
  const canRecognise = useSyncExternalStore(noSubscribe, () => !!recognitionCtor(), () => null);
  const phrases = content.phrases;
  const [index, setIndex] = useState(0);
  const [best, setBest] = useState<Record<string, Attempt>>({});
  const [last, setLast] = useState<Attempt | null>(null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [micError, setMicError] = useState("");
  const [own, setOwn] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [timeS, setTimeS] = useState(0);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const audio = useRef<HTMLAudioElement>(null);
  const rec = useRef<SR | null>(null);
  const startedAt = useRef<number | null>(null);

  // Leaving the page (or Cache Components hiding it) stops the mic.
  useEffect(() => () => rec.current?.abort(), []);

  const ph: RepeatPhrase | undefined = phrases[index];
  const isLast = index === phrases.length - 1;
  const meta: ExerciseMeta = { title, typeLabel: "Répétez après Mael", icon: Speech, level, skills, instructions: instructions || "Écoutez Mael, puis répétez la phrase à voix haute." };
  const modelUrl = ph?.audioMediaId ? audioUrls[ph.audioMediaId] : undefined;

  const playModel = (p?: RepeatPhrase) => {
    const target = p ?? ph;
    const src = target?.audioMediaId ? audioUrls[target.audioMediaId] : undefined;
    const a = audio.current;
    if (!a || !src) return;
    if (!p && playing) return a.pause();
    startedAt.current ??= Date.now();
    if (a.getAttribute("src") !== src) a.src = src;
    a.currentTime = 0;
    setPlaying(true);
    void a.play().catch(() => setPlaying(false));
  };

  const keep = (a: Attempt) => {
    if (!ph) return;
    setLast(a);
    setBest((b) => {
      const prev = b[ph.id];
      const score = (x?: Attempt) => (!x ? -1 : "self" in x ? (x.self === "ok" ? 100 : 0) : x.percent);
      return score(a) >= score(prev) ? { ...b, [ph.id]: a } : b;
    });
  };

  const listen = () => {
    const Ctor = recognitionCtor();
    if (!Ctor || !ph || listening) return;
    audio.current?.pause();
    startedAt.current ??= Date.now();
    setMicError("");
    setInterim("");
    setLast(null);
    const r = new Ctor();
    r.lang = "en-US";
    r.interimResults = true;
    r.maxAlternatives = 3;
    r.continuous = false;
    const finals: string[] = [];
    r.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) for (let k = 0; k < res.length; k++) finals.push(res[k].transcript);
        else text += res[0].transcript;
      }
      setInterim(text);
    };
    r.onerror = (e) => {
      setMicError(e.error === "not-allowed" || e.error === "service-not-allowed" ? "Autorisez le micro dans votre navigateur pour vous enregistrer." : e.error === "no-speech" ? "Nous n'avons rien entendu : parlez un peu plus fort, près du téléphone." : e.error === "network" ? "La reconnaissance vocale a besoin d'internet : vérifiez votre connexion." : "");
    };
    r.onend = () => {
      setListening(false);
      setInterim("");
      rec.current = null;
      if (!finals.length) return;
      // Keep the alternative closest to the phrase.
      const scored = finals.map((heard) => ({ heard, percent: phraseAccuracy(ph.text, heard).percent }));
      const top = scored.reduce((a, b) => (b.percent > a.percent ? b : a));
      playSound(top.percent >= REPEAT_PASS ? "correct" : "wrong");
      keep(top);
    };
    rec.current = r;
    setListening(true);
    try {
      r.start();
    } catch {
      setListening(false);
    }
  };
  const stopListening = () => rec.current?.stop();

  const goNext = () => {
    rec.current?.abort();
    audio.current?.pause();
    setLast(null);
    setOwn(null);
    setMicError("");
    if (!isLast) {
      setIndex((i) => i + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const answers = Object.fromEntries(phrases.map((p) => [p.id, ((a?: Attempt) => (!a ? "" : "self" in a ? (a.self === "ok" ? SELF_OK : SELF_REDO) : a.heard))(best[p.id])]));
    const timeSpentS = startedAt.current ? Math.round((Date.now() - startedAt.current) / 1000) : 0;
    setTimeS(timeSpentS);
    if (preview || !courseId || !stepId) {
      const g = gradeActivity("repeat_after", content, answers);
      setResult({ score: g.score, stars: starsFor(g.score), items: g.items });
      return;
    }
    setError("");
    start(async () => {
      const r = await submitLabAttempt(courseId, stepId, { answers, timeSpentS });
      if (!r.ok) return setError(r.error);
      pushReward(r.result.reward);
      setResult({ ...r.result, xp: r.result.reward?.xpGained });
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };
  const restart = () => {
    setIndex(0);
    setBest({});
    setLast(null);
    setOwn(null);
    setResult(null);
    startedAt.current = null;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (result) {
    return (
      <div className="mx-auto grid max-w-2xl gap-5">
        <audio ref={audio} preload="none" onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} />
        <ExerciseHeader meta={meta} courseHref={courseHref} index={phrases.length} total={phrases.length} done />
        <ResultsScreen score={result.score} stars={result.stars} timeS={timeS} xp={result.xp} bestScore={result.bestScore} review={[]} maelTip={maelTip} preview={preview} passScore={passScore} lessonHref={lessonHref} onRetry={restart} onContinue={() => router.push(nextHref)}>
          <section className="grid gap-3 rounded-3xl border-2 border-border bg-card p-5">
            <h2 className="font-heading text-lg font-extrabold text-brand-deep">Vos phrases</h2>
            <ul className="grid gap-2">
              {phrases.map((p) => {
                const a = best[p.id];
                const pct = a && "percent" in a ? a.percent : null;
                return (
                  <li key={p.id} className="grid gap-1 rounded-2xl bg-muted/50 px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">{a && "heard" in a ? <Words text={p.text} heard={a.heard} /> : <Words text={p.text} />}</div>
                      <button type="button" onClick={() => playModel(p)} className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-primary" aria-label="Réécouter Mael">
                        <Volume2 className="size-4" aria-hidden />
                      </button>
                    </div>
                    <p className="text-xs font-semibold text-muted-foreground">
                      {pct !== null ? `${pct} % des mots compris` : a && "self" in a ? (a.self === "ok" ? "Auto-évaluation : bien dit" : "Auto-évaluation : à retravailler") : "Pas d'essai"}
                      {p.translation && ` · ${p.translation}`}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        </ResultsScreen>
      </div>
    );
  }

  if (!ph) return null;
  const tried = !!best[ph.id];
  const lastPct = last && "percent" in last ? last.percent : null;

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <audio ref={audio} preload="none" onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} />
      <ExerciseHeader meta={meta} courseHref={courseHref} index={index} total={phrases.length} />

      <section className="grid gap-4 rounded-3xl border-2 border-border bg-card p-4 sm:p-6">
        <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
          Phrase {index + 1} sur {phrases.length}
        </p>
        {/* 1. Hear Mael. */}
        <button type="button" onClick={() => playModel()} disabled={!modelUrl} className="flex items-center gap-3 rounded-2xl border-2 border-primary/25 bg-brand-soft p-3 text-left transition hover:border-primary/50">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-[0_4px_0_0_var(--color-brand-dark)]">
            {playing ? <Pause className="size-5" aria-hidden /> : <Play className="size-5 translate-x-px" aria-hidden />}
          </span>
          <span className="grid">
            <span className="font-heading font-extrabold text-brand-deep">Écoutez Mael</span>
            <span className="text-sm text-muted-foreground">Autant de fois que vous voulez.</span>
          </span>
        </button>

        <div className="grid gap-1">
          <Words text={ph.text} heard={last && "heard" in last ? last.heard : undefined} />
          {ph.translation && <p className="text-sm text-muted-foreground">{ph.translation}</p>}
        </div>

        {/* 2. Repeat. */}
        {canRecognise === true && (
          <div className="grid justify-items-center gap-3 pt-1">
            <button
              type="button"
              onClick={listening ? stopListening : listen}
              disabled={readOnly}
              className={cn(
                "relative flex size-20 items-center justify-center rounded-full border-[3px] border-b-[7px] bg-white transition active:translate-y-1 active:border-b-[3px]",
                listening ? "border-destructive bg-destructive text-white" : "border-coral text-coral hover:bg-coral-soft",
              )}
              aria-label={listening ? "Arrêter" : "Répéter la phrase"}
            >
              {listening && <span className="absolute -inset-2 animate-ping rounded-full border-4 border-coral/40 motion-reduce:animate-none" aria-hidden />}
              <Mic className="size-9" aria-hidden />
            </button>
            <p className="text-sm font-semibold text-brand-deep" aria-live="polite">
              {listening ? (interim ? `« ${interim} »` : "Je vous écoute… parlez maintenant") : tried ? "Réessayez pour améliorer votre score" : "Appuyez, puis répétez la phrase"}
            </p>
            {lastPct !== null && (
              <p role="status" className={cn("rounded-full px-3 py-1 text-sm font-bold", lastPct >= REPEAT_PASS ? "bg-gradient-to-r from-primary to-brand-deep text-white" : "border-2 border-coral bg-white text-coral-dark")}>
                {lastPct >= REPEAT_PASS ? `Bien dit ! ${lastPct} % des mots compris` : `${lastPct} % des mots compris : réécoutez Mael et réessayez`}
              </p>
            )}
            {micError && <p className="text-center text-sm font-semibold text-coral-dark">{micError}</p>}
          </div>
        )}
        {canRecognise === false && (
          // No speech recognition here: record, compare with Mael, self-assess.
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">Votre navigateur ne sait pas reconnaître la voix : enregistrez-vous, comparez avec Mael, puis évaluez-vous honnêtement.</p>
            {!own ? (
              <Recorder key={`${ph.id}:${index}`} maxSeconds={15} onUse={(r) => setOwn(URL.createObjectURL(r.blob))} useLabel="Comparer avec Mael" />
            ) : (
              <div className="grid gap-2">
                <p className="text-xs font-semibold text-muted-foreground">Vous</p>
                <audio src={own} controls className="w-full" />
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => keep({ self: "ok" })} className={cn("h-12 rounded-2xl border-2 font-bold", last && "self" in last && last.self === "ok" ? "border-primary bg-primary text-white" : "border-primary/40 bg-white text-primary")}>
                    Je l&apos;ai bien dit
                  </button>
                  <button type="button" onClick={() => keep({ self: "redo" })} className={cn("h-12 rounded-2xl border-2 font-bold", last && "self" in last && last.self === "redo" ? "border-coral bg-coral-soft text-coral-dark" : "border-coral bg-white text-coral-dark")}>
                    À retravailler
                  </button>
                </div>
                <button type="button" onClick={() => (setOwn(null), setLast(null))} className="w-fit text-sm font-semibold text-primary underline underline-offset-4">
                  Me réenregistrer
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {error && (
        <p role="alert" className="text-sm font-semibold text-coral-dark">
          {error}
        </p>
      )}
      {readOnly ? (
        <p className="text-sm text-muted-foreground">Cours terminé : l&apos;activité reste consultable, mais plus rien n&apos;est enregistré.</p>
      ) : (
        <div className="sticky bottom-[var(--checkbar-bottom,4rem)] z-10 -mx-4 border-t border-border bg-background/95 px-4 py-3 md:bottom-0">
          <div className="mx-auto flex max-w-2xl gap-3">
            <button
              type="button"
              onClick={goNext}
              disabled={!tried || pending || listening}
              className="inline-flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-lg font-bold text-white shadow-[0_5px_0_0_var(--color-brand-dark)] transition active:translate-y-1 active:shadow-[0_1px_0_0_var(--color-brand-dark)] disabled:opacity-50 disabled:shadow-none"
            >
              {pending && <Loader2 className="size-5 animate-spin" aria-hidden />}
              {isLast ? "Voir mon résultat" : "Phrase suivante"} {!pending && <ArrowRight className="size-5" aria-hidden />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
