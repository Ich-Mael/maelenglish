import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { actorOf, requireStaff } from "@/lib/admin/context";
import { can } from "@/lib/admin/permissions";
import { adminEpisode, rolePlayOptions, unitOptions } from "@/lib/story/admin";
import { reviewMediaUrl } from "@/lib/media";
import { PageHeader } from "@/components/admin/ui";
import { EpisodeEditor, type EpisodeContent } from "@/components/admin/story/episode-editor";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Story episode" };

async function EpisodePage({ params }: { params: Promise<{ seasonId: string; episodeId: string }> }) {
  const { seasonId, episodeId } = await params;
  await connection();
  const me = await requireStaff(`/admin/story/${seasonId}/episodes/${episodeId}`);
  if (!can.editStory(actorOf(me))) redirect("/admin");
  const a = await adminEpisode(episodeId);
  if (!a || String(a.doc.seasonId) !== seasonId || !a.episode) notFound();
  const [units, rolePlays, introAudioUrl, backgroundUrl] = await Promise.all([
    unitOptions(),
    rolePlayOptions(),
    a.episode.intro_media.audio_media_id ? reviewMediaUrl(a.episode.intro_media.audio_media_id).catch(() => null) : null,
    a.episode.background_media_id ? reviewMediaUrl(a.episode.background_media_id).catch(() => null) : null,
  ]);
  const { id: _id, order: _order, ...content } = a.episode;
  void _id;
  void _order;
  return (
    <div className="grid max-w-4xl gap-5">
      <PageHeader title={a.episode.title} back={{ href: `/admin/story/${seasonId}`, label: a.season.title }} subtitle={`Episode ${a.doc.order} · ${a.season.city.name}`} />
      <EpisodeEditor
        episodeId={episodeId}
        seasonId={seasonId}
        seasonSlug={a.season.id}
        slug={a.doc.slug}
        status={a.doc.status as "draft" | "ready"}
        chapterId={a.doc.chapterId}
        chapters={a.season.chapterList.map((c) => ({ id: c.id, title: c.title }))}
        characters={a.season.characters}
        locations={a.season.locations}
        initial={content as EpisodeContent}
        units={units}
        rolePlays={rolePlays}
        refs={a.refs}
        introAudioUrl={introAudioUrl}
        backgroundUrl={backgroundUrl}
      />
    </div>
  );
}

export default function Page({ params }: { params: Promise<{ seasonId: string; episodeId: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EpisodePage params={params} />
    </Suspense>
  );
}
