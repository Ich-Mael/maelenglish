"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { ListenButton } from "./speak";
import { cn } from "cn";

/** Programme page phrase: listen to it, guess the meaning, tap to reveal the translation. */
export function PhraseFlip({ role, en, fr }: { role: string; en: string; fr: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="flex flex-col rounded-3xl border-2 border-border bg-card p-5 shadow-[0_14px_34px_-18px_rgb(21_26_51/0.35)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-bold tracking-wide text-coral-dark uppercase">{role}</span>
        <ListenButton text={en} />
      </div>
      <p lang="en" className="font-heading text-lg font-bold text-brand-deep">
        “{en}”
      </p>
      <div className="mt-auto pt-4">
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-expanded={shown}
          className={cn(
            "flex w-full items-center gap-2 rounded-2xl border-2 border-dashed px-3.5 py-2.5 text-left text-sm transition",
            shown ? "border-success/40 bg-success/5 text-ink" : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary",
          )}
        >
          {shown ? (
            <span className="animate-pop">{fr}</span>
          ) : (
            <>
              <Eye className="size-4 shrink-0" aria-hidden /> Devinez le sens, puis touchez pour vérifier
            </>
          )}
        </button>
      </div>
    </div>
  );
}
