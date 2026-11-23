import {
  ArrowRight,
  Check,
  ChevronDown,
  Lightbulb,
  MessageCircle,
  Sparkles,
  X,
} from "lucide-react";
import type { ConversationTurn, Debrief } from "@/lib/ai/types";
import { ScoreRing } from "@/components/lab/writing-correction";
import { cn } from "cn";

/*
 * Debrief of an AI role-play (spec AIC-04): summary and score, the five scores (pronunciation comes
 * with Azure scoring), goals checklist, the transcript with the learner's mistakes corrected under
 * each turn, « Coach Ish Tips » (better ways to say it + the tip), 3 phrases to reuse, then the conversation (folded). No hooks: used by the live
 * player (client), the session page and the coach's page (server). Explanations are in French.
 */

const SCORES: { key: keyof Debrief["scores"]; label: string }[] = [
  { key: "grammar", label: "Grammar" },
  { key: "vocabulary", label: "Vocabulary" },
  { key: "fluency", label: "Fluency" },
  { key: "tone", label: "Professional tone" },
  { key: "goalCompletion", label: "Goals" },
  { key: "pronunciation", label: "Pronunciation" },
];

const fmt = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function DebriefView({
  debrief,
  transcript,
  score,
  aiName = "Partner",
  learnerName = "You",
}: {
  debrief: Debrief;
  transcript: ConversationTurn[];
  score: number | null;
  aiName?: string;
  learnerName?: string;
}) {
  const byTurn = new Map<number, Debrief["corrections"]>();
  for (const c of debrief.corrections)
    byTurn.set(c.turn, [...(byTurn.get(c.turn) ?? []), c]);
  const loose = byTurn.get(-1) ?? [];

  return (
    <div className="grid gap-5">
      <section className="flex items-center gap-4 rounded-3xl bg-gradient-to-br from-brand-soft to-white p-4 sm:p-5">
        {score !== null && <ScoreRing score={score} />}
        <div className="grid gap-1">
          <p className="text-xs font-bold tracking-wide text-primary uppercase">
            Your debrief
          </p>
          <p lang="fr" className="text-ink">
            {debrief.summary}
          </p>
        </div>
      </section>

      <section
        className="grid gap-2 rounded-3xl border border-border bg-card p-4 sm:p-5"
        aria-label="Scores"
      >
        <h2 className="text-lg font-extrabold text-brand-deep">Scores</h2>
        <ul className="grid gap-2.5 sm:grid-cols-2 sm:gap-x-6">
          {SCORES.map(({ key, label }) => {
            const v = debrief.scores[key];
            return (
              <li key={key} className="grid gap-1">
                <p className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-ink">{label}</span>
                  <span className="font-bold text-primary tabular-nums">
                    {v === null ? (
                      <span className="text-xs font-semibold text-muted-foreground">
                        Coming soon
                      </span>
                    ) : (
                      `${v} / 10`
                    )}
                  </span>
                </p>
                <span
                  className="h-2 overflow-hidden rounded-full bg-muted"
                  aria-hidden
                >
                  {v !== null && (
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-primary to-brand-deep"
                      style={{ width: `${v * 10}%` }}
                    />
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {debrief.goals.length > 0 && (
        <section className="grid gap-2 rounded-3xl border border-border bg-card p-4 sm:p-5">
          <h2 className="text-lg font-extrabold text-brand-deep">
            Your goals · {debrief.goals.filter((g) => g.achieved).length} /{" "}
            {debrief.goals.length}
          </h2>
          <ul className="grid gap-2 text-sm">
            {debrief.goals.map((g, i) => (
              <li key={i} className="flex gap-2.5">
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                    g.achieved
                      ? "bg-gradient-to-br from-primary to-brand-deep text-white"
                      : "border-2 border-coral bg-white text-coral-dark",
                  )}
                >
                  {g.achieved ? (
                    <Check className="size-3" aria-hidden />
                  ) : (
                    <X className="size-3" aria-hidden />
                  )}
                  <span className="sr-only">
                    {g.achieved ? "Achieved" : "Not achieved"}
                  </span>
                </span>
                <span>
                  <span className="font-semibold text-ink">{g.goal}</span>
                  {g.evidence && (
                    <span lang="fr" className="block text-muted-foreground">
                      {g.evidence}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(debrief.betterWays.length > 0 || debrief.maelTip) && (
        <section className="grid gap-4 rounded-3xl border-2 border-coral bg-white p-4 sm:p-5">
          <h2 className="flex items-center gap-3 text-lg font-extrabold text-brand-deep">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/coach-ish-256.webp"
              alt=""
              width={40}
              height={40}
              className="size-10 rounded-full object-cover"
            />
            Coach Ish Tips
          </h2>
          {debrief.betterWays.length > 0 && (
            <div className="grid gap-2">
              <p className="flex items-center gap-2 text-sm font-bold text-primary">
                <Sparkles className="size-4" aria-hidden /> Better ways to say
                it
              </p>
              <ul className="grid gap-2.5">
                {debrief.betterWays.map((b, i) => (
                  <li
                    key={i}
                    className="grid gap-1 rounded-2xl bg-muted/50 px-3 py-2.5 text-sm"
                  >
                    <p lang="en" className="text-muted-foreground">
                      « {b.original} »
                    </p>
                    <p
                      lang="en"
                      className="flex gap-1.5 font-bold text-primary"
                    >
                      <ArrowRight
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden
                      />{" "}
                      {b.improved}
                    </p>
                    {b.why && (
                      <p lang="fr" className="text-ink/80">
                        {b.why}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {debrief.betterWays.length > 0 && debrief.maelTip && (
            <hr className="border-coral/30" />
          )}
          {debrief.maelTip && (
            <div className="flex gap-3">
              <Lightbulb
                className="mt-0.5 size-5 shrink-0 text-coral"
                aria-hidden
              />
              <p lang="fr" className="text-ink">
                {debrief.maelTip}
              </p>
            </div>
          )}
        </section>
      )}

      {debrief.phrasesToReuse.length > 0 && (
        <section className="grid gap-2 rounded-3xl bg-gradient-to-br from-primary to-brand-deep p-4 text-white sm:p-5">
          <h2 className="text-lg font-extrabold">3 phrases to reuse</h2>
          <ul className="flex flex-wrap gap-2">
            {debrief.phrasesToReuse.map((p, i) => (
              <li
                key={i}
                lang="en"
                className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-primary"
              >
                {p}
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="group/conv rounded-3xl border border-border bg-card">
        <summary className="flex cursor-pointer list-none items-center gap-3 rounded-3xl p-4 hover:bg-brand-soft/40 sm:p-5 [&::-webkit-details-marker]:hidden">
          <MessageCircle className="size-5 shrink-0 text-primary" aria-hidden />
          <span className="grid flex-1">
            <span className="text-lg font-extrabold text-brand-deep">
              Your conversation
            </span>
            <span className="text-xs text-muted-foreground">
              {transcript.length} turns
              {debrief.corrections.length > 0 &&
                ` · ${debrief.corrections.length} correction${debrief.corrections.length === 1 ? "" : "s"} inside`}
            </span>
          </span>
          <span className="text-xs font-semibold text-muted-foreground">
            <span className="group-open/conv:hidden">Show</span>
            <span className="hidden group-open/conv:inline">Hide</span>
          </span>
          <ChevronDown
            className="size-5 shrink-0 text-muted-foreground transition group-open/conv:rotate-180 motion-reduce:transition-none"
            aria-hidden
          />
        </summary>
        <div className="grid gap-3 px-4 pb-4 sm:px-5 sm:pb-5">
          <ol className="grid gap-3">
            {transcript.map((t, i) => {
              const fixes = byTurn.get(i) ?? [];
              const mine = t.role === "user";
              return (
                <li
                  key={i}
                  className={cn(
                    "grid max-w-[88%] gap-1.5",
                    mine ? "justify-self-end" : "justify-self-start",
                  )}
                >
                  <p
                    className={cn(
                      "text-[11px] font-bold tracking-wide uppercase",
                      mine
                        ? "text-right text-primary"
                        : "text-muted-foreground",
                    )}
                  >
                    {mine ? learnerName : aiName} · {fmt(t.t)}
                  </p>
                  <p
                    lang="en"
                    className={cn(
                      "rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug",
                      mine
                        ? "rounded-tr-sm bg-brand-soft text-brand-deep"
                        : "rounded-tl-sm bg-muted text-ink",
                    )}
                  >
                    {t.text}
                  </p>
                  {fixes.map((c, k) => (
                    <Correction key={k} c={c} />
                  ))}
                </li>
              );
            })}
          </ol>
          {loose.length > 0 && (
            <div className="grid gap-2">
              <p className="text-sm font-bold text-brand-deep">
                Other corrections
              </p>
              {loose.map((c, k) => (
                <Correction key={k} c={c} />
              ))}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

function Correction({ c }: { c: Debrief["corrections"][number] }) {
  return (
    <div className="grid gap-1 rounded-2xl border border-coral/30 bg-white px-3 py-2 text-sm">
      <p lang="en" className="flex flex-wrap items-center gap-1.5">
        <span className="rounded bg-coral-soft px-1.5 py-0.5 text-coral-dark line-through decoration-coral">
          {c.original}
        </span>
        <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
        <span className="rounded bg-brand-soft px-1.5 py-0.5 font-bold text-primary">
          {c.corrected}
        </span>
      </p>
      {c.explanation && (
        <p lang="fr" className="text-ink/80">
          {c.explanation}
        </p>
      )}
    </div>
  );
}

/** A transcript without debrief (too short, debrief failed). */
export function TranscriptOnly({
  transcript,
  aiName = "Partner",
}: {
  transcript: ConversationTurn[];
  aiName?: string;
}) {
  if (!transcript.length) return null;
  return (
    <ol className="grid gap-2">
      {transcript.map((t, i) => (
        <li
          key={i}
          lang="en"
          className={cn(
            "max-w-[88%] rounded-2xl px-3.5 py-2 text-[15px]",
            t.role === "user"
              ? "justify-self-end bg-brand-soft text-brand-deep"
              : "justify-self-start bg-muted text-ink",
          )}
        >
          <span className="sr-only">
            {t.role === "user" ? "You: " : `${aiName}: `}
          </span>
          {t.text}
        </li>
      ))}
    </ol>
  );
}
