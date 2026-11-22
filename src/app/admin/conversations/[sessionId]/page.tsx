import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { requireStaff } from "@/lib/admin/context";
import { conversationFor } from "@/lib/admin/conversations";
import { toFinished } from "@/lib/conversation/view";
import { DebriefView, TranscriptOnly } from "@/components/conversation/debrief-view";
import { PageHeader, fmtDate } from "@/components/admin/ui";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "AI conversation" };

async function Conversation({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const me = await requireStaff(`/admin/conversations/${sessionId}`);
  await connection();
  const found = await conversationFor(me, sessionId);
  if (!found) notFound();
  const s = found.session;
  const f = toFinished(s);
  return (
    <div className="grid max-w-3xl gap-5">
      <PageHeader
        title={s.title}
        back={{ href: "/admin/conversations", label: "AI conversations" }}
        subtitle={`${found.learner} (${found.username}) · ${fmtDate(s.createdAt)} · difficulty ${s.difficulty} · ${Math.max(1, Math.round(f.durationS / 60))} min · help used ${s.helpCount ?? 0}×`}
      />
      {f.debrief ? (
        <DebriefView debrief={f.debrief} transcript={f.transcript} score={f.score} learnerName={found.learner.split(" ")[0] || "Learner"} />
      ) : (
        <div className="grid gap-3 rounded-3xl border border-border bg-card p-4">
          <p className="font-semibold text-brand-deep">{f.note || "No debrief."}</p>
          {s.debriefError && <p className="rounded-xl bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">Last error: {s.debriefError}</p>}
          <TranscriptOnly transcript={f.transcript} />
        </div>
      )}
    </div>
  );
}

export default function Page({ params }: { params: Promise<{ sessionId: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Conversation params={params} />
    </Suspense>
  );
}
