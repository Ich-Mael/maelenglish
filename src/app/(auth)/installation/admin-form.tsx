"use client";

import { useActionState } from "react";
import { createFirstAdmin } from "../actions";
import { Field, FormMessage, PasswordField, SubmitButton } from "@/components/auth/form-parts";

export function AdminForm() {
  const [state, action] = useActionState(createFirstAdmin, undefined);
  const v = state?.values ?? {};
  return (
    <form action={action} className="grid gap-4">
      <FormMessage error={state?.error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom" name="name" autoComplete="given-name" required defaultValue={v.name} />
        <Field label="Nom" name="surname" autoComplete="family-name" required defaultValue={v.surname} />
      </div>
      <Field
        label="Nom d'utilisateur"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        required
        defaultValue={v.username}
        hint="3 à 30 caractères : lettres, chiffres, point, tiret."
      />
      <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={v.email} />
      <Field
        label="Numéro WhatsApp"
        name="phoneNumber"
        type="tel"
        autoComplete="tel"
        defaultValue={v.phoneNumber}
        hint="Email ou numéro : au moins l'un des deux."
      />
      <PasswordField label="Mot de passe" name="password" autoComplete="new-password" required minLength={8} />
      <PasswordField label="Confirmer le mot de passe" name="confirm" autoComplete="new-password" required />
      <SubmitButton>Créer le compte administrateur</SubmitButton>
    </form>
  );
}
