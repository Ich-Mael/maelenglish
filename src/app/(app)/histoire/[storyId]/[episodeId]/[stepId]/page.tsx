import type { Metadata } from "next";
import { Suspense } from "react";
import { StoryStepPage } from "@/components/story/story-step-page";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Story Mode", robots: { index: false } };

async function Step({ params }: { params: Promise<{ storyId: string; episodeId: string; stepId: string }> }) {
  const { storyId, episodeId, stepId } = await params;
  return <StoryStepPage storyId={storyId} episodeId={episodeId} stepId={stepId} />;
}

export default function Page({ params }: { params: Promise<{ storyId: string; episodeId: string; stepId: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Step params={params} />
    </Suspense>
  );
}
