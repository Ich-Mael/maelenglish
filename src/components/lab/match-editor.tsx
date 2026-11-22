"use client";

import { useState } from "react";
import { ClipboardPaste } from "lucide-react";
import { ItemListEditor, newItemId } from "./item-list-editor";
import { AudioField } from "@/components/admin/audio-field";
import { btn, inputCls } from "@/components/admin/ui";
import { MATCH_PER_SCREEN, matchScreens, type MatchContent, type MatchPair } from "@/lib/lab/types";
import { cn } from "cn";

/*
 * V1 matching pairs editor (Labo, English): pairs (English side ↔ translation / definition /
 * reply), optional French explanation and audio of the English side, how many pairs per screen,
 * and « Paste a list » (one pair per line, « = » between the sides) to add many at once.
 * Sent as JSON in « c_json » (cleaned on the server).
 */

type Pair = MatchPair & { audioUrl: string | null };

const blank = (id = newItemId()): Pair => ({ id, left: "", right: "", explanation: "", audioMediaId: "", audioUrl: null });

/** « boarding pass = carte d'embarquement » lines → pairs (tab or « = » between the sides). */
function parseList(text: string): Pair[] {
  return text
    .split("\n")
    .map((l) => l.split(/\t| = |=/))
    .filter((parts) => parts.length >= 2 && parts[0].trim() && parts[1].trim())
    .map((parts) => ({ ...blank(), left: parts[0].trim(), right: parts.slice(1).join("=").trim() }));
}

export function MatchEditor({ initial, audioUrls }: { initial: Partial<MatchContent>; audioUrls: Record<string, string | null> }) {
  const [perScreen, setPerScreen] = useState<MatchContent["perScreen"]>(initial.perScreen ?? 5);
  const [pairs, setPairs] = useState<Pair[]>(() =>
    initial.pairs?.length ? initial.pairs.map((p) => ({ ...p, audioUrl: p.audioMediaId ? (audioUrls[p.audioMediaId] ?? null) : null })) : [blank("p1"), blank("p2")], // fixed ids: random ones differ between the server render and hydration
  );
  const [paste, setPaste] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);

  const json = JSON.stringify({ perScreen, pairs: pairs.map((p) => ({ id: p.id, left: p.left, right: p.right, explanation: p.explanation, audioMediaId: p.audioMediaId })) });
  const filled = pairs.filter((p) => p.left.trim() && p.right.trim());
  const screens = matchScreens(filled, perScreen);
  const parsed = parseList(paste);

  return (
    <section className="grid gap-4">
      <input type="hidden" name="c_json" value={json} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Pairs per screen</span>
          <select className={cn(inputCls, "w-auto")} value={perScreen} onChange={(e) => setPerScreen(Number(e.target.value) as MatchContent["perScreen"])}>
            {MATCH_PER_SCREEN.map((n) => (
              <option key={n} value={n}>
                {n} pairs
              </option>
            ))}
          </select>
        </label>
        <p className="pb-2 text-xs text-muted-foreground">
          {filled.length} pair{filled.length > 1 ? "s" : ""}
          {screens.length > 0 && ` → ${screens.length} screen${screens.length > 1 ? "s" : ""} (${screens.map((s) => s.length).join(" + ")})`}. 4–6 per screen stays readable on a phone.
        </p>
        <button type="button" className={cn(btn.secondary, "ml-auto")} onClick={() => setPasteOpen((o) => !o)}>
          <ClipboardPaste className="size-4" aria-hidden /> Paste a list
        </button>
      </div>

      {pasteOpen && (
        <div className="grid gap-2 rounded-2xl border border-primary/25 bg-brand-soft/50 p-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">One pair per line, « = » (or a tab, from a spreadsheet) between the sides</span>
            <textarea className={cn(inputCls, "h-auto py-2")} rows={5} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"boarding pass = carte d'embarquement\ngate = porte d'embarquement\ndelay = retard"} />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={btn.primary}
              disabled={!parsed.length}
              onClick={() => {
                // Replace the empty starter pairs, keep the ones already written.
                setPairs((cur) => [...cur.filter((p) => p.left.trim() || p.right.trim()), ...parsed].slice(0, 30));
                setPaste("");
                setPasteOpen(false);
              }}
            >
              Add {parsed.length || ""} pair{parsed.length === 1 ? "" : "s"}
            </button>
            <span className="text-xs text-muted-foreground">30 pairs at most.</span>
          </div>
        </div>
      )}

      <ItemListEditor
        items={pairs}
        onChange={setPairs}
        blank={() => blank()}
        copy={(p) => ({ ...p, id: newItemId() })}
        addLabel="Add a pair"
        noun="pair"
        min={2}
        max={30}
        render={(p, update) => (
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">English (left card)</span>
                <input lang="en" className={inputCls} value={p.left} maxLength={160} onChange={(e) => update({ left: e.target.value })} placeholder="boarding pass" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Match (right card)</span>
                <input className={inputCls} value={p.right} maxLength={160} onChange={(e) => update({ right: e.target.value })} placeholder="carte d'embarquement" />
              </label>
            </div>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Explanation (optional, French)</span>
              <input className={inputCls} value={p.explanation} maxLength={300} onChange={(e) => update({ explanation: e.target.value })} placeholder="Shown in the results when the pair was missed." />
            </label>
            <AudioField label="Audio of the English side (optional, played when the card is tapped)" value={p.audioMediaId} url={p.audioUrl} onChange={(id, url) => update({ audioMediaId: id, audioUrl: url })} compact />
          </div>
        )}
      />
    </section>
  );
}
