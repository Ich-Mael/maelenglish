import type { Metadata } from "next";
import { Suspense } from "react";
import { AssignmentStep } from "@/components/learn/step-pages";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Projet final", robots: { index: false } };

async function Step({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return <AssignmentStep courseId={courseId} moduleId={null} />;
}

export default function Page({ params }: PageProps<"/apprendre/[courseId]/projet">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Step params={params} />
    </Suspense>
  );
}
