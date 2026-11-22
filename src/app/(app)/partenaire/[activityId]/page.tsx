import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Types } from "mongoose";
import { requireUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { Activity, type ActivityDoc } from "@/models";
import { canUsePartner, partnerState, publicBrief } from "@/lib/conversation/queries";
import type { RolePlayContent } from "@/lib/lab/types";
import { RolePlayPlayer } from "@/components/conversation/role-play-player";
import { RichText } from "@/components/learn/rich-text";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Speaking Partner", robots: { index: false } };

async function Scenario({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;
  await connection();
  const me = await requireUser(`/partenaire/${activityId}`);
  await connectDB();
  if (!Types.ObjectId.isValid(activityId)) notFound();
  const a = await Activity.findById(activityId).lean<ActivityDoc>();
  if (!a || a.type !== "role_play" || (a.status !== "ready" && !me.isStaff) || !(await canUsePartner(me))) notFound();
  const c = a.content as RolePlayContent;
  const state = await partnerState(me);
  return (
    <div className="mx-auto max-w-5xl">
      <RolePlayPlayer
        activityId={activityId}
        title={a.title}
        level={a.level ?? ""}
        situation={c.situation ? <RichText lang="fr">{c.situation}</RichText> : null}
        brief={publicBrief(c)}
        available={state.available}
        minutesLeft={state.minutesLeft}
        courseHref="/partenaire"
      />
    </div>
  );
}

export default function Page({ params }: { params: Promise<{ activityId: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Scenario params={params} />
    </Suspense>
  );
}
