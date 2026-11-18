import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowDown,
  ArrowRight,
  Award,
  BarChart3,
  Bell,
  BookOpenText,
  CalendarDays,
  ChevronRight,
  CircleCheck,
  Laptop,
  Layers,
  MessageSquareText,
  Phone,
  PlayCircle,
  Target,
  Timer,
  UserCheck,
  Wallet,
} from "lucide-react";
import { PROGRAMS, findProgram, formatFor, programPhoto, whatsappLink, type Program } from "@/lib/catalog";
import { PHONE_DISPLAY, PHONE_TEL, splitBrand } from "@/lib/site";
import { ICONS } from "@/components/site/icons";
import { Photo } from "@/components/site/photo";
import { StatusBadge } from "@/components/site/program-card";
import { PhraseFlip } from "@/components/site/phrase-flip";
import { BUTTON, Container, PhraseCard, Pill, SectionHead, WhatsAppButton } from "@/components/site/ui";
import { JsonLd, courseJsonLd } from "@/components/site/json-ld";

export function generateStaticParams() {
  return PROGRAMS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/programmes/[slug]">): Promise<Metadata> {
  const p = findProgram((await params).slug);
  if (!p) return {};
  const description = `${p.tagline}. ${p.summary}`;
  return {
    title: { absolute: `${p.name} — ${p.tagline}` },
    description,
    alternates: { canonical: `/programmes/${p.slug}` },
    openGraph: { title: p.name, description, images: [{ url: programPhoto(p).fallback, width: 1280, alt: p.name }] },
  };
}

export default async function ProgramPage({ params }: PageProps<"/programmes/[slug]">) {
  const p = findProgram((await params).slug);
  if (!p) notFound();
  const role = splitBrand(p.name)[1].replace(/^for\s+/, "") || "Essentials";

  return (
    <>
      <JsonLd data={courseJsonLd(p)} />
      <Hero program={p} role={role} />
      <Content program={p} />
      <Phrases program={p} role={role} />
      {p.details ? <EssentialsDetails program={p} /> : <Format program={p} />}
      <FinalCta program={p} />
      <Others current={p.slug} />
    </>
  );
}

function Hero({ program: p, role }: { program: Program; role: string }) {
  const [brand, rest] = splitBrand(p.name);
  const soon = p.status === "soon";
  const Icon = ICONS[p.icon];
  const chips = [
    { icon: Timer, label: p.duration },
    { icon: PlayCircle, label: p.hours },
    { icon: BarChart3, label: p.level },
    { icon: Laptop, label: "100 % en ligne" },
    { icon: Award, label: "Certificat" },
  ];
  return (
    <section className="relative overflow-hidden bg-brand-deep text-white">
      <div aria-hidden className="pointer-events-none absolute -top-40 -right-40 size-[32rem] rounded-full bg-primary/50 blur-3xl" />
      <Container className="relative grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <nav aria-label="Fil d'Ariane" className="mb-5 flex flex-wrap items-center gap-1 text-sm text-white/70">
            <Link href="/" className="hover:text-white">Accueil</Link>
            <ChevronRight className="size-3.5" aria-hidden />
            <Link href="/#programmes" className="hover:text-white">Programmes</Link>
            <ChevronRight className="size-3.5" aria-hidden />
            <span aria-current="page" className="text-white">{rest || p.name}</span>
          </nav>
          <StatusBadge program={p} long />
          <h1 className="mt-4 text-4xl font-extrabold text-balance sm:text-5xl">
            {brand} {rest && <span className="text-coral">{rest}</span>}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/80 text-pretty">
            <strong className="text-white">{p.tagline}.</strong> {p.summary}
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {chips.map((c) => (
              <li key={c.label} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium">
                <c.icon className="size-4 text-coral" aria-hidden /> {c.label}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            {soon ? (
              <a href={whatsappLink(p)} target="_blank" rel="noopener" className={BUTTON.coral}>
                <Bell className="size-5" aria-hidden /> Être prévenu(e)
              </a>
            ) : (
              <WhatsAppButton href={whatsappLink(p)}>S&apos;inscrire</WhatsAppButton>
            )}
            <a href="#contenu" className={BUTTON.ghost}>
              Le contenu <ArrowDown className="size-4" aria-hidden />
            </a>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-sm lg:max-w-none">
          <div className="aspect-[4/3] overflow-hidden rounded-[2rem] border-4 border-white/15 lg:aspect-[4/5]">
            <Photo name={p.photo} alt={p.name} sizes="(max-width: 1023px) 90vw, 420px" position={p.photoPos} eager />
          </div>
          <PhraseCard role={role} icon={Icon} en={p.phrases[0].en} fr={p.phrases[0].fr} className="absolute -bottom-6 left-4 right-4 animate-float text-ink sm:left-auto sm:-right-4 sm:max-w-xs" />
        </div>
      </Container>
    </section>
  );
}

function Panel({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border-2 border-border bg-card p-6">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold text-brand-deep">
        <span className="flex size-9 items-center justify-center rounded-xl bg-brand-soft text-primary">
          <Icon className="size-5" aria-hidden />
        </span>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Checks({ items, icon: Icon = CircleCheck }: { items: readonly string[]; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <ul className="grid gap-2">
      {items.map((i) => (
        <li key={i} className="flex gap-2">
          <Icon className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          <span>{i}</span>
        </li>
      ))}
    </ul>
  );
}

function Content({ program: p }: { program: Program }) {
  return (
    <section id="contenu" className="pt-16 pb-12 sm:pt-20">
      <Container className="grid gap-5 md:grid-cols-2">
        <Panel icon={UserCheck} title="Pour qui ?">
          <p className="text-ink/85">{p.audience}</p>
        </Panel>
        <Panel icon={Target} title="Objectifs">
          <Checks items={p.objectives} />
        </Panel>
        <Panel icon={MessageSquareText} title="Situations travaillées">
          <Checks items={p.situations} icon={ArrowRight} />
        </Panel>
        <Panel icon={BookOpenText} title="Vocabulaire">
          <ul className="flex flex-wrap gap-2">
            {p.vocabulary.map((v) => (
              <li key={v} className="rounded-full bg-brand-soft px-3 py-1.5 text-sm font-medium text-brand-deep">
                {v}
              </li>
            ))}
          </ul>
        </Panel>
      </Container>
    </section>
  );
}

function Phrases({ program: p, role }: { program: Program; role: string }) {
  return (
    <section className="bg-brand-soft/60 py-16 sm:py-20">
      <Container>
        <SectionHead
          pill="Ce que vous saurez dire"
          title="Des phrases tirées du terrain"
          text="Écoutez, devinez le sens, puis vérifiez : c'est le réflexe que vous travaillerez dans chaque leçon."
        />
        <div className="grid gap-5 md:grid-cols-3">
          {p.phrases.map((ph) => (
            <PhraseFlip key={ph.en} role={role} en={ph.en} fr={ph.fr} />
          ))}
        </div>
      </Container>
    </section>
  );
}

function Format({ program: p }: { program: Program }) {
  return (
    <section id="format" className="py-16 sm:py-20">
      <Container>
        <SectionHead pill="Le format" title={`${p.duration} pour parler l'anglais de votre métier`} />
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {formatFor(p).map((f) => {
            const Icon = ICONS[f.icon];
            return (
              <li key={f.label} className="rounded-3xl border-2 border-border bg-card p-6 text-center">
                <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-coral-soft text-coral-dark">
                  <Icon className="size-6" aria-hidden />
                </span>
                <h3 className="text-lg font-extrabold text-brand-deep">{f.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}

function EssentialsDetails({ program: p }: { program: Program }) {
  const d = p.details!;
  return (
    <>
      <section id="niveaux" className="py-16 sm:py-20">
        <Container>
          <SectionHead pill="Votre parcours" title={`${d.levels.length} niveaux de 8 semaines`} />
          <div className="grid gap-5 md:grid-cols-2">
            {d.levels.map((l, i) => (
              <div key={l.badge} className="relative rounded-3xl border-2 border-border bg-card p-6">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-bold text-white">
                  {l.badge}
                </span>
                <h3 className="mt-3 text-2xl font-extrabold text-brand-deep">{l.title}</h3>
                <p className="mt-2 text-ink/85">{l.text}</p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {l.tags.map((t) => (
                    <li key={t} className="rounded-full bg-brand-soft px-3 py-1 text-sm font-medium text-brand-deep">
                      {t}
                    </li>
                  ))}
                </ul>
                {i < d.levels.length - 1 && (
                  <ArrowRight className="absolute top-1/2 -right-4 z-10 hidden size-8 -translate-y-1/2 rounded-full border-2 border-border bg-card p-1.5 text-primary md:block" aria-hidden />
                )}
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section id="infos-pratiques" className="bg-brand-soft/60 py-16 sm:py-20">
        <Container>
          <SectionHead pill="Détails pratiques" title="Tout ce qu'il faut savoir pour démarrer" />
          <div className="grid gap-5 md:grid-cols-2">
            <Panel icon={Layers} title="Structure de la formation">
              <Checks items={d.structure} />
            </Panel>
            <Panel icon={Wallet} title="Participation">
              <Checks items={d.pricing} />
            </Panel>
            <div className="md:col-span-2">
              <Panel icon={Laptop} title="Format">
                <p className="text-ink/85">{d.formatNote}</p>
              </Panel>
            </div>
          </div>
        </Container>
      </section>

      <section id="calendrier" className="py-16 sm:py-20">
        <Container>
          {d.sessions.length === 0 ? (
            <div className="grid items-center gap-6 rounded-[2rem] border-2 border-border bg-card p-6 sm:p-10 lg:grid-cols-[1.5fr_1fr]">
              <div>
                <Pill>Prochaines sessions</Pill>
                <h2 className="mt-3 text-2xl font-extrabold text-brand-deep sm:text-3xl">Les dates des sessions de 8 semaines arrivent bientôt</h2>
                <p className="mt-2 text-muted-foreground">
                  Réservez dès maintenant : nous vous confirmons la date de démarrage et l&apos;horaire. Places limitées à {d.seats} par session.
                </p>
              </div>
              <WhatsAppButton href={whatsappLink(p)}>Réserver ma place</WhatsAppButton>
            </div>
          ) : (
            <>
              <SectionHead pill={`Calendrier ${d.calendarYear}`} title={`${d.sessions.length} sessions dans l'année`} />
              <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
                <Panel icon={CalendarDays} title="Dates des sessions">
                  <ul className="grid gap-2">
                    {d.sessions.map((s) => (
                      <li key={s.label} className="flex flex-wrap justify-between gap-2 rounded-2xl bg-brand-soft px-4 py-2.5">
                        <strong className="text-brand-deep">{s.label}</strong>
                        <span>{s.start} → {s.end}</span>
                      </li>
                    ))}
                  </ul>
                </Panel>
                <div className="grid content-start gap-3">
                  {d.schedule.map((sl) => (
                    <div key={sl.day} className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-4">
                      <CalendarDays className="size-5 text-primary" aria-hidden />
                      <span><strong>{sl.day}</strong> · {sl.time}</span>
                    </div>
                  ))}
                  <div className="rounded-3xl border-2 border-border bg-card p-6 text-center">
                    <p className="font-heading text-5xl font-extrabold text-coral">{d.seats}</p>
                    <p className="mt-1 mb-4 text-muted-foreground">places par session</p>
                    <WhatsAppButton href={whatsappLink(p)} className="w-full">Réserver ma place</WhatsAppButton>
                  </div>
                </div>
              </div>
            </>
          )}
        </Container>
      </section>
    </>
  );
}

function FinalCta({ program: p }: { program: Program }) {
  const soon = p.status === "soon";
  return (
    <section className="pb-16">
      <Container>
        <div className="relative overflow-hidden rounded-[2.5rem] bg-brand-deep p-8 text-white sm:p-12">
          <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-24 size-80 rounded-full bg-coral/30 blur-3xl" />
          <div className="relative grid items-center gap-8 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <h2 className="text-3xl font-extrabold text-balance">{soon ? "Soyez parmi les premiers" : "Prêt à commencer ?"}</h2>
              <p className="mt-3 text-white/80">
                {soon
                  ? `${p.name} ouvre bientôt. Laissez-nous votre contact sur WhatsApp : nous vous prévenons dès l'ouverture des inscriptions.`
                  : `Écrivez-nous sur WhatsApp pour vous inscrire à ${p.name} : un conseiller vous indique les prochaines dates${p.details ? "" : " et le tarif"}.`}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              {soon ? (
                <a href={whatsappLink(p)} target="_blank" rel="noopener" className={BUTTON.coral}>
                  <Bell className="size-5" aria-hidden /> Être prévenu(e)
                </a>
              ) : (
                <WhatsAppButton href={whatsappLink(p)}>S&apos;inscrire sur WhatsApp</WhatsAppButton>
              )}
              <a href={`tel:${PHONE_TEL}`} className={BUTTON.ghost}>
                <Phone className="size-4" aria-hidden /> {PHONE_DISPLAY}
              </a>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

function Others({ current }: { current: string }) {
  return (
    <section className="pb-16 sm:pb-20">
      <Container>
        <h2 className="mb-5 text-2xl font-extrabold text-brand-deep">Les autres programmes</h2>
        <ul className="flex flex-wrap gap-2.5">
          {PROGRAMS.filter((o) => o.slug !== current).map((o) => {
            const Icon = ICONS[o.icon];
            return (
              <li key={o.slug}>
                <Link
                  href={`/programmes/${o.slug}`}
                  className="inline-flex items-center gap-2 rounded-2xl border-2 border-border bg-card px-4 py-2.5 font-semibold text-brand-deep transition hover:-translate-y-0.5 hover:border-primary/40"
                >
                  <Icon className="size-4 text-primary" aria-hidden /> {o.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
