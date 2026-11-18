"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Loader2, RotateCcw, Timer, Trophy, X } from "lucide-react";
import { submitQuiz, type QuizResult } from "@/app/(app)/learn-actions";
import { cn } from "cn";

export type PublicQuestion = { id: string; text: string; options: { id: string; text: string }[] };

/**
 * Graded quiz (module quiz or final exam). Questions arrive without their
 * answers; the server grades and returns the review.
 */
export function QuizRunner({
  courseId,
  moduleId,
  title,
  questions,
  passingScore,
  timeLimit,
  bestScore,
  courseHref,
  nextHref,
  readOnly,
}: {
  courseId: string;
  moduleId: string | null;
  title: string;
  questions: PublicQuestion[];
  passingScore: number;
  timeLimit: number;
  bestScore: number | null;
  courseHref: string;
  nextHref: string;
  readOnly: boolean;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [secondsLeft, setSecondsLeft] = useState(timeLimit * 60);
  const submitted = useRef(false);

  const q = questions[index];
  const answeredCount = questions.filter((x) => answers[x.id]).length;

  function submit() {
    if (submitted.current) return;
    submitted.current = true;
    setError(null);
    start(async () => {
      const res = await submitQuiz(courseId, moduleId, answers);
      if (!res.ok) {
        submitted.current = false;
        setError(res.error);
        return;
      }
      setResult(res.result);
      window.scrollTo({ top: 0 });
    });
  }

  // Countdown (time limit in minutes): submits automatically at 0.
  useEffect(() => {
    if (!started || !timeLimit || result) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [started, timeLimit, result]);
  useEffect(() => {
    if (started && timeLimit && secondsLeft === 0 && !result) submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  function retry() {
    submitted.current = false;
    setAnswers({});
    setIndex(0);
    setResult(null);
    setSecondsLeft(timeLimit * 60);
  }

  if (!started) {
    return (
      <div className="mx-auto grid max-w-md gap-6 rounded-3xl border-2 border-border bg-card p-6 text-center sm:p-8">
        <Trophy className="mx-auto size-14 text-xp" aria-hidden />
        <div>
          <h1 className="text-2xl font-extrabold text-brand-deep">{title}</h1>
          <p className="mt-2 text-muted-foreground">
            {questions.length} questions · {passingScore} % pour réussir{timeLimit ? ` · ${timeLimit} min` : ""}
          </p>
          {bestScore !== null && <p className="mt-1 text-sm font-semibold text-primary">Votre meilleur score : {bestScore} %</p>}
        </div>
        {readOnly ? (
          <p className="text-sm text-muted-foreground">Cours terminé : le quiz n&apos;est plus disponible.</p>
        ) : (
          <button type="button" onClick={() => setStarted(true)} className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-bold text-white shadow-[0_5px_0_0_var(--color-brand-dark)] transition active:translate-y-1 active:shadow-[0_1px_0_0_var(--color-brand-dark)]">
            Commencer
          </button>
        )}
        <Link href={courseHref} className="text-sm font-semibold text-muted-foreground hover:text-primary">
          Retour au parcours
        </Link>
      </div>
    );
  }

  if (result) {
    const byId = new Map(result.review.map((r) => [r.questionId, r]));
    return (
      <div className="mx-auto grid max-w-2xl gap-6">
        <div className={cn("rounded-3xl p-6 text-center text-white", result.passed ? "bg-success" : "bg-brand-deep")}>
          <motion.p initial={reduce ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 14 }} className="font-heading text-6xl font-extrabold">
            {result.score} %
          </motion.p>
          <h1 className="mt-2 text-2xl font-extrabold">{result.passed ? "Quiz réussi, bravo !" : "Pas encore…"}</h1>
          <p className="mt-1 text-white/85">
            {result.correct} bonne(s) réponse(s) sur {result.total} · {result.passingScore} % requis
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            {result.passed ? (
              <button type="button" onClick={() => router.push(nextHref)} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-6 font-bold text-success">
                Continuer <ArrowRight className="size-4" aria-hidden />
              </button>
            ) : (
              <button type="button" onClick={retry} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-coral px-6 font-bold text-white">
                <RotateCcw className="size-4" aria-hidden /> Réessayer
              </button>
            )}
            <Link href={courseHref} className="inline-flex h-12 items-center justify-center rounded-2xl border-2 border-white/40 px-6 font-semibold">
              Parcours
            </Link>
          </div>
        </div>

        <h2 className="text-xl font-extrabold text-brand-deep">Correction</h2>
        <ol className="grid gap-4">
          {questions.map((question, i) => {
            const r = byId.get(question.id);
            const ok = r?.chosen === r?.correctOptionId;
            return (
              <li key={question.id} className="rounded-3xl border-2 border-border bg-card p-5">
                <p className="flex items-start gap-2 font-bold text-brand-deep">
                  <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-white", ok ? "bg-success" : "bg-destructive")}>
                    {ok ? <Check className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
                  </span>
                  {i + 1}. {question.text}
                </p>
                <ul className="mt-3 grid gap-1.5">
                  {question.options.map((o) => (
                    <li
                      key={o.id}
                      className={cn(
                        "rounded-xl px-3 py-2 text-sm",
                        o.id === r?.correctOptionId ? "bg-success/12 font-semibold text-success" : o.id === r?.chosen ? "bg-destructive/10 text-destructive line-through" : "text-muted-foreground",
                      )}
                    >
                      {o.text}
                    </li>
                  ))}
                </ul>
                {r?.explanation && <p className="mt-3 rounded-xl bg-brand-soft px-3 py-2 text-sm text-ink">{r.explanation}</p>}
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-10rem)] max-w-2xl flex-col">
      <div className="flex items-center gap-3">
        <Link href={courseHref} className="flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted" aria-label="Quitter le quiz">
          <X className="size-6" aria-hidden />
        </Link>
        <div className="flex flex-1 gap-1.5" aria-label={`Question ${index + 1} sur ${questions.length}`}>
          {questions.map((x, i) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setIndex(i)}
              className={cn("h-3 flex-1 rounded-full transition", i === index ? "bg-primary" : answers[x.id] ? "bg-primary/40" : "bg-muted")}
              aria-label={`Aller à la question ${i + 1}`}
            />
          ))}
        </div>
        {timeLimit > 0 && (
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold tabular-nums", secondsLeft < 60 ? "bg-destructive/10 text-destructive" : "bg-brand-soft text-primary")} role="timer" aria-label="Temps restant">
            <Timer className="size-4" aria-hidden /> {mm}:{ss}
          </span>
        )}
      </div>

      <div className="flex-1 py-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.section key={q.id} initial={reduce ? { opacity: 0 } : { opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, x: -30 }} transition={{ duration: 0.18 }}>
            <p className="text-sm font-bold text-muted-foreground">
              Question {index + 1} / {questions.length}
            </p>
            <h1 className="mt-1 mb-5 text-2xl font-extrabold text-brand-deep">{q.text}</h1>
            <div className="grid gap-2.5" role="radiogroup">
              {q.options.map((o, i) => {
                const picked = answers[q.id] === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={picked}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left font-medium transition active:translate-y-0.5",
                      picked ? "border-primary bg-brand-soft text-brand-deep shadow-[0_3px_0_0_var(--color-primary)]" : "border-border bg-card shadow-[0_3px_0_0_var(--color-border)] hover:border-primary/40",
                    )}
                  >
                    <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg border-2 text-xs font-bold", picked ? "border-primary text-primary" : "border-border text-muted-foreground")}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    {o.text}
                  </button>
                );
              })}
            </div>
          </motion.section>
        </AnimatePresence>
      </div>

      <div className="sticky bottom-16 -mx-4 border-t-2 border-border bg-background px-4 py-4 md:bottom-0">
        {error && <p role="alert" className="mb-2 text-sm text-destructive">{error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} className="inline-flex h-13 items-center justify-center rounded-2xl border-2 border-border px-4 font-semibold text-brand-deep disabled:opacity-40" aria-label="Question précédente">
            <ArrowLeft className="size-5" aria-hidden />
          </button>
          {index < questions.length - 1 ? (
            <button type="button" onClick={() => setIndex((i) => i + 1)} className="inline-flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-bold text-white shadow-[0_5px_0_0_var(--color-brand-dark)] transition active:translate-y-1 active:shadow-[0_1px_0_0_var(--color-brand-dark)]">
              Suivante <ArrowRight className="size-5" aria-hidden />
            </button>
          ) : (
            <button type="button" onClick={submit} disabled={pending} className="inline-flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl bg-coral text-lg font-bold text-white shadow-[0_5px_0_0_var(--color-coral-dark)] transition active:translate-y-1 active:shadow-[0_1px_0_0_var(--color-coral-dark)]">
              {pending && <Loader2 className="size-5 animate-spin" aria-hidden />}
              Envoyer ({answeredCount}/{questions.length})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
