"use client";

import { Listen } from "./listen";
import { Shadowing } from "./shadowing";

/*
 * Sentences to shadow inside a `ShadowingModal`: each with an optional label (« Example 1 »),
 * the English text, its French translation, and the practice (listen normal / slow, record,
 * score). `src` = the audio route of that sentence.
 */
export type ShadowItem = { id: string; text: string; fr?: string; label?: string; src: string };

export function ShadowList({ items }: { items: ShadowItem[] }) {
  return (
    <ul className="grid gap-3">
      {items.map((it) => (
        <li key={it.id} className="rounded-2xl bg-muted/60 p-3 sm:p-4">
          {it.label && <p className="mb-1 text-sm font-bold tracking-wide text-primary uppercase">{it.label}</p>}
          <Shadowing text={it.text} fr={it.fr} listen={<ListenPair src={it.src} text={it.text} />} />
        </li>
      ))}
    </ul>
  );
}

/** « Listen » normal + slow, the shadowing panel's model buttons. */
export function ListenPair({ src, text }: { src: string; text: string }) {
  return (
    <span className="inline-flex h-14 items-center gap-2 rounded-full bg-brand-soft pr-4 pl-1 text-base font-semibold text-primary">
      <Listen src={src} text={text} label="Listen to the model" className="size-12 bg-white" iconClass="size-6" />
      <Listen src={src} text={text} slow label="Listen slowly" className="size-10" iconClass="size-5" />
      Listen
    </span>
  );
}
