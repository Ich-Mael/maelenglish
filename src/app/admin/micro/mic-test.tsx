"use client";

import { useState } from "react";
import { Recorder, pickMime, type Recording } from "@/components/audio/recorder";

/** Local microphone check: record, listen back; shows the format and size (nothing is uploaded). */
export function MicTest() {
  const [info, setInfo] = useState<Recording | null>(null);
  return (
    <div className="grid gap-4">
      <Recorder maxSeconds={30} onUse={setInfo} useLabel="Afficher les détails" />
      {info && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="font-semibold">Format</dt>
          <dd>{info.mime || pickMime() || "inconnu"}</dd>
          <dt className="font-semibold">Durée</dt>
          <dd>{info.durationS.toFixed(1)} s</dd>
          <dt className="font-semibold">Taille</dt>
          <dd>{(info.blob.size / 1024).toFixed(0)} Ko</dd>
        </dl>
      )}
    </div>
  );
}
