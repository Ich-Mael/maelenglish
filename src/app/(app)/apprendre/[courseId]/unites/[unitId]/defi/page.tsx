import type { Metadata } from "next";
import { Suspense } from "react";
import { ChallengeStep } from "@/components/learn/step-pages";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Défi oral", robots: { index: false } };

async function Step({ params }: { params: Promise<{ courseId: string; unitId: string }> }) {
  const { courseId, unitId } = await params;
  return <ChallengeStep courseId={courseId} unitId={unitId} />;
}

export default function Page({ params }: PageProps<"/apprendre/[courseId]/unites/[unitId]/defi">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Step params={params} />
    </Suspense>
  );
}
