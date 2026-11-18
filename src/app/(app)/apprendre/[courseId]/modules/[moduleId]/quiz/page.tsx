import type { Metadata } from "next";
import { Suspense } from "react";
import { QuizStep } from "@/components/learn/step-pages";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Quiz", robots: { index: false } };

async function Step({ params }: { params: Promise<{ courseId: string; moduleId: string }> }) {
  const { courseId, moduleId } = await params;
  return <QuizStep courseId={courseId} moduleId={moduleId} />;
}

export default function Page({ params }: PageProps<"/apprendre/[courseId]/modules/[moduleId]/quiz">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Step params={params} />
    </Suspense>
  );
}
