"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, Loader2 } from "lucide-react";
import { useOnline } from "./online";

const KEY = "me-downloaded-courses-v3";
const readSaved = (): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
};

/**
 * « Disponible hors ligne »: asks the service worker to fetch every lesson
 * page of the course (with its scripts) so it opens without connection.
 * Videos hosted on YouTube / Vimeo still need the internet.
 */
export function DownloadCourse({ courseId, urls }: { courseId: string; urls: string[] }) {
  const online = useOnline();
  const [state, setState] = useState<"idle" | "busy" | "done" | "unsupported">("idle");
  const [progress, setProgress] = useState({ done: 0, total: urls.length });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only state, known after mount
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") setState("unsupported");
    else if (readSaved()[courseId]) setState("done");
  }, [courseId]);

  async function download() {
    const reg = await navigator.serviceWorker.ready;
    if (!reg.active) return;
    setState("busy");
    const channel = new MessageChannel();
    channel.port1.onmessage = (e) => {
      setProgress({ done: e.data.done, total: e.data.total });
      if (e.data.type === "done") {
        try {
          localStorage.setItem(KEY, JSON.stringify({ ...readSaved(), [courseId]: Date.now() }));
        } catch {}
        setState("done");
      }
    };
    reg.active.postMessage({ type: "download", urls }, [channel.port2]);
  }

  if (state === "unsupported") return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-dashed border-border p-3 text-sm">
      {state === "done" ? (
        <>
          <CheckCircle2 className="size-5 text-success" aria-hidden />
          <span className="flex-1 font-semibold text-ink">Disponible hors ligne</span>
          {online && (
            <button type="button" onClick={download} className="font-semibold text-primary hover:underline">
              Mettre à jour
            </button>
          )}
        </>
      ) : state === "busy" ? (
        <>
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
          <span className="flex-1" aria-live="polite">
            Téléchargement… {progress.done}/{progress.total}
          </span>
        </>
      ) : (
        <>
          <Download className="size-5 text-primary" aria-hidden />
          <span className="flex-1 text-ink/80">Téléchargez le cours pour réviser sans connexion (hors vidéos).</span>
          <button type="button" onClick={download} disabled={!online} className="rounded-xl bg-primary px-3 py-2 font-semibold text-white disabled:opacity-50">
            Télécharger
          </button>
        </>
      )}
    </div>
  );
}
