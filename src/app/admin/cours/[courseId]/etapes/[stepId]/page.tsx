import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { ExternalLink, Trash2 } from "lucide-react";
import { requireStaff, allowed, courseFor } from "@/lib/admin/context";
import { Step, Unit, type StepDoc } from "@/models";
import { cleanLessonContent } from "@/lib/course/lesson-content";
import { mediaUrlFor } from "@/lib/media";
import { stepPath } from "@/lib/learn/paths";
import { Card, Input, PageHeader, btn } from "@/components/admin/ui";
import { ActionButton, AdminForm, Submit } from "@/components/admin/forms";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { LessonStepEditor } from "@/components/admin/lesson-step-editor";
import { lessonMediaIds } from "@/components/learn/lesson-view";
import { PageSkeleton } from "@/components/learn/ui";
import { deleteStepAction, saveLessonStepAction } from "../../../../actions";

export const metadata: Metadata = { title: "Lesson" };

async function StepAdmin({ params }: { params: Promise<{ courseId: string; stepId: string }> }) {
  const { courseId, stepId } = await params;
  await connection();
  const me = await requireStaff(`/admin/cours/${courseId}/etapes/${stepId}`);
  const course = await courseFor(me, courseId, "view");
  if (!course) notFound();
  const step = await Step.findOne({ _id: stepId, courseId }).lean<StepDoc>().catch(() => null);
  if (!step) notFound();
  // Activities and challenges are edited in the Lab.
  if (step.kind !== "lesson") redirect(step.activityId ? `/admin/labo/${step.activityId}` : `/admin/cours/${courseId}/unites/${step.unitId}`);

  const edit = allowed(me, course, "edit");
  const unit = await Unit.findById(step.unitId).select("title").lean();
  const content = cleanLessonContent(step.content);
  const urls = Object.fromEntries(
    (await Promise.all(lessonMediaIds(content).map(async (id) => [id, await mediaUrlFor({ id: me.id, isAdmin: true }, id).catch(() => null)] as const))).filter((e): e is [string, string] => !!e[1]),
  );

  return (
    <div className="grid max-w-5xl gap-5">
      <PageHeader
        title={step.title}
        back={{ href: `/admin/cours/${courseId}/unites/${step.unitId}`, label: unit?.title ?? "Unit" }}
        subtitle={`Lesson · step ${step.position}`}
        actions={
          <a href={stepPath(courseId, stepId)} target="_blank" rel="noopener" className={btn.secondary}>
            <ExternalLink className="size-4" aria-hidden /> Learner preview
          </a>
        }
      />
      <Card title="Lesson" description="Teaches what the next activities (2 to 5) practise. Learners read it, then press « Continuer ».">
        {edit ? (
          <AdminForm action={saveLessonStepAction}>
            <input type="hidden" name="stepId" value={stepId} />
            <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
              <Input label="Title" name="title" defaultValue={step.title} required />
              <Input label="Minutes" name="estimatedMinutes" type="number" min={0} defaultValue={step.estimatedMinutes || ""} />
            </div>
            <RichTextEditor label="Intro" name="intro" defaultValue={content.intro} hint="A short explanation (French or English)." minHeight={160} />
            <LessonStepEditor initial={content} urls={urls} />
            <div>
              <Submit>Save the lesson</Submit>
            </div>
          </AdminForm>
        ) : (
          <p className="text-sm text-muted-foreground">You can view this course but not edit it.</p>
        )}
      </Card>
      {edit && (
        <Card title="Delete lesson" description="The activities practising it stay in the unit, without a lesson, until you pick another one.">
          <ActionButton action={deleteStepAction} fields={{ stepId, redirect: "unit" }} variant="danger" confirm={`Delete the lesson “${step.title}”?`} className="w-fit">
            <Trash2 className="size-4" aria-hidden /> Delete lesson
          </ActionButton>
        </Card>
      )}
    </div>
  );
}

export default function Page({ params }: PageProps<"/admin/cours/[courseId]/etapes/[stepId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <StepAdmin params={params} />
    </Suspense>
  );
}
