import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { badgesFor, statsFor, xpByDay } from "@/lib/gamification/service";
import { ProgressView } from "@/components/gamify/progress-view";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "My Progress", robots: { index: false } };

async function Progress() {
  await connection();
  const me = await requireUser("/progression");
  await connectDB();
  const [s, groups, week] = await Promise.all([statsFor(me.id), badgesFor(me.id), xpByDay(me.id, 7)]);
  return <ProgressView s={s} groups={groups} week={week} />;
}

export default function ProgressionPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Progress />
    </Suspense>
  );
}
