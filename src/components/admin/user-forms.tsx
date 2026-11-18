"use client";

import { AdminForm, Submit } from "./forms";
import { LinkResult } from "./link-result";
import { Checkbox, Input, Select, ROLE_LABELS } from "./ui";
import { accountLinkAction, createUserAction } from "@/app/admin/actions";

export function CreateUserForm({ roles }: { roles: string[] }) {
  return (
    <AdminForm
      action={createUserAction}
      resetOnSuccess
      onSuccess={(s) => (
        <>
          <p role="status" className="text-sm font-semibold text-success">{s.success}</p>
          <LinkResult data={s.data} userHref={s.data?.userId ? `/admin/utilisateurs/${s.data.userId}` : undefined} />
        </>
      )}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Prénom" name="name" required autoComplete="off" />
        <Input label="Nom" name="surname" required autoComplete="off" />
      </div>
      <Input label="Nom d'utilisateur" name="username" required autoCapitalize="none" autoComplete="off" hint="3 à 30 caractères : lettres, chiffres, point, tiret. Sert à se connecter." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Email" name="email" type="email" autoComplete="off" hint="Le lien d'activation y sera envoyé." />
        <Input label="Numéro WhatsApp" name="phoneNumber" type="tel" autoComplete="off" hint="Email ou numéro : au moins l'un des deux." />
      </div>
      <Select label="Rôle" name="role" defaultValue="user" options={roles.map((r) => ({ value: r, label: ROLE_LABELS[r] ?? r }))} />
      <div>
        <Submit>Créer le compte</Submit>
      </div>
    </AdminForm>
  );
}

export function AccountLinkForm({ userId, kind, hasEmail }: { userId: string; kind: "activation" | "reset"; hasEmail: boolean }) {
  return (
    <AdminForm action={accountLinkAction} onSuccess={(s) => (
      <>
        <p role="status" className="text-sm font-semibold text-success">{s.success}</p>
        <LinkResult data={s.data} />
      </>
    )}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="kind" value={kind} />
      {hasEmail && <Checkbox name="email" label="Envoyer aussi par email" defaultChecked />}
      <div>
        <Submit variant="secondary">{kind === "activation" ? "Générer un nouveau lien d'activation" : "Générer un lien de réinitialisation"}</Submit>
      </div>
    </AdminForm>
  );
}
