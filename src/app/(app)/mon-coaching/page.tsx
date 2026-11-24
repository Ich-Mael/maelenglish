import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ArrowRight, GraduationCap, Users } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { listCoachings } from "@/lib/coaching/service";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "My Coaching", robots: { index: false } };

async function List() {
  await connection();
  const me = await requireUser("/mon-coaching");
  await connectDB();
  const list = await listCoachings({ id: me.id, role: me.role }, { memberOnly: true });
  if (list.length === 1) redirect(`/mon-coaching/${list[0]._id}`);
  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <h1 className="text-3xl font-extrabold text-brand-deep">My Coaching</h1>
      {list.length ? (
        <ul className="grid gap-3">
          {list.map((c) => (
            <li key={String(c._id)}>
              <Link href={`/mon-coaching/${c._id}`} className="group flex items-center gap-4 rounded-3xl border-2 border-border bg-card p-5 hover:border-primary/40">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-deep to-primary text-white">{c.kind === "group" ? <Users className="size-6" aria-hidden /> : <GraduationCap className="size-6" aria-hidden />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-extrabold text-brand-deep group-hover:text-primary">{c.title}</span>
                  <span className="text-sm text-muted-foreground">{c.status === "completed" ? "Completed" : c.status === "paused" ? "Paused" : c.kind === "group" ? "Group coaching" : "One-on-one coaching"}</span>
                </span>
                <ArrowRight className="size-5 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-3xl border-2 border-dashed border-border p-8 text-center">
          <p className="text-lg font-semibold text-brand-deep">You don&apos;t have a coaching yet.</p>
          <p className="mt-1 text-muted-foreground">MaelEnglish Coaching is our premium one-on-one (or team) programme for one specific goal.</p>
          <Link href="/coaching" className="mt-4 inline-flex h-11 items-center rounded-2xl border-2 border-coral bg-white px-5 font-bold text-coral-dark hover:bg-coral-soft">
            Discover MaelEnglish Coaching
          </Link>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <List />
    </Suspense>
  );
}
