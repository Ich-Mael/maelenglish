"use client";

import { useEffect, useRef, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { completeStep } from "@/app/(app)/learn-actions";
import { pushReward } from "@/components/gamify/reward-store";
import { readQueue, removeFromQueue } from "./offline-queue";
import { useOnline } from "./online";

/** Registers the service worker (production only — it would cache dev builds). */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}

/** Offline banner + replays results saved offline when the connection comes back. */
export function OfflineSync() {
  const online = useOnline();
  const [pending, setPending] = useState(0);
  const flushing = useRef(false);

  useEffect(() => {
    const update = () => setPending(readQueue().length);
    update();
    window.addEventListener("me-queue", update);
    return () => window.removeEventListener("me-queue", update);
  }, []);

  useEffect(() => {
    if (!online || flushing.current || !readQueue().length) return;
    flushing.current = true;
    (async () => {
      for (const item of readQueue()) {
        try {
          const res = await completeStep(item.courseId, item.stepId);
          // Refused by the server (e.g. access ended): drop it; network errors keep it for later.
          removeFromQueue(item.id);
          if (res.ok) pushReward(res.reward);
        } catch {
          break;
        }
      }
      flushing.current = false;
    })();
  }, [online]);

  if (online && !pending) return null;
  return (
    <div role="status" className="sticky top-14 z-20 flex items-center justify-center gap-2 bg-ink px-4 py-2 text-center text-sm font-semibold text-white">
      {online ? (
        <>
          <RefreshCw className="size-4 animate-spin" aria-hidden /> Sending the results saved offline…
        </>
      ) : (
        <>
          <CloudOff className="size-4" aria-hidden /> Offline — pages you already opened stay available{pending ? ` · ${pending} result${pending > 1 ? "s" : ""} waiting` : ""}.
        </>
      )}
    </div>
  );
}
