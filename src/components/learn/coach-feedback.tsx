import { Clock, RotateCcw, Sparkles } from "lucide-react";
import { XP } from "@/lib/gamification/rules";
import { coachInitialName } from "@/lib/coach-name";
import { Avatar } from "@/components/account/avatar";
import { RichText } from "./rich-text";
import { VoiceNote } from "./voice-note";
import { formatDate } from "./ui";
import { cn } from "cn";

export type CoachFeedbackData = {
  status: string;
  grade?: number | null;
  maxScore?: number | null;
  feedback?: string | null;
  gradedAt?: Date | string | null;
  /** `name` = what learners see (`coachLabel`: « Coach Ish »). */
  coach: { name: string; avatarUrl?: string | null } | null;
  voiceNote: { url: string; seed: string; durationS?: number | null } | null;
};

/** Is there anything from the coach to show? */
export const hasCoachFeedback = (d: Pick<CoachFeedbackData, "status" | "grade" | "feedback" | "voiceNote">) => d.status !== "pending" && (!!d.feedback || d.grade != null || !!d.voiceNote || d.status === "graded");

/**
 * The coach's answer to a speaking challenge (« My Speaking Challenge » and the challenge step):
 * coach photo and name, decision, grade ring, voice note (WhatsApp-style) and the written comment
 * as a speech bubble, then what to do next.
 */
export function CoachFeedback({ d, className }: { d: CoachFeedbackData; className?: string }) {
  const ok = d.status === "graded";
  const name = d.coach?.name || "Your coach";
  const max = d.maxScore || 100;
  const pct = ok && d.grade != null ? Math.round((d.grade / max) * 100) : null;

  return (
    <div className={cn("grid min-w-0 gap-3 rounded-2xl p-4 sm:p-5", ok ? "bg-gradient-to-br from-brand-soft via-brand-soft/60 to-white" : "bg-coral-soft/70", className)}>
      <div className="flex items-center gap-3">
        <Avatar src={d.coach?.avatarUrl} name={coachInitialName(name)} className="size-11 text-base ring-2 ring-white" />
        <div className="min-w-0 flex-1">
          <p className={cn("text-[11px] font-bold tracking-wide uppercase", ok ? "text-primary" : "text-coral-dark")}>{ok ? "Validated by your coach" : "Your coach asks you to redo it"}</p>
          <p className="font-heading leading-tight font-extrabold break-words text-brand-deep">{name}</p>
          {d.gradedAt && <p className="text-xs text-muted-foreground">Le {formatDate(d.gradedAt)}</p>}
        </div>
        {pct !== null && (
          <div className="relative flex size-14 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(var(--color-primary), var(--color-brand-deep) ${pct}%, color-mix(in oklab, var(--color-primary) 15%, white) 0)` }} role="img" aria-label={`Grade: ${d.grade} out of ${max}`}>
            <span className="flex size-11 flex-col items-center justify-center rounded-full bg-white leading-none">
              <span className="font-heading text-base font-extrabold text-primary tabular-nums">{d.grade}</span>
              <span className="text-[10px] font-semibold text-muted-foreground">/ {max}</span>
            </span>
          </div>
        )}
      </div>

      {d.voiceNote && (
        <div className="grid gap-1">
          <p className="text-xs font-semibold text-brand-deep">Message vocal</p>
          <VoiceNote src={d.voiceNote.url} seed={d.voiceNote.seed} durationS={d.voiceNote.durationS ?? 0} coachName={name} coachAvatar={d.coach?.avatarUrl} />
        </div>
      )}

      {d.feedback ? (
        <div className="rounded-2xl rounded-tl-sm border-2 border-primary/10 bg-white p-4">
          <RichText legacy="text" className="text-ink">
            {d.feedback}
          </RichText>
        </div>
      ) : (
        !d.voiceNote && <p className="text-sm text-muted-foreground">{ok ? "Your coach validated your challenge without a comment." : "No written comment."}</p>
      )}

      <p className={cn("flex items-start gap-2 text-sm font-semibold", ok ? "text-primary" : "text-coral-dark")}>
        {ok ? (
          <>
            <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden /> Well done! +{XP.challengeValidated} XP for this validated challenge.
          </>
        ) : (
          <>
            <RotateCcw className="mt-0.5 size-4 shrink-0" aria-hidden /> {d.voiceNote ? "Listen to" : "Read"} this feedback, listen to your recording again, then record yourself again.
          </>
        )}
      </p>
    </div>
  );
}

/** Small status line while the coach hasn't answered yet. */
export function AwaitingCoach({ coachName, className }: { coachName?: string; className?: string }) {
  return (
    <p className={cn("flex items-center gap-2 rounded-2xl bg-brand-soft px-4 py-3 text-sm font-semibold text-primary", className)}>
      <Clock className="size-4 shrink-0" aria-hidden /> {coachName ? `${coachName} will` : "Your coach will"} listen to your recording and get back to you.
    </p>
  );
}
