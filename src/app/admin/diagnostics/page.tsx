import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { actorOf, requireStaff } from "@/lib/admin/context";
import { can } from "@/lib/admin/permissions";
import { listDiagnostics } from "@/lib/diagnostic/service";
import { PROFILE_INFO, type ProfileId } from "@/lib/diagnostic/profiles";
import { SECTIONS } from "@/lib/diagnostic/questions";
import { Card, EmptyState, PageHeader, Pill, fmtDate } from "@/components/admin/ui";
import { DiagnosticStatus } from "@/components/admin/diagnostic-status";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Diagnostics" };

const name = (p: string) => PROFILE_INFO[p as ProfileId]?.name ?? p;

async function Diagnostics() {
  const me = await requireStaff("/admin/diagnostics");
  if (!can.manageUsers(actorOf(me))) redirect("/admin");
  await connection();
  const { done, started, abandoned } = await listDiagnostics();
  return (
    <div className="grid max-w-5xl gap-5">
      <PageHeader title="Diagnostics" subtitle="Leads from the public learning-path diagnostic (/diagnostic): profile, contact, follow-up." />
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "Started", value: started },
          { label: "Completed (leads)", value: done.length },
          { label: "Completion rate", value: started ? `${Math.round((done.length / started) * 100)} %` : "—" },
        ].map((x) => (
          <div key={x.label} className="flex flex-col-reverse rounded-2xl border border-border bg-card px-4 py-3">
            <dt className="text-xs font-semibold text-muted-foreground">{x.label}</dt>
            <dd className="font-heading text-2xl font-extrabold text-brand-deep tabular-nums">{x.value}</dd>
          </div>
        ))}
      </dl>
      {abandoned.length > 0 && (
        <Card title="Where people stop" description="Unfinished diagnostics by the last section completed.">
          <ul className="flex flex-wrap gap-2 text-sm">
            {abandoned.map((a) => (
              <li key={a.section} className="rounded-full bg-muted px-3 py-1">
                {a.section === 0 ? "Before section 1" : `After ${SECTIONS[a.section - 1]?.title ?? a.section}`}: <strong>{a.count}</strong>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card title="Leads">
        {done.length === 0 ? (
          <EmptyState>No completed diagnostic yet.</EmptyState>
        ) : (
          <ul className="grid gap-2">
            {done.map((d) => (
              <li key={String(d._id)} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border p-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/diagnostics/${d._id}`} className="font-semibold text-brand-deep hover:text-primary">
                    {d.lead?.firstName}
                  </Link>{" "}
                  <span className="text-sm text-muted-foreground">
                    {d.lead?.email}
                    {d.lead?.phone ? ` · ${d.lead.phone}` : ""} · {fmtDate(d.completedAt)}
                    {d.utmSource ? ` · via ${d.utmSource}` : ""}
                  </span>
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    <Pill tone="blue">{name(d.primaryProfile)}</Pill>
                    {(d.secondaryProfiles ?? []).map((p) => (
                      <Pill key={p}>{name(p)}</Pill>
                    ))}
                    {d.lead?.consentMarketing && <Pill>Newsletter</Pill>}
                    {d.reportSource === "fallback" && <Pill>Fallback report</Pill>}
                  </p>
                </div>
                <DiagnosticStatus id={String(d._id)} status={d.status ?? "new"} />
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
      <Diagnostics />
    </Suspense>
  );
}
