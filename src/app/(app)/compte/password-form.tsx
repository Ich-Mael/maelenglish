"use client";

import { useActionState, useEffect, useRef } from "react";
import { updatePassword } from "@/app/(auth)/actions";
import { FormMessage, PasswordField, SubmitButton } from "@/components/auth/form-parts";

export function PasswordForm() {
  const [state, action] = useActionState(updatePassword, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.success) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="grid gap-4">
      <FormMessage error={state?.error} success={state?.success} />
      <PasswordField label="Mot de passe actuel" name="current" autoComplete="current-password" required />
      <PasswordField
        label="Nouveau mot de passe"
        name="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="8 caractères minimum, avec au moins une lettre et un chiffre."
      />
      <PasswordField label="Confirmer le nouveau mot de passe" name="confirm" autoComplete="new-password" required />
      <SubmitButton className="sm:w-fit sm:px-6">Changer le mot de passe</SubmitButton>
    </form>
  );
}
