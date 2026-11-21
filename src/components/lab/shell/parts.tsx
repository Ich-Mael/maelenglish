"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Check, Clock, Loader2, RotateCcw, Sparkles, Star, X } from "lucide-react";
import { skillLabel } from "@/lib/lab/meta";
import { cn } from "cn";

/*
 * Shared screens of Lab exercises (learner, French): header with progress, explained feedback,
 * the bottom « Vérifier » bar and the results screen (score, stars, time, items to review,
 * « Le conseil de Mael »). Each exercise type only renders its own items.
 */

export type ExerciseMeta = { title: string; typeLabel: string; icon: React.ComponentType<{ className?: string }>; level?: string; skills?: string[]; instructions?: string };

export function ExerciseHeader({ meta, courseHref, index, total, done }: { meta: ExerciseMeta; courseHref: string; index: number; total: number; done?: boolean }) {
  const Icon = meta.icon;
  return (
    <header className="grid gap-3">
      <div className="flex items-center gap-3">
        <Link href={courseHref} className="flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted" aria-label="Quitter l'exercice">
          <X className="size-6" aria-hidden />
        </Link>
        <div className="flex flex-1 gap-1.5" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done ? total : index} aria-label={`Question ${Math.min(index + 1, total)} sur ${total}`}>
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={cn("h-2.5 flex-1 rounded-full transition", done || i < index ? "bg-primary" : i === index ? "bg-primary/45" : "bg-muted")} />
          ))}
        </div>
      </div>
      <div>
        <p className="flex flex-wrap items-center gap-2 text-xs font-bold tracking-wide text-primary uppercase">
          <Icon className="size-4" aria-hidden /> {meta.typeLabel}
          {meta.level && <span className="rounded-full bg-brand-soft px-2 py-0.5 normal-case">{meta.level}</span>}
          {meta.skills?.map((s) => (
            <span key={s} className="rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground normal-case">
              {skillLabel(s, "fr")}
            </span>
          ))}
        </p>
        <h1 className="mt-1 text-2xl font-extrabold text-brand-deep sm:text-3xl">{meta.title}</h1>
        {meta.instructions && <p className="mt-1 text-muted-foreground">{meta.instructions}</p>}
      </div>
    </header>
  );
}

/** Right / wrong panel under an item: the right answer, a one-line explanation, extras (replay…). */
export function FeedbackPanel({ correct, answer, explanation, children }: { correct: boolean; answer?: React.ReactNode; explanation?: string; children?: React.ReactNode }) {
  return (
    <div role="status" className={cn("grid gap-2 rounded-2xl border-2 p-4 animate-pop motion-reduce:animate-none", correct ? "border-success/40 bg-success/10" : "border-coral/40 bg-coral-soft")}>
      <p className={cn("flex items-center gap-2 font-heading text-lg font-extrabold", correct ? "text-success" : "text-coral-dark")}>
        {correct ? <Check className="size-5" aria-hidden /> : <X className="size-5" aria-hidden />}
        {correct ? "Bonne réponse !" : "Pas tout à fait."}
      </p>
      {!correct && answer && (
        <p className="text-sm text-ink">
          Bonne réponse : <strong>{answer}</strong>
        </p>
      )}
      {explanation && <p className="text-sm text-ink">{explanation}</p>}
      {children}
    </div>
  );
}

/** Bottom bar: « Vérifier », then « Réessayer » / « Suivant » (or « Voir mon résultat »). */
export function CheckBar({
  phase,
  canCheck,
  correct,
  isLast,
  pending,
  onCheck,
  onRetry,
  onNext,
}: {
  phase: "answer" | "feedback";
  canCheck: boolean;
  correct: boolean | null;
  isLast: boolean;
  pending?: boolean;
  onCheck: () => void;
  onRetry: () => void;
  onNext: () => void;
}) {
  const primary =
    "inline-flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-lg font-bold text-white shadow-[0_5px_0_0_var(--color-brand-dark)] transition active:translate-y-1 active:shadow-[0_1px_0_0_var(--color-brand-dark)] disabled:opacity-50 disabled:shadow-none";
  return (
    // Above the learner app's bottom tab bar on phones (4rem); pages without it set --checkbar-bottom: 0.
    <div className="sticky bottom-[var(--checkbar-bottom,4rem)] z-10 -mx-4 border-t border-border bg-background/95 px-4 py-3 md:bottom-0">
      <div className="mx-auto flex max-w-2xl gap-3">
        {phase === "answer" ? (
          <button type="button" className={primary} disabled={!canCheck} onClick={onCheck}>
            Vérifier
          </button>
        ) : (
          <>
            {correct === false && (
              <button type="button" onClick={onRetry} className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl border-2 border-coral bg-white px-5 text-[19px] font-bold text-coral hover:bg-coral-soft">
                <RotateCcw className="size-4" aria-hidden /> Réessayer
              </button>
            )}
            <button type="button" className={primary} onClick={onNext} disabled={pending}>
              {pending && <Loader2 className="size-5 animate-spin" aria-hidden />}
              {isLast ? "Voir mon résultat" : "Suivant"} {!pending && <ArrowRight className="size-5" aria-hidden />}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const fmtTime = (s: number) => (s >= 60 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s` : `${s} s`);

export function Stars({ n, className }: { n: number; className?: string }) {
  return (
    <span className={cn("inline-flex gap-1", className)} role="img" aria-label={`${n} étoile${n > 1 ? "s" : ""} sur 3`}>
      {[1, 2, 3].map((i) => (
        <Star key={i} className={cn("size-9", i <= n ? "fill-xp text-xp" : "text-white/35")} aria-hidden />
      ))}
    </span>
  );
}

/** End of exercise (catalogue: score, stars, time, the 3 items to review, Mael's tip). */
export function ResultsScreen({
  score,
  stars,
  bonus,
  timeS,
  xp,
  review,
  maelTip,
  bestScore,
  preview,
  passScore,
  lessonHref,
  onRetry,
  onContinue,
  children,
}: {
  score: number;
  stars: number;
  bonus?: number;
  timeS: number;
  xp?: number;
  review: { title: string; answer: string }[];
  maelTip?: string;
  bestScore?: number;
  preview?: boolean;
  /** Activity step: below it, « Revoir la leçon » (`lessonHref`) and « Réessayer » come first (spec §8); the learner can still continue. */
  passScore?: number | null;
  lessonHref?: string | null;
  onRetry: () => void;
  onContinue: () => void;
  children?: React.ReactNode;
}) {
  const below = passScore !== undefined && passScore !== null && score < passScore;
  return (
    <div className="grid gap-5">
      <div className={cn("rounded-3xl p-6 text-center text-white", score >= 75 ? "bg-success" : "bg-brand-deep")} role="status">
        <Stars n={stars} className="justify-center" />
        <p className="mt-2 font-heading text-5xl font-extrabold">{score} %</p>
        <p className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm font-semibold text-white/90">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-4" aria-hidden /> {fmtTime(timeS)}
          </span>
          {!!bonus && (
            <span className="inline-flex items-center gap-1">
              <Sparkles className="size-4" aria-hidden /> {bonus} réponse{bonus > 1 ? "s" : ""} du premier coup
            </span>
          )}
          {bestScore !== undefined && bestScore > score && <span>Meilleur score : {bestScore} %</span>}
        </p>
        {!!xp && <p className="mt-1 font-heading text-xl font-extrabold text-xp">+{xp} XP</p>}
        {preview && <p className="mt-2 text-sm text-white/80">Aperçu : rien n&apos;est enregistré.</p>}
        {below ? (
          <>
            <p className="mx-auto mt-4 max-w-md text-sm text-white/90">
              Il faut {passScore} % pour réussir cette activité. Revoyez la leçon, puis réessayez : votre score est enregistré, vous pouvez aussi continuer.
            </p>
            <div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row">
              {lessonHref && (
                <Link href={lessonHref} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-6 font-bold text-brand-deep">
                  <BookOpen className="size-4" aria-hidden /> Revoir la leçon
                </Link>
              )}
              <button type="button" onClick={onRetry} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-white/50 px-6 font-semibold">
                <RotateCcw className="size-4" aria-hidden /> Réessayer
              </button>
            </div>
            <button type="button" onClick={onContinue} className="mt-3 text-sm font-semibold text-white/90 underline underline-offset-4">
              Continuer quand même
            </button>
          </>
        ) : (
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <button type="button" onClick={onContinue} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-6 font-bold text-brand-deep">
              Continuer <ArrowRight className="size-4" aria-hidden />
            </button>
            <button type="button" onClick={onRetry} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-white/50 px-6 font-semibold">
              <RotateCcw className="size-4" aria-hidden /> Recommencer
            </button>
          </div>
        )}
      </div>

      {review.length > 0 && (
        <section className="rounded-3xl border-2 border-border bg-card p-5">
          <h2 className="font-heading text-lg font-extrabold text-brand-deep">À revoir</h2>
          <ul className="mt-2 grid gap-2">
            {review.slice(0, 3).map((r, i) => (
              <li key={i} className="rounded-2xl bg-muted/60 px-3 py-2 text-sm">
                <span className="block font-semibold text-brand-deep">{r.title}</span>
                <span className="text-ink">
                  Bonne réponse : <strong>{r.answer}</strong>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {maelTip && (
        <section className="flex gap-3 rounded-3xl border-2 border-primary/20 bg-brand-soft p-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-sm font-extrabold text-white" aria-hidden>
            M
          </span>
          <div>
            <h2 className="font-heading font-extrabold text-brand-deep">Le conseil de Mael</h2>
            <p className="mt-1 text-ink">{maelTip}</p>
          </div>
        </section>
      )}

      {children}
    </div>
  );
}
