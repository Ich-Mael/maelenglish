"use client";

import { useRef } from "react";
import type { Gap, GapHint, GapSegment } from "@/lib/lab/types";
import { cn } from "cn";

/*
 * A fill-the-gaps text: the lines with, in place of each answer, one input per word of the
 * expected answer. The blank shows the answer's shape (`hint`): « letters » = one dash per letter,
 * « first » = the same with the first letter as a clue, « words » = one box per word only.
 * Monospace + letter spacing: each typed letter lands on its dash.
 */

export type GapState = "idle" | "right" | "wrong";

const ADVANCE = 1.6; // ch per letter (1ch glyph + 0.6ch letter spacing)

export function GapText({
  lines,
  hint,
  values,
  states,
  disabled,
  onChange,
  onFocusGap,
}: {
  lines: GapSegment[][];
  hint: GapHint;
  values: Record<string, string[]>;
  states?: Record<string, GapState>;
  disabled?: boolean;
  onChange?: (gapId: string, words: string[]) => void;
  onFocusGap?: (gapId: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const inputs = () => [...(root.current?.querySelectorAll<HTMLInputElement>("input[data-gap]:not(:disabled)") ?? [])];
  const focusNext = (el: HTMLInputElement) => {
    const all = inputs();
    all[all.indexOf(el) + 1]?.focus();
  };

  return (
    <div ref={root} lang="en" className="grid gap-4 text-lg leading-[2.6] text-ink">
      {lines.map((line, li) => (
        <p key={li}>
          {line.map((seg, si) =>
            seg.kind === "text" ? (
              <span key={si}>{seg.text}</span>
            ) : (
              <Blank
                key={si}
                gap={seg.gap}
                hint={hint}
                words={values[seg.gap.id] ?? []}
                state={states?.[seg.gap.id] ?? "idle"}
                disabled={disabled || states?.[seg.gap.id] === "right"}
                onChange={(w) => onChange?.(seg.gap.id, w)}
                onFocus={() => onFocusGap?.(seg.gap.id)}
                onNext={focusNext}
              />
            ),
          )}
        </p>
      ))}
    </div>
  );
}

function Blank({
  gap,
  hint,
  words,
  state,
  disabled,
  onChange,
  onFocus,
  onNext,
}: {
  gap: Gap;
  hint: GapHint;
  words: string[];
  state: GapState;
  disabled?: boolean;
  onChange: (words: string[]) => void;
  onFocus: () => void;
  onNext: (el: HTMLInputElement) => void;
}) {
  const shape = gap.answers[0].split(" ");
  const letters = shape.reduce((n, w) => n + w.length, 0);
  const label = `Blank ${gap.index + 1}: ${shape.length > 1 ? `${shape.length} words, ` : ""}${letters} letter${letters > 1 ? "s" : ""}`;
  const set = (i: number, v: string) => {
    const next = shape.map((_, k) => (k === i ? v : (words[k] ?? "")));
    onChange(next);
  };
  return (
    <span role="group" aria-label={label} className="mx-0.5 inline-flex flex-wrap items-baseline gap-x-2 align-baseline">
      {shape.map((w, i) => {
        const n = hint === "words" ? Math.max(4, w.length) : w.length;
        const slots = hint !== "words";
        return (
          <input
            key={i}
            data-gap={gap.id}
            value={words[i] ?? ""}
            disabled={disabled}
            aria-label={shape.length > 1 ? `${label} — word ${i + 1}` : label}
            aria-invalid={state === "wrong" || undefined}
            placeholder={hint === "first" ? w[0] : undefined}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            maxLength={w.length + 6}
            onFocus={onFocus}
            onChange={(e) => {
              const v = e.target.value;
              // A space ends the word: move on to the blank's next word (or the next blank).
              if (v.endsWith(" ") && i < shape.length - 1) {
                set(i, v.trim());
                onNext(e.target);
                return;
              }
              set(i, shape.length > 1 ? v.replace(/\s+/g, "") : v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onNext(e.currentTarget);
              }
            }}
            style={{
              width: `calc(${n * ADVANCE}ch + 0.5ch)`,
              letterSpacing: slots ? `${ADVANCE - 1}ch` : undefined,
              backgroundImage: slots ? `repeating-linear-gradient(to right, currentColor 0 1.2ch, transparent 1.2ch ${ADVANCE}ch)` : undefined,
              backgroundSize: slots ? `${n * ADVANCE}ch 2px` : undefined,
              backgroundPosition: slots ? "0.15ch calc(100% - 4px)" : undefined,
              backgroundRepeat: "no-repeat",
            }}
            className={cn(
              "h-11 rounded-lg border-2 px-0 pl-[0.35ch] font-mono text-lg leading-none font-bold outline-none transition-colors placeholder:text-primary/40 focus:border-primary focus:bg-white disabled:cursor-default",
              state === "right" ? "border-primary/50 bg-brand-soft text-primary" : state === "wrong" ? "border-coral bg-coral-soft text-coral-dark" : "border-border bg-brand-soft/50 text-brand-deep",
              !slots && "px-2",
            )}
          />
        );
      })}
    </span>
  );
}
