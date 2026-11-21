"use client";

import { useMemo, useState } from "react";
import { inputCls } from "@/components/admin/ui";
import { parseGaps, type GapHint, type GapsContent } from "@/lib/lab/types";
import { GapText } from "./ui/gap-text";
import { cn } from "cn";

/*
 * Fill the gaps — admin editor (English). Staff type the text with each answer in [square
 * brackets] (alternatives with « | »); the blanks are detected live, each gets an optional French
 * explanation, and a preview shows them as learners will. Sent as JSON in « c_json ».
 */

const HINTS: { value: GapHint; label: string; hint: string }[] = [
  { value: "letters", label: "Words and letters", hint: "One box per word, one dash per letter." },
  { value: "first", label: "Words, letters and first letter", hint: "The same, with each word's first letter as a clue." },
  { value: "words", label: "Words only", hint: "One box per word, without the number of letters (harder)." },
];

export function GapsEditor({ initial }: { initial: Partial<GapsContent> }) {
  const [text, setText] = useState(initial.text ?? "");
  const [explanations, setExplanations] = useState<string[]>(initial.explanations ?? []);
  const [hint, setHint] = useState<GapHint>(initial.hint ?? "letters");
  const [wordBank, setWordBank] = useState(initial.wordBank ?? false);
  const [distractors, setDistractors] = useState((initial.distractors ?? []).join(", "));
  const [typos, setTypos] = useState(initial.typos ?? true);

  const { lines, gaps } = useMemo(() => parseGaps({ text, explanations }), [text, explanations]);
  const json = JSON.stringify({ text, explanations: gaps.map((_, i) => explanations[i] ?? ""), hint, wordBank, distractors: distractors.split(","), typos });
  const empty = {}; // preview: empty blanks, as learners first see them

  return (
    <div className="grid gap-4 rounded-2xl border border-border p-4">
      <input type="hidden" name="c_json" value={json} />
      <h3 className="font-bold text-brand-deep">Text</h3>

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Text with the answers in [square brackets]</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          lang="en"
          spellCheck
          className={cn(inputCls, "h-auto min-h-36 py-2 font-mono text-sm leading-relaxed")}
          placeholder={"I [am] the new sales manager.\nThis [is] my colleague, Fatou.\nWe [are] from the Ouagadougou office.\nI [am|'m] happy to [meet you]."}
        />
        <span className="text-xs text-muted-foreground">
          In English. One sentence or paragraph per line. Alternatives with « | »: <code>[am|&apos;m]</code> — the first one sets the blank&apos;s shape and is the answer shown. Capitals, punctuation and contractions are ignored when checking.
        </span>
      </label>

      {gaps.length > 0 ? (
        <div className="grid gap-2">
          <p className="text-sm font-medium">
            {gaps.length} blank{gaps.length > 1 ? "s" : ""} · explanation shown when the answer is wrong (French, optional)
          </p>
          <ol className="grid gap-2">
            {gaps.map((g, i) => (
              <li key={g.id} className="grid items-center gap-2 sm:grid-cols-[minmax(0,14rem)_1fr]">
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-brand-soft text-xs font-bold text-primary">{i + 1}</span>
                  <span lang="en" className="truncate font-semibold text-brand-deep">
                    {g.answers.join(" / ")}
                  </span>
                </span>
                <input
                  value={explanations[i] ?? ""}
                  onChange={(e) => setExplanations((x) => Object.assign([...x], { [i]: e.target.value }))}
                  placeholder="E.g. I + am."
                  aria-label={`Explanation for blank ${i + 1}`}
                  className={inputCls}
                />
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="rounded-xl bg-muted/50 px-3 py-2 text-sm text-muted-foreground">No blank yet: put each answer in [square brackets].</p>
      )}

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">What each blank shows</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {HINTS.map((h) => (
            <label key={h.value} className={cn("cursor-pointer rounded-xl border-2 p-3 text-sm", hint === h.value ? "border-primary bg-brand-soft/60" : "border-border")}>
              <input type="radio" name="gap-hint" value={h.value} checked={hint === h.value} onChange={() => setHint(h.value)} className="sr-only" />
              <span className="block font-semibold text-brand-deep">{h.label}</span>
              <span className="text-xs text-muted-foreground">{h.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" checked={wordBank} onChange={(e) => setWordBank(e.target.checked)} className="mt-0.5 size-4 accent-primary" />
        <span>
          <span className="font-medium">Word bank</span>
          <span className="block text-xs text-muted-foreground">The answers are shown as words to tap (easier, good for A1–A2).</span>
        </span>
      </label>
      {wordBank && (
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Extra wrong words (optional)</span>
          <input value={distractors} onChange={(e) => setDistractors(e.target.value)} placeholder="E.g. be, were" className={inputCls} lang="en" />
          <span className="text-xs text-muted-foreground">Comma-separated, mixed with the answers.</span>
        </label>
      )}
      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" checked={typos} onChange={(e) => setTypos(e.target.checked)} className="mt-0.5 size-4 accent-primary" />
        <span>
          <span className="font-medium">Accept one typo</span>
          <span className="block text-xs text-muted-foreground">In answers of 4 letters or more (e.g. « manger » for « manager »). Untick for spelling practice.</span>
        </span>
      </label>

      {gaps.length > 0 && (
        <div className="rounded-xl bg-muted/40 p-4">
          <p className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">Preview</p>
          <GapText lines={lines} hint={hint} values={empty} disabled />
        </div>
      )}
    </div>
  );
}
