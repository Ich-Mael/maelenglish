"use client";

import { useState } from "react";
import { Undo2, Wand2 } from "lucide-react";
import { btn, inputCls } from "@/components/admin/ui";
import { autoBlank, parseGaps, type CompleteWordsContent } from "@/lib/lab/types";
import { cn } from "cn";

/*
 * Complete the words editor (Labo, English): the paragraph with each cut word written
 * `destin[ations]`, « Blank automatically » (C-test rule: first sentence whole, then the second
 * half of every second word) and a live preview of what learners see. Sent as « c_text ».
 */
export function CompleteWordsEditor({ initial }: { initial: Partial<CompleteWordsContent> }) {
  const [text, setText] = useState(initial.text ?? "");
  const [before, setBefore] = useState<string | null>(null);
  const { lines, gaps } = parseGaps({ text, explanations: [] });
  const hasBrackets = gaps.length > 0;
  const plain = text.replace(/\[([^\]]*)\]/g, "$1");

  return (
    <section className="grid gap-3">
      <input type="hidden" name="c_text" value={text} />
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Paragraph (English), each cut word written with its missing letters in brackets</span>
        <textarea
          lang="en"
          className={cn(inputCls, "h-auto py-2 leading-relaxed")}
          rows={7}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Traveling to new destin[ations] has long been considered one of the most reward[ing] experiences a person can have."}
        />
        <span className="text-xs text-muted-foreground">
          <code>destin[ations]</code> = learners see « destin » and type « ations », one box per letter. One paragraph per line. Spelling must be exact (capitals ignored).
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={btn.secondary}
          disabled={!text.trim() || hasBrackets}
          onClick={() => {
            setBefore(text);
            setText(autoBlank(text));
          }}
          title={hasBrackets ? "Remove the brackets first (or use « Remove all cuts »)" : undefined}
        >
          <Wand2 className="size-4" aria-hidden /> Blank automatically
        </button>
        {hasBrackets && (
          <button type="button" className={btn.secondary} onClick={() => (setBefore(text), setText(plain))}>
            Remove all cuts
          </button>
        )}
        {before !== null && (
          <button type="button" className={btn.secondary} onClick={() => (setText(before), setBefore(null))}>
            <Undo2 className="size-4" aria-hidden /> Undo
          </button>
        )}
        <span className="text-xs text-muted-foreground">Automatic: the first sentence stays whole, then the second half of every second word is removed. Adjust by hand afterwards.</span>
      </div>

      {hasBrackets && (
        <div className="grid gap-2 rounded-2xl border border-border bg-muted/30 p-4">
          <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
            Learner preview · {gaps.length} word{gaps.length > 1 ? "s" : ""} to complete
          </p>
          {lines.map((line, li) => (
            <p key={li} lang="en" className="leading-[2.3] text-ink">
              {line.map((seg, si) =>
                seg.kind === "text" ? (
                  <span key={si}>{seg.text}</span>
                ) : (
                  <span key={si} className="mx-px inline-flex gap-0.5 align-middle" title={seg.gap.answers[0]}>
                    {seg.gap.answers[0].split("").map((_, k) => (
                      <span key={k} className="inline-block h-6 w-5 rounded border-2 border-b-[3px] border-primary/30 bg-white" />
                    ))}
                  </span>
                ),
              )}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
