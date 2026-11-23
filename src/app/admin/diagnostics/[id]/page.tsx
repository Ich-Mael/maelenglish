import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { Types } from "mongoose";
import { actorOf, requireStaff } from "@/lib/admin/context";
import { can } from "@/lib/admin/permissions";
import { Diagnostic } from "@/models";
import { PROFILE_INFO, type ProfileId } from "@/lib/diagnostic/profiles";
import { answersInWords, type Answers } from "@/lib/diagnostic/questions";
import type { DiagnosticReport } from "@/lib/diagnostic/report-types";
import { Card, PageHeader, fmtDate } from "@/components/admin/ui";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Diagnostic" };

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireStaff(`/admin/diagnostics/${id}`);
  if (!can.manageUsers(actorOf(me))) redirect("/admin");
  await connection();
  if (!Types.ObjectId.isValid(id)) notFound();
  const d = await Diagnostic.findById(id).lean();
  if (!d) notFound();
  const r = d.report as DiagnosticReport | null;
  const scores = (d.profileScores ?? {}) as Record<string, { points: number; normalized: number }>;
  return (
    <div className="grid max-w-3xl gap-5">
      <PageHeader title={d.lead?.firstName ?? "Unfinished diagnostic"} back={{ href: "/admin/diagnostics", label: "Diagnostics" }} subtitle={[d.lead?.email, d.lead?.phone, fmtDate(d.completedAt ?? d.createdAt)].filter(Boolean).join(" · ")} />
      <Card title="Profiles">
        <ul className="grid gap-1 text-sm">
          {Object.entries(scores)
            .sort((a, b) => b[1].normalized - a[1].normalized)
            .map(([p, s]) => (
              <li key={p} className="flex justify-between gap-3">
                <span className={p === d.primaryProfile ? "font-bold text-brand-deep" : ""}>
                  {PROFILE_INFO[p as ProfileId]?.name ?? p}
                  {p === d.primaryProfile ? " (primary)" : (d.secondaryProfiles ?? []).includes(p) ? " (secondary)" : ""}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {s.points} pts · {Math.round(s.normalized * 100)} %
                </span>
              </li>
            ))}
        </ul>
      </Card>
      {r && (
        <Card title={`Report (${d.reportSource})`}>
          <div lang="fr" className="grid gap-2 text-sm">
            <p className="font-semibold text-brand-deep">{r.headline}</p>
            <p>{r.profile_summary}</p>
            <p className="text-muted-foreground">{r.reframe}</p>
          </div>
        </Card>
      )}
      <Card title="Answers">
        <pre lang="fr" className="text-xs leading-relaxed whitespace-pre-wrap text-ink/85">{answersInWords(d.answers as Answers) || "No answers."}</pre>
      </Card>
    </div>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Detail params={params} />
    </Suspense>
  );
}
