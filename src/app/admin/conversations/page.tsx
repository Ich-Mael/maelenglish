import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { requireStaff } from "@/lib/admin/context";
import { listConversations } from "@/lib/admin/conversations";
import { Card, EmptyState, PageHeader, fmtDate } from "@/components/admin/ui";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "AI conversations" };

async function Conversations() {
  const me = await requireStaff("/admin/conversations");
  await connection();
  const rows = await listConversations(me);
  return (
    <div className="grid max-w-5xl gap-5">
      <PageHeader title="AI conversations" subtitle={me.isAdmin ? "Learners' AI role-plays (Talk with Coach Ish and unit activities), latest first." : "Role-plays of the learners you coach, latest first."} />
      <Card>
        {rows.length === 0 ? (
          <EmptyState>No conversation yet.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Learner</th>
                  <th className="py-2 pr-4 font-semibold">Scenario</th>
                  <th className="py-2 pr-4 font-semibold">Date</th>
                  <th className="py-2 pr-4 font-semibold">Length</th>
                  <th className="py-2 pr-4 font-semibold">Level</th>
                  <th className="py-2 font-semibold">Score</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={String(r._id)} className="border-t border-border">
                    <td className="py-2 pr-4">
                      <span className="font-semibold text-brand-deep">{r.learner}</span> <span className="text-muted-foreground">{r.username}</span>
                    </td>
                    <td className="py-2 pr-4">
                      <Link href={`/admin/conversations/${r._id}`} className="font-semibold text-primary hover:underline">
                        {r.title}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                    <td className="py-2 pr-4 tabular-nums">{Math.max(1, Math.round((r.durationS ?? 0) / 60))} min</td>
                    <td className="py-2 pr-4 tabular-nums">{r.difficulty}</td>
                    <td className="py-2 tabular-nums">{r.score ?? (r.status === "debriefed" ? "—" : "no debrief")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Conversations />
    </Suspense>
  );
}
