import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowDown, ArrowUp, ExternalLink, FileText, PlayCircle, Sparkles, Trash2, Type } from "lucide-react";
import { requireStaff, allowed, courseFor } from "@/lib/admin/context";
import { Lesson, Module, TeachingResource, RESOURCE_TYPES, type LessonDoc, type ModuleDoc } from "@/models";
import { Card, Checkbox, EmptyState, Input, PageHeader, Pill, Select, TextArea } from "@/components/admin/ui";
import { ActionButton, AdminForm, Submit } from "@/components/admin/forms";
import { AssignmentFields } from "@/components/admin/assignment-fields";
import { QuizEditor, type EditableQuiz } from "@/components/admin/quiz-editor";
import { createLessonAction, deleteLessonAction, deleteResourceAction, moveLessonAction, saveAssignmentAction, saveResourceAction, updateModuleAction } from "../../../../actions";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Module" };

const TYPE = {
  video: { label: "Vidéo", icon: PlayCircle },
  text: { label: "Texte", icon: Type },
  pdf: { label: "PDF", icon: FileText },
  practice: { label: "Pratique", icon: Sparkles },
} as const;

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
  const [lessons, resources] = await Promise.all([
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

      <Card title="Leçons" description="Les nouvelles leçons sont en brouillon : publiez-les depuis leur page.">
        {lessons.length === 0 ? (
          <EmptyState>Aucune leçon.</EmptyState>
        ) : (
          <ol className="grid gap-2">
            {lessons.map((l) => {
              const T = TYPE[l.type as keyof typeof TYPE];
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
                      <ActionButton action={deleteLessonAction} fields={{ lessonId: String(l._id) }} label="Supprimer" confirm={`Supprimer la leçon « ${l.title} » ?`}>
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
            <input type="hidden" name="moduleId" value={moduleId} />
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <Input label="Nouvelle leçon" name="title" required placeholder="Ex. Les annonces à bord" />
              <Select label="Type" name="type" defaultValue="practice" options={Object.entries(TYPE).map(([value, t]) => ({ value, label: t.label }))} />
              <Submit>Créer</Submit>
            </div>
          </AdminForm>
        )}
      </Card>

      {edit && (
        <>
          <Card title="Quiz du module" description="Noté sur le serveur. Il s'ouvre quand toutes les leçons sont terminées ; le réussir ouvre le module suivant. Sans question, pas de quiz.">
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
              <TextArea label="Objectif" name="summary" rows={2} defaultValue={mod.summary ?? ""} />
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
                {r.content?.notes && <p className="mt-1 whitespace-pre-line text-muted-foreground">{r.content.notes}</p>}
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
            <TextArea label="Notes" name="notes" rows={3} />
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
