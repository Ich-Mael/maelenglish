import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, Eye, Flame, PartyPopper } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { courseAccess, courseTree } from "@/lib/learn/queries";
import { coursePath, lessonPath, nextPath } from "@/lib/learn/paths";
import { DownloadCourse } from "@/components/pwa/download-course";
import { findProgram } from "@/lib/catalog";
import { CourseMap } from "@/components/learn/course-map";
import { AccessProblem, PageSkeleton, ProgressBar } from "@/components/learn/ui";
import { Leaderboard } from "@/components/gamify/leaderboard";

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
    <div className="mx-auto grid max-w-2xl gap-6">
      {access.preview && (
        <p className="flex items-center gap-2 rounded-2xl bg-xp/15 px-4 py-2.5 text-sm font-semibold text-[#7a4d00]">
          <Eye className="size-4" aria-hidden /> Aperçu équipe : tout est ouvert et rien n&apos;est enregistré.
        </p>
      )}
      {access.readOnly && (
        <p className="rounded-2xl bg-success/10 px-4 py-2.5 text-sm font-semibold text-success">Cours terminé : vous pouvez tout revoir.</p>
      )}

      <section className="rounded-3xl border-2 border-border bg-card p-5 sm:p-6">
        {program && <p className="text-sm font-semibold text-coral-dark">{program.name}</p>}
        <h1 className="text-2xl font-extrabold text-brand-deep sm:text-3xl">{course.title}</h1>
        {outline.challenge && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-coral-soft px-3 py-1 text-sm font-bold text-coral-dark">
            <Flame className="size-4" aria-hidden /> Jour {outline.challenge.unlockedDay} / {outline.challenge.totalDays} · {outline.challenge.streak} validé(s)
          </p>
        )}
        <div className="mt-4 flex items-center justify-between text-sm font-semibold">
          <span className="text-ink/75">
            {outline.lessonsDone} / {outline.lessonsTotal} leçons
          </span>
          <span className="text-success">{outline.percent} %</span>
        </div>
        <ProgressBar value={outline.percent} className="mt-1.5" />
        {next ? (
          <Link
            href={next}
            className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-coral text-[19px] font-bold text-white shadow-[0_5px_0_0_var(--color-coral-dark)] transition active:translate-y-1 active:shadow-[0_1px_0_0_var(--color-coral-dark)] sm:w-auto sm:px-8"
          >
            {outline.lessonsDone ? "Continuer" : "Commencer"} <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : outline.lessonsTotal > 0 && outline.percent === 100 ? (
          <p className="mt-5 flex items-center gap-2 font-heading text-lg font-bold text-success">
            <PartyPopper className="size-6" aria-hidden /> Bravo, tout est fait pour l&apos;instant !
          </p>
        ) : null}
      </section>

      {outline.lessonsTotal > 0 && (
        <DownloadCourse
          courseId={courseId}
          urls={[
            coursePath(courseId),
            "/mes-cours",
            // Every lesson of the open modules: offline, the next lesson can be done without asking the server.
            ...outline.modules.filter((m) => m.state !== "locked").flatMap((m) => m.lessons.map((l) => lessonPath(courseId, l.id))),
          ]}
        />
      )}

      {outline.modules.length === 0 ? (
        <p className="rounded-3xl border-2 border-dashed border-border p-8 text-center text-muted-foreground">Le contenu de ce cours arrive bientôt.</p>
      ) : (
        <CourseMap courseId={courseId} outline={outline} currentHref={next} />
      )}

      <Leaderboard courseId={courseId} meId={me.id} />
    </div>
  );
}

export default function CoursePage({ params }: PageProps<"/apprendre/[courseId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CourseHome params={params} />
    </Suspense>
  );
}
