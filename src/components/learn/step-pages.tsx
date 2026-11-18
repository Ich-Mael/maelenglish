import Link from "next/link";
import { connection } from "next/server";
import { CalendarClock, ChevronLeft, CircleCheck, Clock, Eye, Lock, RotateCcw } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { courseAccess, courseTree } from "@/lib/learn/queries";
import { assignmentPath, coursePath, examPath, projectPath, quizPath } from "@/lib/learn/paths";
import { stepAfter } from "@/lib/learn/sequence";
import { AssignmentSubmission } from "@/models";
import { AccessProblem, formatDate } from "./ui";
import { RichText } from "./rich-text";
import { QuizRunner, type PublicQuestion } from "./quiz-runner";
import { AssignmentForm } from "./assignment-form";

function Locked({ courseId, text }: { courseId: string; text: string }) {
  return (
    <div className="mx-auto max-w-md rounded-3xl border-2 border-border bg-card p-8 text-center">
      <Lock className="mx-auto size-12 text-muted-foreground" aria-hidden />
      <h1 className="mt-4 text-2xl font-extrabold text-brand-deep">Pas encore ouvert</h1>
      <p className="mt-2 text-muted-foreground">{text}</p>
      <Link href={coursePath(courseId)} className="mt-6 inline-flex h-11 items-center rounded-2xl bg-primary px-5 font-semibold text-white">
        Retour au parcours
      </Link>
    </div>
  );
}

/** Module quiz (`moduleId`) or final exam (`moduleId` null). */
export async function QuizStep({ courseId, moduleId }: { courseId: string; moduleId: string | null }) {
  await connection();
  const here = moduleId ? quizPath(courseId, moduleId) : examPath(courseId);
  const me = await requireUser(here);
  const access = await courseAccess(me, courseId);
  if (!access.ok) return <AccessProblem reason={access.reason} startDate={access.enrollment?.startDate} />;
  const { modules, outline } = await courseTree(me, access);

  const mod = moduleId ? modules.find((m) => String(m._id) === moduleId) : null;
  const quiz = moduleId ? mod?.quiz : access.course.finalExam;
  const step = moduleId ? outline.modules.find((m) => m.id === moduleId)?.quiz : outline.finalExam;
  if (!quiz?.questions?.length || !step) return <AccessProblem reason="not-found" />;
  if (step.state === "locked") {
    return <Locked courseId={courseId} text={moduleId ? "Terminez toutes les leçons du module pour ouvrir le quiz." : "L'examen final s'ouvre quand tous les modules sont terminés."} />;
  }

  // Never send the answers to the browser.
  const questions: PublicQuestion[] = quiz.questions.map((q) => ({
    id: String((q as unknown as { _id: unknown })._id),
    text: q.text,
    options: q.options.map((o) => ({ id: o.id, text: o.text })),
  }));
  return (
    <QuizRunner
      courseId={courseId}
      moduleId={moduleId}
      title={quiz.title || (moduleId ? `Quiz : ${mod?.title}` : "Examen final")}
      questions={questions}
      passingScore={quiz.passingScore ?? 70}
      timeLimit={quiz.timeLimit ?? 0}
      bestScore={step.bestScore}
      courseHref={coursePath(courseId)}
      nextHref={stepAfter(courseId, outline, here)}
      readOnly={access.readOnly}
    />
  );
}

/** Module assignment / challenge checkpoint (`moduleId`) or final project (`moduleId` null). */
export async function AssignmentStep({ courseId, moduleId }: { courseId: string; moduleId: string | null }) {
  await connection();
  const here = moduleId ? assignmentPath(courseId, moduleId) : projectPath(courseId);
  const me = await requireUser(here);
  const access = await courseAccess(me, courseId);
  if (!access.ok) return <AccessProblem reason={access.reason} startDate={access.enrollment?.startDate} />;
  const { modules, outline } = await courseTree(me, access);

  const mod = moduleId ? modules.find((m) => String(m._id) === moduleId) : null;
  const def = moduleId ? mod?.assignment : access.course.finalProject;
  const step = moduleId ? outline.modules.find((m) => m.id === moduleId)?.assignment : outline.finalProject;
  if (!def?.instructions?.trim() || !step) return <AccessProblem reason="not-found" />;
  if (step.state === "locked") {
    return <Locked courseId={courseId} text={moduleId ? "Ce devoir s'ouvre avec son module." : "Le projet final s'ouvre quand tous les modules sont terminés."} />;
  }

  const submission = await AssignmentSubmission.findOne({
    userId: me.id,
    courseId,
    moduleId: moduleId ?? null,
    assignmentType: moduleId ? "module_assignment" : "final_project",
  }).lean();
  const isCheckpoint = !!access.course.isChallenge && !!moduleId;
  const label = isCheckpoint ? "Point de contrôle" : moduleId ? "Devoir" : "Projet final";
  const dueDate = moduleId ? (def as { dueDate?: Date | null }).dueDate : null;

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      {access.preview && (
        <p className="flex items-center gap-2 rounded-2xl bg-xp/15 px-4 py-2.5 text-sm font-semibold text-[#7a4d00]">
          <Eye className="size-4" aria-hidden /> Aperçu équipe : la réponse n&apos;est pas enregistrée.
        </p>
      )}
      <header>
        <Link href={coursePath(courseId)} className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-primary">
          <ChevronLeft className="size-4" aria-hidden /> {mod?.title ?? "Parcours"}
        </Link>
        <p className="mt-2 text-sm font-bold tracking-wide text-coral-dark uppercase">{label}</p>
        <h1 className="text-3xl font-extrabold text-brand-deep">{def.title || label}</h1>
        {dueDate && (
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarClock className="size-4" aria-hidden /> À rendre avant le {formatDate(dueDate)}
          </p>
        )}
      </header>

      <section className="rounded-3xl border-2 border-border bg-card p-5 sm:p-8">
        <RichText>{def.instructions}</RichText>
      </section>

      {submission && (
        <section
          className={
            submission.status === "graded"
              ? "rounded-3xl border-2 border-success/30 bg-success/10 p-5"
              : submission.status === "returned"
                ? "rounded-3xl border-2 border-coral/30 bg-coral-soft p-5"
                : "rounded-3xl border-2 border-primary/20 bg-brand-soft p-5"
          }
        >
          <p className="flex items-center gap-2 font-heading text-lg font-bold text-brand-deep">
            {submission.status === "graded" ? <CircleCheck className="size-5 text-success" aria-hidden /> : submission.status === "returned" ? <RotateCcw className="size-5 text-coral-dark" aria-hidden /> : <Clock className="size-5 text-primary" aria-hidden />}
            {submission.status === "graded"
              ? isCheckpoint ? "Validé par votre coach" : `Corrigé${submission.grade !== null && submission.grade !== undefined ? ` : ${submission.grade} / ${submission.maxScore}` : ""}`
              : submission.status === "returned"
                ? "À reprendre : votre coach vous a fait un retour"
                : "Envoyé · en attente de correction"}
          </p>
          {submission.feedback && <RichText legacy="text" className="mt-2 text-ink">{submission.feedback}</RichText>}
          <p className="mt-2 text-xs text-muted-foreground">Envoyé le {formatDate(submission.updatedAt)}</p>
        </section>
      )}

      {submission?.status === "graded" ? (
        <div className="rounded-3xl border-2 border-border bg-card p-5">
          <h2 className="mb-2 font-bold text-brand-deep">Votre réponse</h2>
          <p className="whitespace-pre-line text-ink/85">{submission.content}</p>
          <Link href={stepAfter(courseId, outline, here)} className="mt-5 inline-flex h-12 items-center rounded-2xl bg-primary px-6 font-semibold text-white">
            Étape suivante
          </Link>
        </div>
      ) : access.readOnly ? (
        <p className="text-muted-foreground">Cours terminé : les envois sont fermés.</p>
      ) : (
        <section className="grid gap-3">
          <h2 className="text-xl font-extrabold text-brand-deep">{submission ? "Modifier ma réponse" : "Ma réponse"}</h2>
          <AssignmentForm
            courseId={courseId}
            moduleId={moduleId ?? "final"}
            type={def.submissionType === "link" ? "link" : "text"}
            initial={submission?.content ?? ""}
            label={submission ? "Renvoyer" : "Envoyer à mon coach"}
          />
        </section>
      )}
    </div>
  );
}
