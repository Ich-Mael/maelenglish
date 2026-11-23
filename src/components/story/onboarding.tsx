"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import type { AvatarConfig } from "@/lib/story/schema";
import { saveProfileAction } from "@/app/(app)/story-actions";
import { Avatar, DEFAULT_AVATAR } from "./avatar";
import { AvatarBuilder, Chips, Field } from "./avatar-builder";

/* Story Mode onboarding (spec « Onboarding »): character name, job, country, avatar builder, pace. */

const JOBS = ["Accountant", "Engineer", "NGO project officer", "Sales", "Teacher", "Civil servant", "Lawyer", "Health worker", "IT", "Entrepreneur", "Student"];
const COUNTRIES = ["Burkina Faso", "Côte d'Ivoire", "Mali", "Senegal", "Niger", "Togo", "Benin", "Guinea", "Cameroon", "DR Congo", "Other"];
const PACES = [
  { n: 2, label: "Relaxed", hint: "2 episodes a week" },
  { n: 3, label: "Regular", hint: "3 episodes a week" },
  { n: 5, label: "Intensive", hint: "5 episodes a week" },
];

export function StoryOnboarding({ defaultName, defaultJob, cityName, initial }: { defaultName: string; defaultJob: string; cityName: string; initial?: { characterName: string; job: string; country: string; avatar: AvatarConfig | null; pacePerWeek: number } | null }) {
  const router = useRouter();
  const editing = !!initial;
  const [step, setStep] = useState(editing ? 1 : 0);
  const [name, setName] = useState(initial?.characterName ?? defaultName);
  const [job, setJob] = useState(initial?.job ?? defaultJob);
  const [country, setCountry] = useState(initial?.country ?? "Burkina Faso");
  const [a, setA] = useState<AvatarConfig>(initial?.avatar ?? DEFAULT_AVATAR);
  const [pace, setPace] = useState(initial?.pacePerWeek ?? 3);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      setError("");
      const r = await saveProfileAction({ characterName: name, job, country, avatar: a, pacePerWeek: pace });
      if (!r.ok) return setError(r.error);
      if (editing) router.push("/histoire");
      else router.refresh();
    });

  if (step === 0)
    return (
      <section className="relative overflow-clip rounded-[2rem] bg-brand-deep p-6 text-white shadow-xl sm:p-10">
        <span aria-hidden className="pointer-events-none absolute -top-24 -right-20 size-80 rounded-full bg-[radial-gradient(circle,rgb(255_87_87/0.35),transparent_70%)]" />
        <p className="relative text-sm font-bold tracking-widest text-white/70 uppercase">Story Mode</p>
        <h1 className="relative mt-2 font-heading text-4xl font-extrabold sm:text-5xl">Your story in English</h1>
        <p lang="fr" className="relative mt-4 max-w-2xl text-lg text-white/85">
          Vous êtes le personnage principal. Chaque saison se passe dans une ville{cityName ? ` (la première : ${cityName})` : ""}, avec un objectif précis. Chaque épisode est une situation de la vraie vie : vous regardez, vous pratiquez, vous parlez, puis vous discutez avec les personnages. Ils se souviendront de vous.
        </p>
        <button type="button" onClick={() => setStep(1)} className="relative mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-lg font-bold text-primary shadow-[0_5px_0_0_rgb(255_255_255/0.35)] hover:bg-brand-soft">
          Create my character <ArrowRight className="size-5" />
        </button>
      </section>
    );

  return (
    <section className="grid gap-6 rounded-[2rem] bg-white p-5 shadow-[0_1px_2px_rgb(20_31_77/0.06),0_24px_48px_-20px_rgb(20_31_77/0.3)] ring-1 ring-primary/10 sm:p-8 lg:grid-cols-[280px_1fr]">
      <div className="flex flex-col items-center gap-3 lg:sticky lg:top-24 lg:self-start">
        <Avatar config={a} size={200} title="Your avatar" className="shadow-lg ring-4 ring-white" />
        <p className="font-heading text-2xl font-extrabold text-primary">{name || "Your name"}</p>
        <p className="text-sm text-muted-foreground">
          {job || "Your job"} · {country}
        </p>
      </div>

      <div className="grid gap-6">
        {step === 1 ? (
          <>
            <h2 className="font-heading text-2xl font-extrabold">Who are you in the story?</h2>
            <label className="grid gap-2">
              <span className="text-sm font-bold">Your name in the story</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="h-12 rounded-xl border-2 border-ink/10 px-4 text-lg focus:border-primary focus:outline-none" />
            </label>
            <Field title="Your job">
              <Chips items={JOBS.map((j) => ({ id: j, label: j }))} value={job} onChange={setJob} label="Job" />
              <input value={job} onChange={(e) => setJob(e.target.value)} maxLength={80} placeholder="Or type your job" className="h-11 rounded-xl border-2 border-ink/10 px-4 focus:border-primary focus:outline-none" />
            </Field>
            <Field title="Where you come from">
              <select value={country} onChange={(e) => setCountry(e.target.value)} className="h-11 rounded-xl border-2 border-ink/10 bg-white px-3 focus:border-primary focus:outline-none">
                {COUNTRIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          </>
        ) : step === 2 ? (
          <>
            <h2 className="font-heading text-2xl font-extrabold">Your avatar</h2>
            <AvatarBuilder value={a} onChange={setA} />
          </>
        ) : (
          <>
            <h2 className="font-heading text-2xl font-extrabold">Your pace</h2>
            <p lang="fr" className="text-ink/75">
              Vous pouvez toujours avancer plus vite : c&apos;est seulement un objectif.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {PACES.map((p) => (
                <button key={p.n} type="button" aria-pressed={pace === p.n} onClick={() => setPace(p.n)} className={`rounded-2xl p-4 text-left ring-2 transition ${pace === p.n ? "bg-brand-soft ring-primary" : "bg-white ring-ink/10 hover:ring-primary/40"}`}>
                  <p className="font-heading text-lg font-extrabold text-primary">{p.label}</p>
                  <p className="text-sm text-muted-foreground">{p.hint}</p>
                </button>
              ))}
            </div>
          </>
        )}

        {error ? <p className="rounded-xl bg-coral-soft px-4 py-2 text-sm text-coral-dark" role="alert">{error}</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          {step > 1 ? (
            <button type="button" onClick={() => setStep(step - 1)} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 font-semibold text-primary hover:bg-brand-soft">
              <ArrowLeft className="size-4" /> Back
            </button>
          ) : (
            <span />
          )}
          {step < 3 ? (
            <button type="button" disabled={step === 1 && (name.trim().length < 2 || !job.trim())} onClick={() => setStep(step + 1)} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 font-bold text-white shadow-[0_4px_0_0_var(--color-brand-deep)] disabled:opacity-50">
              Next <ArrowRight className="size-4" />
            </button>
          ) : (
            <button type="button" disabled={pending} onClick={save} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 font-bold text-white shadow-[0_4px_0_0_var(--color-brand-deep)] disabled:opacity-60">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {editing ? "Save" : "Start the story"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
