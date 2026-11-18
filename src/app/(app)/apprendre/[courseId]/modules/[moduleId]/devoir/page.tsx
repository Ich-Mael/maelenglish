import type { Metadata } from "next";
import { Suspense } from "react";
import { AssignmentStep } from "@/components/learn/step-pages";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Devoir", robots: { index: false } };

async function Step({ params }: { params: Promise<{ courseId: string; moduleId: string }> }) {
  const { courseId, moduleId } = await params;
  return <AssignmentStep courseId={courseId} moduleId={moduleId} />;
}

export default function Page({ params }: PageProps<"/apprendre/[courseId]/modules/[moduleId]/devoir">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Step params={params} />
    </Suspense>
  );
}
