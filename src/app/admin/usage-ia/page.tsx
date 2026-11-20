import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { requireStaff } from "@/lib/admin/context";
import { usageReport } from "@/lib/ai/metering";
import { Card, EmptyState, Input, PageHeader } from "@/components/admin/ui";
import { AdminForm, Submit } from "@/components/admin/forms";
import { PageSkeleton } from "@/components/learn/ui";
import { saveAiSettingsAction } from "../actions";

export const metadata: Metadata = { title: "Usage IA" };

const minutes = (s: number) => `${(s / 60).toFixed(s < 600 ? 1 : 0)} min`;
const usd = (micros: number) => `${(micros / 1_000_000).toFixed(2)} $`;

async function Usage() {
  const me = await requireStaff("/admin/usage-ia");
  if (!me.isAdmin) redirect("/admin");
  await connection();
  const r = await usageReport();
  return (
    <div className="grid max-w-5xl gap-5">
      <PageHeader title="Usage IA" subtitle={`Consommation des services IA (voix, prononciation, conversation, corrections) — mois ${r.month}. Coûts estimés.`} />
      <Card title="Minutes IA par apprenant" description="Temps de parole analysé et conversations IA, par mois. Les corrections écrites ne sont pas décomptées.">
        <AdminForm action={saveAiSettingsAction} className="max-w-sm">
          <Input label="Minutes par mois (par défaut)" name="aiMonthlyMinutes" type="number" min={0} max={10000} defaultValue={r.defaultMinutes} hint="Modifiable pour un apprenant précis sur sa fiche." />
          <div>
            <Submit>Enregistrer</Submit>
          </div>
        </AdminForm>
      </Card>

      <Card title="Ce mois-ci, par apprenant">
        {r.rows.length === 0 ? (
          <EmptyState>Aucune utilisation des services IA ce mois-ci.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Apprenant</th>
                  <th className="py-2 pr-4 font-semibold">Minutes</th>
                  <th className="py-2 pr-4 font-semibold">Appels</th>
                  <th className="py-2 font-semibold">Coût estimé</th>
                </tr>
              </thead>
              <tbody>
                {r.rows.map((u) => (
                  <tr key={u.userId} className="border-t border-border">
                    <td className="py-2 pr-4">
                      <Link href={`/admin/utilisateurs/${u.userId}`} className="font-semibold text-brand-deep hover:text-primary">
                        {u.name}
                      </Link>
                      <span className="ml-2 text-muted-foreground">{u.username}</span>
                    </td>
                    <td className="py-2 pr-4 tabular-nums">{minutes(u.seconds)}</td>
                    <td className="py-2 pr-4 tabular-nums">{u.calls}</td>
                    <td className="py-2 tabular-nums">{usd(u.costMicros)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="14 derniers jours">
        {r.days.length === 0 ? (
          <EmptyState>Rien sur la période.</EmptyState>
        ) : (
          <ul className="grid gap-1 text-sm">
            {r.days.map((d) => (
              <li key={d.day} className="flex justify-between gap-4 border-t border-border py-1.5 first:border-0">
                <span className="font-semibold">{d.day}</span>
                <span className="tabular-nums text-muted-foreground">
                  {minutes(d.seconds)} · {d.calls} appels · {usd(d.costMicros)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Usage />
    </Suspense>
  );
}
