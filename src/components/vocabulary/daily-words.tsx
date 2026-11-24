"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, PenLine, Plus, Volume2 } from "lucide-react";
import { saveDailyWordAction } from "@/app/(app)/vocabulary-actions";
import { playPronunciation, synth, useVoice } from "@/components/learn/word-card";
import type { DailyWord } from "@/lib/ai/types";

/** Daily words for the learner's profession: hear it, French meaning, note, two examples at work (with French), « Add to my notebook », « Write my own sentence ». */
export function DailyWords({ words }: { words: (DailyWord & { saved: boolean })[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {words.map((w) => (
        <WordTile key={w.word} w={w} />
      ))}
    </ul>
  );
}

export function WordTile({ w }: { w: DailyWord & { saved: boolean } }) {
  const [saved, setSaved] = useState(w.saved);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [going, go] = useTransition();
  const router = useRouter();
  const audio = useRef<HTMLAudioElement>(null);
  const voice = useVoice();
  // The word and its examples: a natural voice (Azure, else ElevenLabs — made once, shared); the browser's voice if unavailable.
  const speakWord = () => playPronunciation(audio.current, { word: w.word, audioUrl: "", voices: true }, { voice });
  const speakText = (k: number, text: string) => {
    const el = audio.current;
    if (!el) return synth(text, voice, false);
    let fellBack = false;
    const fallback = () => {
      if (fellBack) return;
      fellBack = true;
      el.onerror = null;
      synth(text, voice, false);
    };
    el.onerror = fallback;
    el.src = `/api/vocabulary/audio?${new URLSearchParams({ word: w.word, i: String(k), voice })}`;
    void el.play().catch((err: Error) => err.name !== "AbortError" && fallback());
  };
  const add = async () => {
    const r = await saveDailyWordAction(w.word);
    if (!r.ok) {
      setError(r.error);
      return false;
    }
    setSaved(true);
    return true;
  };
  const examples = w.examples?.length ? w.examples : w.example ? [{ en: w.example, fr: "" }] : [];
  return (
    <li className="grid content-start gap-2.5 rounded-2xl border-2 border-primary/15 bg-white p-4">
      <audio ref={audio} preload="none" className="hidden" />
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p lang="en" className="font-heading text-2xl font-extrabold text-brand-deep">
            {w.word}
          </p>
          <p lang="fr" className="text-lg font-bold text-coral-dark">
            {w.translation}
          </p>
        </div>
        <button type="button" onClick={speakWord} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-primary hover:bg-primary hover:text-white" aria-label={`Hear « ${w.word} »`}>
          <Volume2 className="size-5" aria-hidden />
        </button>
      </div>
      <p lang="fr" className="text-sm text-ink/75">
        {w.frNote}
      </p>
      <div className="grid gap-2 rounded-xl bg-muted/50 p-3">
        <p className="text-xs font-bold tracking-wide text-primary uppercase">At work</p>
        <ol className="grid gap-2">
          {examples.map((e, k) => (
            <li key={k} className="flex gap-2 text-sm">
              <button type="button" onClick={() => speakText(k, e.en)} className="mt-0.5 shrink-0 text-primary" aria-label={`Hear example ${k + 1}`}>
                <Volume2 className="size-4" aria-hidden />
              </button>
              <span>
                <span lang="en" className="block text-ink">
                  {e.en}
                </span>
                {e.fr && (
                  <span lang="fr" className="block text-muted-foreground italic">
                    {e.fr}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {saved ? (
          <p className="inline-flex h-10 items-center gap-1.5 px-1 text-sm font-bold text-primary">
            <Check className="size-4" aria-hidden /> In your notebook
          </p>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => start(async () => void (await add()))}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border-2 border-coral bg-white px-3.5 text-sm font-bold text-coral-dark shadow-[0_3px_0_0_var(--color-coral)] hover:bg-coral-soft active:translate-y-0.5 active:shadow-none disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />} Add to my notebook
          </button>
        )}
        {/* Straight to « My own sentences » on this word (added to the notebook first if needed). */}
        <button
          type="button"
          disabled={going}
          onClick={() =>
            go(async () => {
              if (saved || (await add())) router.push(`/vocabulaire/phrases?mot=${encodeURIComponent(w.word)}`);
            })
          }
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border-2 border-primary/25 bg-white px-3.5 text-sm font-bold text-primary hover:bg-brand-soft disabled:opacity-60"
        >
          {going ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <PenLine className="size-4" aria-hidden />} Write my own sentence
        </button>
      </div>
      {error && <p className="text-sm text-coral-dark">{error}</p>}
    </li>
  );
}

const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** Words of the last days the learner hasn't added yet (e.g. after 2 days away), folded by default. */
export function MissedWords({ groups }: { groups: { day: string; words: DailyWord[] }[] }) {
  const n = groups.reduce((k, g) => k + g.words.length, 0);
  if (!n) return null;
  return (
    <details className="group/missed rounded-2xl border-2 border-dashed border-primary/25 bg-brand-soft/30">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-2xl px-4 py-3 font-bold text-brand-deep hover:bg-brand-soft/60 [&::-webkit-details-marker]:hidden">
        <span className="flex size-7 items-center justify-center rounded-full border-2 border-coral bg-white text-sm font-extrabold text-coral-dark">{n}</span>
        <span className="flex-1">
          You missed {n} word{n === 1 ? "" : "s"} these last days
        </span>
        <span className="text-xs font-semibold text-muted-foreground">
          <span className="group-open/missed:hidden">Show</span>
          <span className="hidden group-open/missed:inline">Hide</span>
        </span>
      </summary>
      <div className="grid gap-4 px-4 pb-4">
        {groups.map((g) => (
          <div key={g.day} className="grid gap-2">
            <p className="text-xs font-bold tracking-wide text-primary uppercase">{fmtDay(g.day)}</p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {g.words.map((w) => (
                <WordTile key={w.word} w={{ ...w, saved: false }} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}
