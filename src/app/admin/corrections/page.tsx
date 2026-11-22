import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { AlertTriangle, Clock, PenLine } from "lucide-react";
import { actorOf, requireStaff, visibleCourseIds } from "@/lib/admin/context";
import { can } from "@/lib/admin/permissions";
import { gradingQueue } from "@/lib/admin/grading";
import { pendingWritingCount } from "@/lib/admin/writing-review";
import { GRADING_DUE_HOURS, coachOptions } from "@/lib/admin/coaching";
import { User } from "@/models";
import { EmptyState, PageHeader, Pill, fmtDate, inputCls } from "@/components/admin/ui";
import { PageSkeleton } from "@/components/learn/ui";
import { cn } from "cn";

export const metadata: Metadata = { title: "Grading" };

const TABS = [
  { value: "pending", label: "To grade" },
  { value: "returned", label: "Returned" },
  { value: "graded", label: "Validated" },
];

/** « 5 h », « 3 days ». */
const waited = (h: number) => (h >= 48 ? `${Math.floor(h / 24)} days` : `${Math.max(1, Math.round(h))} h`);

async function Queue({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const me = await requireStaff("/admin/corrections");
  if (me.role === "account-manager") redirect("/admin");
  const a = actorOf(me);
  const admin = can.overseeCoaches(a);
  const sp = await searchParams;
  const status = typeof sp.statut === "string" ? sp.statut : "pending";
  const coachParam = typeof sp.coach === "string" ? sp.coach : "";
  const coachId = coachParam === "me" ? me.id : admin ? coachParam : "";
  const lateOnly = sp.late === "1";

  // Coaches see their courses plus the learners they coach (even in other courses).
  const courseIds = await visibleCourseIds(me);
  const myLearnerIds = courseIds ? (await User.find({ coachId: me.id }).select("_id").lean()).map((u) => u._id) : [];
  const [items, coaches, writing] = await Promise.all([gradingQueue({ courseIds, myLearnerIds, status, coachId: coachId || null, lateOnly: lateOnly && status === "pending" }), admin ? coachOptions() : Promise.resolve([]), pendingWritingCount(courseIds, myLearnerIds)]);

  const href = (p: Record<string, string>) => {
    const q = new URLSearchParams({ statut: status, ...(coachParam ? { coach: coachParam } : {}), ...(lateOnly ? { late: "1" } : {}), ...p });
    for (const [k, v] of [...q.entries()]) if (!v) q.delete(k);
    return `?${q}`;
  };

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Grading"
        subtitle={`Speaking challenges to review. Target: within ${GRADING_DUE_HOURS} hours of being sent — older ones are flagged as late.`}
        actions={
          <Link href="/admin/corrections/ecrits" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-brand-deep hover:bg-brand-soft">
            <PenLine className="size-4 text-primary" aria-hidden /> Writing review
            {writing > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-white">{writing}</span>}
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-1" aria-label="Status">
          {TABS.map((t) => (
            <Link key={t.value} href={href({ statut: t.value })} aria-current={status === t.value ? "page" : undefined} className={cn("rounded-xl px-3 py-2 text-sm font-semibold", status === t.value ? "bg-primary text-white" : "text-ink/80 hover:bg-brand-soft")}>
              {t.label}
            </Link>
          ))}
        </nav>
        <form className="flex flex-wrap items-center gap-2 text-sm">
          <input type="hidden" name="statut" value={status} />
          <select name="coach" defaultValue={coachParam} aria-label="Coach" className={cn(inputCls, "w-auto")}>
            <option value="">{admin ? "All coaches" : "All my courses"}</option>
            <option value="me">My learners</option>
            {coaches.map((c) => (
              <option key={String(c._id)} value={String(c._id)}>
                {c.name} {c.surname}
              </option>
            ))}
          </select>
          {status === "pending" && (
            <label className="flex items-center gap-1.5 font-medium">
              <input type="checkbox" name="late" value="1" defaultChecked={lateOnly} className="size-4 accent-primary" /> Late only
            </label>
          )}
          <button type="submit" className="h-10 rounded-xl bg-primary px-4 font-semibold text-white">
            Filter
          </button>
        </form>
      </div>
      {items.length === 0 ? (
        <EmptyState>{status === "pending" ? "Nothing to grade. Well done!" : "Nothing here."}</EmptyState>
      ) : (
        <ul className="grid gap-2">
          {items.map((s) => (
            <li key={String(s._id)}>
              <Link href={`/admin/corrections/${s._id}`} className={cn("flex flex-wrap items-center gap-3 rounded-2xl border bg-card px-4 py-3 hover:shadow-md", s.late ? "border-coral/60" : "border-border")}>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-brand-deep">{s.user ? `${s.user.name} ${s.user.surname}` : "Learner"}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {s.course?.title} · {s.module?.title ?? "Module"}
                    {s.unit && ` · ${s.unit.title}`}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {status === "pending" ? `Coach: ${s.responsible.map((c) => c.name).filter(Boolean).join(", ") || "none (no course team)"}` : `Reviewed by ${s.reviewer || "—"}${s.gradedAt ? ` · ${fmtDate(s.gradedAt)}` : ""}`}
                  </span>
                </span>
                {s.course?.isChallenge ? <Pill tone="red">Day checkpoint</Pill> : <Pill tone="green">Speaking challenge</Pill>}
                {s.status === "pending" && s.validatedAt && <Pill tone="blue">Redo · already validated</Pill>}
                {status === "pending" ? (
                  <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", s.late ? "text-coral-dark" : "text-muted-foreground")}>
                    {s.late ? <AlertTriangle className="size-3.5" aria-hidden /> : <Clock className="size-3.5" aria-hidden />}
                    {s.late ? "Late · " : ""}waiting {waited(s.hoursWaiting)}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">sent {fmtDate(s.sentAt)}</span>
                )}
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
