"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Check, Loader2, RotateCcw, X } from "lucide-react";
import { finishTestAction } from "@/app/(app)/vocabulary-actions";
import { pushReward } from "@/components/gamify/reward-store";
import { playSound } from "@/components/gamify/sound";
import { typedMatches } from "@/lib/vocabulary-match";
import type { TestQuestion } from "@/lib/vocabulary";
import { cn } from "cn";

/*
 * « Today's test » on the learner's own words: one question per screen (French → type the word,
 * choose the meaning, fill the blank in their own sentence), instant feedback, then the server
 * checks every answer and schedules each word (spaced review).
 */

type Answer = { word: string; kind: string; answer: string; correct: boolean };

export function TestPlayer({ questions }: { questions: TestQuestion[] }) {
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState("");
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [checked, setChecked] = useState<Answer | null>(null);
  const [done, setDone] = useState<{ right: number; total: number; score: number } | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const q = questions[i];

  const check = (answer: string) => {
    if (checked || !q) return;
    const correct = q.kind === "choose" ? answer === q.answer : typedMatches(q.word, answer);
    playSound(correct ? "correct" : "wrong");
    setChecked({ word: q.word, kind: q.kind, answer, correct });
  };
  const next = () => {
    if (!checked) return;
    const all = [...answers, checked];
    setAnswers(all);
    setChecked(null);
    setTyped("");
    if (i + 1 < questions.length) return setI(i + 1);
    submit(all);
  };
  const submit = (all: Answer[]) => {
    setError("");
    start(async () => {
      const r = await finishTestAction(all.map(({ word, kind, answer }) => ({ word, kind, answer })));
      if (!r.ok) return setError(r.error);
      if (r.reward) pushReward(r.reward);
      playSound("complete");
      setDone({ right: r.right, total: r.total, score: r.score });
    });
  };

  if (done) {
    const missed = answers.filter((a) => !a.correct);
    return (
      <div className="grid gap-4 rounded-[2rem] border border-border bg-card p-6 text-center sm:p-8">
        <p className="font-heading text-5xl font-extrabold text-primary tabular-nums">
          {done.right} / {done.total}
        </p>
        <p className="text-lg font-bold text-brand-deep">{done.score >= 80 ? "Excellent! Your vocabulary is sticking." : done.score >= 50 ? "Good work: keep going." : "Every review makes them stick: they'll come back tomorrow."}</p>
        <p className="text-sm text-muted-foreground">Words you knew come back later (3, 7, 14, then 30 days). Words you missed come back tomorrow.</p>
        {missed.length > 0 && (
          <ul className="flex flex-wrap justify-center gap-2">
            {missed.map((m) => (
              <li key={m.word} lang="en" className="rounded-full border-2 border-coral bg-white px-3 py-1 text-sm font-bold text-coral-dark">
                {m.word}
              </li>
            ))}
          </ul>
        )}
        <Link href="/vocabulaire" className="mx-auto inline-flex h-12 items-center gap-2 rounded-2xl bg-primary px-6 font-bold text-white hover:brightness-110">
          Back to my vocabulary <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    );
  }
  if (!q) return null;

  const show = checked;
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <Link href="/vocabulaire" className="flex size-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted" aria-label="Leave the test">
          <X className="size-6" aria-hidden />
        </Link>
        <div className="flex flex-1 gap-1.5" role="progressbar" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={i}>
          {questions.map((_, k) => (
            <span key={k} className={cn("h-2.5 flex-1 rounded-full", k < i ? "bg-primary" : k === i ? "bg-primary/45" : "bg-muted")} />
          ))}
        </div>
      </div>

      <section className="grid gap-5 rounded-[2rem] border border-border bg-card p-6 sm:p-8">
        {q.kind === "type" && (
          <>
            <p className="text-sm font-bold tracking-wide text-primary uppercase">Write the English word</p>
            <p lang="fr" className="font-heading text-3xl font-extrabold text-brand-deep">
              {q.prompt}
            </p>
            <p className="font-mono text-lg tracking-[0.3em] text-muted-foreground" aria-label={`${q.word.length} letters`}>
              {q.hint}
            </p>
          </>
        )}
        {q.kind === "blank" && (
          <>
            <p className="text-sm font-bold tracking-wide text-primary uppercase">Complete your own sentence</p>
            <p lang="en" className="font-heading text-2xl leading-snug font-extrabold text-brand-deep">
              {q.sentence}
            </p>
            {q.hint && (
              <p lang="fr" className="text-sm text-muted-foreground">
                Meaning: {q.hint}
              </p>
            )}
          </>
        )}
        {q.kind === "choose" && (
          <>
            <p className="text-sm font-bold tracking-wide text-primary uppercase">What does it mean?</p>
            <p lang="en" className="font-heading text-4xl font-extrabold text-brand-deep">
              {q.prompt}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {q.options.map((o) => {
                const isAnswer = show && o === q.answer;
                const isWrongPick = show && !show.correct && o === show.answer;
                return (
                  <button
                    key={o}
                    type="button"
                    lang="fr"
                    disabled={!!show}
                    onClick={() => check(o)}
                    className={cn("min-h-14 rounded-2xl border-2 px-4 py-3 text-left text-base font-semibold transition", isAnswer ? "border-primary bg-brand-soft text-primary" : isWrongPick ? "border-coral bg-coral-soft text-coral-dark" : "border-border bg-white text-ink hover:border-primary/40")}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
          </>
        )}
        {(q.kind === "type" || q.kind === "blank") && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (typed.trim()) check(typed);
            }}
            className="flex gap-2"
          >
            <input
              autoFocus
              lang="en"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={!!show}
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              aria-label="Your answer"
              className={cn("h-12 min-w-0 flex-1 rounded-2xl border-2 bg-white px-4 text-lg outline-none", show ? (show.correct ? "border-primary" : "border-coral") : "border-border focus:border-primary")}
            />
            {!show && (
              <button type="submit" disabled={!typed.trim()} className="h-12 rounded-2xl bg-primary px-5 font-bold text-white disabled:opacity-40">
                Check
              </button>
            )}
          </form>
        )}

        {show && (
          <div role="status" className={cn("flex flex-wrap items-center gap-3 rounded-2xl border-2 p-4", show.correct ? "border-primary/30 bg-brand-soft" : "border-coral/40 bg-coral-soft")}>
            <p className={cn("flex flex-1 items-center gap-2 font-heading text-lg font-extrabold", show.correct ? "text-primary" : "text-coral-dark")}>
              {show.correct ? <Check className="size-5" aria-hidden /> : <X className="size-5" aria-hidden />}
              {show.correct ? "Correct!" : (
                <span>
                  Answer: <span lang="en">{q.kind === "choose" ? q.answer : q.word}</span>
                </span>
              )}
            </p>
            <button type="button" onClick={next} disabled={pending} autoFocus className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 font-bold text-white disabled:opacity-60">
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} {i + 1 < questions.length ? "Next" : "See my score"} <ArrowRight className="size-4" aria-hidden />
            </button>
          </div>
        )}
        {error && (
          <p className="flex items-center gap-2 text-sm font-semibold text-coral-dark">
            {error}{" "}
            <button type="button" onClick={() => submit(answers)} className="inline-flex items-center gap-1 underline">
              <RotateCcw className="size-3.5" aria-hidden /> Try again
            </button>
          </p>
        )}
      </section>
    </div>
  );
}
