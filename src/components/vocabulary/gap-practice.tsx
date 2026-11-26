"use client";

import { useMemo, useState, useTransition } from "react";
import { Languages, Loader2, RefreshCw } from "lucide-react";
import { newGapPracticeAction, submitGapPracticeAction } from "@/app/(app)/gap-practice-actions";
import { GapsPlayer } from "@/components/lab/players/gaps-player";
import type { GapsContent } from "@/lib/lab/types";
import type { PublicPractice } from "@/lib/gap-practice";
import { cn } from "cn";

/*
 * Fill the gaps with my expressions (learner): the Lab fill-the-gaps player on an AI text made of
 * the learner's expressions. Word bank on by default (off = first letter only, harder); the French
 * translation after checking; « New practice » in The Vocabulary I Need.
 */

function Translation({ practice, open }: { practice: PublicPractice; open?: boolean }) {
  return (
    <details className="rounded-2xl border-2 border-border bg-white p-4 text-sm" open={open}>
      <summary className="flex cursor-pointer items-center gap-2 font-bold text-brand-deep">
        <Languages className="size-4 text-primary" aria-hidden /> French translation
      </summary>
      <div lang="fr" className="mt-2 grid gap-2 text-ink">
        {practice.lines.map((l, i) => (l.fr ? <p key={i}>{l.fr}</p> : null))}
      </div>
      {practice.words.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
          {practice.words.map((w) => (
            <li key={w.text} className="rounded-full bg-brand-soft px-2.5 py-1 text-xs text-brand-deep">
              <strong lang="en">{w.text}</strong>
              {w.translation && <span lang="fr"> · {w.translation}</span>}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

function NewPractice({ mode }: { mode: PublicPractice["mode"] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div className="grid justify-items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError("");
            const r = await newGapPracticeAction(mode);
            if (!r.ok) setError(r.error);
            else window.scrollTo({ top: 0, behavior: "smooth" });
          })
        }
        className="inline-flex h-11 items-center gap-2 rounded-xl border-2 border-primary/30 bg-white px-4 font-bold text-brand-deep hover:border-primary disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />} {pending ? "Writing a new text…" : mode === "story" ? "A new story" : "New sentences"}
      </button>
      {error && <p className="text-sm font-semibold text-coral-dark">{error}</p>}
    </div>
  );
}

export function GapPracticePlayer({ practice, backHref, renew, preview }: { practice: PublicPractice; backHref: string; renew?: boolean; preview?: boolean }) {
  const [bank, setBank] = useState(true);
  const content = useMemo<GapsContent>(() => ({ text: practice.lines.map((l) => l.en).join("\n"), explanations: practice.explanations, hint: bank ? "letters" : "first", wordBank: bank, distractors: [], typos: true }), [practice, bank]);
  return (
    <div className="grid gap-3">
      <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {practice.best != null ? (
            <>
              Your best: <strong className="text-brand-deep">{practice.best}%</strong> · {practice.tries} tr{practice.tries > 1 ? "ies" : "y"}
            </>
          ) : preview ? (
            "Coach preview: nothing is saved."
          ) : (
            "Your score is from your first check."
          )}
        </p>
        <button type="button" role="switch" aria-checked={bank} onClick={() => setBank((b) => !b)} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-deep">
          <span className={cn("relative h-6 w-11 rounded-full transition", bank ? "bg-primary" : "bg-muted-foreground/30")}>
            <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", bank ? "left-[1.375rem]" : "left-0.5")} />
          </span>
          Word bank {bank ? "on" : "off (harder)"}
        </button>
      </div>
      <GapsPlayer
        key={practice.id}
        title={practice.title || (practice.mode === "story" ? "A story at work" : "Expressions at work")}
        typeLabel={practice.mode === "story" ? "Fill the gaps · Story" : "Fill the gaps · Sentences"}
        instructions={practice.mode === "story" ? "Read the story and complete it with your expressions." : "Complete each sentence with one of your expressions."}
        content={content}
        courseHref={backHref}
        nextHref={backHref}
        submit={(answers) => submitGapPracticeAction(practice.id, answers)}
        feedbackExtra={<Translation practice={practice} />}
        resultsExtra={
          <div className="grid gap-3">
            <Translation practice={practice} open />
            {renew && <NewPractice mode={practice.mode} />}
          </div>
        }
      />
    </div>
  );
}
