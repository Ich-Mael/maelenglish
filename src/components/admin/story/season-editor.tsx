"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Copy, Download, Eye, Loader2, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { btn, inputCls, Pill } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/image-field";
import type { Voice } from "@/lib/ai/types";
import type { AvatarConfig, Character, Location, Scene } from "@/lib/story/schema";
import { DEFAULT_AVATAR } from "@/lib/story/avatar-defaults";
import { MINUTES_PER_EPISODE, suggestedPriceFcfa } from "@/lib/story/pricing";
import { Avatar } from "@/components/story/avatar";
import { AvatarBuilder } from "@/components/story/avatar-builder";
import { PLACE_ICONS } from "@/components/story/city-map";
import { copyCharactersAction, createEpisodeAction, deleteEpisodeAction, deleteSeasonAction, duplicateEpisodeAction, reorderEpisodesAction, saveSeasonAction, setSeasonStatusAction } from "@/app/admin/story/actions";
import { Area, Num, Pick, SceneEditor, Text, VoiceSelect, slugId } from "./fields";
import { cn } from "cn";

/*
 * Admin → Story Mode → a season (English UI): Overview, Cast, Places & map, Episodes, Pricing &
 * access. Each tab saves on its own; the problems that block publishing are shown at the top.
 */

type Chapter = { id: string; order: number; title: string; summary_fr: string };
type Info = { title: string; learningGoal: string; level: string; description: string; coverMediaId: string | null; lengthWeeks: number; city: string; country: string; nextSeasonHookFr: string; recapScene: Scene; order: number };
type Sale = { freeEpisodes: number; aiMinutesIncluded: number; priceFcfa: number | null; marginPct: number | null };
export type EpisodeRow = { id: string; slug: string; title: string; chapterId: string; status: "draft" | "ready"; problems: number };
export type SeasonEditorProps = {
  seasonId: string;
  slug: string;
  status: "draft" | "published";
  canManage: boolean;
  info: Info;
  coverUrl: string | null;
  characters: Character[];
  locations: Location[];
  chapters: Chapter[];
  sale: Sale;
  estimate: { costPerMin: number; costSource: string; usdToFcfa: number; defaultMarginPct: number; voicingUsd: number };
  problems: string[];
  episodes: EpisodeRow[];
  voices: Voice[];
  otherSeasons: { id: string; title: string }[];
  learners: number;
  withProgress: number;
};

const TABS = [
  ["overview", "Overview"],
  ["cast", "Cast"],
  ["places", "Places & map"],
  ["episodes", "Chapters & episodes"],
  ["pricing", "Pricing & access"],
] as const;
type Tab = (typeof TABS)[number][0];

function SaveBar({ onSave, pending, message }: { onSave: () => void; pending: boolean; message: { ok: boolean; text: string } | null }) {
  return (
    <div className="sticky bottom-3 z-10 mt-2 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-lg">
      {message ? <p className={cn("mr-auto text-sm", message.ok ? "text-success" : "text-destructive")} role="status">{message.text}</p> : null}
      <button type="button" className={btn.primary} onClick={onSave} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null} Save
      </button>
    </div>
  );
}

export function SeasonEditor(p: SeasonEditorProps) {
  const [tab, setTab] = useState<Tab>("overview");
  const [info, setInfo] = useState(p.info);
  const [coverUrl, setCoverUrl] = useState(p.coverUrl);
  const [characters, setCharacters] = useState(p.characters);
  const [locations, setLocations] = useState(p.locations);
  const [chapters, setChapters] = useState(p.chapters);
  const [sale, setSale] = useState(p.sale);
  const [problems, setProblems] = useState(p.problems);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<string | null>(p.locations[0]?.id ?? null);
  const [episodes, setEpisodes] = useState(p.episodes);
  const [newEp, setNewEp] = useState({ title: "", chapterId: p.chapters.at(-1)?.id ?? "" });
  const [copyFrom, setCopyFrom] = useState(p.otherSeasons[0]?.id ?? "");

  const save = (section: "info" | "cast" | "sale", data: unknown) =>
    start(async () => {
      setMessage(null);
      const r = await saveSeasonAction(p.seasonId, section, data);
      if (!r.ok) return setMessage({ ok: false, text: r.error });
      setProblems(r.problems);
      setMessage({ ok: true, text: r.problems.length && p.status === "published" ? "Saved — the season went back to draft: fix the problems above." : "Saved." });
    });
  const saveCast = () => save("cast", { characters, locations, chapters });
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, ok = "Done.") =>
    start(async () => {
      setMessage(null);
      const r = await fn();
      setMessage(r.ok ? { ok: true, text: ok } : { ok: false, text: r.error ?? "Error." });
    });

  const moveEpisode = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= episodes.length) return;
    const next = [...episodes];
    [next[i], next[j]] = [next[j], next[i]];
    // Moving across a chapter boundary takes the neighbour's chapter.
    next[j] = { ...next[j], chapterId: episodes[j].chapterId };
    setEpisodes(next);
    act(() => reorderEpisodesAction(p.seasonId, next.map((e) => ({ id: e.id, chapterId: e.chapterId }))), "Order saved.");
  };
  const setEpisodeChapter = (i: number, chapterId: string) => {
    const moved = { ...episodes[i], chapterId };
    const rest = episodes.filter((_, k) => k !== i);
    const order = chapters.map((c) => c.id);
    const at = rest.findIndex((e) => order.indexOf(e.chapterId) > order.indexOf(chapterId));
    const next = at < 0 ? [...rest, moved] : [...rest.slice(0, at), moved, ...rest.slice(at)];
    setEpisodes(next);
    act(() => reorderEpisodesAction(p.seasonId, next.map((e) => ({ id: e.id, chapterId: e.chapterId }))), "Chapter changed.");
  };

  const typicalMinutes = Math.round(episodes.length * MINUTES_PER_EPISODE);
  const margin = sale.marginPct ?? p.estimate.defaultMarginPct;
  const aiCost = sale.aiMinutesIncluded * p.estimate.costPerMin;
  const suggested = suggestedPriceFcfa(sale.aiMinutesIncluded, p.estimate.costPerMin, margin, p.estimate.usdToFcfa);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={p.status === "published" ? "green" : "grey"}>{p.status === "published" ? "Published" : "Draft"}</Pill>
        <span className="text-sm text-muted-foreground">
          /histoire/{p.slug} · {episodes.filter((e) => e.status === "ready").length} / {episodes.length} episodes ready · {p.learners} learner{p.learners === 1 ? "" : "s"} with access
        </span>
        <span className="ml-auto flex flex-wrap gap-2">
          <a className={btn.secondary} href={`/admin/story/${p.seasonId}/export`}>
            <Download className="size-4" /> Export JSON
          </a>
          {p.canManage ? (
            p.status === "published" ? (
              <button type="button" className={btn.secondary} disabled={pending} onClick={() => act(() => setSeasonStatusAction(p.seasonId, "draft"), "Unpublished.")}>
                Unpublish
              </button>
            ) : (
              <button type="button" className={btn.primary} disabled={pending || problems.length > 0} onClick={() => act(() => setSeasonStatusAction(p.seasonId, "published"), "Published: learners can see it.")} title={problems.length ? "Fix the problems first" : undefined}>
                Publish
              </button>
            )
          ) : null}
        </span>
      </div>

      {problems.length ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Before publishing:</p>
          <ul className="mt-1 list-disc pl-5">
            {problems.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <nav className="flex flex-wrap gap-1 border-b border-border" aria-label="Season sections">
        {TABS.filter(([k]) => k !== "pricing" || p.canManage).map(([k, label]) => (
          <button key={k} type="button" onClick={() => (setTab(k), setMessage(null))} aria-current={tab === k ? "page" : undefined} className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-semibold", tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {label}
          </button>
        ))}
      </nav>

      {tab === "overview" ? (
        <section className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Text label="Title" value={info.title} onChange={(v) => setInfo({ ...info, title: v })} hint="e.g. « Season 1 — The Arrival »" />
            <Text label="Level" value={info.level} onChange={(v) => setInfo({ ...info, level: v })} hint="CEFR range, e.g. A1–A2" />
            <Text label="Learning goal (French)" lang="fr" value={info.learningGoal} onChange={(v) => setInfo({ ...info, learningGoal: v })} hint="The season's promise, shown everywhere: « Je me débrouille au quotidien en anglais »" className="sm:col-span-2" />
            <Text label="City" value={info.city} onChange={(v) => setInfo({ ...info, city: v })} />
            <Text label="Country" value={info.country} onChange={(v) => setInfo({ ...info, country: v })} />
            <Num label="Length (weeks)" value={info.lengthWeeks} min={1} max={52} onChange={(v) => setInfo({ ...info, lengthWeeks: v ?? 8 })} />
            <Num label="Order in the catalogue" value={info.order} min={0} onChange={(v) => setInfo({ ...info, order: v ?? 0 })} />
          </div>
          <Area label="Description for learners (French)" lang="fr" rows={4} value={info.description.replace(/<[^>]+>/g, "")} onChange={(v) => setInfo({ ...info, description: v })} />
          <div className="grid gap-1 text-sm">
            <span className="font-medium">Cover picture</span>
            <ImageField value={info.coverMediaId ?? ""} url={coverUrl} onChange={(id, url) => (setInfo({ ...info, coverMediaId: id || null }), setCoverUrl(url))} noun="cover" />
          </div>
          <Area label="Hook to the next season (French)" lang="fr" rows={2} value={info.nextSeasonHookFr} onChange={(v) => setInfo({ ...info, nextSeasonHookFr: v })} hint="Shown at the end of the season, e.g. « Mr. Mensah vous propose un poste… »" />
          <SceneEditor label="« Previously… » recap (for learners who start with this season; optional)" scene={info.recapScene} onChange={(s) => setInfo({ ...info, recapScene: s })} cast={characters} />
          <SaveBar pending={pending} message={message} onSave={() => save("info", info)} />
          {p.canManage ? (
            <div className="rounded-2xl border border-destructive/20 p-4">
              <p className="text-sm font-semibold">Delete this season</p>
              <p className="text-sm text-muted-foreground">Only while nobody has played it ({p.withProgress} learner{p.withProgress === 1 ? "" : "s"} with progress).</p>
              <button type="button" className={cn(btn.danger, "mt-2")} disabled={pending || p.withProgress > 0} onClick={() => confirm("Delete this season and all its episodes?") && act(() => deleteSeasonAction(p.seasonId))}>
                <Trash2 className="size-4" /> Delete the season
              </button>
            </div>
          ) : null}
        </section>
      ) : tab === "cast" ? (
        <section className="grid gap-4">
          <p className="text-sm text-muted-foreground">The narrator voices the narration and listening activities; the other characters speak English in scenes and conversations, each with their own voice. Personality and speaking style shape how the AI plays them.</p>
          <ul className="grid gap-3">
            {characters.map((c, i) => {
              const set = (patch: Partial<Character>) => setCharacters((xs) => xs.map((x, k) => (k === i ? { ...x, ...patch } : x)));
              const open = editing === `c:${i}`;
              return (
                <li key={i} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <Avatar config={c.avatar} size={52} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {c.name || "New character"} <span className="text-xs text-muted-foreground">· {c.id}</span>
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {c.role} {c.voice_name ? `· voice ${c.voice_name}` : ""}
                      </p>
                    </div>
                    <button type="button" className={btn.icon} onClick={() => setEditing(open ? null : `c:${i}`)} aria-label="Edit">
                      <Pencil className="size-4" />
                    </button>
                    <button type="button" className={btn.icon} disabled={c.id === "narrator"} onClick={() => setCharacters((xs) => xs.filter((_, k) => k !== i))} aria-label="Delete">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  {open ? (
                    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
                      <div className="grid content-start gap-3 sm:grid-cols-2">
                        <Text label="Name" value={c.name} onChange={(v) => set({ name: v })} />
                        <Text label="Id (in episodes)" value={c.id} onChange={(v) => set({ id: v.toLowerCase().replace(/[^a-z0-9-_]/g, "") })} hint="Changing it breaks the episodes that use it." />
                        <Text label="Role (English)" lang="en" value={c.role} onChange={(v) => set({ role: v })} hint="e.g. « Your neighbour, a nurse at the city hospital »" className="sm:col-span-2" />
                        <Text label="Personality (English)" lang="en" value={c.personality} onChange={(v) => set({ personality: v })} className="sm:col-span-2" />
                        <Text label="Speaking style (English)" lang="en" value={c.speaking_style} onChange={(v) => set({ speaking_style: v })} className="sm:col-span-2" />
                        <div className="sm:col-span-2">
                          <VoiceSelect voices={p.voices} value={c.voice_id} name={c.voice_name} onChange={(id, name) => set({ voice_id: id, voice_name: name })} />
                        </div>
                      </div>
                      <div className="rounded-2xl bg-muted/40 p-3">
                        <div className="mb-3 flex justify-center">
                          <Avatar config={c.avatar} size={120} />
                        </div>
                        <AvatarBuilder value={c.avatar as AvatarConfig} onChange={(a) => set({ avatar: a })} />
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-end gap-2">
            <button
              type="button"
              className={btn.secondary}
              onClick={() => {
                const id = slugId("character", characters.map((c) => c.id), "c");
                setCharacters((xs) => [...xs, { id, name: "", role: "", personality: "", speaking_style: "", voice_id: "", voice_name: "", avatar: DEFAULT_AVATAR }]);
                setEditing(`c:${characters.length}`);
              }}
            >
              <UserRound className="size-4" /> Add a character
            </button>
            {p.otherSeasons.length ? (
              <span className="flex items-end gap-2">
                <select className={cn(inputCls, "w-56")} value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} aria-label="Season to copy from">
                  {p.otherSeasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
                <button type="button" className={btn.secondary} disabled={pending} onClick={() => act(async () => { const r = await copyCharactersAction(p.seasonId, copyFrom); if (r.ok) location.reload(); return r; }, "Characters copied.")}>
                  <Copy className="size-4" /> Copy its characters
                </button>
              </span>
            ) : null}
          </div>
          <SaveBar pending={pending} message={message} onSave={saveCast} />
        </section>
      ) : tab === "places" ? (
        <section className="grid gap-4">
          <p className="text-sm text-muted-foreground">Places appear as pins on the learner&apos;s map of {info.city || "the city"}. Select a place, then click on the map to move its pin.</p>
          <div
            role="presentation"
            className="relative aspect-[16/9] w-full cursor-crosshair overflow-clip rounded-2xl bg-[#f3efe4] ring-1 ring-border"
            onClick={(e) => {
              if (!selectedPlace) return;
              const r = e.currentTarget.getBoundingClientRect();
              const x = Math.round(((e.clientX - r.left) / r.width) * 100) / 100;
              const y = Math.round(((e.clientY - r.top) / r.height) * 100) / 100;
              setLocations((ls) => ls.map((l) => (l.id === selectedPlace ? { ...l, map_position: { x: Math.min(0.97, Math.max(0.03, x)), y: Math.min(0.95, Math.max(0.05, y)) } } : l)));
            }}
          >
            <svg viewBox="0 0 160 90" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full" aria-hidden>
              <path d="M0 74 C30 70 50 80 80 76 S130 70 160 78 V90 H0z" fill="#bcd6f2" />
              <path d="M130 14 C110 26 96 34 80 50 S50 66 20 66" stroke="#fff" strokeWidth="3" fill="none" />
              <path d="M10 40 H150" stroke="#fff" strokeWidth="1.4" />
            </svg>
            {locations.map((l) => {
              const Icon = PLACE_ICONS[l.icon] ?? PLACE_ICONS.MapPin;
              return (
                <span key={l.id} className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5" style={{ left: `${l.map_position.x * 100}%`, top: `${l.map_position.y * 100}%` }}>
                  <span className={cn("flex size-9 items-center justify-center rounded-full shadow", l.id === selectedPlace ? "border-[3px] border-coral bg-white text-coral" : "bg-primary text-white")}>
                    <Icon className="size-4" />
                  </span>
                  <span className="rounded-full bg-white/90 px-1.5 text-[10px] font-bold text-brand-deep">{l.name}</span>
                </span>
              );
            })}
          </div>
          <ul className="grid gap-2">
            {locations.map((l, i) => {
              const set = (patch: Partial<Location>) => setLocations((xs) => xs.map((x, k) => (k === i ? { ...x, ...patch } : x)));
              return (
                <li key={i} className={cn("grid items-end gap-2 rounded-xl border bg-card p-3 sm:grid-cols-[auto_1fr_1fr_180px_auto]", l.id === selectedPlace ? "border-coral" : "border-border")}>
                  <button type="button" className={btn.secondary} onClick={() => setSelectedPlace(l.id)} aria-pressed={l.id === selectedPlace}>
                    {l.id === selectedPlace ? "Placing" : "Place"}
                  </button>
                  <Text label="Name (English)" lang="en" value={l.name} onChange={(v) => set({ name: v })} />
                  <Text label="Id" value={l.id} onChange={(v) => set({ id: v.toLowerCase().replace(/[^a-z0-9-_]/g, "") })} />
                  <Pick label="Icon" value={l.icon} onChange={(v) => set({ icon: v })} options={Object.keys(PLACE_ICONS).map((k) => ({ value: k, label: k }))} />
                  <button type="button" className={btn.icon} onClick={() => setLocations((xs) => xs.filter((_, k) => k !== i))} aria-label="Delete place">
                    <Trash2 className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className={cn(btn.secondary, "w-fit")}
            onClick={() => {
              const id = slugId("place", locations.map((l) => l.id), "p");
              setLocations((xs) => [...xs, { id, name: "", name_fr: "", icon: "MapPin", map_position: { x: 0.5, y: 0.5 } }]);
              setSelectedPlace(id);
            }}
          >
            <Plus className="size-4" /> Add a place
          </button>
          <SaveBar pending={pending} message={message} onSave={saveCast} />
        </section>
      ) : tab === "episodes" ? (
        <section className="grid gap-5">
          <div className="grid gap-2">
            <p className="text-sm font-semibold">Chapters</p>
            {chapters.map((c, i) => (
              <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_2fr_auto]">
                <Text label={`Chapter ${i + 1} · title`} value={c.title} onChange={(v) => setChapters((xs) => xs.map((x, k) => (k === i ? { ...x, title: v } : x)))} />
                <Text label="Summary (French)" lang="fr" value={c.summary_fr} onChange={(v) => setChapters((xs) => xs.map((x, k) => (k === i ? { ...x, summary_fr: v } : x)))} />
                <button type="button" className={btn.icon} disabled={chapters.length <= 1 || episodes.some((e) => e.chapterId === c.id)} onClick={() => setChapters((xs) => xs.filter((_, k) => k !== i))} aria-label="Delete chapter" title="Only empty chapters can be deleted">
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btn.secondary} onClick={() => setChapters((xs) => [...xs, { id: slugId(`ch${xs.length + 1}`, xs.map((x) => x.id), "ch"), order: xs.length + 1, title: `Chapter ${xs.length + 1}`, summary_fr: "" }])}>
                <Plus className="size-4" /> Add a chapter
              </button>
              <button type="button" className={btn.primary} disabled={pending} onClick={saveCast}>
                Save chapters
              </button>
              {message ? <span className={cn("self-center text-sm", message.ok ? "text-success" : "text-destructive")}>{message.text}</span> : null}
            </div>
          </div>

          {chapters.map((c) => (
            <div key={c.id} className="grid gap-2">
              <p className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
                Chapter {c.order} · {c.title}
              </p>
              <ol className="grid gap-2">
                {episodes.map((e, i) =>
                  e.chapterId !== c.id ? null : (
                    <li key={e.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-sm font-bold text-primary">{i + 1}</span>
                      <Link href={`/admin/story/${p.seasonId}/episodes/${e.id}`} className="min-w-0 flex-1 font-semibold hover:text-primary">
                        {e.title} <span className="text-xs font-normal text-muted-foreground">· {e.slug}</span>
                      </Link>
                      {e.status === "ready" ? <Pill tone="green">Ready</Pill> : <Pill>{e.problems ? `Draft · ${e.problems} to fix` : "Draft"}</Pill>}
                      <select className={cn(inputCls, "h-8 w-36")} value={e.chapterId} onChange={(ev) => setEpisodeChapter(i, ev.target.value)} aria-label="Chapter">
                        {chapters.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.title}
                          </option>
                        ))}
                      </select>
                      <button type="button" className={btn.icon} disabled={i === 0 || pending} onClick={() => moveEpisode(i, -1)} aria-label="Move up">
                        <ArrowUp className="size-4" />
                      </button>
                      <button type="button" className={btn.icon} disabled={i === episodes.length - 1 || pending} onClick={() => moveEpisode(i, 1)} aria-label="Move down">
                        <ArrowDown className="size-4" />
                      </button>
                      <a className={btn.icon} href={`/histoire/${p.slug}/${e.slug}`} target="_blank" rel="noopener" aria-label="Preview as a learner" title="Preview as a learner">
                        <Eye className="size-4" />
                      </a>
                      <button type="button" className={btn.icon} disabled={pending} onClick={() => act(async () => { const r = await duplicateEpisodeAction(e.id); if (r.ok) location.reload(); return r; }, "Duplicated.")} aria-label="Duplicate">
                        <Copy className="size-4" />
                      </button>
                      <button type="button" className={btn.icon} disabled={pending} onClick={() => confirm(`Delete « ${e.title} »?`) && act(async () => { const r = await deleteEpisodeAction(e.id); if (r.ok) setEpisodes((xs) => xs.filter((x) => x.id !== e.id)); return r; }, "Deleted.")} aria-label="Delete">
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ),
                )}
                {!episodes.some((e) => e.chapterId === c.id) ? <li className="text-sm text-muted-foreground">No episode yet.</li> : null}
              </ol>
            </div>
          ))}

          <form
            className="grid items-end gap-2 rounded-2xl border border-dashed border-primary/40 p-4 sm:grid-cols-[2fr_1fr_auto]"
            onSubmit={(ev) => {
              ev.preventDefault();
              act(() => createEpisodeAction(p.seasonId, newEp.title, newEp.chapterId));
            }}
          >
            <Text label="New episode · title" value={newEp.title} onChange={(v) => setNewEp({ ...newEp, title: v })} placeholder="e.g. Buying a SIM card" />
            <Pick label="Chapter" value={newEp.chapterId} onChange={(v) => setNewEp({ ...newEp, chapterId: v })} options={chapters.map((c) => ({ value: c.id, label: c.title }))} />
            <button type="submit" className={btn.primary} disabled={pending || !newEp.title.trim()}>
              <Plus className="size-4" /> Create
            </button>
          </form>
        </section>
      ) : (
        <section className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Num label="Conversation minutes included per learner" value={sale.aiMinutesIncluded} min={0} onChange={(v) => setSale({ ...sale, aiMinutesIncluded: v ?? 0 })} hint={`Typical need: ~${typicalMinutes} min for ${episodes.length} episodes (one ≈ 5-min role-play, played ≈ 1.5 times each).`} />
            <Num label="Free preview episodes" value={sale.freeEpisodes} min={0} onChange={(v) => setSale({ ...sale, freeEpisodes: v ?? 0 })} hint="Open to every signed-in learner (0 = none)." />
            <Num label="Margin (%)" value={sale.marginPct} min={0} onChange={(v) => setSale({ ...sale, marginPct: v })} hint={`Empty = default (${p.estimate.defaultMarginPct} %).`} />
            <Num label="Price (FCFA)" value={sale.priceFcfa} min={0} step={500} onChange={(v) => setSale({ ...sale, priceFcfa: v })} hint="Shown to learners. Empty = not on sale yet." />
          </div>
          <div className="grid gap-3 rounded-2xl bg-brand-soft/50 p-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-muted-foreground">Cost of a conversation minute</p>
              <p className="text-lg font-bold text-brand-deep">${p.estimate.costPerMin.toFixed(3)}</p>
              <p className="text-xs text-muted-foreground">{p.estimate.costSource}</p>
            </div>
            <div>
              <p className="text-muted-foreground">AI cost per learner</p>
              <p className="text-lg font-bold text-brand-deep">
                ${aiCost.toFixed(2)} <span className="text-sm font-normal">≈ {Math.round(aiCost * p.estimate.usdToFcfa).toLocaleString("fr-FR")} FCFA</span>
              </p>
              <p className="text-xs text-muted-foreground">if every minute is used</p>
            </div>
            <div>
              <p className="text-muted-foreground">Suggested price</p>
              <p className="text-lg font-bold text-primary">{suggested.toLocaleString("fr-FR")} FCFA</p>
              <button type="button" className="text-xs font-semibold text-primary underline" onClick={() => setSale({ ...sale, priceFcfa: suggested })}>
                Use it
              </button>
            </div>
            <div>
              <p className="text-muted-foreground">Voicing the content (once)</p>
              <p className="text-lg font-bold text-brand-deep">${p.estimate.voicingUsd.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">characters&apos; scene lines — shared by all</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Minutes = the episodes&apos; Talk with Coach Ish calls (not the learner&apos;s monthly minutes). When they&apos;re used up, the learner can&apos;t start the conversation (they can continue the story anyway). Give extra minutes on the learner&apos;s page (Users → the learner → Story Mode).
          </p>
          <SaveBar pending={pending} message={message} onSave={() => save("sale", sale)} />
        </section>
      )}
    </div>
  );
}
