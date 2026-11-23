import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, Lock, MessageCircle, Pencil, Play, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { redirect } from "next/navigation";
import { getProfile, listFacts, storyState, StoryError } from "@/lib/story/service";
import { voiceMinutes } from "@/lib/story/minutes";
import { waLink } from "@/lib/site";
import { formatFcfa } from "@/components/admin/ui";
import { VoiceMeter } from "@/components/story/voice-meter";
import { STAGE_KEYS, STAGE_LABEL, currentStage, isDone } from "@/lib/story/progress";
import type { AvatarConfig } from "@/lib/story/schema";
import { Avatar } from "@/components/story/avatar";
import { CityMap, type MapPin } from "@/components/story/city-map";
import { FactsList } from "@/components/story/facts-list";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Story Mode", robots: { index: false } };

const card = "rounded-[1.75rem] bg-white p-5 shadow-[0_1px_2px_rgb(20_31_77/0.06),0_24px_48px_-24px_rgb(20_31_77/0.3)] ring-1 ring-primary/10 sm:p-6";

async function Home({ params }: { params: Promise<{ storyId: string }> }) {
  const { storyId } = await params;
  await connection();
  const me = await requireUser(`/histoire/${storyId}`);
  await connectDB();
  const profile = await getProfile(me.id);
  if (!profile) redirect("/histoire");
  const viewer = { id: me.id, isStaff: me.isStaff };
  const st = await storyState(viewer, storyId).catch((e) => {
    if (e instanceof StoryError) return null;
    throw e;
  });
  if (!st) redirect("/histoire");
  const story = st.story;
  const u = story;
  const [facts, voice] = await Promise.all([listFacts(me.id, story.id), voiceMinutes(viewer, story)]);
  const anyOpen = st.items.some((x) => x.lock !== "no_access");
  const path = (eid: string) => `/histoire/${story.id}/${eid}`;
  const doneCount = st.items.filter((x) => x.done).length;

  const pins: MapPin[] = u.locations.map((l) => {
    const eps = st.items.filter((x) => x.episode.location_id === l.id);
    const cur = eps.find((x) => st.current?.episode.id === x.episode.id);
    const open = eps.find((x) => x.lock === "open");
    const state: MapPin["state"] = !eps.length ? "future" : cur ? "current" : eps.every((x) => x.done) ? "done" : open ? "open" : "locked";
    const target = cur ?? open ?? null;
    return { id: l.id, name: l.name, icon: l.icon, x: l.map_position.x, y: l.map_position.y, state, href: target ? path(target.episode.id) : null, episodeTitle: target?.episode.title ?? null };
  });
  const cur = st.current;
  const curStage = cur ? currentStage(cur.stages) : null;
  const curStarted = cur ? STAGE_KEYS.some((k) => isDone(cur.stages[k])) : false;

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <header className={`${card} relative grid items-center gap-5 overflow-clip sm:grid-cols-[auto_1fr]`}>
        <span aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-[radial-gradient(circle,rgb(54_79_171/0.14),transparent_70%)]" />
        <Avatar config={profile.avatar as AvatarConfig} size={112} title={profile.characterName} className="justify-self-center shadow-lg ring-4 ring-white" />
        <div className="relative">
          <p className="text-sm font-bold tracking-widest text-coral-dark uppercase">Story Mode</p>
          <h1 className="font-heading text-3xl leading-tight font-extrabold sm:text-4xl">
            <span className="text-primary">My life in</span> <span className="text-coral">{u.city.name}</span>
          </h1>
          <p className="font-semibold text-brand-deep">{story.title}</p>
          <p className="mt-1 text-ink/75">
            {profile.characterName} · {profile.job} · from {profile.country}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 font-semibold text-primary">
              <CalendarDays className="size-4" /> Day {profile.storyDay} in {u.city.name}
            </span>
            <span className="rounded-full border-2 border-primary/20 px-3 py-0.5 font-semibold text-primary">{story.level}</span>
            <span className="rounded-full bg-muted px-3 py-1 text-ink/70">
              {doneCount} / {st.items.length} episodes
            </span>
          </div>
          <p lang="fr" className="mt-2 text-sm text-muted-foreground">
            Objectif de la saison : « {story.promise_fr} »
          </p>
        </div>
        <Link href="/histoire" className="absolute top-4 left-4 inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold text-primary hover:bg-brand-soft sm:hidden">
          <ArrowLeft className="size-3.5" /> Seasons
        </Link>
        <Link href="/histoire/personnage" className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold text-primary hover:bg-brand-soft">
          <Pencil className="size-3.5" /> Edit
        </Link>
      </header>

      {voice && st.entitled ? <VoiceMeter leftS={voice.leftS} allowanceS={voice.allowanceS} className="rounded-2xl bg-white p-4 ring-1 ring-primary/10" /> : null}

      {!st.entitled ? (
        <div className={`${card} grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center`}>
          <div>
            <p className="font-heading text-xl font-extrabold text-primary">{anyOpen ? `${story.free_episodes} free episode${story.free_episodes === 1 ? "" : "s"} to try` : "This season is part of Story Mode"}</p>
            <p lang="fr" className="text-ink/75">
              Saison complète : {st.items.length} épisodes{story.aiMinutesIncluded ? `, ${story.aiMinutesIncluded} minutes de conversation avec les personnages` : ""}{story.priceFcfa != null ? ` — ${formatFcfa(story.priceFcfa)}` : ""}.
            </p>
          </div>
          <a href={waLink(`Bonjour, je voudrais accéder à la saison « ${story.title} » du mode histoire MaelEnglish.`)} target="_blank" rel="noopener" className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-coral bg-white px-5 py-2.5 text-[19px] font-bold text-coral shadow-[0_4px_0_0_var(--color-coral)] hover:bg-coral-soft">
            <MessageCircle className="size-5" /> Ask for access
          </a>
        </div>
      ) : null}

      {cur ? (
        <Link href={path(cur.episode.id)} className="group relative grid gap-3 overflow-clip rounded-[1.75rem] bg-brand-deep p-5 text-white shadow-xl sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
          <span aria-hidden className="pointer-events-none absolute -right-16 -bottom-24 size-72 rounded-full bg-[radial-gradient(circle,rgb(255_87_87/0.35),transparent_70%)]" />
          <div className="relative">
            <p className="text-sm font-bold tracking-wider text-white/70 uppercase">{curStarted ? "Continue the story" : "Next episode"} · Episode {cur.episode.order}</p>
            <p className="mt-1 font-heading text-2xl font-extrabold sm:text-3xl">{cur.episode.title}</p>
            <p className="mt-1 text-white/75">
              {u.locations.find((l) => l.id === cur.episode.location_id)?.name} · {cur.episode.estimated_minutes} min{curStage && curStarted ? ` · next: ${STAGE_LABEL[curStage]}` : ""}
            </p>
          </div>
          <span className="relative inline-flex items-center justify-center gap-2 justify-self-start rounded-2xl border-2 border-coral bg-white px-6 py-3 text-[19px] font-bold text-coral shadow-[0_5px_0_0_var(--color-coral)] group-hover:bg-coral-soft sm:justify-self-end">
            <Play className="size-5 fill-current" /> {curStarted ? "Continue" : "Play"}
          </span>
        </Link>
      ) : st.completed ? (
        <div className={`${card} flex items-start gap-3`}>
          <Sparkles className="mt-1 size-6 text-primary" />
          <div>
            <p className="font-heading text-xl font-extrabold text-primary">You&apos;ve played every episode available.</p>
            <p lang="fr" className="text-ink/75">{story.next_story_hook_fr}</p>
          </div>
        </div>
      ) : null}

      <section aria-labelledby="map-title" className="grid gap-3">
        <h2 id="map-title" className="font-heading text-xl font-extrabold">
          The city
        </h2>
        <CityMap city={`${u.city.name}, ${u.city.country}`} pins={pins} />
      </section>

      <section aria-labelledby="episodes-title" className={card}>
        <h2 id="episodes-title" className="flex items-center gap-2 font-heading text-xl font-extrabold">
          <BookOpen className="size-5 text-primary" /> Episodes
        </h2>
        {story.chapterList.map((c) => (
          <div key={c.id} className="mt-4">
            <p className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
              Chapter {c.order} · {c.title}
            </p>
            <ol className="mt-2 grid gap-2">
              {c.episodeList.map((e) => {
                const it = st.items.find((x) => x.episode.id === e.id)!;
                const open = it.lock === "open";
                const doneStages = STAGE_KEYS.filter((k) => isDone(it.stages[k])).length;
                const row = (
                  <div className={`flex items-center gap-3 rounded-2xl p-3 ring-1 ${it.done ? "bg-brand-soft/60 ring-primary/15" : open ? "bg-white ring-primary/25 hover:ring-primary" : "bg-muted/40 ring-transparent"}`}>
                    <span className={`flex size-10 shrink-0 items-center justify-center rounded-full font-heading font-extrabold ${it.done ? "bg-primary text-white" : open ? "border-2 border-primary text-primary" : "bg-white text-ink/35"}`}>{it.done ? <Check className="size-5" strokeWidth={3} /> : open ? e.order : <Lock className="size-4" />}</span>
                    <div className="min-w-0 flex-1">
                      <p className={`font-semibold ${open || it.done ? "text-ink" : "text-ink/50"}`}>{e.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {u.locations.find((l) => l.id === e.location_id)?.name} · {e.estimated_minutes} min
                        {it.lock === "no_access" ? " · Full season" : it.lock === "locked" ? " · Finish the previous episode" : !it.done && doneStages ? ` · ${doneStages} / 4 steps` : ""}
                      </p>
                    </div>
                    {open ? <ArrowRight className="size-5 shrink-0 text-primary" /> : null}
                  </div>
                );
                return <li key={e.id}>{open ? <Link href={path(e.id)}>{row}</Link> : row}</li>;
              })}
            </ol>
          </div>
        ))}
      </section>

      <section aria-labelledby="facts-title" className={card}>
        <h2 id="facts-title" className="font-heading text-xl font-extrabold">
          What the characters remember about you
        </h2>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">They use it in later episodes. Remove anything you don&apos;t want them to know.</p>
        <FactsList facts={facts.map((f) => ({ key: f.key, storeKey: f.storeKey, value: f.value }))} />
      </section>
    </div>
  );
}

export default function Page({ params }: { params: Promise<{ storyId: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Home params={params} />
    </Suspense>
  );
}
