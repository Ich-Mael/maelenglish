import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowDown, ArrowUp, CircleCheck, EyeOff, ExternalLink, Trash2 } from "lucide-react";
import { requireStaff, allowed, courseFor } from "@/lib/admin/context";
import { Activity, Module, Step, TeachingResource, Unit, RESOURCE_TYPES, type ModuleDoc, type StepDoc, type UnitDoc } from "@/models";
import { checkUnit } from "@/lib/course/unit-check";
import { CEFR_LEVELS } from "@/lib/lab/meta";
import { Card, Input, PageHeader, Pill, Select, TextArea } from "@/components/admin/ui";
import { ActionButton, AdminForm, Submit } from "@/components/admin/forms";
import { createUnitAction, deleteResourceAction, moveUnitAction, saveResourceAction, updateModuleAction } from "../../../../actions";
import { PageSkeleton } from "@/components/learn/ui";
import { RichText } from "@/components/learn/rich-text";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { toEditorHtml } from "@/lib/rich-text";

export const metadata: Metadata = { title: "Module" };

const RESOURCE_LABELS: Record<string, string> = {
  lesson_plan: "Lesson plan",
  activities: "Activities",
  answer_key: "Answer key",
  slides: "Slides",
  worksheet: "Worksheet",
  rubric: "Rubric",
  other: "Other",
};

async function ModuleAdmin({ params }: { params: Promise<{ courseId: string; moduleId: string }> }) {
  const { courseId, moduleId } = await params;
  await connection();
  const me = await requireStaff(`/admin/cours/${courseId}/modules/${moduleId}`);
  const course = await courseFor(me, courseId, "view");
  if (!course) notFound();
  const mod = await Module.findOne({ _id: moduleId, courseId }).lean<ModuleDoc>().catch(() => null);
  if (!mod) notFound();
  const edit = allowed(me, course, "edit");
  const [units, steps, resources] = await Promise.all([
    Unit.find({ moduleId }).sort({ order: 1, createdAt: 1 }).lean<UnitDoc[]>(),
    Step.find({ moduleId }).sort({ position: 1 }).lean<StepDoc[]>(),
    TeachingResource.find({ moduleId }).sort({ createdAt: 1 }).lean(),
  ]);
  const activityIds = steps.flatMap((x) => (x.activityId ? [x.activityId] : []));
  const ready = new Set((activityIds.length ? await Activity.find({ _id: { $in: activityIds }, status: "ready" }).select("_id").lean() : []).map((a) => String(a._id)));
  const checkpoint = course.isChallenge;

  return (
    <div className="grid max-w-5xl gap-5">
      <PageHeader title={mod.title} back={{ href: `/admin/cours/${courseId}`, label: course.title }} subtitle={checkpoint ? "Challenge day" : "Module"} />

      <Card title="Units" description="A unit is one topic: a lesson, 2 to 5 activities practising it — repeated — and a speaking challenge last. A unit breaking these rules stays hidden from learners. Open a unit to build its steps.">
        <ol className="grid gap-3">
          {units.map((u, i) => {
            const own = steps.filter((x) => String(x.unitId) === String(u._id));
            const problems = checkUnit(own, ready);
            const drafts = own.filter((x) => x.kind === "activity" && !ready.has(String(x.activityId))).length;
            const count = (k: string) => own.filter((x) => x.kind === k).length;
            return (
              <li key={String(u._id)} className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-sm font-bold text-primary">{i + 1}</span>
                  <Link href={`/admin/cours/${courseId}/unites/${u._id}`} className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold text-brand-deep hover:underline">{u.title}</span>
                      {problems.length === 0 ? (
                        <Pill tone="green">
                          <CircleCheck className="mr-1 size-3" aria-hidden /> Visible to learners
                        </Pill>
                      ) : (
                        <Pill tone="amber">
                          <EyeOff className="mr-1 size-3" aria-hidden /> Hidden: {problems.length} problem(s)
                        </Pill>
                      )}
                      {drafts > 0 && <Pill tone="blue">{drafts} draft activit{drafts > 1 ? "ies" : "y"} skipped</Pill>}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {count("lesson")} lesson(s) · {count("activity")} activity(ies) · {count("challenge") ? "challenge" : "no challenge"}
                      {u.estimatedMinutes ? ` · ${u.estimatedMinutes} min` : ""}
                    </span>
                    {problems[0] && <span className="block truncate text-xs text-amber-800">{problems[0].message}</span>}
                  </Link>
                  {edit && units.length > 1 && (
                    <span className="flex items-center gap-1">
                      <ActionButton action={moveUnitAction} fields={{ unitId: String(u._id), dir: "up" }} label="Move up">
                        <ArrowUp className="size-4" aria-hidden />
                      </ActionButton>
                      <ActionButton action={moveUnitAction} fields={{ unitId: String(u._id), dir: "down" }} label="Move down">
                        <ArrowDown className="size-4" aria-hidden />
                      </ActionButton>
                    </span>
                  )}
                </div>
                {(u.objectives ?? []).length > 0 && (
                  <ul className="mt-2 ml-11 list-disc pl-4 text-sm text-muted-foreground">
                    {u.objectives.map((o, k) => (
                      <li key={k}>{o}</li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
        {edit && (
          <AdminForm action={createUnitAction} resetOnSuccess className="mt-5 rounded-xl bg-muted/40 p-4">
            <input type="hidden" name="moduleId" value={moduleId} />
            <Input label="New unit" name="title" required placeholder="E.g. Greetings & Self-Introduction" />
            <TextArea label="Objectives (optional)" name="objectives" rows={2} placeholder={"Saluer de façon formelle et informelle\nVous présenter, vous et votre métier"} hint="One per line, in French." />
            <div>
              <Submit>Add the unit</Submit>
            </div>
          </AdminForm>
        )}
      </Card>

      {edit && (
        <>
          <Card title="Module settings">
            <AdminForm action={updateModuleAction}>
              <input type="hidden" name="moduleId" value={moduleId} />
              <Input label="Title" name="title" defaultValue={mod.title} required />
              <Input label="Objective" name="summary" defaultValue={mod.summary ?? ""} placeholder="What the learner will be able to do" hint="One sentence, shown under the module title (in French, for learners)." />
              <RichTextEditor label="Description" name="description" minHeight={200} defaultValue={toEditorHtml(mod.description, "text")} hint="Module introduction, shown to learners on the course page (optional, in French)." />
              <Select label="Level (CEFR, optional)" name="level" defaultValue={mod.level ?? ""} options={[{ value: "", label: "—" }, ...CEFR_LEVELS.map((l) => ({ value: l, label: l }))]} className="sm:max-w-40" />
              <div>
                <Submit variant="secondary">Save</Submit>
              </div>
            </AdminForm>
          </Card>
        </>
      )}

      <Card title="Teaching resources" description="Staff only: lesson plans, answer keys, slides…">
        {resources.length === 0 ? (
          <p className="text-sm text-muted-foreground">No resources.</p>
        ) : (
          <ul className="grid gap-2">
            {resources.map((r) => (
              <li key={String(r._id)} className="rounded-xl border border-border px-3 py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="flex-1 font-semibold text-brand-deep">{r.title}</span>
                  <Pill tone="blue">{RESOURCE_LABELS[r.resourceType] ?? r.resourceType}</Pill>
                  {r.link && (
                    <a href={r.link} target="_blank" rel="noopener" className="text-primary" aria-label="Open resource">
                      <ExternalLink className="size-4" aria-hidden />
                    </a>
                  )}
                  {edit && (
                    <ActionButton action={deleteResourceAction} fields={{ resourceId: String(r._id) }} label="Delete" confirm="Delete this resource?">
                      <Trash2 className="size-4" aria-hidden />
                    </ActionButton>
                  )}
                </div>
                {r.content?.notes && <RichText legacy="text" className="mt-1 text-sm text-muted-foreground">{r.content.notes}</RichText>}
              </li>
            ))}
          </ul>
        )}
        {edit && (
          <AdminForm action={saveResourceAction} resetOnSuccess className="mt-4 rounded-xl bg-muted/40 p-4">
            <input type="hidden" name="moduleId" value={moduleId} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Title" name="title" required />
              <Select label="Type" name="resourceType" defaultValue="lesson_plan" options={RESOURCE_TYPES.map((t) => ({ value: t, label: RESOURCE_LABELS[t] }))} />
            </div>
            <Input label="Link (Drive, YouTube…)" name="link" type="url" />
            <RichTextEditor label="Notes" name="notes" minHeight={160} />
            <div>
              <Submit variant="secondary">Add resource</Submit>
            </div>
          </AdminForm>
        )}
      </Card>
    </div>
  );
}

export default function Page({ params }: PageProps<"/admin/cours/[courseId]/modules/[moduleId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ModuleAdmin params={params} />
    </Suspense>
  );
}
