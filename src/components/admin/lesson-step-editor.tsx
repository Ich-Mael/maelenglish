"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, BookA, Lightbulb, MessagesSquare, Plus, Table2, Trash2 } from "lucide-react";
import type { LessonContent, LessonSection, SectionType } from "@/lib/course/types";
import { SECTION_LABEL } from "@/lib/course/types";
import { ItemListEditor, newItemId } from "@/components/lab/item-list-editor";
import { AudioField } from "./audio-field";
import { btn, inputCls } from "./ui";
import { cn } from "cn";

/*
 * Lesson step editor (admin, English UI; the taught content is English, explanations may be French):
 * Coach Ish's video link, an optional audio, then the sections in order — vocabulary (word, meaning,
 * example, audio), grammar rule (rule, table, examples), dialogue (with audio) and « Le conseil de
 * Coach Ish ». Tables, examples and dialogue lines are typed as plain text (one row / line per line).
 * Sends everything but the rich intro as JSON in « content » (cleaned on the server).
 */

type Vocab = { id: string; term: string; meaning: string; example: string; audioMediaId: string };
type Draft =
  | { id: string; type: "vocabulary"; items: Vocab[] }
  | { id: string; type: "grammar_rule"; rule: string; tableText: string; examplesText: string }
  | { id: string; type: "dialogue"; linesText: string; audioMediaId: string }
  | { id: string; type: "tip"; text: string };

const ICON: Record<SectionType, React.ComponentType<{ className?: string }>> = { vocabulary: BookA, grammar_rule: Table2, dialogue: MessagesSquare, tip: Lightbulb };
const blankWord = (): Vocab => ({ id: newItemId(), term: "", meaning: "", example: "", audioMediaId: "" });

function toDraft(s: LessonSection): Draft {
  switch (s.type) {
    case "vocabulary":
      return { ...s, items: s.items.length ? s.items : [blankWord()] };
    case "grammar_rule":
      return { id: s.id, type: s.type, rule: s.rule, tableText: s.table.map((r) => r.join(" | ")).join("\n"), examplesText: s.examples.join("\n") };
    case "dialogue":
      return { id: s.id, type: s.type, audioMediaId: s.audioMediaId, linesText: s.lines.map((l) => (l.speaker ? `${l.speaker}: ${l.text}` : l.text)).join("\n") };
    case "tip":
      return s;
  }
}

const lines = (t: string) => t.split("\n").map((x) => x.trim()).filter(Boolean);

function fromDraft(d: Draft): LessonSection {
  switch (d.type) {
    case "vocabulary":
      return d;
    case "grammar_rule":
      return { id: d.id, type: d.type, rule: d.rule, table: lines(d.tableText).map((r) => r.split("|").map((c) => c.trim())), examples: lines(d.examplesText) };
    case "dialogue":
      return {
        id: d.id,
        type: d.type,
        audioMediaId: d.audioMediaId,
        lines: lines(d.linesText).map((l, k) => {
          const m = l.match(/^([^:]{1,40}):\s*(.+)$/);
          return { id: `l${k + 1}`, speaker: m ? m[1].trim() : "", text: m ? m[2].trim() : l };
        }),
      };
    case "tip":
      return d;
  }
}

function newSection(type: SectionType): Draft {
  const id = newItemId();
  switch (type) {
    case "vocabulary":
      return { id, type, items: [blankWord()] };
    case "grammar_rule":
      return { id, type, rule: "", tableText: "", examplesText: "" };
    case "dialogue":
      return { id, type, linesText: "", audioMediaId: "" };
    case "tip":
      return { id, type, text: "" };
  }
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid content-start gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function LessonStepEditor({ initial, urls: initialUrls }: { initial: LessonContent; urls: Record<string, string> }) {
  const [videoUrl, setVideoUrl] = useState(initial.videoUrl);
  const [audioMediaId, setAudioMediaId] = useState(initial.audioMediaId);
  const [sections, setSections] = useState<Draft[]>(() => initial.sections.map(toDraft));
  const [urls, setUrls] = useState(initialUrls);
  const url = (id: string) => (id ? (urls[id] ?? null) : null);
  const remember = (id: string, u: string | null) => id && u && setUrls((m) => ({ ...m, [id]: u }));

  const update = (id: string, patch: Partial<Draft>) => setSections((list) => list.map((s) => (s.id === id ? ({ ...s, ...patch } as Draft) : s)));
  const move = (i: number, d: -1 | 1) =>
    setSections((list) => {
      const j = i + d;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const json = JSON.stringify({ videoUrl, audioMediaId, sections: sections.map(fromDraft) });

  return (
    <div className="grid gap-5">
      <input type="hidden" name="content" value={json} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Coach Ish's video (optional)" hint="YouTube, Vimeo or a video file link.">
          <input className={inputCls} value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtu.be/…" />
        </Field>
        <AudioField
          label="Lesson audio (optional)"
          value={audioMediaId}
          url={url(audioMediaId)}
          onChange={(id, u) => {
            setAudioMediaId(id);
            remember(id, u);
          }}
        />
      </div>

      <section className="grid gap-3">
        <h3 className="font-heading font-extrabold text-brand-deep">Sections ({sections.length})</h3>
        <p className="-mt-2 text-sm text-muted-foreground">Shown in this order under the intro. English content; meanings and tips can be in French.</p>
        {sections.map((s, i) => {
          const Icon = ICON[s.type];
          return (
            <div key={s.id} className="grid gap-3 rounded-2xl border border-border p-4">
              <div className="flex items-center gap-2">
                <Icon className="size-4 text-primary" aria-hidden />
                <span className="flex-1 text-sm font-bold text-brand-deep">{SECTION_LABEL[s.type].admin}</span>
                <button type="button" className={btn.icon} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move section up">
                  <ArrowUp className="size-4" aria-hidden />
                </button>
                <button type="button" className={btn.icon} onClick={() => move(i, 1)} disabled={i === sections.length - 1} aria-label="Move section down">
                  <ArrowDown className="size-4" aria-hidden />
                </button>
                <button type="button" className={btn.icon} onClick={() => setSections((list) => list.filter((x) => x.id !== s.id))} aria-label="Delete section">
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>

              {s.type === "vocabulary" && (
                <ItemListEditor<Vocab>
                  items={s.items}
                  onChange={(next) => setSections((list) => list.map((x) => (x.id === s.id && x.type === "vocabulary" ? { ...x, items: typeof next === "function" ? next(x.items) : next } : x)))}
                  blank={blankWord}
                  copy={(w) => ({ ...w, id: newItemId() })}
                  noun="word"
                  addLabel="Add a word"
                  max={40}
                  render={(w, up, k) => (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input className={inputCls} value={w.term} onChange={(e) => up({ term: e.target.value })} placeholder="Good morning" aria-label={`Word ${k + 1}`} lang="en" />
                      <input className={inputCls} value={w.meaning} onChange={(e) => up({ meaning: e.target.value })} placeholder="Salutation formelle avant midi" aria-label={`Meaning ${k + 1}`} />
                      <input className={cn(inputCls, "sm:col-span-2")} value={w.example} onChange={(e) => up({ example: e.target.value })} placeholder="Good morning, Mr Ouédraogo." aria-label={`Example ${k + 1}`} lang="en" />
                      <div className="sm:col-span-2">
                        <AudioField
                          compact
                          label="Pronunciation (optional)"
                          value={w.audioMediaId}
                          url={url(w.audioMediaId)}
                          onChange={(id, u) => {
                            up({ audioMediaId: id });
                            remember(id, u);
                          }}
                        />
                      </div>
                    </div>
                  )}
                />
              )}

              {s.type === "grammar_rule" && (
                <>
                  <Field label="Rule">
                    <input className={inputCls} value={s.rule} onChange={(e) => update(s.id, { rule: e.target.value })} placeholder="I am / You are / He, She, It is / We are / They are" lang="en" />
                  </Field>
                  <Field label="Table (optional)" hint="One row per line, cells separated by « | ». The first row is the header.">
                    <textarea
                      className={cn(inputCls, "h-auto min-h-24 py-2 font-mono text-xs")}
                      value={s.tableText}
                      onChange={(e) => update(s.id, { tableText: e.target.value })}
                      placeholder={"Subject | Positive | Negative | Question\nI | I am (I'm) | I'm not | Am I?"}
                      lang="en"
                    />
                  </Field>
                  <Field label="Examples (optional)" hint="One per line.">
                    <textarea className={cn(inputCls, "h-auto min-h-20 py-2")} value={s.examplesText} onChange={(e) => update(s.id, { examplesText: e.target.value })} placeholder={"I'm a project manager.\nShe is from Ghana."} lang="en" />
                  </Field>
                </>
              )}

              {s.type === "dialogue" && (
                <>
                  <Field label="Lines" hint="One line each, « Speaker: text ».">
                    <textarea
                      className={cn(inputCls, "h-auto min-h-28 py-2")}
                      value={s.linesText}
                      onChange={(e) => update(s.id, { linesText: e.target.value })}
                      placeholder={"Awa: Good morning. I'm Awa Traoré, the new HR assistant.\nPaul: Nice to meet you, Awa. I'm Paul, from Finance."}
                      lang="en"
                    />
                  </Field>
                  <AudioField
                    label="Dialogue audio (optional)"
                    value={s.audioMediaId}
                    url={url(s.audioMediaId)}
                    onChange={(id, u) => {
                      update(s.id, { audioMediaId: id });
                      remember(id, u);
                    }}
                  />
                </>
              )}

              {s.type === "tip" && (
                <Field label="Coach Ish's tip (French)">
                  <textarea className={cn(inputCls, "h-auto min-h-20 py-2")} value={s.text} onChange={(e) => update(s.id, { text: e.target.value })} placeholder="Ne répondez jamais « Me too » à « Nice to meet you » : dites « Nice to meet you too »." />
                </Field>
              )}
            </div>
          );
        })}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ICON) as SectionType[]).map((t) => {
            const Icon = ICON[t];
            return (
              <button key={t} type="button" className={btn.secondary} onClick={() => setSections((list) => [...list, newSection(t)])}>
                <Plus className="size-4" aria-hidden /> <Icon className="size-4" aria-hidden /> {SECTION_LABEL[t].admin}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
