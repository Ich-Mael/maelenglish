"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ExternalLink, Eye, Loader2, MessagesSquare, Plus } from "lucide-react";
import { btn, inputCls, Pill } from "@/components/admin/ui";
import type { Character, Episode, Location } from "@/lib/story/schema";
import { episodeProblems } from "@/lib/story/checks";
import { createEpisodeRolePlayAction, saveEpisodeAction, setEpisodeStatusAction } from "@/app/admin/story/actions";
import { Area, Lines, MultiPick, Num, Pick, SceneEditor, Text } from "./fields";
import { AudioField } from "@/components/admin/audio-field";
import { ImageField } from "@/components/admin/image-field";
import { cn } from "cn";

/*
 * Admin → Story Mode → an episode (English UI, owner decision 2026-11-23): the episode reuses what
 * exists — the video of the situation, the lessons and Lab activities of a course unit (« learn &
 * practise »), and a Lab « AI role-play » played by a season character (the conversation that proves
 * mastery). Only the story around it (scenes, character, place) is written here. Saved at once and
 * checked live (episodeProblems); « Ready » needs no problem.
 */

export type EpisodeContent = Omit<Episode, "id" | "order">;
type Props = {
  episodeId: string;
  seasonId: string;
  seasonSlug: string;
  slug: string;
  status: "draft" | "ready";
  chapterId: string;
  chapters: { id: string; title: string }[];
  characters: Character[];
  locations: Location[];
  initial: EpisodeContent;
  units: { id: string; label: string; course: string }[];
  rolePlays: { id: string; title: string; status: "draft" | "ready"; level: string }[];
  introAudioUrl: string | null;
  backgroundUrl: string | null;
  /** What the server found for the saved unit / role-play. */
  refs: { unitSteps: number | null; rolePlay: "ready" | "draft" | "missing" | null } | null;
};

function Section({ title, hint, children, open: initial = false, badge }: { title: string; hint?: string; children: React.ReactNode; open?: boolean; badge?: string }) {
  const [open, setOpen] = useState(initial);
  return (
    <section className="rounded-2xl border border-border bg-card">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        <span className="font-heading font-bold text-brand-deep">{title}</span>
        {badge ? <span className="text-xs text-muted-foreground">{badge}</span> : null}
        <ChevronDown className={cn("ml-auto size-4 transition", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="grid gap-4 border-t border-border p-4">
          {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
          {children}
        </div>
      ) : null}
    </section>
  );
}

export function EpisodeEditor(p: Props) {
  const router = useRouter();
  const [c, setC] = useState<EpisodeContent>(p.initial);
  const [chapterId, setChapterId] = useState(p.chapterId);
  const [status, setStatus] = useState(p.status);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [introAudioUrl, setIntroAudioUrl] = useState<string | null>(p.introAudioUrl);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(p.backgroundUrl);

  const set = <K extends keyof EpisodeContent>(k: K, v: EpisodeContent[K]) => {
    setC((x) => ({ ...x, [k]: v }));
    setDirty(true);
  };
  // The server's findings only apply to the unit / role-play as saved.
  const refs = p.refs && c.unit_id === p.initial.unit_id && c.conversation.role_play_id === p.initial.conversation.role_play_id ? p.refs : null;
  const problems = useMemo(() => episodeProblems({ characters: p.characters, locations: p.locations, chapterList: p.chapters.map((x, i) => ({ ...x, order: i + 1, summary_fr: "", episodeList: [] })) }, { ...c, id: p.slug, order: 1 } as Episode, chapterId, refs), [c, chapterId, p, refs]);
  const cast = p.characters.map((x) => ({ id: x.id, name: x.name, voice_id: x.voice_id }));
  const npcs = p.characters.filter((x) => x.id !== "narrator");
  const conv = c.conversation;
  const courses = [...new Set(p.units.map((u) => u.course))];
  const rp = p.rolePlays.find((r) => r.id === conv.role_play_id);

  const save = () =>
    start(async () => {
      setMessage(null);
      const r = await saveEpisodeAction(p.episodeId, c, chapterId);
      if (!r.ok) return setMessage({ ok: false, text: r.error });
      setDirty(false);
      if (r.problems.length && status === "ready") setStatus("draft");
      setMessage({ ok: true, text: r.problems.length ? `Saved as a draft — ${r.problems.length} thing${r.problems.length === 1 ? "" : "s"} to fix before « Ready ».` : "Saved." });
      router.refresh();
    });
  const toggleReady = () =>
    start(async () => {
      setMessage(null);
      const next = status === "ready" ? "draft" : "ready";
      const r = await setEpisodeStatusAction(p.episodeId, next);
      if (!r.ok) return setMessage({ ok: false, text: r.error });
      setStatus(next);
      setMessage({ ok: true, text: next === "ready" ? "Ready: learners of the published season get it." : "Back to draft: hidden from learners." });
    });
  const createRolePlay = () =>
    start(async () => {
      setMessage(null);
      if (dirty) {
        const r = await saveEpisodeAction(p.episodeId, c, chapterId);
        if (!r.ok) return setMessage({ ok: false, text: r.error });
        setDirty(false);
      }
      const r = await createEpisodeRolePlayAction(p.episodeId);
      if (!r.ok) return setMessage({ ok: false, text: r.error });
      window.open(`/admin/labo/${r.activityId}`, "_blank", "noopener");
      setC((x) => ({ ...x, conversation: { ...x.conversation, role_play_id: r.activityId } }));
      setMessage({ ok: true, text: "Conversation created as a draft in the Lab (opened in a new tab): write the goals and the opening line, then mark it ready." });
      router.refresh();
    });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={status === "ready" ? "green" : "grey"}>{status === "ready" ? "Ready" : "Draft"}</Pill>
        <span className="text-sm text-muted-foreground">id « {p.slug} »</span>
        <Link className={cn(btn.secondary, "ml-auto")} href={`/histoire/${p.seasonSlug}/${p.slug}`} target="_blank">
          <Eye className="size-4" /> Preview as a learner
        </Link>
      </div>

      {problems.length ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">To fix before « Ready »:</p>
          <ul className="mt-1 list-disc pl-5">
            {problems.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <Section title="1. Basics" open>
        <div className="grid gap-3 sm:grid-cols-2">
          <Text label="Title (English)" lang="en" value={c.title} onChange={(v) => set("title", v)} />
          <Pick label="Chapter" value={chapterId} onChange={(v) => (setChapterId(v), setDirty(true))} options={p.chapters.map((x) => ({ value: x.id, label: x.title }))} />
          <Pick label="Place (map pin)" value={c.location_id} onChange={(v) => set("location_id", v)} options={[{ value: "", label: "— Choose —" }, ...p.locations.map((l) => ({ value: l.id, label: l.name }))]} />
          <Num label="Minutes" value={c.estimated_minutes} min={1} onChange={(v) => set("estimated_minutes", v ?? 30)} />
          <Text label="Situation (French, for the notebook)" lang="fr" value={c.situation} onChange={(v) => set("situation", v)} hint="e.g. « au travail », « au marché »" />
          <Num label="Story days added" value={c.day_increment} min={0} onChange={(v) => set("day_increment", v ?? 1)} />
        </div>
        <div className="grid gap-1 text-sm">
          <span className="font-medium">Episode background (optional)</span>
          <span className="text-xs text-muted-foreground">A wide picture of the place (e.g. the airport hall), ideally 16:9 without text: shown behind the episode&apos;s header and scenes.</span>
          <ImageField value={c.background_media_id} url={backgroundUrl} onChange={(id, url) => (set("background_media_id", id), setBackgroundUrl(url))} noun="background" maxSide={2000} />
        </div>
        <MultiPick label="Characters in this episode" value={c.characters} onChange={(v) => set("characters", v)} options={npcs.map((x) => ({ value: x.id, label: x.name }))} />
        <Lines label="Objectives (French « can-do »)" lang="fr" value={c.objectives} onChange={(v) => set("objectives", v)} hint="One per line, e.g. « Je sais me présenter »." />
      </Section>

      <Section title="2. Intro" badge={`${c.intro_scene.lines.length} lines${c.intro_media.video_url ? " · video" : ""}${c.intro_media.audio_media_id ? " · audio" : ""}`} hint="Shown first, with the objectives: an optional teaser video and / or audio, then the opening scene (narration in French; characters speak English with their voice and a French translation).">
        <div className="grid gap-3 sm:grid-cols-2">
          <Text label="Teaser video (optional)" value={c.intro_media.video_url} onChange={(v) => set("intro_media", { ...c.intro_media, video_url: v.trim() })} hint="A YouTube, Vimeo or video file link." />
          <AudioField label="Intro audio (optional)" value={c.intro_media.audio_media_id} url={introAudioUrl} onChange={(id, url) => (set("intro_media", { ...c.intro_media, audio_media_id: id }), setIntroAudioUrl(url))} />
        </div>
        <SceneEditor label="Opening scene" scene={c.intro_scene} onChange={(s) => set("intro_scene", s)} cast={cast} />
      </Section>

      <Section title="3. Video — what the learner will live" badge={c.video.provider === "placeholder" ? "coming soon" : c.video.provider} open>
        <div className="grid gap-3 sm:grid-cols-3">
          <Pick label="Video" value={c.video.provider} onChange={(v) => set("video", { ...c.video, provider: v as Episode["video"]["provider"] })} options={[{ value: "placeholder", label: "Not filmed yet (« coming soon »)" }, { value: "youtube", label: "YouTube" }, { value: "vimeo", label: "Vimeo" }, { value: "file", label: "Video file (URL)" }]} />
          {c.video.provider !== "placeholder" ? (
            <>
              <Text label="Link" value={c.video.url} onChange={(v) => set("video", { ...c.video, url: v })} />
              <Num label="Duration (seconds)" value={c.video.duration_seconds} min={0} onChange={(v) => set("video", { ...c.video, duration_seconds: v ?? 0 })} hint={c.video.provider === "file" ? "Learners continue after watching 90 %." : "YouTube / Vimeo can\u2019t be tracked: learners continue with « I\u2019ve watched it »."} />
            </>
          ) : null}
        </div>
        <Area label="Transcript (English, optional)" lang="en" rows={4} value={c.video.transcript_en} onChange={(v) => set("video", { ...c.video, transcript_en: v })} />
      </Section>

      <Section title="4. Learn & practise — a course unit" open hint="The lessons and Lab activities of an existing unit, in its order (its speaking challenge, writing tasks and role-plays are left out). Learners play them inside the episode; their progress also counts in the course.">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Unit</span>
          <select className={inputCls} value={c.unit_id} onChange={(e) => set("unit_id", e.target.value)}>
            <option value="">— Choose a unit —</option>
            {courses.map((course) => (
              <optgroup key={course} label={course}>
                {p.units
                  .filter((u) => u.course === course)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        {c.unit_id && refs?.unitSteps != null ? <p className="text-sm text-muted-foreground">{refs.unitSteps} lesson(s) and activities will be played in this episode.</p> : c.unit_id && c.unit_id !== p.initial.unit_id ? <p className="text-sm text-muted-foreground">Save to check the unit.</p> : null}
      </Section>

      <Section title="5. Conversation — Talk with Coach Ish" open hint="The proof of mastery: a Lab « AI role-play » played by one of the season's characters (their name, personality, voice and avatar replace the scenario's). The debrief score decides if the learner goes on.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Pick label="Character" value={conv.npc} onChange={(v) => set("conversation", { ...conv, npc: v })} options={[{ value: "", label: "— Choose —" }, ...npcs.map((x) => ({ value: x.id, label: x.name }))]} />
          <Num label="Debrief score needed (/100)" value={conv.pass_score} min={0} max={100} onChange={(v) => set("conversation", { ...conv, pass_score: v ?? 60 })} hint="Below it, the learner tries again (« Continue anyway » after 2 tries)." />
        </div>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">AI role-play (Lab)</span>
          <select className={inputCls} value={conv.role_play_id} onChange={(e) => set("conversation", { ...conv, role_play_id: e.target.value })}>
            <option value="">— Choose a role-play —</option>
            {p.rolePlays.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
                {r.level ? ` · ${r.level}` : ""}
                {r.status === "draft" ? " (draft)" : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          {conv.role_play_id ? (
            <a className={btn.secondary} href={`/admin/labo/${conv.role_play_id}`} target="_blank" rel="noopener">
              <ExternalLink className="size-4" /> Edit {rp?.status === "draft" ? "and mark ready " : ""}in the Lab
            </a>
          ) : null}
          <button type="button" className={btn.secondary} onClick={createRolePlay} disabled={pending || !conv.npc}>
            <Plus className="size-4" /> <MessagesSquare className="size-4" /> Create a conversation for this episode
          </button>
        </div>
      </Section>

      <Section title="6. Outro scene and teaser" badge={`${c.outro_scene.lines.length} lines`}>
        <SceneEditor label="Lines" scene={c.outro_scene} onChange={(s) => set("outro_scene", s)} cast={cast} />
        <Text label="Teaser of the next episode (French)" lang="fr" value={c.next_episode_teaser_fr} onChange={(v) => set("next_episode_teaser_fr", v)} />
      </Section>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-lg">
        {message ? (
          <p className={cn("mr-auto text-sm", message.ok ? "text-success" : "text-destructive")} role="status">
            {message.text}
          </p>
        ) : dirty ? (
          <p className="mr-auto text-sm text-muted-foreground">Unsaved changes</p>
        ) : null}
        <button type="button" className={btn.secondary} onClick={toggleReady} disabled={pending || dirty || (status === "draft" && problems.length > 0)} title={dirty ? "Save first" : problems.length ? "Fix the problems first" : undefined}>
          {status === "ready" ? "Back to draft" : "Mark ready"}
        </button>
        <button type="button" className={btn.primary} onClick={save} disabled={pending || !dirty}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null} Save
        </button>
      </div>
      <Link href={`/admin/story/${p.seasonId}`} className="text-sm font-semibold text-primary hover:underline">
        ← Back to the season
      </Link>
    </div>
  );
}
