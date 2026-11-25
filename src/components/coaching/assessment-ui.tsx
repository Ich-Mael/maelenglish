import { TrendingUp } from "lucide-react";
import { cn } from "cn";

/* Display pieces for the speaking assessment (no hooks: used by server pages and client forms). */

export const CRITERION_LABEL = { fluency: "Fluency", vocabulary: "Vocabulary", grammar: "Grammar", pronunciation: "Pronunciation", clarity: "Clear message" } as const;
export const CRITERION_FR = { fluency: "Aisance", vocabulary: "Vocabulaire", grammar: "Grammaire", pronunciation: "Prononciation", clarity: "Clarté du message" } as const;
type Key = keyof typeof CRITERION_LABEL;
const KEYS = Object.keys(CRITERION_LABEL) as Key[];
const fmt = (n: number, fr = false) => (fr ? String(n).replace(".", ",") : String(n));

/** The 5 criteria as bars (out of 10), with the start score faintly behind when given. */
export function ScoreBars({ scores, before, fr = false }: { scores: Partial<Record<Key, number | null>>; before?: Partial<Record<Key, number | null>> | null; fr?: boolean }) {
  return (
    <ul className="grid gap-2">
      {KEYS.map((k) => {
        const v = scores[k];
        const b = before?.[k];
        return (
          <li key={k} className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-2 text-sm">
            <span className="font-semibold text-muted-foreground">{fr ? CRITERION_FR[k] : CRITERION_LABEL[k]}</span>
            <span className="relative h-2.5 overflow-hidden rounded-full bg-brand-soft">
              {typeof b === "number" && <span className="absolute inset-y-0 left-0 rounded-full bg-primary/25" style={{ width: `${b * 10}%` }} />}
              {typeof v === "number" && <span className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-brand-deep" style={{ width: `${v * 10}%` }} />}
            </span>
            <span className="w-12 text-right font-bold text-brand-deep tabular-nums">{typeof v === "number" ? `${v}/10` : "—"}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** « 5,2 → 7,4 (+2,2) »: the overall start and end scores. */
export function LevelChange({ start, end, fr = false, className }: { start: number | null | undefined; end: number | null | undefined; fr?: boolean; className?: string }) {
  if (start == null && end == null) return <span className={cn("text-muted-foreground", className)}>—</span>;
  const delta = start != null && end != null ? Math.round((end - start) * 10) / 10 : null;
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-1.5 font-bold text-brand-deep", className)}>
      {start != null ? `${fmt(start, fr)}/10` : "—"}
      <span className="text-muted-foreground">→</span>
      {end != null ? `${fmt(end, fr)}/10` : fr ? "à venir" : "to come"}
      {delta != null && (
        <span className={cn("inline-flex items-center gap-0.5 text-sm", delta >= 0 ? "text-primary" : "text-coral-dark")}>
          {delta >= 0 && <TrendingUp className="size-3.5" aria-hidden />}
          {delta >= 0 ? "+" : ""}
          {fmt(delta, fr)}
        </span>
      )}
    </span>
  );
}
