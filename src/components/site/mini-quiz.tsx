"use client";

import { useState } from "react";
import { ArrowRight, Check, Flame, Sparkles, X } from "lucide-react";
import { ListenButton } from "./speak";
import { cn } from "cn";

export type QuizItem = { slug: string; label: string; en: string; options: string[]; answer: number };

/**
 * « Testez-vous » teaser on the home page: pick the right translation of a
 * phrase from your profession. A small taste of the learning app (XP, streak).
 */
export function MiniQuiz({ items }: { items: QuizItem[] }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [answered, setAnswered] = useState(0);
  const item = items[index];
  const done = picked !== null;
  const correct = done && picked === item.answer;

  function choose(i: number) {
    if (done) return;
    setPicked(i);
    setAnswered((n) => n + 1);
    if (i === item.answer) {
      setXp((x) => x + 10);
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
    }
  }

  function goTo(i: number) {
    setIndex(i);
    setPicked(null);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="tablist" aria-label="Choisissez un métier">
        {items.map((it, i) => (
          <button
            key={it.slug}
            type="button"
            role="tab"
            aria-selected={i === index}
            onClick={() => goTo(i)}
            className={cn(
              "shrink-0 rounded-full border-2 px-3.5 py-1.5 text-sm font-semibold transition",
              i === index ? "border-primary bg-primary text-white" : "border-border bg-card text-ink/80 hover:border-primary/40",
            )}
          >
            {it.label}
          </button>
        ))}
      </div>

      <div className="relative rounded-3xl border-2 border-border bg-card p-5 shadow-[0_20px_50px_-24px_rgb(54_79_171/0.45)] sm:p-7">
        <div className="mb-4 flex items-center justify-between gap-3 text-sm font-bold">
          <span className="text-muted-foreground">Comment traduire ?</span>
          <span className="flex items-center gap-3">
            <span className={cn("flex items-center gap-1 text-coral-dark transition-opacity", streak < 2 && "opacity-40")} aria-label={`Série : ${streak}`}>
              <Flame className="size-4" aria-hidden /> {streak}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-xp/15 px-2.5 py-0.5 text-[#9a6200]" aria-label={`${xp} points d'expérience`}>
              <Sparkles className="size-4" aria-hidden /> {xp} XP
            </span>
          </span>
        </div>

        <div className="mb-5 flex items-start gap-3">
          <p lang="en" className="flex-1 font-heading text-xl font-bold text-brand-deep sm:text-2xl">
            “{item.en}”
          </p>
          <ListenButton text={item.en} />
        </div>

        <div className="grid gap-2.5" role="group" aria-label="Réponses">
          {item.options.map((opt, i) => {
            const isAnswer = i === item.answer;
            const isPicked = i === picked;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => choose(i)}
                disabled={done}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left font-medium transition",
                  !done && "border-border bg-background shadow-[0_3px_0_0_var(--color-border)] hover:border-primary/50 active:translate-y-0.5 active:shadow-none",
                  done && isAnswer && "animate-pop border-success bg-success/10 text-success",
                  done && isPicked && !isAnswer && "animate-shake border-destructive bg-destructive/5 text-destructive",
                  done && !isAnswer && !isPicked && "border-border opacity-50",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg border-2 text-xs font-bold",
                    done && isAnswer ? "border-success bg-success text-white" : done && isPicked ? "border-destructive bg-destructive text-white" : "border-border text-muted-foreground",
                  )}
                  aria-hidden
                >
                  {done && isAnswer ? <Check className="size-4" /> : done && isPicked ? <X className="size-4" /> : String.fromCharCode(65 + i)}
                </span>
                {opt}
              </button>
            );
          })}
        </div>

        <div aria-live="polite" className="min-h-14">
          {done && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className={cn("font-heading text-lg font-bold", correct ? "text-success" : "text-destructive")}>
                {correct ? (
                  <>
                    Bravo ! <span className="ml-1 inline-block animate-pop text-[#9a6200]">+10 XP</span>
                  </>
                ) : (
                  "Presque ! La bonne réponse est en vert."
                )}
              </p>
              <button
                type="button"
                onClick={() => goTo((index + 1) % items.length)}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-primary px-5 font-semibold text-white shadow-[0_5px_0_0_var(--color-brand-dark)] transition active:translate-y-1 active:shadow-[0_1px_0_0_var(--color-brand-dark)]"
              >
                Suivante <ArrowRight className="size-4" aria-hidden />
              </button>
            </div>
          )}
        </div>
      </div>

      {answered >= 3 && (
        <p className="mt-5 animate-pop text-center text-muted-foreground">
          Ça vous plaît ? Les leçons MaelEnglish fonctionnent comme ça, avec un coach en plus.{" "}
          <a href="#programmes" className="font-semibold text-primary hover:underline">
            Choisir mon programme
          </a>
        </p>
      )}
    </div>
  );
}
