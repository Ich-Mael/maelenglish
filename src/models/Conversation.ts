import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { defineModel } from "./define";

/*
 * AI role-play sessions (spec AIC-01/04, `ConversationSession`): one per call. `status`:
 * started (signed URL given) → ended (transcript read from the provider) → debriefed (Claude's
 * debrief stored) | failed (no usable call). `stepId` when played as a unit activity step, null from
 * the Speaking Partner page. The transcript comes from the provider's server (never from the browser).
 */
const turnShape = new Schema({ role: { type: String, enum: ["agent", "user"], required: true }, text: { type: String, default: "" }, t: { type: Number, default: 0 } }, { _id: false });

const conversationSessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    activityId: { type: Schema.Types.ObjectId, ref: "Activity", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", default: null },
    stepId: { type: Schema.Types.ObjectId, ref: "Step", default: null },
    /** Staff trying the scenario (Lab preview, course preview): never counted as learner progress. */
    preview: { type: Boolean, default: false },
    title: { type: String, default: "" },
    difficulty: { type: Number, min: 1, max: 5, default: 2 },
    status: { type: String, enum: ["started", "ended", "debriefed", "failed"], default: "started" },
    provider: { type: String, default: "" },
    agentId: { type: String, default: "" },
    providerConversationId: { type: String, default: "" },
    /** Seconds the learner may talk in this session (monthly minutes left, capped by the scenario). */
    limitS: { type: Number, default: 0 },
    transcript: { type: [turnShape], default: [] },
    durationS: { type: Number, default: 0 },
    costMicros: { type: Number, default: 0 },
    debrief: { type: Schema.Types.Mixed, default: null },
    /** 0–100 from the debrief scores (the step's score). */
    score: { type: Number, default: null },
    /** Why there is no debrief (too short, provider error…), for the learner and staff. */
    note: { type: String, default: "" },
    helpCount: { type: Number, default: 0 },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
conversationSessionSchema.index({ userId: 1, createdAt: -1 });
conversationSessionSchema.index({ status: 1, createdAt: -1 });

export type ConversationSessionDoc = InferSchemaType<typeof conversationSessionSchema> & { _id: Types.ObjectId };
export const ConversationSession: Model<ConversationSessionDoc> = defineModel<ConversationSessionDoc>("ConversationSession", conversationSessionSchema);

/** Provider agents per scenario version × difficulty (`key` = hash of the agent spec), reused across learners. */
const conversationAgentSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    activityId: { type: Schema.Types.ObjectId, ref: "Activity", required: true },
    difficulty: { type: Number, default: 2 },
    provider: { type: String, default: "" },
    agentId: { type: String, required: true },
  },
  { timestamps: true },
);
conversationAgentSchema.index({ activityId: 1 });
export type ConversationAgentDoc = InferSchemaType<typeof conversationAgentSchema> & { _id: Types.ObjectId };
export const ConversationAgent: Model<ConversationAgentDoc> = defineModel<ConversationAgentDoc>("ConversationAgent", conversationAgentSchema);
