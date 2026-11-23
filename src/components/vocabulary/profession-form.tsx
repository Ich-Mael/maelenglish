"use client";

import { useState, useTransition } from "react";
import { Briefcase, Loader2, Pencil } from "lucide-react";
import { setProfessionAction } from "@/app/(app)/vocabulary-actions";

/** The learner's job or field of study (asked once, editable): drives « my daily vocabulary ». */
export function ProfessionForm({ initial }: { initial: string }) {
  const [editing, setEditing] = useState(!initial);
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  if (!editing) {
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm text-ink/80">
        <Briefcase className="size-4 text-primary" aria-hidden /> Your field: <strong className="text-brand-deep">{initial}</strong>
        <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-primary hover:bg-brand-soft">
          <Pencil className="size-3.5" aria-hidden /> Change
        </button>
      </p>
    );
  }
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        start(async () => {
          const r = await setProfessionAction(value);
          if (!r.ok) setError(r.error);
          else setEditing(false);
        });
      }}
    >
      <label className="grid gap-1.5">
        <span className="text-sm font-semibold text-brand-deep">What is your job or field of study?</span>
        <span className="flex gap-2">
          <input value={value} onChange={(e) => setValue(e.target.value)} maxLength={120} required placeholder="e.g. nurse, accountant, air traffic controller, law student…" className="h-11 min-w-0 flex-1 rounded-xl border-2 border-border bg-white px-3 text-base outline-none focus:border-primary" />
          <button type="submit" disabled={pending} className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 font-bold text-white hover:brightness-110 disabled:opacity-60">
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />} Save
          </button>
        </span>
      </label>
      <p className="text-xs text-muted-foreground">You can write it in French or English. You get 2 useful words for it every day.</p>
      {error && <p className="text-sm font-semibold text-coral-dark">{error}</p>}
    </form>
  );
}
