"use client";

import { ArrowRight, Footprints, Heart, Printer, RotateCcw, Sparkles, Target, TriangleAlert } from "lucide-react";
import { BUTTON, WhatsAppButton } from "@/components/site/ui";
import { PROFILE_INFO } from "@/lib/diagnostic/profiles";
import { WHATSAPP_NUMBER } from "@/lib/catalog";
import { fr } from "@/lib/diagnostic/questions";
import type { DiagnosticResult } from "@/lib/diagnostic/service";
import { cn } from "cn";

/*
 * The diagnostic report (DIAGNOSTIC_SPEC.md §8), in the site's style: greeting + headline, profile
 * card (+ secondary badges), what holds you back, the reframe (highlighted), strengths, the 3-step
 * method (numbered coral badges like the site's cards), first step this week, the 6-month goal,
 * the call to action, and « Télécharger en PDF » (browser print with a print stylesheet).
 */

const PROGRAM_URL = process.env.NEXT_PUBLIC_PROGRAM_URL || "/#programmes";
const WHATSAPP = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Bonjour Coach Ish, je viens de faire mon diagnostic MaelEnglish et j'aimerais en parler.")}`;

const Badge = ({ n }: { n: number }) => <span className="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-coral bg-white font-heading text-lg font-extrabold text-coral shadow-[0_4px_0_0_var(--color-coral)]">{n}</span>;

export function DiagnosticReportView({ result, onRestart }: { result: DiagnosticResult; onRestart: () => void }) {
  const r = result.report;
  return (
    <article className="diagnostic-report grid gap-5">
      <header className="grid gap-2">
        <p className="text-sm font-bold tracking-wide text-coral-dark uppercase">{fr(`${result.firstName}, voici votre diagnostic`)}</p>
        <h1 className="font-heading text-3xl leading-tight font-extrabold text-brand-deep sm:text-4xl">{r.headline}</h1>
      </header>

      <section className="relative overflow-clip rounded-[2rem] bg-gradient-to-br from-primary to-brand-deep p-6 text-white sm:p-8">
        <span aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-[radial-gradient(circle,rgb(255_87_87/0.3),transparent_70%)]" />
        <p className="relative text-xs font-bold tracking-wide text-white/75 uppercase">Votre profil</p>
        <h2 className="relative mt-1 font-heading text-2xl font-extrabold sm:text-3xl">{r.profile_name}</h2>
        <p className="relative mt-3 text-white/90">{r.profile_summary}</p>
        {result.secondary.length > 0 && (
          <p className="relative mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-white/75">Aussi :</span>
            {result.secondary.map((p) => (
              <span key={p} className="rounded-full bg-white/15 px-3 py-1 font-semibold">
                {PROFILE_INFO[p].name}
              </span>
            ))}
          </p>
        )}
      </section>

      <section className="grid gap-3 rounded-[2rem] border border-border bg-card p-6 sm:p-8">
        <h2 className="flex items-center gap-2 font-heading text-xl font-extrabold text-brand-deep">
          <TriangleAlert className="size-5 text-coral" aria-hidden /> Ce qui vous freine
        </h2>
        <ul className="grid gap-3">
          {r.what_holds_you_back.map((x, i) => (
            <li key={i} className="rounded-2xl bg-brand-soft/50 p-4">
              <p className="font-bold text-brand-deep">{x.title}</p>
              <p className="mt-1 text-ink/80">{x.explanation}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[2rem] border-2 border-coral bg-white p-6 sm:p-8">
        <p className="flex items-center gap-2 font-heading text-lg font-extrabold text-coral-dark">
          <Heart className="size-5 text-coral" aria-hidden /> À retenir
        </p>
        <p className="mt-2 text-lg leading-relaxed text-ink">{r.reframe}</p>
      </section>

      <section className="grid gap-3 rounded-[2rem] border border-border bg-card p-6 sm:p-8">
        <h2 className="flex items-center gap-2 font-heading text-xl font-extrabold text-brand-deep">
          <Sparkles className="size-5 text-primary" aria-hidden /> Vos atouts
        </h2>
        <ul className="flex flex-wrap gap-2">
          {r.your_strengths.map((x, i) => (
            <li key={i} className="rounded-full bg-brand-soft px-4 py-2 font-semibold text-primary">
              {x}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3">
        <h2 className="font-heading text-xl font-extrabold text-brand-deep">La méthode recommandée pour vous</h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {r.recommended_method.map((m, i) => (
            <li key={i} className="grid content-start gap-3 rounded-[1.5rem] border border-border bg-card p-6">
              <Badge n={i + 1} />
              <p className="font-heading text-lg font-extrabold text-brand-deep">{m.title}</p>
              <p className="text-ink/75">{m.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex gap-4 rounded-[2rem] border border-border bg-card p-6 sm:p-8">
        <Footprints className="size-7 shrink-0 text-coral" aria-hidden />
        <div>
          <h2 className="font-heading text-xl font-extrabold text-brand-deep">Votre premier pas cette semaine</h2>
          <p className="mt-1 text-ink/85">{r.first_step_this_week}</p>
        </div>
      </section>

      <section className="flex gap-4 rounded-[2rem] bg-brand-soft p-6 sm:p-8">
        <Target className="size-7 shrink-0 text-primary" aria-hidden />
        <p className="text-lg text-brand-deep">{r.goal_reminder}</p>
      </section>

      <section className="no-print grid gap-4 rounded-[2rem] bg-gradient-to-br from-brand-deep to-brand-dark p-6 text-white sm:p-8">
        <h2 className="font-heading text-2xl font-extrabold">{fr("Prêt(e) à passer à l'action ?")}</h2>
        <p className="text-white/85">{fr("Le programme MaelEnglish met en pratique cette méthode, avec Coach Ish : de l'oral dès le départ, des situations de votre travail et un retour sur chaque exercice.")}</p>
        <div className="flex flex-wrap gap-3">
          <a href={PROGRAM_URL} className={BUTTON.coral}>
            Découvrir le programme <ArrowRight className="size-5" aria-hidden />
          </a>
          <WhatsAppButton href={WHATSAPP} variant="ghost">
            En parler sur WhatsApp
          </WhatsAppButton>
        </div>
      </section>

      <div className="no-print flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => window.print()} className={cn(BUTTON.outline, "h-11 px-4 text-base")}>
          <Printer className="size-4" aria-hidden /> Télécharger en PDF
        </button>
        <button type="button" onClick={onRestart} className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-muted">
          <RotateCcw className="size-4" aria-hidden /> Refaire le diagnostic
        </button>
      </div>
      <p className="text-xs text-muted-foreground">Rapport généré automatiquement à partir de vos réponses.</p>
    </article>
  );
}
