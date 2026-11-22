import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { PenLine } from "lucide-react";
import { actorOf, requireStaff, visibleCourseIds } from "@/lib/admin/context";
import { User } from "@/models";
import { writingQueue } from "@/lib/admin/writing-review";
import { EmptyState, PageHeader, Pill, fmtDate } from "@/components/admin/ui";
import { PageSkeleton } from "@/components/learn/ui";
import { cn } from "cn";

export const metadata: Metadata = { title: "Writing review" };

const TABS = [
  { value: "pending", label: "To review" },
  { value: "reviewed", label: "Reviewed" },
];

async function Queue({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const me = await requireStaff("/admin/corrections/ecrits");
  if (me.role === "account-manager") redirect("/admin");
  void actorOf(me);
  const sp = await searchParams;
  const status = sp.statut === "reviewed" ? "reviewed" : "pending";
  const mine = sp.coach === "me";
  const courseIds = await visibleCourseIds(me);
  const myLearnerIds = courseIds ? (await User.find({ coachId: me.id }).select("_id").lean()).map((u) => u._id) : [];
  const items = await writingQueue({ courseIds, myLearnerIds, status, coachId: mine ? me.id : null });
  const href = (p: Record<string, string>) => `?${new URLSearchParams({ statut: status, ...(mine ? { coach: "me" } : {}), ...p })}`;

  return (
    <div className="max-w-4xl">
      <PageHeader title="Writing review" back={{ href: "/admin/corrections", label: "Grading" }} subtitle="Learners' writing, each version with an AI correction draft ready for you: check it, edit it, add your comment and send it." />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-1" aria-label="Status">
          {TABS.map((t) => (
            <Link key={t.value} href={href({ statut: t.value })} aria-current={status === t.value ? "page" : undefined} className={cn("rounded-xl px-3 py-2 text-sm font-semibold", status === t.value ? "bg-primary text-white" : "text-ink/80 hover:bg-brand-soft")}>
              {t.label}
            </Link>
          ))}
        </nav>
        <Link href={mine ? `?statut=${status}` : href({ coach: "me" })} className={cn("rounded-xl px-3 py-2 text-sm font-semibold", mine ? "bg-brand-soft text-primary" : "text-ink/80 hover:bg-brand-soft")}>
          {mine ? "✓ My learners" : "My learners only"}
        </Link>
      </div>
      {items.length === 0 ? (
        <EmptyState>
          <PenLine className="mx-auto mb-2 size-8 text-muted-foreground" aria-hidden />
          {status === "pending" ? "No writing to review." : "Nothing reviewed yet."}
        </EmptyState>
      ) : (
        <ul className="grid gap-2">
          {items.map((s) => (
            <li key={String(s._id)}>
              <Link href={`/admin/corrections/ecrits/${s._id}`} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border px-3 py-2.5 hover:border-primary/40 hover:bg-brand-soft/40">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-primary">
                  <PenLine className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-brand-deep">
                    {s.user ? `${s.user.name} ${s.user.surname}` : "Learner"} · {s.activity?.title ?? "Writing task"}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {s.course?.title ?? "Course"}
                    {s.unit && ` › ${s.unit.title}`} · {s.wordCount} words · version {s.attempts || s.tries} · sent {s.submittedAt ? fmtDate(s.submittedAt) : "—"}
                  </span>
                </span>
                <Pill tone="blue">AI draft {s.aiScore}/100</Pill>
                {s.coachStatus === "reviewed" && <Pill tone="grey">Reviewed{s.coachScore !== null && s.coachScore !== undefined ? ` · ${s.coachScore}/100` : ""}</Pill>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Page({ searchParams }: PageProps<"/admin/corrections/ecrits">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Queue searchParams={searchParams} />
    </Suspense>
  );
}
