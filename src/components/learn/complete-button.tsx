"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { completeLesson } from "@/app/(app)/learn-actions";
import { pushReward } from "@/components/gamify/reward-store";
import { playSound } from "@/components/gamify/sound";

/** « J'ai terminé » for video / text / PDF lessons: records completion, then goes to the next step. */
export function CompleteButton({ courseId, lessonId, done, nextHref }: { courseId: string; lessonId: string; done: boolean; nextHref: string }) {
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
              const res = await completeLesson(courseId, lessonId);
              if (!res.ok) return setError(res.error ?? "Une erreur est survenue.");
              if (res.reward) playSound("correct");
              pushReward(res.reward);
            }
            router.push(nextHref);
          })
        }
        className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-coral text-lg font-bold text-white shadow-[0_5px_0_0_var(--color-coral-dark)] transition active:translate-y-1 active:shadow-[0_1px_0_0_var(--color-coral-dark)] sm:w-auto sm:px-10"
      >
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : done ? <ArrowRight className="size-5" aria-hidden /> : <Check className="size-5" aria-hidden />}
        {done ? "Étape suivante" : "J'ai terminé"}
      </button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
