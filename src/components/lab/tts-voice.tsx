"use client";

import { createContext, useContext, useRef, useState, useSyncExternalStore } from "react";
import { Play, Square } from "lucide-react";
import { inputCls } from "@/components/admin/ui";
import type { Voice } from "@/lib/ai/types";

/*
 * The ElevenLabs voice used by « Generate with ElevenLabs » in a Lab editor (remembered on the
 * device). `TtsVoiceProvider` gives it to every AudioField below; null = ElevenLabs not configured.
 */

const KEY = "me-lab-tts-voice";
export type TtsVoices = { voices: Voice[]; defaultId: string } | null;
const listeners = new Set<() => void>();
const readSaved = () => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};
function save(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((cb) => cb());
}
const Ctx = createContext<{ voiceId: string } | null>(null);
export const useTtsVoice = () => useContext(Ctx);

export function TtsVoiceProvider({ tts, children }: { tts: TtsVoices; children: React.ReactNode }) {
  const saved = useSyncExternalStore((cb) => (listeners.add(cb), () => listeners.delete(cb)), readSaved, () => "");
  const voiceId = saved && tts?.voices.some((v) => v.id === saved) ? saved : (tts?.defaultId ?? "");
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  if (!tts) return <>{children}</>;
  const current = tts.voices.find((v) => v.id === voiceId);
  const toggle = () => {
    audio.current?.pause();
    if (playing || !current?.previewUrl) return setPlaying(false);
    const a = new Audio(current.previewUrl);
    audio.current = a;
    a.onended = () => setPlaying(false);
    void a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };
  return (
    <Ctx.Provider value={{ voiceId }}>
      <label className="grid max-w-md gap-1 text-sm">
        <span className="font-medium">ElevenLabs voice for « Generate »</span>
        <span className="flex gap-2">
          <select
            className={inputCls}
            value={voiceId}
            onChange={(e) => {
              audio.current?.pause();
              setPlaying(false);
              save(e.target.value);
            }}
          >
            {!current && <option value={voiceId}>Default voice</option>}
            {tts.voices.map((v) => (
              <option key={v.id} value={v.id}>
                {[v.name, v.accent, v.gender].filter(Boolean).join(" · ")}
              </option>
            ))}
          </select>
          <button type="button" onClick={toggle} disabled={!current?.previewUrl} className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-input text-primary hover:bg-brand-soft disabled:opacity-40" aria-label={playing ? "Stop the sample" : "Hear a sample"}>
            {playing ? <Square className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
          </button>
        </span>
        <span className="text-xs text-muted-foreground">Voices of the ElevenLabs account (a cloned « Coach Ish » voice appears here once created).</span>
      </label>
      {children}
    </Ctx.Provider>
  );
}
