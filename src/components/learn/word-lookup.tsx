"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Loader2, X } from "lucide-react";
import { normalizeWord } from "@/lib/dictionary-word";
import type { WordEntry } from "@/lib/dictionary";
import { lookupWordAction } from "@/app/(app)/dictionary-actions";
import { WordCard } from "./word-card";

/*
 * « Tap a word anywhere » (learner app shell): selecting ONE English word — long-press on phones,
 * double-click on desktop — shows a small « Define » chip; tapping it opens the word card
 * (bottom sheet on phones, panel on desktop). Only text marked `lang="en"` counts; inputs,
 * buttons (exercise answers, tiles, choices) and `[data-no-lookup]` are ignored, so a lookup
 * never gives an answer away.
 */

type Chip = { word: string; x: number; y: number; context: string };

/** The sentence around the selection (context saved with the word). */
function sentenceAround(node: Node | null, word: string): string {
  const text = (node?.parentElement?.closest("p, li, h1, h2, h3, td, blockquote, div")?.textContent ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const at = text.toLowerCase().indexOf(word);
  if (at < 0) return text.slice(0, 200);
  const start = Math.max(text.lastIndexOf(".", at) + 1, at - 150, 0);
  const endDot = text.indexOf(".", at);
  const end = Math.min(endDot >= 0 ? endDot + 1 : text.length, at + 150);
  return text.slice(start, end).trim();
}

export function WordLookup() {
  const [chip, setChip] = useState<Chip | null>(null);
  const [open, setOpen] = useState<{ chip: Chip; entry: WordEntry | null; saved: boolean; error: string; where: string } | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const check = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return setChip(null);
      const raw = sel.toString();
      const word = raw.trim().split(/\s+/).length === 1 ? normalizeWord(raw) : null;
      const el = sel.anchorNode?.parentElement;
      if (!word || !el || el.closest("input, textarea, button, select, a, [contenteditable], [data-no-lookup], [role='dialog']")) return setChip(null);
      if (el.closest("[lang]")?.getAttribute("lang") !== "en") return setChip(null);
      const r = sel.getRangeAt(0).getBoundingClientRect();
      setChip({ word, x: Math.min(Math.max(r.left + r.width / 2, 70), window.innerWidth - 70), y: r.bottom + 8, context: sentenceAround(sel.anchorNode, word) });
    };
    const onSel = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(check, 300);
    };
    const hide = () => setChip(null);
    document.addEventListener("selectionchange", onSel);
    window.addEventListener("scroll", hide, { passive: true });
    return () => {
      document.removeEventListener("selectionchange", onSel);
      window.removeEventListener("scroll", hide);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  // Escape closes the card.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const show = async (c: Chip) => {
    setChip(null);
    window.getSelection()?.removeAllRanges();
    // The page the word was found on (read on tap: no URL hook in the shared shell, Cache Components).
    setOpen({ chip: c, entry: null, saved: false, error: "", where: window.location.pathname });
    const r = await lookupWordAction(c.word, c.context);
    setOpen((o) => (o && o.chip.word === c.word ? (r.ok ? { ...o, entry: r.entry, saved: r.saved } : { ...o, error: r.error }) : o));
  };

  return (
    <>
      {chip && !open && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void show(chip)}
          style={{ left: chip.x, top: Math.min(chip.y, window.innerHeight - 60) }}
          className="fixed z-50 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-brand-deep px-3.5 py-2 text-sm font-bold text-white shadow-lg animate-pop motion-reduce:animate-none"
        >
          <BookOpen className="size-4" aria-hidden /> Define
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-deep/40 sm:items-center sm:p-4" onClick={(e) => e.target === e.currentTarget && setOpen(null)}>
          <div role="dialog" aria-modal="true" aria-label={`Dictionary: ${open.chip.word}`} className="max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl bg-background p-5 pb-8 shadow-2xl sm:max-w-md sm:rounded-3xl sm:pb-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold tracking-wide text-primary uppercase">Dictionary</p>
              <button type="button" onClick={() => setOpen(null)} className="flex size-9 items-center justify-center rounded-full hover:bg-muted" aria-label="Close">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            {open.error ? (
              <p className="text-sm font-semibold text-coral-dark">{open.error}</p>
            ) : open.entry ? (
              <WordCard entry={open.entry} saved={open.saved} context={open.chip.context} where={open.where} compact />
            ) : (
              <p className="flex items-center gap-2 py-6 text-sm font-semibold text-brand-deep">
                <Loader2 className="size-5 animate-spin" aria-hidden /> Looking up “{open.chip.word}”…
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
