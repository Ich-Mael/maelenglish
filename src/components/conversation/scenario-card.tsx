import Link from "next/link";
import { BookOpen, Clock, Mic, Target } from "lucide-react";
import type { ScenarioCard as Card } from "@/lib/conversation/queries";
import { themeLabel } from "@/lib/lab/meta";
import { DIFFICULTY_LABEL } from "@/lib/lab/types";

/** A « Talk with Coach Ish » scenario: brand band (level, situation, best score), where it sits in the course, the partner, a red « Talk » call to action. */
export function ScenarioCard({ c }: { c: Card }) {
  return (
    <Link href={`/partenaire/${c.activityId}`} className="group flex h-full flex-col overflow-hidden rounded-3xl border-2 border-transparent bg-card shadow-[0_6px_0_0_color-mix(in_oklab,var(--color-primary)_18%,transparent)] transition hover:-translate-y-0.5 hover:border-primary/30 motion-reduce:transition-none">
      <div className="relative flex min-h-14 items-center gap-2 overflow-clip bg-gradient-to-br from-primary to-brand-deep px-4 py-2 text-white">
        <span aria-hidden className="pointer-events-none absolute -top-8 -right-6 size-24 rounded-full bg-[radial-gradient(circle,rgb(255_87_87/0.35),transparent_70%)]" />
        {c.level && <span className="relative rounded-full bg-white px-2 py-0.5 text-xs font-extrabold text-primary">{c.level}</span>}
        {c.theme && <span className="relative truncate text-xs font-semibold text-white/85">{themeLabel(c.theme, "en")}</span>}
        <span className="relative ml-auto flex items-center gap-1.5 text-xs font-bold">
          {c.best !== null ? (
            <>
              <span className="text-white/70">Best</span>
              <span className="flex size-8 items-center justify-center rounded-full border-2 border-coral bg-white font-heading text-sm text-primary">{c.best}</span>
            </>
          ) : (
            <span className="rounded-full bg-white/15 px-2 py-0.5">New</span>
          )}
        </span>
      </div>
      <div className="grid flex-1 content-start gap-2 p-4">
        {c.where && (
          <p className="flex items-start gap-1.5 text-xs font-bold text-coral-dark">
            <BookOpen className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>
              {c.where.unit}
              {c.where.lesson && <span className="font-semibold text-muted-foreground"> · Lesson: {c.where.lesson}</span>}
            </span>
          </p>
        )}
        <h3 className="text-lg leading-snug font-extrabold text-brand-deep group-hover:text-primary">{c.title}</h3>
        <p lang="en" className="line-clamp-2 text-sm text-muted-foreground">
          With {c.aiRole}
        </p>
      </div>
      <div className="flex items-center gap-3 border-t border-border px-4 py-3 text-xs font-semibold text-ink/70">
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3.5" aria-hidden /> {c.maxMinutes} min
        </span>
        <span className="inline-flex items-center gap-1">
          <Target className="size-3.5" aria-hidden /> {c.goals} goal{c.goals === 1 ? "" : "s"}
        </span>
        <span className="hidden sm:inline">{DIFFICULTY_LABEL[c.difficulty]}</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full border-2 border-coral bg-white px-3 py-1 font-bold text-coral group-hover:bg-coral-soft">
          <Mic className="size-3.5" aria-hidden /> Talk
        </span>
      </div>
    </Link>
  );
}
