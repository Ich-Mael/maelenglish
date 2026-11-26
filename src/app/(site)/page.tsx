import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, BadgeCheck, Headphones, Laptop, LayoutGrid, Mic, Quote, Crown, Stethoscope, UserPlus, Users } from "lucide-react";
import { PROGRAMS, whatsappLink } from "@/lib/catalog";
import { COACHING, METHOD_STEPS, STATS, TESTIMONIALS } from "@/lib/content";
import { GOAL_ICONS } from "@/components/site/icons";
import { signupHref } from "@/lib/site";
import { ProgramCard } from "@/components/site/program-card";
import { Carousel } from "@/components/site/carousel";
import { Photo } from "@/components/site/photo";
import { BUTTON, Container, PhraseCard, SectionHead, WhatsAppButton } from "@/components/site/ui";
import { JsonLd, organizationJsonLd } from "@/components/site/json-ld";
import { FounderSection } from "@/components/site/founder";

const featured = PROGRAMS.find((p) => p.featured);
const jobs = PROGRAMS.filter((p) => !p.featured);
/** The carousel: MaelEnglish Essentials first (the basics), then the job programmes. */
const carousel = featured ? [featured, ...jobs] : jobs;

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
          {/* The slogan builds word by word, then a coral stroke draws under « Your Profession » (CSS only, off with reduced motion). */}
          <h1 lang="en" aria-label="Speak the Language of Your Profession" className="hero-words text-4xl leading-[1.05] font-extrabold text-primary text-balance sm:text-5xl lg:text-6xl">
            {["Speak", "the", "Language", "of"].map((w, i) => (
              <span key={w} aria-hidden className="hero-word" style={{ "--i": i } as React.CSSProperties}>
                {w}{" "}
              </span>
            ))}
            <span aria-hidden className="hero-profession relative inline-block text-coral">
              {["Your", "Profession"].map((w, i) => (
                <span key={w} className="hero-word" style={{ "--i": i + 4 } as React.CSSProperties}>
                  {w}
                  {i === 0 ? " " : ""}
                </span>
              ))}
              <svg viewBox="0 0 300 16" preserveAspectRatio="none" className="hero-stroke pointer-events-none absolute -bottom-2 left-0 h-3 w-full text-coral sm:-bottom-3 sm:h-4" aria-hidden>
                <path d="M3 11 C 60 3, 140 3, 200 7 S 280 12, 297 5" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" pathLength={1} />
              </svg>
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground text-pretty">
            Réunions, e-mails, entretiens, clients : pratiquez l&apos;anglais des situations que vous vivez vraiment au travail,
            avec un coach qui corrige chaque étape.
          </p>
          {/* The two ways in, side by side and the same width: the programmes, and the free diagnostic. */}
          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
            <a href="#programmes" className="group flex items-center gap-3 rounded-2xl border-2 border-primary bg-primary p-3 pr-4 text-white shadow-[0_4px_0_0_var(--color-brand-deep)] transition hover:brightness-110 active:translate-y-0.5 active:shadow-[0_1px_0_0_var(--color-brand-deep)]">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <LayoutGrid className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-heading text-lg leading-tight font-extrabold">Nos programmes</span>
                <span className="block text-sm text-white/85">Un anglais adapté à votre métier</span>
              </span>
              <ArrowDown className="size-5 shrink-0 transition group-hover:translate-y-0.5 motion-reduce:transition-none" aria-hidden />
            </a>
            <Link href="/diagnostic" className="group flex items-center gap-3 rounded-2xl border-2 border-coral bg-white p-3 pr-4 shadow-[0_4px_0_0_var(--color-coral)] transition hover:bg-coral-soft active:translate-y-0.5 active:shadow-[0_1px_0_0_var(--color-coral)]">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-coral-soft text-coral">
                <Stethoscope className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-heading text-lg leading-tight font-extrabold text-brand-deep">Diagnostic gratuit</span>
                <span className="block text-sm text-muted-foreground">Découvre ce qui freine ton anglais</span>
              </span>
              <ArrowRight className="size-5 shrink-0 text-coral transition group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
            </Link>
          </div>
          {/* Key facts: 2 × 2. */}
          <ul className="mt-6 grid max-w-md grid-cols-2 gap-x-6 gap-y-3 text-sm font-semibold text-ink/75">
            <li className="flex items-center gap-1.5"><LayoutGrid className="size-4 shrink-0 text-primary" aria-hidden /> {PROGRAMS.length} programmes</li>
            <li className="flex items-center gap-1.5"><Users className="size-4 shrink-0 text-primary" aria-hidden /> 40+ professionnels formés</li>
            <li className="flex items-center gap-1.5"><BadgeCheck className="size-4 shrink-0 text-primary" aria-hidden /> Coach certifié TEFL</li>
            <li className="flex items-center gap-1.5"><Laptop className="size-4 shrink-0 text-primary" aria-hidden /> 100 % en ligne</li>
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
    <section id="programmes" className="relative border-t border-primary/10 bg-gradient-to-b from-[#e1e7f8] via-[#e9eefb] to-brand-soft py-16 sm:py-20">
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
            label="Programmes"
            prevLabel="Programmes précédents"
            nextLabel="Programmes suivants"
            heading={
              <>
                <p className="text-xs font-bold tracking-wide text-coral-dark uppercase">Les bases, puis l&apos;anglais de votre secteur</p>
                <h3 className="mt-1 text-2xl font-extrabold text-brand-deep sm:text-3xl">
                  {carousel.length} programmes{" "}
                  <span className="text-muted-foreground">
                    · Essentials + {jobs.length} métiers
                  </span>
                </h3>
              </>
            }
          >
            {carousel.map((p) => (
              <ProgramCard key={p.slug} program={p} ribbon={p.featured ? "Pour commencer" : undefined} />
            ))}
          </Carousel>
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
        <SectionHead pill="Comment ça marche" title="Parler d'abord, la grammaire au service de la parole" className="mb-6" />
        {/* The two speaking features that set MaelEnglish apart. */}
        <div className="reveal mx-auto mb-10 grid max-w-4xl gap-3 sm:grid-cols-2">
          <p className="sm:col-span-2 text-center text-lg text-ink/80 text-pretty">
            Avec MaelEnglish, l&apos;essentiel est de <strong className="text-brand-deep">parler</strong>. Deux rendez-vous vous font pratiquer à voix haute :
          </p>
          <div className="flex items-start gap-3 rounded-2xl border-2 border-coral bg-white p-4 shadow-[0_4px_0_0_var(--color-coral)]">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-coral-soft text-coral">
              <Mic className="size-5" aria-hidden />
            </span>
            <span>
              <span lang="en" className="block font-heading text-lg font-extrabold text-brand-deep">
                Speaking Challenge
              </span>
              <span className="block text-sm text-ink/75">À la fin de chaque unité, vous vous enregistrez dans une situation de votre métier. Votre coach vous répond, par écrit ou en message vocal.</span>
            </span>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border-2 border-primary bg-white p-4 shadow-[0_4px_0_0_var(--color-primary)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized portrait */}
            <img src="/images/coach-ish-256.webp" alt="" width={40} height={40} className="size-10 shrink-0 rounded-xl object-cover" />
            <span>
              <span lang="en" className="block font-heading text-lg font-extrabold">
                <span className="text-coral-dark">Talk with</span> <span className="text-primary">Coach Ish</span>
              </span>
              <span className="block text-sm text-ink/75">Une vraie conversation à voix haute avec une IA qui joue votre interlocuteur (recruteur, client, collègue…), puis un bilan avec vos corrections.</span>
            </span>
          </div>
        </div>
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
      </Container>
    </section>
  );
}

function Stats() {
  return (
    <section aria-label="MaelEnglish en chiffres" className="bg-brand-deep py-12 text-white">
      <Container>
        <dl className="grid grid-cols-2 gap-8 text-center sm:grid-cols-3 [&>div:last-child:nth-child(odd)]:col-span-2 sm:[&>div:last-child:nth-child(odd)]:col-span-1">
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

/** « Coach Ish » and « Shadowing » stand out in the testimonials (the two things learners name most). */
function Highlight({ text }: { text: string }) {
  return (
    <>
      {text.split(/(Coach Ish|Shadowing)/g).map((part, i) =>
        part === "Coach Ish" || part === "Shadowing" ? (
          <strong key={i} className="font-semibold text-primary">
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}

// Brand rule: no solid red backgrounds — blue gradients, or white with a red ring.
const AVATAR_TONES = ["bg-gradient-to-br from-primary to-brand-deep text-white", "border-2 border-coral bg-white text-coral-dark", "bg-gradient-to-br from-brand-deep to-primary text-white"];

function Testimonials() {
  // What learners name, counted from their own words (no invented figure).
  const cited = (w: string) => TESTIMONIALS.filter((t) => t.text.includes(w)).length;
  const themes = [
    { icon: Mic, label: "Conversations avec Coach Ish", n: cited("Coach Ish") },
    { icon: Headphones, label: "Shadowing pour la prononciation", n: cited("Shadowing") },
  ].filter((x) => x.n > 0);
  return (
    <section id="temoignages" className="py-16 sm:py-20">
      <Container>
        <SectionHead pill="Ils parlent l'anglais de leur métier" title="Ce que disent nos apprenants" text="Des professionnels et des étudiants d'Afrique de l'Ouest, d'Afrique centrale et d'ailleurs racontent leur pratique sur MaelEnglish." />
        <ul className="reveal mb-8 flex flex-wrap justify-center gap-2.5">
          {themes.map((x) => (
            <li key={x.label} className="flex items-center gap-2.5 rounded-full border-2 border-primary/15 bg-white py-1.5 pr-4 pl-1.5 text-sm text-brand-deep shadow-[0_1px_2px_rgb(20_31_77/0.06)]">
              <span className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-primary">
                <x.icon className="size-4" aria-hidden />
              </span>
              <span>
                <strong className="font-heading text-base">{x.label}</strong>
                <span className="block text-muted-foreground sm:inline"><span className="hidden sm:inline"> · </span>cité par {x.n} apprenant{x.n > 1 ? "s" : ""} sur {TESTIMONIALS.length}</span>
              </span>
            </li>
          ))}
        </ul>
        {/* Carousel (swipe on phones, arrows on desktop). No .reveal inside: it would follow the horizontal scroller. */}
        <Carousel label="Témoignages" prevLabel="Témoignages précédents" nextLabel="Témoignages suivants">
          {TESTIMONIALS.map((t, i) => (
            <figure key={t.name} className="relative flex w-full flex-col overflow-clip rounded-3xl border-2 border-border bg-card shadow-[0_1px_2px_rgb(20_31_77/0.05),0_18px_36px_-24px_rgb(20_31_77/0.35)]">
              <span aria-hidden className="h-1.5 bg-gradient-to-r from-primary via-primary to-coral" />
              <div className="flex flex-1 flex-col p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-bold">
                  {t.program ? (
                    <Link href={t.program === "coaching" ? "/coaching" : `/programmes/${t.program}`} className="rounded-full bg-brand-soft px-3 py-1 text-primary hover:bg-primary hover:text-white">
                      {t.programLabel}
                    </Link>
                  ) : (
                    <span className="rounded-full bg-brand-soft px-3 py-1 text-primary">{t.programLabel}</span>
                  )}
                </div>
                <Quote className="mb-2 size-8 shrink-0 fill-coral/15 text-coral" aria-hidden />
                <blockquote className="flex flex-1 flex-col gap-3">
                  <p className="font-heading text-xl leading-snug font-extrabold text-balance text-brand-deep">« {t.headline} »</p>
                  <p className="text-[15px] leading-relaxed text-ink/75">
                    <Highlight text={t.text} />
                  </p>
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3 border-t border-border pt-4">
                  <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${AVATAR_TONES[i % AVATAR_TONES.length]} font-heading text-lg font-bold`} aria-hidden>
                    {t.name.charAt(0)}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-bold text-brand-deep">{t.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {t.role} ·{" "}
                      <span className="whitespace-nowrap">
                        <span aria-hidden>{t.flag}</span> {t.country}
                      </span>
                    </span>
                  </span>
                </figcaption>
              </div>
            </figure>
          ))}
        </Carousel>
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
