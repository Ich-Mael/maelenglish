import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowDown, ArrowUp, ExternalLink, Trash2 } from "lucide-react";
import { requireStaff, allowed, courseFor } from "@/lib/admin/context";
import { Lesson, Module, TeachingResource, Unit, RESOURCE_TYPES, type LessonDoc, type ModuleDoc, type UnitDoc } from "@/models";
import { Card, Checkbox, Input, PageHeader, Pill, Select } from "@/components/admin/ui";
import { ActionButton, AdminForm, Submit } from "@/components/admin/forms";
import { AssignmentFields } from "@/components/admin/assignment-fields";
import { QuizEditor, type EditableQuiz } from "@/components/admin/quiz-editor";
import { createUnitAction, deleteResourceAction, moveUnitAction, saveAssignmentAction, saveResourceAction, updateModuleAction } from "../../../../actions";
import { adoptOrphanLessons } from "@/lib/admin/content";
import { LESSON_TYPE } from "@/components/admin/lesson-types";
import { PageSkeleton } from "@/components/learn/ui";
import { RichText } from "@/components/learn/rich-text";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { toEditorHtml } from "@/lib/rich-text";

export const metadata: Metadata = { title: "Module" };

const RESOURCE_LABELS: Record<string, string> = {
  lesson_plan: "Plan de séance",
  activities: "Activités",
  answer_key: "Corrigé",
  slides: "Diaporama",
  worksheet: "Fiche d'exercices",
  rubric: "Grille d'évaluation",
  other: "Autre",
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
  await adoptOrphanLessons(moduleId); // lessons created before units existed go into the first unit
  const [units, lessons, resources] = await Promise.all([
    Unit.find({ moduleId }).sort({ order: 1, createdAt: 1 }).lean<UnitDoc[]>(),
    Lesson.find({ moduleId }).sort({ order: 1, createdAt: 1 }).lean<LessonDoc[]>(),
    TeachingResource.find({ moduleId }).sort({ createdAt: 1 }).lean(),
  ]);
  const quiz: EditableQuiz = {
    title: mod.quiz?.title ?? "",
    passingScore: mod.quiz?.passingScore ?? 70,
    timeLimit: mod.quiz?.timeLimit ?? 0,
    questions: (mod.quiz?.questions ?? []).map((q) => ({
      _id: String((q as unknown as { _id: unknown })._id),
      text: q.text,
      options: q.options.map((o) => ({ id: o.id, text: o.text })),
      correctOptionId: q.correctOptionId,
      explanation: q.explanation ?? "",
    })),
  };
  const checkpoint = course.isChallenge;

  return (
    <div className="grid max-w-5xl gap-5">
      <PageHeader title={mod.title} back={{ href: `/admin/cours/${courseId}`, label: course.title }} subtitle={checkpoint ? "Jour du challenge" : "Module"} />

      <Card title="Unités" description="Chaque unité regroupe des activités autour d'un objectif et se termine par un défi oral corrigé par un coach : l'unité suivante s'ouvre quand l'apprenant l'a envoyé. Ouvrez une unité pour gérer ses activités et son défi.">
        <ol className="grid gap-3">
          {units.map((u, i) => {
            const own = lessons.filter((l) => String(l.unitId) === String(u._id));
            const drafts = own.filter((l) => !l.isPublished).length;
            return (
              <li key={String(u._id)} className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-sm font-bold text-primary">{i + 1}</span>
                  <Link href={`/admin/cours/${courseId}/unites/${u._id}`} className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold text-brand-deep hover:underline">{u.title}</span>
                      {u.challenge?.instructions ? <Pill tone="blue">Défi oral</Pill> : <Pill tone="amber">Sans défi oral</Pill>}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {own.length} activité(s){drafts ? ` dont ${drafts} brouillon(s)` : ""}
                      {u.objective && ` · ${u.objective}`}
                    </span>
                  </Link>
                  {edit && units.length > 1 && (
                    <span className="flex items-center gap-1">
                      <ActionButton action={moveUnitAction} fields={{ unitId: String(u._id), dir: "up" }} label="Monter">
                        <ArrowUp className="size-4" aria-hidden />
                      </ActionButton>
                      <ActionButton action={moveUnitAction} fields={{ unitId: String(u._id), dir: "down" }} label="Descendre">
                        <ArrowDown className="size-4" aria-hidden />
                      </ActionButton>
                    </span>
                  )}
                </div>
                {own.length > 0 && (
                  <ul className="mt-2 ml-11 grid gap-1">
                    {own.map((l) => {
                      const T = LESSON_TYPE[l.type as keyof typeof LESSON_TYPE];
                      return (
                        <li key={String(l._id)}>
                          <Link href={`/admin/cours/${courseId}/lecons/${l._id}`} className="flex items-center gap-2 text-sm text-brand-deep hover:underline">
                            <T.icon className="size-4 shrink-0 text-primary" aria-hidden />
                            <span className="truncate">{l.title}</span>
                            {!l.isPublished && <Pill tone="amber">Brouillon</Pill>}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
        {edit && (
          <AdminForm action={createUnitAction} resetOnSuccess className="mt-5 rounded-xl bg-muted/40 p-4">
            <input type="hidden" name="moduleId" value={moduleId} />
            <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
              <Input label="Nouvelle unité" name="title" required placeholder="Ex. Accueillir les passagers" />
              <Input label="Objectif (facultatif)" name="objective" placeholder="Ce que l'apprenant saura faire" />
              <Submit>Ajouter</Submit>
            </div>
          </AdminForm>
        )}
      </Card>

      {edit && (
        <>
          <Card title="Quiz du module" description="Noté sur le serveur. Il s'ouvre quand toutes les activités sont terminées ; le réussir ouvre le module suivant. Sans question, pas de quiz.">
            <QuizEditor target={{ moduleId }} initial={quiz} />
          </Card>

          <Card title={checkpoint ? "Point de contrôle du jour" : "Devoir"} description={checkpoint ? "Validé par un coach : le jour suivant ne s'ouvre qu'après validation." : "Corrigé par un coach depuis « Corrections »."}>
            <AdminForm action={saveAssignmentAction}>
              <input type="hidden" name="moduleId" value={moduleId} />
              <AssignmentFields a={mod.assignment} withDueDate />
              <div>
                <Submit>Enregistrer</Submit>
              </div>
            </AdminForm>
          </Card>

          <Card title="Réglages du module">
            <AdminForm action={updateModuleAction}>
              <input type="hidden" name="moduleId" value={moduleId} />
              <Input label="Titre" name="title" defaultValue={mod.title} required />
              <Input label="Objectif" name="summary" defaultValue={mod.summary ?? ""} placeholder="Ce que l'apprenant saura faire" hint="Une phrase, affichée sous le titre du module." />
              <RichTextEditor label="Description" name="description" minHeight={200} defaultValue={toEditorHtml(mod.description, "text")} hint="Présentation du module, affichée aux apprenants sur la page du cours (facultatif)." />
              {checkpoint && <Checkbox name="isCheckpointRequired" label="Validation obligatoire du point de contrôle" hint="Décochez pour un jour « libre » (repos, révision)." defaultChecked={mod.isCheckpointRequired !== false} />}
              <div>
                <Submit variant="secondary">Enregistrer</Submit>
              </div>
            </AdminForm>
          </Card>
        </>
      )}

      <Card title="Ressources pédagogiques" description="Réservées à l'équipe : plans de séance, corrigés, diaporamas…">
        {resources.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune ressource.</p>
        ) : (
          <ul className="grid gap-2">
            {resources.map((r) => (
              <li key={String(r._id)} className="rounded-xl border border-border px-3 py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="flex-1 font-semibold text-brand-deep">{r.title}</span>
                  <Pill tone="blue">{RESOURCE_LABELS[r.resourceType] ?? r.resourceType}</Pill>
                  {r.link && (
                    <a href={r.link} target="_blank" rel="noopener" className="text-primary" aria-label="Ouvrir la ressource">
                      <ExternalLink className="size-4" aria-hidden />
                    </a>
                  )}
                  {edit && (
                    <ActionButton action={deleteResourceAction} fields={{ resourceId: String(r._id) }} label="Supprimer" confirm="Supprimer cette ressource ?">
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
              <Input label="Titre" name="title" required />
              <Select label="Type" name="resourceType" defaultValue="lesson_plan" options={RESOURCE_TYPES.map((t) => ({ value: t, label: RESOURCE_LABELS[t] }))} />
            </div>
            <Input label="Lien (Drive, YouTube…)" name="link" type="url" />
            <RichTextEditor label="Notes" name="notes" minHeight={160} />
            <div>
              <Submit variant="secondary">Ajouter la ressource</Submit>
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
