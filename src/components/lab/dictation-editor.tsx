"use client";

import { useState } from "react";
import { ClipboardPaste } from "lucide-react";
import { ItemListEditor, newItemId } from "./item-list-editor";
import { AudioField } from "@/components/admin/audio-field";
import { btn, inputCls } from "@/components/admin/ui";
import { DICTATION_PLAYS, type DictationContent, type DictationItem } from "@/lib/lab/types";
import { cn } from "cn";

/*
 * L2 dictation editor (Labo, English): sentences, each with its audio (required: record it in the
 * browser or upload it) and an optional French translation (shown after checking); how many times
 * each sentence can be played; « Paste a list » adds many at once (one per line, « = » before the
 * translation). Sent as « c_json ».
 */

type Phrase = DictationItem & { audioUrl: string | null };
const blank = (id = newItemId()): Phrase => ({ id, text: "", translation: "", audioMediaId: "", audioUrl: null });

export function DictationEditor({ initial, audioUrls }: { initial: Partial<DictationContent>; audioUrls: Record<string, string | null> }) {
  const [maxPlays, setMaxPlays] = useState(initial.maxPlays ?? 0);
  const [phrases, setPhrases] = useState<Phrase[]>(() => (initial.items?.length ? initial.items.map((p) => ({ ...p, audioUrl: p.audioMediaId ? (audioUrls[p.audioMediaId] ?? null) : null })) : [blank("d1")])); // fixed id: a random one differs between the server render and hydration
  const [paste, setPaste] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const json = JSON.stringify({ maxPlays, items: phrases.map((p) => ({ id: p.id, text: p.text, translation: p.translation, audioMediaId: p.audioMediaId })) });
  const parsed = paste
    .split("\n")
    .map((l) => l.split(/ = |=|\t/))
    .filter((parts) => parts[0]?.trim())
    .map((parts) => ({ ...blank(), text: parts[0].trim(), translation: (parts[1] ?? "").trim() }));

  return (
    <section className="grid gap-4">
      <input type="hidden" name="c_json" value={json} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Plays per sentence</span>
          <select className={cn(inputCls, "w-auto")} value={maxPlays} onChange={(e) => setMaxPlays(Number(e.target.value))}>
            {DICTATION_PLAYS.map((n) => (
              <option key={n} value={n}>
                {n === 0 ? "Unlimited" : `${n} plays max`}
              </option>
            ))}
          </select>
        </label>
        <p className="flex-1 self-end text-xs text-muted-foreground">Useful sentences (5–15 words) at natural speed. Learners type what they hear (slow replay and a first-letters hint available); a sentence counts as right from 80 % of its words, spelling included.</p>
        <button type="button" className={btn.secondary} onClick={() => setPasteOpen((o) => !o)}>
          <ClipboardPaste className="size-4" aria-hidden /> Paste a list
        </button>
      </div>
      {pasteOpen && (
        <div className="grid gap-2 rounded-2xl border border-primary/25 bg-brand-soft/50 p-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">One sentence per line, optionally « = » and the French translation</span>
            <textarea lang="en" className={cn(inputCls, "h-auto py-2")} rows={5} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"Flight AF 512 to Paris is delayed. = Le vol AF 512 pour Paris est retardé.\nPlease go to gate 14. = Veuillez vous rendre à la porte 14."} />
          </label>
          <button
            type="button"
            className={cn(btn.primary, "w-fit")}
            disabled={!parsed.length}
            onClick={() => {
              setPhrases((cur) => [...cur.filter((p) => p.text.trim()), ...parsed].slice(0, 20));
              setPaste("");
              setPasteOpen(false);
            }}
          >
            Add {parsed.length || ""} sentence{parsed.length === 1 ? "" : "s"}
          </button>
          <span className="text-xs text-muted-foreground">Then record the audio of each sentence below. 20 sentences at most.</span>
        </div>
      )}
      <ItemListEditor
        items={phrases}
        onChange={setPhrases}
        blank={() => blank()}
        copy={(p) => ({ ...p, id: newItemId() })}
        addLabel="Add a sentence"
        noun="sentence"
        max={20}
        render={(p, update) => (
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Sentence (English): what learners must type</span>
                <input lang="en" className={inputCls} value={p.text} maxLength={300} onChange={(e) => update({ text: e.target.value })} placeholder="Flight AF 512 to Paris is delayed." />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Translation (optional, French, shown after checking)</span>
                <input className={inputCls} value={p.translation} maxLength={300} onChange={(e) => update({ translation: e.target.value })} placeholder="Le vol AF 512 pour Paris est retardé." />
              </label>
            </div>
            <AudioField label="Audio of the sentence (required)" value={p.audioMediaId} url={p.audioUrl} onChange={(id, url) => update({ audioMediaId: id, audioUrl: url })} compact />
          </div>
        )}
      />
    </section>
  );
}
