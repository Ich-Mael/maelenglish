"use client";

import { useRef, useState } from "react";
import { Loader2, Play, Plus, Square, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { btn, inputCls } from "@/components/admin/ui";
import type { Voice } from "@/lib/ai/types";
import type { Scene } from "@/lib/story/schema";
import { previewVoiceAction } from "@/app/admin/story/actions";
import { cn } from "cn";

/* Controlled fields for the Story Mode editors (admin, English UI; content written in French / English as labelled). */

export function Text({ label, value, onChange, hint, lang, placeholder, className }: { label: string; value: string; onChange: (v: string) => void; hint?: string; lang?: "en" | "fr"; placeholder?: string; className?: string }) {
  return (
    <label className={cn("grid content-start gap-1 text-sm", className)}>
      <span className="font-medium">{label}</span>
      <input className={inputCls} value={value} lang={lang} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function Area({ label, value, onChange, hint, lang, rows = 3, className }: { label: string; value: string; onChange: (v: string) => void; hint?: string; lang?: "en" | "fr"; rows?: number; className?: string }) {
  return (
    <label className={cn("grid content-start gap-1 text-sm", className)}>
      <span className="font-medium">{label}</span>
      <textarea className={cn(inputCls, "h-auto py-2")} rows={rows} value={value} lang={lang} onChange={(e) => onChange(e.target.value)} />
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function Num({ label, value, onChange, min, max, step, hint, className }: { label: string; value: number | null; onChange: (v: number | null) => void; min?: number; max?: number; step?: number; hint?: string; className?: string }) {
  return (
    <label className={cn("grid content-start gap-1 text-sm", className)}>
      <span className="font-medium">{label}</span>
      <input className={inputCls} type="number" inputMode="decimal" min={min} max={max} step={step} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function Pick({ label, value, onChange, options, hint, className }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; hint?: string; className?: string }) {
  return (
    <label className={cn("grid content-start gap-1 text-sm", className)}>
      <span className="font-medium">{label}</span>
      <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

/** A list typed one item per line. */
export function Lines({ label, value, onChange, hint, lang, rows = 3 }: { label: string; value: string[]; onChange: (v: string[]) => void; hint?: string; lang?: "en" | "fr"; rows?: number }) {
  const [text, setText] = useState(value.join("\n"));
  return (
    <Area
      label={label}
      hint={hint ?? "One per line."}
      lang={lang}
      rows={rows}
      value={text}
      onChange={(t) => {
        setText(t);
        onChange(
          t
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean),
        );
      }}
    />
  );
}

/** Checkboxes for picking ids (characters of an episode, key phrases…). */
export function MultiPick({ label, value, onChange, options, hint }: { label: string; value: string[]; onChange: (v: string[]) => void; options: { value: string; label: string }[]; hint?: string }) {
  return (
    <fieldset className="grid content-start gap-1 text-sm">
      <legend className="mb-1 font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])} className={cn("rounded-full px-3 py-1 text-sm font-medium ring-1", on ? "bg-primary text-white ring-primary" : "bg-card ring-border hover:bg-brand-soft")}>
              {o.label}
            </button>
          );
        })}
        {!options.length ? <span className="text-xs text-muted-foreground">Nothing to pick yet.</span> : null}
      </div>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </fieldset>
  );
}

/** ElevenLabs voice of a character, with the account's sample. */
export function VoiceSelect({ voices, value, name, onChange }: { voices: Voice[]; value: string; name: string; onChange: (id: string, name: string) => void }) {
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const current = voices.find((v) => v.id === value);
  const toggle = () => {
    audio.current?.pause();
    if (playing || !current?.previewUrl) return setPlaying(false);
    const a = new Audio(current.previewUrl);
    audio.current = a;
    a.onended = () => setPlaying(false);
    void a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };
  return (
    <label className="grid content-start gap-1 text-sm">
      <span className="font-medium">Voice</span>
      <span className="flex gap-2">
        <select
          className={inputCls}
          value={value}
          onChange={(e) => {
            audio.current?.pause();
            setPlaying(false);
            const v = voices.find((x) => x.id === e.target.value);
            onChange(e.target.value, v?.name ?? "");
          }}
        >
          <option value="">Default voice</option>
          {value && !current ? <option value={value}>{name || value}</option> : null}
          {voices.map((v) => (
            <option key={v.id} value={v.id}>
              {[v.name, v.accent, v.gender].filter(Boolean).join(" · ")}
            </option>
          ))}
        </select>
        <button type="button" onClick={toggle} disabled={!current?.previewUrl} className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-input text-primary hover:bg-brand-soft disabled:opacity-40" aria-label={playing ? "Stop the sample" : "Hear a sample"}>
          {playing ? <Square className="size-4" /> : <Play className="size-4" />}
        </button>
      </span>
      {!voices.length ? <span className="text-xs text-muted-foreground">ElevenLabs isn&apos;t configured: the default voice will be used.</span> : null}
    </label>
  );
}

/** ▶ the text in a voice (the cached audio learners will hear). */
export function PreviewVoice({ voiceId, text }: { voiceId: string; text: string }) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const [error, setError] = useState("");
  const audio = useRef<HTMLAudioElement | null>(null);
  const play = async () => {
    if (state === "playing") {
      audio.current?.pause();
      return setState("idle");
    }
    setError("");
    setState("loading");
    const r = await previewVoiceAction(voiceId, text);
    if (!r.ok || !r.url) {
      setState("idle");
      return setError(r.ok ? "No voice available." : r.error);
    }
    const a = new Audio(r.url);
    audio.current = a;
    a.onended = () => setState("idle");
    void a.play().then(() => setState("playing")).catch(() => setState("idle"));
  };
  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" onClick={play} disabled={!text.trim() || text.includes("{")} className={btn.icon} aria-label="Hear this line" title={text.includes("{") ? "Lines with {variables} are voiced per learner" : "Hear this line"}>
        {state === "loading" ? <Loader2 className="size-4 animate-spin" /> : state === "playing" ? <Square className="size-4" /> : <Play className="size-4" />}
      </button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </span>
  );
}

/** A scene: narrator lines in French, character lines in English (+ French translation). */
export function SceneEditor({ label, scene, onChange, cast }: { label: string; scene: Scene; onChange: (s: Scene) => void; cast: { id: string; name: string; voice_id: string }[] }) {
  const lines = scene.lines;
  const set = (i: number, patch: Partial<Scene["lines"][number]>) => onChange({ lines: lines.map((l, k) => (k === i ? { ...l, ...patch } : l)) });
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= lines.length) return;
    const next = [...lines];
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ lines: next });
  };
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">{label}</p>
      {lines.map((l, i) => {
        const narrator = l.speaker === "narrator";
        const voice = cast.find((c) => c.id === l.speaker)?.voice_id ?? "";
        return (
          <div key={i} className="grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-[160px_1fr_auto]">
            <select className={inputCls} value={l.speaker} onChange={(e) => set(i, { speaker: e.target.value, ...(e.target.value === "narrator" ? { text_en: undefined, audio: undefined } : { audio: "auto" }) })} aria-label="Speaker">
              <option value="narrator">Narrator (French)</option>
              {cast
                .filter((c) => c.id !== "narrator")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            <div className="grid gap-2">
              {!narrator ? (
                <div className="flex items-center gap-1">
                  <input className={inputCls} lang="en" placeholder="What they say (English)" value={l.text_en ?? ""} onChange={(e) => set(i, { text_en: e.target.value, audio: "auto" })} />
                  <PreviewVoice voiceId={voice} text={l.text_en ?? ""} />
                </div>
              ) : null}
              <input className={inputCls} lang="fr" placeholder={narrator ? "Narration (français)" : "Traduction (français)"} value={l.text_fr ?? ""} onChange={(e) => set(i, { text_fr: e.target.value })} />
            </div>
            <div className="flex items-start gap-0.5">
              <button type="button" className={btn.icon} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                <ArrowUp className="size-4" />
              </button>
              <button type="button" className={btn.icon} onClick={() => move(i, 1)} disabled={i === lines.length - 1} aria-label="Move down">
                <ArrowDown className="size-4" />
              </button>
              <button type="button" className={btn.icon} onClick={() => onChange({ lines: lines.filter((_, k) => k !== i) })} aria-label="Delete line">
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn.secondary} onClick={() => onChange({ lines: [...lines, { speaker: "narrator", text_fr: "" }] })}>
          <Plus className="size-4" /> Narration
        </button>
        <button type="button" className={btn.secondary} disabled={!cast.some((c) => c.id !== "narrator")} onClick={() => onChange({ lines: [...lines, { speaker: cast.find((c) => c.id !== "narrator")!.id, text_en: "", text_fr: "", audio: "auto" }] })}>
          <Plus className="size-4" /> Character line
        </button>
      </div>
      <p className="text-xs text-muted-foreground">Variables: {"{learner_name}"}, {"{city}"}, {"{learner_job}"}, {"{learner_country}"}.</p>
    </div>
  );
}

/** A short id from a name (characters, places, chapters). */
export const slugId = (s: string, taken: string[], prefix = "x") => {
  const base = s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || prefix;
  let id = /^[a-z0-9]/.test(base) ? base : `${prefix}-${base}`;
  for (let i = 2; taken.includes(id); i++) id = `${base}-${i}`;
  return id;
};
