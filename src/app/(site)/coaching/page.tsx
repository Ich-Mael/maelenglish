import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowRight, CalendarCheck, ChevronDown, Crown, Phone, UserCheck, Video } from "lucide-react";
import { COACHING } from "@/lib/content";
import { COACHING_WA, PHONE_DISPLAY, PHONE_TEL } from "@/lib/site";
import { BUTTON, Container, PhraseCard, Pill, SectionHead, WhatsAppButton } from "@/components/site/ui";
import { FounderCard } from "@/components/site/founder";
import { GOAL_ICONS } from "@/components/site/icons";

export const metadata: Metadata = {
  title: "Coaching premium en anglais : entretien, présentation, examen",
  description:
    "MaelEnglish Coaching, l’offre premium : des cours individuels avec votre coach pour un objectif précis — entretien, présentation, négociation, examen (IELTS, TOEFL). 100 % en ligne.",
  alternates: { canonical: "/coaching" },
};

export default function CoachingPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-48 -right-40 size-[34rem] bg-[radial-gradient(closest-side,var(--color-coral-soft),transparent)]" />
        <Container className="relative grid items-center gap-12 py-12 sm:py-16 lg:grid-cols-[1.3fr_1fr] lg:py-20">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Pill>MaelEnglish Coaching</Pill>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-deep px-3 py-1 text-xs font-bold tracking-wide text-white uppercase">
                <Crown className="size-3.5" aria-hidden /> Premium · individuel
              </span>
            </div>
            <h1 className="mt-4 text-4xl leading-[1.05] font-extrabold text-brand-deep text-balance sm:text-5xl lg:text-6xl">
              Un coach. Votre métier. <span className="text-coral">Vos objectifs.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground text-pretty">
              Notre offre premium : des cours individuels, en direct avec votre coach, pour un objectif précis — un entretien,
              une présentation, une négociation ou un examen. Chaque séance prépare votre jour J.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/diagnostic" className={BUTTON.coral}>
                Demander mon diagnostic <ArrowRight className="size-5" aria-hidden />
              </Link>
              <a href="#deroulement" className={BUTTON.outline}>
                Comment ça marche <ArrowDown className="size-4" aria-hidden />
              </a>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-ink/75">
              <li className="flex items-center gap-1.5"><UserCheck className="size-4 text-primary" aria-hidden /> 100 % personnalisé</li>
              <li className="flex items-center gap-1.5"><CalendarCheck className="size-4 text-primary" aria-hidden /> Horaires flexibles</li>
              <li className="flex items-center gap-1.5"><Video className="size-4 text-primary" aria-hidden /> 100 % en ligne</li>
            </ul>
            <div className="mt-8">
              <p className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">Votre coach</p>
              <FounderCard className="w-fit" />
            </div>
          </div>
          <div className="grid gap-4" aria-label="Exemples d'objectifs de coaching">
            {COACHING.phrases.map((ph, i) => (
              <PhraseCard key={ph.en} role={ph.role} en={ph.en} fr={ph.fr} className={i === 1 ? "lg:ml-10" : undefined} />
            ))}
          </div>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container>
          <SectionHead pill="Pour quel objectif ?" title="Un coaching pour un objectif précis" />
          <ul className="grid gap-5 sm:grid-cols-2">
            {COACHING.goals.map((a) => {
              const Icon = GOAL_ICONS[a.icon];
              return (
                <li key={a.title} className="flex gap-4 rounded-3xl border-2 border-border bg-card p-6">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-primary">
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-lg font-extrabold text-brand-deep">{a.title}</h3>
                    <p className="mt-1 text-muted-foreground">{a.text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      <section id="deroulement" className="bg-brand-soft/60 py-16 sm:py-20">
        <Container>
          <SectionHead pill="Le déroulement" title="Quatre étapes, un programme sur mesure" />
          <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {COACHING.steps.map((s, i) => (
              <li key={s.title} className="rounded-3xl border-2 border-border bg-card p-6">
                <span className="mb-4 flex size-11 items-center justify-center rounded-2xl border-2 border-coral bg-white font-heading text-xl font-extrabold text-coral shadow-[0_4px_0_0_var(--color-coral)]">
                  {i + 1}
                </span>
                <h3 className="text-lg font-extrabold text-brand-deep">{s.title}</h3>
                <p className="mt-1.5 text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section id="faq" className="py-16 sm:py-20">
        <Container className="max-w-3xl">
          <SectionHead pill="Questions fréquentes" title="Tout ce qu’il faut savoir" />
          <div className="grid gap-3">
            {COACHING.faq.map((f, i) => (
              <details key={f.q} open={i === 0} className="group rounded-2xl border-2 border-border bg-card open:border-primary/30">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 font-bold text-brand-deep [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <ChevronDown className="size-5 shrink-0 text-primary transition group-open:rotate-180" aria-hidden />
                </summary>
                <p className="px-5 pb-5 text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>

      <section className="pb-16 sm:pb-20">
        <Container>
          <div className="relative overflow-hidden rounded-[2.5rem] bg-brand-deep p-8 text-white sm:p-12">
            <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-80 bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--color-primary)_50%,transparent),transparent)]" />
            <div className="relative grid items-center gap-8 lg:grid-cols-[1.4fr_1fr]">
              <div>
                <h2 className="text-3xl font-extrabold">Parlons de votre objectif</h2>
                <p className="mt-3 text-white/80">
                  Indiquez-nous votre métier et votre échéance : nous vous proposons un diagnostic et une formule adaptée.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <WhatsAppButton href={COACHING_WA}>Écrire sur WhatsApp</WhatsAppButton>
                <a href={`tel:${PHONE_TEL}`} className={BUTTON.ghost}>
                  <Phone className="size-4" aria-hidden /> {PHONE_DISPLAY}
                </a>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
