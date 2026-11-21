import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { LayoutDashboard, Monitor, Smartphone, Tablet } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { describeUserAgent } from "@/lib/auth/device";
import { displayPhone } from "@/lib/phone";
import { Session, User } from "@/models";
import { levelLabel } from "@/lib/levels";
import { AvatarPicker } from "@/components/account/avatar-picker";
import { Button } from "@/components/ui/button";
import { revokeSession } from "@/app/(auth)/actions";
import { LogoutButton } from "@/components/pwa/logout-button";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Mon compte", robots: { index: false } };

const ROLE_LABELS: Record<string, string> = {
  user: "Apprenant·e",
  "english-coach": "Coach d'anglais",
  instructor: "Formateur·rice",
  "account-manager": "Gestionnaire de comptes",
  admin: "Administrateur·rice",
  "super-admin": "Super administrateur·rice",
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <h2 className="mb-4 text-lg font-bold text-brand-deep">{title}</h2>
      {children}
    </section>
  );
}

async function Account() {
  await connection();
  const me = await requireUser("/compte");
  const level = await User.findById(me.id).select("englishLevel").lean();
  const sessions = await Session.find({ userId: me.id, expiresAt: { $gt: new Date() } })
    .sort({ lastSeenAt: -1 })
    .lean();

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-brand-deep">Mon compte</h1>
          <p className="text-muted-foreground">
            {me.name} {me.surname} · {ROLE_LABELS[me.role] ?? me.role}
          </p>
        </div>
        <LogoutButton />
      </div>

      {me.isStaff && (
        <Link href="/admin" className="flex items-center gap-3 rounded-3xl bg-brand-deep p-5 font-semibold text-white hover:brightness-110">
          <LayoutDashboard className="size-6 text-xp" aria-hidden /> Espace administration
        </Link>
      )}

      <Section title="Profil">
        <div className="mb-5">
          <AvatarPicker userId={me.id} src={me.avatarUrl} name={me.name || me.username} />
        </div>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Identifiant", me.username],
            ["Niveau d’anglais", levelLabel(level?.englishLevel) || "Pas encore évalué"],
            ["Email", me.email ?? "—"],
            ["WhatsApp", me.phoneE164 ? displayPhone(me.phoneE164) : "—"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{k}</dt>
              <dd className="mt-0.5 break-all">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Mot de passe">
        <PasswordForm />
      </Section>

      <Section title="Appareils connectés">
        <ul className="grid gap-2">
          {sessions.map((s) => {
            const d = describeUserAgent(s.userAgent ?? "");
            const Icon = d.deviceType === "mobile" ? Smartphone : d.deviceType === "tablet" ? Tablet : Monitor;
            const current = String(s._id) === me.sessionId;
            return (
              <li key={String(s._id)} className="flex items-center gap-3 rounded-2xl border border-border p-3">
                <Icon className="size-5 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {d.browser} · {d.os}
                    {current && (
                      <span className="ml-2 rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
                        Cet appareil
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">Dernière activité : {dateFmt.format(s.lastSeenAt)}</p>
                </div>
                {!current && (
                  <form action={revokeSession}>
                    <input type="hidden" name="sessionId" value={String(s._id)} />
                    <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                      Déconnecter
                    </Button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
        {sessions.length > 1 && (
          <form action={revokeSession} className="mt-4">
            <input type="hidden" name="sessionId" value="others" />
            <Button type="submit" variant="outline" className="rounded-xl">
              Déconnecter tous les autres appareils
            </Button>
          </form>
        )}
      </Section>
    </div>
  );
}

function AccountFallback() {
  return (
    <div className="grid animate-pulse gap-6" aria-busy>
      <div className="h-10 w-1/2 rounded-xl bg-muted" />
      <div className="h-32 rounded-3xl bg-muted" />
      <div className="h-64 rounded-3xl bg-muted" />
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<AccountFallback />}>
      <Account />
    </Suspense>
  );
}
