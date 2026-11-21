import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { BookOpen, FlaskConical, Mic, Plus, Trash2 } from "lucide-react";
import { requireStaff, allowed, courseFor, actorOf } from "@/lib/admin/context";
import { can } from "@/lib/admin/permissions";
import { Activity, Module, Step, Unit, type ActivityDoc, type UnitDoc } from "@/models";
import { stepsOf } from "@/lib/admin/steps";
import { unitStepInputs } from "@/lib/course/unit-check";
import { ACTIVITY_INFO, ACTIVITY_TYPES, type ActivityType } from "@/lib/lab/types";
import { Card, Input, PageHeader, Select, TextArea } from "@/components/admin/ui";
import { AdminForm, Submit } from "@/components/admin/forms";
import { StepList, type StepRow } from "@/components/admin/step-list";
import { PageSkeleton } from "@/components/learn/ui";
import { addLessonAction, addStepActivityAction, deleteUnitAction, updateUnitAction } from "../../../../actions";
import { createActivityAction } from "../../../../labo/actions";

export const metadata: Metadata = { title: "Unit" };

async function UnitAdmin({ params }: { params: Promise<{ courseId: string; unitId: string }> }) {
  const { courseId, unitId } = await params;
  await connection();
  const me = await requireStaff(`/admin/cours/${courseId}/unites/${unitId}`);
  const course = await courseFor(me, courseId, "view");
  if (!course) notFound();
  const unit = await Unit.findOne({ _id: unitId, courseId }).lean<UnitDoc>().catch(() => null);
  if (!unit) notFound();
  const edit = allowed(me, course, "edit");
  const useLab = edit && can.useLab(actorOf(me));
  const [mod, siblings, steps] = await Promise.all([
    Module.findById(unit.moduleId).select("title").lean(),
    Unit.find({ moduleId: unit.moduleId }).sort({ order: 1, createdAt: 1 }).select("_id").lean(),
    stepsOf(unit._id),
  ]);
  const placed = steps.flatMap((s) => (s.activityId ? [s.activityId] : []));
  const [used, library] = await Promise.all([
    placed.length ? Activity.find({ _id: { $in: placed } }).select("type title status").lean<ActivityDoc[]>() : Promise.resolve([] as ActivityDoc[]),
    useLab ? Activity.find().sort({ updatedAt: -1 }).limit(300).select("type title status").lean<ActivityDoc[]>() : Promise.resolve([] as ActivityDoc[]),
  ]);
  // How many units already use each library activity (shown in the pickers: activities are shared across courses).
  const useCounts = new Map(
    library.length ? (await Step.aggregate<{ _id: unknown; n: number }>([{ $match: { activityId: { $in: library.map((a) => a._id) } } }, { $group: { _id: "$activityId", n: { $sum: 1 } } }])).map((r) => [String(r._id), r.n]) : [],
  );
  const usedElsewhere = (a: Pick<ActivityDoc, "_id">) => {
    const n = useCounts.get(String(a._id)) ?? 0;
    return n ? ` · used in ${n} unit(s)` : "";
  };
  const ready = new Set(used.filter((a) => a.status === "ready").map((a) => String(a._id)));
  const inputs = unitStepInputs(steps, ready);
  const rows: StepRow[] = steps.map((s, i) => {
    const a = used.find((x) => String(x._id) === String(s.activityId));
    return {
      ...inputs[i],
      href: s.kind === "lesson" ? `/admin/cours/${courseId}/etapes/${s._id}` : `/admin/labo/${s.activityId}`,
      typeLabel: s.kind === "lesson" ? "Lesson" : a ? ACTIVITY_INFO[a.type as ActivityType]?.label ?? a.type : "Missing Lab activity",
      passScore: s.passScore ?? 60,
      estimatedMinutes: s.estimatedMinutes ?? 0,
    };
  });

  const inUnit = new Set(placed.map(String));
  const status = (a: Pick<ActivityDoc, "status">) => (a.status === "ready" ? "" : " (draft)");
  const practiceChoices = library.filter((a) => ACTIVITY_INFO[a.type as ActivityType]?.role === "practice" && !inUnit.has(String(a._id)));
  const challenge = steps.find((s) => s.kind === "challenge");
  const challengeChoices = library.filter((a) => ACTIVITY_INFO[a.type as ActivityType]?.role === "challenge" && String(a._id) !== String(challenge?.activityId ?? ""));
  const lessons = steps.filter((s) => s.kind === "lesson");
  const practiceTypes = ACTIVITY_TYPES.filter((t) => ACTIVITY_INFO[t].role === "practice");
  const number = siblings.findIndex((s) => String(s._id) === unitId) + 1;

  return (
    <div className="grid max-w-5xl gap-5">
      <PageHeader
        title={unit.title}
        back={{ href: `/admin/cours/${courseId}/modules/${unit.moduleId}`, label: mod?.title ?? "Module" }}
        subtitle={`Unit ${number}${unit.estimatedMinutes ? ` · ${unit.estimatedMinutes} min` : ""}`}
      />

      <Card title="Steps" description="Rhythm of every unit: a lesson, then 2 or 3 activities practising it — repeated — and the speaking challenge last.">
        {/* Remount when the server data changes (after an add / delete / save). */}
        <StepList key={steps.map((s) => `${s._id}:${s.position}:${s.lessonId ?? ""}:${s.title}`).join("|")} unitId={unitId} steps={rows} edit={edit} />

        {edit && (
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <AdminForm action={addLessonAction} className="rounded-xl bg-muted/40 p-4">
              <input type="hidden" name="unitId" value={unitId} />
              <p className="flex items-center gap-2 text-sm font-semibold text-brand-deep">
                <BookOpen className="size-4 text-primary" aria-hidden /> Add a lesson
              </p>
              <Input label="Title" name="title" required placeholder="E.g. How to greet people at work" />
              <div>
                <Submit>
                  <Plus className="size-4" aria-hidden /> Create the lesson
                </Submit>
              </div>
            </AdminForm>

            {useLab && (
              <div className="rounded-xl border border-dashed border-primary/40 bg-brand-soft/40 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-brand-deep">
                  <FlaskConical className="size-4 text-primary" aria-hidden /> Add an activity from the Lab
                </p>
                {practiceChoices.length > 0 && lessons.length > 0 ? (
                  <AdminForm action={addStepActivityAction} className="mt-2">
                    <input type="hidden" name="unitId" value={unitId} />
                    <Select label="Activity" name="activityId" options={practiceChoices.map((a) => ({ value: String(a._id), label: `${ACTIVITY_INFO[a.type as ActivityType].label} · ${a.title}${status(a)}${usedElsewhere(a)}` }))} />
                    <Select label="Practises the lesson" name="lessonId" defaultValue={String(lessons.at(-1)!._id)} options={lessons.map((l) => ({ value: String(l._id), label: l.title }))} />
                    <div>
                      <Submit variant="secondary">Add before the challenge</Submit>
                    </div>
                  </AdminForm>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {!lessons.length ? "Add a lesson first: every activity practises a lesson." : practiceTypes.length ? "No other activity in the Lab." : "Exercise types are arriving in the Lab one by one."}{" "}
                    <Link href="/admin/labo" className="font-semibold text-primary underline">
                      Open the Lab
                    </Link>
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {useLab && (
        <Card
          title="Speaking challenge"
          description="Always the last step: the learner records an answer, a coach gives feedback in Grading. Sending it completes the unit and opens the next one. Designed in the Lab (instructions, timers, checklist, model answer)."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminForm action={createActivityAction} className="rounded-xl bg-muted/40 p-4">
              <input type="hidden" name="type" value="speaking_challenge" />
              <input type="hidden" name="unitId" value={unitId} />
              <Input label={challenge ? "Replace with a new challenge" : "Create the challenge"} name="title" required placeholder="E.g. Introduce yourself in 60 seconds" />
              <div>
                <Submit>
                  <Mic className="size-4" aria-hidden /> Create in the Lab
                </Submit>
              </div>
            </AdminForm>
            {challengeChoices.length > 0 && (
              <AdminForm action={addStepActivityAction} className="rounded-xl bg-muted/40 p-4">
                <input type="hidden" name="unitId" value={unitId} />
                <Select label="Or pick one from the Lab" name="activityId" options={challengeChoices.map((a) => ({ value: String(a._id), label: `${a.title}${status(a)}${usedElsewhere(a)}` }))} />
                <div>
                  <Submit variant="secondary">{challenge ? "Replace the challenge" : "Use this challenge"}</Submit>
                </div>
              </AdminForm>
            )}
          </div>
        </Card>
      )}

      {edit && (
        <Card title="Unit settings">
          <AdminForm action={updateUnitAction}>
            <input type="hidden" name="unitId" value={unitId} />
            <Input label="Title" name="title" defaultValue={unit.title} required />
            <TextArea
              label="Objectives"
              name="objectives"
              rows={3}
              defaultValue={(unit.objectives ?? []).join("\n")}
              placeholder={"Saluer de façon formelle et informelle\nVous présenter, vous et votre métier"}
              hint="One per line, in French (shown to learners under the unit title)."
            />
            <Input label="Estimated minutes" name="estimatedMinutes" type="number" min={0} defaultValue={unit.estimatedMinutes || ""} className="sm:max-w-40" />
            <div>
              <Submit variant="secondary">Save</Submit>
            </div>
          </AdminForm>
        </Card>
      )}

      {edit && siblings.length > 1 && (
        <Card title="Delete unit" description="Its steps and the learners' progress on them are deleted too. Lab activities stay in the Lab.">
          <AdminForm action={deleteUnitAction}>
            <input type="hidden" name="unitId" value={unitId} />
            <div>
              <Submit variant="danger" confirm={`Delete the unit “${unit.title}” and its ${steps.length} step(s)?`}>
                <Trash2 className="size-4" aria-hidden /> Delete unit
              </Submit>
            </div>
          </AdminForm>
        </Card>
      )}
    </div>
  );
}

export default function Page({ params }: PageProps<"/admin/cours/[courseId]/unites/[unitId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <UnitAdmin params={params} />
    </Suspense>
  );
}
