"use client";

import { useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronDown, Clock, Expand, Loader2, MessageSquareText, PenLine, RotateCcw, Send, Sparkles } from "lucide-react";
import { submitWriting } from "@/app/(app)/learn-actions";
import { previewWritingAction } from "@/app/admin/labo/actions";
import { pushReward } from "@/components/gamify/reward-store";
import { playSound } from "@/components/gamify/sound";
import type { WritingCorrection } from "@/lib/ai/types";
import type { Reward } from "@/lib/gamification/service";
import type { WritingTaskContent } from "@/lib/lab/types";
import { Avatar } from "@/components/account/avatar";
import { ExerciseHeader, type ExerciseMeta } from "../shell/parts";
import { CorrectionView } from "../writing-correction";
import { cn } from "cn";

/*
 * Lab « writing task », reviewed by a coach (owner decision 2026-11-22): the prompt (picture,
 * checklist, word range), a text box with a live word count (draft kept on the device), « Envoyer
 * à mon coach » → « en attente » (the learner may edit and resend while sends are left) → the
 * coach's feedback: comment, the corrections (prepared with a correction tool and checked by the
 * coach — the AI is never shown to learners), the corrected text, the model answer, then
 * « Envoyer une nouvelle version » (3 versions in all). `preview` (Lab page): staff see the AI draft
 * the coach would get, nothing sent.
 */

export type WritingInitial = {
  text: string;
  status: "pending" | "reviewed";
  sentAt: string | null;
  sendsLeft: number;
  sendsAllowed: number;
  feedback: WritingCorrection | null;
  comment: React.ReactNode | null;
  coach: { name: string; avatarUrl: string | null } | null;
  redoAsked: boolean;
};

const noSubscribe = () => () => {};
const count = (t: string) => (t.trim().match(/[A-Za-zÀ-ÿ0-9'’-]+/g) ?? []).length;
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "");

export function WritingPlayer({
  courseId,
  stepId,
  activityId,
  preview,
  title,
  level,
  skills,
  instructions,
  maelTip,
  prompt,
  imageUrl,
  content,
  initial,
  courseHref,
  nextHref,
  readOnly,
}: {
  courseId?: string;
  stepId?: string;
  /** Lab preview: the AI draft through the staff action. */
  activityId?: string;
  preview?: boolean;
  title: string;
  level?: string;
  skills?: string[];
  instructions?: string;
  maelTip?: string;
  prompt: React.ReactNode;
  imageUrl: string | null;
  content: WritingTaskContent;
  initial: WritingInitial | null;
  courseHref: string;
  nextHref: string;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const draftKey = `me-writing:${stepId ?? activityId}`;
  const [text, setText] = useState(initial?.text ?? "");
  const [state, setState] = useState(initial);
  // Editing: no version yet, or the learner chose to send a new one.
  const [editing, setEditing] = useState(!initial);
  const [draft, setDraft] = useState<WritingCorrection | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const box = useRef<HTMLTextAreaElement>(null);

  // A draft typed but not sent is kept on the device: offered back after hydration.
  const savedDraft = useSyncExternalStore(
    noSubscribe,
    () => {
      try {
        return localStorage.getItem(draftKey);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const onType = (v: string) => {
    setText(v);
    try {
      localStorage.setItem(draftKey, v);
    } catch {
      /* storage unavailable */
    }
  };

  const n = count(text);
  const tooShort = n < content.minWords;
  const tooLong = n > content.maxWords;
  const sendsLeft = state?.sendsLeft ?? 3;
  const meta: ExerciseMeta = { title, typeLabel: "Expression écrite", icon: PenLine, level, skills, instructions: instructions || "Lisez la consigne, écrivez votre texte en anglais, puis envoyez-le à votre coach." };

  const send = () => {
    setError("");
    start(async () => {
      if (preview || !courseId || !stepId) {
        const r = await previewWritingAction(activityId ?? "", text);
        if (!r.ok) return setError(r.error);
        setDraft(r.correction);
        return;
      }
      const r = await submitWriting(courseId, stepId, text);
      if (!r.ok) return setError(r.error);
      if (r.result.reward) pushReward(r.result.reward as Reward);
      playSound("correct");
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* storage unavailable */
      }
      setState({ text, status: "pending", sentAt: r.result.sentAt, sendsLeft: r.result.sendsLeft, sendsAllowed: state?.sendsAllowed ?? 3, feedback: null, comment: null, coach: state?.coach ?? null, redoAsked: false });
      setEditing(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };
  const newVersion = () => {
    setEditing(true);
    window.setTimeout(() => {
      box.current?.focus();
      box.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  };

  const coachName = state?.coach?.name || "Votre coach";

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <ExerciseHeader meta={meta} courseHref={courseHref} index={state ? 1 : 0} total={1} />

      {/* The task. */}
      <section className="grid gap-3 rounded-3xl border-2 border-border bg-card p-4 sm:p-6">
        <p className="text-xs font-bold tracking-wide text-primary uppercase">La consigne</p>
        <div className="text-ink">{prompt}</div>
        {imageUrl && (
          <a href={imageUrl} target="_blank" rel="noopener" className="group relative block overflow-clip rounded-2xl border border-border bg-muted" aria-label="Ouvrir l'image en grand">
            {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
            <img src={imageUrl} alt="" className="w-full object-contain" />
            <span aria-hidden className="absolute right-2 bottom-2 flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-brand-deep shadow">
              <Expand className="size-3.5" /> Agrandir
            </span>
          </a>
        )}
        {content.checklist.length > 0 && (
          <div className="rounded-2xl bg-brand-soft/60 px-4 py-3">
            <p className="text-sm font-bold text-brand-deep">Dans votre texte, pensez à :</p>
            <ul className="mt-1 grid gap-1 text-sm text-ink">
              {content.checklist.map((c, i) => (
                <li key={i} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> {c}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          Longueur : {content.minWords} à {content.maxWords} mots.
        </p>
      </section>

      {/* Waiting for the coach. */}
      {state?.status === "pending" && !editing && (
        <section className="grid gap-3 rounded-3xl border-2 border-primary/20 bg-brand-soft/50 p-4 sm:p-6" role="status">
          <p className="flex items-center gap-2 font-heading font-extrabold text-brand-deep">
            <Clock className="size-5 text-primary" aria-hidden /> Texte envoyé {state.sentAt ? `le ${fmt(state.sentAt)}` : ""}
          </p>
          <p className="text-sm text-ink">{coachName} va lire votre texte et vous envoyer ses corrections. Vous pouvez continuer le cours en attendant.</p>
          <details className="group rounded-2xl bg-white px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-primary [&::-webkit-details-marker]:hidden">
              <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden /> Votre texte
            </summary>
            <p lang="en" className="mt-2 leading-relaxed whitespace-pre-line text-ink">
              {state.text}
            </p>
          </details>
          {!readOnly && sendsLeft > 0 && (
            <button type="button" onClick={newVersion} className="w-fit text-sm font-semibold text-primary underline underline-offset-4">
              Modifier et renvoyer ({sendsLeft} envoi{sendsLeft > 1 ? "s" : ""} restant{sendsLeft > 1 ? "s" : ""})
            </button>
          )}
        </section>
      )}

      {/* The coach's feedback. */}
      {state?.status === "reviewed" && !editing && (
        <section className="grid gap-4 rounded-3xl border-2 border-primary/25 bg-card p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <Avatar src={state.coach?.avatarUrl} name={coachName.replace(/^(coach|votre coach)\s*/i, "") || coachName} className="size-11 text-base" />
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-wide text-primary uppercase">Le retour de votre coach</p>
              <p className="font-heading font-extrabold text-brand-deep">{coachName}</p>
            </div>
          </div>
          {state.comment && (
            <div className="flex gap-2">
              <MessageSquareText className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
              <div className="flex-1 rounded-2xl rounded-tl-sm border border-border bg-white p-3 text-ink">{state.comment}</div>
            </div>
          )}
          {state.feedback && <CorrectionView correction={state.feedback} title="Vos corrections" note="Préparées avec un outil de correction et vérifiées par votre coach." />}
          {content.modelAnswer && (
            <details className="group rounded-2xl border border-border px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold text-primary [&::-webkit-details-marker]:hidden">
                <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden /> Un exemple de réponse
              </summary>
              <p lang="en" className="mt-2 leading-relaxed whitespace-pre-line text-ink">
                {content.modelAnswer}
              </p>
            </details>
          )}
          {maelTip && (
            <p className="rounded-2xl bg-brand-soft px-4 py-3 text-sm text-ink">
              <strong className="text-brand-deep">Le conseil de Mael :</strong> {maelTip}
            </p>
          )}
          {state.redoAsked && <p className="rounded-2xl border-2 border-coral bg-white px-4 py-2.5 text-sm font-semibold text-coral-dark">Votre coach vous demande d&apos;envoyer une nouvelle version en tenant compte de ses corrections.</p>}
          {!readOnly && (
            <div className="flex flex-col gap-3 sm:flex-row">
              {sendsLeft > 0 && (
                <button type="button" onClick={newVersion} className={cn("inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl px-5 font-bold", state.redoAsked ? "bg-primary text-white shadow-[0_4px_0_0_var(--color-brand-dark)]" : "border-2 border-primary/40 bg-white text-primary")}>
                  <RotateCcw className="size-4" aria-hidden /> Envoyer une nouvelle version
                </button>
              )}
              <button type="button" onClick={() => router.push(nextHref)} className={cn("inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl px-5 font-bold", state.redoAsked ? "border-2 border-border bg-white text-brand-deep" : "bg-primary text-white shadow-[0_4px_0_0_var(--color-brand-dark)]")}>
                Continuer <ArrowRight className="size-4" aria-hidden />
              </button>
            </div>
          )}
        </section>
      )}

      {/* Writing (first version, or a new one). */}
      {editing && !readOnly && (
        <section className="grid gap-2 rounded-3xl border-2 border-border bg-card p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="writing-answer" className="font-heading font-extrabold text-brand-deep">
              {state ? "Votre nouvelle version (en anglais)" : "Votre texte (en anglais)"}
            </label>
            {savedDraft && savedDraft !== text && (
              <button type="button" onClick={() => setText(savedDraft)} className="text-sm font-semibold text-primary underline underline-offset-4">
                Reprendre mon brouillon
              </button>
            )}
          </div>
          <textarea
            id="writing-answer"
            ref={box}
            lang="en"
            value={text}
            onChange={(e) => onType(e.target.value)}
            disabled={pending}
            rows={10}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="sentences"
            placeholder={"Dear …,\n\nI am writing to …"}
            className="min-h-56 w-full rounded-2xl border-2 border-border bg-background p-3 leading-relaxed text-ink outline-none focus:border-primary focus:ring-3 focus:ring-primary/20"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className={cn("font-semibold tabular-nums", n === 0 ? "text-muted-foreground" : tooShort || tooLong ? "text-coral-dark" : "text-primary")}>
              {n} mot{n > 1 ? "s" : ""} {tooShort && n > 0 ? `· encore ${content.minWords - n} au minimum` : tooLong ? `· ${n - content.maxWords} de trop` : n ? "· bonne longueur" : ""}
            </span>
            {!preview && (
              <span className="text-xs text-muted-foreground">
                {sendsLeft} envoi{sendsLeft > 1 ? "s" : ""} restant{sendsLeft > 1 ? "s" : ""}
              </span>
            )}
          </div>
          {error && (
            <p role="alert" className="text-sm font-semibold text-coral-dark">
              {error}
            </p>
          )}
          <div className="mt-1 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={send}
              disabled={pending || n < 3}
              className="inline-flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-lg font-bold text-white shadow-[0_5px_0_0_var(--color-brand-dark)] transition active:translate-y-1 active:shadow-[0_1px_0_0_var(--color-brand-dark)] disabled:opacity-50 disabled:shadow-none"
            >
              {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : preview ? <Sparkles className="size-5" aria-hidden /> : <Send className="size-5" aria-hidden />}
              {pending ? (preview ? "Préparation du brouillon…" : "Envoi…") : preview ? "Voir le brouillon de correction" : "Envoyer à mon coach"}
            </button>
            {state && (
              <button type="button" onClick={() => setEditing(false)} disabled={pending} className="h-13 rounded-2xl border-2 border-border px-5 font-semibold text-brand-deep">
                Annuler
              </button>
            )}
          </div>
          {preview && <p className="text-xs text-muted-foreground">Aperçu staff : vous voyez le brouillon de correction que recevra le coach. Rien n&apos;est envoyé.</p>}
        </section>
      )}

      {preview && draft && (
        <section className="rounded-3xl border-2 border-primary/25 bg-card p-4 sm:p-6">
          <CorrectionView correction={draft} title="Brouillon de correction (vu par le coach seulement)" note="Le coach le modifie, ajoute son commentaire et l'envoie à l'apprenant." />
        </section>
      )}
    </div>
  );
}
