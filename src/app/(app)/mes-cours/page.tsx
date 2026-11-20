import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, BookOpen, PartyPopper, Zap } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { myCourses, type MyCourse } from "@/lib/learn/queries";
import { sameName, whatsappLink } from "@/lib/catalog";
import { Photo } from "@/components/site/photo";
import { PageSkeleton, ProgressBar, formatDate } from "@/components/learn/ui";
import { cn } from "cn";
import { InstallPrompt } from "@/components/pwa/install-prompt";

export const metadata: Metadata = { title: "Mes cours", robots: { index: false } };

const STATE_LABEL: Record<MyCourse["state"], { label: string; cls: string } | null> = {
  active: null,
  completed: { label: "Terminé", cls: "bg-success/15 text-success" },
  "not-started": { label: "Bientôt", cls: "bg-xp/20 text-[#9a6200]" },
  expired: { label: "Accès terminé", cls: "bg-muted text-muted-foreground" },
  suspended: { label: "Suspendu", cls: "bg-destructive/10 text-destructive" },
};

async function Courses({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const me = await requireUser("/mes-cours");
  const [{ bienvenue }, courses] = await Promise.all([searchParams, myCourses(me)]);
  const current = courses.find((c) => c.state === "active");

  return (
    <div className="grid gap-6">
      {bienvenue && (
        <div role="status" className="flex animate-pop items-center gap-3 rounded-3xl bg-brand-deep p-5 text-white">
          <PartyPopper className="size-8 shrink-0 text-xp" aria-hidden />
          <p>
            <strong className="font-heading text-lg">C&apos;est parti, {me.name} !</strong>
            <br />
            Votre compte est activé. Voici vos cours.
          </p>
        </div>
      )}

      {me.isStaff && (
        <Link href="/admin" className="flex items-center justify-between rounded-2xl border-2 border-dashed border-primary/30 px-4 py-3 text-sm font-semibold text-primary hover:bg-brand-soft">
          Vous faites partie de l&apos;équipe : ouvrir l&apos;administration <ArrowRight className="size-4" aria-hidden />
        </Link>
      )}
      <div>
        <h1 className="text-3xl font-extrabold text-brand-deep">Bonjour {me.name} 👋</h1>
        <p className="text-muted-foreground">{current ? "Prêt(e) pour l'activité du jour ?" : "Retrouvez ici tous vos cours MaelEnglish."}</p>
      </div>

      <InstallPrompt />

      {courses.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-border bg-card p-8 text-center">
          <BookOpen className="mx-auto size-12 text-primary" aria-hidden />
          <h2 className="mt-3 text-xl font-extrabold text-brand-deep">Aucun cours pour l&apos;instant</h2>
          <p className="mt-1 text-muted-foreground">Dès que votre inscription est validée, votre cours apparaît ici.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/#programmes" className="inline-flex h-11 items-center rounded-2xl bg-primary px-5 font-semibold text-white">
              Voir les programmes
            </Link>
            <a href={whatsappLink()} target="_blank" rel="noopener" className="inline-flex h-11 items-center rounded-2xl border-2 border-border px-5 font-semibold text-brand-deep">
              Contacter l&apos;équipe
            </a>
          </div>
        </div>
      ) : (
        <ul className="grid gap-5 md:grid-cols-2">
          {courses.map((c) => (
            <li key={c.id}>
              <CourseCard course={c} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CourseCard({ course: c }: { course: MyCourse }) {
  const percent = c.lessonsTotal ? Math.round((c.lessonsDone / c.lessonsTotal) * 100) : 0;
  const badge = STATE_LABEL[c.state];
  const usable = c.state === "active" || c.state === "completed";
  const body = (
    <>
      <div className="relative aspect-[16/7] overflow-hidden bg-brand-soft">
        {c.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.imageUrl} alt="" className="size-full object-cover" />
        ) : c.programPhoto ? (
          <Photo name={c.programPhoto} alt="" sizes="(max-width: 767px) 100vw, 480px" />
        ) : null}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/50 to-transparent" />
        {c.isChallenge && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full border-2 border-coral bg-white px-2.5 py-1 text-xs font-bold text-coral-dark">
            <Zap className="size-3.5" aria-hidden /> Challenge
          </span>
        )}
        {badge && <span className={cn("absolute top-3 right-3 rounded-full px-2.5 py-1 text-xs font-bold", badge.cls)}>{badge.label}</span>}
        {c.programName && !sameName(c.programName, c.title) && <span className="absolute bottom-3 left-4 text-sm font-semibold text-white">{c.programName}</span>}
      </div>
      <div className="p-5">
        <h2 className="text-xl font-extrabold text-brand-deep">{c.title}</h2>
        {c.state === "not-started" && c.startDate ? (
          <p className="mt-1 text-sm text-muted-foreground">Commence le {formatDate(c.startDate)}</p>
        ) : c.endDate && c.state === "active" ? (
          <p className="mt-1 text-sm text-muted-foreground">Accès jusqu&apos;au {formatDate(c.endDate)}</p>
        ) : null}
        {usable && (
          <>
            <div className="mt-4 flex items-center justify-between text-sm font-semibold">
              <span className="text-ink/75">
                {c.lessonsDone} / {c.lessonsTotal} activités
              </span>
              <span className="text-success">{percent} %</span>
            </div>
            <ProgressBar value={percent} className="mt-1.5" />
            <span className="mt-4 inline-flex items-center gap-1.5 font-bold text-coral-dark">
              {c.state === "completed" ? "Revoir le cours" : c.lessonsDone ? "Continuer" : "Commencer"}{" "}
              <ArrowRight className="size-4 transition group-hover:translate-x-1" aria-hidden />
            </span>
          </>
        )}
      </div>
    </>
  );
  const cls = "group block overflow-hidden rounded-3xl border-2 border-border bg-card transition";
  return usable ? (
    <Link href={`/apprendre/${c.id}`} className={cn(cls, "hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_20px_44px_-24px_rgb(54_79_171/0.5)]")}>
      {body}
    </Link>
  ) : (
    <div className={cn(cls, "opacity-75")}>{body}</div>
  );
}

export default function MyCoursesPage({ searchParams }: PageProps<"/mes-cours">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Courses searchParams={searchParams} />
    </Suspense>
  );
}
