import { Types } from "mongoose";
import * as z from "zod/v4";
import { Activity, Course, EpisodeProgress, Module, Step, StoryEntitlement, StoryEpisode, StorySeason, Unit, type ActivityDoc, type StoryEpisodeDoc, type StorySeasonDoc } from "@/models";
import { cleanContent } from "@/lib/lab/content";
import type { RolePlayContent } from "@/lib/lab/types";
import { STORY_STEP_TYPES } from "./service";
import { normalizeRich } from "@/lib/rich-text";
import { CharacterSchema, EpisodeSchema, LocationSchema, SceneSchema, SeasonChapterSchema, SeasonFileSchema, StoryIdSchema, type Episode, type SeasonFile } from "./schema";
import { episodeOf, getSeason, seasonOf, type LoadedSeason } from "./content";
import { episodeProblems, seasonProblems } from "./checks";
import { DEFAULT_AVATAR } from "./avatar-defaults";

/*
 * Story Mode admin services (framework-free, tests/story-admin.test.ts). Seasons are built in the
 * admin: a season holds its setting, cast, places and chapters; episodes are documents whose
 * `content` always passes EpisodeSchema (new ones start from a template with « TODO » texts, which
 * the checks report). Staff save freely; only `ready` episodes of `published` seasons reach
 * learners. The slug never changes (learner progress is keyed by it).
 */

export class StoryAdminError extends Error {}

const zodMessage = (e: z.ZodError) =>
  e.issues
    .slice(0, 4)
    .map((i) => `${i.path.join(".") || "content"}: ${i.message}`)
    .join(" · ");

function parse<T>(schema: z.ZodType<T>, raw: unknown, what: string): T {
  const r = schema.safeParse(raw);
  if (!r.success) throw new StoryAdminError(`${what} — ${zodMessage(r.error)}`);
  return r.data;
}

const oid = (id: string) => {
  if (!Types.ObjectId.isValid(id)) throw new StoryAdminError("Not found.");
  return new Types.ObjectId(id);
};

async function seasonDoc(id: string) {
  const s = await StorySeason.findById(oid(id));
  if (!s) throw new StoryAdminError("Season not found.");
  return s;
}

/** The season for the admin (drafts included) + its episode documents. */
export async function adminSeason(id: string) {
  const s = await StorySeason.findById(oid(id)).lean<StorySeasonDoc>();
  if (!s) return null;
  const eps = await StoryEpisode.find({ seasonId: s._id }).sort({ order: 1 }).lean<StoryEpisodeDoc[]>();
  const season = seasonOf(s, eps);
  const [learners, withProgress] = await Promise.all([StoryEntitlement.countDocuments({ storyId: s.slug }), EpisodeProgress.distinct("userId", { storyId: s.slug }).then((x) => x.length)]);
  return { doc: s, season, episodes: eps, problems: seasonProblems(season), learners, withProgress };
}

export async function adminSeasonList() {
  const seasons = await StorySeason.find().sort({ order: 1, createdAt: 1 }).lean<StorySeasonDoc[]>();
  const [eps, ents] = await Promise.all([
    // « Ready » = what learners get: marked ready with its unit and role-play picked (see `playable`).
    StoryEpisode.aggregate<{ _id: Types.ObjectId; total: number; ready: number }>([
      { $group: { _id: "$seasonId", total: { $sum: 1 }, ready: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "ready"] }, { $gt: [{ $ifNull: ["$content.unit_id", ""] }, ""] }, { $gt: [{ $ifNull: ["$content.conversation.role_play_id", ""] }, ""] }] }, 1, 0] } } } },
    ]),
    StoryEntitlement.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$storyId", n: { $sum: 1 } } }]),
  ]);
  return seasons.map((s) => {
    const e = eps.find((x) => String(x._id) === String(s._id));
    return { id: String(s._id), slug: s.slug, title: s.title, status: s.status, level: s.level, learningGoal: s.learningGoal, city: s.city, country: s.country, coverMediaId: s.coverMediaId ? String(s.coverMediaId) : null, priceFcfa: s.priceFcfa ?? null, aiMinutesIncluded: s.aiMinutesIncluded, episodes: e?.total ?? 0, ready: e?.ready ?? 0, learners: ents.find((x) => x._id === s.slug)?.n ?? 0 };
  });
}

// ── Seasons ──────────────────────────────────────────────────────────────

const NARRATOR = { id: "narrator", name: "Narrator", role: "Narrator of the story", personality: "warm", speaking_style: "clear and calm", voice_id: "JBFqnCBsd6RMkjVDRZzb", voice_name: "George", avatar: DEFAULT_AVATAR };

export async function createSeason(raw: { slug?: unknown; title?: unknown; city?: unknown; country?: unknown; learningGoal?: unknown; level?: unknown }) {
  const slug = parse(StoryIdSchema, String(raw.slug ?? "").trim().toLowerCase(), "Short name (URL)");
  const title = String(raw.title ?? "").trim().slice(0, 120);
  if (!title) throw new StoryAdminError("Give the season a title.");
  if (slug === "personnage") throw new StoryAdminError("« personnage » is reserved: choose another short name.");
  if (await StorySeason.exists({ slug })) throw new StoryAdminError(`A season already uses « ${slug} ».`);
  const order = (await StorySeason.countDocuments()) + 1;
  const s = await StorySeason.create({
    slug,
    title,
    city: String(raw.city ?? "").trim().slice(0, 80),
    country: String(raw.country ?? "").trim().slice(0, 80),
    learningGoal: String(raw.learningGoal ?? "").trim().slice(0, 200),
    level: String(raw.level ?? "A1–A2").trim().slice(0, 20) || "A1–A2",
    order,
    characters: [NARRATOR],
    chapters: [{ id: "ch01", order: 1, title: "Chapter 1", summary_fr: "" }],
  });
  return String(s._id);
}

const SeasonInfoSchema = z.object({
  title: z.string().trim().min(1, "Give the season a title.").max(120),
  learningGoal: z.string().trim().max(200).default(""),
  level: z.string().trim().max(20).default(""),
  description: z.string().default(""),
  coverMediaId: z.string().nullable().default(null),
  lengthWeeks: z.number().int().min(1).max(52).default(8),
  city: z.string().trim().max(80).default(""),
  country: z.string().trim().max(80).default(""),
  nextSeasonHookFr: z.string().max(400).default(""),
  recapScene: SceneSchema.default({ lines: [] }),
  order: z.number().int().min(0).default(0),
});
const SeasonCastSchema = z.object({ characters: z.array(CharacterSchema).max(40), locations: z.array(LocationSchema).max(40), chapters: z.array(SeasonChapterSchema).min(1, "Keep at least one chapter.").max(30) });
const SeasonSaleSchema = z.object({ freeEpisodes: z.number().int().min(0).max(50), aiMinutesIncluded: z.number().min(0).max(10_000), priceFcfa: z.number().int().min(0).nullable(), marginPct: z.number().min(0).max(5000).nullable() });

export type SeasonSection = "info" | "cast" | "sale";

/** Saves one part of a season (the season page's tabs). Returns the problems that block publishing. */
export async function saveSeason(id: string, section: SeasonSection, raw: unknown) {
  const s = await seasonDoc(id);
  if (section === "info") {
    const d = parse(SeasonInfoSchema, raw, "Season");
    if (d.coverMediaId && !Types.ObjectId.isValid(d.coverMediaId)) throw new StoryAdminError("Invalid cover picture.");
    s.set({ ...d, description: normalizeRich(d.description), coverMediaId: d.coverMediaId ? new Types.ObjectId(d.coverMediaId) : null });
  } else if (section === "cast") {
    const d = parse(SeasonCastSchema, raw, "Cast, places and chapters");
    for (const [what, xs] of [["character", d.characters.map((c) => c.id)], ["place", d.locations.map((l) => l.id)], ["chapter", d.chapters.map((c) => c.id)]] as const) {
      const dup = xs.find((x, i) => xs.indexOf(x) !== i);
      if (dup) throw new StoryAdminError(`Two ${what}s have the id « ${dup} ».`);
    }
    const used = await StoryEpisode.find({ seasonId: s._id }).select("chapterId").lean();
    const gone = used.find((e) => !d.chapters.some((c) => c.id === e.chapterId));
    if (gone) throw new StoryAdminError(`Chapter « ${gone.chapterId} » still has episodes: move them first.`);
    s.set({ characters: d.characters, locations: d.locations, chapters: d.chapters.map((c, i) => ({ ...c, order: i + 1 })) });
  } else {
    const d = parse(SeasonSaleSchema, raw, "Pricing and access");
    s.set(d);
  }
  await s.save();
  const a = await adminSeason(id);
  // A published season that no longer passes the checks goes back to draft (learners never get a broken season).
  if (a && a.doc.status === "published" && a.problems.length) await StorySeason.updateOne({ _id: s._id }, { $set: { status: "draft" } });
  return a?.problems ?? [];
}

export async function setSeasonStatus(id: string, status: "draft" | "published") {
  const a = await adminSeason(id);
  if (!a) throw new StoryAdminError("Season not found.");
  if (status === "published" && a.problems.length) throw new StoryAdminError(`Fix these first: ${a.problems.join(" · ")}`);
  await StorySeason.updateOne({ _id: a.doc._id }, { $set: { status } });
}

export async function deleteSeason(id: string) {
  const s = await seasonDoc(id);
  if (await EpisodeProgress.exists({ storyId: s.slug })) throw new StoryAdminError("Learners have played this season: unpublish it instead.");
  await StoryEpisode.deleteMany({ seasonId: s._id });
  await StoryEntitlement.deleteMany({ storyId: s.slug });
  await s.deleteOne();
}

/** Adds the characters of another season that this one doesn't have yet (same id = skipped). */
export async function copyCharacters(targetId: string, sourceId: string) {
  const [t, src] = await Promise.all([seasonDoc(targetId), seasonDoc(sourceId)]);
  const have = new Set((t.characters as { id: string }[]).map((c) => c.id));
  const add = (src.characters as { id: string }[]).filter((c) => !have.has(c.id));
  t.set({ characters: [...(t.characters as object[]), ...add] });
  await t.save();
  return add.length;
}

// ── Import / export ──────────────────────────────────────────────────────

export function exportSeasonFile(season: LoadedSeason, docs: Pick<StoryEpisodeDoc, "slug" | "order" | "status" | "chapterId" | "content">[], extra: { description: string }): SeasonFile {
  return {
    format: "maelenglish-story-season",
    slug: season.id,
    title: season.title,
    learning_goal_fr: season.promise_fr,
    level: season.level,
    description: extra.description,
    length_weeks: season.lengthWeeks,
    city: season.city.name,
    country: season.city.country,
    free_episodes: season.free_episodes,
    ai_minutes_included: season.aiMinutesIncluded,
    price_fcfa: season.priceFcfa,
    next_season_hook_fr: season.next_story_hook_fr,
    recap_scene: season.recap_scene,
    characters: season.characters,
    locations: season.locations,
    chapters: season.chapterList.map((c) => ({ id: c.id, order: c.order, title: c.title, summary_fr: c.summary_fr })),
    episodes: [...docs]
      .sort((a, b) => a.order - b.order)
      .flatMap((d) => {
        const e = episodeOf(d);
        return e ? [{ ...e, chapter: d.chapterId, status: d.status as "draft" | "ready" }] : [];
      }),
  };
}

export async function exportSeason(id: string) {
  const a = await adminSeason(id);
  if (!a) throw new StoryAdminError("Season not found.");
  return exportSeasonFile(a.season, a.episodes, { description: a.doc.description ?? "" });
}

/**
 * Imports a season file. A new slug creates a draft season; an existing one is updated only with
 * `replace` (season fields, cast, places, chapters; episodes upserted by id, learner progress kept).
 */
export async function importSeason(raw: unknown, opts: { replace?: boolean; actorId?: string | null } = {}) {
  const f = parse(SeasonFileSchema, raw, "Season file");
  const chapterIds = new Set(f.chapters.map((c) => c.id));
  const bad = f.episodes.find((e) => !chapterIds.has(e.chapter));
  if (bad) throw new StoryAdminError(`Episode « ${bad.id} »: unknown chapter « ${bad.chapter} ».`);
  const fields = {
    title: f.title,
    learningGoal: f.learning_goal_fr,
    level: f.level,
    description: normalizeRich(f.description),
    lengthWeeks: f.length_weeks,
    city: f.city,
    country: f.country,
    freeEpisodes: f.free_episodes,
    aiMinutesIncluded: f.ai_minutes_included,
    priceFcfa: f.price_fcfa,
    nextSeasonHookFr: f.next_season_hook_fr,
    recapScene: f.recap_scene,
    characters: f.characters,
    locations: f.locations,
    chapters: f.chapters,
  };
  let s = await StorySeason.findOne({ slug: f.slug });
  if (s && !opts.replace) throw new StoryAdminError(`A season already uses « ${f.slug} »: tick « Replace » to update it.`);
  if (s) s.set(fields);
  else s = new StorySeason({ slug: f.slug, ...fields, status: "draft", order: (await StorySeason.countDocuments()) + 1 });
  await s.save();
  let order = 0;
  for (const e of f.episodes) {
    const { id, order: _o, chapter, status, role_play_draft: draft, ...content } = e;
    void _o;
    // A role-play written in the file becomes a Lab activity (draft), linked to the episode.
    if (!content.conversation.role_play_id && draft) {
      const a = await Activity.create({ type: "role_play", title: draft.title, level: draft.level, tags: ["story"], status: "draft", content: cleanContent("role_play", draft.content), createdBy: opts.actorId ?? null, updatedBy: opts.actorId ?? null });
      content.conversation = { ...content.conversation, role_play_id: String(a._id) };
    }
    // An episode can only be « ready » once its unit and role-play are picked and pass the checks.
    const ready = status === "ready" && !!content.unit_id && !!content.conversation.role_play_id;
    await StoryEpisode.updateOne({ seasonId: s._id, slug: id }, { $set: { chapterId: chapter, order: ++order, status: ready ? "ready" : "draft", content } }, { upsert: true });
  }
  return { id: String(s._id), episodes: f.episodes.length };
}

// ── Episodes ─────────────────────────────────────────────────────────────

/** A new episode: valid against EpisodeSchema; the unit and the role-play are picked afterwards (the checks say so). */
export function episodeTemplate(season: Pick<LoadedSeason, "characters" | "locations">, title: string): Omit<Episode, "id" | "order"> {
  const npc = season.characters.find((c) => c.id !== "narrator")?.id ?? "";
  return {
    title,
    location_id: season.locations[0]?.id ?? "",
    characters: npc ? [npc] : [],
    estimated_minutes: 30,
    objectives: [],
    situation: "",
    day_increment: 1,
    intro_scene: { lines: [{ speaker: "narrator", text_fr: "" }] },
    intro_media: { video_url: "", audio_media_id: "" },
    background_media_id: "",
    video: { provider: "placeholder", url: "", duration_seconds: 0, transcript_en: "", completion_threshold: 0.9 },
    unit_id: "",
    conversation: { npc, role_play_id: "", pass_score: 60 },
    outro_scene: { lines: [] },
    next_episode_teaser_fr: "",
  };
}

async function renumber(seasonId: Types.ObjectId) {
  const eps = await StoryEpisode.find({ seasonId }).sort({ order: 1, createdAt: 1 }).select("_id").lean();
  await Promise.all(eps.map((e, i) => StoryEpisode.updateOne({ _id: e._id }, { $set: { order: i + 1 } })));
}

export async function createEpisode(seasonId: string, raw: { title?: unknown; chapterId?: unknown; slug?: unknown }) {
  const s = await seasonDoc(seasonId);
  const loaded = seasonOf(s.toObject() as StorySeasonDoc, []);
  const title = String(raw.title ?? "").trim().slice(0, 120);
  if (!title) throw new StoryAdminError("Give the episode a title.");
  const chapterId = String(raw.chapterId ?? "") || loaded.chapterList.at(-1)?.id || "";
  if (!loaded.chapterList.some((c) => c.id === chapterId)) throw new StoryAdminError("Choose a chapter.");
  const count = await StoryEpisode.countDocuments({ seasonId: s._id });
  let slug = String(raw.slug ?? "").trim().toLowerCase() || `ep${String(count + 1).padStart(2, "0")}-${title.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30)}`;
  slug = parse(StoryIdSchema, slug, "Episode id");
  if (await StoryEpisode.exists({ seasonId: s._id, slug })) throw new StoryAdminError(`An episode already uses « ${slug} ».`);
  // After the last episode of its chapter.
  const chapters = loaded.chapterList.map((c) => c.id);
  const eps = await StoryEpisode.find({ seasonId: s._id }).select("chapterId order").lean();
  const after = eps.filter((e) => chapters.indexOf(e.chapterId) <= chapters.indexOf(chapterId)).reduce((m, e) => Math.max(m, e.order), 0);
  await StoryEpisode.updateMany({ seasonId: s._id, order: { $gt: after } }, { $inc: { order: 1 } });
  const doc = await StoryEpisode.create({ seasonId: s._id, slug, chapterId, order: after + 1, status: "draft", content: episodeTemplate(loaded, title) });
  return String(doc._id);
}

/** What the checks need from the database: playable steps of the picked unit, and the role-play's status. */
export async function episodeRefs(episode: Pick<Episode, "unit_id" | "conversation">) {
  let unitSteps: number | null = null;
  if (episode.unit_id) {
    const steps = await Step.find({ unitId: episode.unit_id, kind: { $in: ["lesson", "activity"] } }).select("kind activityId").lean();
    const acts = await Activity.find({ _id: { $in: steps.flatMap((x) => (x.activityId ? [x.activityId] : [])) }, status: "ready", type: { $in: [...STORY_STEP_TYPES] } }).select("_id").lean();
    unitSteps = steps.filter((x) => x.kind === "lesson" || acts.some((a) => String(a._id) === String(x.activityId))).length;
  }
  let rolePlay: "ready" | "draft" | "missing" | null = null;
  if (episode.conversation.role_play_id) {
    const a = await Activity.findOne({ _id: episode.conversation.role_play_id, type: "role_play" }).select("status").lean();
    rolePlay = !a ? "missing" : a.status === "ready" ? "ready" : "draft";
  }
  return { unitSteps, rolePlay };
}

export async function adminEpisode(id: string) {
  const e = await StoryEpisode.findById(oid(id)).lean<StoryEpisodeDoc>();
  if (!e) return null;
  const season = await getSeason((await StorySeason.findById(e.seasonId).select("slug").lean())?.slug ?? "", { drafts: true });
  if (!season) return null;
  const episode = episodeOf(e);
  const refs = episode ? await episodeRefs(episode) : null;
  return { doc: e, season, episode, refs, problems: episode ? episodeProblems(season, episode, e.chapterId, refs) : ["The saved content is invalid."] };
}

/** The course units an episode can use (« learn & practise »), labelled « Course › Module › Unit N ». */
export async function unitOptions() {
  const [courses, modules, units] = await Promise.all([Course.find().select("title").sort({ title: 1 }).lean(), Module.find().select("courseId title order").lean(), Unit.find().select("courseId moduleId title order").lean()]);
  const out: { id: string; label: string; course: string }[] = [];
  for (const c of courses)
    for (const m of modules.filter((x) => String(x.courseId) === String(c._id)).sort((a, b) => a.order - b.order))
      for (const u of units.filter((x) => String(x.moduleId) === String(m._id)).sort((a, b) => a.order - b.order)) out.push({ id: String(u._id), label: `${m.title} › Unit ${u.order} · ${u.title}`, course: c.title });
  return out;
}

/** The Lab role-plays an episode can use. */
export async function rolePlayOptions() {
  const xs = await Activity.find({ type: "role_play" }).select("title status level").sort({ updatedAt: -1 }).lean<ActivityDoc[]>();
  return xs.map((a) => ({ id: String(a._id), title: a.title, status: a.status as "draft" | "ready", level: a.level ?? "" }));
}

/**
 * « Create a conversation for this episode »: a Lab role-play (draft) pre-filled from the episode's
 * character and setting, linked to the episode. Staff then finish it in the Lab and mark it ready.
 */
export async function createEpisodeRolePlay(episodeId: string, actorId: string) {
  const a = await adminEpisode(episodeId);
  if (!a || !a.episode) throw new StoryAdminError("Episode not found.");
  const { season, episode } = a;
  const npc = season.characters.find((c) => c.id === episode.conversation.npc && c.id !== "narrator");
  if (!npc) throw new StoryAdminError("Choose the character who plays the role first.");
  const place = season.locations.find((l) => l.id === episode.location_id)?.name ?? "";
  const content: Partial<RolePlayContent> = {
    situation: "",
    aiRole: `${npc.name}, ${npc.role}`,
    learnerRole: "a French-speaking professional who has just arrived in the city",
    setting: [place, season.city.name].filter(Boolean).join(", "),
    goals: [],
    targetPhrases: [],
    twists: [],
    openingLine: "",
    difficulty: 2,
    maxMinutes: 5,
    voiceId: npc.voice_id,
    voiceName: npc.voice_name,
  };
  const act = await Activity.create({ type: "role_play", title: `${episode.title} — ${npc.name}`, level: season.level.split(/[–-]/)[0]?.trim() || "", tags: ["story"], status: "draft", content: cleanContent("role_play", content), createdBy: actorId, updatedBy: actorId });
  const doc = await StoryEpisode.findById(a.doc._id);
  if (doc) {
    doc.content = { ...(doc.content as object), conversation: { ...episode.conversation, role_play_id: String(act._id) } };
    doc.markModified("content");
    await doc.save();
  }
  return String(act._id);
}

/** Saves the whole episode (the editor sends it in one piece). A ready episode with problems goes back to draft. */
export async function saveEpisode(id: string, raw: { content: unknown; chapterId?: unknown }) {
  const e = await StoryEpisode.findById(oid(id));
  if (!e) throw new StoryAdminError("Episode not found.");
  const parsed = parse(EpisodeSchema, { ...(raw.content as object), id: e.slug, order: e.order }, "Episode");
  if (parsed.intro_media.audio_media_id && !Types.ObjectId.isValid(parsed.intro_media.audio_media_id)) throw new StoryAdminError("Invalid intro audio.");
  if (parsed.background_media_id && !Types.ObjectId.isValid(parsed.background_media_id)) throw new StoryAdminError("Invalid background picture.");
  if (parsed.unit_id && !(await Unit.exists({ _id: parsed.unit_id }))) throw new StoryAdminError("This unit no longer exists.");
  const { id: _i, order: _o, ...content } = parsed;
  void _i;
  void _o;
  e.content = content;
  e.markModified("content");
  if (raw.chapterId) e.chapterId = String(raw.chapterId);
  await e.save();
  const a = await adminEpisode(id);
  if (a && a.problems.length && e.status === "ready") await StoryEpisode.updateOne({ _id: e._id }, { $set: { status: "draft" } });
  return a?.problems ?? [];
}

export async function setEpisodeStatus(id: string, status: "draft" | "ready") {
  const a = await adminEpisode(id);
  if (!a) throw new StoryAdminError("Episode not found.");
  if (status === "ready" && a.problems.length) throw new StoryAdminError(`Fix these first: ${a.problems.slice(0, 5).join(" · ")}`);
  await StoryEpisode.updateOne({ _id: a.doc._id }, { $set: { status } });
  // The last ready episode of a published season: the season goes back to draft.
  if (status === "draft" && a.season.status === "published" && !(await StoryEpisode.exists({ seasonId: a.doc.seasonId, status: "ready" }))) await StorySeason.updateOne({ _id: a.doc.seasonId }, { $set: { status: "draft" } });
}

/** New order of a season's episodes (ids in order); each keeps or changes its chapter. */
export async function reorderEpisodes(seasonId: string, items: { id: string; chapterId: string }[]) {
  const s = await seasonDoc(seasonId);
  const chapters = new Set((s.chapters ?? []).map((c) => c.id));
  const eps = await StoryEpisode.find({ seasonId: s._id }).select("_id").lean();
  if (items.length !== eps.length || !eps.every((e) => items.some((i) => i.id === String(e._id)))) throw new StoryAdminError("The list changed: reload the page.");
  if (items.some((i) => !chapters.has(i.chapterId))) throw new StoryAdminError("Unknown chapter.");
  await Promise.all(items.map((it, i) => StoryEpisode.updateOne({ _id: it.id }, { $set: { order: i + 1, chapterId: it.chapterId } })));
}

export async function duplicateEpisode(id: string) {
  const e = await StoryEpisode.findById(oid(id)).lean<StoryEpisodeDoc>();
  if (!e) throw new StoryAdminError("Episode not found.");
  let slug = `${e.slug}-copy`.slice(0, 60);
  for (let i = 2; await StoryEpisode.exists({ seasonId: e.seasonId, slug }); i++) slug = `${e.slug}-copy${i}`.slice(0, 60);
  await StoryEpisode.updateMany({ seasonId: e.seasonId, order: { $gt: e.order } }, { $inc: { order: 1 } });
  const content = { ...(e.content as Record<string, unknown>), title: `${(e.content as { title: string }).title} (copy)` };
  const doc = await StoryEpisode.create({ seasonId: e.seasonId, slug, chapterId: e.chapterId, order: e.order + 1, status: "draft", content });
  return String(doc._id);
}

export async function deleteEpisode(id: string) {
  const e = await StoryEpisode.findById(oid(id));
  if (!e) throw new StoryAdminError("Episode not found.");
  const s = await StorySeason.findById(e.seasonId).select("slug status").lean();
  if (s && (await EpisodeProgress.exists({ storyId: s.slug, episodeId: e.slug, userId: { $exists: true } })) && e.status === "ready") throw new StoryAdminError("Learners have played this episode: set it back to draft instead.");
  await e.deleteOne();
  await renumber(e.seasonId);
}
