import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { requireStaff, courseFor } from "@/lib/admin/context";
import { Card, PageHeader } from "@/components/admin/ui";
import { QuizEditor, type EditableQuiz } from "@/components/admin/quiz-editor";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Final exam" };

async function Finals({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  await connection();
  const me = await requireStaff(`/admin/cours/${courseId}/final`);
  const course = await courseFor(me, courseId, "edit");
  if (!course) notFound();
  const exam: EditableQuiz = {
    title: course.finalExam?.title ?? "",
    passingScore: course.finalExam?.passingScore ?? 70,
    timeLimit: course.finalExam?.timeLimit ?? 0,
    questions: (course.finalExam?.questions ?? []).map((q) => ({
      _id: String((q as unknown as { _id: unknown })._id),
      text: q.text,
      options: q.options.map((o) => ({ id: o.id, text: o.text })),
      correctOptionId: q.correctOptionId,
      explanation: q.explanation ?? "",
    })),
  };
  return (
    <div className="grid max-w-4xl gap-5">
      <PageHeader title="Final exam" back={{ href: `/admin/cours/${courseId}`, label: course.title }} subtitle="It opens when every module is complete." />
      <Card title="Final exam" description="Graded on the server; passing = 100 XP and the « Diplômé(e) » badge. No questions = no exam.">
        <QuizEditor courseId={courseId} initial={exam} />
      </Card>
    </div>
  );
}

export default function Page({ params }: PageProps<"/admin/cours/[courseId]/final">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Finals params={params} />
    </Suspense>
  );
}
