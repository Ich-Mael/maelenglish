"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { btn, inputCls } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/image-field";
import { MAX_ROLEPLAY_IMAGES, type RolePlayImage } from "@/lib/lab/types";

/**
 * Pictures of a role-play (a map, a menu, the slides of a presentation…): shown to the learner as a
 * carousel during the call. Sends `c_images` (JSON). The description (English) tells the AI
 * what's in each picture.
 */
export function RolePlayImagesField({ initial, urls }: { initial: RolePlayImage[]; urls: Record<string, string | null> }) {
  const [items, setItems] = useState(initial.map((x) => ({ ...x, url: urls[x.mediaId] ?? null })));
  const update = (i: number, patch: Partial<(typeof items)[number]>) => setItems((xs) => xs.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) =>
    setItems((xs) => {
      const j = i + d;
      if (j < 0 || j >= xs.length) return xs;
      const next = [...xs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const saved = items.filter((x) => x.mediaId).map(({ mediaId, caption, description }) => ({ mediaId, caption, description }));
  return (
    <fieldset className="grid gap-3 rounded-2xl border border-border p-4">
      <legend className="px-1 text-sm font-medium">Pictures for the call (optional)</legend>
      <p className="-mt-1 text-xs text-muted-foreground">A map, a menu, a document, the slides of a presentation… Learners see them as a carousel before and during the call. Describe each one in English so the AI can talk about it (e.g. the dishes and prices of the menu).</p>
      <input type="hidden" name="c_images" value={JSON.stringify(saved)} />
      {items.map((it, i) => (
        <div key={i} className="grid gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-[minmax(0,14rem)_1fr]">
          <ImageField value={it.mediaId} url={it.url} onChange={(id, url) => update(i, { mediaId: id, url })} noun="picture" maxSide={2000} />
          <div className="grid content-start gap-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Caption (shown to the learner)</span>
              <input className={inputCls} value={it.caption} maxLength={200} placeholder="The menu of the restaurant" onChange={(e) => update(i, { caption: e.target.value })} />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">What&apos;s in it (English, for the AI)</span>
              <textarea className={`${inputCls} h-auto py-2`} rows={3} maxLength={1500} lang="en" value={it.description} placeholder="Starters: chicken soup 3,000 FCFA… Mains: jollof rice with chicken 6,500 FCFA…" onChange={(e) => update(i, { description: e.target.value })} />
            </label>
            <span className="flex gap-1">
              <button type="button" className={btn.icon} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                <ArrowUp className="size-4" />
              </button>
              <button type="button" className={btn.icon} onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down">
                <ArrowDown className="size-4" />
              </button>
              <button type="button" className={btn.icon} onClick={() => setItems((xs) => xs.filter((_, k) => k !== i))} aria-label="Remove this picture">
                <Trash2 className="size-4" />
              </button>
            </span>
          </div>
        </div>
      ))}
      <button type="button" className={`${btn.secondary} w-fit`} disabled={items.length >= MAX_ROLEPLAY_IMAGES} onClick={() => setItems((xs) => [...xs, { mediaId: "", caption: "", description: "", url: null }])}>
        <Plus className="size-4" /> Add a picture
      </button>
    </fieldset>
  );
}
