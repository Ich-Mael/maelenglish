"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { Loader2, Search } from "lucide-react";
import type { WordEntry } from "@/lib/dictionary";
import { lookupWordAction } from "@/app/(app)/dictionary-actions";
import { WordCard } from "./word-card";

/*
 * « Dictionary » page (English UI): type an English word → the word card; the last 10 words looked
 * up are kept on the device (localStorage, « Recent words »).
 */

const KEY = "me-dictionary-recent";
const noSubscribe = () => () => {};
const readRecent = (): string => {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
};

export function DictionarySearch() {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<{ entry: WordEntry; saved: boolean } | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const recentRaw = useSyncExternalStore(noSubscribe, readRecent, () => "[]");
  const [recentOverride, setRecentOverride] = useState<string[] | null>(null);
  const recent: string[] = recentOverride ?? (JSON.parse(recentRaw) as string[]);

  const search = (word: string) => {
    if (!word.trim()) return;
    setError("");
    start(async () => {
      const r = await lookupWordAction(word);
      if (!r.ok) {
        setResult(null);
        return setError(r.error);
      }
      setResult({ entry: r.entry, saved: r.saved });
      const next = [r.entry.word, ...recent.filter((w) => w !== r.entry.word)].slice(0, 10);
      setRecentOverride(next);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
    });
  };

  return (
    <div className="grid gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          search(q);
        }}
        className="flex gap-2"
        role="search"
      >
        <label className="relative flex-1">
          <span className="sr-only">English word</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            lang="en"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="An English word: delay, invoice, boarding…"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="h-12 w-full rounded-2xl border-2 border-border bg-card pr-3 pl-11 text-base outline-none focus:border-primary focus:ring-3 focus:ring-primary/20"
          />
        </label>
        <button type="submit" disabled={pending || !q.trim()} className="h-12 rounded-2xl bg-primary px-5 font-bold text-white shadow-[0_4px_0_0_var(--color-brand-dark)] disabled:opacity-50">
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : "Search"}
        </button>
      </form>

      {recent.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Recent words:</span>
          {recent.map((w) => (
            <button key={w} type="button" lang="en" onClick={() => (setQ(w), search(w))} className="rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-primary">
              {w}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-sm font-semibold text-coral-dark">{error}</p>}
      {result && (
        <section className="rounded-3xl border-2 border-border bg-card p-5">
          <WordCard key={result.entry.word} entry={result.entry} saved={result.saved} where="/dictionnaire" />
        </section>
      )}
      <p className="text-xs text-muted-foreground">Tip: in lessons and activities, long-press (or double-click) an English word to see what it means.</p>
    </div>
  );
}
