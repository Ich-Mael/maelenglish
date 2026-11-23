"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Clock, Loader2, Lock, Sparkles } from "lucide-react";
import { BUTTON } from "@/components/site/ui";
import { OTHER, OTHER_LABEL, SCALE_LABELS, SECTIONS, fr, isAnswered, visibleQuestions, type Answers, type Question } from "@/lib/diagnostic/questions";
import type { DiagnosticResult } from "@/lib/diagnostic/service";
import { getDiagnosticAction, saveDiagnosticAction, startDiagnosticAction, submitDiagnosticAction } from "./actions";
import { DiagnosticReportView } from "./report-view";
import { cn } from "cn";

/*
 * The learning-path diagnostic (DIAGNOSTIC_SPEC.md §3): intro → one question per screen (6
 * sections, conditional questions, progress bar, back) → email + consent → « Analyse de votre
 * parcours… » → the report. Progress is kept on the device (localStorage, in try/catch) and saved
 * on the server after each section.
 */

type Phase = "intro" | "questions" | "lead" | "loading" | "report";
type Saved = { token: string; answers: Answers; index: number; phase: Phase };
const KEY = "me-diagnostic";

const noSubscribe = () => () => {};
const store = (s: Saved | null) => {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
};

const sectionOf = (x: Question) => SECTIONS.findIndex((s) => s.questions.includes(x));

export function DiagnosticApp() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [token, setToken] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const top = useRef<HTMLDivElement>(null);

  // What this device remembers (read after hydration): offer to resume, or show a finished report again.
  const savedRaw = useSyncExternalStore(
    noSubscribe,
    () => {
      try {
        return localStorage.getItem(KEY);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const saved = useMemo<Saved | null>(() => {
    try {
      return savedRaw ? (JSON.parse(savedRaw) as Saved) : null;
    } catch {
      return null;
    }
  }, [savedRaw]);
  const [dismissed, setDismissed] = useState(false);
  const finishedToken = saved && (saved.phase === "report" || saved.phase === "loading") ? saved.token : "";
  useEffect(() => {
    if (!finishedToken) return;
    let live = true;
    void getDiagnosticAction(finishedToken).then((r) => {
      if (!live || !r) return;
      setToken(finishedToken);
      setResult(r);
      setPhase("report");
    });
    return () => {
      live = false;
    };
  }, [finishedToken]);
  const resume = !dismissed && phase === "intro" && saved?.token ? saved : null;

  const visible = useMemo(() => visibleQuestions(answers), [answers]);
  const current = visible[Math.min(index, visible.length - 1)];
  const section = current ? sectionOf(current) : 0;

  useEffect(() => {
    if (token && phase !== "intro") store({ token, answers, index, phase });
  }, [token, answers, index, phase]);
  useEffect(() => {
    top.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [index, phase]);

  const begin = () => {
    setError("");
    start(async () => {
      const p = new URLSearchParams(window.location.search);
      const r = await startDiagnosticAction({ source: p.get("utm_source") ?? "", medium: p.get("utm_medium") ?? "", campaign: p.get("utm_campaign") ?? "" });
      if (!r.ok) return setError(r.error);
      setDismissed(true);
      setToken(r.token);
      setAnswers({});
      setIndex(0);
      setPhase("questions");
    });
  };

  const set = (id: string, v: Answers[string]) => setAnswers((a) => ({ ...a, [id]: v }));

  const next = (a = answers) => {
    const vis = visibleQuestions(a);
    const i = Math.min(index, vis.length - 1);
    const here = sectionOf(vis[i]);
    if (i + 1 >= vis.length) {
      void saveDiagnosticAction(token, a, SECTIONS.length);
      setPhase("lead");
      return;
    }
    if (sectionOf(vis[i + 1]) !== here) void saveDiagnosticAction(token, a, here + 1);
    setIndex(i + 1);
  };
  const back = () => (index > 0 ? setIndex(index - 1) : setPhase("intro"));

  const restart = () => {
    store(null);
    setDismissed(true);
    setResult(null);
    setToken("");
    setAnswers({});
    setIndex(0);
    setPhase("intro");
  };

  if (phase === "report" && result) {
    return (
      <div ref={top} className="scroll-mt-24">
        <DiagnosticReportView result={result} onRestart={restart} />
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div ref={top} className="grid min-h-[50vh] scroll-mt-24 place-items-center rounded-[2rem] border border-border bg-card p-8 text-center" aria-live="polite">
        <div className="grid justify-items-center gap-4">
          <Loader2 className="size-12 animate-spin text-coral" aria-hidden />
          <p className="font-heading text-2xl font-extrabold text-brand-deep">Analyse de votre parcours…</p>
          <p className="max-w-sm text-muted-foreground">{fr("Coach Ish prépare votre rapport personnalisé : quelques secondes.")}</p>
        </div>
      </div>
    );
  }

  if (phase === "lead") {
    return (
      <div ref={top} className="scroll-mt-24">
        <LeadForm
          onBack={() => {
            setIndex(visible.length - 1);
            setPhase("questions");
          }}
          onSubmit={async (lead) => {
            setPhase("loading");
            const r = await submitDiagnosticAction(token, answers, lead);
            if (!r.ok) {
              setPhase("lead");
              return r;
            }
            setResult(r.result);
            setPhase("report");
            return null;
          }}
        />
      </div>
    );
  }

  if (phase === "questions" && current) {
    const total = visible.length;
    const pos = Math.min(index, total - 1);
    return (
      <div ref={top} className="grid scroll-mt-24 gap-5">
        <div className="grid gap-2">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span className="text-primary">
              Partie {section + 1} sur {SECTIONS.length} · {SECTIONS[section].title}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {pos + 1} / {total}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={pos} aria-label="Progression du diagnostic">
            <div className="h-full rounded-full bg-coral transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${(pos / total) * 100}%` }} />
          </div>
        </div>
        <QuestionCard key={current.id} q={current} answers={answers} intro={SECTIONS[section].questions[0] === current || current.id === "s17" ? SECTIONS[section].intro : undefined} onChange={set} onNext={next} onBack={back} />
      </div>
    );
  }

  // Intro.
  return (
    <div ref={top} className="grid scroll-mt-24 gap-6">
      {resume && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-primary/20 bg-white p-4">
          <p className="min-w-0 flex-1 text-ink">{fr("Vous avez un diagnostic en cours sur cet appareil.")}</p>
          <button
            type="button"
            onClick={() => {
              setToken(resume.token);
              setAnswers(resume.answers ?? {});
              setIndex(resume.index ?? 0);
              setPhase(resume.phase === "lead" || resume.phase === "report" || resume.phase === "loading" ? "lead" : "questions");
              setDismissed(true);
            }}
            className={cn(BUTTON.blue, "h-11 px-5 text-base")}
          >
            Reprendre <ArrowRight className="size-4" aria-hidden />
          </button>
          <button type="button" onClick={restart} className="text-sm font-semibold text-muted-foreground underline">
            Recommencer
          </button>
        </div>
      )}
      <button type="button" onClick={begin} disabled={pending} className={cn(BUTTON.coral, "w-full sm:w-fit")}>
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null} Commencer mon diagnostic <ArrowRight className="size-5" aria-hidden />
      </button>
      {error && <p className="font-semibold text-coral-dark">{error}</p>}
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="size-4 text-primary" aria-hidden /> {fr("Environ 8 minutes · gratuit · vos réponses restent confidentielles")}
      </p>
    </div>
  );
}

function QuestionCard({ q, answers, intro, onChange, onNext, onBack }: { q: Question; answers: Answers; intro?: string; onChange: (id: string, v: Answers[string]) => void; onNext: (a?: Answers) => void; onBack: () => void }) {
  const v = answers[q.id];
  const otherText = String(answers[`${q.id}_other`] ?? "");
  const ok = isAnswered(q, answers);
  const auto = (value: Answers[string]) => {
    // Single choice / scale: go on by itself (not when « Autre » needs a text).
    const a = { ...answers, [q.id]: value };
    onChange(q.id, value);
    if (value !== OTHER) setTimeout(() => onNext(a), 220);
  };

  const options = [...(q.options ?? []), ...(q.other ? [{ value: OTHER, label: OTHER_LABEL }] : [])];
  const picked = (val: string) => (Array.isArray(v) ? v.includes(val) : v === val);
  const choseOther = picked(OTHER);
  const atMax = q.type === "multi" && q.max !== undefined && Array.isArray(v) && v.length >= q.max;

  return (
    <section className="grid gap-5 rounded-[2rem] border border-border bg-card p-5 sm:p-8" aria-labelledby={`label-${q.id}`}>
      {intro && <p className="rounded-xl bg-brand-soft px-3 py-2 text-sm text-brand-deep">{fr(intro)}</p>}
      <h2 id={`label-${q.id}`} className="font-heading text-2xl leading-snug font-extrabold text-brand-deep sm:text-[1.7rem]">
        {q.label}
      </h2>
      {q.type === "multi" && <p className="-mt-3 text-sm text-muted-foreground">{q.max ? fr(`Jusqu'à ${q.max} réponses.`) : fr("Plusieurs réponses possibles.")}</p>}

      {q.type === "scale" ? (
        <div className="grid gap-2" role="radiogroup" aria-labelledby={`label-${q.id}`}>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={v === n}
                aria-label={`${n} — ${SCALE_LABELS[n - 1]}`}
                onClick={() => auto(n)}
                className={cn("h-14 rounded-2xl border-2 font-heading text-xl font-extrabold transition", v === n ? "border-coral bg-coral-soft text-coral-dark" : "border-border bg-white text-brand-deep hover:border-coral/50")}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{SCALE_LABELS[0]}</span>
            <span>{SCALE_LABELS[4]}</span>
          </div>
        </div>
      ) : q.type === "text" ? (
        <textarea
          aria-labelledby={`label-${q.id}`}
          rows={4}
          maxLength={600}
          value={typeof v === "string" ? v : ""}
          onChange={(e) => onChange(q.id, e.target.value)}
          placeholder="Facultatif"
          className="w-full rounded-2xl border-2 border-border bg-background px-4 py-3 text-base outline-none focus:border-primary"
        />
      ) : (
        <div className="grid gap-2" role={q.type === "single" ? "radiogroup" : "group"} aria-labelledby={`label-${q.id}`}>
          {options.map((op) => {
            const on = picked(op.value);
            return (
              <button
                key={op.value}
                type="button"
                role={q.type === "single" ? "radio" : "checkbox"}
                aria-checked={on}
                disabled={!on && atMax}
                onClick={() => {
                  if (q.type === "single") auto(op.value);
                  else {
                    const list = Array.isArray(v) ? v : [];
                    onChange(q.id, on ? list.filter((x) => x !== op.value) : [...list, op.value]);
                  }
                }}
                className={cn(
                  "flex min-h-14 items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-base transition disabled:opacity-40",
                  on ? "border-coral bg-coral-soft font-semibold text-brand-deep" : "border-border bg-white text-ink hover:border-coral/50",
                )}
              >
                <span className={cn("flex size-6 shrink-0 items-center justify-center border-2", q.type === "single" ? "rounded-full" : "rounded-md", on ? "border-coral bg-coral text-white" : "border-border bg-white")}>{on && <Check className="size-4" aria-hidden />}</span>
                {op.label}
              </button>
            );
          })}
          {choseOther && (
            <input
              autoFocus
              aria-label="Précisez"
              maxLength={300}
              value={otherText}
              onChange={(e) => onChange(`${q.id}_other`, e.target.value)}
              placeholder="Précisez…"
              className="h-12 w-full rounded-2xl border-2 border-coral/60 bg-white px-4 text-base outline-none focus:border-coral"
            />
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <button type="button" onClick={onBack} className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 font-semibold text-muted-foreground hover:bg-muted">
          <ArrowLeft className="size-4" aria-hidden /> Retour
        </button>
        {(q.type === "multi" || q.type === "text" || choseOther) && (
          <button type="button" onClick={() => onNext()} disabled={!ok} className={cn(BUTTON.blue, "h-12 px-6 text-base disabled:opacity-40")}>
            {q.type === "text" && !v ? "Passer" : "Continuer"} <ArrowRight className="size-4" aria-hidden />
          </button>
        )}
      </div>
    </section>
  );
}

type LeadErr = { error: string; field?: string } | null;

function LeadForm({ onSubmit, onBack }: { onSubmit: (lead: { firstName: string; lastName: string; field: string; email: string; phone: string; consentAnalysis: boolean; consentMarketing: boolean }) => Promise<LeadErr>; onBack: () => void }) {
  const [err, setErr] = useState<LeadErr>(null);
  const [busy, setBusy] = useState(false);
  const field = "h-12 w-full rounded-2xl border-2 border-border bg-background px-4 text-base outline-none focus:border-primary aria-invalid:border-coral";
  return (
    <form
      className="grid gap-5 rounded-[2rem] border border-border bg-card p-5 sm:p-8"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        const r = await onSubmit({ firstName: String(f.get("firstName") ?? ""), lastName: String(f.get("lastName") ?? ""), field: String(f.get("field") ?? ""), email: String(f.get("email") ?? ""), phone: String(f.get("phone") ?? ""), consentAnalysis: f.get("consentAnalysis") === "on", consentMarketing: f.get("consentMarketing") === "on" });
        setBusy(false);
        setErr(r);
      }}
    >
      <div className="grid justify-items-start gap-2">
        <span className="flex size-12 items-center justify-center rounded-full border-2 border-coral bg-white text-coral shadow-[0_4px_0_0_var(--color-coral)]">
          <Sparkles className="size-6" aria-hidden />
        </span>
        <h2 className="font-heading text-2xl font-extrabold text-brand-deep sm:text-3xl">{fr("Votre rapport est prêt. Où devons-nous l'envoyer ?")}</h2>
      </div>
      {err && (
        <p role="alert" className="rounded-xl border-2 border-coral bg-white px-3 py-2 text-sm font-semibold text-coral-dark">
          {err.error}
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-sm font-semibold text-brand-deep">Prénom</span>
          <input name="firstName" required autoComplete="given-name" aria-invalid={err?.field === "firstName"} className={field} />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-semibold text-brand-deep">Nom</span>
          <input name="lastName" required autoComplete="family-name" aria-invalid={err?.field === "lastName"} className={field} />
        </label>
      </div>
      <label className="grid gap-1.5">
        <span className="text-sm font-semibold text-brand-deep">{fr("Votre métier ou domaine d'études")}</span>
        <input name="field" required autoComplete="organization-title" maxLength={120} placeholder="Ex. infirmière, comptable, étudiant en droit…" aria-invalid={err?.field === "field"} className={field} />
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-semibold text-brand-deep">Email</span>
        <input name="email" type="email" required autoComplete="email" aria-invalid={err?.field === "email"} className={field} />
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-semibold text-brand-deep">Téléphone / WhatsApp (facultatif)</span>
        <input name="phone" type="tel" inputMode="tel" autoComplete="tel" aria-invalid={err?.field === "phone"} className={field} />
      </label>
      <label className={cn("flex items-start gap-3 rounded-xl p-3 text-sm", err?.field === "consentAnalysis" ? "border-2 border-coral bg-white text-coral-dark" : "bg-brand-soft/60 text-ink/85")}>
        <input type="checkbox" name="consentAnalysis" required className="mt-0.5 size-5 shrink-0 accent-primary" />
        <span>
          {fr("J'accepte que mes réponses soient analysées automatiquement pour générer mon rapport personnalisé, et que MaelEnglish me contacte au sujet de ce rapport (")}
          <Link href="/confidentialite" target="_blank" className="font-semibold text-primary underline">
            politique de confidentialité
          </Link>
          ).
        </span>
      </label>
      <label className="flex items-start gap-3 rounded-xl p-3 text-sm text-ink/85">
        <input type="checkbox" name="consentMarketing" className="mt-0.5 size-5 shrink-0 accent-primary" />
        <span>Je souhaite recevoir des conseils et actualités par email.</span>
      </label>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="size-3.5" aria-hidden /> {fr("Votre email et votre téléphone ne sont jamais transmis à l'outil d'analyse.")}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 font-semibold text-muted-foreground hover:bg-muted">
          <ArrowLeft className="size-4" aria-hidden /> Retour
        </button>
        <button type="submit" disabled={busy} className={cn(BUTTON.coral, "disabled:opacity-60")}>
          {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null} Voir mon rapport <ArrowRight className="size-5" aria-hidden />
        </button>
      </div>
    </form>
  );
}

