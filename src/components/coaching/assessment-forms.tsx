"use client";

import { useState, useTransition } from "react";
import { Loader2, Mic, RotateCcw, Send } from "lucide-react";
import { answerAssessmentAction, reviewAssessmentAction, setupAssessmentAction, submitAssessmentAction } from "@/app/coaching-actions";
import { AdminForm, Submit } from "@/components/admin/forms";
import { Select, TextArea } from "@/components/admin/ui";
import { Recorder } from "@/components/audio/recorder";
import { uploadMedia } from "@/components/audio/upload";
import { CRITERION_LABEL } from "./assessment-ui";

const CRITERIA = ["fluency", "vocabulary", "grammar", "pronunciation", "clarity"] as const;

/** The coach sets up a phase: prompts one per line (2–5) and the answer length. */
export function AssessmentSetupForm({ coachingId, phase, prompts, maxSeconds, open }: { coachingId: string; phase: "start" | "end"; prompts: string[]; maxSeconds: number; open: boolean }) {
  return (
    <AdminForm action={setupAssessmentAction}>
      <input type="hidden" name="coachingId" value={coachingId} />
      <input type="hidden" name="phase" value={phase} />
      <TextArea label="Questions (one per line, 2 to 5 — in French is fine, they answer in English)" name="prompts" rows={5} defaultValue={prompts.join("\n")} />
      <Select label="Longest answer" name="maxSeconds" defaultValue={String(maxSeconds)} options={[60, 90, 120, 180].map((s) => ({ value: String(s), label: s < 120 ? `${s} seconds` : `${s / 60} minutes` }))} className="max-w-56" />
      <Submit className="w-fit">{open ? "Save the questions" : "Open the assessment"}</Submit>
      {!open && <p className="text-xs text-muted-foreground">Everyone in the coaching gets an email. The questions can be changed until someone answers.</p>}
    </AdminForm>
  );
}

/** A member records their answer to one question (again until they send). */
export function AnswerQuestion({ coachingId, phase, promptId, maxSeconds, recordedUrl }: { coachingId: string; phase: "start" | "end"; promptId: string; maxSeconds: number; recordedUrl: string | null }) {
  const [again, setAgain] = useState(false);
  const [state, setState] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState("");
  const [, start] = useTransition();
  if (recordedUrl && !again)
    return (
      <div className="flex flex-wrap items-center gap-3">
        <audio controls preload="none" src={recordedUrl} className="h-10 max-w-full min-w-0 flex-1" />
        <button type="button" onClick={() => setAgain(true)} className="inline-flex h-10 items-center gap-1.5 rounded-xl border-2 border-border bg-white px-3 text-sm font-semibold text-brand-deep hover:border-primary/40">
          <RotateCcw className="size-4" aria-hidden /> Record again
        </button>
      </div>
    );
  return (
    <div className="grid gap-2">
      <Recorder
        maxSeconds={maxSeconds}
        prepSeconds={5}
        locale="en"
        useLabel="Keep this answer"
        disabled={state === "sending"}
        onUse={(rec) => {
          setError("");
          setState("sending");
          start(async () => {
            try {
              const mediaId = await uploadMedia(rec.blob, { kind: "recording", durationS: rec.durationS });
              const r = await answerAssessmentAction(coachingId, phase, promptId, mediaId);
              if (!r.ok) throw new Error(r.error);
              setAgain(false);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setState("idle");
            }
          });
        }}
      />
      {state === "sending" && (
        <p className="flex items-center gap-2 text-sm font-semibold text-brand-deep" aria-live="polite">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Saving your answer…
        </p>
      )}
      {error && <p className="text-sm font-semibold text-coral-dark">{error}</p>}
    </div>
  );
}

/** « Send to my coach » once every question is answered. */
export function SendAssessment({ coachingId, phase, left }: { coachingId: string; phase: "start" | "end"; left: number }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="grid justify-items-start gap-2">
      <button
        type="button"
        disabled={pending || left > 0}
        onClick={() =>
          start(async () => {
            setError("");
            const r = await submitAssessmentAction(coachingId, phase);
            if (!r.ok) setError(r.error);
          })
        }
        className="inline-flex h-12 items-center gap-2 rounded-2xl bg-primary px-6 text-[17px] font-bold text-white shadow-[0_4px_0_0_var(--color-brand-dark)] disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Send className="size-5" aria-hidden />} Send to my coach
      </button>
      <p className="text-sm text-muted-foreground">{left > 0 ? `${left} question${left > 1 ? "s" : ""} left to answer.` : "Every question is answered: you can still record one again before sending."}</p>
      {error && <p className="text-sm font-semibold text-coral-dark">{error}</p>}
    </div>
  );
}

/** The coach's scores (0–10 per criterion) and comment. */
export function AssessmentReviewForm({ answerId, scores, comment }: { answerId: string; scores: Partial<Record<(typeof CRITERIA)[number], number | null>> | null; comment: string }) {
  const options = [{ value: "", label: "—" }, ...Array.from({ length: 11 }, (_, i) => ({ value: String(i), label: `${i} / 10` }))];
  return (
    <AdminForm action={reviewAssessmentAction}>
      <input type="hidden" name="answerId" value={answerId} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {CRITERIA.map((c) => (
          <Select key={c} label={CRITERION_LABEL[c]} name={c} defaultValue={scores?.[c] != null ? String(scores[c]) : ""} options={options} />
        ))}
      </div>
      <TextArea label="Comment for the learner (in French)" name="comment" rows={3} defaultValue={comment} placeholder="Points forts, ce qu'il faut travailler en priorité." />
      <Submit className="w-fit">
        <Mic className="size-4" aria-hidden /> {scores ? "Update the scores" : "Send the scores"}
      </Submit>
    </AdminForm>
  );
}
