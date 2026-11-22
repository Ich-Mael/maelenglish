"use client";

import { useRef, useState } from "react";
import { Play, Square } from "lucide-react";
import { inputCls } from "@/components/admin/ui";
import type { Voice } from "@/lib/ai/types";

/** ElevenLabs voice for an AI role-play, with its preview sample. Sends c_voiceId + c_voiceName. */
export function VoicePicker({ voices, initialId, initialName }: { voices: Voice[]; initialId: string; initialName: string }) {
  const [id, setId] = useState(initialId);
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const known = voices.some((v) => v.id === initialId);
  const current = voices.find((v) => v.id === id);
  const name = current?.name ?? (id === initialId ? initialName : "");

  const toggle = () => {
    if (playing) {
      audio.current?.pause();
      return setPlaying(false);
    }
    if (!current?.previewUrl) return;
    audio.current?.pause();
    const a = new Audio(current.previewUrl);
    audio.current = a;
    a.onended = () => setPlaying(false);
    void a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  return (
    <label className="grid content-start gap-1 text-sm">
      <span className="font-medium">Voice of the AI</span>
      <span className="flex gap-2">
        <select
          className={inputCls}
          value={id}
          onChange={(e) => {
            audio.current?.pause();
            setPlaying(false);
            setId(e.target.value);
          }}
        >
          <option value="">Default voice</option>
          {!known && initialId && <option value={initialId}>{initialName || initialId}</option>}
          {voices.map((v) => (
            <option key={v.id} value={v.id}>
              {[v.name, v.accent, v.gender].filter(Boolean).join(" · ")}
            </option>
          ))}
        </select>
        <button type="button" onClick={toggle} disabled={!current?.previewUrl} className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-input text-primary hover:bg-brand-soft disabled:opacity-40" aria-label={playing ? "Stop the sample" : "Hear a sample"}>
          {playing ? <Square className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
        </button>
      </span>
      <input type="hidden" name="c_voiceId" value={id} />
      <input type="hidden" name="c_voiceName" value={name} />
      <span className="text-xs text-muted-foreground">{voices.length ? "Voices of the ElevenLabs account (a cloned « Coach Ish » voice appears here once created)." : "ElevenLabs isn't configured (ELEVENLABS_API_KEY): the default voice will be used."}</span>
    </label>
  );
}
