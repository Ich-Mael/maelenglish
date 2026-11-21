import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Trash2 } from "lucide-react";
import { requireStaff, courseFor } from "@/lib/admin/context";
import { courseEnrollments } from "@/lib/admin/enrollments";
import { displayPhone } from "@/lib/phone";
import { accessState } from "@/models";
import { Card, Checkbox, EmptyState, Input, PageHeader, Pill, inputCls, isoDate } from "@/components/admin/ui";
import { ActionButton, AdminForm, Submit } from "@/components/admin/forms";
import { LearnerPicker } from "@/components/admin/learner-picker";
import { enrollAction, removeEnrollmentAction, updateEnrollmentAction } from "../../../actions";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Enrolments" };

const STATE: Record<string, { label: string; tone: "green" | "amber" | "red" | "grey" | "blue" }> = {
  active: { label: "Active", tone: "green" },
  "not-started": { label: "Not started", tone: "blue" },
  expired: { label: "Expired", tone: "grey" },
  suspended: { label: "Suspended", tone: "red" },
  completed: { label: "Completed", tone: "green" },
};

async function Enrollments({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  await connection();
  const me = await requireStaff(`/admin/cours/${courseId}/inscriptions`);
  const course = await courseFor(me, courseId, "enroll");
  if (!course) notFound();
  const rows = await courseEnrollments(courseId);

  return (
    <div className="grid max-w-5xl gap-5">
      <PageHeader title="Enrolments" back={{ href: `/admin/cours/${courseId}`, label: course.title }} subtitle={`${rows.length} enrolled`} />

      <Card title="Enrol a learner" description="The account must exist (create it first in Users).">
        <AdminForm action={enrollAction} resetOnSuccess>
          <input type="hidden" name="courseId" value={courseId} />
          <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
            <LearnerPicker courseId={courseId} />
            <Input label="Start" name="startDate" type="date" defaultValue={isoDate(course.startDate) || isoDate(new Date())} />
            <Input label="End (optional)" name="endDate" type="date" defaultValue={isoDate(course.endDate)} />
          </div>
          <Checkbox name="notify" label="Notify the learner" hint="By WhatsApp (enrolment template) if configured, otherwise by email. The message is in French." defaultChecked />
          <div>
            <Submit>Enrol</Submit>
          </div>
        </AdminForm>
      </Card>

      <Card title="Enrolled learners">
        {rows.length === 0 ? (
          <EmptyState>Nobody is enrolled yet.</EmptyState>
        ) : (
          <ul className="grid gap-3">
            {rows.map((e) => {
              const st = STATE[accessState(e)];
              const u = e.userId;
              return (
                <li key={String(e._id)} className="rounded-xl border border-border p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Link href={`/admin/utilisateurs/${u._id}`} className="font-semibold text-brand-deep hover:underline">
                      {u.name} {u.surname}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      @{u.username}
                      {u.phoneE164 ? ` · ${displayPhone(u.phoneE164)}` : ""}
                    </span>
                    <Pill tone={st.tone}>{st.label}</Pill>
                    {u.isActive === false && <Pill tone="red">Account deactivated</Pill>}
                    <span className="ml-auto">
                      <ActionButton action={removeEnrollmentAction} fields={{ enrollmentId: String(e._id) }} label="Remove enrolment" confirm={`Remove ${u.name} from this course? Their progress is kept.`}>
                        <Trash2 className="size-4" aria-hidden />
                      </ActionButton>
                    </span>
                  </div>
                  <AdminForm action={updateEnrollmentAction} className="gap-2">
                    <input type="hidden" name="enrollmentId" value={String(e._id)} />
                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                      <label className="grid gap-1 text-xs">
                        Start
                        <input type="date" name="startDate" defaultValue={isoDate(e.startDate)} className={inputCls} />
                      </label>
                      <label className="grid gap-1 text-xs">
                        End
                        <input type="date" name="endDate" defaultValue={isoDate(e.endDate)} className={inputCls} />
                      </label>
                      <label className="grid gap-1 text-xs">
                        Status
                        <select name="status" defaultValue={e.status} className={inputCls}>
                          <option value="active">Active</option>
                          <option value="suspended">Suspended</option>
                          <option value="completed">Completed (read-only)</option>
                        </select>
                      </label>
                      <Submit variant="secondary">Update</Submit>
                    </div>
                  </AdminForm>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default function Page({ params }: PageProps<"/admin/cours/[courseId]/inscriptions">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Enrollments params={params} />
    </Suspense>
  );
}
