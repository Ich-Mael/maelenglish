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


const meta = "inline-flex items-center gap-1.5";

export function FeaturedProgramCard({ program: p }: { program: Program }) {
  const Icon = ICONS[p.icon];
  return (
    <Link
      href={`/programmes/${p.slug}`}
      className="group grid overflow-hidden rounded-[2rem] border-2 border-border bg-card shadow-[0_24px_60px_-30px_rgb(54_79_171/0.5)] transition hover:-translate-y-1 hover:border-primary/30 lg:col-span-full lg:grid-cols-[1.1fr_1fr]"
    >
      <div className="flex flex-col p-6 sm:p-8">
        <div className="mb-4 flex items-center justify-between">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-white">
            <Icon className="size-6" aria-hidden />
          </span>
          <StatusBadge program={p} long />
        </div>
        <h3 className="text-2xl font-extrabold text-brand-deep sm:text-3xl">
          {shortProgramName(p)}
        </h3>
        <p className="mt-1 font-semibold text-primary">{p.tagline}</p>
        <p className="mt-3 text-muted-foreground">{p.summary}</p>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-ink/80">
          <span className={meta}><Timer className="size-4 text-primary" aria-hidden /> {p.duration}</span>
          <span className={meta}><PlayCircle className="size-4 text-primary" aria-hidden /> {p.hours}</span>
          {p.details && <span className={meta}><BarChart3 className="size-4 text-primary" aria-hidden /> {p.details.levels.length} niveaux</span>}
          <span className={meta}><Laptop className="size-4 text-primary" aria-hidden /> 100 % en ligne</span>
        </div>
        <span className="mt-auto inline-flex items-center gap-1.5 pt-6 font-bold text-coral-dark">
          Découvrir le programme <ArrowRight className="size-4 transition group-hover:translate-x-1" aria-hidden />
        </span>
      </div>
      <div className="relative min-h-64">
        <Photo name={p.photo} alt="" sizes="(max-width: 1023px) 100vw, 560px" position={p.photoPos} className="absolute inset-0" />
        <PhraseCard role="Essentials" en={p.phrases[0].en} fr={p.phrases[0].fr} className="absolute right-4 bottom-4 left-4 sm:left-auto sm:max-w-xs" />
      </div>
    </Link>
  );
}

export function ProgramCard({ program: p }: { program: Program }) {
  const Icon = ICONS[p.icon];
  return (
    <Link
      href={`/programmes/${p.slug}`}
      className="group flex flex-col overflow-hidden rounded-3xl border-2 border-border bg-card transition hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_20px_44px_-24px_rgb(54_79_171/0.5)]"
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        <Photo
          name={p.photo}
          alt=""
          sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 380px"
          position={p.photoPos}
          className="transition duration-500 group-hover:scale-105"
        />
        <span className="absolute -bottom-5 left-5 flex size-11 items-center justify-center rounded-2xl border-4 border-card bg-primary text-white">
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="absolute top-3 right-3">
          <StatusBadge program={p} />
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5 pt-7">
        <h3 className="text-xl font-extrabold text-brand-deep">
          {shortProgramName(p)}
        </h3>
        <p className="text-sm font-semibold text-primary">{p.tagline}</p>
        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{p.summary}</p>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-medium text-ink/75">
          <span className={meta}><Timer className="size-3.5 text-primary" aria-hidden /> {p.duration}</span>
          <span className={meta}><PlayCircle className="size-3.5 text-primary" aria-hidden /> {p.hours}</span>
          <span className={meta}><BarChart3 className="size-3.5 text-primary" aria-hidden /> {p.level}</span>
        </div>
        <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-bold text-coral-dark">
          Voir le programme <ArrowRight className="size-4 transition group-hover:translate-x-1" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
