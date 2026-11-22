"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { WritingCorrection, WritingError } from "@/lib/ai/types";
import { btn, inputCls } from "./ui";
import { cn } from "cn";

/*
 * Coach review of a writing task (admin, English UI; the feedback itself is in French for the
 * learner): the AI correction draft, fully editable — score, summary, strengths, each error (edit,
 * delete, add), checklist (met / comment), corrected text. Sent as JSON in the hidden « feedback »
 * field of the review form (cleaned on the server by `cleanFeedback`).
 */

const empty: WritingCorrection = { score: 70, summary: "", strengths: [], errors: [], checklist: [], corrected: "" };

export function WritingFeedbackEditor({ initial, checklist }: { initial: WritingCorrection | null; checklist: string[] }) {
  const base = initial ?? { ...empty, checklist: checklist.map((item) => ({ item, met: false, comment: "" })) };
  const [score, setScore] = useState(base.score);
  const [summary, setSummary] = useState(base.summary);
  const [strengths, setStrengths] = useState(base.strengths.join("\n"));
  const [errors, setErrors] = useState<WritingError[]>(base.errors);
  const [items, setItems] = useState(base.checklist);
  const [corrected, setCorrected] = useState(base.corrected);

  const feedback: WritingCorrection = {
    score,
    summary,
    strengths: strengths.split("\n").map((s) => s.trim()).filter(Boolean),
    errors: errors.filter((e) => e.quote.trim() || e.correction.trim()),
    checklist: items,
    corrected,
  };
  const setError = (i: number, patch: Partial<WritingError>) => setErrors((list) => list.map((e, k) => (k === i ? { ...e, ...patch } : e)));

  return (
    <div className="grid gap-4">
      <input type="hidden" name="feedback" value={JSON.stringify(feedback)} />
      {!initial && <p className="rounded-xl bg-coral-soft/60 px-3 py-2 text-sm text-coral-dark">No AI draft for this version (the correction service failed or isn&apos;t configured): write the corrections yourself.</p>}

      <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
        <label className="grid content-start gap-1 text-sm">
          <span className="font-medium">Score / 100</span>
          <input type="number" min={0} max={100} className={inputCls} value={score} onChange={(e) => setScore(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} />
        </label>
        <label className="grid content-start gap-1 text-sm">
          <span className="font-medium">Summary (French)</span>
          <textarea className={cn(inputCls, "h-auto py-2")} rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} />
        </label>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Strengths (French, one per line)</span>
        <textarea className={cn(inputCls, "h-auto py-2")} rows={3} value={strengths} onChange={(e) => setStrengths(e.target.value)} />
      </label>

      <div className="grid gap-2">
        <span className="text-sm font-medium">Corrections ({errors.length})</span>
        {errors.map((e, i) => (
          <div key={i} className="grid gap-2 rounded-xl border border-border p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="grid gap-1 text-xs">
                <span className="font-semibold text-coral-dark">Learner wrote</span>
                <input lang="en" className={inputCls} value={e.quote} onChange={(ev) => setError(i, { quote: ev.target.value })} />
              </label>
              <label className="grid gap-1 text-xs">
                <span className="font-semibold text-primary">Correction</span>
                <input lang="en" className={inputCls} value={e.correction} onChange={(ev) => setError(i, { correction: ev.target.value })} />
              </label>
            </div>
            <div className="flex items-end gap-2">
              <label className="grid flex-1 gap-1 text-xs">
                <span className="font-semibold">Explanation (French)</span>
                <input className={inputCls} value={e.explanation} onChange={(ev) => setError(i, { explanation: ev.target.value })} />
              </label>
              <button type="button" className={btn.icon} onClick={() => setErrors((list) => list.filter((_, k) => k !== i))} aria-label="Delete this correction" title="Delete">
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          </div>
        ))}
        <button type="button" className={cn(btn.secondary, "w-fit")} onClick={() => setErrors((list) => [...list, { quote: "", correction: "", explanation: "" }])}>
          <Plus className="size-4" aria-hidden /> Add a correction
        </button>
      </div>

      {items.length > 0 && (
        <div className="grid gap-2">
          <span className="text-sm font-medium">Checklist</span>
          {items.map((c, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[auto_1fr] sm:items-center">
              <label className="flex items-center gap-2 text-sm font-semibold text-brand-deep">
                <input type="checkbox" className="size-4 accent-primary" checked={c.met} onChange={(e) => setItems((list) => list.map((x, k) => (k === i ? { ...x, met: e.target.checked } : x)))} />
                {c.item}
              </label>
              <input className={inputCls} value={c.comment} placeholder="Comment (French)" onChange={(e) => setItems((list) => list.map((x, k) => (k === i ? { ...x, comment: e.target.value } : x)))} />
            </div>
          ))}
        </div>
      )}

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Corrected text (English)</span>
        <textarea lang="en" className={cn(inputCls, "h-auto py-2 leading-relaxed")} rows={7} value={corrected} onChange={(e) => setCorrected(e.target.value)} />
      </label>
    </div>
  );
}
