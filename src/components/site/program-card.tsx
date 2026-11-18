import Link from "next/link";
import { ArrowRight, BarChart3, CircleCheck, Hourglass, Laptop, PlayCircle, Timer } from "lucide-react";
import { shortProgramName, type Program } from "@/lib/catalog";
import { ICONS } from "./icons";
import { Photo } from "./photo";
import { PhraseCard } from "./ui";

export function StatusBadge({ program, long }: { program: Program; long?: boolean }) {
  return program.status === "soon" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-xp px-2.5 py-1 text-xs font-bold text-brand-deep shadow-sm">
      <Hourglass className="size-3.5" aria-hidden /> Bientôt
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-success shadow-sm ring-1 ring-success/20">
      <CircleCheck className="size-3.5" aria-hidden /> {long ? "Inscriptions ouvertes" : "Ouvert"}
    </span>
  );
}

function Chip({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-deep">
      <Icon className="size-3.5 text-primary" aria-hidden /> {children}
    </li>
  );
}

/** Round « go » affordance shared by the cards (white with red border, like the buttons). */
function GoArrow() {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-coral text-coral transition group-hover:translate-x-1 group-hover:bg-coral-soft">
      <ArrowRight className="size-5" aria-hidden />
    </span>
  );
}

export function FeaturedProgramCard({ program: p }: { program: Program }) {
  const Icon = ICONS[p.icon];
  return (
    <Link
      href={`/programmes/${p.slug}`}
      className="group grid overflow-hidden rounded-[2rem] border border-border bg-card shadow-[0_24px_60px_-30px_rgb(54_79_171/0.5)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_32px_70px_-30px_rgb(54_79_171/0.55)] lg:grid-cols-[1.1fr_1fr]"
    >
      <div className="flex flex-col p-6 sm:p-9">
        <div className="mb-5 flex items-center justify-between gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-primary">
            <Icon className="size-6" aria-hidden />
          </span>
          <StatusBadge program={p} long />
        </div>
        <p className="text-xs font-bold tracking-wide text-coral-dark uppercase">Besoin de revoir les bases ?</p>
        <h3 className="mt-1 text-3xl font-extrabold text-primary sm:text-4xl">
          {p.name.startsWith("MaelEnglish ") ? (
            <>
              MaelEnglish <span className="text-coral">{p.name.slice("MaelEnglish ".length)}</span>
            </>
          ) : (
            shortProgramName(p)
          )}
        </h3>
        <p className="mt-1 font-semibold text-ink/75">{p.tagline}</p>
        <p className="mt-3 text-muted-foreground">{p.summary}</p>
        <ul className="mt-5 flex flex-wrap gap-2">
          <Chip icon={Timer}>{p.duration}</Chip>
          <Chip icon={PlayCircle}>{p.hours}</Chip>
          {p.details && <Chip icon={BarChart3}>{p.details.levels.length} niveaux</Chip>}
          <Chip icon={Laptop}>100 % en ligne</Chip>
        </ul>
        <span className="mt-auto flex items-center justify-between gap-3 pt-7 font-bold text-coral-dark">
          Découvrir le programme <GoArrow />
        </span>
      </div>
      <div className="relative min-h-64 overflow-hidden">
        <Photo name={p.photo} alt="" sizes="(max-width: 1023px) 100vw, 560px" position={p.photoPos} className="absolute inset-0 transition duration-700 group-hover:scale-[1.04]" />
        <PhraseCard role="Essentials" en={p.phrases[0].en} fr={p.phrases[0].fr} className="absolute right-4 bottom-4 left-4 sm:left-auto sm:max-w-xs" />
      </div>
    </Link>
  );
}

/** Job programme card (carousel slide). */
export function ProgramCard({ program: p }: { program: Program }) {
  const Icon = ICONS[p.icon];
  return (
    <Link
      href={`/programmes/${p.slug}`}
      className="group flex w-full flex-col overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[0_1px_2px_rgb(20_31_77/0.06)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_50px_-26px_rgb(54_79_171/0.5)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-brand-soft">
        <Photo
          name={p.photo}
          alt=""
          sizes="(max-width: 639px) 84vw, (max-width: 1023px) 46vw, 370px"
          position={p.photoPos}
          className="transition duration-700 group-hover:scale-[1.06]"
        />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 via-black/30 to-transparent" aria-hidden />
        <span className="absolute top-4 left-4 flex size-11 items-center justify-center rounded-2xl bg-white text-primary shadow-md">
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="absolute top-4 right-4">
          <StatusBadge program={p} />
        </span>
        <p className="absolute right-4 bottom-4 left-4 text-sm leading-snug font-semibold text-white">{p.tagline}</p>
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="text-2xl font-extrabold text-primary">{shortProgramName(p)}</h3>
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.summary}</p>
        <ul className="mt-4 flex flex-wrap gap-1.5">
          <Chip icon={Timer}>{p.duration}</Chip>
          <Chip icon={PlayCircle}>{p.hours.replace(" de contenu", "")}</Chip>
          <Chip icon={BarChart3}>{p.level}</Chip>
        </ul>
        <span className="mt-auto flex items-center justify-between gap-3 pt-6 text-sm font-bold text-coral-dark">
          Voir le programme <GoArrow />
        </span>
      </div>
    </Link>
  );
}
