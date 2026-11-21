"use client";

import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import { btn } from "@/components/admin/ui";
import { cn } from "cn";

/*
 * Editor kit (Lab, admin, English): the list of items of an exercise — numbered cards with move
 * up / down, duplicate and delete, plus « Add ». Each editor renders its own item fields.
 * Items need a stable `id` (new ids for duplicates come from `copy`).
 */
export function ItemListEditor<T extends { id: string }>({
  items,
  onChange,
  blank,
  copy,
  render,
  addLabel,
  noun = "item",
  min = 1,
  max = 30,
}: {
  items: T[];
  /** A state setter (functional updates, so quick successive edits don't overwrite each other). */
  onChange: React.Dispatch<React.SetStateAction<T[]>>;
  blank: () => T;
  copy: (item: T) => T;
  render: (item: T, update: (patch: Partial<T>) => void, index: number) => React.ReactNode;
  addLabel: string;
  noun?: string;
  min?: number;
  max?: number;
}) {
  const update = (i: number, patch: Partial<T>) => onChange((list) => list.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) =>
    onChange((list) => {
      const j = i + d;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  return (
    <div className="grid gap-3">
      {items.map((item, i) => (
        <div key={item.id} className="grid gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-1">
            <span className="mr-auto flex size-7 items-center justify-center rounded-lg bg-brand-soft text-xs font-bold text-primary" aria-label={`${noun} ${i + 1}`}>
              {i + 1}
            </span>
            <button type="button" className={btn.icon} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" title="Move up">
              <ArrowUp className="size-4" aria-hidden />
            </button>
            <button type="button" className={btn.icon} onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down" title="Move down">
              <ArrowDown className="size-4" aria-hidden />
            </button>
            <button type="button" className={btn.icon} onClick={() => onChange((list) => [...list.slice(0, i + 1), copy(item), ...list.slice(i + 1)])} disabled={items.length >= max} aria-label={`Duplicate ${noun}`} title="Duplicate">
              <Copy className="size-4" aria-hidden />
            </button>
            <button type="button" className={btn.icon} onClick={() => onChange((list) => list.filter((_, k) => k !== i))} disabled={items.length <= min} aria-label={`Delete ${noun}`} title="Delete">
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
          {render(item, (p) => update(i, p), i)}
        </div>
      ))}
      <button type="button" className={cn(btn.secondary, "w-fit")} onClick={() => onChange((list) => [...list, blank()])} disabled={items.length >= max}>
        <Plus className="size-4" aria-hidden /> {addLabel}
      </button>
    </div>
  );
}

/** Short random id for new items (client side). */
export const newItemId = () => Math.random().toString(36).slice(2, 10);
