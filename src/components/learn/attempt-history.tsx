import { ChevronDown, CircleCheck, Clock, History, MessageSquare, Mic, RotateCcw } from "lucide-react";
import type { AttemptItem } from "@/lib/learn/attempt-history";
import { coachInitialName } from "@/lib/coach-name";
import { Avatar } from "@/components/account/avatar";
import { RichText } from "./rich-text";
import { VoiceNote } from "./voice-note";
import { formatDate } from "./ui";
import { cn } from "cn";

/*
 * Earlier speaking-challenge submissions, each a folded row (« Envoi 2 » / « Submission 2 ») with a
 * colour and icon for the coach's decision — green validated, red to redo, grey no feedback — and,
 * opened: the recording and the coach's feedback (voice note, comment). English on learner pages and
 * the coach's grading page (the « fr » wording is no longer used).
 */

const TEXT = {
  fr: { title: "Mes essais précédents", sub: "Envoi", graded: "Validé", returned: "À reprendre", feedback: "Retour du coach", none: "Pas de retour", noneLong: "Pas de retour du coach : vous avez envoyé une nouvelle version avant.", recording: "Votre enregistrement", missing: "Enregistrement indisponible.", noComment: "Pas de commentaire écrit.", on: "le", voice: "Message vocal" },
  en: { title: "Previous submissions", sub: "Submission", graded: "Validated", returned: "Returned", feedback: "Feedback given", none: "No feedback", noneLong: "Not reviewed: a new version was sent before any feedback.", recording: "Recording", missing: "Recording unavailable.", noComment: "No written comment.", on: "on", voice: "Voice note" },
} as const;

const TONE = {
  graded: { row: "border-l-brand-deep", icon: "bg-gradient-to-br from-primary to-brand-deep text-white", pill: "bg-gradient-to-br from-primary to-brand-deep text-white", Icon: CircleCheck },
  returned: { row: "border-l-coral", icon: "bg-coral-soft text-coral-dark", pill: "border border-coral bg-white text-coral-dark", Icon: RotateCcw },
  feedback: { row: "border-l-primary", icon: "bg-brand-soft text-primary", pill: "bg-brand-soft text-primary", Icon: MessageSquare },
  none: { row: "border-l-border", icon: "bg-muted text-muted-foreground", pill: "bg-muted text-muted-foreground", Icon: Clock },
} as const;

export function AttemptHistory({ items, locale = "en", open = false, className }: { items: AttemptItem[]; locale?: "fr" | "en"; open?: boolean; className?: string }) {
  if (!items.length) return null;
  const t = TEXT[locale];
  const date = (d: Date) => (locale === "fr" ? formatDate(d) : new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }));
  const counts = { graded: items.filter((a) => a.review?.status === "graded").length, returned: items.filter((a) => a.review?.status === "returned").length };
  const list = (
    <ul className="grid gap-2">
      {items.map((a) => {
        const r = a.review;
        const kind = r?.status ?? (r ? "feedback" : "none");
        const tone = TONE[kind];
        const label = kind === "graded" ? t.graded : kind === "returned" ? t.returned : kind === "feedback" ? t.feedback : t.none;
        return (
          <li key={a.n}>
            <details className={cn("group/att overflow-clip rounded-xl border border-l-4 border-border bg-card", tone.row)}>
              <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", tone.icon)}>
                  <tone.Icon className="size-4" aria-hidden />
                </span>
                <span className="grid min-w-0 flex-1">
                  <span className="font-semibold text-brand-deep">
                    {t.sub} {a.n}
                  </span>
                  {a.sentAt && <span className="text-xs text-muted-foreground">{date(a.sentAt)}</span>}
                </span>
                {r?.note && <Mic className="size-4 shrink-0 text-muted-foreground" aria-label={t.voice} />}
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap", tone.pill)}>
                  {label}
                  {r?.grade != null && ` · ${r.grade}/${r.maxScore}`}
                </span>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition group-open/att:rotate-180 motion-reduce:transition-none" aria-hidden />
              </summary>
              <div className="grid gap-3 border-t border-border p-3">
                <div className="grid gap-1">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {t.recording}
                    {a.durationS ? ` · ${Math.round(a.durationS)} s` : ""}
                  </p>
                  {a.recordingUrl ? <audio src={a.recordingUrl} controls preload="none" className="w-full" /> : <p className="text-sm text-muted-foreground">{t.missing}</p>}
                </div>
                {r ? (
                  <div className="grid gap-2 rounded-xl bg-muted/50 p-3">
                    <div className="flex items-center gap-2">
                      {r.coach && <Avatar src={r.coach.avatarUrl} name={coachInitialName(r.coach.label)} className="size-7 text-xs" />}
                      <p className="text-xs font-semibold text-brand-deep">
                        {r.coach ? (locale === "fr" ? r.coach.label : r.coach.name) : t.feedback}
                        {r.gradedAt ? ` · ${t.on} ${date(r.gradedAt)}` : ""}
                      </p>
                    </div>
                    {r.note &&
                      (locale === "fr" ? (
                        <VoiceNote src={r.note.url} seed={r.note.seed} durationS={r.note.durationS} coachName={r.coach?.label ?? (locale === "fr" ? "Votre coach" : "Your coach")} coachAvatar={r.coach?.avatarUrl} />
                      ) : (
                        <audio src={r.note.url} controls preload="none" className="w-full" />
                      ))}
                    {r.feedback ? (
                      <div className="rounded-xl rounded-tl-sm border border-border bg-white p-3">
                        <RichText legacy="text" className="text-sm text-ink">
                          {r.feedback}
                        </RichText>
                      </div>
                    ) : (
                      !r.note && <p className="text-sm text-muted-foreground">{t.noComment}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t.noneLong}</p>
                )}
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
  // The whole history is itself a dropdown (folded on learner pages, open on the grading page).
  return (
    <details open={open} className={cn("group min-w-0 rounded-2xl border-2 border-border bg-card", className)}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-4 font-heading font-extrabold text-brand-deep [&::-webkit-details-marker]:hidden">
        <History className="size-5 text-primary" aria-hidden />
        <span className="flex-1">
          {t.title} ({items.length})
        </span>
        {counts.graded > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-primary to-brand-deep px-2 py-0.5 font-sans text-xs font-bold text-white" title={t.graded}>
            <CircleCheck className="size-3.5" aria-hidden /> {counts.graded}
            <span className="sr-only">{t.graded}</span>
          </span>
        )}
        {counts.returned > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-coral bg-white px-2 py-0.5 font-sans text-xs font-bold text-coral-dark" title={t.returned}>
            <RotateCcw className="size-3.5" aria-hidden /> {counts.returned}
            <span className="sr-only">{t.returned}</span>
          </span>
        )}
        <ChevronDown className="size-5 transition group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
      </summary>
      <div className="border-t border-border p-3">{list}</div>
    </details>
  );
}
