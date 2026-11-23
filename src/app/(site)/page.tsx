import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, BadgeCheck, Laptop, LayoutGrid, Quote, Crown, Sprout, UserPlus, Users, Zap } from "lucide-react";
import { PROGRAMS, whatsappLink } from "@/lib/catalog";
import { COACHING, METHOD_FACTS, METHOD_STEPS, STATS, TESTIMONIALS } from "@/lib/content";
import { GOAL_ICONS } from "@/components/site/icons";
import { signupHref } from "@/lib/site";
import { FeaturedProgramCard, ProgramCard } from "@/components/site/program-card";
import { Carousel } from "@/components/site/carousel";
import { Photo } from "@/components/site/photo";
import { BUTTON, Container, PhraseCard, SectionHead, WhatsAppButton } from "@/components/site/ui";
import { JsonLd, organizationJsonLd } from "@/components/site/json-ld";
import { FounderSection } from "@/components/site/founder";

const featured = PROGRAMS.find((p) => p.featured);
const jobs = PROGRAMS.filter((p) => !p.featured);

export default function HomePage() {
  return (
    <>
      <JsonLd data={organizationJsonLd()} />
      <Hero />
      <Programmes />
      <FounderSection />
      <CoachingPremium />
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
        <div className="hero-in">
          <h1 lang="en" className="text-4xl leading-[1.05] font-extrabold text-primary text-balance sm:text-5xl lg:text-6xl">
            Speak the Language of <span className="text-coral">Your Profession</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground text-pretty">
            Réunions, e-mails, entretiens, clients : pratiquez l&apos;anglais des situations que vous vivez vraiment au travail,
            avec un coach qui corrige chaque étape.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#programmes" className={BUTTON.blue}>
              Voir les programmes <ArrowDown className="size-4" aria-hidden />
            </a>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-ink/75">
            <li className="flex items-center gap-1.5"><LayoutGrid className="size-4 text-primary" aria-hidden /> {PROGRAMS.length} programmes</li>
            <li className="flex items-center gap-1.5"><Users className="size-4 text-primary" aria-hidden /> 40+ professionnels formés</li>
            <li className="flex items-center gap-1.5"><BadgeCheck className="size-4 text-primary" aria-hidden /> Coach certifié TEFL</li>
            <li className="flex items-center gap-1.5"><Laptop className="size-4 text-primary" aria-hidden /> 100 % en ligne</li>
          </ul>
        </div>

        <div className="hero-photo relative mx-auto w-full max-w-md lg:max-w-none">
          {/* hover: the frame lifts, the photo zooms slowly, the phrase card rises (motion-safe only) */}
          <div className="group relative aspect-square overflow-hidden rounded-[2.5rem] border-4 border-white bg-[#070b1d] shadow-[0_30px_70px_-30px_rgb(20_31_77/0.6)] transition duration-500 ease-out hover:shadow-[0_40px_80px_-30px_rgb(20_31_77/0.7)] motion-safe:hover:-translate-y-1.5">
            <Photo name="team" alt="Des professionnels africains travaillent ensemble sur un dossier en réunion" sizes="(max-width: 1023px) 90vw, 480px" position="80% center" eager className="transition duration-700 ease-out motion-safe:group-hover:scale-[1.06]" />
            <PhraseCard role="En équipe" en="Could you walk me through this part?" fr="Pouvez-vous m’expliquer cette partie ?" className="absolute right-4 bottom-4 left-4 transition duration-500 ease-out sm:left-auto sm:max-w-xs motion-safe:group-hover:-translate-y-1.5" />
          </div>
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
          title={
            <>
              L&apos;anglais de <span className="text-coral">votre métier</span>
            </>
          }
          text="Choisissez le programme de votre secteur, ou commencez par les bases avec MaelEnglish Essentials."
        />
        <div className="reveal">
          <Carousel
            label="Programmes métiers"
            heading={
              <>
                <p className="text-xs font-bold tracking-wide text-coral-dark uppercase">L&apos;anglais de votre secteur</p>
                <h3 className="mt-1 text-2xl font-extrabold text-brand-deep sm:text-3xl">
                  {jobs.length} programmes métiers <span className="text-muted-foreground">· 12 semaines</span>
                </h3>
              </>
            }
          >
            {jobs.map((p) => (
              <ProgramCard key={p.slug} program={p} />
            ))}
          </Carousel>
        </div>

        {featured && (
          <div className="reveal mx-auto mt-16 mb-8 max-w-4xl">
            <div className="relative flex flex-col gap-5 rounded-3xl border-2 border-coral bg-white p-6 shadow-[0_6px_0_0_var(--color-coral)] sm:flex-row sm:items-center sm:p-8">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-coral-soft text-coral-dark">
                <Sprout className="size-7" aria-hidden />
              </span>
              <div className="flex-1">
                <p className="font-heading text-2xl font-extrabold text-coral sm:text-[1.75rem]">Pas encore au niveau intermédiaire ?</p>
                <p className="mt-1 text-lg font-bold text-brand-deep">
                  Commencez par les bases, puis passez à <span className="text-primary">votre programme métier</span>.
                </p>
                <p className="mt-2 text-ink/80 text-pretty">
                  Les programmes métiers sont conçus pour un niveau intermédiaire. Si vous débutez, ou si vous avez du mal à tenir
                  une conversation simple, <strong className="text-brand-deep">MaelEnglish Essentials</strong> vous donne les
                  fondamentaux en 2 niveaux de 8 semaines. Vous enchaînez ensuite sur l&apos;anglais de votre secteur, avec confiance.
                </p>
              </div>
              <ArrowDown className="hidden size-7 shrink-0 animate-float text-coral sm:block" aria-hidden />
            </div>
          </div>
        )}

        {featured && (
          <div className="reveal">
            <FeaturedProgramCard program={featured} />
          </div>
        )}

        {/* MaelEnglish Challenge: a product of its own — a course with daily, coach-validated checkpoints */}
        <div className="reveal mt-5">
          <Link
            href={signupHref("challenge")}
            className="group flex flex-col gap-4 rounded-3xl border-2 border-coral bg-white p-6 text-brand-deep shadow-[0_6px_0_0_var(--color-coral)] transition hover:-translate-y-1 sm:flex-row sm:items-center sm:p-7"
          >
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-coral-soft text-coral-dark">
              <Zap className="size-7" aria-hidden />
            </span>
            <div className="flex-1">
              <p className="text-xs font-bold tracking-wide text-coral-dark uppercase">Défi quotidien</p>
              <h3 className="mt-0.5 text-2xl font-extrabold">
                MaelEnglish <span className="text-coral">Challenge</span>
              </h3>
              <p className="mt-1 text-ink/80">
                Une mission par jour, un point de contrôle validé par votre coach avant de passer au jour suivant : la régularité
                qui fait progresser.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 font-bold text-coral-dark">
              Relever le défi <ArrowRight className="size-4 transition group-hover:translate-x-1" aria-hidden />
            </span>
          </Link>
        </div>
      </Container>
    </section>
  );
}

/** MaelEnglish Coaching: the premium product — one-on-one classes for a specific goal (not a course). */
function CoachingPremium() {
  return (
    <section className="py-16 sm:py-20" aria-labelledby="coaching-title">
      <Container>
        <div className="reveal relative overflow-hidden rounded-[2.5rem] bg-brand-deep p-7 text-white sm:p-12">
          <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 size-80 bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--color-primary)_55%,transparent),transparent)]" />
          <div className="relative grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-xs font-bold tracking-wide uppercase">
                <Crown className="size-3.5 text-coral" aria-hidden /> MaelEnglish Coaching · Premium
              </span>
              <h2 id="coaching-title" className="mt-4 text-3xl font-extrabold text-balance sm:text-4xl">
                Un objectif précis ? <span className="text-coral">Un coach rien que pour vous.</span>
              </h2>
              <p className="mt-4 text-white/80">
                Des cours individuels, en direct avec votre coach, entièrement consacrés à votre échéance. Chaque séance prépare
                votre jour J.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/coaching" className={BUTTON.coral}>
                  Découvrir le coaching <ArrowRight className="size-4" aria-hidden />
                </Link>
                <Link href="/diagnostic" className={BUTTON.ghost}>
                  Demander mon diagnostic
                </Link>
              </div>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {COACHING.goals.map((g) => {
                const Icon = GOAL_ICONS[g.icon];
                return (
                  <li key={g.title} className="rounded-2xl bg-white/8 p-4 ring-1 ring-white/12">
                    <Icon className="size-6 text-coral" aria-hidden />
                    <h3 className="mt-2 font-heading text-lg font-extrabold">{g.title}</h3>
                    <p className="mt-1 text-sm text-white/75">{g.text}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}

function Method() {
  return (
    <section id="methode" className="bg-brand-soft/60 py-16 sm:py-20">
      <Container>
        <SectionHead pill="Comment ça marche" title="Parler d'abord, la grammaire au service de la parole" />
        <ol className="grid gap-5 md:grid-cols-3">
          {METHOD_STEPS.map((s, i) => (
            <li key={s.title} className="reveal relative rounded-3xl border-2 border-border bg-card p-6">
              <span className="mb-4 flex size-11 items-center justify-center rounded-2xl border-2 border-coral bg-white font-heading text-xl font-extrabold text-coral shadow-[0_4px_0_0_var(--color-coral)]">
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
            <div key={s.label} className="reveal flex flex-col">
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
            <figure key={t.name} className="reveal flex flex-col rounded-3xl border-2 border-border bg-card p-6">
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
        <div className="reveal relative overflow-hidden rounded-[2.5rem] bg-brand-deep p-8 text-white sm:p-12">
          <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-80 bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--color-primary)_50%,transparent),transparent)]" />
          <div className="relative grid items-center gap-8 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <Image src="/images/maelenglish-logo-light.webp" alt="" width={800} height={259} className="mb-5 h-auto w-44" />
              <h2 className="text-3xl font-extrabold text-balance">Prêt à parler l&apos;anglais de votre métier ?</h2>
              <p className="mt-3 text-white/80">
                Inscrivez-vous en quelques minutes : indiquez votre métier, votre niveau et vos disponibilités. Nous vous
                recontactons sur WhatsApp pour vous orienter vers le bon programme, ou vers MaelEnglish Essentials pour bien
                démarrer.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link href={signupHref()} className={BUTTON.coral}>
                <UserPlus className="size-5" aria-hidden /> S&apos;inscrire
              </Link>
              <WhatsAppButton href={whatsappLink()} variant="ghost">
                Une question ? Écrire sur WhatsApp
              </WhatsAppButton>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
