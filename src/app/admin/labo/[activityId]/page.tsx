import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Types } from "mongoose";
import { ArrowLeft, Copy, ExternalLink, Eye, Trash2 } from "lucide-react";
import { actorOf, requireStaff } from "@/lib/admin/context";
import { can } from "@/lib/admin/permissions";
import { usagesOf } from "@/lib/lab/service";
import { ACTIVITY_INFO, type ActivityType, isActivityType } from "@/lib/lab/types";
import { Activity, Course, Module, Step, Unit, type ActivityDoc, type CourseDoc } from "@/models";
import { Card, Checkbox, EmptyState, Input, PageHeader, Pill, btn, inputCls } from "@/components/admin/ui";
import { ActionButton, AdminForm, Submit } from "@/components/admin/forms";
import { ActivityFields } from "@/components/lab/editors";
import { MetaFields } from "@/components/lab/meta-fields";
import { ACTIVITY_ICON } from "@/components/lab/type-icon";
import { PageSkeleton } from "@/components/learn/ui";
import { stepPath } from "@/lib/learn/paths";
import { attachActivityAction, deleteActivityAction, duplicateActivityAction, removeStepAction, saveActivityAction } from "../actions";

export const metadata: Metadata = { title: "Lab activity" };

async function ActivityAdmin({ params, searchParams }: { params: Promise<{ activityId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { activityId } = await params;
  const sp = await searchParams;
  await connection();
  const me = await requireStaff(`/admin/labo/${activityId}`);
  const a0 = actorOf(me);
  if (!can.useLab(a0)) redirect("/admin");
  if (!Types.ObjectId.isValid(activityId)) notFound();
  const activity = await Activity.findById(activityId).lean<ActivityDoc>();
  if (!activity) notFound();
  if (!isActivityType(activity.type)) notFound(); // old or removed type id
  const type: ActivityType = activity.type;
  const info = ACTIVITY_INFO[type];
  const Icon = ACTIVITY_ICON[type];

  // Units this staff member can add the activity to (courses whose content they edit).
  const scope = can.courseScope(a0);
  const courses = await Course.find(scope ?? {}).sort({ title: 1 }).select("title instructors").lean<CourseDoc[]>();
  const editable = courses.filter((c) => can.editContent(a0, c));
  const [usages, modules, units, challengeSteps] = await Promise.all([
    usagesOf(activityId),
    Module.find({ courseId: { $in: editable.map((c) => c._id) } }).sort({ order: 1, createdAt: 1 }).select("title courseId").lean(),
    Unit.find({ courseId: { $in: editable.map((c) => c._id) } }).sort({ order: 1, createdAt: 1 }).select("title moduleId courseId").lean(),
    Step.find({ kind: "challenge", courseId: { $in: editable.map((c) => c._id) } }).select("unitId").lean(),
  ]);
  const usedUnits = new Set(usages.map((u) => u.unitId));
  const withChallenge = new Set(challengeSteps.map((s) => String(s.unitId)));
  // Units it can still be added to, grouped by course (any course this staff member edits).
  const unitGroups = editable
    .map((c) => ({
      course: c.title,
      options: modules
        .filter((m) => m.courseId.equals(c._id))
        .flatMap((m) =>
          units
            .filter((u) => u.moduleId.equals(m._id))
            .map((u, i) => ({ u, n: i + 1 }))
            .filter(({ u }) => !usedUnits.has(String(u._id)))
            .map(({ u, n }) => ({
              value: String(u._id),
              label: `${m.title} › Unit ${n}: ${u.title}${info.role === "challenge" && withChallenge.has(String(u._id)) ? " (replaces its challenge)" : ""}`,
            })),
        ),
    }))
    .filter((g) => g.options.length > 0);
  const usedCourses = new Set(usages.map((u) => u.courseId)).size;
  const justAdded = typeof sp.unite === "string" ? usages.find((u) => u.unitId === sp.unite) : undefined;

  return (
    <div className="grid max-w-5xl gap-5">
      <PageHeader
        title={activity.title}
        back={{ href: "/admin/labo", label: "Lab" }}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Icon className="size-4 text-primary" aria-hidden /> {info.label}
            {activity.status === "ready" ? <Pill tone="green">Ready</Pill> : <Pill tone="amber">Draft</Pill>}
          </span>
        }
      />

      {justAdded && (
        <p className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-primary/20 bg-brand-soft p-4 text-sm text-brand-deep">
          <span className="flex-1">
            Added to the unit <strong>{justAdded.unitTitle}</strong> ({justAdded.courseTitle}). Write it, tick “Ready”, then save.
          </span>
          <Link href={`/admin/cours/${justAdded.courseId}/unites/${justAdded.unitId}`} className={btn.secondary}>
            <ArrowLeft className="size-4" aria-hidden /> Back to the unit
          </Link>
        </p>
      )}

      <Card title="Content" description={info.description}>
        <AdminForm action={saveActivityAction}>
          <input type="hidden" name="activityId" value={activityId} />
          <Input label="Title" name="title" defaultValue={activity.title} required />
          <ActivityFields type={type} content={activity.content} />
          <MetaFields a={activity} />
          <Input label="Tags (optional)" name="tags" defaultValue={(activity.tags ?? []).join(", ")} placeholder="E.g. aviation, welcome" hint="Comma-separated, for search." />
          <Checkbox name="ready" label="Ready" hint="Learners only see the activity once it's ready." defaultChecked={activity.status === "ready"} />
          <div>
            <Submit>Save</Submit>
          </div>
        </AdminForm>
      </Card>

      <Card
        title="Used in"
        description={`${usages.length ? `${usages.length} unit(s) in ${usedCourses} course(s). ` : ""}One activity can be used in any number of units, in any course: editing it changes it everywhere. For a variant, duplicate it.`}
      >
        {usages.length === 0 ? (
          <EmptyState>Not used yet.</EmptyState>
        ) : (
          <ul className="grid gap-2">
            {usages.map((u) => (
              <li key={u.stepId} className="flex flex-wrap items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm">
                <Link href={`/admin/cours/${u.courseId}/unites/${u.unitId}`} className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-brand-deep hover:underline">{u.unitTitle}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {u.courseTitle} › {u.moduleTitle} · {u.kind === "challenge" ? "end-of-unit challenge" : "activity step"}
                  </span>
                </Link>
                <a href={stepPath(u.courseId, u.stepId)} target="_blank" rel="noopener" className={btn.icon} aria-label="Learner preview" title="Learner preview">
                  <ExternalLink className="size-4" aria-hidden />
                </a>
                <ActionButton action={removeStepAction} fields={{ stepId: u.stepId }} label="Remove from unit" confirm={u.kind === "challenge" ? "Remove this challenge from the unit? Learners' recordings for it are deleted." : "Remove the activity from this unit? Learners' results on it are deleted."}>
                  <Trash2 className="size-4" aria-hidden />
                </ActionButton>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 rounded-xl bg-muted/40 p-4">
          {unitGroups.length > 0 ? (
            <AdminForm action={attachActivityAction}>
              <input type="hidden" name="activityId" value={activityId} />
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="grid content-start gap-1 text-sm">
                  <span className="font-medium">{info.role === "challenge" ? "Use as the challenge of a unit (any course)" : usages.length ? "Also use it in another unit (any course)" : "Add to a unit (any course)"}</span>
                  <select name="unitId" className={inputCls}>
                    {unitGroups.map((g) => (
                      <optgroup key={g.course} label={g.course}>
                        {g.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <Submit variant="secondary">Add</Submit>
              </div>
            </AdminForm>
          ) : (
            <p className="text-sm text-muted-foreground">
              {editable.length ? "Every unit you can edit already uses this activity." : "You don't edit any course yet."} To reuse it elsewhere, create a unit in another course (Courses › course › module › « New unit »), then add it from here or from the unit page (« Add an activity from the Lab »).
            </p>
          )}
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        {info.role === "practice" && (
          <Link href={`/admin/labo/${activityId}/apercu`} className={btn.primary}>
            <Eye className="size-4" aria-hidden /> Learner preview
          </Link>
        )}
        <AdminForm action={duplicateActivityAction}>
          <input type="hidden" name="activityId" value={activityId} />
          <Submit variant="secondary">
            <Copy className="size-4" aria-hidden /> Duplicate
          </Submit>
        </AdminForm>
        <AdminForm action={deleteActivityAction}>
          <input type="hidden" name="activityId" value={activityId} />
          <Submit variant="danger" confirm={`Delete “${activity.title}” from the Lab?`}>
            <Trash2 className="size-4" aria-hidden /> Delete
          </Submit>
        </AdminForm>
      </div>
    </div>
  );
}

export default function Page({ params, searchParams }: PageProps<"/admin/labo/[activityId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ActivityAdmin params={params} searchParams={searchParams} />
    </Suspense>
  );
}
