import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { defineModel } from "./define";
import { ACTIVITY_TYPES } from "@/lib/lab/types";

/**
 * A practice activity built in the Labo (/admin/labo), reusable in several units. Placed in a unit's
 * steps: an activity step (`Step.activityId`, kind activity) or a unit's closing speaking challenge
 * (kind challenge). `content` depends on `type` (validated by src/lib/lab/content.ts).
 * Learners only see `ready` activities.
 */
const activitySchema = new Schema(
  {
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    title: { type: String, required: true, trim: true },
    // Common details (src/lib/lab/meta.ts): CEFR level, skills, business theme, minutes, short
    // instruction and « Le conseil de Coach Ish » (both French, for learners).
    level: { type: String, default: "" },
    skills: { type: [String], default: [] },
    theme: { type: String, default: "" },
    durationMin: { type: Number, default: 0, min: 0 },
    instructions: { type: String, default: "" },
    maelTip: { type: String, default: "" },
    tags: { type: [String], default: [] },
    status: { type: String, enum: ["draft", "ready"], default: "draft" },
    content: { type: Schema.Types.Mixed, default: () => ({}) },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, minimize: false },
);
activitySchema.index({ type: 1, status: 1, updatedAt: -1 });

export type ActivityDoc = InferSchemaType<typeof activitySchema> & { _id: Types.ObjectId };
export const Activity: Model<ActivityDoc> = defineModel<ActivityDoc>("Activity", activitySchema);
