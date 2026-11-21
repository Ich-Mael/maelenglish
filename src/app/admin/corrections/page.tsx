import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { requireStaff, visibleCourseIds } from "@/lib/admin/context";
import { gradingQueue } from "@/lib/admin/grading";
import { EmptyState, PageHeader, Pill, fmtDate } from "@/components/admin/ui";
import { PageSkeleton } from "@/components/learn/ui";
import { cn } from "cn";

export const metadata: Metadata = { title: "Grading" };

const TABS = [
  { value: "pending", label: "To grade" },
  { value: "returned", label: "Returned" },
  { value: "graded", label: "Validated" },
];

async function Queue({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const me = await requireStaff("/admin/corrections");
  if (me.role === "account-manager") redirect("/admin");
  const sp = await searchParams;
  const status = typeof sp.statut === "string" ? sp.statut : "pending";
  const items = await gradingQueue({ courseIds: await visibleCourseIds(me), status });

  return (
    <div className="max-w-4xl">
      <PageHeader title="Grading" subtitle="Speaking challenges, assignments, checkpoints and final projects from your courses." />
      <nav className="mb-4 flex gap-1" aria-label="Filter">
        {TABS.map((t) => (
          <Link key={t.value} href={`?statut=${t.value}`} aria-current={status === t.value ? "page" : undefined} className={cn("rounded-xl px-3 py-2 text-sm font-semibold", status === t.value ? "bg-primary text-white" : "text-ink/80 hover:bg-brand-soft")}>
            {t.label}
          </Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <EmptyState>{status === "pending" ? "Nothing to grade. Well done!" : "Nothing here."}</EmptyState>
      ) : (
        <ul className="grid gap-2">
          {items.map((s) => (
            <li key={String(s._id)}>
              <Link href={`/admin/corrections/${s._id}`} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 hover:shadow-md">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-brand-deep">
                    {s.user ? `${s.user.name} ${s.user.surname}` : "Learner"}
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {s.course?.title} · {s.module?.title ?? "Module"}
                    {s.unit && ` · ${s.unit.title}`}
                  </span>
                </span>
                {s.course?.isChallenge ? <Pill tone="red">Day checkpoint</Pill> : <Pill tone="green">Speaking challenge</Pill>}
                <span className="text-xs text-muted-foreground">{fmtDate(s.updatedAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Page({ searchParams }: PageProps<"/admin/corrections">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Queue searchParams={searchParams} />
    </Suspense>
  );
}
