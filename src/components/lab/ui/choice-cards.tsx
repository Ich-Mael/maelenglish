"use client";

import { Check, X } from "lucide-react";
import { cn } from "cn";

/*
 * Answer cards (catalogue « choice cards »: single select, big touch targets). After « Vérifier »,
 * `reveal` colours the right card green and a wrong pick red.
 */
export function ChoiceCards({
  options,
  value,
  onChange,
  reveal,
  labelledBy,
}: {
  options: { id: string; text: string }[];
  value: string | undefined;
  onChange: (id: string) => void;
  reveal?: { correctId: string } | null;
  labelledBy?: string;
}) {
  return (
    <div className="grid gap-2" role="radiogroup" aria-labelledby={labelledBy}>
      {options.map((o, i) => {
        const chosen = value === o.id;
        const right = reveal && o.id === reveal.correctId;
        const wrong = reveal && chosen && !right;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={chosen}
            disabled={!!reveal}
            onClick={() => onChange(o.id)}
            className={cn(
              "flex items-center gap-3 rounded-2xl border-2 border-b-4 px-4 py-3 text-left text-base transition",
              !reveal && (chosen ? "border-primary bg-brand-soft font-semibold text-brand-deep" : "border-border bg-card hover:border-primary/50"),
              right && "border-success bg-success/10 font-semibold text-success",
              wrong && "border-destructive/50 bg-destructive/5 text-destructive",
              reveal && !right && !wrong && "border-border bg-card text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-lg border-2 text-sm font-bold",
                right ? "border-success bg-success text-white" : wrong ? "border-destructive bg-destructive text-white" : chosen ? "border-primary bg-primary text-white" : "border-border text-muted-foreground",
              )}
              aria-hidden
            >
              {right ? <Check className="size-4" /> : wrong ? <X className="size-4" /> : String.fromCharCode(65 + i)}
            </span>
            <span className="min-w-0 flex-1">{o.text}</span>
          </button>
        );
      })}
    </div>
  );
}
