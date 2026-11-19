import Link from "next/link";
import { Check, ChevronDown, ClipboardCheck, FileText, Lock, PenLine, PlayCircle, Sparkles, Star, Trophy, Type } from "lucide-react";
import type { ModuleOutline, Outline, StepState } from "@/lib/learn/progress";
import { assignmentPath, examPath, lessonPath, projectPath, quizPath } from "@/lib/learn/paths";
import { formatDate } from "./ui";
import { RichText } from "./rich-text";
import { cn } from "cn";

const LESSON_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  video: PlayCircle,
  text: Type,
  pdf: FileText,
  practice: Sparkles,
};

const DAY_LABEL: Record<NonNullable<ModuleOutline["day"]>["state"], string> = {
  done: "Terminé",
  current: "Aujourd'hui",
  pending_review: "En attente de validation",
  redo: "À refaire",
  locked_checkpoint: "Validez le jour précédent",
  locked_time: "Pas encore ouvert",
};

/** Zig-zag offsets give the path its playful shape (lg screens only; stays straight on phones for reach). */
const OFFSETS = ["sm:translate-x-0", "sm:translate-x-12", "sm:translate-x-20", "sm:translate-x-12", "sm:translate-x-0", "sm:-translate-x-12", "sm:-translate-x-20", "sm:-translate-x-12"];

type Node = { key: string; href: string; label: string; sub?: string; state: StepState; icon: React.ComponentType<{ className?: string }>; big?: boolean };

export function CourseMap({ courseId, outline, currentHref }: { courseId: string; outline: Outline; currentHref: string | null }) {
  let n = 0;
  return (
    <ol className="grid gap-10">
      {outline.modules.map((m) => {
        const nodes: Node[] = [
          ...m.lessons.map((l) => ({ key: l.id, href: lessonPath(courseId, l.id), label: l.title, state: l.state, icon: LESSON_ICON[l.type] ?? Type })),
          ...(m.quiz
            ? [{ key: `${m.id}-quiz`, href: quizPath(courseId, m.id), label: "Quiz du module", sub: m.quiz.bestScore !== null ? `Meilleur score : ${m.quiz.bestScore} %` : undefined, state: m.quiz.state, icon: Star, big: true }]
            : []),
          ...(m.assignment
            ? [{
                key: `${m.id}-assignment`,
                href: assignmentPath(courseId, m.id),
                label: m.day ? "Point de contrôle" : "Devoir",
                sub: m.assignment.status === "pending" ? "En correction" : m.assignment.status === "returned" ? "À reprendre" : undefined,
                state: m.assignment.state,
                icon: PenLine,
              }]
            : []),
        ];
        return (
          <li key={m.id}>
            <ModuleBanner module={m} />
            {m.description.trim() && <ModuleAbout html={m.description} />}
            <ol className="mt-6 grid justify-items-center gap-5">
              {nodes.map((node) => (
                <li key={node.key} className={cn("transition-transform", OFFSETS[n++ % OFFSETS.length])}>
                  <PathNode node={node} current={node.href === currentHref} />
                </li>
              ))}
            </ol>
          </li>
        );
      })}
      {(outline.finalExam || outline.finalProject) && (
        <li>
          <div className="rounded-3xl border-2 border-coral bg-white p-5 text-brand-deep">
            <p className="text-xs font-bold tracking-wide uppercase">Étape finale</p>
            <h2 className="text-xl font-extrabold">Obtenez votre certificat</h2>
          </div>
          <ol className="mt-6 grid justify-items-center gap-5">
            {outline.finalExam && (
              <li>
                <PathNode
                  node={{ key: "exam", href: examPath(courseId), label: "Examen final", sub: outline.finalExam.bestScore !== null ? `Meilleur score : ${outline.finalExam.bestScore} %` : undefined, state: outline.finalExam.state, icon: Trophy, big: true }}
                  current={examPath(courseId) === currentHref}
                />
              </li>
            )}
            {outline.finalProject && (
              <li>
                <PathNode
                  node={{ key: "project", href: projectPath(courseId), label: "Projet final", sub: outline.finalProject.status === "pending" ? "En correction" : undefined, state: outline.finalProject.state, icon: ClipboardCheck }}
                  current={projectPath(courseId) === currentHref}
                />
              </li>
            )}
          </ol>
        </li>
      )}
    </ol>
  );
}

function ModuleBanner({ module: m }: { module: ModuleOutline }) {
  const locked = m.state === "locked";
  return (
    <div className={cn("flex items-center gap-4 rounded-3xl p-5", locked ? "bg-muted text-muted-foreground" : m.state === "completed" ? "bg-success text-white" : "bg-primary text-white")}>
      <div className="flex-1">
        <p className="text-xs font-bold tracking-wide uppercase">
          {m.day ? `Jour ${m.day.number}` : `Module ${m.index + 1}`}
          {m.day && ` · ${DAY_LABEL[m.day.state]}`}
        </p>
        <h2 className="text-xl font-extrabold">{m.title}</h2>
        {m.summary && <p className="mt-0.5 text-sm opacity-90">{m.summary}</p>}
        {m.day?.state === "locked_time" && <p className="mt-0.5 text-sm">S&apos;ouvre le {formatDate(m.day.opensOn)}</p>}
      </div>
      {locked ? <Lock className="size-7 shrink-0" aria-hidden /> : m.state === "completed" ? <Check className="size-8 shrink-0" aria-hidden /> : null}
    </div>
  );
}

/** Module description, folded by default so the path stays the focus (no JS: <details>). */
function ModuleAbout({ html }: { html: string }) {
  return (
    <details className="group mt-3 rounded-2xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-sm font-bold text-brand-deep [&::-webkit-details-marker]:hidden">
        À propos de ce module
        <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
      </summary>
      <RichText legacy="text" className="border-t border-border px-5 py-4 text-base">
        {html}
      </RichText>
    </details>
  );
}

function PathNode({ node, current }: { node: Node; current: boolean }) {
  const Icon = node.state === "completed" ? Check : node.state === "locked" ? Lock : node.icon;
  const circle = cn(
    "relative flex items-center justify-center rounded-full border-b-[6px] transition",
    node.big ? "size-20" : "size-16",
    node.state === "completed" && "border-[#178a5c] bg-success text-white",
    node.state === "available" && "border-brand-dark bg-primary text-white group-hover:brightness-110 group-active:translate-y-1 group-active:border-b-2",
    node.state === "locked" && "border-border bg-muted text-muted-foreground",
  );
  const content = (
    <>
      <span className={circle}>
        {current && <span className="absolute -inset-2 animate-ping rounded-full border-4 border-primary/30 motion-reduce:animate-none" aria-hidden />}
        <Icon className={node.big ? "size-9" : "size-7"} aria-hidden />
      </span>
      <span className="max-w-44 text-center">
        <span className={cn("block text-sm font-bold", node.state === "locked" ? "text-muted-foreground" : "text-brand-deep")}>{node.label}</span>
        {node.sub && <span className="block text-xs text-muted-foreground">{node.sub}</span>}
        {current && <span className="mt-1 inline-block rounded-full border-2 border-coral bg-white px-2 py-0.5 text-xs font-bold text-coral-dark">À vous !</span>}
      </span>
    </>
  );
  if (node.state === "locked") {
    return (
      <span className="flex flex-col items-center gap-2" aria-label={`${node.label} (verrouillé)`}>
        {content}
      </span>
    );
  }
  return (
    <Link href={node.href} className="group flex flex-col items-center gap-2 focus-visible:outline-none [&:focus-visible>span:first-child]:ring-4 [&:focus-visible>span:first-child]:ring-ring/50">
      {content}
    </Link>
  );
}
