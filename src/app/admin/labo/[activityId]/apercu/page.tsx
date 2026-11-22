import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Types } from "mongoose";
import { actorOf, requireStaff } from "@/lib/admin/context";
import { can } from "@/lib/admin/permissions";
import { reviewMediaUrl } from "@/lib/media";
import { contentProblem } from "@/lib/lab/content";
import { ACTIVITY_INFO, type ActivityType, type ListeningContent, type GapsContent, type ListenGapsContent, type SentenceContent, type MatchContent, type TfngContent, type CompleteWordsContent, type RepeatContent, isActivityType } from "@/lib/lab/types";
import { Activity, type ActivityDoc } from "@/models";
import { ListeningPlayer } from "@/components/lab/players/listening-player";
import { GapsPlayer } from "@/components/lab/players/gaps-player";
import { SentencePlayer } from "@/components/lab/players/sentence-player";
import { MatchPlayer } from "@/components/lab/players/match-player";
import { TfngPlayer } from "@/components/lab/players/tfng-player";
import { CompleteWordsPlayer } from "@/components/lab/players/complete-words-player";
import { RepeatPlayer } from "@/components/lab/players/repeat-player";
import { RichText } from "@/components/learn/rich-text";
import { PreviewBar } from "@/components/learn/preview-bar";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Learner preview" };

/** Plays a Lab activity as a learner would (graded in the browser, nothing saved), before it's placed in a unit. */
async function Preview({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;
  await connection();
  const me = await requireStaff(`/admin/labo/${activityId}/apercu`);
  if (!can.useLab(actorOf(me))) redirect("/admin");
  if (!Types.ObjectId.isValid(activityId)) notFound();
  const a = await Activity.findById(activityId).lean<ActivityDoc>();
  if (!a) notFound();
  if (!isActivityType(a.type)) notFound(); // old or removed type id
  const type: ActivityType = a.type;
  const back = `/admin/labo/${activityId}`;
  const problem = contentProblem(type, a.content);

  let body: React.ReactNode;
  if (problem) body = <EmptyState>Not ready to preview: {problem}</EmptyState>;
  else if (type === "listen_choose") {
    const c = a.content as ListeningContent;
    const audioUrl = await reviewMediaUrl(c.audioMediaId).catch(() => null);
    // Learner screen: French UI.
    body = (
      <div lang="fr" className="[--checkbar-bottom:0px]">
        <ListeningPlayer
          preview
          title={a.title}
          level={a.level ?? ""}
          skills={a.skills ?? []}
          instructions={a.instructions ?? ""}
          maelTip={a.maelTip ?? ""}
          context={c.context ? <RichText>{c.context}</RichText> : null}
          audioUrl={audioUrl}
          content={c}
          courseHref={back}
          nextHref={back}
        />
      </div>
    );
  } else if (type === "listen_fill_gaps") {
    const c = a.content as ListenGapsContent;
    const audioUrl = await reviewMediaUrl(c.audioMediaId).catch(() => null);
    body = (
      <div lang="fr" className="[--checkbar-bottom:0px]">
        <GapsPlayer
          preview
          title={a.title}
          level={a.level ?? ""}
          skills={a.skills ?? []}
          instructions={a.instructions ?? ""}
          maelTip={a.maelTip ?? ""}
          content={c}
          listen={{ audioUrl, maxPlays: c.maxPlays, context: c.context ? <RichText>{c.context}</RichText> : null }}
          courseHref={back}
          nextHref={back}
        />
      </div>
    );
  } else if (type === "fill_gaps") {
    body = (
      <div lang="fr" className="[--checkbar-bottom:0px]">
        <GapsPlayer preview title={a.title} level={a.level ?? ""} skills={a.skills ?? []} instructions={a.instructions ?? ""} maelTip={a.maelTip ?? ""} content={a.content as GapsContent} courseHref={back} nextHref={back} />
      </div>
    );
  } else if (type === "sentence_builder") {
    const c = a.content as SentenceContent;
    const ids = [...new Set(c.items.map((i) => i.audioMediaId).filter(Boolean))];
    const audioUrls = Object.fromEntries((await Promise.all(ids.map(async (id) => [id, await reviewMediaUrl(id).catch(() => null)] as const))).filter((e): e is [string, string] => !!e[1]));
    body = (
      <div lang="fr" className="[--checkbar-bottom:0px]">
        <SentencePlayer preview title={a.title} level={a.level ?? ""} skills={a.skills ?? []} instructions={a.instructions ?? ""} maelTip={a.maelTip ?? ""} content={c} audioUrls={audioUrls} courseHref={back} nextHref={back} />
      </div>
    );
  } else if (type === "repeat_after") {
    const rc = a.content as RepeatContent;
    const ids = [...new Set(rc.phrases.map((p) => p.audioMediaId).filter(Boolean))];
    const audioUrls = Object.fromEntries((await Promise.all(ids.map(async (id) => [id, await reviewMediaUrl(id).catch(() => null)] as const))).filter((e): e is [string, string] => !!e[1]));
    body = (
      <div lang="fr" className="[--checkbar-bottom:0px]">
        <RepeatPlayer preview title={a.title} level={a.level ?? ""} skills={a.skills ?? []} instructions={a.instructions ?? ""} maelTip={a.maelTip ?? ""} content={rc} audioUrls={audioUrls} courseHref={back} nextHref={back} />
      </div>
    );
  } else if (type === "complete_words") {
    const cw = a.content as CompleteWordsContent;
    const audioUrl = cw.audioMediaId ? await reviewMediaUrl(cw.audioMediaId).catch(() => null) : null;
    body = (
      <div lang="fr" className="[--checkbar-bottom:0px]">
        <CompleteWordsPlayer preview title={a.title} level={a.level ?? ""} skills={a.skills ?? []} instructions={a.instructions ?? ""} maelTip={a.maelTip ?? ""} content={cw} audioUrl={audioUrl} courseHref={back} nextHref={back} />
      </div>
    );
  } else if (type === "true_false_ng") {
    const tf = a.content as TfngContent;
    const imageUrl = tf.imageMediaId ? await reviewMediaUrl(tf.imageMediaId).catch(() => null) : null;
    const tfIds = [...new Set(tf.statements.map((s) => s.audioMediaId ?? "").filter(Boolean))];
    const tfAudio = Object.fromEntries((await Promise.all(tfIds.map(async (id) => [id, await reviewMediaUrl(id).catch(() => null)] as const))).filter((e): e is [string, string] => !!e[1]));
    body = (
      <div lang="fr" className="[--checkbar-bottom:0px]">
        <TfngPlayer preview title={a.title} level={a.level ?? ""} skills={a.skills ?? []} instructions={a.instructions ?? ""} maelTip={a.maelTip ?? ""} content={tf} imageUrl={imageUrl} audioUrls={tfAudio} courseHref={back} nextHref={back} />
      </div>
    );
  } else if (type === "match_pairs" || type === "listen_match") {
    const c = a.content as MatchContent;
    const ids = [...new Set(c.pairs.flatMap((p) => [p.audioMediaId, p.rightAudioMediaId ?? ""]).filter(Boolean))];
    const audioUrls = Object.fromEntries((await Promise.all(ids.map(async (id) => [id, await reviewMediaUrl(id).catch(() => null)] as const))).filter((e): e is [string, string] => !!e[1]));
    body = (
      <div lang="fr" className="[--checkbar-bottom:0px]">
        <MatchPlayer preview title={a.title} level={a.level ?? ""} skills={a.skills ?? []} instructions={a.instructions ?? ""} maelTip={a.maelTip ?? ""} content={c} audioUrls={audioUrls} courseHref={back} nextHref={back} listen={type === "listen_match"} />
      </div>
    );
  } else body = <EmptyState>The {ACTIVITY_INFO[type].label} is previewed from a unit (learner preview link in « Used in »).</EmptyState>;

  return (
    <div className="grid gap-4">
      <PageHeader title={a.title} back={{ href: back, label: "Back to the editor" }} subtitle={`Learner preview · ${ACTIVITY_INFO[type].label}`} />
      <PreviewBar text="Staff preview: graded in your browser, nothing is saved." editHref={back} className="mx-auto w-full max-w-2xl" />
      {body}
    </div>
  );
}

export default function Page({ params }: PageProps<"/admin/labo/[activityId]/apercu">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Preview params={params} />
    </Suspense>
  );
}
