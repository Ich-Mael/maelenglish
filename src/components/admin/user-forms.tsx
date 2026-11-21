"use client";

import { AdminForm, Submit } from "./forms";
import { LinkResult } from "./link-result";
import { Checkbox, Input, Select, ROLE_LABELS } from "./ui";
import { accountLinkAction, createUserAction } from "@/app/admin/actions";

export function CreateUserForm({ roles, defaults = {} }: { roles: string[]; defaults?: Record<string, string> }) {
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
        <Input label="First name" name="name" required autoComplete="off" defaultValue={defaults.name} />
        <Input label="Last name" name="surname" required autoComplete="off" defaultValue={defaults.surname} />
      </div>
      <Input label="Username" name="username" required autoCapitalize="none" autoComplete="off" hint="3 to 30 characters: letters, digits, dot, dash. Used to sign in." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Email" name="email" type="email" autoComplete="off" hint="The activation link will be sent there." defaultValue={defaults.email} />
        <Input label="WhatsApp number" name="phoneNumber" type="tel" autoComplete="off" hint="Email or number: at least one of the two." defaultValue={defaults.phoneNumber} />
      </div>
      <Select label="Role" name="role" defaultValue="user" options={roles.map((r) => ({ value: r, label: ROLE_LABELS[r] ?? r }))} />
      <div>
        <Submit>Create account</Submit>
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
      {hasEmail && <Checkbox name="email" label="Also send by email" defaultChecked />}
      <div>
        <Submit variant="secondary">{kind === "activation" ? "Generate a new activation link" : "Generate a password reset link"}</Submit>
      </div>
    </AdminForm>
  );
}
