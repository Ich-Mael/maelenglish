import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowDown, ArrowUp, Eye, GraduationCap, Trash2, Trophy } from "lucide-react";
import { requireStaff, actorOf, allowed, courseFor } from "@/lib/admin/context";
import { can } from "@/lib/admin/permissions";
import { findProgram } from "@/lib/catalog";
import { Lesson, Module, User, type ModuleDoc } from "@/models";
import { Card, Checkbox, EmptyState, Input, PageHeader, Pill, ROLE_LABELS, btn } from "@/components/admin/ui";
import { ActionButton, AdminForm, Submit } from "@/components/admin/forms";
import { CourseFields } from "@/components/admin/course-fields";
import { createModuleAction, deleteCourseAction, deleteModuleAction, moveModuleAction, setInstructorsAction, updateCourseAction } from "../../actions";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Cours" };

async function CourseAdmin({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  await connection();
  const me = await requireStaff(`/admin/cours/${courseId}`);
  const course = await courseFor(me, courseId, "view");
  if (!course) notFound();
  const a = actorOf(me);
  const edit = allowed(me, course, "edit");
  const settings = can.manageCourseSettings(a);

  const [modules, lessonCounts, staff] = await Promise.all([
    Module.find({ courseId }).sort({ order: 1, createdAt: 1 }).lean<ModuleDoc[]>(),
    Lesson.aggregate<{ _id: unknown; n: number; drafts: number }>([
      { $match: { courseId: course._id } },
      { $group: { _id: "$moduleId", n: { $sum: 1 }, drafts: { $sum: { $cond: ["$isPublished", 0, 1] } } } },
    ]),
    settings ? User.find({ role: { $in: ["instructor", "english-coach", "admin", "super-admin"] }, isActive: { $ne: false } }).select("name surname role").sort({ name: 1 }).lean() : Promise.resolve([]),
  ]);
  const countOf = (id: unknown) => lessonCounts.find((r) => String(r._id) === String(id));
  const instructors = new Set((course.instructors ?? []).map(String));
  const unit = course.isChallenge ? "Jour" : "Module";

  return (
    <div className="grid max-w-5xl gap-5">
      <PageHeader
        title={course.title}
        back={{ href: "/admin/cours", label: "Cours" }}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {course.isPublished ? <Pill tone="green">Publié</Pill> : <Pill tone="amber">Brouillon</Pill>}
            {course.isChallenge && <Pill tone="red">Challenge</Pill>}
            {findProgram(course.program)?.name ?? "Sans programme"}
          </span>
        }
        actions={
          <>
            <Link href={`/apprendre/${courseId}`} className={btn.secondary} target="_blank">
              <Eye className="size-4" aria-hidden /> Aperçu
            </Link>
            {can.manageEnrollments(a) && (
              <Link href={`/admin/cours/${courseId}/inscriptions`} className={btn.secondary}>
                <GraduationCap className="size-4" aria-hidden /> Inscriptions
              </Link>
            )}
            {edit && (
              <Link href={`/admin/cours/${courseId}/final`} className={btn.secondary}>
                <Trophy className="size-4" aria-hidden /> Examen & projet final
              </Link>
            )}
          </>
        }
      />

      <Card title={course.isChallenge ? "Jours" : "Modules"} description={course.isChallenge ? "Chaque jour s'ouvre après validation du point de contrôle précédent." : "Les modules s'ouvrent dans l'ordre : leçons terminées et quiz réussi."}>
        {modules.length === 0 ? (
          <EmptyState>Aucun {unit.toLowerCase()} pour l&apos;instant.</EmptyState>
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
                      {c?.n ?? 0} leçon(s){c?.drafts ? ` dont ${c.drafts} brouillon(s)` : ""}
                      {m.quiz?.questions?.length ? <Pill tone="blue">Quiz · {m.quiz.questions.length} q.</Pill> : null}
                      {m.assignment?.instructions ? <Pill tone="amber">{course.isChallenge ? "Point de contrôle" : "Devoir"}</Pill> : null}
                    </span>
                  </Link>
                  {edit && (
                    <span className="flex items-center gap-1">
                      <ActionButton action={moveModuleAction} fields={{ moduleId: String(m._id), dir: "up" }} label="Monter">
                        <ArrowUp className="size-4" aria-hidden />
                      </ActionButton>
                      <ActionButton action={moveModuleAction} fields={{ moduleId: String(m._id), dir: "down" }} label="Descendre">
                        <ArrowDown className="size-4" aria-hidden />
                      </ActionButton>
                      <ActionButton action={deleteModuleAction} fields={{ moduleId: String(m._id) }} label="Supprimer" confirm={`Supprimer « ${m.title} » et toutes ses leçons ?`}>
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
              <Input label={`Nouveau ${unit.toLowerCase()}`} name="title" placeholder={course.isChallenge ? "Ex. Se présenter en réunion" : "Ex. Welcome on board"} required />
              <Input label="Objectif (facultatif)" name="summary" placeholder="Ce que l'apprenant saura faire" />
              <Submit>Ajouter</Submit>
            </div>
          </AdminForm>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {edit ? (
          <Card title="Informations">
            <AdminForm action={updateCourseAction}>
              <input type="hidden" name="courseId" value={courseId} />
              <CourseFields course={course} settings={settings} />
              <div>
                <Submit>Enregistrer</Submit>
              </div>
            </AdminForm>
          </Card>
        ) : (
          <Card title="Informations">
            <p className="text-sm whitespace-pre-line text-muted-foreground">{course.description || "Pas de description."}</p>
          </Card>
        )}

        <div className="grid content-start gap-5">
          {settings && (
            <Card title="Équipe pédagogique" description="Formateurs et coachs qui modifient le contenu et corrigent les devoirs de ce cours.">
              <AdminForm action={setInstructorsAction}>
                <input type="hidden" name="courseId" value={courseId} />
                {staff.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun formateur ni coach : créez un compte avec ce rôle.</p>
                ) : (
                  <div className="grid gap-2">
                    {staff.map((s) => (
                      <Checkbox key={String(s._id)} name="instructors" value={String(s._id)} label={`${s.name} ${s.surname}`} hint={ROLE_LABELS[s.role as string]} defaultChecked={instructors.has(String(s._id))} />
                    ))}
                  </div>
                )}
                <div>
                  <Submit variant="secondary">Enregistrer l&apos;équipe</Submit>
                </div>
              </AdminForm>
            </Card>
          )}
          {can.deleteCourse(a) && (
            <Card title="Supprimer le cours" description="Impossible tant que des apprenants sont inscrits (dépubliez-le plutôt).">
              <AdminForm action={deleteCourseAction}>
                <input type="hidden" name="courseId" value={courseId} />
                <div>
                  <Submit variant="danger" confirm="Supprimer définitivement ce cours et tout son contenu ?">
                    Supprimer
                  </Submit>
                </div>
              </AdminForm>
            </Card>
          )}
        </div>
      </div>
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
