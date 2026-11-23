import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { defineModel } from "./define";

/**
 * Metering of paid AI / speech calls (DECISIONS.md « Metering »): one row per call.
 * `seconds` = audio processed or produced (counts against the learner's monthly AI minutes);
 * `tokens` for LLM calls; `costMicros` = estimated cost in millionths of a USD.
 */
export const AI_KINDS = ["stt", "pronunciation", "tts", "llm", "conversation"] as const;
export type AiKind = (typeof AI_KINDS)[number];

const aiUsageSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, enum: AI_KINDS, required: true },
    /** What it was for, e.g. "drill", "debrief", "roleplay", "shadowing". */
    feature: { type: String, default: "" },
    provider: { type: String, default: "" },
    seconds: { type: Number, default: 0, min: 0 },
    tokens: { type: Number, default: 0, min: 0 },
    costMicros: { type: Number, default: 0, min: 0 },
    /** Local calendar day (APP_TZ), YYYY-MM-DD; `month` = YYYY-MM. */
    day: { type: String, required: true },
    month: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
aiUsageSchema.index({ userId: 1, month: 1 });
aiUsageSchema.index({ day: 1 });

export type AiUsageDoc = InferSchemaType<typeof aiUsageSchema> & { _id: Types.ObjectId };
export const AiUsage: Model<AiUsageDoc> = defineModel<AiUsageDoc>("AiUsage", aiUsageSchema);

/** App-wide settings (single document, `key: "global"`), editable in admin. */
const appSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "global" },
    /** Default monthly AI minutes per learner (speech + conversation); per-learner override on User. */
    aiMonthlyMinutes: { type: Number, default: 60, min: 0 },
    /**
     * Speaking Partner budget (ElevenLabs plan): `planCredits` per month (0 = no budget),
     * `creditsPerMinute` measured on real calls, `planPriceUsd` per month (for the real cost of a
     * minute); admins are warned at `warnPercent`, new calls stop at `stopPercent`.
     */
    conversationBudget: {
      planCredits: { type: Number, default: 0, min: 0 },
      creditsPerMinute: { type: Number, default: 455, min: 1 },
      planPriceUsd: { type: Number, default: 0, min: 0 },
      warnPercent: { type: Number, default: 80, min: 1, max: 100 },
      stopPercent: { type: Number, default: 95, min: 1, max: 100 },
    },
    /** Mael persona (spec AIC-07): the coach's voice in role-play help and debriefs. */
    persona: {
      tone: { type: String, default: "" },
      catchphrases: { type: [String], default: [] },
      tips: { type: [String], default: [] },
    },
  },
  { timestamps: true },
);
export type AppSettingsDoc = InferSchemaType<typeof appSettingsSchema> & { _id: Types.ObjectId };
export const AppSettings: Model<AppSettingsDoc> = defineModel<AppSettingsDoc>("AppSettings", appSettingsSchema);
