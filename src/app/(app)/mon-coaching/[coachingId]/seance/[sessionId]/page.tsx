import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { CoachingError, openSession, sessionWindow } from "@/lib/coaching/service";
import { coachingDates } from "@/lib/coaching/queries";
import { coachingPath } from "@/lib/coaching/paths";
import { LiveRoom } from "@/components/coaching/live-room";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Coaching session", robots: { index: false } };

type P = { params: Promise<{ coachingId: string; sessionId: string }> };

async function Room({ params }: P) {
  await connection();
  const { coachingId, sessionId } = await params;
  const me = await requireUser(`/mon-coaching/${coachingId}/seance/${sessionId}`);
  await connectDB();
  let r;
  try {
    r = await openSession({ id: me.id, role: me.role }, sessionId);
  } catch (e) {
    if (e instanceof CoachingError) notFound();
    throw e;
  }
  if (String(r.coaching._id) !== coachingId) notFound();
  const coach = r.role === "coach";
  const back = coach ? `/admin/coaching/${coachingId}?tab=sessions` : coachingPath(coachingId, "sessions");
  const w = sessionWindow(r.session);
  return (
    <div className="mx-auto grid max-w-6xl gap-4">
      <Link href={back} className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-primary">
        <ChevronLeft className="size-4" aria-hidden /> {r.coaching.title}
      </Link>
      <div>
        <p className="text-xs font-bold tracking-wide text-coral-dark uppercase">Live session · {r.session.durationMin} min</p>
        <h1 className="text-2xl font-extrabold text-brand-deep">{r.session.title || coachingDates.when(r.session.startsAt)}</h1>
        {r.session.title && <p className="text-muted-foreground">{coachingDates.when(r.session.startsAt)}</p>}
      </div>
      {r.session.status === "cancelled" ? <p className="rounded-2xl bg-muted p-6 text-center font-semibold text-brand-deep">This session was cancelled.</p> : <LiveRoom sessionId={sessionId} opensAt={w.opens.toISOString()} closesAt={w.closes.toISOString()} backHref={back} coach={coach} />}
    </div>
  );
}

export default function Page(props: P) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Room {...props} />
    </Suspense>
  );
}
