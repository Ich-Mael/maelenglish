import Link from "next/link";
import { ArrowRight, BadgeCheck, Compass, Lightbulb, Plane, Quote, Stethoscope, Trophy } from "lucide-react";
import { FOUNDER } from "@/lib/content";
import { waLink } from "@/lib/site";
import { Photo } from "./photo";
import { Pill } from "./ui";
import { WhatsAppIcon } from "./icons";
import { cn } from "cn";

const talkLink = waLink(`Bonjour ${FOUNDER.nickname}, je souhaite des conseils pour choisir mon programme MaelEnglish.`);

/** Titles of the three story paragraphs (the paragraphs themselves are the founder's own words). */
const CHAPTERS = [
  { title: "Mon parcours", icon: Compass },
  { title: "Mes résultats", icon: Trophy },
  { title: "Pourquoi MaelEnglish", icon: Lightbulb },
];

/** « Votre coach » section: portrait, mission, key figures, story timeline, quote. */
export function FounderSection() {
  return (
    <section id="votre-coach" className="relative overflow-clip bg-white py-16 sm:py-24" aria-labelledby="founder-title">
      <div aria-hidden className="pointer-events-none absolute -top-32 -left-40 size-[32rem] bg-[radial-gradient(closest-side,var(--color-brand-soft),transparent)]" />
      <div aria-hidden className="pointer-events-none absolute -right-40 bottom-0 size-[30rem] bg-[radial-gradient(closest-side,var(--color-coral-soft),transparent)]" />

      <div className="relative mx-auto grid w-full max-w-6xl items-start gap-12 px-4 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        {/* Portrait */}
        <div className="relative mx-auto w-full max-w-sm lg:sticky lg:top-28 lg:max-w-none">
          {/* hover: the blue card swings out, the photo lifts and zooms (no transform on .reveal itself) */}
          <div className="group reveal relative">
            <div aria-hidden className="absolute inset-0 translate-x-4 translate-y-4 rotate-3 rounded-[2.5rem] bg-primary transition duration-500 ease-out motion-safe:group-hover:translate-x-6 motion-safe:group-hover:translate-y-6 motion-safe:group-hover:rotate-6" />
            <div className="relative aspect-[4/5] overflow-hidden rounded-[2.5rem] bg-[#070b1d] shadow-[0_30px_60px_-30px_rgb(20_31_77/0.7)] transition duration-500 ease-out motion-safe:group-hover:-translate-y-1.5 motion-safe:group-hover:-rotate-1">
              <Photo name={FOUNDER.photo} alt={`${FOUNDER.name}, ${FOUNDER.title}`} sizes="(max-width: 1023px) 90vw, 440px" position="center 25%" className="transition duration-700 ease-out motion-safe:group-hover:scale-[1.05]" />
            </div>
            <span className="absolute top-5 -left-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-bold text-primary shadow-lg sm:-left-5">
              <BadgeCheck className="size-4.5" aria-hidden /> Coach certifié TEFL
            </span>
            <div className="absolute -bottom-6 left-1/2 w-max -translate-x-1/2 rounded-2xl border-2 border-coral bg-white px-5 py-2.5 text-center shadow-xl">
              <p className="font-heading text-xl font-extrabold text-brand-deep">{FOUNDER.name}</p>
              <p className="text-xs font-bold text-coral-dark">{FOUNDER.nickname} · Formateur certifié</p>
            </div>
          </div>

          {/* Credentials under the portrait */}
          <ul className="reveal mt-12 grid gap-3">
            {FOUNDER.credentials.map((c, i) => {
              const Icon = i === 0 ? BadgeCheck : Plane;
              return (
                <li key={c.title} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-[0_1px_2px_rgb(20_31_77/0.05)]">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span>
                    <span className="block font-heading text-lg leading-tight font-extrabold text-primary">{c.title}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{c.text}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Story */}
        <div className="pt-6 lg:pt-0">
          <div className="reveal">
            <Pill>Votre coach</Pill>
            <h2 id="founder-title" className="mt-3 text-4xl font-extrabold text-primary text-balance sm:text-5xl">
              Bonjour, je suis <span className="text-coral">{FOUNDER.firstName}</span>
            </h2>
            <p className="mt-2 text-lg text-muted-foreground">{FOUNDER.greeting}</p>
            <p className="mt-6 border-l-4 border-coral pl-5 font-heading text-xl leading-snug font-bold text-brand-deep sm:text-2xl">
              {FOUNDER.tagline}
            </p>
          </div>

          <ul className="reveal mt-8 grid grid-cols-2 gap-2 sm:gap-3">
            {FOUNDER.facts.map((f) => (
              <li key={f.label} className="rounded-2xl border border-border bg-card p-3 shadow-[0_1px_2px_rgb(20_31_77/0.05)] sm:p-4">
                <p className="font-heading text-lg leading-tight font-extrabold text-primary sm:text-2xl">{f.value}</p>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{f.label}</p>
              </li>
            ))}
          </ul>

          <ol className="relative mt-10 grid gap-8 before:absolute before:top-2 before:bottom-2 before:left-5 before:w-0.5 before:bg-gradient-to-b before:from-primary/40 before:via-coral/40 before:to-transparent">
            {FOUNDER.story.map((text, i) => {
              const c = CHAPTERS[i] ?? CHAPTERS[CHAPTERS.length - 1];
              return (
                <li key={c.title} className="reveal relative pl-16">
                  <span
                    className={cn(
                      "absolute top-0 left-0 flex size-10 items-center justify-center rounded-full border-2 bg-white shadow-sm",
                      i === CHAPTERS.length - 1 ? "border-coral text-coral" : "border-primary text-primary",
                    )}
                    aria-hidden
                  >
                    <c.icon className="size-5" />
                  </span>
                  <h3 className="text-lg font-extrabold text-brand-deep">{c.title}</h3>
                  <p className="mt-1.5 leading-relaxed text-ink/80">{text}</p>
                </li>
              );
            })}
          </ol>

          <figure className="reveal relative mt-10 overflow-hidden rounded-3xl bg-brand-deep p-6 text-white sm:p-8">
            <Quote className="absolute right-4 -bottom-4 size-28 text-white/10" aria-hidden />
            <blockquote className="relative font-heading text-xl leading-snug font-bold sm:text-2xl">« {FOUNDER.quote} »</blockquote>
            <figcaption className="relative mt-4 flex flex-wrap items-center gap-3">
              <span className="size-10 overflow-hidden rounded-full ring-2 ring-coral">
                <Photo name={FOUNDER.photo} alt="" sizes="40px" position="center 25%" />
              </span>
              <span>
                <span className="block font-bold">{FOUNDER.nickname}</span>
                <span className="block text-sm text-white/75">{FOUNDER.name}</span>
              </span>
              {/* Talk to Coach Ish, inside the quote card: white button. */}
              <a href={talkLink} target="_blank" rel="noopener" className="ml-auto inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-brand-deep shadow-[0_4px_0_0_rgb(255_255_255/0.35)] transition hover:bg-brand-soft active:translate-y-0.5 active:shadow-none">
                <WhatsAppIcon className="size-5 text-[#25D366]" /> Parler à {FOUNDER.nickname}
              </a>
            </figcaption>
          </figure>


          {/* The free diagnostic, under Coach Ish's story and contact (the left column is sticky: kept out of it). */}
          <Link href="/diagnostic" className="group mt-6 flex items-center gap-3 rounded-2xl border-2 border-coral bg-white p-4 shadow-[0_4px_0_0_var(--color-coral)] transition hover:bg-coral-soft active:translate-y-0.5 active:shadow-[0_1px_0_0_var(--color-coral)]">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-coral-soft text-coral">
              <Stethoscope className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-heading text-lg leading-tight font-extrabold text-brand-deep">Faire mon diagnostic gratuit</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">Qu&apos;est-ce qui freine votre anglais&nbsp;? 8 minutes, un rapport personnalisé.</span>
            </span>
            <ArrowRight className="size-5 shrink-0 text-coral transition group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Compact coach card (coaching page, hero). */
export function FounderCard({ className, dark }: { className?: string; dark?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl p-3 pr-5", dark ? "bg-white/10 text-white" : "border border-border bg-card shadow-[0_12px_30px_-14px_rgb(21_26_51/0.35)]", className)}>
      <span className="size-14 shrink-0 overflow-hidden rounded-xl bg-[#070b1d]">
        <Photo name={FOUNDER.photo} alt="" sizes="56px" position="center 25%" />
      </span>
      <span>
        <span className={cn("block font-heading font-extrabold", dark ? "text-white" : "text-brand-deep")}>{FOUNDER.name}</span>
        <span className={cn("block text-xs", dark ? "text-white/75" : "text-muted-foreground")}>{FOUNDER.title}</span>
      </span>
    </div>
  );
}
