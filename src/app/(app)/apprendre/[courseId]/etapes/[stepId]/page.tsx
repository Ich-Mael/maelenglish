import type { Metadata } from "next";
import { Suspense } from "react";
import { StepPage } from "@/components/learn/step-pages";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Activity", robots: { index: false } };

async function Step({ params }: { params: Promise<{ courseId: string; stepId: string }> }) {
  const { courseId, stepId } = await params;
  return <StepPage courseId={courseId} stepId={stepId} />;
}

export default function Page({ params }: PageProps<"/apprendre/[courseId]/etapes/[stepId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Step params={params} />
    </Suspense>
  );
}
