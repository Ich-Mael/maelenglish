"use client";

import { useState } from "react";
import { ArrowRight, Languages, Loader2, Pause, Volume2 } from "lucide-react";
import type { AvatarConfig, Scene } from "@/lib/story/schema";
import { Avatar } from "./avatar";
import type { useStoryAudio } from "./use-audio";

/*
 * A story scene (intro, outro, recap): the narrator's lines in French, the characters' in English
 * with their avatar, ▶ (their voice) and « Translate » (the line's French). One line at a time,
 * then the whole scene stays readable.
 */

export type CastMember = { id: string; name: string; avatar: AvatarConfig | null };

export function SceneView({ scene, refPrefix, cast, audio, onDone, doneLabel, fill }: { scene: Scene; refPrefix: "intro" | "outro" | "recap"; cast: CastMember[]; audio: ReturnType<typeof useStoryAudio>; onDone: () => void; doneLabel: string; fill: (s: string) => string }) {
  const [shown, setShown] = useState(1);
  const [fr, setFr] = useState<Set<number>>(new Set());
  const lines = scene.lines.slice(0, shown);
  const last = shown >= scene.lines.length;

  const next = () => {
    const i = shown;
    setShown(shown + 1);
    const line = scene.lines[i];
    if (line?.text_en && line.speaker !== "narrator") void audio.play(`${refPrefix}:${i}`, fill(line.text_en));
  };

  return (
    <div className="grid gap-3">
      <ol className="grid gap-3" aria-live="polite">
        {lines.map((l, i) => {
          if (l.speaker === "narrator" || !l.text_en) {
            return (
              <li key={i} lang="fr" className="animate-pop rounded-2xl bg-brand-deep/5 px-4 py-3 text-ink/85 italic">
                {fill(l.text_fr ?? l.text_en ?? "")}
              </li>
            );
          }
          const who = cast.find((c) => c.id === l.speaker);
          const ref = `${refPrefix}:${i}`;
          return (
            <li key={i} className="flex animate-pop items-end gap-2.5">
              <Avatar config={who?.avatar} size={44} title={who?.name} />
              <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm ring-1 ring-primary/15">
                <p className="text-xs font-bold text-primary">{who?.name ?? l.speaker}</p>
                <p lang="en" className="text-lg leading-snug text-ink">
                  {fill(l.text_en)}
                </p>
                {fr.has(i) && l.text_fr ? (
                  <p lang="fr" className="mt-1 text-sm text-muted-foreground">
                    {fill(l.text_fr)}
                  </p>
                ) : null}
                <div className="mt-2 flex gap-1.5">
                  <button type="button" onClick={() => void audio.play(ref, fill(l.text_en ?? ""))} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-primary" aria-label="Listen">
                    {audio.loading === ref ? <Loader2 className="size-3.5 animate-spin" /> : audio.playing === ref ? <Pause className="size-3.5" /> : <Volume2 className="size-3.5" />} Listen
                  </button>
                  {l.text_fr ? (
                    <button type="button" aria-pressed={fr.has(i)} onClick={() => setFr((s) => new Set(s.has(i) ? [...s].filter((x) => x !== i) : [...s, i]))} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-ink/70">
                      <Languages className="size-3.5" /> Translate
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <button type="button" onClick={last ? onDone : next} className="inline-flex items-center justify-center gap-2 justify-self-end rounded-2xl bg-primary px-6 py-3 font-bold text-white shadow-[0_4px_0_0_var(--color-brand-deep)]">
        {last ? doneLabel : "Next"} <ArrowRight className="size-4" />
      </button>
    </div>
  );
}
