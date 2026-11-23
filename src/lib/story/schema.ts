import * as z from "zod/v4";

/*
 * Story Mode content schema (owner spec « Story Mode — Complete Specification », 2026-11-23).
 * Content is built in the admin (StorySeason / StoryEpisode models) and every save is validated
 * here; `SeasonFileSchema` is the JSON import / export format of a whole season. Variables {city},
 * {learner_name}, {learner_job}, {learner_country} are replaced at display time and in prompts.
 */

export const StoryIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-_]{0,60}$/, "ids are lowercase letters, digits, - and _");
const id = StoryIdSchema;

/** Avatar made with the builder (learners and characters share it, so everything matches). */
export const AvatarSchema = z.object({
  face: z.enum(["round", "oval", "square"]).default("oval"),
  skin: z.number().int().min(0).max(7).default(4),
  hair: z.enum(["short", "fade", "afro", "braids", "locs", "bun", "headwrap", "bald", "long"]).default("short"),
  hairColor: z.number().int().min(0).max(5).default(0),
  outfit: z.enum(["shirt", "blazer", "dashiki", "dress", "polo", "uniform"]).default("shirt"),
  outfitColor: z.number().int().min(0).max(7).default(0),
  glasses: z.boolean().default(false),
  beard: z.enum(["none", "short", "full"]).default("none"),
  earrings: z.boolean().default(false),
  bg: z.number().int().min(0).max(5).default(0),
});
export type AvatarConfig = z.infer<typeof AvatarSchema>;

export const CharacterSchema = z.object({
  id,
  name: z.string(),
  role: z.string(),
  personality: z.string(),
  speaking_style: z.string(),
  /** ElevenLabs voice id ("" = default voice). */
  voice_id: z.string().default(""),
  voice_name: z.string().default(""),
  avatar: AvatarSchema,
});

export const LocationSchema = z.object({
  id,
  name: z.string(),
  name_fr: z.string().default(""),
  map_position: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
  icon: z.string().default("MapPin"),
});

const SceneLine = z.object({
  speaker: z.string(),
  text_en: z.string().optional(),
  text_fr: z.string().optional(),
  /** "auto" = the character's voice (TTS, cached); a URL = a recorded audio; absent = no audio. */
  audio: z.string().optional(),
});
export const SceneSchema = z.object({ lines: z.array(SceneLine).default([]) });
export type Scene = z.infer<typeof SceneSchema>;

const objectId = z.string().regex(/^[a-f0-9]{24}$/, "pick an item");

/**
 * An episode (owner decision 2026-11-23): a video of the situation → the lessons and Lab
 * activities of an existing course unit (learn & practise) → a « Talk with Coach Ish » role-play
 * (a Lab « role_play » activity) played by one of the season's characters, whose debrief score
 * proves mastery. `unit_id` / `role_play_id` stay "" in a draft until picked.
 */
export const EpisodeSchema = z.object({
  id,
  order: z.number().int().min(1),
  title: z.string(),
  location_id: z.string().default(""),
  characters: z.array(id).default([]),
  estimated_minutes: z.number().int().min(1).default(30),
  /** « Je sais… » can-do statements (French). */
  objectives: z.array(z.string()).default([]),
  situation: z.string().default(""),
  /** Story days added the first time the episode is finished. */
  day_increment: z.number().int().min(0).default(1),
  intro_scene: SceneSchema.default({ lines: [] }),
  /** Optional background picture of the episode (Media image): behind the episode's header and scenes. */
  background_media_id: z.string().default(""),
  /** Optional media shown in the intro with the goals: a teaser video link and / or an audio (Media id). */
  intro_media: z.object({ video_url: z.string().default(""), audio_media_id: z.string().default("") }).default({ video_url: "", audio_media_id: "" }),
  video: z
    .object({
      provider: z.enum(["placeholder", "file", "youtube", "vimeo"]).default("placeholder"),
      url: z.string().default(""),
      duration_seconds: z.number().min(0).default(0),
      transcript_en: z.string().default(""),
      completion_threshold: z.number().min(0.1).max(1).default(0.9),
    })
    .default({ provider: "placeholder", url: "", duration_seconds: 0, transcript_en: "", completion_threshold: 0.9 }),
  /** The course unit whose lessons and Lab activities are the episode's « learn & practise » part. */
  unit_id: z.union([objectId, z.literal("")]).default(""),
  conversation: z
    .object({
      /** The season character who plays the role (name, voice, avatar, personality). */
      npc: z.string().default(""),
      /** The Lab « AI role-play » activity. */
      role_play_id: z.union([objectId, z.literal("")]).default(""),
      /** Debrief score (0–100) that counts as mastered. */
      pass_score: z.number().int().min(0).max(100).default(60),
    })
    .default({ npc: "", role_play_id: "", pass_score: 60 }),
  outro_scene: SceneSchema.default({ lines: [] }),
  next_episode_teaser_fr: z.string().default(""),
});
export type Episode = z.infer<typeof EpisodeSchema>;
export type Character = z.infer<typeof CharacterSchema>;
export type Location = z.infer<typeof LocationSchema>;

export const SeasonChapterSchema = z.object({ id, order: z.number().int().min(1), title: z.string().min(1), summary_fr: z.string().default("") });

/** A whole season in one JSON file (admin « Import » / « Export »). */
export const SeasonFileSchema = z.object({
  format: z.literal("maelenglish-story-season").default("maelenglish-story-season"),
  slug: id,
  title: z.string().min(1),
  learning_goal_fr: z.string().default(""),
  level: z.string().default("A1–A2"),
  description: z.string().default(""),
  length_weeks: z.number().int().min(1).max(52).default(8),
  city: z.string().default(""),
  country: z.string().default(""),
  free_episodes: z.number().int().min(0).default(0),
  ai_minutes_included: z.number().min(0).default(60),
  price_fcfa: z.number().min(0).nullable().default(null),
  next_season_hook_fr: z.string().default(""),
  recap_scene: SceneSchema.default({ lines: [] }),
  characters: z.array(CharacterSchema).default([]),
  locations: z.array(LocationSchema).default([]),
  chapters: z.array(SeasonChapterSchema).min(1),
  episodes: z
    .array(
      EpisodeSchema.extend({
        chapter: id,
        status: z.enum(["draft", "ready"]).default("draft"),
        /** Import only: a role-play to create in the Lab (as a draft) when `conversation.role_play_id` is empty. */
        role_play_draft: z.object({ title: z.string(), level: z.string().default(""), content: z.record(z.string(), z.unknown()) }).optional(),
      }),
    )
    .default([]),
});
export type SeasonFile = z.infer<typeof SeasonFileSchema>;
