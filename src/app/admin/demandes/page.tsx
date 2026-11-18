import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Mail, UserPlus } from "lucide-react";
import { requireStaff, actorOf } from "@/lib/admin/context";
import { can } from "@/lib/admin/permissions";
import { listRequests, offerName } from "@/lib/requests";
import { displayPhone } from "@/lib/phone";
import { waLink } from "@/lib/site";
import { EmptyState, PageHeader, Pill, btn, fmtDate, inputCls } from "@/components/admin/ui";
import { AdminForm, Submit } from "@/components/admin/forms";
import { WhatsAppIcon } from "@/components/site/icons";
import { updateRequestAction } from "../actions";
import { PageSkeleton } from "@/components/learn/ui";
import { cn } from "cn";

export const metadata: Metadata = { title: "Demandes d'inscription" };

const STATUS = {
  new: { label: "Nouvelle", tone: "red" as const },
  contacted: { label: "Contactée", tone: "amber" as const },
  enrolled: { label: "Inscrite", tone: "green" as const },
  closed: { label: "Sans suite", tone: "grey" as const },
};
const LEVEL: Record<string, string> = { beginner: "Débutant", intermediate: "Intermédiaire", advanced: "Avancé", unknown: "Niveau inconnu" };
const TABS = [{ value: "", label: "Toutes" }, ...Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))];

async function Requests({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const me = await requireStaff("/admin/demandes");
  if (!can.manageUsers(actorOf(me))) redirect("/admin");
  const sp = await searchParams;
  const status = typeof sp.statut === "string" ? sp.statut : "new";
  const items = await listRequests(status || undefined);

  return (
    <div className="max-w-5xl">
      <PageHeader title="Demandes d'inscription" subtitle="Envoyées depuis le formulaire « S'inscrire » du site." />
      <nav className="mb-4 flex flex-wrap gap-1" aria-label="Filtrer">
        {TABS.map((t) => (
          <Link key={t.value} href={`?statut=${t.value}`} aria-current={status === t.value ? "page" : undefined} className={cn("rounded-xl px-3 py-2 text-sm font-semibold", status === t.value ? "bg-primary text-white" : "text-ink/80 hover:bg-brand-soft")}>
            {t.label}
          </Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <EmptyState>{status === "new" ? "Aucune nouvelle demande." : "Aucune demande ici."}</EmptyState>
      ) : (
        <ul className="grid gap-3">
          {items.map((r) => {
            const st = STATUS[r.status as keyof typeof STATUS];
            const offer = offerName(r.program ?? "");
            const hello = waLink(`Bonjour ${r.firstName}, ici l'équipe MaelEnglish. Merci pour votre demande (${offer}). `).replace(/^https:\/\/wa\.me\/\d+/, `https://wa.me/${r.phoneE164}`);
            const create = `/admin/utilisateurs/nouveau?${new URLSearchParams({ prenom: r.firstName, nom: r.lastName, tel: r.phoneNumber, email: r.email ?? "" })}`;
            return (
              <li key={String(r._id)} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-brand-deep">
                      {r.firstName} {r.lastName} <Pill tone={st.tone}>{st.label}</Pill>
                      {r.kind === "notify" && <Pill tone="blue">Prévenir à l&apos;ouverture</Pill>}
                    </p>
                    <p className="text-sm text-primary">{offer}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {displayPhone(r.phoneE164)}
                      {r.email ? ` · ${r.email}` : ""} · {LEVEL[r.level ?? "unknown"]}
                      {r.profession ? ` · ${r.profession}` : ""} · reçue le {fmtDate(r.createdAt)}
                    </p>
                    {r.message && <p className="mt-2 rounded-xl bg-muted/60 px-3 py-2 text-sm whitespace-pre-line text-ink/85">{r.message}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a href={hello} target="_blank" rel="noopener" className={btn.secondary}>
                      <WhatsAppIcon className="size-4" /> WhatsApp
                    </a>
                    {r.email && (
                      <a href={`mailto:${r.email}`} className={btn.secondary}>
                        <Mail className="size-4" aria-hidden /> Email
                      </a>
                    )}
                    <Link href={create} className={btn.primary}>
                      <UserPlus className="size-4" aria-hidden /> Créer le compte
                    </Link>
                  </div>
                </div>
                <AdminForm action={updateRequestAction} className="mt-3 gap-2 border-t border-border pt-3">
                  <input type="hidden" name="requestId" value={String(r._id)} />
                  <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-end">
                    <label className="grid gap-1 text-xs">
                      Statut
                      <select name="status" defaultValue={r.status} className={inputCls}>
                        {Object.entries(STATUS).map(([v, s]) => (
                          <option key={v} value={v}>{s.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs">
                      Notes internes
                      <input name="notes" defaultValue={r.notes ?? ""} className={inputCls} placeholder="Ex. appelé le 20/11, test de niveau prévu…" />
                    </label>
                    <Submit variant="secondary">Enregistrer</Submit>
                  </div>
                </AdminForm>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function Page({ searchParams }: PageProps<"/admin/demandes">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Requests searchParams={searchParams} />
    </Suspense>
  );
}
