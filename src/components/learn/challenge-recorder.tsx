"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleCheck, Loader2 } from "lucide-react";
import { Recorder, type Recording } from "@/components/audio/recorder";
import { uploadMedia } from "@/components/audio/upload";
import { submitUnitChallenge } from "@/app/(app)/learn-actions";
import { pushReward } from "@/components/gamify/reward-store";
import { playSound } from "@/components/gamify/sound";

/*
 * Unit speaking challenge: record (prep countdown, time limit, listen back, re-record), then send.
 * The audio goes straight to storage (`uploadMedia`, retried on bad networks), then the action
 * records it as the answer — which opens the rest of the course. Staff preview: nothing is uploaded.
 */
export function ChallengeRecorder({
  courseId,
  stepId,
  maxSeconds,
  prepSeconds,
  preview,
  resend,
  courseHref,
}: {
  courseId: string;
  stepId: string;
  maxSeconds: number;
  prepSeconds: number;
  preview: boolean;
  resend: boolean;
  courseHref: string;
}) {
  const [phase, setPhase] = useState<"record" | "sending" | "sent">("record");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const send = async (rec: Recording) => {
    setError("");
    setPhase("sending");
    try {
      const mediaId = preview ? null : await uploadMedia(rec.blob, { kind: "recording", durationS: rec.durationS, onProgress: (s) => setNote(s === "retrying" ? "Unstable connection: trying again…" : "Uploading your recording…") });
      const r = await submitUnitChallenge({ courseId, stepId, mediaId });
      if (r?.error) throw new Error(r.error);
      playSound("correct");
      pushReward(r?.reward ?? null);
      setNote(r?.success ?? "");
      setPhase("sent");
    } catch (e) {
      setError((e as Error).message || "The upload failed. Try again.");
      setPhase("record");
    }
  };

  if (phase === "sent") {
    return (
      <div className="grid gap-4 rounded-3xl border-2 border-primary/25 bg-gradient-to-br from-brand-soft to-white p-5 sm:p-6" role="status">
        <p className="flex items-center gap-2 font-heading text-lg font-bold text-brand-deep">
          <CircleCheck className="size-6 text-primary" aria-hidden /> {note}
        </p>
        <Link href={courseHref} className="inline-flex h-12 w-fit items-center rounded-2xl bg-primary px-6 font-semibold text-white">
          Continue the course
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {error && (
        <p role="alert" className="rounded-2xl border-2 border-coral/40 bg-coral-soft p-3 text-sm font-semibold text-coral-dark">
          {error}
        </p>
      )}
      {phase === "sending" ? (
        <p className="flex items-center gap-3 rounded-3xl border-2 border-border bg-card p-5 font-semibold text-brand-deep" aria-live="polite">
          <Loader2 className="size-5 animate-spin text-primary motion-reduce:animate-none" aria-hidden /> {note || "Envoi…"}
        </p>
      ) : (
        <Recorder maxSeconds={maxSeconds} prepSeconds={prepSeconds} onUse={(rec) => void send(rec)} useLabel={resend ? "Send again to my coach" : "Send to my coach"} />
      )}
    </div>
  );
}
