import type { Metadata } from "next";
import { toEditorHtml } from "@/lib/rich-text";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { requireStaff, courseFor } from "@/lib/admin/context";
import { Lesson, Module, type LessonDoc } from "@/models";
import { PageHeader } from "@/components/admin/ui";
import { LessonEditor } from "@/components/admin/lesson-editor";
import { PageSkeleton } from "@/components/learn/ui";
import type { Exercise } from "@/lib/learn/exercises";

export const metadata: Metadata = { title: "Leçon" };

const TYPE_LABEL = { video: "Vidéo", text: "Texte", pdf: "PDF", practice: "Pratique interactive" };

async function LessonAdmin({ params }: { params: Promise<{ courseId: string; lessonId: string }> }) {
  const { courseId, lessonId } = await params;
  await connection();
  const me = await requireStaff(`/admin/cours/${courseId}/lecons/${lessonId}`);
  const course = await courseFor(me, courseId, "edit");
  if (!course) notFound();
  const lesson = await Lesson.findOne({ _id: lessonId, courseId }).lean<LessonDoc>().catch(() => null);
  if (!lesson) notFound();
  const mod = await Module.findById(lesson.moduleId).select("title").lean();
  const exercises = JSON.parse(JSON.stringify(lesson.exercises ?? [])) as (Partial<Exercise> & { _id?: string })[];

  return (
    <div className="max-w-4xl">
      <PageHeader title={lesson.title} back={{ href: `/admin/cours/${courseId}/modules/${lesson.moduleId}`, label: mod?.title ?? "Module" }} subtitle={TYPE_LABEL[lesson.type]} />
      <LessonEditor
        previewHref={`/apprendre/${courseId}/lecons/${lessonId}`}
        lesson={{
          id: lessonId,
          type: lesson.type,
          title: lesson.title,
          description: lesson.description ?? "",
          isPublished: !!lesson.isPublished,
          videoUrl: lesson.videoUrl ?? "",
          durationMinutes: lesson.durationMinutes ?? 0,
          content: toEditorHtml(lesson.content),
          fileUrl: lesson.fileUrl ?? "",
          fileName: lesson.fileName ?? "",
          exercises,
        }}
      />
    </div>
  );
}

export default function Page({ params }: PageProps<"/admin/cours/[courseId]/lecons/[lessonId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LessonAdmin params={params} />
    </Suspense>
  );
}
