import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, Clock, Flame, Layers, ListChecks, PartyPopper } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { courseAccess, courseTree } from "@/lib/learn/queries";
import { nextPath } from "@/lib/learn/paths";
import { findProgram, programPhoto, sameName } from "@/lib/catalog";
import type { Outline } from "@/lib/learn/progress";
import { CourseMap } from "@/components/learn/course-map";
import { AccessProblem, PageSkeleton } from "@/components/learn/ui";
import { Leaderboard } from "@/components/gamify/leaderboard";
import { PreviewBar, adminPaths } from "@/components/learn/preview-bar";

export const metadata: Metadata = { title: "Mon cours", robots: { index: false } };

async function CourseHome({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  await connection();
  const me = await requireUser(`/apprendre/${courseId}`);
  const access = await courseAccess(me, courseId);
  if (!access.ok) return <AccessProblem reason={access.reason} startDate={access.enrollment?.startDate} />;

  const { outline } = await courseTree(me, access);
  const course = access.course;
  const program = findProgram(course.program);
  const next = nextPath(courseId, outline.next);

  return (
    <div className="grid gap-6">
      {access.preview && <PreviewBar text="Staff preview: everything is open and nothing is saved." editHref={adminPaths.course(courseId)} />}
      {access.readOnly && (
        <p className="rounded-2xl bg-brand-soft px-4 py-2.5 text-sm font-semibold text-primary">Cours terminé : vous pouvez tout revoir.</p>
      )}

      <CourseHero
        title={course.title}
        programName={program && !sameName(program.name, course.title) ? program.name : null}
        image={course.imageUrl || (program ? programPhoto(program).small : null)}
        outline={outline}
        next={next}
      />

      {outline.modules.length === 0 ? (
        <p className="rounded-3xl border-2 border-dashed border-border p-8 text-center text-muted-foreground">Le contenu de ce cours arrive bientôt.</p>
      ) : (
        <CourseMap courseId={courseId} outline={outline} currentHref={next} />
      )}

      <Leaderboard courseId={courseId} meId={me.id} />
    </div>
  );
}

/**
 * Course header: the course image (own image, else the programme photo) blurred behind a navy veil,
 * a sharp thumbnail, progress ring, key figures and the « Continuer » button. The blurred copy is the
 * small 720 px file, scaled up: the blur hides the resolution and it stays light on mobile data.
 */
function CourseHero({ title, programName, image, outline, next }: { title: string; programName: string | null; image: string | null; outline: Outline; next: string | null }) {
  const units = outline.modules.flatMap((m) => m.units);
  const minutes = units.reduce((n, u) => n + u.estimatedMinutes, 0);
  const R = 34;
  const C = 2 * Math.PI * R;
  return (
    <section className="relative isolate overflow-clip rounded-3xl bg-brand-deep text-white">
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" aria-hidden decoding="async" className="absolute inset-0 -z-20 size-full scale-125 object-cover blur-xl saturate-150" />
      )}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-br from-brand-deep/35 via-brand-deep/60 to-brand-deep/90" />

      <div className="flex items-start gap-5 p-5 sm:p-7">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="hidden aspect-square w-28 shrink-0 rounded-2xl object-cover shadow-lg ring-2 ring-white/25 sm:block" />
        )}
        <div className="min-w-0 flex-1">
          {programName && <p className="text-sm font-semibold text-white/80">{programName}</p>}
          <h1 className="text-2xl leading-tight font-extrabold text-white sm:text-3xl">{title}</h1>
          {outline.challenge && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border-2 border-coral bg-white px-3 py-1 text-sm font-bold text-coral-dark">
              <Flame className="size-4" aria-hidden /> Jour {outline.challenge.unlockedDay} / {outline.challenge.totalDays} · {outline.challenge.streak} validé(s)
            </p>
          )}
          <ul className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            <li className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1">
              <Layers className="size-3.5" aria-hidden /> {outline.modules.length} {outline.modules.length > 1 ? "modules" : "module"}
            </li>
            <li className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1">
              <ListChecks className="size-3.5" aria-hidden /> {units.length} {units.length > 1 ? "unités" : "unité"}
            </li>
            {minutes > 0 && (
              <li className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1">
                <Clock className="size-3.5" aria-hidden /> {minutes >= 60 ? `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}` : `${minutes} min`}
              </li>
            )}
          </ul>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={outline.percent}
          aria-label="Progression dans le cours"
          className="relative grid size-20 shrink-0 place-items-center"
        >
          <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="40" cy="40" r={R} fill="none" strokeWidth="7" className="stroke-white/15" />
            <circle cx="40" cy="40" r={R} fill="none" strokeWidth="7" strokeLinecap="round" stroke="white" strokeDasharray={C} strokeDashoffset={C * (1 - outline.percent / 100)} className="transition-[stroke-dashoffset] duration-700" />
          </svg>
          <span className="text-center leading-none">
            <span className="block text-lg font-extrabold tabular-nums">{outline.percent}%</span>
            <span className="text-[10px] font-semibold text-white/75">
              {outline.stepsDone}/{outline.stepsTotal}
            </span>
          </span>
        </div>
      </div>

      {next ? (
        <div className="border-t border-white/10 bg-black/10 px-5 py-4 sm:px-7">
          <Link
            href={next}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-coral bg-white text-[19px] font-bold text-coral shadow-[0_5px_0_0_var(--color-coral)] transition hover:bg-coral-soft active:translate-y-1 active:shadow-[0_1px_0_0_var(--color-coral)] sm:w-auto sm:px-8"
          >
            {outline.stepsDone ? "Continuer" : "Commencer"} <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      ) : outline.stepsTotal > 0 && outline.percent === 100 ? (
        <p className="flex items-center gap-2 border-t border-white/10 bg-black/10 px-5 py-4 font-heading text-lg font-bold sm:px-7">
          <PartyPopper className="size-6" aria-hidden /> Bravo, tout est fait pour l&apos;instant !
        </p>
      ) : null}
    </section>
  );
}

export default function CoursePage({ params }: PageProps<"/apprendre/[courseId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CourseHome params={params} />
    </Suspense>
  );
}
