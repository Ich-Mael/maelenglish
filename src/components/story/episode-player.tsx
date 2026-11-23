"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, Check, Clapperboard, Dumbbell, Lock, MessagesSquare, PartyPopper, Play, Target } from "lucide-react";
import type { Episode, Scene } from "@/lib/story/schema";
import { STAGE_KEYS, STAGE_LABEL, isDone, type EpisodeStages, type StageKey } from "@/lib/story/progress";
import type { VoiceMinutes } from "@/lib/story/minutes";
import type { FinishedRolePlay } from "@/lib/conversation/view";
import { continueAnywayAction, introSeenAction, videoAction } from "@/app/(app)/story-actions";
import { pushReward } from "@/components/gamify/reward-store";
import { confetti, playSound } from "@/components/gamify/sound";
import type { Reward } from "@/lib/gamification/service";
import { videoSource } from "@/lib/learn/media";
import { TvPlayer } from "@/components/learn/tv-player";
import { RolePlayPlayer, type PublicRolePlay } from "@/components/conversation/role-play-player";
import type { PastAttempt } from "@/lib/conversation/queries";
import { Avatar } from "./avatar";
import { SceneView, type CastMember } from "./scene";
import { useStoryAudio } from "./use-audio";
import { VoiceMeter } from "./voice-meter";
import { PageBackdrop } from "@/components/learn/page-backdrop";

/*
 * One episode (owner decision 2026-11-23): intro scene → 1. the video of what the learner will
 * live → 2. learn & practise (the lessons and Lab activities of a course unit, played with the
 * regular players) → 3. the conversation (a Talk with Coach Ish role-play played by the season's
 * character; the debrief score proves mastery) → outro scene + teaser.
 */

export type LearnStep = { id: string; kind: "lesson" | "activity"; title: string; minutes: number; state: "completed" | "open" | "locked"; score: number | null; href: string };
export type EpisodeConversation = {
  activityId: string;
  title: string;
  level: string;
  situation: React.ReactNode;
  brief: PublicRolePlay;
  briefAudioUrl: string | null;
  images: { url: string; caption: string }[];
  available: boolean;
  npc: CastMember;
  passScore: number;
  attempts: PastAttempt[];
  bestScore: number | null;
};
export type EpisodeData = {
  storyId: string;
  episode: Pick<Episode, "id" | "order" | "title" | "objectives" | "estimated_minutes" | "next_episode_teaser_fr" | "video">;
  intro: Scene;
  /** Optional background picture of the episode (signed URL). */
  backgroundUrl: string | null;
  /** Optional teaser video and / or audio shown in the intro. */
  introMedia: { videoUrl: string; audioUrl: string | null };
  outro: Scene;
  location: string;
  cast: CastMember[];
  vars: Record<string, string>;
  stages: EpisodeStages;
  introSeen: boolean;
  done: boolean;
  next: { href: string; title: string; open: boolean } | null;
  /** Conversation minutes left in the season (null = staff, unlimited). */
  voice: VoiceMinutes | null;
  seasonHref: string;
  learn: LearnStep[];
  conversation: EpisodeConversation | null;
  preview: boolean;
};

const ICON: Record<StageKey, typeof Play> = { video: Clapperboard, learn: Dumbbell, conversation: MessagesSquare };
type View = "intro" | StageKey | "outro";

/** The character's avatar as an image (the call screen shows a picture): drawn once in the page, then serialised. */
function svgToDataUrl(el: HTMLSpanElement | null): string | null {
  const svg = el?.querySelector("svg");
  if (!svg) return null;
  const xml = new XMLSerializer().serializeToString(svg).replace(/style="[^"]*"/, "");
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
}

export function EpisodePlayer({ data }: { data: EpisodeData }) {
  const router = useRouter();
  const audio = useStoryAudio(data.storyId, data.episode.id);
  const [stages, setStages] = useState(data.stages);
  const firstOpen = STAGE_KEYS.find((k) => !isDone(data.stages[k]));
  const [view, setView] = useState<View>(!data.introSeen ? "intro" : data.done ? "outro" : (firstOpen ?? "outro"));
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [finished, setFinished] = useState(data.done);
  const maxWatched = useRef(0);
  const [npcSrc, setNpcSrc] = useState<string | null>(null);
  const fill = (s: string) => s.replace(/\{(\w+)\}/g, (m, k) => data.vars[k] ?? m);

  const after = (r: { stages?: unknown; reward?: Reward | null; episodeFinished?: boolean }) => {
    if (r.stages) setStages(r.stages as EpisodeStages);
    pushReward(r.reward ?? null);
    if (r.episodeFinished) {
      setFinished(true);
      playSound("complete");
      void confetti("big");
    }
  };
  const go = (v: View) => {
    audio.stop();
    setError("");
    setView(v);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const continueAnyway = () =>
    start(async () => {
      const r = await continueAnywayAction(data.storyId, data.episode.id, "conversation");
      if (!r.ok) return setError(r.error);
      after(r);
      go("outro");
    });
  const finishIntro = () =>
    start(async () => {
      if (!data.introSeen) await introSeenAction(data.storyId, data.episode.id);
      // First time: on to the first step not done; seen again: the video comes next.
      go(data.introSeen ? "video" : (firstOpen ?? "video"));
    });
  const videoDone = (seconds: number) =>
    start(async () => {
      const r = await videoAction(data.storyId, data.episode.id, seconds);
      if (!r.ok) return setError(r.error);
      if (!r.passed) return setError("Watch the video to the end to continue.");
      after(r);
      go("learn");
    });
  const onCallFinished = (r: FinishedRolePlay) => {
    if (!r.story) return;
    if (r.story.passed) {
      setStages((s) => ({ ...s, conversation: "completed" }));
      if (r.story.episodeFinished) {
        setFinished(true);
        void confetti("big");
      }
    }
    router.refresh();
  };

  const v = data.episode.video;
  const introSrc = data.introMedia.videoUrl ? videoSource(data.introMedia.videoUrl) : null;
  const src = v.provider !== "placeholder" && v.url ? videoSource(v.url) : null;
  const learnDone = data.learn.filter((s) => s.state === "completed").length;
  const nextLearn = data.learn.find((s) => s.state === "open");
  const conv = data.conversation;
  const voiceOut = !!data.voice && data.voice.leftS < 60;

  return (
    <div className="relative z-10 mx-auto grid max-w-3xl gap-5">
      {data.backgroundUrl ? (
        // The whole page sits in the episode's place: its picture, blurred and softened, behind everything
        // (one fixed layer, painted once — scrolling doesn't redraw it).
        <PageBackdrop src={data.backgroundUrl} />
      ) : null}
      {data.backgroundUrl ? (
        // The episode's place as a scene: its background picture behind the title.
        <header className="relative isolate grid min-h-52 content-between gap-6 overflow-clip rounded-[1.75rem] p-5 text-white shadow-[0_24px_48px_-24px_rgb(20_31_77/0.55)] sm:min-h-64 sm:p-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL, resized when uploaded */}
          <img src={data.backgroundUrl} alt="" className="absolute inset-0 -z-10 size-full object-cover" />
          <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-brand-deep/90 via-brand-deep/35 to-brand-deep/10" />
          <Link href={data.seasonHref} className="justify-self-start rounded-full bg-black/35 px-3 py-1.5 text-sm font-semibold text-white hover:bg-black/50">
            ← Back to the season
          </Link>
          <div className="grid gap-1">
            <p className="text-sm font-bold tracking-wider text-white/85 uppercase [text-shadow:0_1px_3px_rgb(0_0_0/0.5)]">
              Episode {data.episode.order} · {data.location}
            </p>
            <h1 className="font-heading text-3xl font-extrabold [text-shadow:0_2px_8px_rgb(0_0_0/0.45)] sm:text-4xl">{data.episode.title}</h1>
          </div>
        </header>
      ) : (
        <header className="grid gap-1">
          <Link href={data.seasonHref} className="text-sm font-semibold text-primary hover:underline">
            ← Back to the season
          </Link>
          <p className="text-sm font-bold tracking-wider text-coral-dark uppercase">
            Episode {data.episode.order} · {data.location}
          </p>
          <h1 className="font-heading text-3xl font-extrabold text-primary sm:text-4xl">{data.episode.title}</h1>
        </header>
      )}

      <nav aria-label="Episode steps" className="grid grid-cols-4 gap-1.5">
        {/* The intro (goals + opening scene) can always be seen again. */}
        <button type="button" onClick={() => go("intro")} aria-current={view === "intro" ? "step" : undefined} className={`flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-center text-[11px] font-bold transition sm:text-xs ${view === "intro" ? "bg-primary text-white shadow-[0_3px_0_0_var(--color-brand-deep)]" : data.introSeen ? "bg-brand-soft text-primary" : "bg-white text-primary ring-2 ring-primary/30"}`}>
          <Target className="size-5" aria-hidden />
          <span>Intro</span>
        </button>
        {STAGE_KEYS.map((k, i) => {
          const s = stages[k];
          const Icon = ICON[k];
          const active = view === k;
          // Learners move back and forth freely between the steps; only the call itself waits for « learn & practise ».
          const locked = s === "locked";
          return (
            <button key={k} type="button" onClick={() => go(k)} aria-current={active ? "step" : undefined} className={`flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-center text-[11px] font-bold transition sm:text-xs ${active ? "bg-primary text-white shadow-[0_3px_0_0_var(--color-brand-deep)]" : isDone(s) ? "bg-brand-soft text-primary" : locked ? "bg-muted/50 text-ink/35" : "bg-white text-primary ring-2 ring-primary/30"}`}>
              <span className="relative">
                {locked ? <Lock className="size-5" /> : <Icon className="size-5" />}
                {isDone(s) && !active ? <Check className="absolute -right-2 -bottom-1 size-3.5 rounded-full bg-primary p-0.5 text-white" strokeWidth={4} /> : null}
              </span>
              <span>
                <span className="hidden sm:inline">{i + 1}. </span>
                {STAGE_LABEL[k]}
              </span>
            </button>
          );
        })}
      </nav>

      {error ? (
        <p role="alert" className="rounded-xl bg-coral-soft px-4 py-2 text-coral-dark">
          {error}
        </p>
      ) : null}

      {/* The character's avatar, drawn once and turned into an image for the call screen. */}
      {conv ? (
        <span ref={(el) => void (!npcSrc && el && setNpcSrc(svgToDataUrl(el)))} className="hidden" aria-hidden>
          <Avatar config={conv.npc.avatar} size={256} />
        </span>
      ) : null}

      {view === "conversation" && conv && !isDone(stages.learn) && !data.preview ? (
        <section className="grid gap-3 rounded-[1.75rem] bg-white p-5 ring-1 ring-primary/10 sm:p-6">
          <div className="flex items-start gap-3">
            <Avatar config={conv.npc.avatar} size={56} />
            <div>
              <h2 className="font-heading text-2xl font-extrabold">Talk with {conv.npc.name}</h2>
              <p lang="fr" className="text-ink/75">
                {conv.npc.name} vous attend. Terminez d&apos;abord « Learn &amp; practise » ({learnDone} / {data.learn.length} faits) : la conversation sert à montrer ce que vous avez appris.
              </p>
            </div>
          </div>
          <button type="button" onClick={() => go("learn")} className="inline-flex items-center gap-2 justify-self-start rounded-2xl bg-primary px-5 py-2.5 font-bold text-white shadow-[0_4px_0_0_var(--color-brand-deep)]">
            Go to Learn &amp; practise <ArrowRight className="size-4" />
          </button>
        </section>
      ) : view === "conversation" && conv ? (
        <section className="grid gap-4">
          {data.voice ? <VoiceMeter leftS={data.voice.leftS} allowanceS={data.voice.allowanceS} className="rounded-2xl bg-white p-4 ring-1 ring-primary/10" /> : null}
          <div className="flex items-start gap-3 rounded-2xl bg-brand-soft/60 p-4">
            <Avatar config={conv.npc.avatar} size={48} />
            <p lang="fr" className="text-ink/85">
              Montrez ce que vous avez appris : parlez avec <strong>{conv.npc.name}</strong>. Il faut au moins <strong>{conv.passScore}/100</strong> au bilan pour continuer l&apos;histoire.
              {conv.bestScore != null ? ` Votre meilleur score : ${conv.bestScore}.` : ""}
            </p>
          </div>
          {voiceOut ? (
            <div className="grid gap-2 rounded-2xl border-2 border-coral bg-white p-4">
              <p lang="fr" className="text-ink/85">Vos minutes de conversation pour cette saison sont utilisées : demandez des minutes à votre coach.</p>
              <button type="button" onClick={continueAnyway} disabled={pending} className="justify-self-start rounded-2xl px-4 py-2 font-semibold text-primary ring-2 ring-primary/30 hover:bg-brand-soft">
                Continue anyway
              </button>
            </div>
          ) : (
            <RolePlayPlayer
              activityId={conv.activityId}
              title={conv.title}
              level={conv.level}
              situation={conv.situation}
              brief={conv.brief}
              briefAudioUrl={conv.briefAudioUrl}
              images={conv.images}
              available={conv.available}
              minutesLeft={data.voice ? Math.floor(data.voice.leftS / 60) : null}
              capMinutes={null}
              courseHref={data.seasonHref}
              nextHref={null}
              preview={data.preview}
              attempts={conv.attempts}
              story={{ storyId: data.storyId, episodeId: data.episode.id }}
              partner={{ name: conv.npc.name, avatarSrc: npcSrc ?? "/images/coach-ish-512.webp" }}
              onFinished={onCallFinished}
              onContinueAnyway={continueAnyway}
            />
          )}
          {isDone(stages.conversation) ? (
            <button type="button" onClick={() => go("outro")} className="inline-flex items-center gap-2 justify-self-end rounded-2xl bg-primary px-6 py-3 font-bold text-white shadow-[0_4px_0_0_var(--color-brand-deep)]">
              See how the story continues <ArrowRight className="size-4" />
            </button>
          ) : null}
        </section>
      ) : (
        <section className="rounded-[1.75rem] bg-white p-5 shadow-[0_1px_2px_rgb(20_31_77/0.06),0_24px_48px_-24px_rgb(20_31_77/0.3)] ring-1 ring-primary/10 sm:p-6">
          {view === "intro" ? (
            <>
              {data.episode.objectives.length ? (
                <ul lang="fr" className="mb-4 grid gap-1 rounded-2xl bg-brand-soft/60 p-4 text-sm">
                  <li className="font-bold text-primary">À la fin de cet épisode :</li>
                  {data.episode.objectives.map((o) => (
                    <li key={o} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" /> {o}
                    </li>
                  ))}
                </ul>
              ) : null}
              {introSrc ? (
                <div className="mb-4">
                  {introSrc.kind === "file" ? <video controls preload="metadata" playsInline className="w-full rounded-2xl bg-black" src={introSrc.src} /> : <TvPlayer source={introSrc} title={data.episode.title} />}
                </div>
              ) : null}
              {data.introMedia.audioUrl ? (
                <div className="mb-4 grid gap-1 rounded-2xl bg-brand-deep/5 p-3">
                  <p className="text-xs font-bold tracking-wide text-primary uppercase">Listen</p>
                  <audio controls preload="none" src={data.introMedia.audioUrl} className="w-full" />
                </div>
              ) : null}
              <SceneView scene={data.intro} refPrefix="intro" cast={data.cast} audio={audio} fill={fill} onDone={finishIntro} doneLabel={data.introSeen ? "Watch the video" : "Start the episode"} />
            </>
          ) : view === "video" ? (
            <div className="grid gap-4">
              <h2 className="font-heading text-2xl font-extrabold">Watch what you&apos;re about to live</h2>
              {!src ? (
                <div className="grid place-items-center gap-3 rounded-2xl bg-brand-deep p-8 text-center text-white">
                  <Clapperboard className="size-10 text-white/80" />
                  <p className="font-heading text-xl font-extrabold">Video coming soon</p>
                  <p lang="fr" className="max-w-md text-white/80">
                    La vidéo de cet épisode est en cours de tournage. Vous pouvez continuer : tout le reste de l&apos;épisode est prêt.
                  </p>
                </div>
              ) : src.kind === "file" ? (
                <video controls preload="metadata" playsInline className="w-full rounded-2xl bg-black" src={src.src} onTimeUpdate={(e) => (maxWatched.current = Math.max(maxWatched.current, e.currentTarget.currentTime))} onEnded={(e) => videoDone(e.currentTarget.duration)} />
              ) : (
                <TvPlayer source={src} title={data.episode.title} />
              )}
              {v.transcript_en ? (
                <details className="rounded-2xl ring-1 ring-ink/10">
                  <summary className="cursor-pointer px-4 py-3 font-semibold text-primary">Transcript</summary>
                  <p lang="en" className="px-4 pb-4 whitespace-pre-line">
                    {v.transcript_en}
                  </p>
                </details>
              ) : null}
              <button type="button" disabled={pending} onClick={() => (isDone(stages.video) ? go("learn") : videoDone(src?.kind === "file" ? maxWatched.current : 0))} className="inline-flex items-center justify-center gap-2 justify-self-end rounded-2xl bg-primary px-6 py-3 font-bold text-white shadow-[0_4px_0_0_var(--color-brand-deep)] disabled:opacity-60">
                {isDone(stages.video) ? "Next step" : !src ? "Continue" : "I've watched it"} <ArrowRight className="size-4" />
              </button>
            </div>
          ) : view === "learn" ? (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-heading text-2xl font-extrabold">Learn &amp; practise</h2>
                <span className="text-sm font-semibold text-muted-foreground">
                  {learnDone} / {data.learn.length} done
                </span>
              </div>
              <p lang="fr" className="text-ink/75">
                Les leçons et activités qui vous préparent à la conversation. Faites-les dans l&apos;ordre de votre choix et revenez-y quand vous voulez.
              </p>
              <ol className="grid gap-2">
                {data.learn.map((s, i) => {
                  const open = true;
                  const row = (
                    <div className={`flex items-center gap-3 rounded-2xl p-3 ring-1 ${s.state === "completed" ? "bg-brand-soft/60 ring-primary/15" : open ? "bg-white ring-primary/25 hover:ring-primary" : "bg-muted/40 ring-transparent"}`}>
                      <span className={`flex size-10 shrink-0 items-center justify-center ${s.kind === "lesson" ? "rounded-xl" : "rounded-full"} ${s.state === "completed" ? "bg-primary text-white" : open ? "border-2 border-primary text-primary" : "bg-white text-ink/35"}`}>
                        {s.state === "completed" ? <Check className="size-5" strokeWidth={3} /> : !open ? <Lock className="size-4" /> : s.kind === "lesson" ? <BookOpen className="size-5" /> : <Dumbbell className="size-5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{s.kind === "lesson" ? "Lesson" : "Activity"} {i + 1}</p>
                        <p className={`font-semibold ${open ? "text-ink" : "text-ink/50"}`}>{s.title}</p>
                      </div>
                      {s.score != null ? <span className="text-sm font-bold text-primary">{s.score}%</span> : s.minutes ? <span className="text-sm text-muted-foreground">{s.minutes} min</span> : null}
                    </div>
                  );
                  return <li key={s.id}>{open ? <Link href={s.href}>{row}</Link> : row}</li>;
                })}
              </ol>
              {isDone(stages.learn) ? (
                <button type="button" onClick={() => go("conversation")} className="inline-flex items-center gap-2 justify-self-end rounded-2xl border-2 border-coral bg-white px-6 py-3 text-[19px] font-bold text-coral shadow-[0_5px_0_0_var(--color-coral)] hover:bg-coral-soft">
                  <MessagesSquare className="size-5" /> Talk with {conv?.npc.name ?? "the character"}
                </button>
              ) : nextLearn ? (
                <Link href={nextLearn.href} className="inline-flex items-center gap-2 justify-self-end rounded-2xl bg-primary px-6 py-3 font-bold text-white shadow-[0_4px_0_0_var(--color-brand-deep)]">
                  {learnDone ? "Continue" : "Start"} <ArrowRight className="size-4" />
                </Link>
              ) : null}
            </div>
          ) : view === "conversation" ? (
            <p className="text-muted-foreground">The conversation of this episode isn&apos;t ready yet.</p>
          ) : (
            <div className="grid gap-5">
              {finished ? (
                <>
                  <SceneView scene={data.outro} refPrefix="outro" cast={data.cast} audio={audio} fill={fill} onDone={() => router.push(data.next?.open ? data.next.href : data.seasonHref)} doneLabel={data.next?.open ? "Next episode" : "Back to the season"} />
                  <div className="flex items-start gap-3 rounded-2xl bg-brand-deep p-5 text-white">
                    <PartyPopper className="mt-1 size-6 shrink-0 text-white/80" />
                    <div>
                      <p className="font-heading text-xl font-extrabold">Episode complete!</p>
                      <p className="text-white/80">The conversation&apos;s useful phrases are in your notebook: they&apos;ll come back for review tomorrow.</p>
                      {data.episode.next_episode_teaser_fr ? (
                        <p lang="fr" className="mt-2 font-semibold">
                          {data.episode.next_episode_teaser_fr}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">Finish the three steps to see how the story continues.</p>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
