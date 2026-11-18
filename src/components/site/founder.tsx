import { Quote } from "lucide-react";
import { FOUNDER } from "@/lib/content";
import { waLink } from "@/lib/site";
import { Photo } from "./photo";
import { Pill, WhatsAppButton } from "./ui";
import { cn } from "cn";

const talkLink = waLink(`Bonjour ${FOUNDER.nickname}, je souhaite des conseils pour choisir mon programme MaelEnglish.`);

/** « Votre coach » section (dark, matches the portrait's navy background). */
export function FounderSection() {
  return (
    <section id="votre-coach" className="relative overflow-hidden bg-[#070b1d] py-16 text-white sm:py-20" aria-labelledby="founder-title">
      <div aria-hidden className="pointer-events-none absolute -top-40 right-0 size-[30rem] bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--color-primary)_30%,transparent),transparent)]" />
      <div className="relative mx-auto grid w-full max-w-6xl items-start gap-10 px-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative mx-auto w-full max-w-sm lg:sticky lg:top-24 lg:max-w-none">
          <div className="reveal aspect-square overflow-hidden rounded-[2.5rem] ring-1 ring-white/10">
            <Photo name={FOUNDER.photo} alt={`${FOUNDER.name}, ${FOUNDER.title}`} sizes="(max-width: 1023px) 90vw, 480px" position="center 30%" />
          </div>
          <div className="absolute -bottom-5 left-1/2 w-max -translate-x-1/2 rounded-2xl bg-coral px-5 py-2.5 text-center shadow-xl">
            <p className="font-heading text-xl font-extrabold">{FOUNDER.name}</p>
            <p className="text-xs font-bold text-brand-deep">{FOUNDER.title}</p>
          </div>
        </div>
        <div className="reveal pt-4 lg:pt-0">
          <Pill tone="light">Votre coach</Pill>
          <h2 id="founder-title" className="mt-3 text-3xl font-extrabold text-balance sm:text-4xl">
            Bonjour, je suis {FOUNDER.firstName}
          </h2>
          <p className="mt-1 text-white/70">{FOUNDER.greeting}</p>
          <p className="mt-3 text-lg font-semibold text-xp">{FOUNDER.tagline}</p>
          <div className="mt-4 grid gap-3 text-white/80">
            {FOUNDER.story.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <ul className="mt-6 grid gap-3 sm:grid-cols-3">
            {FOUNDER.facts.map((f) => (
              <li key={f.label} className="rounded-2xl bg-white/8 p-4 ring-1 ring-white/10">
                <p className="font-heading text-2xl font-extrabold text-coral">{f.value}</p>
                <p className="text-sm text-white/75">{f.label}</p>
              </li>
            ))}
          </ul>
          <figure className="mt-6 border-l-4 border-coral pl-4">
            <blockquote className="flex gap-3 text-lg italic text-white/90">
              <Quote className="size-5 shrink-0 text-coral" aria-hidden />« {FOUNDER.quote} »
            </blockquote>
            <figcaption className="mt-1 pl-8 text-sm font-semibold text-coral">— {FOUNDER.nickname}</figcaption>
          </figure>
          <WhatsAppButton href={talkLink} className="mt-7">
            Parler à {FOUNDER.nickname}
          </WhatsAppButton>
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
