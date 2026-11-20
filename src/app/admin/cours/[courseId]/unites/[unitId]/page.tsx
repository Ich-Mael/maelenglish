import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { requireStaff, allowed, courseFor } from "@/lib/admin/context";
import { Lesson, Module, Unit, type LessonDoc, type UnitDoc } from "@/models";
import { Card, EmptyState, Input, PageHeader, Pill, Select } from "@/components/admin/ui";
import { ActionButton, AdminForm, Submit } from "@/components/admin/forms";
import { LESSON_TYPE } from "@/components/admin/lesson-types";
import { PageSkeleton } from "@/components/learn/ui";
import { RichText } from "@/components/learn/rich-text";
import { createLessonAction, deleteLessonAction, deleteUnitAction, moveLessonAction, saveUnitChallengeAction, updateUnitAction } from "../../../../actions";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { toEditorHtml } from "@/lib/rich-text";

export const metadata: Metadata = { title: "Unité" };

async function UnitAdmin({ params }: { params: Promise<{ courseId: string; unitId: string }> }) {
  const { courseId, unitId } = await params;
  await connection();
  const me = await requireStaff(`/admin/cours/${courseId}/unites/${unitId}`);
  const course = await courseFor(me, courseId, "view");
  if (!course) notFound();
  const unit = await Unit.findOne({ _id: unitId, courseId }).lean<UnitDoc>().catch(() => null);
  if (!unit) notFound();
  const edit = allowed(me, course, "edit");
  const [mod, siblings, lessons] = await Promise.all([
    Module.findById(unit.moduleId).select("title").lean(),
    Unit.find({ moduleId: unit.moduleId }).sort({ order: 1, createdAt: 1 }).select("_id").lean(),
    Lesson.find({ unitId }).sort({ order: 1, createdAt: 1 }).lean<LessonDoc[]>(),
  ]);
  const number = siblings.findIndex((s) => String(s._id) === unitId) + 1;

  return (
    <div className="grid max-w-5xl gap-5">
      <PageHeader title={unit.title} back={{ href: `/admin/cours/${courseId}/modules/${unit.moduleId}`, label: mod?.title ?? "Module" }} subtitle={`Unité ${number}${unit.objective ? ` · ${unit.objective}` : ""}`} />

      <Card title="Activités" description="Les nouvelles activités sont en brouillon : publiez-les depuis leur page.">
        {lessons.length === 0 ? (
          <EmptyState>Aucune activité dans cette unité.</EmptyState>
        ) : (
          <ol className="grid gap-2">
            {lessons.map((l) => {
              const T = LESSON_TYPE[l.type as keyof typeof LESSON_TYPE];
              return (
                <li key={String(l._id)} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                  <T.icon className="size-5 shrink-0 text-primary" aria-hidden />
                  <Link href={`/admin/cours/${courseId}/lecons/${l._id}`} className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-brand-deep hover:underline">{l.title}</span>
                    <span className="flex gap-1.5 text-xs text-muted-foreground">
                      {T.label}
                      {l.type === "practice" && ` · ${l.exercises?.length ?? 0} exercice(s)`}
                      {!l.isPublished && <Pill tone="amber">Brouillon</Pill>}
                    </span>
                  </Link>
                  {edit && (
                    <span className="flex items-center gap-1">
                      <ActionButton action={moveLessonAction} fields={{ lessonId: String(l._id), dir: "up" }} label="Monter">
                        <ArrowUp className="size-4" aria-hidden />
                      </ActionButton>
                      <ActionButton action={moveLessonAction} fields={{ lessonId: String(l._id), dir: "down" }} label="Descendre">
                        <ArrowDown className="size-4" aria-hidden />
                      </ActionButton>
                      <ActionButton action={deleteLessonAction} fields={{ lessonId: String(l._id) }} label="Supprimer" confirm={`Supprimer l'activité « ${l.title} » ?`}>
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
          <AdminForm action={createLessonAction} className="mt-5 rounded-xl bg-muted/40 p-4">
            <input type="hidden" name="unitId" value={unitId} />
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <Input label="Nouvelle activité" name="title" required placeholder="Ex. Les annonces à bord" />
              <Select label="Type" name="type" defaultValue="practice" options={Object.entries(LESSON_TYPE).map(([value, t]) => ({ value, label: t.label }))} />
              <Submit>Créer</Submit>
            </div>
          </AdminForm>
        )}
      </Card>

      <Card
        title="Défi oral de fin d'unité"
        description="L'apprenant s'enregistre (consigne ci-dessous), puis un coach lui fait un retour dans « Corrections ». L'envoi termine l'unité et ouvre la suite du parcours. Sans consigne, pas de défi."
      >
        {edit ? (
          <AdminForm action={saveUnitChallengeAction}>
            <input type="hidden" name="unitId" value={unitId} />
            <Input label="Titre (facultatif)" name="title" defaultValue={unit.challenge?.title ?? ""} placeholder="Ex. Accueillez vos passagers" />
            <RichTextEditor
              label="Consigne"
              name="instructions"
              minHeight={180}
              defaultValue={toEditorHtml(unit.challenge?.instructions, "text")}
              hint="Ce que l'apprenant doit dire, en réutilisant le vocabulaire de l'unité. Ex. « Présentez-vous et accueillez les passagers à bord en 45 secondes. »"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="Durée maximale"
                name="maxSeconds"
                defaultValue={String(unit.challenge?.maxSeconds ?? 60)}
                options={[
                  ["30", "30 secondes"],
                  ["45", "45 secondes"],
                  ["60", "1 minute"],
                  ["90", "1 min 30"],
                  ["120", "2 minutes"],
                  ["180", "3 minutes"],
                ].map(([value, label]) => ({ value, label }))}
              />
              <Select
                label="Temps de préparation"
                name="prepSeconds"
                defaultValue={String(unit.challenge?.prepSeconds ?? 0)}
                options={[0, 10, 15, 30, 60].map((n) => ({ value: String(n), label: n ? `${n} secondes` : "Aucun" }))}
              />
            </div>
            <div>
              <Submit>Enregistrer le défi</Submit>
            </div>
          </AdminForm>
        ) : unit.challenge?.instructions ? (
          <RichText>{unit.challenge.instructions}</RichText>
        ) : (
          <EmptyState>Pas de défi oral.</EmptyState>
        )}
      </Card>

      {edit && (
        <Card title="Réglages de l'unité">
          <AdminForm action={updateUnitAction}>
            <input type="hidden" name="unitId" value={unitId} />
            <Input label="Titre" name="title" defaultValue={unit.title} required />
            <Input label="Objectif" name="objective" defaultValue={unit.objective ?? ""} placeholder="Ce que l'apprenant saura faire" hint="Une phrase, affichée sous le titre de l'unité sur le parcours." />
            <div>
              <Submit variant="secondary">Enregistrer</Submit>
            </div>
          </AdminForm>
        </Card>
      )}

      {edit && siblings.length > 1 && (
        <Card title="Supprimer l'unité" description="Ses activités et la progression des apprenants sur ces activités sont supprimées aussi.">
          <AdminForm action={deleteUnitAction}>
            <input type="hidden" name="unitId" value={unitId} />
            <div>
              <Submit variant="danger" confirm={`Supprimer l'unité « ${unit.title} » et ses ${lessons.length} activité(s) ?`}>
                <Trash2 className="size-4" aria-hidden /> Supprimer l&apos;unité
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
