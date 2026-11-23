"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, ArrowRight, AudioLines, Circle, Clock, Headphones, Loader2, MessagesSquare, Mic, Quote, RotateCcw, Sparkles, Target, X } from "lucide-react";
import { finishRolePlayAction, startRolePlayAction } from "@/app/(app)/conversation-actions";
import type { FinishedRolePlay } from "@/lib/conversation/view";
import type { PastAttempt } from "@/lib/conversation/queries";
import { DIFFICULTY_HINT, DIFFICULTY_LABEL, ROLEPLAY_DIFFICULTIES } from "@/lib/lab/types";
import { pushReward } from "@/components/gamify/reward-store";
import { playSound } from "@/components/gamify/sound";
import { DebriefView, TranscriptOnly } from "./debrief-view";
import { MinutesMeter } from "./minutes-meter";
import { cn } from "cn";

/*
 * AI role-play, learner side (Talk with Coach Ish page, unit activity step, Lab preview):
 * brief (situation, roles, goals, useful phrases, difficulty) → live call → « Preparing your
 * debrief… » → debrief (or the transcript and a retry when there is none). The twists and the AI's
 * instructions never reach the browser.
 */

const LiveCall = dynamic(() => import("./live-call"), {
  ssr: false,
  loading: () => (
    <p className="flex items-center justify-center gap-2 rounded-3xl bg-brand-deep p-10 text-white">
      <Loader2 className="size-5 animate-spin" aria-hidden /> Connecting…
    </p>
  ),
});

export type PublicRolePlay = { aiRole: string; learnerRole: string; setting: string; goals: string[]; targetPhrases: string[]; difficulty: number; maxMinutes: number };

type Phase = { kind: "brief" } | { kind: "call"; sessionId: string; signedUrl: string; limitS: number } | { kind: "finishing"; sessionId: string; error?: string } | { kind: "done"; result: FinishedRolePlay };

export function RolePlayPlayer({
  activityId,
  courseId,
  stepId,
  title,
  level,
  situation,
  brief,
  available,
  minutesLeft,
  capMinutes = null,
  courseHref,
  nextHref,
  historyHref = "/partenaire#conversations",
  preview,
  attempts = [],
}: {
  activityId: string;
  courseId?: string;
  stepId?: string;
  title: string;
  level?: string;
  situation: React.ReactNode;
  brief: PublicRolePlay;
  /** The provider is configured. */
  available: boolean;
  /** AI minutes left this month (null = not capped: staff). */
  minutesLeft: number | null;
  /** The learner's monthly allowance in minutes (null = staff). */
  capMinutes?: number | null;
  courseHref: string;
  nextHref?: string | null;
  historyHref?: string;
  preview?: boolean;
  /** The learner's earlier conversations on this scenario (latest first). */
  attempts?: PastAttempt[];
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "brief" });
  const [difficulty, setDifficulty] = useState(brief.difficulty);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const aiName = brief.aiRole.replace(/^(an?|the)\s+/i, "").split(/\s+(at|in|of|from|for)\s+/i)[0].slice(0, 40) || "Partner";

  const begin = () => {
    setError("");
    start(async () => {
      try {
        // Ask for the microphone first: a clear message if it's refused.
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach((t) => t.stop());
      } catch {
        setError("Microphone unavailable: allow microphone access in your browser, then try again.");
        return;
      }
      const r = await startRolePlayAction({ activityId, courseId: courseId ?? null, stepId: stepId ?? null }, difficulty);
      if (!r.ok) return setError(r.error);
      setPhase({ kind: "call", sessionId: r.sessionId, signedUrl: r.signedUrl, limitS: r.limitS });
    });
  };

  const finish = async (sessionId: string) => {
    setPhase({ kind: "finishing", sessionId });
    const r = await finishRolePlayAction(sessionId);
    if (!r.ok) return setPhase({ kind: "finishing", sessionId, error: r.error });
    if (r.result.reward) pushReward(r.result.reward);
    if (r.result.status === "debriefed") playSound("complete");
    setPhase({ kind: "done", result: r.result });
  };

  if (phase.kind === "call") {
    return (
      <div className="mx-auto grid w-full max-w-2xl gap-3">
        <Header title={title} level={level} courseHref={courseHref} />
        <LiveCall
          sessionId={phase.sessionId}
          signedUrl={phase.signedUrl}
          limitS={phase.limitS}
          aiName={aiName}
          avatarSrc={PARTNER_AVATAR.src}
          monthLeftS={minutesLeft !== null ? minutesLeft * 60 : null}
          onEnded={(_reason, err) => {
            if (err) setError(err);
            void finish(phase.sessionId);
          }}
        />
      </div>
    );
  }

  if (phase.kind === "finishing") {
    return (
      <div className="mx-auto grid w-full max-w-2xl gap-3">
        <Header title={title} level={level} courseHref={courseHref} />
        <div className="grid place-items-center gap-3 rounded-3xl bg-brand-soft p-8 text-center" aria-live="polite">
          {phase.error ? (
            <>
              <p className="font-semibold text-coral-dark">{phase.error}</p>
              <button type="button" onClick={() => void finish(phase.sessionId)} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-primary px-5 font-bold text-white">
                <RotateCcw className="size-4" aria-hidden /> Try again
              </button>
            </>
          ) : (
            <>
              <span className="relative">
                <span className="absolute -inset-2 animate-spin rounded-full border-4 border-primary/20 border-t-primary motion-reduce:animate-none" aria-hidden />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={PARTNER_AVATAR.small} alt="" width={96} height={96} className="size-24 rounded-full object-cover" />
              </span>
              <p className="font-heading text-lg font-extrabold text-brand-deep">Preparing your debrief…</p>
              <p className="text-sm text-muted-foreground">About 20 seconds: your coach is reading the conversation.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (phase.kind === "done") {
    const r = phase.result;
    const canRetryDebrief = r.status === "ended" && !r.debrief && r.transcript.filter((t) => t.role === "user").length >= 2 && /couldn't be prepared/.test(r.note);
    return (
      <div className="mx-auto grid w-full max-w-2xl gap-4">
        <Header title={title} level={level} courseHref={courseHref} />
        {error && <p className="rounded-2xl border-2 border-coral bg-white px-3 py-2 text-sm font-semibold text-coral-dark">{error}</p>}
        {r.debrief ? (
          <DebriefView debrief={r.debrief} transcript={r.transcript} score={r.score} aiName={aiName} />
        ) : (
          <div className="grid gap-3 rounded-3xl border border-border bg-card p-4">
            <p className="font-semibold text-brand-deep">{r.note || "No debrief for this conversation."}</p>
            <TranscriptOnly transcript={r.transcript} aiName={aiName} />
            {canRetryDebrief && (
              <button type="button" onClick={() => void finish(r.sessionId)} className="inline-flex h-11 w-fit items-center gap-2 rounded-2xl bg-primary px-5 font-bold text-white">
                <RotateCcw className="size-4" aria-hidden /> Prepare the debrief
              </button>
            )}
          </div>
        )}
        {r.minutesLeft !== null && capMinutes !== null && (
          <div className="rounded-3xl border border-border bg-card p-4">
            <MinutesMeter left={r.minutesLeft} cap={capMinutes} />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setError("");
              setPhase({ kind: "brief" });
            }}
            className="inline-flex h-12 items-center gap-2 rounded-2xl border-2 border-primary bg-white px-5 font-bold text-primary hover:bg-brand-soft"
          >
            <RotateCcw className="size-4" aria-hidden /> Talk again
          </button>
          {nextHref && (
            <Link href={nextHref} className="inline-flex h-12 items-center gap-2 rounded-2xl bg-primary px-5 font-bold text-white shadow-[0_4px_0_0_var(--color-brand-dark)] hover:brightness-110">
              Next activity <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
          {!preview && (
            <Link href={`/partenaire/seances/${r.sessionId}`} className="inline-flex h-12 items-center gap-2 rounded-2xl px-4 font-semibold text-primary hover:bg-brand-soft">
              <AudioLines className="size-4" aria-hidden /> Listen to your call
            </Link>
          )}
          {!preview && (
            <Link href={historyHref} className="inline-flex h-12 items-center gap-2 rounded-2xl px-4 font-semibold text-primary hover:bg-brand-soft">
              <MessagesSquare className="size-4" aria-hidden /> All my conversations
            </Link>
          )}
        </div>
      </div>
    );
  }

  const noMinutes = minutesLeft !== null && minutesLeft < 1;
  return (
    <div className="grid gap-5">
      {/* Hero: the partner, the scenario, the roles. */}
      <section className="relative overflow-clip rounded-[2rem] bg-gradient-to-br from-brand-deep via-brand-deep to-brand-dark text-white">
        <span aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-[radial-gradient(circle,rgb(54_79_171/0.9),transparent_70%)]" />
        <span aria-hidden className="pointer-events-none absolute -bottom-20 -left-10 size-56 rounded-full bg-[radial-gradient(circle,rgb(255_87_87/0.25),transparent_70%)]" />
        <div className="relative grid gap-5 p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <Link href={courseHref} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-white/90 hover:bg-white/20">
              <ArrowLeft className="size-4" aria-hidden /> Back
            </Link>
            <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-white/80 uppercase">
              <MessagesSquare className="size-4" aria-hidden /> AI role-play
            </p>
          </div>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <PartnerAvatar size="lg" />
            <div className="grid min-w-0 gap-2">
              <h1 className="text-3xl leading-tight font-extrabold sm:text-4xl">{title}</h1>
              <p className="flex flex-wrap gap-1.5 text-xs font-bold">
                {level && <span className="rounded-full bg-white px-2.5 py-1 text-primary">{level}</span>}
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
                  <Clock className="size-3.5" aria-hidden /> {brief.maxMinutes} min
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
                  <Target className="size-3.5" aria-hidden /> {brief.goals.length} goal{brief.goals.length === 1 ? "" : "s"}
                </span>
              </p>
            </div>
          </div>
          {situation && <div className="text-[17px] leading-relaxed text-white/90 [&_*]:!text-white/90 [&_a]:!text-white [&_a]:underline [&_p]:m-0">{situation}</div>}
          <div className="grid gap-2 sm:grid-cols-2">
            <Role label="You are" value={brief.learnerRole} />
            <Role label="You're talking to" value={brief.aiRole} />
          </div>
          <p lang="en" className="text-sm text-white/70">
            <span className="font-semibold text-white/90">Setting:</span> {brief.setting}
          </p>
        </div>
      </section>

      {attempts.length > 0 && <LastResult attempts={attempts} />}

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="grid gap-5">
          <section className="grid gap-3 rounded-3xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 font-heading text-xl font-extrabold text-brand-deep">
              <span className="flex size-9 items-center justify-center rounded-xl border-2 border-coral bg-white">
                <Target className="size-5 text-coral" aria-hidden />
              </span>
              Your mission
            </h2>
            <ol className="grid gap-2">
              {brief.goals.map((g, i) => (
                <li key={i} className="flex items-start gap-3 rounded-2xl bg-brand-soft/50 px-3 py-2.5 text-ink">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-brand-deep text-xs font-bold text-white">{i + 1}</span>
                  <span className="pt-0.5">{g}</span>
                </li>
              ))}
            </ol>
          </section>

          {brief.targetPhrases.length > 0 && (
            <section className="grid gap-3 rounded-3xl border border-border bg-card p-5">
              <h2 className="flex items-center gap-2 font-heading text-xl font-extrabold text-brand-deep">
                <span className="flex size-9 items-center justify-center rounded-xl bg-brand-soft">
                  <Quote className="size-5 text-primary" aria-hidden />
                </span>
                Useful phrases
              </h2>
              <ul className="grid gap-2">
                {brief.targetPhrases.map((p, i) => (
                  <li key={i} lang="en" className="rounded-2xl border border-primary/15 px-3.5 py-2.5 font-semibold text-primary">
                    {p}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <ul className="grid gap-2 rounded-3xl bg-muted/50 p-5 text-sm text-ink/80">
            <li className="flex items-start gap-2.5">
              <Headphones className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> Use headphones in a quiet place. Speak naturally: your partner answers when you stop.
            </li>
            <li className="flex items-start gap-2.5">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> Stuck? Press « Help » during the call for ideas of what to say.
            </li>
            <li className="flex items-start gap-2.5">
              <Mic className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> No corrections during the call: you get a full debrief at the end.
            </li>
          </ul>
        </div>

        {/* Ready card: sticky beside the brief on desktop, last on phones. */}
        <aside className="grid gap-4 rounded-3xl border-2 border-primary/15 bg-card p-5 lg:sticky lg:top-20">
          {error && (
            <p role="alert" className="rounded-2xl border-2 border-coral bg-white px-3 py-2 text-sm font-semibold text-coral-dark">
              {error}
            </p>
          )}
          {!available ? (
            <p className="rounded-2xl bg-muted px-4 py-3 text-sm font-semibold text-muted-foreground">Talk with Coach Ish isn&apos;t available yet: come back soon.</p>
          ) : (
            <button
              type="button"
              onClick={begin}
              disabled={pending || noMinutes}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-coral bg-white px-6 text-[19px] font-bold text-coral shadow-[0_5px_0_0_var(--color-coral)] hover:bg-coral-soft active:translate-y-1 active:shadow-none disabled:opacity-50"
            >
              {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Mic className="size-5" aria-hidden />} {noMinutes ? "No AI minutes left" : "Start the conversation"}
            </button>
          )}
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Circle className="mt-1 size-3 shrink-0 fill-coral text-coral" aria-hidden /> This call is recorded: you and your coach can listen to it again with your debrief.
          </p>
          {minutesLeft !== null && capMinutes !== null && <MinutesMeter left={minutesLeft} cap={capMinutes} />}
          <fieldset className="grid gap-2">
            <legend className="mb-2 w-full border-t border-border pt-4 font-heading text-lg font-extrabold text-brand-deep">How tough should your partner be?</legend>
            {ROLEPLAY_DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d)}
                aria-pressed={difficulty === d}
                className={cn("flex items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left transition motion-reduce:transition-none", difficulty === d ? "border-primary bg-brand-soft" : "border-border hover:border-primary/40")}
              >
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full font-heading font-extrabold", difficulty === d ? "bg-primary text-white" : "bg-muted text-brand-deep")}>{d}</span>
                <span className="grid">
                  <span className="text-sm font-bold text-brand-deep">{DIFFICULTY_LABEL[d]}</span>
                  <span className="text-xs text-muted-foreground">{DIFFICULTY_HINT[d]}</span>
                </span>
              </button>
            ))}
          </fieldset>

          {preview && <p className="text-xs text-muted-foreground">Staff preview: a real call (it uses ElevenLabs minutes); nothing counts as learner progress.</p>}
        </aside>
      </div>
      {/* Phones: the start button stays in reach above the tab bar (the ready card is far down). */}
      {available && !noMinutes && (
        <div className="fixed inset-x-0 bottom-16 z-20 grid gap-2 border-t border-border bg-card/95 px-4 py-2.5 md:bottom-0 lg:hidden">
          {error && <p role="alert" className="text-sm font-semibold text-coral-dark">{error}</p>}
          <button type="button" onClick={begin} disabled={pending} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-coral bg-white text-[19px] font-bold text-coral shadow-[0_4px_0_0_var(--color-coral)] active:translate-y-1 active:shadow-none disabled:opacity-50">
            {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Mic className="size-5" aria-hidden />} Start · {DIFFICULTY_LABEL[difficulty].toLowerCase()}
          </button>
        </div>
      )}
      <div className="h-16 lg:hidden" aria-hidden />
    </div>
  );
}

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** « Your last result » + earlier attempts on this scenario, each opening its debrief. */
function LastResult({ attempts }: { attempts: PastAttempt[] }) {
  const [last, ...earlier] = attempts;
  return (
    <section className="grid gap-3 rounded-3xl border-2 border-primary/20 bg-brand-soft/50 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className={cn("flex size-14 shrink-0 flex-col items-center justify-center rounded-full font-heading leading-none font-extrabold", last.score !== null ? "bg-gradient-to-br from-primary to-brand-deep text-white" : "bg-muted text-muted-foreground")}>
          <span className="text-lg">{last.score ?? "–"}</span>
          {last.score !== null && <span className="text-[10px] font-semibold opacity-80">/ 100</span>}
        </span>
        <div className="min-w-0 flex-1 basis-40">
          <p className="text-xs font-bold tracking-wide text-primary uppercase">Your last result</p>
          <p className="text-sm text-ink">
            {fmtDay(last.at)} · level {last.difficulty} · {Math.max(1, Math.round(last.durationS / 60))} min{!last.debriefed && " · no debrief"}
          </p>
        </div>
        <Link href={`/partenaire/seances/${last.sessionId}`} className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-white hover:brightness-110 sm:w-auto">
          See the debrief <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      {earlier.length > 0 && (
        <ul className="flex flex-wrap gap-2 border-t border-primary/15 pt-3">
          <li className="self-center text-xs font-semibold text-muted-foreground">Earlier:</li>
          {earlier.map((a) => (
            <li key={a.sessionId}>
              <Link href={`/partenaire/seances/${a.sessionId}`} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-brand-deep hover:border-primary/40">
                <span className="font-bold text-primary">{a.score ?? "–"}</span> · {fmtDay(a.at)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The conversation partner's face (Coach Ish's illustrated portrait). */
export const PARTNER_AVATAR = { src: "/images/coach-ish-512.webp", small: "/images/coach-ish-256.webp" };

function PartnerAvatar({ size }: { size: "lg" | "md" }) {
  return (
    <span className={cn("relative shrink-0", size === "lg" ? "size-28 sm:size-32" : "size-20")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={size === "lg" ? PARTNER_AVATAR.src : PARTNER_AVATAR.small} alt="" width={256} height={256} className="size-full rounded-full object-cover ring-4 ring-white/90" />
      <span className="absolute right-1 bottom-1 size-4 rounded-full border-2 border-white bg-success" aria-hidden />
    </span>
  );
}

function Header({ title, level, courseHref }: { title: string; level?: string; courseHref: string }) {
  return (
    <header className="flex items-start gap-3">
      <Link href={courseHref} className="flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted" aria-label="Leave">
        <X className="size-6" aria-hidden />
      </Link>
      <div>
        <p className="flex flex-wrap items-center gap-2 text-xs font-bold tracking-wide text-primary uppercase">
          <MessagesSquare className="size-4" aria-hidden /> AI role-play
          {level && <span className="rounded-full bg-brand-soft px-2 py-0.5 normal-case">{level}</span>}
        </p>
        <h1 className="mt-1 text-2xl font-extrabold text-brand-deep sm:text-3xl">{title}</h1>
      </div>
    </header>
  );
}

function Role({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 px-4 py-3">
      <p className="text-xs font-bold tracking-wide text-white/60 uppercase">{label}</p>
      <p lang="en" className="font-semibold text-white">
        {value}
      </p>
    </div>
  );
}
