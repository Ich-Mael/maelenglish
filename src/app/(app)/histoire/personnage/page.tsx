import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { getProfile } from "@/lib/story/service";
import type { AvatarConfig } from "@/lib/story/schema";
import { StoryOnboarding } from "@/components/story/onboarding";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "My character", robots: { index: false } };

async function Edit() {
  await connection();
  const me = await requireUser("/histoire/personnage");
  await connectDB();
  const p = await getProfile(me.id);
  if (!p) redirect("/histoire");
  return (
    <div className="mx-auto grid max-w-5xl gap-4">
      <Link href="/histoire" className="inline-flex items-center gap-1 justify-self-start text-sm font-semibold text-primary hover:underline">
        <ArrowLeft className="size-4" /> Back to the story
      </Link>
      <StoryOnboarding defaultName={p.characterName} defaultJob={p.job} cityName="" initial={{ characterName: p.characterName, job: p.job, country: p.country, avatar: p.avatar as AvatarConfig | null, pacePerWeek: p.pacePerWeek }} />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Edit />
    </Suspense>
  );
}
