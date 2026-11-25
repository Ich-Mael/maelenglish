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
    /**
     * Story Mode season slug (« story:<slug> ») for calls that use that season's own voice-minute
     * pot; such rows don't count against the monthly AI minutes.
     */
    ref: { type: String, default: "" },
    /** Local calendar day (APP_TZ), YYYY-MM-DD; `month` = YYYY-MM. */
    day: { type: String, required: true },
    month: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
aiUsageSchema.index({ userId: 1, month: 1 });
aiUsageSchema.index({ day: 1 });
aiUsageSchema.index({ userId: 1, ref: 1 }, { partialFilterExpression: { ref: { $gt: "" } } });

export type AiUsageDoc = InferSchemaType<typeof aiUsageSchema> & { _id: Types.ObjectId };
export const AiUsage: Model<AiUsageDoc> = defineModel<AiUsageDoc>("AiUsage", aiUsageSchema);

/** App-wide settings (single document, `key: "global"`), editable in admin. */
const appSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "global" },
    /** Default monthly AI minutes per learner (speech + conversation); per-learner override on User. */
    aiMonthlyMinutes: { type: Number, default: 60, min: 0 },
    /**
     * Talk with Coach Ish budget (ElevenLabs plan): `planCredits` per month (0 = no budget),
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
    /**
     * Story Mode pricing (season « Pricing » card): the cost of a conversation minute used until real
     * costs are measured (when no ElevenLabs plan is set), scene voicing, the FCFA rate, the default margin.
     */
    storyPricing: {
      convUsdPerMin: { type: Number, default: 0.06, min: 0 },
      ttsUsdPerKChar: { type: Number, default: 0.03, min: 0 },
      usdToFcfa: { type: Number, default: 600, min: 1 },
      defaultMarginPct: { type: Number, default: 200, min: 0 },
    },
    /** AI minute packs learners can buy (Shop): id, minutes, price in FCFA. */
    minutePacks: {
      type: [{ id: { type: String, required: true }, minutes: { type: Number, required: true, min: 1 }, priceFcfa: { type: Number, required: true, min: 5 }, _id: false }],
      default: [
        { id: "m30", minutes: 30, priceFcfa: 2500 },
        { id: "m60", minutes: 60, priceFcfa: 4500 },
      ],
    },
    /** ElevenLabs voices reading the vocabulary (dictionary, daily words) — American and British. */
    vocabularyVoices: {
      us: { id: { type: String, default: "cgSgspJ2msm6clMCkdW9" }, name: { type: String, default: "Jessica" } },
      gb: { id: { type: String, default: "JBFqnCBsd6RMkjVDRZzb" }, name: { type: String, default: "George" } },
    },
    /** Coach Ish persona (spec AIC-07): the coach's voice in role-play help and debriefs. */
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
