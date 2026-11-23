import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { actorOf, requireStaff } from "@/lib/admin/context";
import { can } from "@/lib/admin/permissions";
import { adminSeason, adminSeasonList } from "@/lib/story/admin";
import { episodeOf, playable } from "@/lib/story/content";
import { episodeProblems } from "@/lib/story/checks";
import { seasonEstimate } from "@/lib/story/minutes";
import { conversationEngine } from "@/lib/ai";
import { reviewMediaUrl } from "@/lib/media";
import type { Scene } from "@/lib/story/schema";
import { PageHeader } from "@/components/admin/ui";
import { SeasonEditor } from "@/components/admin/story/season-editor";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Story season" };

async function Season({ params }: { params: Promise<{ seasonId: string }> }) {
  const { seasonId } = await params;
  await connection();
  const me = await requireStaff(`/admin/story/${seasonId}`);
  const a = actorOf(me);
  if (!can.editStory(a)) redirect("/admin");
  const data = await adminSeason(seasonId);
  if (!data) notFound();
  const { doc, season } = data;
  const [estimate, voices, others, coverUrl] = await Promise.all([
    seasonEstimate(season),
    (conversationEngine()?.listVoices() ?? Promise.resolve([])).catch(() => []),
    adminSeasonList(),
    doc.coverMediaId ? reviewMediaUrl(String(doc.coverMediaId)).catch(() => null) : null,
  ]);
  const episodes = data.episodes.map((e) => {
    const ep = episodeOf(e);
    return { id: String(e._id), slug: e.slug, title: ep?.title ?? e.slug, chapterId: e.chapterId, status: playable(e) ? ("ready" as const) : ("draft" as const), problems: ep ? episodeProblems(season, ep, e.chapterId).length : 1 };
  });
  return (
    <div className="grid max-w-5xl gap-5">
      <PageHeader title={season.title} back={{ href: "/admin/story", label: "Story Mode" }} subtitle={<span lang="fr">{season.promise_fr || "No learning goal yet"} · {[season.city.name, season.city.country].filter(Boolean).join(", ")}</span>} />
      <SeasonEditor
        seasonId={seasonId}
        slug={season.id}
        status={season.status}
        canManage={can.manageStory(a)}
        info={{ title: doc.title, learningGoal: doc.learningGoal ?? "", level: doc.level ?? "", description: doc.description ?? "", coverMediaId: doc.coverMediaId ? String(doc.coverMediaId) : null, lengthWeeks: doc.lengthWeeks ?? 8, city: doc.city ?? "", country: doc.country ?? "", nextSeasonHookFr: doc.nextSeasonHookFr ?? "", recapScene: season.recap_scene as Scene, order: doc.order ?? 0 }}
        coverUrl={coverUrl}
        characters={season.characters}
        locations={season.locations}
        chapters={season.chapterList.map((c) => ({ id: c.id, order: c.order, title: c.title, summary_fr: c.summary_fr }))}
        sale={{ freeEpisodes: doc.freeEpisodes ?? 0, aiMinutesIncluded: doc.aiMinutesIncluded ?? 0, priceFcfa: doc.priceFcfa ?? null, marginPct: doc.marginPct ?? null }}
        estimate={{ costPerMin: estimate.costPerMin, costSource: estimate.costSource, usdToFcfa: estimate.pricing.usdToFcfa, defaultMarginPct: estimate.pricing.defaultMarginPct, voicingUsd: estimate.voicingUsd }}
        problems={data.problems}
        episodes={episodes}
        voices={voices}
        otherSeasons={others.filter((s) => s.id !== seasonId).map((s) => ({ id: s.id, title: s.title }))}
        learners={data.learners}
        withProgress={data.withProgress}
      />
    </div>
  );
}

export default function Page({ params }: { params: Promise<{ seasonId: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Season params={params} />
    </Suspense>
  );
}
