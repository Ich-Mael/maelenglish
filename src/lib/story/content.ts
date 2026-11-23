import { Types } from "mongoose";
import { StoryEpisode, StorySeason, type StoryEpisodeDoc, type StorySeasonDoc } from "@/models";
import { CharacterSchema, EpisodeSchema, LocationSchema, SceneSchema, type Character, type Episode, type Location, type Scene } from "./schema";

/*
 * Story Mode content loader (seasons built in the admin, src/models/Story.ts). A season is
 * self-contained: its city, cast, places, chapters and episodes. Learners only get published
 * seasons and ready episodes; staff (`drafts`) see everything. `seasonProblems` = the
 * cross-checks shown live in the admin (references to characters / places / key phrases, answers).
 */

export type LoadedChapter = { id: string; order: number; title: string; summary_fr: string; episodeList: Episode[] };
export type LoadedSeason = {
  _id: string;
  id: string;
  status: "draft" | "published";
  title: string;
  promise_fr: string;
  level: string;
  description: string;
  coverMediaId: string | null;
  lengthWeeks: number;
  city: { name: string; country: string };
  characters: Character[];
  locations: Location[];
  chapterList: LoadedChapter[];
  recap_scene: Scene;
  next_story_hook_fr: string;
  free_episodes: number;
  aiMinutesIncluded: number;
  priceFcfa: number | null;
  marginPct: number | null;
  /** Episode status by id (staff see drafts). */
  episodeStatus: Record<string, "draft" | "ready">;
};

const safeArray = <T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }, xs: unknown[]): T[] =>
  (xs ?? []).flatMap((x) => {
    const r = schema.safeParse(x);
    return r.success ? [r.data as T] : [];
  });

/** An episode document → the Episode used everywhere (id = slug, order = position). */
export function episodeOf(doc: Pick<StoryEpisodeDoc, "slug" | "order" | "content">): Episode | null {
  const r = EpisodeSchema.safeParse({ ...(doc.content as object), id: doc.slug, order: doc.order });
  return r.success ? r.data : null;
}

/** An episode learners can play: marked ready AND with its unit and role-play picked (older imports could be « ready » without them). */
export const playable = (e: Pick<StoryEpisodeDoc, "status" | "content">) => {
  const c = e.content as { unit_id?: string; conversation?: { role_play_id?: string } } | null;
  return e.status === "ready" && !!c?.unit_id && !!c?.conversation?.role_play_id;
};

export function seasonOf(s: StorySeasonDoc, episodes: StoryEpisodeDoc[]): LoadedSeason {
  const chapters = [...(s.chapters ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const sorted = [...episodes].sort((a, b) => a.order - b.order);
  let n = 0;
  const chapterList = chapters.map((c) => ({
    id: c.id ?? "",
    order: c.order ?? 0,
    title: c.title ?? "",
    summary_fr: c.summary_fr ?? "",
    episodeList: sorted.filter((e) => e.chapterId === c.id).flatMap((e) => {
      const ep = episodeOf(e);
      return ep ? [{ ...ep, order: ++n }] : [];
    }),
  }));
  const recap = SceneSchema.safeParse(s.recapScene);
  return {
    _id: String(s._id),
    id: s.slug,
    status: s.status as "draft" | "published",
    title: s.title,
    promise_fr: s.learningGoal ?? "",
    level: s.level ?? "",
    description: s.description ?? "",
    coverMediaId: s.coverMediaId ? String(s.coverMediaId) : null,
    lengthWeeks: s.lengthWeeks ?? 8,
    city: { name: s.city ?? "", country: s.country ?? "" },
    characters: safeArray<Character>(CharacterSchema, s.characters as unknown[]),
    locations: safeArray<Location>(LocationSchema, s.locations as unknown[]),
    chapterList,
    recap_scene: recap.success ? recap.data : { lines: [] },
    next_story_hook_fr: s.nextSeasonHookFr ?? "",
    free_episodes: s.freeEpisodes ?? 0,
    aiMinutesIncluded: s.aiMinutesIncluded ?? 0,
    priceFcfa: s.priceFcfa ?? null,
    marginPct: s.marginPct ?? null,
    episodeStatus: Object.fromEntries(episodes.map((e) => [e.slug, playable(e) ? ("ready" as const) : ("draft" as const)])),
  };
}

/** A season by slug; null when missing or (for learners) not published. Learners only get ready episodes. */
export async function getSeason(slug: string, opts: { drafts?: boolean } = {}): Promise<LoadedSeason | null> {
  const s = await StorySeason.findOne({ slug: String(slug ?? "").toLowerCase() }).lean<StorySeasonDoc>();
  if (!s || (!opts.drafts && s.status !== "published")) return null;
  const eps = await StoryEpisode.find({ seasonId: s._id, ...(opts.drafts ? {} : { status: "ready" }) }).lean<StoryEpisodeDoc[]>();
  return seasonOf(s, opts.drafts ? eps : eps.filter(playable));
}

export async function getSeasonById(id: string, opts: { drafts?: boolean } = { drafts: true }) {
  if (!Types.ObjectId.isValid(id)) return null;
  const s = await StorySeason.findById(id).select("slug").lean();
  return s ? getSeason(s.slug, opts) : null;
}

/** Published seasons in catalogue order (staff: all). Episodes as for `getSeason`. */
export async function listSeasons(opts: { drafts?: boolean } = {}): Promise<LoadedSeason[]> {
  const seasons = await StorySeason.find(opts.drafts ? {} : { status: "published" }).sort({ order: 1, createdAt: 1 }).lean<StorySeasonDoc[]>();
  if (!seasons.length) return [];
  const eps = await StoryEpisode.find({ seasonId: { $in: seasons.map((s) => s._id) }, ...(opts.drafts ? {} : { status: "ready" }) }).lean<StoryEpisodeDoc[]>();
  return seasons.map((s) => seasonOf(s, eps.filter((e) => String(e.seasonId) === String(s._id) && (opts.drafts || playable(e)))));
}

export const storyEpisodes = (s: LoadedSeason) => s.chapterList.flatMap((c) => c.episodeList);

export function findEpisode(season: LoadedSeason, episodeId: string) {
  const all = season.chapterList.flatMap((c) => c.episodeList.map((e) => ({ chapter: c, episode: e })));
  const index = all.findIndex((x) => x.episode.id === episodeId);
  if (index < 0) return null;
  return { story: season, chapter: all[index].chapter, episode: all[index].episode, index, all };
}

export { episodeProblems, seasonProblems } from "./checks";
