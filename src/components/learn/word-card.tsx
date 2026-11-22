"use client";

import { useRef, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { BookmarkCheck, BookmarkPlus, Loader2, Volume2 } from "lucide-react";
import type { WordEntry } from "@/lib/dictionary";
import { saveWordAction } from "@/app/(app)/dictionary-actions";
import { cn } from "cn";

/*
 * A dictionary word: phonetic and audio (the dictionary's recording, else the browser's voice),
 * the French translation, the English meanings with examples, a business example, and « Add to
 * my notebook » (English UI, owner decision 2026-11-22). Used by the « tap a word » sheet and the
 * Dictionary page.
 */

const noSubscribe = () => () => {};
/** The browser's voice is available (read after hydration: false on the server). */
const useSpeechSupport = () => useSyncExternalStore(noSubscribe, () => "speechSynthesis" in window, () => false);


export function speak(word: string, audioUrl: string, el: HTMLAudioElement | null) {
  if (audioUrl && el) {
    el.src = audioUrl;
    void el.play().catch(() => {});
    return;
  }
  // No recording: the browser's English voice, where available.
  try {
    const u = new SpeechSynthesisUtterance(word);
    u.lang = "en-US";
    u.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* no speech synthesis */
  }
}

export function WordCard({ entry, saved: savedInitially, context = "", where = "", compact }: { entry: WordEntry; saved: boolean; context?: string; where?: string; compact?: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [saved, setSaved] = useState(savedInitially);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const voice = useSpeechSupport();
  const canSpeak = !!entry.audioUrl || voice;
  const ctx = entry.inContext;
  // The meaning that applies (in the sentence, else the most common) is highlighted and listed first.
  const pick = ctx?.sense ?? entry.sense;
  const order = entry.meanings.map((_, i) => i).sort((a, b) => (b === pick?.m ? 1 : 0) - (a === pick?.m ? 1 : 0));

  const save = () =>
    start(async () => {
      setError("");
      const r = await saveWordAction(entry.word, context, where, entry.inContext?.translation ?? "");
      if (r.ok) setSaved(true);
      else setError(r.error);
    });

  return (
    <div className="grid gap-3">
      <audio ref={audio} preload="none" />
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p lang="en" className="font-heading text-2xl leading-tight font-extrabold text-brand-deep">
            {entry.word}
          </p>
          {entry.phonetic && (
            <p lang="en" className="text-sm text-muted-foreground">
              {entry.phonetic}
            </p>
          )}
        </div>
        {canSpeak && (
          <button type="button" onClick={() => speak(entry.headword || entry.word, entry.audioUrl, audio.current)} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-[0_4px_0_0_var(--color-brand-dark)] active:translate-y-0.5 active:shadow-none" aria-label={`Listen to "${entry.word}"`}>
            <Volume2 className="size-5" aria-hidden />
          </button>
        )}
      </div>

      {ctx ? (
        // Tapped in a sentence: its meaning there first, the usual translation after.
        <div className="grid gap-1 rounded-2xl border-2 border-coral/30 bg-coral-soft/40 px-3 py-2.5">
          <p className="text-[11px] font-bold tracking-wide text-coral-dark uppercase">In this sentence</p>
          <p lang="fr" className="font-heading text-xl font-extrabold text-coral">
            {ctx.translation}
          </p>
          {ctx.frNote && (
            <p lang="fr" className="text-sm text-ink">
              {ctx.frNote}
            </p>
          )}
          <p lang="en" className="line-clamp-2 text-xs text-muted-foreground italic">
            « {ctx.sentence} »
          </p>
        </div>
      ) : entry.translation ? (
        <p lang="fr" className="font-heading text-xl font-extrabold text-coral">
          {entry.translation}
        </p>
      ) : (
        !entry.found && <p className="text-sm text-muted-foreground">Not found in the dictionary.</p>
      )}
      {ctx && entry.translation && entry.translation !== ctx.translation && (
        <p className="text-sm text-ink">
          <span className="font-semibold text-brand-deep">Usually: </span>
          <span lang="fr">{entry.translation}</span>
        </p>
      )}
      {!ctx && entry.frNote && (
        <p lang="fr" className="text-sm text-ink">
          {entry.frNote}
        </p>
      )}

      {entry.meanings.length > 0 && (
        <div className={cn("grid gap-2", compact && "max-h-56 overflow-y-auto pr-1")}>
          {order.map((i) => {
            const m = entry.meanings[i];
            return (
              <div key={i} className="grid gap-1">
                <p className="text-xs font-bold tracking-wide text-primary uppercase">{m.partOfSpeech}</p>
                <ol className="grid list-decimal gap-1 pl-5 text-sm text-ink" lang="en">
                  {m.definitions.map((d, k) => (
                    <li key={k} className={cn(pick && pick.m === i && pick.d === k && "-ml-1 rounded-lg bg-brand-soft px-1 py-0.5 font-semibold text-brand-deep")}>
                      {d.definition}
                      {d.example && <span className="block font-normal text-muted-foreground italic">« {d.example} »</span>}
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
      )}
      {entry.businessExample && (
        <p className="rounded-xl bg-brand-soft/60 px-3 py-2 text-sm text-ink">
          <span className="font-semibold text-brand-deep">At work: </span>
          <span lang="en">{entry.businessExample}</span>
        </p>
      )}
      {entry.headword && entry.headword !== entry.word && (
        <p className="text-xs text-muted-foreground">
          Base form: <span lang="en">{entry.headword}</span>
        </p>
      )}

      {error && <p className="text-sm font-semibold text-coral-dark">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {saved ? (
          <Link href="/carnet" className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-soft px-3 text-sm font-bold text-primary">
            <BookmarkCheck className="size-4" aria-hidden /> In your notebook
          </Link>
        ) : (
          <button type="button" onClick={save} disabled={pending} className="inline-flex h-10 items-center gap-2 rounded-xl border-2 border-primary/40 bg-white px-3 text-sm font-bold text-primary disabled:opacity-60">
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <BookmarkPlus className="size-4" aria-hidden />} Add to my notebook
          </button>
        )}
      </div>
    </div>
  );
}
