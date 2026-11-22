"use client";

import { useRef, useState } from "react";
import type { ListenGapsContent } from "@/lib/lab/types";
import { ClipField, type Clip } from "./clip-field";
import { GapsEditor } from "./gaps-editor";

/*
 * Listen and fill the gaps — admin editor (English): the audio (upload or record, play limit) and
 * its transcript with the answers in [square brackets] and optional « @m:ss » line times. Everything
 * but the rich context goes into « c_json » (the gaps editor's JSON + the audio fields).
 */
export function ListenGapsEditor({ initial, audioUrl }: { initial: Partial<ListenGapsContent>; audioUrl: string | null }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [clip, setClip] = useState<Clip>({ id: initial.audioMediaId ?? "", durationS: initial.audioDurationS ?? 0, url: audioUrl });
  const [maxPlays, setMaxPlays] = useState(initial.maxPlays ?? 0);
  const player = {
    position: () => audio.current?.currentTime ?? null,
    playFrom: (t: number) => {
      const a = audio.current;
      if (!a) return;
      a.currentTime = t;
      void a.play();
    },
  };
  return (
    <div className="grid gap-5">
      <ClipField clip={clip} onChange={setClip} maxPlays={maxPlays} onMaxPlays={setMaxPlays} audioRef={audio} />
      <GapsEditor initial={{ ...initial, typos: initial.typos ?? false }} player={player} extra={{ audioMediaId: clip.id, audioDurationS: clip.durationS, maxPlays }} />
    </div>
  );
}
