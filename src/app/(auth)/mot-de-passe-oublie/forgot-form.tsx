"use client";

import { useActionState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { requestPasswordReset } from "../actions";
import { Field, FormMessage, SubmitButton } from "@/components/auth/form-parts";

export function ForgotForm({ whatsappHref }: { whatsappHref: string }) {
  const [state, action] = useActionState(requestPasswordReset, undefined);

  if (state?.success) {
    return (
      <div className="grid gap-4 text-center">
        <MailCheck className="mx-auto size-12 text-success" aria-hidden />
        <p>
          Si ce compte a une adresse email, un lien pour choisir un nouveau mot de passe vient d&apos;y être envoyé. Il est
          valable 1 heure.
        </p>
        <p className="text-sm text-muted-foreground">
          Pas d&apos;email sur votre compte ?{" "}
          <a href={whatsappHref} target="_blank" rel="noopener" className="font-medium text-coral-dark hover:underline">
            Demandez un lien à l&apos;équipe sur WhatsApp
          </a>
          .
        </p>
        <Link href="/connexion" className="text-sm font-medium text-primary hover:underline">
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-4">
      <FormMessage error={state?.error} />
      <Field
        label="Identifiant, email ou numéro WhatsApp"
        name="identifier"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        defaultValue={state?.values?.identifier}
      />
      <SubmitButton>Recevoir un lien par email</SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        Votre compte n&apos;a pas d&apos;email ?{" "}
        <a href={whatsappHref} target="_blank" rel="noopener" className="font-medium text-coral-dark hover:underline">
          Contactez l&apos;équipe sur WhatsApp
        </a>{" "}
        pour recevoir un lien.
      </p>
      <Link href="/connexion" className="text-center text-sm font-medium text-primary hover:underline">
        Retour à la connexion
      </Link>
    </form>
  );
}
