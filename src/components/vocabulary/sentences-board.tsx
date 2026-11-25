"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, PenLine, Trash2, X } from "lucide-react";
import { deleteSentenceAction, writeSentenceAction } from "@/app/(app)/vocabulary-actions";
import type { SentenceCheck } from "@/lib/ai/types";
import { ShadowingModal } from "@/components/shadowing/listen";
import { ShadowList } from "@/components/shadowing/list";
import { SHADOW_GOAL } from "@/lib/shadowing";
import { cn } from "cn";

/*
 * « My own sentences »: pick a word from the notebook, write a sentence with it, get the AI's
 * correction at once (corrected sentence + French explanation). Correct sentences come back as
 * « fill the blank » questions in the tests.
 */

export type WordWithSentences = { word: string; translation: string; sentences: { id: string; text: string; corrected: string; ok: boolean; explanation: string }[] };

export function SentencesBoard({ words, initialWord }: { words: WordWithSentences[]; initialWord?: string }) {
  const [word, setWord] = useState(initialWord && words.some((w) => w.word === initialWord) ? initialWord : (words[0]?.word ?? ""));
  const [text, setText] = useState("");
  const [result, setResult] = useState<(SentenceCheck & { text: string }) | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const current = words.find((w) => w.word === word);

  return (
    <div className="grid gap-5">
      <form
        className="grid gap-3 rounded-[2rem] border-2 border-primary/15 bg-card p-5 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          setResult(null);
          start(async () => {
            const r = await writeSentenceAction(word, text);
            if (!r.ok) return setError(r.error);
            setResult({ ...r.result, text });
            setText("");
          });
        }}
      >
        <label className="grid gap-1.5">
          <span className="text-sm font-semibold text-brand-deep">Word</span>
          <select value={word} onChange={(e) => setWord(e.target.value)} className="h-11 rounded-xl border-2 border-border bg-white px-3 text-base">
            {words.map((w) => (
              <option key={w.word} value={w.word}>
                {w.word}
                {w.translation ? ` — ${w.translation}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-semibold text-brand-deep">Your sentence (about your work or your life)</span>
          <textarea lang="en" value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={300} required placeholder={word ? `Write a sentence with « ${word} »…` : ""} className="rounded-xl border-2 border-border bg-white px-3 py-2 text-base outline-none focus:border-primary" />
        </label>
        <button type="submit" disabled={pending || !text.trim() || !word} className="inline-flex h-11 w-fit items-center gap-2 rounded-xl bg-primary px-5 font-bold text-white hover:brightness-110 disabled:opacity-50">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <PenLine className="size-4" aria-hidden />} Check my sentence
        </button>
        {error && <p className="text-sm font-semibold text-coral-dark">{error}</p>}
        {result && <Feedback r={result} />}
      </form>

      {current && current.sentences.length > 0 && (
        <section className="grid gap-2">
          <h2 className="font-heading text-lg font-extrabold text-brand-deep">
            Your sentences with « <span lang="en">{current.word}</span> »
          </h2>
          <ul className="grid gap-2">
            {[...current.sentences].reverse().map((s) => (
              <SentenceRow key={s.id} word={current.word} s={s} />
            ))}
          </ul>
          <ShadowingModal title={current.word} count={current.sentences.length} kicker="Your sentences" intro={`Listen to each of your sentences (corrected when needed) and say it the same way: reach ${SHADOW_GOAL}% to master it.`}>
            <ShadowList items={[...current.sentences].reverse().map((s, k, all) => ({ id: s.id, label: `Sentence ${all.length - k}`, text: s.ok || !s.corrected ? s.text : s.corrected, src: `/api/vocabulary/sentence-audio?${new URLSearchParams({ word: current.word, id: s.id })}` }))} />
          </ShadowingModal>
        </section>
      )}

      <section className="grid gap-2">
        <h2 className="font-heading text-lg font-extrabold text-brand-deep">All your words</h2>
        <ul className="flex flex-wrap gap-2">
          {words.map((w) => (
            <li key={w.word}>
              <button type="button" onClick={() => setWord(w.word)} lang="en" className={cn("rounded-full border-2 px-3 py-1 text-sm font-semibold", w.word === word ? "border-primary bg-primary text-white" : "border-border bg-white text-brand-deep hover:border-primary/40")}>
                {w.word} <span className={cn("ml-1 text-xs", w.word === word ? "text-white/80" : "text-muted-foreground")}>{w.sentences.length}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Feedback({ r }: { r: SentenceCheck & { text: string } }) {
  return (
    <div role="status" className={cn("grid gap-1.5 rounded-2xl border-2 p-4", r.ok ? "border-primary/30 bg-brand-soft" : "border-coral/40 bg-coral-soft")}>
      <p className={cn("flex items-center gap-2 font-heading text-lg font-extrabold", r.ok ? "text-primary" : "text-coral-dark")}>
        {r.ok ? <Check className="size-5" aria-hidden /> : <X className="size-5" aria-hidden />} {r.ok ? "Well done!" : "Almost there"}
      </p>
      {!r.ok && (
        <p lang="en" className="text-ink">
          <span className="text-muted-foreground line-through">{r.text}</span>
          <br />
          <strong className="text-primary">{r.corrected}</strong>
        </p>
      )}
      <p lang="fr" className="text-sm text-ink/80">
        {r.explanation}
      </p>
    </div>
  );
}

function SentenceRow({ word, s }: { word: string; s: WordWithSentences["sentences"][number] }) {
  const [gone, setGone] = useState(false);
  const [pending, start] = useTransition();
  if (gone) return null;
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-border bg-white p-3">
      <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full", s.ok ? "bg-gradient-to-br from-primary to-brand-deep text-white" : "border-2 border-coral bg-white text-coral-dark")}>{s.ok ? <Check className="size-3.5" aria-hidden /> : <X className="size-3.5" aria-hidden />}</span>
      <div className="min-w-0 flex-1 text-sm">
        <p lang="en" className="font-semibold text-brand-deep">
          {s.ok ? s.text : s.corrected}
        </p>
        {!s.ok && (
          <p lang="en" className="text-muted-foreground line-through">
            {s.text}
          </p>
        )}
        <p lang="fr" className="text-ink/70">
          {s.explanation}
        </p>
      </div>
      <button type="button" disabled={pending} onClick={() => start(async () => void ((await deleteSentenceAction(word, s.id)).ok && setGone(true)))} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label="Delete this sentence">
        <Trash2 className="size-4" aria-hidden />
      </button>
    </li>
  );
}
