import type { Metadata } from "next";
import { Suspense } from "react";
import { ExamStep } from "@/components/learn/step-pages";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Examen final", robots: { index: false } };

async function Step({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return <ExamStep courseId={courseId} />;
}

export default function Page({ params }: PageProps<"/apprendre/[courseId]/examen">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Step params={params} />
    </Suspense>
  );
}
