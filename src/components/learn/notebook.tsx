"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Layers, RotateCcw, Search, Trash2, Volume2, X } from "lucide-react";
import type { WordEntry } from "@/lib/dictionary";
import { removeWordAction, reviewWordAction } from "@/app/(app)/dictionary-actions";
import { playPronunciation, useVoice } from "./word-card";
import { cn } from "cn";

/*
 * « My Notebook » (English UI, owner decision 2026-11-22): the learner's saved words (translation,
 * the sentence where they met it, a link back to that step), filters « To review / Known », delete;
 * « Review » = flashcards one by one (word + audio → show the translation → « I knew it » / « Not yet »).
 */

export type NotebookWord = { word: string; context: string; translation: string; href: string | null; known: boolean; reviews: number; addedAt: string; entry: WordEntry | null };

export function Notebook({ words }: { words: NotebookWord[] }) {
  const router = useRouter();
  const audio = useRef<HTMLAudioElement>(null);
  const voice = useVoice();
  const [filter, setFilter] = useState<"all" | "learning" | "known">("all");
  const [list, setList] = useState(words);
  const [review, setReview] = useState<{ queue: NotebookWord[]; index: number; reveal: boolean; known: number } | null>(null);
  const [, start] = useTransition();

  const shown = list.filter((w) => (filter === "all" ? true : filter === "known" ? w.known : !w.known));
  const counts = { all: list.length, learning: list.filter((w) => !w.known).length, known: list.filter((w) => w.known).length };

  const remove = (word: string) => {
    setList((l) => l.filter((w) => w.word !== word));
    start(async () => {
      await removeWordAction(word);
    });
  };
  const startReview = () => {
    const toLearn = list.filter((w) => !w.known);
    const queue = (toLearn.length ? toLearn : list).slice(0, 20);
    setReview({ queue, index: 0, reveal: false, known: 0 });
  };
  const answer = (known: boolean) => {
    if (!review) return;
    const w = review.queue[review.index];
    setList((l) => l.map((x) => (x.word === w.word ? { ...x, known, reviews: x.reviews + 1 } : x)));
    start(async () => {
      await reviewWordAction(w.word, known);
    });
    setReview({ ...review, index: review.index + 1, reveal: false, known: review.known + (known ? 1 : 0) });
  };

  if (!list.length) {
    return (
      <div className="grid justify-items-center gap-3 rounded-3xl border-2 border-dashed border-border p-8 text-center">
        <p className="font-heading text-lg font-extrabold text-brand-deep">Your notebook is empty</p>
        <p className="max-w-md text-sm text-muted-foreground">In a lesson or an activity, long-press (or double-click) an English word, then « Add to my notebook ». You can also look a word up in the dictionary.</p>
        <Link href="/dictionnaire" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white">
          <Search className="size-4" aria-hidden /> Open the dictionary
        </Link>
      </div>
    );
  }

  // Flashcards.
  if (review) {
    const done = review.index >= review.queue.length;
    const w = review.queue[review.index];
    return (
      <div className="mx-auto grid w-full max-w-md gap-4">
        <audio ref={audio} preload="none" />
        <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
          <span>{done ? "Done" : `Word ${review.index + 1} of ${review.queue.length}`}</span>
          <button type="button" onClick={() => (setReview(null), router.refresh())} className="inline-flex items-center gap-1 text-primary">
            <X className="size-4" aria-hidden /> Exit
          </button>
        </div>
        {done ? (
          <div className="grid justify-items-center gap-3 rounded-3xl bg-gradient-to-br from-primary to-brand-deep p-8 text-center text-white">
            <p className="font-heading text-4xl font-extrabold">
              {review.known} / {review.queue.length}
            </p>
            <p>words you already knew. The others stay « to review ».</p>
            <div className="flex gap-2">
              <button type="button" onClick={startReview} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-4 font-bold text-brand-deep">
                <RotateCcw className="size-4" aria-hidden /> Again
              </button>
              <button type="button" onClick={() => (setReview(null), router.refresh())} className="h-11 rounded-2xl border-2 border-white/50 px-4 font-semibold">
                My Notebook
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 rounded-3xl border-2 border-border bg-card p-6 text-center">
            <div className="grid justify-items-center gap-2">
              <p lang="en" className="font-heading text-3xl font-extrabold text-brand-deep">
                {w.word}
              </p>
              {w.entry?.phonetic && (
                <p lang="en" className="text-sm text-muted-foreground">
                  {w.entry.phonetic}
                </p>
              )}
              <button type="button" onClick={() => playPronunciation(audio.current, { word: w.word, audioUrl: w.entry?.audioUrl ?? "", voices: !!w.entry?.voices }, { voice })} className="flex size-11 items-center justify-center rounded-full bg-brand-soft text-primary" aria-label={`Listen to "${w.word}"`}>
                <Volume2 className="size-5" aria-hidden />
              </button>
              {w.context && (
                <p lang="en" className="text-sm text-muted-foreground italic">
                  « {w.context} »
                </p>
              )}
            </div>
            {review.reveal ? (
              <>
                <div className="grid gap-1 rounded-2xl bg-brand-soft/60 p-4">
                  <p className="font-heading text-2xl font-extrabold text-coral">{w.translation || "—"}</p>
                  {w.entry?.meanings[0]?.definitions[0] && (
                    <p lang="en" className="text-sm text-ink">
                      {w.entry.meanings[0].definitions[0].definition}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => answer(false)} className="h-12 rounded-2xl border-2 border-coral bg-white font-bold text-coral-dark">
                    Not yet
                  </button>
                  <button type="button" onClick={() => answer(true)} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary font-bold text-white shadow-[0_4px_0_0_var(--color-brand-dark)]">
                    <Check className="size-4" aria-hidden /> I knew it
                  </button>
                </div>
              </>
            ) : (
              <button type="button" onClick={() => setReview({ ...review, reveal: true })} className="h-12 rounded-2xl bg-primary font-bold text-white shadow-[0_4px_0_0_var(--color-brand-dark)]">
                Show the translation
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <audio ref={audio} preload="none" />
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["all", "All"],
            ["learning", "To review"],
            ["known", "Known"],
          ] as const
        ).map(([v, label]) => (
          <button key={v} type="button" onClick={() => setFilter(v)} aria-pressed={filter === v} className={cn("rounded-full px-3 py-1.5 text-sm font-semibold", filter === v ? "bg-primary text-white" : "bg-card text-brand-deep ring-1 ring-border hover:bg-brand-soft")}>
            {label} <span className="opacity-70">{counts[v]}</span>
          </button>
        ))}
        <button type="button" onClick={startReview} className="ml-auto inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-brand-deep px-4 text-sm font-bold text-white">
          <Layers className="size-4" aria-hidden /> Review
        </button>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {shown.map((w) => (
          <li key={w.word} className="grid gap-1 rounded-2xl border-2 border-border bg-card p-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span lang="en" className="font-heading text-lg font-extrabold text-brand-deep">
                    {w.word}
                  </span>
                  <span lang="fr" className="font-semibold text-coral">{w.translation}</span>
                </p>
                {w.context && (
                  <p lang="en" className="line-clamp-2 text-sm text-muted-foreground italic">
                    « {w.context} »
                  </p>
                )}
              </div>
              <button type="button" onClick={() => playPronunciation(audio.current, { word: w.word, audioUrl: w.entry?.audioUrl ?? "", voices: !!w.entry?.voices }, { voice })} className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-primary" aria-label={`Listen to "${w.word}"`}>
                <Volume2 className="size-4" aria-hidden />
              </button>
              <button type="button" onClick={() => remove(w.word)} className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-coral-soft hover:text-coral-dark" aria-label={`Remove "${w.word}" from the notebook`}>
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {w.known ? <span className="rounded-full bg-gradient-to-r from-primary to-brand-deep px-2 py-0.5 font-bold text-white">Known</span> : <span className="rounded-full border border-coral bg-white px-2 py-0.5 font-bold text-coral-dark">To review</span>}
              {w.href && (
                <Link href={w.href} className="font-semibold text-primary hover:underline">
                  See in the lesson
                </Link>
              )}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
