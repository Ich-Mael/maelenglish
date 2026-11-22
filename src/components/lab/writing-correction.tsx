import { ArrowRight, Check, ChevronDown, X } from "lucide-react";
import type { WritingCorrection } from "@/lib/ai/types";
import { cn } from "cn";

/*
 * Claude's correction of a writing task: score ring, summary, strengths, errors (quote →
 * correction + rule), checklist, corrected text. Learner page (French labels) and the coach's
 * review page (`locale="en"`); the feedback itself is in French.
 */

const T = {
  fr: { auto: "Correction automatique", good: "Ce qui est réussi", fix: "À corriger", task: "La consigne", corrected: "Votre texte corrigé", score: "Score" },
  en: { auto: "Correction draft", good: "Strengths", fix: "Errors", task: "Checklist", corrected: "Corrected text", score: "Score" },
} as const;

export function ScoreRing({ score, label = "Score" }: { score: number; label?: string }) {
  return (
    <span className="relative flex size-16 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(var(--color-primary), var(--color-brand-deep) ${score}%, color-mix(in oklab, var(--color-primary) 15%, white) 0)` }} role="img" aria-label={`${label} : ${score} / 100`}>
      <span className="flex size-12 flex-col items-center justify-center rounded-full bg-white leading-none">
        <span className="font-heading text-lg font-extrabold text-primary tabular-nums">{score}</span>
        <span className="text-[10px] font-semibold text-muted-foreground">/ 100</span>
      </span>
    </span>
  );
}

export function CorrectionView({ correction, locale = "en", openCorrected = false, title, note }: { correction: WritingCorrection; locale?: "fr" | "en"; openCorrected?: boolean; title?: string; note?: string }) {
  const t = T[locale];
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-4">
        <ScoreRing score={correction.score} label={t.score} />
        <div className="grid gap-1">
          <p className="text-xs font-bold tracking-wide text-primary uppercase">{title ?? t.auto}</p>
          {correction.summary && (
            <p lang="fr" className="text-ink">
              {correction.summary}
            </p>
          )}
          {note && <p className="text-xs text-muted-foreground">{note}</p>}
        </div>
      </div>

      {correction.strengths.length > 0 && (
        <div className="grid gap-1.5">
          <p className="text-sm font-bold text-brand-deep">{t.good}</p>
          <ul lang="fr" className="grid gap-1 text-sm text-ink">
            {correction.strengths.map((s, i) => (
              <li key={i} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {correction.errors.length > 0 && (
        <div className="grid gap-2">
          <p className="text-sm font-bold text-brand-deep">
            {t.fix} ({correction.errors.length})
          </p>
          <ul className="grid gap-2">
            {correction.errors.map((e, i) => (
              <li key={i} className="grid gap-1 rounded-2xl bg-muted/50 px-3 py-2.5">
                <p lang="en" className="flex flex-wrap items-center gap-1.5 text-sm">
                  <span className="rounded bg-coral-soft px-1.5 py-0.5 text-coral-dark line-through decoration-coral">{e.quote}</span>
                  <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
                  <span className="rounded bg-brand-soft px-1.5 py-0.5 font-bold text-primary">{e.correction}</span>
                </p>
                <p lang="fr" className="text-sm text-ink/80">
                  {e.explanation}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {correction.checklist.length > 0 && (
        <div className="grid gap-1.5">
          <p className="text-sm font-bold text-brand-deep">{t.task}</p>
          <ul lang="fr" className="grid gap-1.5 text-sm">
            {correction.checklist.map((c, i) => (
              <li key={i} className="flex gap-2">
                <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full", c.met ? "bg-gradient-to-br from-primary to-brand-deep text-white" : "border-2 border-coral bg-white text-coral-dark")}>
                  {c.met ? <Check className="size-3" aria-hidden /> : <X className="size-3" aria-hidden />}
                </span>
                <span>
                  <span className="font-semibold text-ink">{c.item}</span> <span className="text-muted-foreground">· {c.comment}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details open={openCorrected} className="group rounded-2xl border border-border bg-brand-soft/40 px-4 py-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold text-primary [&::-webkit-details-marker]:hidden">
          <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden /> {t.corrected}
        </summary>
        <p lang="en" className="mt-2 leading-relaxed whitespace-pre-line text-ink">
          {correction.corrected}
        </p>
      </details>
    </div>
  );
}
