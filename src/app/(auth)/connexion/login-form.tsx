"use client";

import { useActionState, useSyncExternalStore } from "react";
import Link from "next/link";
import { login } from "../actions";
import { Field, FormMessage, PasswordField, SubmitButton } from "@/components/auth/form-parts";

export function LoginForm() {
  const [state, action] = useActionState(login, undefined);
  const next = useNextParam();
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
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
      <PasswordField label="Mot de passe" name="password" autoComplete="current-password" required />
      <div className="-mt-1 text-right">
        <Link href="/mot-de-passe-oublie" className="text-sm font-medium text-primary hover:underline">
          Mot de passe oublié ?
        </Link>
      </div>
      <SubmitButton>Me connecter</SubmitButton>
    </form>
  );
}

// `?next=` read on the client only (server snapshot ""), so the form stays in the static HTML
// instead of bailing out to client rendering like useSearchParams() would.
const noop = () => () => {};
function useNextParam() {
  return useSyncExternalStore(
    noop,
    () => new URLSearchParams(window.location.search).get("next") ?? "",
    () => "",
  );
}
