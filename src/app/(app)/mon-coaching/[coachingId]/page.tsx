import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { CoachingError, openCoaching } from "@/lib/coaching/service";
import { CoachingSpace } from "@/components/coaching/space";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "My Coaching", robots: { index: false } };

type P = { params: Promise<{ coachingId: string }>; searchParams: Promise<{ tab?: string; thread?: string; period?: string }> };

async function Space({ params, searchParams }: P) {
  await connection();
  const { coachingId } = await params;
  const me = await requireUser(`/mon-coaching/${coachingId}`);
  await connectDB();
  const sp = await searchParams;
  try {
    await openCoaching({ id: me.id, role: me.role }, coachingId);
  } catch (e) {
    if (e instanceof CoachingError) notFound();
    throw e;
  }
  {
    return (
      <div className="mx-auto max-w-6xl">
        <CoachingSpace viewer={{ id: me.id, role: me.role }} coachingId={coachingId} base={`/mon-coaching/${coachingId}`} tab={sp.tab ?? ""} thread={sp.thread} period={sp.period} />
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
