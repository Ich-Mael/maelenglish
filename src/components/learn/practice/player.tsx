"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Loader2, RotateCcw, Star, X } from "lucide-react";
import { DEFAULT_PROMPTS, checkExercise, expectedAnswer, type Exercise, type ExerciseResponse } from "@/lib/learn/exercises";
import { submitPractice } from "@/app/(app)/learn-actions";
import { EXERCISE_COMPONENTS } from "./exercises";
import { pushReward } from "@/components/gamify/reward-store";
import { confetti, playSound } from "@/components/gamify/sound";
import { enqueue, isOfflineError } from "@/components/pwa/offline-queue";
import { cn } from "cn";

type Feedback = { correct: boolean; skipped?: boolean } | null;

/**
 * Runs a practice lesson: one exercise at a time, « Vérifier » → feedback,
 * missed exercises come back once at the end. The first try of each exercise
 * is sent to the server, which grades it again and records the score.
 */
export function PracticePlayer({
  courseId,
  lessonId,
  title,
  exercises,
  courseHref,
  nextHref,
}: {
  courseId: string;
  lessonId: string;
  title: string;
  exercises: Exercise[];
  courseHref: string;
  nextHref: string;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [queue, setQueue] = useState(exercises);
  const [pos, setPos] = useState(0);
  const [attempt, setAttempt] = useState(0); // remounts the exercise when it comes back
  const [response, setResponse] = useState<ExerciseResponse | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [firstTry, setFirstTry] = useState<Record<string, ExerciseResponse>>({});
  const [result, setResult] = useState<{ score: number; correct: number; xp: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offlineSaved, setOfflineSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const ex = queue[pos];
  const Component = ex ? EXERCISE_COMPONENTS[ex.kind] : null;
  const progress = Math.round((pos / queue.length) * 100);

  function check() {
    if (!ex || !response || feedback) return;
    // Speaking skipped (no mic, noisy place…): not counted as correct, not repeated.
    const skipped = response.kind === "speak" && response.selfCheck === false && !response.transcript;
    const correct = !skipped && checkExercise(ex, response);
    setFeedback({ correct, skipped });
    if (!skipped) playSound(correct ? "correct" : "wrong");
    if (!(ex.id in firstTry)) {
      setFirstTry((f) => ({ ...f, [ex.id]: response }));
      if (!correct && !skipped) setQueue((q) => [...q, ex]); // try again at the end
    }
  }

  function next() {
    if (pos + 1 < queue.length) {
      setPos(pos + 1);
      setAttempt((a) => a + 1);
      setResponse(null);
      setFeedback(null);
      return;
    }
    finish();
  }

  function finish() {
    setError(null);
    startTransition(async () => {
      const correct = exercises.filter((e) => checkExercise(e, firstTry[e.id])).length;
      let res: Awaited<ReturnType<typeof submitPractice>>;
      try {
        res = await submitPractice(courseId, lessonId, firstTry);
      } catch (e) {
        if (!isOfflineError(e)) {
          setError("Une erreur est survenue. Réessayez.");
          return;
        }
        // Offline: the result is kept on the device and sent when the connection returns.
        enqueue({ kind: "practice", courseId, lessonId, responses: firstTry });
        setOfflineSaved(true);
        res = { ok: true, score: Math.round((correct / Math.max(1, exercises.length)) * 100), reward: null };
      }
      if (!res.ok) {
        setError(res.error ?? "Une erreur est survenue.");
        return;
      }
      setResult({ score: res.score ?? 0, correct, xp: res.reward?.xpGained ?? 0 });
      playSound("complete");
      if ((res.score ?? 0) >= 90) void confetti("small");
      pushReward(res.reward);
    });
  }

  function restart() {
    setQueue(exercises);
    setPos(0);
    setAttempt((a) => a + 1);
    setResponse(null);
    setFeedback(null);
    setFirstTry({});
    setResult(null);
  }

  if (result) {
    const stars = result.score >= 90 ? 3 : result.score >= 60 ? 2 : 1;
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-6 text-center">
        <div className="flex gap-2" aria-label={`${stars} étoile(s) sur 3`}>
          {[1, 2, 3].map((s) => (
            <motion.span key={s} initial={reduce ? false : { scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.15 * s, type: "spring", stiffness: 260, damping: 14 }}>
              <Star className={cn("size-14", s <= stars ? "fill-xp text-xp" : "fill-muted text-muted")} aria-hidden />
            </motion.span>
          ))}
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-brand-deep">Leçon terminée !</h1>
          <p className="mt-1 text-muted-foreground">{title}</p>
          {offlineSaved && <p className="mt-2 rounded-xl bg-muted px-3 py-2 text-sm text-ink">Hors ligne : votre résultat est enregistré sur l&apos;appareil et sera envoyé à la reconnexion.</p>}
        </div>
        <dl className={cn("grid w-full gap-3", result.xp ? "grid-cols-3" : "grid-cols-2")}>
          {result.xp > 0 && (
            <div className="rounded-2xl border-2 border-xp/40 bg-xp/10 p-4">
              <dt className="text-xs font-bold tracking-wide text-[#9a6200] uppercase">XP</dt>
              <dd className="font-heading text-3xl font-extrabold text-[#9a6200]">+{result.xp}</dd>
            </div>
          )}
          <div className="rounded-2xl border-2 border-success/30 bg-success/10 p-4">
            <dt className="text-xs font-bold tracking-wide text-success uppercase">Précision</dt>
            <dd className="font-heading text-3xl font-extrabold text-success">{result.score} %</dd>
          </div>
          <div className="rounded-2xl border-2 border-border bg-card p-4">
            <dt className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Du premier coup</dt>
            <dd className="font-heading text-3xl font-extrabold text-brand-deep">
              {result.correct}/{exercises.length}
            </dd>
          </div>
        </dl>
        <div className="grid w-full gap-3">
          <button type="button" onClick={() => router.push(nextHref)} className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl border-2 border-coral bg-white text-[19px] font-bold text-coral hover:bg-coral-soft shadow-[0_5px_0_0_var(--color-coral)] transition active:translate-y-1 active:shadow-[0_1px_0_0_var(--color-coral)]">
            Continuer <ArrowRight className="size-5" aria-hidden />
          </button>
          <button type="button" onClick={restart} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl font-semibold text-primary hover:bg-brand-soft">
            <RotateCcw className="size-4" aria-hidden /> Recommencer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-10rem)] max-w-2xl flex-col">
      <div className="flex items-center gap-3">
        <Link href={courseHref} className="flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted" aria-label="Quitter la leçon">
          <X className="size-6" aria-hidden />
        </Link>
        <div className="h-4 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Avancement de la leçon">
          <motion.div className="h-full rounded-full bg-success" animate={{ width: `${Math.max(progress, 3)}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
        </div>
      </div>

      <div className="relative flex-1 py-6">
        <AnimatePresence mode="wait" initial={false}>
          {ex && Component && (
            <motion.section
              key={`${ex.id}-${attempt}`}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: -40 }}
              transition={{ duration: 0.22 }}
              aria-labelledby="exercise-prompt"
            >
              {pos >= exercises.length ? (
                <p className="mb-2 text-xs font-bold tracking-wide text-coral-dark uppercase">On réessaie</p>
              ) : null}
              <h1 id="exercise-prompt" className="mb-5 text-2xl font-extrabold text-brand-deep">
                {ex.prompt || DEFAULT_PROMPTS[ex.kind]}
              </h1>
              <Component exercise={ex} locked={!!feedback} onChange={setResponse} onSubmit={check} />
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      <div
        className={cn(
          "sticky bottom-16 -mx-4 border-t-2 px-4 py-4 transition-colors md:bottom-0",
          feedback?.correct && "border-success/30 bg-[#e6f7ef]",
          feedback?.skipped && "border-border bg-muted",
          feedback && !feedback.correct && !feedback.skipped && "border-destructive/30 bg-[#fdecec]",
          !feedback && "border-border bg-background",
        )}
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1" aria-live="assertive">
            {feedback && (
              <motion.div initial={reduce ? false : { y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex items-start gap-3">
                <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full text-white", feedback.correct ? "bg-success" : feedback.skipped ? "bg-muted-foreground" : "bg-destructive")}>
                  {feedback.correct ? <Check className="size-6" aria-hidden /> : <X className="size-6" aria-hidden />}
                </span>
                <div>
                  <p className={cn("font-heading text-xl font-extrabold", feedback.correct ? "text-success" : feedback.skipped ? "text-ink" : "text-destructive")}>
                    {feedback.correct ? "Excellent !" : feedback.skipped ? "Exercice passé" : "Pas tout à fait…"}
                  </p>
                  {!feedback.correct && !feedback.skipped && ex && (
                    <p className="text-sm text-ink">
                      Bonne réponse : <span lang="en" className="font-semibold">{expectedAnswer(ex)}</span>
                    </p>
                  )}
                  {ex?.explanation && <p className="mt-0.5 text-sm text-ink/80">{ex.explanation}</p>}
                </div>
              </motion.div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          {feedback ? (
            <button type="button" onClick={next} disabled={pending} autoFocus className={cn("inline-flex h-13 items-center justify-center gap-2 rounded-2xl px-8 text-lg font-bold text-white transition active:translate-y-1 sm:min-w-44", feedback.correct ? "bg-success shadow-[0_5px_0_0_#178a5c]" : feedback.skipped ? "bg-primary shadow-[0_5px_0_0_var(--color-brand-dark)]" : "bg-destructive shadow-[0_5px_0_0_#b91c1c]")}>
              {pending && <Loader2 className="size-5 animate-spin" aria-hidden />}
              Continuer
            </button>
          ) : (
            <button type="button" onClick={check} disabled={!response} className="inline-flex h-13 items-center justify-center rounded-2xl bg-primary px-8 text-lg font-bold text-white shadow-[0_5px_0_0_var(--color-brand-dark)] transition active:translate-y-1 active:shadow-[0_1px_0_0_var(--color-brand-dark)] disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none sm:min-w-44">
              Vérifier
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
