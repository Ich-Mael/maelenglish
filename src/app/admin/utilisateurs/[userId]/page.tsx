import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { requireStaff, actorOf } from "@/lib/admin/context";
import { can } from "@/lib/admin/permissions";
import { assignableRoles } from "@/lib/auth/accounts";
import { userDetail } from "@/lib/admin/users";
import { accessState, ADMIN_ROLES } from "@/models";
import { Card, Input, PageHeader, Pill, ROLE_LABELS, Select, fmtDate } from "@/components/admin/ui";
import { ActionButton, AdminForm, Submit } from "@/components/admin/forms";
import { AccountLinkForm } from "@/components/admin/user-forms";
import { revokeDeviceAction, toggleUserAction, updateUserAction } from "../../actions";
import { PageSkeleton } from "@/components/learn/ui";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { toEditorHtml } from "@/lib/rich-text";

export const metadata: Metadata = { title: "Account" };

const STATE: Record<string, { label: string; tone: "green" | "amber" | "red" | "grey" | "blue" }> = {
  active: { label: "Active", tone: "green" },
  "not-started": { label: "Not started", tone: "blue" },
  expired: { label: "Expired", tone: "grey" },
  suspended: { label: "Suspended", tone: "red" },
  completed: { label: "Completed", tone: "green" },
};

async function UserView({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  await connection();
  const me = await requireStaff(`/admin/utilisateurs/${userId}`);
  if (!can.manageUsers(actorOf(me))) redirect("/admin");
  const d = await userDetail(userId);
  if (!d) notFound();
  const u = d.user;
  const isAdminAccount = ADMIN_ROLES.includes(u.role as never);
  const roles = assignableRoles({ _id: me.id as never, role: me.role });
  const roleOptions = [...new Set([u.role as string, ...roles])].map((r) => ({ value: r, label: ROLE_LABELS[r] ?? r }));
  const active = u.isActive !== false;
  const isSelf = String(u._id) === me.id;

  return (
    <div className="grid max-w-5xl gap-5">
      <PageHeader
        title={`${u.name} ${u.surname}`}
        back={{ href: "/admin/utilisateurs", label: "Users" }}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            @{u.username} · {ROLE_LABELS[u.role as string]} {!active ? <Pill tone="red">Deactivated</Pill> : d.activated ? <Pill tone="green">Activated</Pill> : <Pill tone="amber">Not activated</Pill>}
          </span>
        }
        actions={
          !isSelf && !isAdminAccount ? (
            <ActionButton
              action={toggleUserAction}
              fields={{ userId: String(u._id), op: active ? "deactivate" : "restore" }}
              variant={active ? "danger" : "secondary"}
              confirm={active ? "Deactivate this account? The person will be signed out and their enrolments suspended." : undefined}
            >
              {active ? "Deactivate account" : "Reactivate account"}
            </ActionButton>
          ) : undefined
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Profile">
          <AdminForm action={updateUserAction}>
            <input type="hidden" name="userId" value={String(u._id)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="First name" name="name" defaultValue={u.name} required />
              <Input label="Last name" name="surname" defaultValue={u.surname} required />
              <Input label="Username" name="username" defaultValue={u.username} required />
              {isAdminAccount ? (
                <Input label="Role" name="roleDisplay" value={ROLE_LABELS[u.role as string]} readOnly hint="Can only be changed in the database." />
              ) : (
                <Select label="Role" name="role" defaultValue={u.role as string} options={roleOptions} />
              )}
              <Input label="Email" name="email" type="email" defaultValue={u.email ?? ""} />
              <Input label="WhatsApp number" name="phoneNumber" defaultValue={u.phoneNumber ?? ""} />
              <Input label="English level" name="englishLevel" defaultValue={u.englishLevel ?? ""} />
              <Input label="Max devices" name="maxDevices" type="number" min={1} max={20} defaultValue={u.maxDevices ?? 3} hint="For information (not enforced)." />
              <Input label="AI minutes per month" name="aiMonthlyMinutes" type="number" min={0} max={10000} defaultValue={u.aiMonthlyMinutes ?? ""} placeholder="Default" hint="Empty = the default (AI usage page)." />
            </div>
            <RichTextEditor label="Notes" name="about" minHeight={160} defaultValue={toEditorHtml(u.about, "text")} />
            <div>
              <Submit>Save</Submit>
            </div>
          </AdminForm>
        </Card>

        <div className="grid content-start gap-5">
          <Card title={d.activated ? "Password" : "Activation"} description={d.activated ? "Forgotten password? Generate a link valid for 1 hour." : "The person hasn't chosen their password yet."}>
            <AccountLinkForm userId={String(u._id)} kind={d.activated ? "reset" : "activation"} hasEmail={!!u.email} />
          </Card>
          <Card title="Activity">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Created on</dt>
                <dd>{fmtDate(u.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last sign-in</dt>
                <dd>{fmtDate(u.lastLoginAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Open sessions</dt>
                <dd>{d.sessions}</dd>
              </div>
              {!active && (
                <div>
                  <dt className="text-muted-foreground">Deactivated on</dt>
                  <dd>{fmtDate(u.deactivatedAt)}</dd>
                </div>
              )}
            </dl>
          </Card>
        </div>
      </div>

      <Card title="Enrolments">
        {d.enrollments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No enrolments.</p>
        ) : (
          <ul className="grid gap-2">
            {d.enrollments.map((e) => {
              const st = STATE[accessState(e)];
              return (
                <li key={String(e._id)} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                  <Link href={`/admin/cours/${e.courseId._id}/inscriptions`} className="font-semibold text-brand-deep hover:underline">
                    {e.courseId.title}
                  </Link>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    {fmtDate(e.startDate)} → {e.endDate ? fmtDate(e.endDate) : "no end"} <Pill tone={st.tone}>{st.label}</Pill>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title={`Devices (${u.devices?.length ?? 0} / ${u.maxDevices ?? 3})`} description="For information: removing a device also signs it out.">
        {!u.devices?.length ? (
          <p className="text-sm text-muted-foreground">No devices recorded.</p>
        ) : (
          <ul className="grid gap-2">
            {u.devices.map((dv) => {
              const Icon = dv.deviceType === "mobile" ? Smartphone : dv.deviceType === "tablet" ? Tablet : Monitor;
              return (
                <li key={dv.deviceId} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm">
                  <Icon className="size-5 text-primary" aria-hidden />
                  <span className="flex-1">
                    {dv.browser} · {dv.os}
                    <span className="block text-xs text-muted-foreground">Seen on {fmtDate(dv.lastLogin)} · IP {dv.ipAddress || "?"}</span>
                  </span>
                  <ActionButton action={revokeDeviceAction} fields={{ userId: String(u._id), deviceId: dv.deviceId }} variant="secondary" confirm="Remove this device and sign it out?">
                    Remove
                  </ActionButton>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default function Page({ params }: PageProps<"/admin/utilisateurs/[userId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <UserView params={params} />
    </Suspense>
  );
}
