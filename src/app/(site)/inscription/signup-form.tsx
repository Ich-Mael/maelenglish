"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { PROGRAMS, shortProgramName } from "@/lib/catalog";
import { waLink } from "@/lib/site";
import { FormMessage, SubmitButton } from "@/components/auth/form-parts";
import { WhatsAppButton } from "@/components/site/ui";
import { submitSignup, type SignupState } from "./actions";
import { cn } from "cn";

const LEVELS = [
  { value: "beginner", label: "Débutant" },
  { value: "intermediate", label: "Intermédiaire" },
  { value: "advanced", label: "Avancé" },
  { value: "unknown", label: "Je ne sais pas" },
];

const input =
  "h-12 w-full rounded-xl border-2 border-border bg-background px-4 text-base outline-none transition focus:border-primary aria-invalid:border-destructive";

function Field({ label, name, hint, error, children }: { label: string; name: string; hint?: string; error?: boolean; children: React.ReactNode }) {
  return (
    <div className="grid content-start gap-1.5">
      <label htmlFor={name} className="text-sm font-semibold text-brand-deep">
        {label}
      </label>
      {children}
      {hint && <p className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>{hint}</p>}
    </div>
  );
}

export function SignupForm({ program, kind }: { program: string; kind: "enroll" | "notify" }) {
  const [state, action] = useActionState<SignupState, FormData>(submitSignup, undefined);
  const [level, setLevel] = useState("unknown");

  if (state && "ok" in state) {
    return (
      <div className="grid justify-items-center gap-4 py-6 text-center">
        <CheckCircle2 className="size-16 animate-pop text-success" aria-hidden />
        <h2 className="text-2xl font-extrabold text-primary">Merci {state.firstName} !</h2>
        <p className="max-w-md text-ink/80">
          {state.kind === "notify"
            ? "C'est noté : nous vous prévenons sur WhatsApp dès l'ouverture des inscriptions."
            : "Votre demande est bien reçue. Coach Ish ou un membre de l'équipe vous contacte sur WhatsApp sous 24 à 48 h pour faire le point sur votre niveau, la date de démarrage et les modalités."}
        </p>
        {state.offer && <p className="rounded-full bg-brand-soft px-4 py-1.5 text-sm font-semibold text-brand-deep">{state.offer}</p>}
        {state.summary && (
          <WhatsAppButton href={waLink(state.summary)} className="mt-2">
            Envoyer aussi sur WhatsApp
          </WhatsAppButton>
        )}
        <Link href="/#programmes" className="text-sm font-semibold text-primary hover:underline">
          Revenir aux programmes
        </Link>
      </div>
    );
  }

  const v = (state && "values" in state && state.values) || {};
  const err = state && "error" in state ? state : undefined;
  const bad = (f: string) => err?.field === f;

  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage error={err?.error} />
      <input type="hidden" name="kind" value={kind} />
      {/* Honeypot (hidden from people and screen readers). */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Site web <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Prénom" name="firstName" error={bad("firstName")}>
          <input id="firstName" name="firstName" required autoComplete="given-name" defaultValue={v.firstName} aria-invalid={bad("firstName")} className={input} />
        </Field>
        <Field label="Nom" name="lastName" error={bad("lastName")}>
          <input id="lastName" name="lastName" required autoComplete="family-name" defaultValue={v.lastName} aria-invalid={bad("lastName")} className={input} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Numéro WhatsApp" name="phoneNumber" hint="Ex. 70 12 34 56, ou +225… hors du Burkina Faso." error={bad("phoneNumber")}>
          <input id="phoneNumber" name="phoneNumber" type="tel" required autoComplete="tel" inputMode="tel" defaultValue={v.phoneNumber} aria-invalid={bad("phoneNumber")} className={input} />
        </Field>
        <Field label="Email (facultatif)" name="email" error={bad("email")}>
          <input id="email" name="email" type="email" autoComplete="email" defaultValue={v.email} aria-invalid={bad("email")} className={input} />
        </Field>
      </div>

      <Field label="Programme" name="program">
        <select id="program" name="program" defaultValue={v.program ?? program} className={cn(input, "pr-10")}>
          <option value="">Je ne sais pas encore — conseillez-moi</option>
          <optgroup label="Anglais général">
            {PROGRAMS.filter((p) => p.featured).map((p) => (
              <option key={p.slug} value={p.slug}>{p.name}</option>
            ))}
          </optgroup>
          <optgroup label="Programmes métiers (12 semaines)">
            {PROGRAMS.filter((p) => !p.featured).map((p) => (
              <option key={p.slug} value={p.slug}>{shortProgramName(p)}{p.status === "soon" ? " (bientôt)" : ""}</option>
            ))}
          </optgroup>
          <optgroup label="Autres formules">
            <option value="coaching">Coaching individuel</option>
            <option value="challenge">MaelEnglish Challenge</option>
          </optgroup>
        </select>
      </Field>

      <fieldset className="grid gap-2">
        <legend className="mb-1.5 text-sm font-semibold text-brand-deep">Votre niveau d&apos;anglais</legend>
        <input type="hidden" name="level" value={level} />
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {LEVELS.map((l) => (
            <button
              key={l.value}
              type="button"
              role="radio"
              aria-checked={level === l.value}
              onClick={() => setLevel(l.value)}
              className={cn(
                "rounded-full border-2 px-4 py-2 text-sm font-semibold transition",
                level === l.value ? "border-primary bg-brand-soft text-primary" : "border-border bg-card text-ink/80 hover:border-primary/40",
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Pas d&apos;inquiétude : un test de niveau est fait au démarrage.</p>
      </fieldset>

      <Field label="Votre métier ou secteur (facultatif)" name="profession">
        <input id="profession" name="profession" autoComplete="organization-title" placeholder="Ex. infirmière, comptable, contrôleur aérien…" defaultValue={v.profession} className={input} />
      </Field>

      <Field label="Votre objectif ou vos disponibilités (facultatif)" name="message">
        <textarea id="message" name="message" rows={4} maxLength={2000} defaultValue={v.message} placeholder="Ex. préparer un entretien en anglais, cours le soir après 18 h…" className={cn(input, "h-auto py-3 leading-relaxed")} />
      </Field>

      <label className={cn("flex items-start gap-3 rounded-xl p-3 text-sm", bad("consent") ? "bg-destructive/5 text-destructive" : "bg-brand-soft/60 text-ink/85")}>
        <input type="checkbox" name="consent" className="mt-0.5 size-5 shrink-0 accent-primary" required />
        <span>
          J&apos;accepte que MaelEnglish me recontacte sur WhatsApp ou par email au sujet de ma demande (
          <Link href="/confidentialite" className="font-semibold text-primary underline" target="_blank">
            politique de confidentialité
          </Link>
          ).
        </span>
      </label>

      <SubmitButton className="h-13 rounded-2xl border-2 border-coral bg-white text-[19px] font-bold text-coral shadow-[0_5px_0_0_var(--color-coral)] hover:bg-coral-soft">
        {kind === "notify" ? "Me prévenir" : "Envoyer ma demande"}
      </SubmitButton>
    </form>
  );
}
