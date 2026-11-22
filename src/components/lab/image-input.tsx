"use client";

import { useState } from "react";
import { ImageField } from "@/components/admin/image-field";

/** ImageField inside a server-rendered activity form: the media id goes in a hidden « name » field. */
export function ImageInput({ name, label, initialId, initialUrl, maxSide }: { name: string; label: string; initialId: string; initialUrl: string | null; maxSide?: number }) {
  const [image, setImage] = useState({ id: initialId, url: initialUrl });
  return (
    <div className="grid gap-2">
      <input type="hidden" name={name} value={image.id} />
      <span className="text-sm font-medium">{label}</span>
      <ImageField value={image.id} url={image.url} maxSide={maxSide} onChange={(id, url) => setImage({ id, url })} />
    </div>
  );
}
