import { Clock } from "lucide-react";
import { cn } from "cn";

/*
 * « Talk with Coach Ish » time left this month (the learner's monthly AI minutes): a bar and
 * « 12 of 20 min left ». Red when under 20 % (or under 3 minutes). No hooks: server or client.
 */
export function MinutesMeter({ left, cap, tone = "light", className }: { left: number; cap: number; tone?: "light" | "dark"; className?: string }) {
  const l = Math.max(0, Math.floor(left));
  const c = Math.max(l, Math.round(cap));
  const pct = c ? Math.min(100, (left / c) * 100) : 0;
  const low = l < 3 || pct < 20;
  const dark = tone === "dark";
  return (
    <div className={cn("grid gap-1.5", className)} role="group" aria-label={`Conversation time: ${l} of ${c} minutes left this month`}>
      <p className={cn("flex items-center justify-between gap-2 text-sm", dark ? "text-white/85" : "text-ink/80")}>
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <Clock className={cn("size-4", low ? "text-coral" : dark ? "text-white" : "text-primary")} aria-hidden /> Conversation time
        </span>
        <span className={cn("font-bold tabular-nums", low ? (dark ? "text-coral" : "text-coral-dark") : dark ? "text-white" : "text-primary")}>
          {l} of {c} min left
        </span>
      </p>
      <span className={cn("h-2 overflow-hidden rounded-full", dark ? "bg-white/15" : "bg-muted")} aria-hidden>
        <span className={cn("block h-full rounded-full", low ? "bg-coral" : dark ? "bg-white" : "bg-gradient-to-r from-primary to-brand-deep")} style={{ width: `${pct}%` }} />
      </span>
      {l === 0 ? (
        <p className={cn("text-xs", dark ? "text-white/70" : "text-muted-foreground")}>Your minutes come back on the 1st of next month.</p>
      ) : low ? (
        <p className={cn("text-xs", dark ? "text-white/70" : "text-muted-foreground")}>Almost used up for this month: they come back on the 1st.</p>
      ) : null}
    </div>
  );
}
