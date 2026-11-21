"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { completeStep } from "@/app/(app)/learn-actions";
import { pushReward } from "@/components/gamify/reward-store";
import { playSound } from "@/components/gamify/sound";
import { enqueue, isOfflineError } from "@/components/pwa/offline-queue";

/** « Continuer » at the end of a lesson step: records completion, then goes to the next step. */
export function CompleteButton({ courseId, stepId, done, nextHref }: { courseId: string; stepId: string; done: boolean; nextHref: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            if (!done) {
              try {
                const res = await completeStep(courseId, stepId);
                if (!res.ok) return setError(res.error ?? "Une erreur est survenue.");
                if (res.reward) playSound("correct");
                pushReward(res.reward);
              } catch (e) {
                if (!isOfflineError(e)) return setError("Une erreur est survenue. Réessayez.");
                // Offline: keep the completion on the device, sent when the connection returns.
                enqueue({ kind: "complete", courseId, stepId });
                playSound("correct");
              }
            }
            router.push(nextHref);
          })
        }
        className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl border-2 border-coral bg-white text-[19px] font-bold text-coral hover:bg-coral-soft shadow-[0_5px_0_0_var(--color-coral)] transition active:translate-y-1 active:shadow-[0_1px_0_0_var(--color-coral)] sm:w-auto sm:px-10"
      >
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <ArrowRight className="size-5" aria-hidden />}
        {done ? "Activité suivante" : "Continuer"}
      </button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
