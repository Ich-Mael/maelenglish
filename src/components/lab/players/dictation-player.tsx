"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Keyboard, Lightbulb, Pause, Play, Snail, Volume2 } from "lucide-react";
import { submitLabAttempt } from "@/app/(app)/learn-actions";
import { pushReward } from "@/components/gamify/reward-store";
import { playSound } from "@/components/gamify/sound";
import { checkItem, gradeActivity } from "@/lib/lab/grade";
import { starsFor } from "@/lib/lab/meta";
import { DICTATION_PASS, phraseAccuracy } from "@/lib/lab/speech";
import { firstLetters, type DictationContent, type DictationItem } from "@/lib/lab/types";
import { useExercise } from "../shell/use-exercise";
import { CheckBar, ExerciseHeader, FeedbackPanel, ResultsScreen, type ExerciseMeta } from "../shell/parts";
import { reshuffle } from "../shell/shuffle";
import { cn } from "cn";

/*
 * L2 — Dictation (catalogue): one sentence per screen. The learner plays it (normal or slow,
 * 0.75×; `maxPlays` per sentence until the check, 0 = unlimited), may show a first-letters hint,
 * types what they hear, then « Vérifier »: each word of the sentence is shown right (blue) or
 * wrong / missing (red), with what they typed, the percentage and the translation. A sentence is
 * right from DICTATION_PASS % of its words; only the first try counts. Results: every sentence
 * with its accuracy and a replay button. Checked here, the server recomputes (`submitLabAttempt`).
 */

type Result = { score: number; stars: number; bestScore?: number; xp?: number; items: { id: string; correct: boolean }[] };

/** The sentence, each word blue (typed right) or red (wrong / missing). */
function Marked({ text, typed }: { text: string; typed: string }) {
  const acc = phraseAccuracy(text, typed);
  return (
    <p lang="en" className="flex flex-wrap gap-x-1.5 gap-y-1 font-heading text-lg leading-snug font-extrabold">
      {acc.words.map((w, i) => (
        <span key={i} className={cn("rounded-md px-1", w.heard ? "bg-brand-soft text-primary" : "bg-coral-soft text-coral-dark underline decoration-coral decoration-2 underline-offset-4")}>
          {w.word}
        </span>
      ))}
    </p>
  );
}

export function DictationPlayer({
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
  content: DictationContent;
  audioUrls: Record<string, string>;
  courseHref: string;
  nextHref: string;
  readOnly?: boolean;
  preview?: boolean;
}) {
  const router = useRouter();
  const audio = useRef<HTMLAudioElement>(null);
  const [items, setItems] = useState(content.items);
  const ex = useExercise<string>(items.map((i) => i.id));
  const [typed, setTyped] = useState("");
  const [plays, setPlays] = useState(0);
  const [playing, setPlaying] = useState<"normal" | "slow" | null>(null);
  const [hint, setHint] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [timeS, setTimeS] = useState(0);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const meta: ExerciseMeta = { title, typeLabel: "Dictation", icon: Keyboard, level, skills, instructions: instructions || "Listen to each sentence and write it in English." };
  const it = items[ex.index] as DictationItem | undefined;
  const revealed = ex.phase === "feedback";
  const limit = content.maxPlays;
  const left = limit ? Math.max(0, limit - plays) : Infinity;
  const urlOf = (x: DictationItem) => (x.audioMediaId ? audioUrls[x.audioMediaId] : undefined);

  const play = (x: DictationItem, speed: "normal" | "slow", count = true) => {
    const a = audio.current;
    const src = urlOf(x);
    if (!a || !src) return;
    if (playing === speed && !a.paused) return a.pause();
    if (count && !revealed && limit && left <= 0) return;
    ex.touch();
    if (a.getAttribute("src") !== src) a.src = src;
    a.currentTime = 0;
    a.playbackRate = speed === "slow" ? 0.75 : 1;
    setPlaying(speed);
    if (count && !revealed) setPlays((p) => p + 1);
    void a.play().catch(() => setPlaying(null));
  };

  const onType = (v: string) => {
    setTyped(v);
    ex.setAnswer(v.trim() ? v : undefined);
  };
  const onCheck = () => {
    if (!it) return;
    const ok = checkItem("dictation", content, it.id, ex.answer);
    playSound(ok ? "correct" : "wrong");
    audio.current?.pause();
    ex.check(ok);
  };
  const retry = () => {
    setTyped("");
    ex.retry();
  };
  const next = () => {
    audio.current?.pause();
    setTyped("");
    setPlays(0);
    setHint(false);
    ex.next();
  };

  const finish = () => {
    audio.current?.pause();
    const answers = { ...ex.firstTry };
    const timeSpentS = ex.elapsedS();
    setTimeS(timeSpentS);
    if (preview || !courseId || !stepId) {
      const g = gradeActivity("dictation", content, answers);
      setResult({ score: g.score, stars: starsFor(g.score), items: g.items });
      ex.next();
      return;
    }
    setError("");
    start(async () => {
      const r = await submitLabAttempt(courseId, stepId, { answers, timeSpentS });
      if (!r.ok) return setError(r.error);
      pushReward(r.result.reward);
      setResult({ ...r.result, xp: r.result.reward?.xpGained });
      ex.next();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };
  const restart = () => {
    setItems((cur) => reshuffle(content.items, cur));
    setTyped("");
    setPlays(0);
    setHint(false);
    ex.restart();
    setResult(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const audioEl = <audio ref={audio} preload="none" onEnded={() => setPlaying(null)} onPause={() => setPlaying(null)} />;

  if (ex.phase === "done" && result) {
    const firstTry = ex.firstTry;
    return (
      <div className="mx-auto grid max-w-2xl gap-5">
        {audioEl}
        <ExerciseHeader meta={meta} courseHref={courseHref} index={items.length} total={items.length} done />
        <ResultsScreen score={result.score} stars={result.stars} timeS={timeS} xp={result.xp} bestScore={result.bestScore} review={[]} maelTip={maelTip} preview={preview} passScore={passScore} lessonHref={lessonHref} onRetry={restart} onContinue={() => router.push(nextHref)}>
          <section className="grid gap-3 rounded-3xl border-2 border-border bg-card p-5">
            <h2 className="font-heading text-lg font-extrabold text-brand-deep">Your sentences</h2>
            <ul className="grid gap-2">
              {items.map((x) => {
                const t = firstTry[x.id] ?? "";
                const pct = phraseAccuracy(x.text, t).percent;
                return (
                  <li key={x.id} className="grid gap-1 rounded-2xl bg-muted/50 px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <Marked text={x.text} typed={t} />
                      </div>
                      {urlOf(x) && (
                        <button type="button" onClick={() => play(x, "normal", false)} className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-primary" aria-label="Replay the sentence">
                          <Volume2 className="size-4" aria-hidden />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {pct} % of the words right{t ? ` · you wrote: "${t}"` : ""}
                      {x.translation && ` · ${x.translation}`}
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

  if (!it) return null;
  const acc = revealed && ex.answer ? phraseAccuracy(it.text, ex.answer) : null;

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      {audioEl}
      <ExerciseHeader meta={meta} courseHref={courseHref} index={ex.index} total={items.length} />
      <section className="grid gap-4 rounded-3xl border-2 border-border bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
            Sentence {ex.index + 1} of {items.length}
          </p>
          {limit > 0 && !revealed && <p className={cn("text-xs font-bold", left ? "text-primary" : "text-coral-dark")}>{left ? `${left} listen${left > 1 ? "s" : ""} left` : "No listens left"}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => play(it, "normal")}
            disabled={!urlOf(it) || (!revealed && limit > 0 && left <= 0 && playing !== "normal")}
            className="flex size-16 items-center justify-center rounded-full bg-primary text-white shadow-[0_5px_0_0_var(--color-brand-dark)] transition active:translate-y-1 active:shadow-none disabled:opacity-40"
            aria-label={playing === "normal" ? "Pause" : "Listen to the sentence"}
          >
            {playing === "normal" ? <Pause className="size-7" aria-hidden /> : <Play className="size-7 translate-x-0.5" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={() => play(it, "slow")}
            disabled={!urlOf(it) || (!revealed && limit > 0 && left <= 0 && playing !== "slow")}
            className="inline-flex h-11 items-center gap-2 rounded-full border-2 border-primary/30 bg-brand-soft px-4 text-sm font-bold text-primary disabled:opacity-40"
          >
            {playing === "slow" ? <Pause className="size-4" aria-hidden /> : <Snail className="size-4" aria-hidden />} Slowly
          </button>
          {!revealed && !hint && (
            <button type="button" onClick={() => setHint(true)} className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline underline-offset-4">
              <Lightbulb className="size-4" aria-hidden /> Hint
            </button>
          )}
        </div>
        {hint && !revealed && (
          <p lang="en" className="rounded-xl bg-brand-soft/60 px-3 py-2 font-mono text-sm tracking-wider text-brand-deep" aria-label="Hint: the first letter of each word">
            {firstLetters(it.text)}
          </p>
        )}

        <label className="grid gap-1">
          <span className="sr-only">What you hear</span>
          <textarea
            lang="en"
            value={typed}
            onChange={(e) => onType(e.target.value)}
            disabled={revealed || readOnly}
            rows={3}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="off"
            placeholder="Write the sentence in English…"
            className="w-full rounded-2xl border-2 border-border bg-background p-3 text-lg leading-relaxed text-ink outline-none focus:border-primary focus:ring-3 focus:ring-primary/20 disabled:opacity-80"
          />
        </label>

        {revealed && ex.correct !== null && acc && (
          <FeedbackPanel correct={ex.correct} explanation={`${acc.percent} % of the words right${ex.correct ? "" : ` (you need ${DICTATION_PASS} %)`}.`}>
            <Marked text={it.text} typed={ex.answer ?? ""} />
            {it.translation && <p className="text-sm text-muted-foreground">{it.translation}</p>}
          </FeedbackPanel>
        )}
      </section>

      {error && (
        <p role="alert" className="text-sm font-semibold text-coral-dark">
          {error}
        </p>
      )}
      {readOnly ? (
        <p className="text-sm text-muted-foreground">Course completed: you can still view the activity, but nothing is saved any more.</p>
      ) : (
        <CheckBar phase={revealed ? "feedback" : "answer"} canCheck={!!typed.trim()} correct={ex.correct} isLast={ex.isLast} pending={pending} onCheck={onCheck} onRetry={retry} onNext={ex.isLast ? finish : next} />
      )}
    </div>
  );
}
