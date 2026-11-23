"use client";

import { Check } from "lucide-react";
import type { AvatarConfig } from "@/lib/story/schema";
import { BG, HAIR_COLOR, OUTFIT_COLOR, SKIN } from "./avatar";

/* The avatar builder (learner onboarding and the admin's character editor): one illustrated style for everyone. */

const HAIRS: { id: AvatarConfig["hair"]; label: string }[] = [
  { id: "short", label: "Short" },
  { id: "fade", label: "Fade" },
  { id: "afro", label: "Afro" },
  { id: "braids", label: "Braids" },
  { id: "locs", label: "Locs" },
  { id: "bun", label: "Bun" },
  { id: "long", label: "Long" },
  { id: "headwrap", label: "Headwrap" },
  { id: "bald", label: "Bald" },
];
const OUTFITS: { id: AvatarConfig["outfit"]; label: string }[] = [
  { id: "shirt", label: "Shirt" },
  { id: "blazer", label: "Blazer" },
  { id: "polo", label: "Polo" },
  { id: "dashiki", label: "Dashiki" },
  { id: "dress", label: "Dress" },
];
export function Swatches({ colors, value, onChange, label }: { colors: string[]; value: number; onChange: (i: number) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {colors.map((c, i) => (
        <button key={c} type="button" role="radio" aria-checked={value === i} aria-label={`${label} ${i + 1}`} onClick={() => onChange(i)} className={`size-8 rounded-full ring-offset-2 transition ${value === i ? "ring-3 ring-primary" : "ring-1 ring-ink/15 hover:ring-primary/50"}`} style={{ background: c }} />
      ))}
    </div>
  );
}

export function Chips<T extends string | number>({ items, value, onChange, label }: { items: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {items.map((x) => (
        <button key={String(x.id)} type="button" role="radio" aria-checked={value === x.id} onClick={() => onChange(x.id)} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${value === x.id ? "bg-primary text-white" : "bg-brand-soft text-primary hover:bg-primary/15"}`}>
          {x.label}
        </button>
      ))}
    </div>
  );
}

export const Field = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="grid gap-2">
    <p className="text-sm font-bold text-ink">{title}</p>
    {children}
  </div>
);


export function AvatarBuilder({ value: a, onChange }: { value: AvatarConfig; onChange: (a: AvatarConfig) => void }) {
  const set = <K extends keyof AvatarConfig>(k: K, v: AvatarConfig[K]) => onChange({ ...a, [k]: v });
  return (
    <div className="grid gap-6">
      <Field title="Face">
        <Chips items={[{ id: "oval", label: "Oval" }, { id: "round", label: "Round" }, { id: "square", label: "Square" }] as { id: AvatarConfig["face"]; label: string }[]} value={a.face} onChange={(v) => set("face", v)} label="Face" />
      </Field>
      <Field title="Skin tone">
        <Swatches colors={SKIN} value={a.skin} onChange={(v) => set("skin", v)} label="Skin tone" />
      </Field>
      <Field title="Hair">
        <Chips items={HAIRS} value={a.hair} onChange={(v) => set("hair", v)} label="Hair" />
        {a.hair !== "bald" && a.hair !== "headwrap" ? <Swatches colors={HAIR_COLOR} value={a.hairColor} onChange={(v) => set("hairColor", v)} label="Hair colour" /> : null}
      </Field>
      <Field title="Outfit">
        <Chips items={OUTFITS} value={a.outfit} onChange={(v) => set("outfit", v)} label="Outfit" />
        <Swatches colors={OUTFIT_COLOR} value={a.outfitColor} onChange={(v) => set("outfitColor", v)} label="Outfit colour" />
      </Field>
      <Field title="Details">
        <div className="flex flex-wrap gap-2">
          {([["glasses", "Glasses"], ["earrings", "Earrings"]] as const).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={a[k]} onClick={() => set(k, !a[k])} className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold ${a[k] ? "bg-primary text-white" : "bg-brand-soft text-primary"}`}>
              {a[k] ? <Check className="size-4" /> : null}
              {label}
            </button>
          ))}
        </div>
        <Chips items={[{ id: "none", label: "No beard" }, { id: "short", label: "Short beard" }, { id: "full", label: "Full beard" }] as { id: AvatarConfig["beard"]; label: string }[]} value={a.beard} onChange={(v) => set("beard", v)} label="Beard" />
      </Field>
      <Field title="Background">
        <Swatches colors={BG} value={a.bg} onChange={(v) => set("bg", v)} label="Background" />
      </Field>
    </div>
  );
}
