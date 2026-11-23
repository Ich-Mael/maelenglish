import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { defineModel } from "./define";

/*
 * Story Mode (owner spec « Data model », admin-built since 2026-11-23). Content: `StorySeason`
 * (self-contained: city, cast, places, chapters, price, AI minutes) and `StoryEpisode` (its
 * `content` always passes EpisodeSchema — src/lib/story/schema.ts — new episodes start from a
 * template; « ready » also needs no cross-check problem). Learner state is keyed by the season
 * slug (`storyId`). The learner's character, avatar and story day are one per learner
 * (`universeId` "default") and used in every season.
 */

const storySeasonSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, match: /^[a-z0-9][a-z0-9-_]{0,60}$/ },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    /** Order in the learner catalogue. */
    order: { type: Number, default: 0 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    /** The season's learning goal, French (« Je me débrouille au quotidien en anglais »). */
    learningGoal: { type: String, default: "", trim: true, maxlength: 200 },
    level: { type: String, default: "A1–A2", trim: true, maxlength: 20 },
    /** Rich text (normalizeRich). */
    description: { type: String, default: "" },
    coverMediaId: { type: Schema.Types.ObjectId, ref: "Media", default: null },
    lengthWeeks: { type: Number, default: 8, min: 1, max: 52 },
    city: { type: String, default: "", trim: true, maxlength: 80 },
    country: { type: String, default: "", trim: true, maxlength: 80 },
    /** CharacterSchema[] / LocationSchema[] (validated by the service). */
    characters: { type: [Schema.Types.Mixed], default: [] },
    locations: { type: [Schema.Types.Mixed], default: [] },
    chapters: { type: [new Schema({ id: String, order: Number, title: String, summary_fr: { type: String, default: "" } }, { _id: false })], default: [] },
    recapScene: { type: Schema.Types.Mixed, default: { lines: [] } },
    nextSeasonHookFr: { type: String, default: "" },
    /** Episodes open without access (preview), counted from the first. */
    freeEpisodes: { type: Number, default: 0, min: 0 },
    /** Voice minutes included per learner (speaking challenge + spoken conversations). */
    aiMinutesIncluded: { type: Number, default: 60, min: 0 },
    /** FCFA, null = not on sale yet. */
    priceFcfa: { type: Number, default: null, min: 0 },
    marginPct: { type: Number, default: null, min: 0 },
  },
  { timestamps: true },
);
export type StorySeasonDoc = InferSchemaType<typeof storySeasonSchema> & { _id: Types.ObjectId };
export const StorySeason: Model<StorySeasonDoc> = defineModel<StorySeasonDoc>("StorySeason", storySeasonSchema);

const storyEpisodeSchema = new Schema(
  {
    seasonId: { type: Schema.Types.ObjectId, ref: "StorySeason", required: true },
    /** Episode id inside the season (URL). */
    slug: { type: String, required: true, match: /^[a-z0-9][a-z0-9-_]{0,60}$/ },
    chapterId: { type: String, required: true },
    /** Position in the whole season, 1…n (renumbered by the admin services). */
    order: { type: Number, required: true },
    status: { type: String, enum: ["draft", "ready"], default: "draft" },
    /** EpisodeSchema without id / order. */
    content: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);
storyEpisodeSchema.index({ seasonId: 1, slug: 1 }, { unique: true });
storyEpisodeSchema.index({ seasonId: 1, order: 1 });
export type StoryEpisodeDoc = InferSchemaType<typeof storyEpisodeSchema> & { _id: Types.ObjectId };
export const StoryEpisode: Model<StoryEpisodeDoc> = defineModel<StoryEpisodeDoc>("StoryEpisode", storyEpisodeSchema);

const STAGES = ["locked", "available", "completed", "waived", "completed_with_review"] as const;
export type StageState = (typeof STAGES)[number];

const storyProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    universeId: { type: String, required: true },
    characterName: { type: String, required: true, trim: true, maxlength: 40 },
    job: { type: String, default: "", trim: true, maxlength: 80 },
    country: { type: String, default: "Burkina Faso", trim: true, maxlength: 60 },
    /** Avatar builder choices (src/lib/story/schema.ts AvatarSchema). */
    avatar: { type: Schema.Types.Mixed, default: null },
    avatarSource: { type: String, enum: ["builder", "photo"], default: "builder" },
    pacePerWeek: { type: Number, enum: [2, 3, 5], default: 3 },
    storyDay: { type: Number, default: 1, min: 1 },
    /** Reminder preference only (reminders are out of scope in v1). */
    remindersOptIn: { type: Boolean, default: false },
  },
  { timestamps: true },
);
storyProfileSchema.index({ userId: 1, universeId: 1 }, { unique: true });
export type StoryProfileDoc = InferSchemaType<typeof storyProfileSchema> & { _id: Types.ObjectId };
export const StoryProfile: Model<StoryProfileDoc> = defineModel<StoryProfileDoc>("StoryProfile", storyProfileSchema);

/** Access per story (purchase / bundle / subscription / free / staff grant). Payment itself is out of scope. */
const storyEntitlementSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    storyId: { type: String, required: true },
    source: { type: String, enum: ["purchase", "bundle", "subscription", "free", "staff"], default: "staff" },
    startsAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
    grantedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    /** Voice minutes added by staff on top of the season's included minutes. */
    extraMinutes: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);
storyEntitlementSchema.index({ userId: 1, storyId: 1 }, { unique: true });
export type StoryEntitlementDoc = InferSchemaType<typeof storyEntitlementSchema> & { _id: Types.ObjectId };
export const StoryEntitlement: Model<StoryEntitlementDoc> = defineModel<StoryEntitlementDoc>("StoryEntitlement", storyEntitlementSchema);

const storyProgressSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    storyId: { type: String, required: true },
    status: { type: String, enum: ["not_started", "in_progress", "completed"], default: "in_progress" },
    currentEpisodeId: { type: String, default: "" },
    currentStage: { type: String, default: "" },
    recapSeen: { type: Boolean, default: false },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
storyProgressSchema.index({ userId: 1, storyId: 1 }, { unique: true });
export type StoryProgressDoc = InferSchemaType<typeof storyProgressSchema> & { _id: Types.ObjectId };
export const StoryProgress: Model<StoryProgressDoc> = defineModel<StoryProgressDoc>("StoryProgress", storyProgressSchema);

const stage = { type: String, enum: STAGES, default: "locked" };
/** One per learner and episode: video → learn (the unit's lessons and Lab activities) → conversation (a role-play). */
const episodeProgressSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    storyId: { type: String, required: true },
    episodeId: { type: String, required: true },
    status: { type: String, enum: ["in_progress", "completed"], default: "in_progress" },
    stageVideo: stage,
    stageLearn: stage,
    stageConversation: stage,
    videoMaxSeconds: { type: Number, default: 0 },
    conversationAttempts: { type: Number, default: 0 },
    conversationBestScore: { type: Number, default: null },
    introSeen: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
episodeProgressSchema.index({ userId: 1, storyId: 1, episodeId: 1 }, { unique: true });
export type EpisodeProgressDoc = InferSchemaType<typeof episodeProgressSchema> & { _id: Types.ObjectId };
export const EpisodeProgress: Model<EpisodeProgressDoc> = defineModel<EpisodeProgressDoc>("EpisodeProgress", episodeProgressSchema);

/** What the characters remember about the learner (key/value, universe-wide; never sensitive data). */
const storyFactSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    universeId: { type: String, required: true },
    key: { type: String, required: true, maxlength: 60 },
    value: { type: String, required: true, maxlength: 200 },
    sourceEpisodeId: { type: String, default: "" },
    /** The season it was learnt in ("" = about the learner everywhere: job, country, home town). */
    seasonSlug: { type: String, default: "" },
  },
  { timestamps: true },
);
storyFactSchema.index({ userId: 1, universeId: 1, key: 1 }, { unique: true });
export type StoryFactDoc = InferSchemaType<typeof storyFactSchema> & { _id: Types.ObjectId };
export const StoryFact: Model<StoryFactDoc> = defineModel<StoryFactDoc>("StoryFact", storyFactSchema);

/** Cache: one TTS audio per hash(voice + text) (scene lines, stored in R2). */
const storyAudioSchema = new Schema({ hash: { type: String, required: true, unique: true }, key: { type: String, required: true }, chars: { type: Number, default: 0 } }, { timestamps: true });
export type StoryAudioDoc = InferSchemaType<typeof storyAudioSchema> & { _id: Types.ObjectId };
export const StoryAudio: Model<StoryAudioDoc> = defineModel<StoryAudioDoc>("StoryAudio", storyAudioSchema);

