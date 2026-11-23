import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Types } from "mongoose";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { ConversationSession } from "@/models";
import type { Debrief } from "@/lib/ai/types";
import { isRecentCall, toFinished } from "@/lib/conversation/view";
import { DebriefView, TranscriptOnly } from "@/components/conversation/debrief-view";
import { PageSkeleton } from "@/components/learn/ui";
import { stepPath } from "@/lib/learn/paths";
import { mediaUrlFor } from "@/lib/media";
import { CallRecording } from "@/components/conversation/call-recording";

export const metadata: Metadata = { title: "Conversation debrief", robots: { index: false } };

async function Session({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  await connection();
  const me = await requireUser(`/partenaire/seances/${sessionId}`);
  await connectDB();
  if (!Types.ObjectId.isValid(sessionId)) notFound();
  const s = await ConversationSession.findOne({ _id: sessionId, userId: me.id }).lean();
  if (!s) notFound();
  const f = toFinished(s);
  const audioUrl = s.audioMediaId ? await mediaUrlFor({ id: me.id, isAdmin: me.isAdmin }, String(s.audioMediaId)).catch(() => null) : null;
  const recent = isRecentCall(s.createdAt);
  const again = s.courseId && s.stepId ? stepPath(String(s.courseId), String(s.stepId)) : `/partenaire/${s.activityId}`;
  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <Link href="/partenaire" className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Talk with Coach Ish
      </Link>
      <div>
        <p className="text-xs font-bold tracking-wide text-primary uppercase">
          {new Date(s.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · level {s.difficulty} · {Math.max(1, Math.round(f.durationS / 60))} min
        </p>
        <h1 className="text-2xl font-extrabold text-brand-deep sm:text-3xl">{s.title}</h1>
      </div>
      {f.debrief ? (
        <DebriefView debrief={f.debrief as Debrief} transcript={f.transcript} score={f.score} audioUrl={audioUrl} audioPending={!audioUrl && !s.audioMediaId && recent} />
      ) : (
        <div className="grid gap-3 rounded-3xl border border-border bg-card p-4">
          <p className="font-semibold text-brand-deep">{f.note || "No debrief for this conversation."}</p>
          <CallRecording url={audioUrl} pending={!audioUrl && !s.audioMediaId && recent} />
          <TranscriptOnly transcript={f.transcript} />
        </div>
      )}
      <Link href={again} className="inline-flex h-12 w-fit items-center gap-2 rounded-2xl bg-primary px-5 font-bold text-white shadow-[0_4px_0_0_var(--color-brand-dark)] hover:brightness-110">
        <RotateCcw className="size-4" aria-hidden /> Talk again
      </Link>
    </div>
  );
}

export default function Page({ params }: { params: Promise<{ sessionId: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Session params={params} />
    </Suspense>
  );
}
