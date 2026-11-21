"use client";

import { useState } from "react";
import { CloudUpload } from "lucide-react";
import { Recorder, pickMime, type Recording } from "@/components/audio/recorder";
import { uploadMedia } from "@/components/audio/upload";
import { getMediaUrl } from "@/app/media-actions";

/**
 * Microphone check: record, listen back, see format / size, and optionally test the upload
 * to storage end to end (the test file is kept as a private recording of the staff member).
 */
export function MicTest() {
  const [info, setInfo] = useState<Recording | null>(null);
  const [state, setState] = useState<"" | "sending" | "done" | "error">("");
  const [msg, setMsg] = useState("");
  const [url, setUrl] = useState("");

  const testUpload = async () => {
    if (!info) return;
    setState("sending");
    setUrl("");
    try {
      const id = await uploadMedia(info.blob, { kind: "recording", durationS: info.durationS });
      const r = await getMediaUrl(id);
      if (!r.ok) throw new Error(r.error);
      setUrl(r.data.url);
      setState("done");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error");
      setState("error");
    }
  };

  return (
    <div className="grid gap-4">
      <Recorder maxSeconds={30} onUse={(r) => { setInfo(r); setState(""); setUrl(""); }} useLabel="Show details" locale="en" />
      {info && (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="font-semibold">Format</dt>
            <dd>{info.mime || pickMime() || "unknown"}</dd>
            <dt className="font-semibold">Duration</dt>
            <dd>{info.durationS.toFixed(1)} s</dd>
            <dt className="font-semibold">Size</dt>
            <dd>{(info.blob.size / 1024).toFixed(0)} KB</dd>
          </dl>
          <div className="grid gap-2">
            <button type="button" onClick={() => void testUpload()} disabled={state === "sending"} className="inline-flex h-10 w-fit items-center gap-2 rounded-xl border-2 border-border px-4 text-sm font-bold text-brand-deep hover:bg-brand-soft disabled:opacity-50">
              <CloudUpload className="size-4" aria-hidden /> {state === "sending" ? "Uploading…" : "Test the upload"}
            </button>
            {state === "done" && (
              <div className="grid gap-1 text-sm">
                <p className="font-semibold text-primary">Uploaded and read back from storage:</p>
                <audio src={url} controls className="w-full" />
              </div>
            )}
            {state === "error" && <p className="text-sm font-semibold text-coral-dark">{msg}</p>}
          </div>
        </>
      )}
    </div>
  );
}
