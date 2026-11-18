import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { requireStaff, courseFor } from "@/lib/admin/context";
import { Card, PageHeader } from "@/components/admin/ui";
import { AdminForm, Submit } from "@/components/admin/forms";
import { AssignmentFields } from "@/components/admin/assignment-fields";
import { QuizEditor, type EditableQuiz } from "@/components/admin/quiz-editor";
import { saveAssignmentAction } from "../../../actions";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Examen et projet final" };

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
      <PageHeader title="Examen et projet final" back={{ href: `/admin/cours/${courseId}`, label: course.title }} subtitle="Ils s'ouvrent quand tous les modules sont terminés." />
      <Card title="Examen final" description="Noté sur le serveur ; réussi = 100 XP et badge « Diplômé(e) ». Sans question, pas d'examen.">
        <QuizEditor target={{ courseId }} initial={exam} label="examen" />
      </Card>
      <Card title="Projet final" description="Corrigé par un coach. Consignes vides = pas de projet.">
        <AdminForm action={saveAssignmentAction}>
          <input type="hidden" name="courseId" value={courseId} />
          <AssignmentFields a={course.finalProject} />
          <div>
            <Submit>Enregistrer le projet</Submit>
          </div>
        </AdminForm>
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
