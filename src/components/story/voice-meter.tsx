import { Mic } from "lucide-react";
import { cn } from "cn";

/*
 * Story Mode conversation time left in a season (the episodes' role-play calls): bar and
 * « 42 of 60 min left in this season ». Red under 20 % / 3 min. No hooks.
 */
export function VoiceMeter({ leftS, allowanceS, className, compact }: { leftS: number; allowanceS: number; className?: string; compact?: boolean }) {
  const l = Math.floor(Math.max(0, leftS) / 60);
  const c = Math.max(l, Math.round(allowanceS / 60));
  const pct = allowanceS ? Math.min(100, (leftS / allowanceS) * 100) : 0;
  const low = l < 3 || pct < 20;
  return (
    <div className={cn("grid gap-1.5", className)} role="group" aria-label={`Conversation time: ${l} of ${c} minutes left in this season`}>
      <p className="flex items-center justify-between gap-2 text-sm text-ink/80">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <Mic className={cn("size-4", low ? "text-coral" : "text-primary")} aria-hidden /> Conversation time
        </span>
        <span className={cn("font-bold tabular-nums", low ? "text-coral-dark" : "text-primary")}>
          {leftS > 0 && l === 0 ? "< 1" : l} of {c} min left{compact ? "" : " in this season"}
        </span>
      </p>
      <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span className={cn("block h-full rounded-full", low ? "bg-coral" : "bg-gradient-to-r from-primary to-brand-deep")} style={{ width: `${pct}%` }} />
      </span>
      {leftS <= 0 ? <p lang="fr" className="text-xs text-muted-foreground">Vos minutes de conversation pour cette saison sont utilisées : demandez des minutes à votre coach.</p> : null}
    </div>
  );
}
