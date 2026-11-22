"use client";

import { useState } from "react";
import { ItemListEditor, newItemId } from "./item-list-editor";
import { AudioField } from "@/components/admin/audio-field";
import { inputCls } from "@/components/admin/ui";
import { sentenceTiles, type SentenceContent, type SentenceItem } from "@/lib/lab/types";
import { cn } from "cn";

/*
 * V4 sentence builder editor (Labo, English): the sentences — each written with « / » between its
 * tiles, with a live tile preview —, optional French translation, distractor tiles, other accepted
 * sentences, explanation and audio (Media kind model-audio), plus when the audio is heard.
 * Sent as JSON in « c_json » (cleaned on the server).
 */

type Item = SentenceItem & { audioUrl: string | null; distractorText: string; alternativeText: string };

const blank = (id = newItemId()): Item => ({ id, sentence: "", translation: "", distractors: [], alternatives: [], explanation: "", audioMediaId: "", audioUrl: null, distractorText: "", alternativeText: "" });

function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("grid content-start gap-1 text-sm", className)}>
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function SentenceEditor({ initial, audioUrls }: { initial: Partial<SentenceContent>; audioUrls: Record<string, string | null> }) {
  const [audioWhen, setAudioWhen] = useState<SentenceContent["audioWhen"]>(initial.audioWhen ?? "after");
  const [items, setItems] = useState<Item[]>(() =>
    initial.items?.length
      ? initial.items.map((it) => ({ ...it, audioUrl: it.audioMediaId ? (audioUrls[it.audioMediaId] ?? null) : null, distractorText: it.distractors.join(" / "), alternativeText: it.alternatives.join("\n") }))
      : [blank("s1")], // fixed id: a random one differs between the server render and hydration
  );

  const json = JSON.stringify({
    audioWhen,
    items: items.map((it) => ({ id: it.id, sentence: it.sentence, translation: it.translation, explanation: it.explanation, audioMediaId: it.audioMediaId, distractors: it.distractorText, alternatives: it.alternativeText })),
  });

  return (
    <section className="grid gap-4">
      <input type="hidden" name="c_json" value={json} />
      <Field label="When is each sentence heard?" hint="Audio is optional per sentence in « after » mode, required in « before » mode." className="sm:max-w-md">
        <select className={inputCls} value={audioWhen} onChange={(e) => setAudioWhen(e.target.value as SentenceContent["audioWhen"])}>
          <option value="after">After answering (the learner hears the right sentence)</option>
          <option value="before">Before building it (listen, then rebuild: harder)</option>
        </select>
      </Field>

      <ItemListEditor
        items={items}
        onChange={setItems}
        blank={() => blank()}
        copy={(it) => ({ ...it, id: newItemId() })}
        addLabel="Add a sentence"
        noun="sentence"
        max={20}
        render={(it, update) => {
          const tiles = sentenceTiles(it.sentence);
          const distractors = it.distractorText.split("/").map((d) => d.trim()).filter(Boolean);
          return (
            <div className="grid gap-3">
              <Field label="Sentence (English), « / » between the tiles" hint="A tile can hold several words: « I / would like / to book / a meeting. ». Without « / », each word is a tile.">
                <input lang="en" className={inputCls} value={it.sentence} maxLength={300} onChange={(e) => update({ sentence: e.target.value })} placeholder="I / would like / to book / a meeting / for Monday." />
              </Field>
              {(tiles.length > 0 || distractors.length > 0) && (
                <div className="flex flex-wrap gap-1.5" aria-label="Tiles the learner will see">
                  {tiles.map((t, i) => (
                    <span key={`t${i}`} lang="en" className="rounded-lg border-2 border-primary/30 bg-brand-soft px-2 py-1 text-sm font-semibold text-brand-deep">
                      {t}
                    </span>
                  ))}
                  {distractors.map((d, i) => (
                    <span key={`d${i}`} lang="en" className="rounded-lg border-2 border-dashed border-coral/60 bg-white px-2 py-1 text-sm font-semibold text-coral-dark" title="Distractor">
                      {d}
                    </span>
                  ))}
                  <span className={cn("self-center text-xs", tiles.length < 2 || tiles.length > 14 ? "font-semibold text-coral-dark" : "text-muted-foreground")}>
                    {tiles.length} tile{tiles.length > 1 ? "s" : ""}
                    {tiles.length < 2 ? " · at least 2" : tiles.length > 14 ? " · 14 max" : ""}
                  </span>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="French translation (optional)" hint="Shown as the prompt (as a hint in « before » mode).">
                  <input className={inputCls} value={it.translation} maxLength={300} onChange={(e) => update({ translation: e.target.value })} placeholder="Je voudrais réserver une réunion pour lundi." />
                </Field>
                <Field label="Distractor tiles (optional)" hint="Wrong extra tiles, « / » between them, 4 max. E.g. « booking / at »">
                  <input lang="en" className={inputCls} value={it.distractorText} maxLength={200} onChange={(e) => update({ distractorText: e.target.value })} placeholder="booking / at" />
                </Field>
              </div>
              <Field label="Other accepted sentences (optional)" hint="One per line, when another word order is also correct. Case, punctuation and contractions are ignored.">
                <textarea lang="en" className={cn(inputCls, "h-auto py-2")} rows={2} value={it.alternativeText} onChange={(e) => update({ alternativeText: e.target.value })} placeholder="For Monday, I would like to book a meeting." />
              </Field>
              <Field label="Explanation (optional, French)" hint="Shown after checking. E.g. « Sujet + would like + to + verbe. »">
                <input className={inputCls} value={it.explanation} maxLength={300} onChange={(e) => update({ explanation: e.target.value })} />
              </Field>
              <AudioField label={audioWhen === "before" ? "Audio of the sentence (required)" : "Audio of the sentence (optional)"} value={it.audioMediaId} url={it.audioUrl} onChange={(id, url) => update({ audioMediaId: id, audioUrl: url })} compact />
            </div>
          );
        }}
      />
    </section>
  );
}
