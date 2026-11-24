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
import { revokeDeviceAction, setCoachAction, storyAccessAction, toggleUserAction, updateUserAction } from "../../actions";
import { Coaching, StoryEntitlement } from "@/models";
import { listSeasons } from "@/lib/story/content";
import { storySecondsUsed } from "@/lib/story/minutes";
import { coachOptions } from "@/lib/admin/coaching";
import { PageSkeleton } from "@/components/learn/ui";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { toEditorHtml } from "@/lib/rich-text";
import { ENGLISH_LEVELS, isEnglishLevel } from "@/lib/levels";
import { Avatar } from "@/components/account/avatar";
import { AvatarPicker } from "@/components/account/avatar-picker";

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
  const coaches = u.role === "user" && can.assignCoach(actorOf(me)) ? await coachOptions() : [];
  const active = u.isActive !== false;
  const stories = u.role === "user" && can.manageEnrollments(actorOf(me)) ? await listSeasons({ drafts: true }) : [];
  const storyEnts = stories.length ? await StoryEntitlement.find({ userId: u._id }).lean() : [];
  const storyUsed = await Promise.all(stories.map((s) => (storyEnts.some((e) => e.storyId === s.id) ? storySecondsUsed(String(u._id), s.id) : 0)));
  const isSelf = String(u._id) === me.id;
  const coachings = u.role === "user" ? await Coaching.find({ memberIds: u._id }).select("title status kind").sort({ updatedAt: -1 }).lean() : [];

  return (
    <div className="grid max-w-5xl gap-5">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Avatar src={u.avatarUrl} name={u.name || u.username} className="size-11 text-lg" />
            {u.name} {u.surname}
          </span>
        }
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
        <div className="grid content-start gap-5">
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
                <Select
                  label="English level (CEFR)"
                  name="englishLevel"
                  defaultValue={u.englishLevel ?? ""}
                  options={[
                    { value: "", label: "— Not assessed —" },
                    ...(u.englishLevel && !isEnglishLevel(u.englishLevel) ? [{ value: u.englishLevel, label: `${u.englishLevel} (old value)` }] : []),
                    ...ENGLISH_LEVELS.map((l) => ({ value: l.value, label: `${l.value} · ${l.en}` })),
                  ]}
                />
                {u.role !== "user" && (
                  <Input
                    label="Coach name (shown to learners)"
                    name="coachName"
                    defaultValue={u.coachName ?? ""}
                    maxLength={40}
                    placeholder={`Coach ${u.name}`}
                    hint="E.g. « Coach Ish ». Learners see it on feedback, voice notes and emails. Empty = « Coach » + first name."
                  />
                )}
                <Input label="Max devices" name="maxDevices" type="number" min={1} max={20} defaultValue={u.maxDevices ?? 3} hint="For information (not enforced)." />
                <Input label="AI minutes per month" name="aiMonthlyMinutes" type="number" min={0} max={10000} defaultValue={u.aiMonthlyMinutes ?? ""} placeholder="Default" hint="Empty = the default (AI usage page)." />
              </div>
              <RichTextEditor label="Notes" name="about" minHeight={110} defaultValue={toEditorHtml(u.about, "text")} />
              <div>
                <Submit>Save</Submit>
              </div>
            </AdminForm>
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

        <div className="grid content-start gap-5">
          <Card title="Profile photo" description="Shown in the navigation bars and to coaches.">
            <AvatarPicker userId={String(u._id)} src={u.avatarUrl ?? null} name={u.name || u.username} locale="en" />
          </Card>
          {u.role === "user" && (
            <Card title="Coaching" description="MaelEnglish Coaching: goals, feedback, resources, tasks and live sessions.">
              <div className="grid gap-2">
                {coachings.map((c) => (
                  <Link key={String(c._id)} href={`/admin/coaching/${c._id}`} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-brand-deep hover:bg-brand-soft">
                    <span className="truncate">{c.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{c.kind === "group" ? "Group" : "One-on-one"} · {c.status}</span>
                  </Link>
                ))}
                {can.manageUsers(actorOf(me)) && (
                  <Link href={`/admin/coaching/nouveau?user=${u._id}`} className="inline-flex h-10 w-fit items-center rounded-xl border-2 border-coral bg-white px-4 text-sm font-bold text-coral-dark hover:bg-coral-soft">
                    Start a coaching
                  </Link>
                )}
              </div>
            </Card>
          )}
          {u.role === "user" && can.assignCoach(actorOf(me)) && (
            <Card title="Main coach" description="Reviews this learner's speaking challenges and receives the daily email about them. Without one, the course's teaching team does.">
              <AdminForm action={setCoachAction}>
                <input type="hidden" name="userId" value={String(u._id)} />
                <Select
                  label="Coach"
                  name="coachId"
                  defaultValue={u.coachId ? String(u.coachId) : ""}
                  options={[{ value: "", label: "— None (course team) —" }, ...coaches.map((c) => ({ value: String(c._id), label: `${c.name} ${c.surname} · ${ROLE_LABELS[c.role as string] ?? c.role}` }))]}
                />
                <div>
                  <Submit variant="secondary">Save coach</Submit>
                </div>
              </AdminForm>
            </Card>
          )}
          <Card title={d.activated ? "Password" : "Activation"} description={d.activated ? "Forgotten password? Generate a link valid for 1 hour." : "The person hasn't chosen their password yet."}>
            <AccountLinkForm userId={String(u._id)} kind={d.activated ? "reset" : "activation"} hasEmail={!!u.email} />
          </Card>
        </div>
      </div>

      {stories.length ? (
        <section aria-labelledby="story-access" className="relative overflow-clip rounded-3xl bg-gradient-to-br from-brand-deep via-brand-deep to-brand-dark p-5 text-white sm:p-6">
          <span aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-[radial-gradient(circle,rgb(54_79_171/0.9),transparent_70%)]" />
          <span aria-hidden className="pointer-events-none absolute -bottom-24 left-1/4 size-64 rounded-full bg-[radial-gradient(circle,rgb(255_87_87/0.22),transparent_70%)]" />
          <div className="relative flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-widest text-white/70 uppercase">Story Mode</p>
              <h2 id="story-access" className="font-heading text-2xl font-extrabold">
                Seasons for {u.name || u.username}
              </h2>
              <p className="text-sm text-white/80">Paid seasons: give access (optionally until a date) and extra conversation minutes when the season&apos;s minutes are used up.</p>
            </div>
            <Link href="/admin/story" className="rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20">
              Manage seasons →
            </Link>
          </div>
          <ul className="relative mt-4 grid gap-3 md:grid-cols-2">
            {stories.map((s, i) => {
              const ent = storyEnts.find((e) => e.storyId === s.id);
              const expired = !!ent?.expiresAt && ent.expiresAt < new Date();
              const allowance = s.aiMinutesIncluded + (ent?.extraMinutes ?? 0);
              const usedMin = Math.round(storyUsed[i] / 60);
              const pct = allowance ? Math.min(100, (usedMin / allowance) * 100) : 0;
              return (
                <li key={s.id} className="grid gap-3 rounded-2xl bg-white p-4 text-ink shadow-lg">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-heading text-lg leading-tight font-extrabold text-brand-deep">{s.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {[s.city.name, s.city.country].filter(Boolean).join(", ")} · {s.level}
                      </p>
                    </div>
                    <span className="flex flex-wrap gap-1">
                      {s.status === "draft" ? <Pill>Draft</Pill> : null}
                      {ent ? <Pill tone={expired ? "red" : "green"}>{expired ? "Access expired" : "Access"}</Pill> : <Pill>{s.free_episodes ? `${s.free_episodes} free episode(s) only` : "No access"}</Pill>}
                    </span>
                  </div>
                  {ent ? (
                    <div className="grid gap-1">
                      <p className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Conversation minutes</span>
                        <span className="font-semibold text-brand-deep tabular-nums">
                          {usedMin} / {allowance} min
                        </span>
                      </p>
                      <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                        <span className={pct >= 80 ? "block h-full rounded-full bg-coral" : "block h-full rounded-full bg-gradient-to-r from-primary to-brand-deep"} style={{ width: `${pct}%` }} />
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {s.aiMinutesIncluded} included + {ent.extraMinutes ?? 0} extra{ent.expiresAt ? ` · access until ${fmtDate(ent.expiresAt)}` : " · no end date"}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {s.aiMinutesIncluded} conversation minutes included{s.priceFcfa != null ? ` · ${s.priceFcfa.toLocaleString("fr-FR")} FCFA` : ""}
                    </p>
                  )}
                  {s.status === "draft" ? (
                    <p className="rounded-xl border-2 border-coral bg-coral-soft/50 px-3 py-2 text-sm text-coral-dark">
                      This season is a draft: the learner won&apos;t see it until it&apos;s published.{" "}
                      <Link href={`/admin/story/${s._id}`} className="font-semibold underline">
                        Open the season
                      </Link>
                    </p>
                  ) : null}
                  <AdminForm action={storyAccessAction} className="grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="userId" value={String(u._id)} />
                    <input type="hidden" name="storyId" value={s.id} />
                    <Input label="Until (optional)" name="expiresAt" type="date" defaultValue={ent?.expiresAt ? new Date(ent.expiresAt).toISOString().slice(0, 10) : ""} />
                    <Input label="Extra minutes" name="extraMinutes" type="number" min={0} defaultValue={String(ent?.extraMinutes ?? 0)} />
                    <span className="flex items-center gap-3 sm:col-span-2">
                      <Submit variant={ent ? "secondary" : "primary"}>{ent ? "Save" : "Give access"}</Submit>
                      {ent ? (
                        <button type="submit" name="grant" value="0" className="text-sm font-semibold text-destructive hover:underline">
                          Remove access
                        </button>
                      ) : null}
                    </span>
                  </AdminForm>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

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
                    <span className="block text-xs text-muted-foreground">
                      Seen on {fmtDate(dv.lastLogin)} · IP {dv.ipAddress || "?"}
                    </span>
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
