import type { Metadata } from "next";
import { RichText } from "@/components/learn/rich-text";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowDown, ArrowUp, Eye, GraduationCap, Trash2, Trophy } from "lucide-react";
import { requireStaff, actorOf, allowed, courseFor } from "@/lib/admin/context";
import { can } from "@/lib/admin/permissions";
import { findProgram } from "@/lib/catalog";
import { Module, Step, Unit, User, type ModuleDoc } from "@/models";
import { Card, Checkbox, EmptyState, Input, PageHeader, Pill, ROLE_LABELS, btn } from "@/components/admin/ui";
import { ActionButton, AdminForm, Submit } from "@/components/admin/forms";
import { CourseFields } from "@/components/admin/course-fields";
import { createModuleAction, deleteCourseAction, deleteModuleAction, moveModuleAction, setInstructorsAction, updateCourseAction } from "../../actions";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Courses" };

async function CourseAdmin({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  await connection();
  const me = await requireStaff(`/admin/cours/${courseId}`);
  const course = await courseFor(me, courseId, "view");
  if (!course) notFound();
  const a = actorOf(me);
  const edit = allowed(me, course, "edit");
  const settings = can.manageCourseSettings(a);

  const [modules, stepCounts, unitCounts, staff] = await Promise.all([
    Module.find({ courseId }).sort({ order: 1, createdAt: 1 }).lean<ModuleDoc[]>(),
    Step.aggregate<{ _id: unknown; n: number }>([{ $match: { courseId: course._id } }, { $group: { _id: "$moduleId", n: { $sum: 1 } } }]),
    Unit.aggregate<{ _id: unknown; n: number }>([{ $match: { courseId: course._id } }, { $group: { _id: "$moduleId", n: { $sum: 1 } } }]),
    settings ? User.find({ role: { $in: ["instructor", "english-coach", "admin", "super-admin"] }, isActive: { $ne: false } }).select("name surname role").sort({ name: 1 }).lean() : Promise.resolve([]),
  ]);
  const countOf = (id: unknown) => stepCounts.find((r) => String(r._id) === String(id));
  const instructors = new Set((course.instructors ?? []).map(String));
  const unit = course.isChallenge ? "Day" : "Module";

  return (
    <div className="grid max-w-6xl gap-5">
      <PageHeader
        title={course.title}
        back={{ href: "/admin/cours", label: "Courses" }}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {course.isPublished ? <Pill tone="green">Published</Pill> : <Pill tone="amber">Draft</Pill>}
            {course.isChallenge && <Pill tone="red">Challenge</Pill>}
            {findProgram(course.program)?.name ?? "No programme"}
          </span>
        }
        actions={
          <>
            <Link href={`/apprendre/${courseId}`} className={btn.secondary} target="_blank">
              <Eye className="size-4" aria-hidden /> Preview
            </Link>
            {can.manageEnrollments(a) && (
              <Link href={`/admin/cours/${courseId}/inscriptions`} className={btn.secondary}>
                <GraduationCap className="size-4" aria-hidden /> Enrolments
              </Link>
            )}
            {edit && (
              <Link href={`/admin/cours/${courseId}/final`} className={btn.secondary}>
                <Trophy className="size-4" aria-hidden /> Final exam
              </Link>
            )}
          </>
        }
      />

      {settings && (
        <Card title="Teaching team" description="Instructors and coaches who edit the content and grade submissions for this course.">
          <AdminForm action={setInstructorsAction}>
            <input type="hidden" name="courseId" value={courseId} />
            {staff.length === 0 ? (
              <p className="text-sm text-muted-foreground">No instructors or coaches yet: create an account with that role.</p>
            ) : (
              <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                {staff.map((s) => (
                  <Checkbox key={String(s._id)} name="instructors" value={String(s._id)} label={`${s.name} ${s.surname}`} hint={ROLE_LABELS[s.role as string]} defaultChecked={instructors.has(String(s._id))} />
                ))}
              </div>
            )}
            <div>
              <Submit variant="secondary">Save team</Submit>
            </div>
          </AdminForm>
        </Card>
      )}
      <Card title={course.isChallenge ? "Days" : "Modules"} description={course.isChallenge ? "Each day opens on its date, once a coach has validated the previous day's last speaking challenge." : "Modules open in order: a module is complete when every unit's speaking challenge is sent."}>
        {modules.length === 0 ? (
          <EmptyState>No {unit.toLowerCase()}s yet.</EmptyState>
        ) : (
          <ol className="grid gap-2">
            {modules.map((m, i) => {
              const c = countOf(m._id);
              return (
                <li key={String(m._id)} className="flex flex-wrap items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-sm font-bold text-primary">{i + 1}</span>
                  <Link href={`/admin/cours/${courseId}/modules/${m._id}`} className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-brand-deep hover:underline">{m.title}</span>
                    <span className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                      {unitCounts.find((r) => String(r._id) === String(m._id))?.n ?? 1} unit(s) · {c?.n ?? 0} step(s)
                      {m.level ? <Pill tone="blue">{m.level}</Pill> : null}
                    </span>
                  </Link>
                  {edit && (
                    <span className="flex items-center gap-1">
                      <ActionButton action={moveModuleAction} fields={{ moduleId: String(m._id), dir: "up" }} label="Move up">
                        <ArrowUp className="size-4" aria-hidden />
                      </ActionButton>
                      <ActionButton action={moveModuleAction} fields={{ moduleId: String(m._id), dir: "down" }} label="Move down">
                        <ArrowDown className="size-4" aria-hidden />
                      </ActionButton>
                      <ActionButton action={deleteModuleAction} fields={{ moduleId: String(m._id) }} label="Delete" confirm={`Delete “${m.title}”, its units and all their steps?`}>
                        <Trash2 className="size-4" aria-hidden />
                      </ActionButton>
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {edit && (
          <AdminForm action={createModuleAction} resetOnSuccess className="mt-5 rounded-xl bg-muted/40 p-4">
            <input type="hidden" name="courseId" value={courseId} />
            <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
              <Input label={`New ${unit.toLowerCase()}`} name="title" placeholder={course.isChallenge ? "E.g. Se présenter en réunion" : "E.g. Welcome on board"} required />
              <Input label="Objective (optional)" name="summary" placeholder="What the learner will be able to do" />
              <Submit>Add</Submit>
            </div>
          </AdminForm>
        )}
      </Card>

      {edit ? (
        <Card title="Details">
          <AdminForm action={updateCourseAction}>
            <input type="hidden" name="courseId" value={courseId} />
            <CourseFields course={course} settings={settings} wide />
            <div>
              <Submit>Save</Submit>
            </div>
          </AdminForm>
        </Card>
      ) : (
        <Card title="Details">
          {course.description ? (
            <RichText legacy="text" className="text-sm text-muted-foreground [&_*]:text-[length:inherit]">{course.description}</RichText>
          ) : (
            <p className="text-sm text-muted-foreground">No description.</p>
          )}
        </Card>
      )}

      {can.deleteCourse(a) && (
        <Card title="Delete course" description="Not possible while learners are enrolled (unpublish it instead).">
          <AdminForm action={deleteCourseAction}>
            <input type="hidden" name="courseId" value={courseId} />
            <div>
              <Submit variant="danger" confirm="Permanently delete this course and all its content?">
                Delete
              </Submit>
            </div>
          </AdminForm>
        </Card>
      )}
    </div>
  );
}

export default function Page({ params }: PageProps<"/admin/cours/[courseId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CourseAdmin params={params} />
    </Suspense>
  );
}
