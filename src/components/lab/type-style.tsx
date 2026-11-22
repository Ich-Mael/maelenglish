import type { ActivityType, SkillFamily } from "@/lib/lab/types";
import { cn } from "cn";

/*
 * Look of each Lab activity type in the admin (library, editor header): a header band in brand
 * colours, a small sketch of what the learner sees, an example title and what the type offers.
 * The speaking challenge has its own navy « hero » look (it closes every unit).
 */

export const SKILL_NAME: Record<SkillFamily, string> = {
  listening: "Listening",
  language: "Grammar & vocabulary",
  reading: "Reading",
  writing: "Writing",
  pronunciation: "Pronunciation",
  speaking: "Speaking",
};

export const TYPE_LOOK: Record<ActivityType, { band: string; tile: string; example: string; perks: string[] }> = {
  listen_choose: {
    band: "bg-gradient-to-br from-primary to-brand-dark text-white",
    tile: "bg-gradient-to-br from-primary to-brand-dark text-white",
    example: "E.g. Annonce à la porte d'embarquement",
    perks: ["Audio clip", "Multiple choice", "Replays the answer passage"],
  },
  listen_fill_gaps: {
    band: "bg-gradient-to-br from-brand-dark via-primary to-primary text-white",
    tile: "bg-gradient-to-br from-brand-dark to-primary text-white",
    example: "E.g. Fatou présente son travail",
    perks: ["Transcript with blanks", "Replays each sentence", "Exam mode: 2–3 plays"],
  },
  fill_gaps: {
    band: "bg-gradient-to-br from-brand-soft via-white to-brand-soft text-primary",
    tile: "bg-brand-soft text-primary",
    example: "E.g. Se présenter : le verbe to be",
    perks: ["Word shapes as hints", "Optional word bank", "Typo tolerance"],
  },
  sentence_builder: {
    band: "bg-gradient-to-br from-white via-brand-soft to-brand-soft text-primary",
    tile: "bg-brand-soft text-primary",
    example: "E.g. Construire sa présentation",
    perks: ["Tap the tiles in order", "Distractor tiles", "Sentence audio"],
  },
  match_pairs: {
    band: "bg-gradient-to-br from-brand-soft via-brand-soft to-white text-primary",
    tile: "bg-brand-soft text-primary",
    example: "E.g. Vocabulaire de l'aéroport",
    perks: ["Tap to match", "Mistakes & time", "Word audio"],
  },
  speaking_challenge: {
    band: "bg-gradient-to-br from-brand-deep via-brand-deep to-brand-dark text-white",
    tile: "bg-gradient-to-br from-brand-deep to-brand-dark text-white ring-2 ring-coral",
    example: "E.g. Accueillez vos passagers",
    perks: ["Picture, video or audio prompt", "Coach feedback by voice note", "3 sends, redo after feedback"],
  },
};

/** Types drawn on a light band (blue on white) rather than a dark one. */
export const isLightType = (t: ActivityType) => t === "fill_gaps" || t === "sentence_builder" || t === "match_pairs";

/** Exercises planned in the catalogue (shown as « coming next »). */
export const COMING_NEXT = [
  { name: "Error hunt", skill: "language" as SkillFamily },
  { name: "True / false / not given", skill: "reading" as SkillFamily },
  { name: "Repeat after Mael", skill: "pronunciation" as SkillFamily },
  { name: "Email builder", skill: "writing" as SkillFamily },
];

const WAVE = [40, 70, 55, 90, 60, 100, 75, 45, 85, 60, 95, 50, 70, 40, 80, 55, 65, 35];

/** Small sketch of the learner screen (decorative). */
export function TypeArt({ type, className }: { type: ActivityType; className?: string }) {
  const light = isLightType(type);
  const line = light ? "bg-primary/20" : "bg-white/35";
  return (
    <div aria-hidden className={cn("pointer-events-none select-none", className)}>
      {(type === "listen_choose" || type === "listen_fill_gaps") && (
        <div className="grid gap-2.5">
          <div className="flex h-9 items-center gap-[3px]">
            <span className="mr-1 flex size-7 items-center justify-center rounded-full bg-white text-primary">
              <span className="ml-0.5 size-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-current" />
            </span>
            {WAVE.map((h, i) => (
              <span key={i} className={cn("w-1 rounded-full", i < 7 ? "bg-white" : "bg-white/40")} style={{ height: `${h}%` }} />
            ))}
          </div>
          {type === "listen_choose" ? (
            <div className="flex gap-1.5">
              {["A", "B", "C"].map((l, i) => (
                <span key={l} className={cn("flex h-6 flex-1 items-center gap-1 rounded-lg px-1.5 text-[10px] font-bold", i === 1 ? "bg-white text-primary" : "bg-white/20 text-white")}>
                  {l} <span className={cn("h-1 flex-1 rounded-full", i === 1 ? "bg-primary/30" : "bg-white/40")} />
                </span>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className={cn("h-1.5 w-10 rounded-full", line)} />
              <span className="h-5 w-12 rounded-md border-2 border-dashed border-white/80" />
              <span className={cn("h-1.5 w-14 rounded-full", line)} />
            </div>
          )}
        </div>
      )}
      {type === "fill_gaps" && (
        <div className="grid gap-2">
          {[
            [12, 0, 16],
            [8, 14, 10],
            [16, 0, 6],
          ].map((row, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className={cn("h-1.5 rounded-full", line)} style={{ width: `${row[0] * 4}px` }} />
              <span className={cn("flex h-5 items-end gap-0.5 rounded-md border-2 px-1 pb-0.5", i === 1 ? "border-primary bg-white" : "border-primary/40 bg-white/70")}>
                {Array.from({ length: i === 2 ? 5 : 3 }, (_, k) => (
                  <span key={k} className="h-0.5 w-1.5 rounded-full bg-primary/60" />
                ))}
              </span>
              {row[1] > 0 && <span className={cn("h-1.5 rounded-full", line)} style={{ width: `${row[1] * 4}px` }} />}
              <span className={cn("h-1.5 rounded-full", line)} style={{ width: `${row[2] * 4}px` }} />
            </div>
          ))}
        </div>
      )}
      {type === "sentence_builder" && (
        <div className="grid gap-2">
          <div className="flex h-7 items-center gap-1 rounded-lg border-2 border-dashed border-primary/30 px-1.5">
            {["I", "would like"].map((w) => (
              <span key={w} className="rounded-md border border-primary/30 bg-white px-1.5 text-[10px] font-bold text-brand-deep">
                {w}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {["a meeting", "to book", "on Monday."].map((w, i) => (
              <span key={w} className={cn("rounded-md border px-1.5 text-[10px] font-bold shadow-[0_2px_0_0_var(--color-border)]", i === 1 ? "border-primary bg-white text-primary" : "border-border bg-white text-brand-deep")}>
                {w}
              </span>
            ))}
          </div>
        </div>
      )}
      {type === "match_pairs" && (
        <div className="grid grid-cols-2 gap-x-5 gap-y-1.5">
          {[
            ["gate", "porte", true],
            ["delay", "retard", false],
            ["luggage", "bagages", false],
          ].map(([l, r, done], i) => (
            <div key={i} className="contents">
              <span className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-bold", done ? "border-primary bg-primary text-white" : i === 1 ? "border-primary bg-white text-primary ring-2 ring-primary/25" : "border-border bg-white text-brand-deep")}>{l as string}</span>
              <span className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-bold", done ? "border-primary bg-primary text-white" : "border-border bg-white text-brand-deep")}>{r as string}</span>
            </div>
          ))}
        </div>
      )}
      {type === "speaking_challenge" && (
        <div className="relative flex size-36 items-center justify-center">
          <span className="absolute inset-0 rounded-full border-2 border-white/10" />
          <span className="absolute inset-4 rounded-full border-2 border-white/20" />
          <span className="absolute inset-8 rounded-full bg-[radial-gradient(circle,rgb(255_87_87/0.35),transparent_70%)]" />
          <span className="relative flex size-16 items-center justify-center rounded-full border-4 border-coral bg-white shadow-[0_6px_0_0_var(--color-coral)]">
            <svg viewBox="0 0 24 24" className="size-8 text-coral" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          </span>
          <span className="absolute top-3 right-1 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold text-coral-dark">
            <span className="size-1.5 rounded-full bg-coral" /> REC
          </span>
        </div>
      )}
    </div>
  );
}
