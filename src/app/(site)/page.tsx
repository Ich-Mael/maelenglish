import Image from "next/image";
import { ArrowDown, ArrowRight, Briefcase, HeartPulse, Laptop, LayoutGrid, Quote, UserRound, Users, Zap } from "lucide-react";
import { PROGRAMS, whatsappLink } from "@/lib/catalog";
import { METHOD_FACTS, METHOD_STEPS, STATS, TESTIMONIALS, quizItems } from "@/lib/content";
import { CHALLENGE_WA } from "@/lib/site";
import { FeaturedProgramCard, ProgramCard } from "@/components/site/program-card";
import { MiniQuiz } from "@/components/site/mini-quiz";
import { Photo } from "@/components/site/photo";
import { BUTTON, Container, PhraseCard, SectionHead, WhatsAppButton } from "@/components/site/ui";
import { JsonLd, organizationJsonLd } from "@/components/site/json-ld";
import { FounderSection } from "@/components/site/founder";
import { FOUNDER } from "@/lib/content";

const featured = PROGRAMS.find((p) => p.featured);
const jobs = PROGRAMS.filter((p) => !p.featured);

export default function HomePage() {
  return (
    <>
      <JsonLd data={organizationJsonLd()} />
      <Hero />
      <Programmes />
      <TryIt />
      <FounderSection />
      <Method />
      <Stats />
      <Testimonials />
      <FinalCta />
    </>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-48 -right-40 size-[34rem] bg-[radial-gradient(closest-side,var(--color-coral-soft),transparent)]" />
      <div aria-hidden className="pointer-events-none absolute top-40 -left-48 size-[30rem] bg-[radial-gradient(closest-side,var(--color-brand-soft),transparent)]" />
      <Container className="relative grid items-center gap-12 py-12 sm:py-16 lg:grid-cols-[1.15fr_1fr] lg:py-20">
        <div>
          <Image src="/images/maelenglish-logo.webp" alt="" width={800} height={175} priority className="mb-6 h-auto w-52 sm:w-60" />
          <h1 lang="en" className="text-4xl leading-[1.05] font-extrabold text-brand-deep text-balance sm:text-5xl lg:text-6xl">
            Speak the Language of <span className="text-coral-strong">Your Profession</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground text-pretty">
            Réunions, e-mails, entretiens, clients : avec MaelEnglish, vous pratiquez l&apos;anglais des situations que vous
            vivez vraiment au travail, accompagné par des coachs qui corrigent chaque étape.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#programmes" className={BUTTON.coral}>
              Voir les programmes <ArrowDown className="size-4" aria-hidden />
            </a>
            <WhatsAppButton href={whatsappLink()} variant="outline">
              Parler à un conseiller
            </WhatsAppButton>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-ink/75">
            <li className="flex items-center gap-1.5"><LayoutGrid className="size-4 text-primary" aria-hidden /> {PROGRAMS.length} programmes</li>
            <li className="flex items-center gap-1.5"><Users className="size-4 text-primary" aria-hidden /> 40+ professionnels formés</li>
            <li className="flex items-center gap-1.5"><Laptop className="size-4 text-primary" aria-hidden /> 100 % en ligne</li>
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-label="Exemples de phrases professionnelles">
          <div className="relative aspect-square overflow-hidden rounded-[2.5rem] border-4 border-white bg-[#070b1d] shadow-[0_30px_70px_-30px_rgb(20_31_77/0.6)]">
            <Photo name={FOUNDER.photo} alt={`${FOUNDER.name}, fondateur de MaelEnglish`} sizes="(max-width: 1023px) 90vw, 480px" position="center 30%" eager />
            <a href="#votre-coach" className="absolute top-4 left-4 rounded-2xl bg-white/95 px-3.5 py-2 shadow-lg hover:bg-white">
              <span className="block font-heading text-sm font-extrabold text-brand-deep">{FOUNDER.name}</span>
              <span className="block text-xs font-semibold text-coral-dark">{FOUNDER.nickname} · fondateur</span>
            </a>
          </div>
          <PhraseCard
            role="Health"
            icon={HeartPulse}
            en="Can you describe the pain?"
            fr="Pouvez-vous décrire la douleur ?"
            className="absolute top-[58%] -left-8 hidden max-w-[15rem] animate-float sm:block"
          />
          <PhraseCard
            role="Business"
            icon={Briefcase}
            en="Let's go over the agenda for today's meeting."
            fr="Passons en revue l'ordre du jour de la réunion."
            className="absolute -right-6 bottom-6 hidden max-w-[16rem] animate-float [animation-delay:-3s] sm:block"
          />
        </div>
      </Container>
    </section>
  );
}

function Programmes() {
  return (
    <section id="programmes" className="bg-brand-soft/60 py-16 sm:py-20">
      <Container>
        <SectionHead
          pill="Nos programmes"
          title="L'anglais général, puis l'anglais de votre métier"
          text="Commencez par les bases avec Essentials, ou choisissez directement le programme de votre secteur."
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured && <FeaturedProgramCard program={featured} />}
          {jobs.map((p) => (
            <ProgramCard key={p.slug} program={p} />
          ))}
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <AltFormat
            href="/coaching"
            icon={<UserRound className="size-6" aria-hidden />}
            title="MaelEnglish Coaching"
            text="Un coach rien que pour vous, un programme taillé pour votre poste et vos échéances. Idéal si votre secteur n'est pas dans la liste."
            cta="Découvrir"
            className="bg-brand-deep"
          />
          <AltFormat
            href={CHALLENGE_WA}
            external
            icon={<Zap className="size-6" aria-hidden />}
            title="MaelEnglish Challenge"
            text="Une mission par jour, un point de contrôle validé par un coach avant de passer à la suivante : idéal pour créer l'habitude."
            cta="Rejoindre"
            className="bg-gradient-to-br from-coral-strong to-coral-dark"
          />
        </div>
      </Container>
    </section>
  );
}

function AltFormat({
  href,
  external,
  icon,
  title,
  text,
  cta,
  className,
}: {
  href: string;
  external?: boolean;
  icon: React.ReactNode;
  title: string;
  text: string;
  cta: string;
  className: string;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener" } : {})}
      className={`group flex flex-col gap-4 rounded-3xl p-6 text-white transition hover:-translate-y-1 sm:flex-row sm:items-center ${className}`}
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">{icon}</span>
      <div className="flex-1">
        <h3 className="text-xl font-extrabold">{title}</h3>
        <p className="mt-1 text-sm text-white/80">{text}</p>
      </div>
      <span className="inline-flex items-center gap-1.5 font-bold">
        {cta} <ArrowRight className="size-4 transition group-hover:translate-x-1" aria-hidden />
      </span>
    </a>
  );
}

function TryIt() {
  return (
    <section id="testez-vous" className="py-16 sm:py-20">
      <Container>
        <SectionHead
          pill="Testez-vous"
          title="10 secondes pour parler votre métier"
          text="Choisissez votre secteur et trouvez la bonne traduction. Comme dans les leçons : on gagne de l'XP et on garde sa série."
        />
        <MiniQuiz items={quizItems()} />
      </Container>
    </section>
  );
}

function Method() {
  return (
    <section id="methode" className="bg-brand-soft/60 py-16 sm:py-20">
      <Container>
        <SectionHead pill="Comment ça marche" title="Parler d'abord, la grammaire au service de la parole" />
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {METHOD_STEPS.map((s, i) => (
            <li key={s.title} className="relative rounded-3xl border-2 border-border bg-card p-6">
              <span className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-coral-strong font-heading text-lg font-extrabold text-white shadow-[0_4px_0_0_var(--color-coral-dark)]">
                {i + 1}
              </span>
              <h3 className="text-lg font-extrabold text-brand-deep">{s.title}</h3>
              <p className="mt-1.5 text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>
        <ul className="mt-8 flex flex-wrap justify-center gap-2.5">
          {METHOD_FACTS.map((f) => (
            <li key={f} className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-ink/80">
              {f}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

function Stats() {
  return (
    <section aria-label="MaelEnglish en chiffres" className="bg-brand-deep py-12 text-white">
      <Container>
        <dl className="grid grid-cols-2 gap-8 text-center lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="flex flex-col">
              <dt className="order-2 mt-1 text-sm text-white/70">{s.label}</dt>
              <dd className="font-heading text-4xl font-extrabold sm:text-5xl">
                {s.value}
                <span className="text-coral">{s.suffix}</span>
              </dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}

function Testimonials() {
  return (
    <section id="temoignages" className="py-16 sm:py-20">
      <Container>
        <SectionHead pill="Ils parlent l'anglais de leur métier" title="Des résultats concrets" />
        <div className="grid gap-5 sm:grid-cols-2">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="flex flex-col rounded-3xl border-2 border-border bg-card p-6">
              <Quote className="mb-3 size-7 text-coral" aria-hidden />
              <blockquote className="flex-1 text-ink/90">« {t.text} »</blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-primary font-heading font-bold text-white" aria-hidden>
                  {t.name.charAt(0)}
                </span>
                <span>
                  <span className="block font-bold text-brand-deep">{t.name}</span>
                  <span className="text-sm text-muted-foreground">{t.role}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </Container>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="pb-16 sm:pb-20">
      <Container>
        <div className="relative overflow-hidden rounded-[2.5rem] bg-brand-deep p-8 text-white sm:p-12">
          <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-80 bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--color-primary)_50%,transparent),transparent)]" />
          <div className="relative grid items-center gap-8 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <Image src="/images/maelenglish-logo-light.webp" alt="" width={800} height={259} className="mb-5 h-auto w-44" />
              <h2 className="text-3xl font-extrabold text-balance">Vous hésitez entre deux programmes ?</h2>
              <p className="mt-3 text-white/80">
                Dites-nous votre métier et votre niveau : un conseiller vous oriente. Si besoin, commencez par Essentials puis
                poursuivez avec le programme de votre secteur.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <WhatsAppButton href={whatsappLink()}>Écrire sur WhatsApp</WhatsAppButton>
              <a href="#programmes" className={BUTTON.ghost}>
                Voir les programmes
              </a>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
