"use client";

import { useState } from "react";
import { AudioField } from "@/components/admin/audio-field";

/** AudioField inside a server-rendered activity form: the media id goes in a hidden « name » field. */
export function AudioInput({ name, label, initialId, initialUrl }: { name: string; label: string; initialId: string; initialUrl: string | null }) {
  const [id, setId] = useState(initialId);
  const [url, setUrl] = useState(initialUrl);
  return (
    <>
      <input type="hidden" name={name} value={id} />
      <AudioField
        label={label}
        value={id}
        url={url}
        onChange={(m, u) => {
          setId(m);
          setUrl(u);
        }}
      />
    </>
  );
}
