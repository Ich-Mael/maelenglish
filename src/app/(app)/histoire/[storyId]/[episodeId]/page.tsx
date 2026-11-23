import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { EpisodeProgress, type EpisodeProgressDoc } from "@/models";
import { conversationEngine } from "@/lib/ai";
import { attemptsOn, publicBrief } from "@/lib/conversation/queries";
import type { RolePlayContent } from "@/lib/lab/types";
import { episodeSteps, getProfile, storyRolePlay, storyState, varsOf, StoryError } from "@/lib/story/service";
import { findEpisode } from "@/lib/story/content";
import { voiceMinutes } from "@/lib/story/minutes";
import { episodePath, seasonPath, storyStepPath } from "@/lib/story/paths";
import type { AvatarConfig } from "@/lib/story/schema";
import { EpisodePlayer, type EpisodeData } from "@/components/story/episode-player";
import { RichText } from "@/components/learn/rich-text";
import { mediaUrlFor } from "@/lib/media";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Story Mode", robots: { index: false } };

async function Episode({ params }: { params: Promise<{ storyId: string; episodeId: string }> }) {
  const { storyId, episodeId } = await params;
  await connection();
  const me = await requireUser(episodePath(storyId, episodeId));
  await connectDB();
  const profile = await getProfile(me.id);
  if (!profile) redirect("/histoire");
  const viewer = { id: me.id, isStaff: me.isStaff };
  const st = await storyState(viewer, storyId).catch((e) => {
    if (e instanceof StoryError) return null;
    throw e;
  });
  if (!st) notFound();
  const u = st.story;
  const found = findEpisode(u, episodeId);
  if (!found) notFound();
  const item = st.items.find((x) => x.episode.id === episodeId)!;
  if (item.lock !== "open")
    return (
      <div className="mx-auto grid max-w-xl justify-items-center gap-3 rounded-[1.75rem] bg-white p-8 text-center ring-1 ring-primary/10">
        <Lock className="size-8 text-primary" />
        <p className="font-heading text-2xl font-extrabold">{found.episode.title}</p>
        <p lang="fr" className="text-ink/75">
          {item.lock === "no_access" ? "Cet épisode fait partie de la saison complète : demandez l'accès depuis la page de la saison." : "Terminez d'abord l'épisode précédent."}
        </p>
        <Link href={seasonPath(storyId)} className="rounded-2xl bg-primary px-5 py-2.5 font-bold text-white">
          Back to the season
        </Link>
      </div>
    );

  const e = found.episode;
  const [p, voice, steps, rp, introAudio, background] = await Promise.all([
    EpisodeProgress.findOne({ userId: me.id, storyId, episodeId }).lean<EpisodeProgressDoc>(),
    voiceMinutes(viewer, u),
    episodeSteps(viewer, e),
    storyRolePlay(viewer, storyId, episodeId).catch(() => null),
    e.intro_media.audio_media_id ? mediaUrlFor({ id: me.id, isAdmin: me.isStaff }, e.intro_media.audio_media_id).catch(() => null) : null,
    e.background_media_id ? mediaUrlFor({ id: me.id, isAdmin: me.isStaff }, e.background_media_id).catch(() => null) : null,
  ]);
  const castIds = new Set([...e.characters, e.conversation.npc, ...e.intro_scene.lines.map((l) => l.speaker), ...e.outro_scene.lines.map((l) => l.speaker)]);
  const cast = u.characters.filter((c) => castIds.has(c.id)).map((c) => ({ id: c.id, name: c.name, avatar: (c.avatar ?? null) as AvatarConfig | null }));
  const nextEp = found.all[found.index + 1];
  const nextItem = nextEp ? st.items.find((x) => x.episode.id === nextEp.episode.id) : null;
  const rc = rp ? (rp.activity.content as RolePlayContent) : null;
  const briefAudioUrl = rc?.briefAudioMediaId ? await mediaUrlFor({ id: me.id, isAdmin: me.isStaff }, rc.briefAudioMediaId).catch(() => null) : null;
  const callImages = (await Promise.all((rc?.images ?? []).map(async (im) => ({ url: await mediaUrlFor({ id: me.id, isAdmin: me.isStaff }, im.mediaId).catch(() => null), caption: im.caption })))).filter((x): x is { url: string; caption: string } => !!x.url);
  const data: EpisodeData = {
    storyId,
    episode: { id: e.id, order: e.order, title: e.title, objectives: e.objectives, estimated_minutes: e.estimated_minutes, next_episode_teaser_fr: e.next_episode_teaser_fr, video: e.video },
    intro: e.intro_scene,
    introMedia: { videoUrl: e.intro_media.video_url, audioUrl: introAudio },
    backgroundUrl: background,
    outro: e.outro_scene,
    location: u.locations.find((l) => l.id === e.location_id)?.name ?? u.city.name,
    cast,
    vars: varsOf(u, profile),
    stages: item.stages,
    introSeen: !!p?.introSeen,
    done: item.done,
    next: nextEp ? { href: episodePath(storyId, nextEp.episode.id), title: nextEp.episode.title, open: !!nextItem && nextItem.lock !== "no_access" } : null,
    voice,
    seasonHref: seasonPath(storyId),
    learn: steps.map((s) => ({ id: String(s.step._id), kind: s.step.kind as "lesson" | "activity", title: s.step.title, minutes: s.step.estimatedMinutes ?? 0, state: s.state, score: s.score, href: storyStepPath(storyId, episodeId, String(s.step._id)) })),
    conversation:
      rp && rc
        ? {
            activityId: String(rp.activity._id),
            title: rp.activity.title,
            level: rp.activity.level ?? "",
            situation: rc.situation ? <RichText lang="fr">{rc.situation}</RichText> : null,
            // The character as learners see them (their personality stays in the AI's instructions).
            brief: { ...publicBrief(rc), aiRole: rp.npc ? `${rp.npc.name}, ${rp.npc.role}` : rc.aiRole },
            briefAudioUrl,
            images: callImages,
            available: !!conversationEngine(),
            npc: cast.find((c) => c.id === e.conversation.npc) ?? { id: "partner", name: rp.npc?.name ?? "Coach Ish", avatar: null },
            passScore: rp.passScore,
            attempts: await attemptsOn(me.id, String(rp.activity._id)),
            bestScore: p?.conversationBestScore ?? null,
          }
        : null,
    preview: me.isStaff,
  };
  return <EpisodePlayer data={data} />;
}

export default function Page({ params }: { params: Promise<{ storyId: string; episodeId: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Episode params={params} />
    </Suspense>
  );
}
