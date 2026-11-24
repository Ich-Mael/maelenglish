"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Recorder } from "@/components/audio/recorder";
import { uploadMedia } from "@/components/audio/upload";
import { submitCoachingChallengeAction } from "@/app/coaching-actions";

/** Records a speaking challenge assigned in a coaching and sends it to the coach. */
export function ChallengeTask({ taskId, maxSeconds, prepSeconds, label }: { taskId: string; maxSeconds: number; prepSeconds: number; label: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const [, start] = useTransition();
  if (state === "sent") return <p className="rounded-2xl bg-brand-soft p-4 font-semibold text-brand-deep">Sent! Your coach will listen and answer here.</p>;
  return (
    <div className="grid gap-3">
      <Recorder
        maxSeconds={maxSeconds}
        prepSeconds={prepSeconds}
        locale="en"
        useLabel={label}
        disabled={state === "sending"}
        onUse={(rec) => {
          setError("");
          setState("sending");
          start(async () => {
            try {
              const mediaId = await uploadMedia(rec.blob, { kind: "recording", durationS: rec.durationS });
              const r = await submitCoachingChallengeAction(taskId, mediaId);
              if (!r.ok) throw new Error(r.error);
              setState("sent");
            } catch (e) {
              setError((e as Error).message);
              setState("idle");
            }
          });
        }}
      />
      {state === "sending" && (
        <p className="flex items-center gap-2 text-sm font-semibold text-brand-deep" aria-live="polite">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Sending…
        </p>
      )}
      {error && <p className="text-sm font-semibold text-coral-dark">{error}</p>}
    </div>
  );
}
