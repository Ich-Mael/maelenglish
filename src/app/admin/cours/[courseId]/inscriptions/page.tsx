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

export const metadata: Metadata = { title: "Inscriptions" };

const STATE: Record<string, { label: string; tone: "green" | "amber" | "red" | "grey" | "blue" }> = {
  active: { label: "Actif", tone: "green" },
  "not-started": { label: "À venir", tone: "blue" },
  expired: { label: "Expiré", tone: "grey" },
  suspended: { label: "Suspendu", tone: "red" },
  completed: { label: "Terminé", tone: "green" },
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
      <PageHeader title="Inscriptions" back={{ href: `/admin/cours/${courseId}`, label: course.title }} subtitle={`${rows.length} inscrit(s)`} />

      <Card title="Inscrire un apprenant" description="Le compte doit exister (créez-le d'abord dans Utilisateurs).">
        <AdminForm action={enrollAction} resetOnSuccess>
          <input type="hidden" name="courseId" value={courseId} />
          <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
            <LearnerPicker courseId={courseId} />
            <Input label="Début" name="startDate" type="date" defaultValue={isoDate(course.startDate) || isoDate(new Date())} />
            <Input label="Fin (facultatif)" name="endDate" type="date" defaultValue={isoDate(course.endDate)} />
          </div>
          <Checkbox name="notify" label="Prévenir l'apprenant" hint="Par WhatsApp (modèle d'inscription) si configuré, sinon par email." defaultChecked />
          <div>
            <Submit>Inscrire</Submit>
          </div>
        </AdminForm>
      </Card>

      <Card title="Inscrits">
        {rows.length === 0 ? (
          <EmptyState>Personne n&apos;est encore inscrit.</EmptyState>
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
                    {u.isActive === false && <Pill tone="red">Compte désactivé</Pill>}
                    <span className="ml-auto">
                      <ActionButton action={removeEnrollmentAction} fields={{ enrollmentId: String(e._id) }} label="Retirer l'inscription" confirm={`Retirer ${u.name} de ce cours ? Sa progression est conservée.`}>
                        <Trash2 className="size-4" aria-hidden />
                      </ActionButton>
                    </span>
                  </div>
                  <AdminForm action={updateEnrollmentAction} className="gap-2">
                    <input type="hidden" name="enrollmentId" value={String(e._id)} />
                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                      <label className="grid gap-1 text-xs">
                        Début
                        <input type="date" name="startDate" defaultValue={isoDate(e.startDate)} className={inputCls} />
                      </label>
                      <label className="grid gap-1 text-xs">
                        Fin
                        <input type="date" name="endDate" defaultValue={isoDate(e.endDate)} className={inputCls} />
                      </label>
                      <label className="grid gap-1 text-xs">
                        Statut
                        <select name="status" defaultValue={e.status} className={inputCls}>
                          <option value="active">Actif</option>
                          <option value="suspended">Suspendu</option>
                          <option value="completed">Terminé (lecture seule)</option>
                        </select>
                      </label>
                      <Submit variant="secondary">Mettre à jour</Submit>
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
