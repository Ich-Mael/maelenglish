import Link from "next/link";
import { BookOpen, Check, ChevronDown, Clock, EyeOff, Headphones, Lock, Mic, Sparkles, Target, Trophy } from "lucide-react";
import type { ModuleOutline, Outline, StepOutline, StepState, UnitOutline } from "@/lib/learn/progress";
import { examPath, stepPath } from "@/lib/learn/paths";
import { formatDate } from "./ui";
import { RichText } from "./rich-text";
import { PathRow, PathStep } from "./path-row";
import { cn } from "cn";

/** Step icon: lesson, Lab activity type, challenge. */
const STEP_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  lesson: BookOpen,
  activity: Sparkles,
  listen_choose: Headphones,
  challenge: Mic,
};

const DAY_LABEL: Record<NonNullable<ModuleOutline["day"]>["state"], string> = {
  done: "Terminé",
  current: "Aujourd'hui",
  pending_review: "En attente de validation",
  redo: "À refaire",
  locked_checkpoint: "Validez le jour précédent",
  locked_time: "Pas encore ouvert",
};

const CHALLENGE_SUB: Record<string, string | undefined> = {
  none: "Enregistrez-vous pour finir l'unité",
  pending: "Envoyé · en attente du coach",
  returned: "À reprendre",
  graded: "Validé par votre coach",
};

type Node = { key: string; href: string; label: string; sub?: string; state: StepState; icon: React.ComponentType<{ className?: string }>; big?: boolean };

function stepNode(courseId: string, s: StepOutline): Node {
  const below = s.kind === "activity" && s.score !== null && s.passScore !== null && s.score < s.passScore;
  return {
    key: s.id,
    href: stepPath(courseId, s.id),
    label: s.kind === "challenge" ? "Défi oral" : s.title,
    sub: s.kind === "challenge" ? CHALLENGE_SUB[s.status ?? "none"] : below ? `À revoir · ${s.score} %` : s.kind === "activity" && s.score !== null ? `${s.score} %` : undefined,
    state: s.state,
    icon: STEP_ICON[s.type] ?? STEP_ICON[s.kind] ?? Sparkles,
    big: s.kind === "challenge",
  };
}

export function CourseMap({ courseId, outline, currentHref }: { courseId: string; outline: Outline; currentHref: string | null }) {
  // minmax(0,1fr): the horizontal unit paths scroll instead of widening the page.
  return (
    <ol className="grid grid-cols-[minmax(0,1fr)] gap-10">
      {outline.modules.map((m) => (
        <li key={m.id}>
          <ModuleBanner module={m} />
          {m.description.trim() && <ModuleAbout html={m.description} />}
          <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3">
            {m.units.map((u) => {
              const nodes = u.steps.map((s) => stepNode(courseId, s));
              return <UnitCard key={u.id} unit={u} open={nodes.some((n) => n.href === currentHref)} path={<Path label={`Activités de l'unité ${u.index + 1}`} nodes={nodes} currentHref={currentHref} />} />;
            })}
          </div>
        </li>
      ))}
      {outline.finalExam && (
        <li>
          <div className="rounded-3xl border-2 border-coral bg-white p-5 text-brand-deep">
            <p className="text-xs font-bold tracking-wide uppercase">Activité finale</p>
            <h2 className="text-xl font-extrabold">L&apos;examen final</h2>
          </div>
          <div className="mt-6">
            <Path
              label="Activité finale"
              currentHref={currentHref}
              nodes={[{ key: "exam", href: examPath(courseId), label: "Examen final", sub: outline.finalExam.bestScore !== null ? `Meilleur score : ${outline.finalExam.bestScore} %` : undefined, state: outline.finalExam.state, icon: Trophy, big: true }]}
            />
          </div>
        </li>
      )}
    </ol>
  );
}

/** A horizontal row of steps (see PathRow). */
function Path({ label, nodes, currentHref }: { label: string; nodes: Node[]; currentHref: string | null }) {
  return (
    <PathRow label={label}>
      {nodes.map((node, i) => (
        <PathStep key={node.key} first={i === 0} reached={i > 0 && nodes[i - 1].state === "completed"} current={node.href === currentHref}>
          <PathNode node={node} current={node.href === currentHref} />
        </PathStep>
      ))}
    </PathRow>
  );
}

function ModuleBanner({ module: m }: { module: ModuleOutline }) {
  const locked = m.state === "locked";
  return (
    <div className={cn("flex items-center gap-4 rounded-3xl p-5", locked ? "bg-muted text-muted-foreground" : m.state === "completed" ? "border-2 border-primary bg-white text-primary" : "bg-primary text-white")}>
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

/**
 * A unit as a foldable card (<details>, works without JS): the summary shows its number / state,
 * title, progress and minutes; open, its objectives and the path of steps. Only the unit holding
 * the learner's next step starts open — done and locked units stay folded so the map stays short.
 */
function UnitCard({ unit: u, open, path }: { unit: UnitOutline; open: boolean; path: React.ReactNode }) {
  const locked = u.state === "locked";
  const complete = u.state === "completed";
  const percent = u.total ? Math.round((u.done / u.total) * 100) : 0;
  return (
    <details open={open} className={cn("group rounded-3xl border-2 bg-card transition-colors", open ? "border-primary/30" : "border-border", "open:border-primary/30 open:shadow-sm")}>
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-3xl p-4 outline-none focus-visible:ring-4 focus-visible:ring-ring/40 sm:gap-4 sm:p-5 [&::-webkit-details-marker]:hidden">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-2xl font-heading text-lg font-extrabold",
            complete ? "border-2 border-primary bg-white text-primary" : locked ? "bg-muted text-muted-foreground" : "bg-primary text-white",
          )}
        >
          {complete ? <Check className="size-5" aria-hidden /> : locked ? <Lock className="size-5" aria-hidden /> : u.index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block text-xs font-bold tracking-wide uppercase", locked ? "text-muted-foreground" : "text-primary")}>
            Unité {u.index + 1}
            {complete ? " · Terminée" : locked ? " · Verrouillée" : ""}
          </span>
          <span className={cn("block text-base leading-snug font-extrabold sm:text-lg", locked ? "text-muted-foreground" : "text-brand-deep")}>{u.title}</span>
          <span className="mt-1.5 flex items-center gap-2.5 text-xs font-semibold text-muted-foreground">
            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-brand-soft sm:w-28" aria-hidden>
              <span className="block h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
            </span>
            <span>
              {u.done}/{u.total} <span className="sr-only">activité(s) terminée(s)</span>
            </span>
            {u.estimatedMinutes > 0 && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" aria-hidden /> {u.estimatedMinutes} min
              </span>
            )}
          </span>
        </span>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-brand-deep transition group-open:rotate-180 motion-reduce:transition-none" aria-hidden>
          <ChevronDown className="size-5" />
        </span>
      </summary>
      <div className="border-t border-border px-4 pt-3 pb-2 sm:px-5">
        {u.hidden && (
          <p lang="en" className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-coral-soft px-3 py-1 text-xs font-bold text-coral-dark">
            <EyeOff className="size-3.5" aria-hidden /> Hidden from learners: this unit breaks the unit rules
          </p>
        )}
        {u.objectives.length > 0 && (
          <div className="rounded-2xl bg-brand-soft/60 px-4 py-3">
            <p className="text-xs font-bold tracking-wide text-primary uppercase">Objectifs</p>
            <ul className="mt-1 grid gap-1 text-sm text-ink/80">
              {u.objectives.map((o, i) => (
                <li key={i} className="flex gap-2">
                  <Target className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                  {o}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-1">{path}</div>
      </div>
    </details>
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
    "relative flex items-center justify-center rounded-full border-b-[6px] transition group-focus-visible:ring-4 group-focus-visible:ring-ring/50",
    node.big ? "size-20" : "size-16",
    node.state === "completed" && "border-2 border-b-[6px] border-primary bg-white text-primary",
    node.state === "available" && "border-brand-dark bg-primary text-white group-hover:brightness-110 group-active:translate-y-1 group-active:border-b-2",
    node.state === "locked" && "border-border bg-muted text-muted-foreground",
  );
  const content = (
    <>
      {/* Fixed-height slot: every circle's centre sits on the PathRow connector line. */}
      <span className="relative z-[1] flex h-20 items-center">
        <span className={circle}>
          {current && <span className="absolute -inset-2 animate-ping rounded-full border-4 border-coral/50 motion-reduce:animate-none" aria-hidden />}
          <Icon className={node.big ? "size-9" : "size-7"} aria-hidden />
        </span>
      </span>
      <span className="max-w-30 px-1 text-center">
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
    <Link href={node.href} className="group flex flex-col items-center gap-2 focus-visible:outline-none">
      {content}
    </Link>
  );
}
