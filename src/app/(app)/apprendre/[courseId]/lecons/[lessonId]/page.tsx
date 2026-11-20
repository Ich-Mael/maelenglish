import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { headers } from "next/headers";
import { ChevronLeft, Download, Lock } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { courseAccess, courseTree } from "@/lib/learn/queries";
import { coursePath, lessonPath } from "@/lib/learn/paths";
import { stepAfter } from "@/lib/learn/sequence";
import { videoSource } from "@/lib/learn/media";
import type { Exercise } from "@/lib/learn/exercises";
import { AccessProblem, PageSkeleton } from "@/components/learn/ui";
import { RichText } from "@/components/learn/rich-text";
import { CompleteButton } from "@/components/learn/complete-button";
import { PracticePlayer } from "@/components/learn/practice/player";
import { TvPlayer } from "@/components/learn/tv-player";
import { PreviewBar, adminPaths } from "@/components/learn/preview-bar";

export const metadata: Metadata = { title: "Leçon", robots: { index: false } };

async function LessonView({ params }: { params: Promise<{ courseId: string; lessonId: string }> }) {
  const { courseId, lessonId } = await params;
  await connection();
  const me = await requireUser(lessonPath(courseId, lessonId));
  const access = await courseAccess(me, courseId);
  if (!access.ok) return <AccessProblem reason={access.reason} startDate={access.enrollment?.startDate} />;

  const { lessons, modules, outline } = await courseTree(me, access);
  const lesson = lessons.find((l) => String(l._id) === lessonId);
  const mod0 = outline.modules.find((m) => m.lessons.some((l) => l.id === lessonId));
  let state = mod0?.lessons.find((l) => l.id === lessonId)?.state;
  if (!lesson || !state) return <AccessProblem reason="not-found" />;
  // Offline download (service worker): lessons of an open module are fetched ahead of order,
  // so they can be done offline; results are replayed in order and re-checked by the server.
  if (state === "locked" && mod0?.state !== "locked" && (await headers()).get("x-me-offline") === "1") state = "available";

  const back = coursePath(courseId);
  if (state === "locked") {
    return (
      <div className="mx-auto max-w-md rounded-3xl border-2 border-border bg-card p-8 text-center">
        <Lock className="mx-auto size-12 text-muted-foreground" aria-hidden />
        <h1 className="mt-4 text-2xl font-extrabold text-brand-deep">Leçon verrouillée</h1>
        <p className="mt-2 text-muted-foreground">Terminez les étapes précédentes pour l&apos;ouvrir.</p>
        <Link href={back} className="mt-6 inline-flex h-11 items-center rounded-2xl bg-primary px-5 font-semibold text-white">
          Retour au parcours
        </Link>
      </div>
    );
  }

  const nextHref = stepAfter(courseId, outline, lessonPath(courseId, lessonId));
  const mod = modules.find((m) => String(m._id) === String(lesson.moduleId));

  if (lesson.type === "practice") {
    const exercises: Exercise[] = (lesson.exercises ?? []).map((e) => {
      const { _id, ...rest } = e as unknown as Exercise & { _id: unknown };
      return JSON.parse(JSON.stringify({ ...rest, id: String(_id) })) as Exercise;
    });
    return (
      <>
        {access.preview && <PreviewBar text="Aperçu équipe : les résultats ne sont pas enregistrés." editHref={adminPaths.lesson(courseId, lessonId)} className="mx-auto mb-6 max-w-2xl" />}
        <PracticePlayer courseId={courseId} lessonId={lessonId} title={lesson.title} exercises={exercises} courseHref={back} nextHref={nextHref} />
      </>
    );
  }

  const video = lesson.type === "video" ? videoSource(lesson.videoUrl) : null;
  return (
    <article className="mx-auto grid max-w-3xl gap-6">
      {access.preview && <PreviewBar text="Aperçu équipe : rien n’est enregistré." editHref={adminPaths.lesson(courseId, lessonId)} />}
      <header>
        <Link href={back} className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-primary">
          <ChevronLeft className="size-4" aria-hidden /> {mod?.title ?? "Parcours"}
        </Link>
        <h1 className="mt-2 text-3xl font-extrabold text-brand-deep">{lesson.title}</h1>
        {lesson.description && <p className="mt-1 text-muted-foreground">{lesson.description}</p>}
      </header>

      {lesson.type === "video" &&
        (video ? (
          <TvPlayer source={video} title={lesson.title} />
        ) : (
          <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">La vidéo de cette leçon n&apos;est pas encore disponible.</p>
        ))}

      {lesson.type === "pdf" && lesson.fileUrl && (
        <div className="grid gap-3">
          <iframe src={lesson.fileUrl} title={lesson.fileName || lesson.title} className="h-[70vh] w-full rounded-3xl border-2 border-border bg-card" />
          <a href={lesson.fileUrl} target="_blank" rel="noopener" download className="inline-flex w-fit items-center gap-2 rounded-2xl border-2 border-border px-4 py-2 font-semibold text-brand-deep hover:bg-brand-soft">
            <Download className="size-4" aria-hidden /> Télécharger {lesson.fileName || "le PDF"}
          </a>
        </div>
      )}

      {lesson.content && (
        <div className="rounded-3xl border-2 border-border bg-card p-5 sm:p-8">
          <RichText>{lesson.content}</RichText>
        </div>
      )}

      <div className="flex justify-end">
        {access.readOnly ? (
          <Link href={nextHref} className="inline-flex h-12 items-center rounded-2xl bg-primary px-6 font-semibold text-white">
            Étape suivante
          </Link>
        ) : (
          <CompleteButton courseId={courseId} lessonId={lessonId} done={state === "completed"} nextHref={nextHref} />
        )}
      </div>
    </article>
  );
}

export default function LessonPage({ params }: PageProps<"/apprendre/[courseId]/lecons/[lessonId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LessonView params={params} />
    </Suspense>
  );
}
