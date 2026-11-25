import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { requireStaff } from "@/lib/admin/context";
import { CoachingError, openCoaching } from "@/lib/coaching/service";
import { CoachingSpace } from "@/components/coaching/space";
import { PageHeader } from "@/components/admin/ui";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Coaching" };

type P = { params: Promise<{ coachingId: string }>; searchParams: Promise<{ tab?: string; member?: string; thread?: string; period?: string }> };

async function Space({ params, searchParams }: P) {
  await connection();
  const { coachingId } = await params;
  const me = await requireStaff(`/admin/coaching/${coachingId}`);
  const sp = await searchParams;
  try {
    await openCoaching({ id: me.id, role: me.role }, coachingId);
  } catch (e) {
    if (e instanceof CoachingError) notFound();
    throw e;
  }
  {
    return (
      <div className="grid max-w-6xl gap-4">
        <PageHeader title="Coaching" back={{ href: "/admin/coaching", label: "All coachings" }} />
        <CoachingSpace viewer={{ id: me.id, role: me.role }} coachingId={coachingId} base={`/admin/coaching/${coachingId}`} tab={sp.tab ?? ""} member={sp.member} thread={sp.thread} period={sp.period} reportHref={`/admin/coaching/${coachingId}/rapport`} />
      </div>
    );
  }
}

export default function Page(props: P) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Space {...props} />
    </Suspense>
  );
}
