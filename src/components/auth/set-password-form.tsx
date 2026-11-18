"use client";

import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import { setPasswordWithToken } from "@/app/(auth)/actions";
import { FormMessage, PasswordField, SubmitButton } from "./form-parts";
import { cn } from "cn";

/** Live checklist: same rules as `passwordProblem` on the server. */
const RULES = [
  { label: "8 caractères minimum", test: (p: string) => p.length >= 8 },
  { label: "au moins une lettre", test: (p: string) => /[a-zA-Z]/.test(p) },
  { label: "au moins un chiffre", test: (p: string) => /[0-9]/.test(p) },
];

export function SetPasswordForm({ token, purpose }: { token: string; purpose: "activation" | "reset" }) {
  const [state, action] = useActionState(setPasswordWithToken, undefined);
  const [password, setPassword] = useState("");
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="purpose" value={purpose} />
      <FormMessage error={state?.error} />
      <PasswordField
        label="Nouveau mot de passe"
        name="password"
        autoComplete="new-password"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <ul className="-mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Règles du mot de passe">
        {RULES.map((r) => {
          const ok = r.test(password);
          return (
            <li key={r.label} className={cn("flex items-center gap-1 transition-colors", ok ? "text-success" : "text-muted-foreground")}>
              <Check className={cn("size-3.5 transition-opacity", ok ? "opacity-100" : "opacity-30")} aria-hidden />
              {r.label}
            </li>
          );
        })}
      </ul>
      <PasswordField label="Confirmer le mot de passe" name="confirm" autoComplete="new-password" required />
      <SubmitButton>{purpose === "activation" ? "Activer mon compte" : "Enregistrer le mot de passe"}</SubmitButton>
    </form>
  );
}
