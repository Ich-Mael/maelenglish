import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { CalendarClock, GraduationCap, MessagesSquare, Plus, Users } from "lucide-react";
import { Types } from "mongoose";
import { requireStaff } from "@/lib/admin/context";
import { CoachingEntry, CoachingSession, CoachingSubmission, User } from "@/models";
import { isManager, listCoachings } from "@/lib/coaching/service";
import { coachingDates } from "@/lib/coaching/queries";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import { PageSkeleton } from "@/components/learn/ui";
import { cn } from "cn";

/** A moment in the past (sessions still joinable 90 min after their start). */
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

export const metadata: Metadata = { title: "Coaching" };

/* MaelEnglish Coaching — the coach's list (admins and account managers: every coaching, by coach). */

async function List({ searchParams }: { searchParams: Promise<{ coach?: string; status?: string }> }) {
  await connection();
  const me = await requireStaff("/admin/coaching");
  const sp = await searchParams;
  const v = { id: me.id, role: me.role };
  const manager = isManager(v);
  const status = ["active", "paused", "completed"].includes(sp.status ?? "") ? sp.status! : "active";
  const list = await listCoachings(v, { coachId: sp.coach, status });
  const ids = list.map((c) => c._id);
  const [people, unread, waiting, next] = await Promise.all([
    User.find({ _id: { $in: [...new Set(list.flatMap((c) => [...(c.memberIds ?? []), c.coachId]).map(String))] } }).select("name surname avatarUrl").lean(),
    CoachingEntry.aggregate<{ _id: Types.ObjectId; n: number }>([{ $match: { coachingId: { $in: ids }, readBy: { $ne: new Types.ObjectId(me.id) } } }, { $group: { _id: "$coachingId", n: { $sum: 1 } } }]),
    CoachingSubmission.aggregate<{ _id: Types.ObjectId; n: number }>([{ $match: { coachingId: { $in: ids }, status: "pending" } }, { $group: { _id: "$coachingId", n: { $sum: 1 } } }]),
    CoachingSession.aggregate<{ _id: Types.ObjectId; at: Date }>([{ $match: { coachingId: { $in: ids }, status: "scheduled", startsAt: { $gte: minutesAgo(90) } } }, { $group: { _id: "$coachingId", at: { $min: "$startsAt" } } }]),
  ]);
  const coaches = manager ? await User.find({ role: { $in: ["english-coach", "instructor", "admin", "super-admin"] }, isActive: { $ne: false } }).select("name surname").sort({ name: 1 }).lean() : [];
  const name = (id: unknown) => {
    const u = people.find((p) => String(p._id) === String(id));
    return u ? `${u.name} ${u.surname ?? ""}`.trim() : "—";
  };
  const of = <T extends { _id: Types.ObjectId }>(rows: T[], id: Types.ObjectId) => rows.find((r) => String(r._id) === String(id));
  const tab = (s: string) => `/admin/coaching?status=${s}${sp.coach ? `&coach=${sp.coach}` : ""}`;

  return (
    <div className="grid max-w-5xl gap-5">
      <PageHeader
        title="Coaching"
        subtitle="One-on-one and group coachings: goals, feedback, resources, tasks on existing content and live sessions with screen sharing."
        actions={
          manager ? (
            <Link href="/admin/coaching/nouveau" className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:brightness-110">
              <Plus className="size-4" aria-hidden /> New coaching
            </Link>
          ) : null
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        {(["active", "paused", "completed"] as const).map((s) => (
          <Link key={s} href={tab(s)} className={cn("rounded-full px-3 py-1.5 text-sm font-semibold", status === s ? "bg-brand-deep text-white" : "bg-muted text-brand-deep hover:bg-brand-soft")}>
            {s === "active" ? "Active" : s === "paused" ? "Paused" : "Completed"}
          </Link>
        ))}
        {manager && coaches.length > 0 && (
          <form className="ml-auto flex items-center gap-2 text-sm">
            <input type="hidden" name="status" value={status} />
            <label htmlFor="coach" className="font-semibold text-muted-foreground">
              Coach
            </label>
            <select id="coach" name="coach" defaultValue={sp.coach ?? ""} className="h-9 rounded-xl border border-input bg-background px-2">
              <option value="">All</option>
              {coaches.map((c) => (
                <option key={String(c._id)} value={String(c._id)}>
                  {c.name} {c.surname}
                </option>
              ))}
            </select>
            <button className="h-9 rounded-xl border border-border px-3 font-semibold">Filter</button>
          </form>
        )}
      </div>
      {list.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((c) => {
            const u = of(unread, c._id)?.n ?? 0;
            const w = of(waiting, c._id)?.n ?? 0;
            const n = of(next, c._id)?.at;
            return (
              <li key={String(c._id)}>
                <Link href={`/admin/coaching/${c._id}`} className="group grid h-full gap-3 rounded-3xl border-2 border-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/40 motion-reduce:transition-none">
                  <div className="flex items-start gap-3">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-deep to-primary text-white">{c.kind === "group" ? <Users className="size-6" aria-hidden /> : <GraduationCap className="size-6" aria-hidden />}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold tracking-wide text-coral-dark uppercase">{c.kind === "group" ? `Group · ${(c.memberIds ?? []).length} people` : "One-on-one"}</p>
                      <p className="font-extrabold break-words text-brand-deep group-hover:text-primary">{c.title}</p>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">{(c.memberIds ?? []).map(name).join(", ")}</p>
                      {manager && <p className="text-xs text-muted-foreground">Coach: {name(c.coachId)}</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    {n && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-primary">
                        <CalendarClock className="size-3.5" aria-hidden /> {coachingDates.when(n)}
                      </span>
                    )}
                    {u > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-coral bg-white px-2.5 py-1 text-coral-dark">
                        <MessagesSquare className="size-3.5" aria-hidden /> {u} unread
                      </span>
                    )}
                    {w > 0 && <span className="rounded-full border border-coral bg-coral-soft px-2.5 py-1 text-coral-dark">{w} challenge{w > 1 ? "s" : ""} to review</span>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState>{manager ? "No coaching here yet. Open one with « New coaching »." : "No coaching assigned to you yet."}</EmptyState>
      )}
    </div>
  );
}

export default function Page({ searchParams }: { searchParams: Promise<{ coach?: string; status?: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <List searchParams={searchParams} />
    </Suspense>
  );
}
