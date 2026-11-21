import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { defineModel } from "./define";

/**
 * One finished run of a Lab activity by a learner (catalogue: data tracked per attempt —
 * score, time spent, plays, answers, date). Feeds recommendations and shows Mael where learners
 * struggle. Staff previews are not recorded.
 */
const labAttemptSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    stepId: { type: Schema.Types.ObjectId, ref: "Step", required: true }, // the activity step in a unit
    activityId: { type: Schema.Types.ObjectId, ref: "Activity", required: true },
    type: { type: String, required: true },
    score: { type: Number, required: true, min: 0, max: 100 },
    stars: { type: Number, required: true, min: 0, max: 3 },
    /** Items answered right on the first try in the best conditions (e.g. a single play). */
    bonus: { type: Number, default: 0, min: 0 },
    timeSpentS: { type: Number, default: 0, min: 0 },
    plays: { type: Number, default: 0, min: 0 },
    items: { type: [{ _id: false, itemId: String, correct: Boolean, answer: Schema.Types.Mixed }], default: [] },
  },
  { timestamps: true },
);
labAttemptSchema.index({ userId: 1, activityId: 1, createdAt: -1 });
labAttemptSchema.index({ activityId: 1, createdAt: -1 });

/**
 * Mistake bank: each item a learner got wrong (catalogue: « Revoir mes erreurs » sessions).
 * One row per learner and item; `resolved` once they get it right in a later attempt.
 */
const labMistakeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    stepId: { type: Schema.Types.ObjectId, ref: "Step", required: true },
    activityId: { type: Schema.Types.ObjectId, ref: "Activity", required: true },
    itemId: { type: String, required: true },
    count: { type: Number, default: 1, min: 1 },
    lastWrongAt: { type: Date, default: () => new Date() },
    resolved: { type: Boolean, default: false },
  },
  { timestamps: true },
);
labMistakeSchema.index({ userId: 1, activityId: 1, itemId: 1 }, { unique: true });
labMistakeSchema.index({ userId: 1, resolved: 1, lastWrongAt: -1 });

export type LabAttemptDoc = InferSchemaType<typeof labAttemptSchema> & { _id: Types.ObjectId };
export type LabMistakeDoc = InferSchemaType<typeof labMistakeSchema> & { _id: Types.ObjectId };
export const LabAttempt: Model<LabAttemptDoc> = defineModel<LabAttemptDoc>("LabAttempt", labAttemptSchema);
export const LabMistake: Model<LabMistakeDoc> = defineModel<LabMistakeDoc>("LabMistake", labMistakeSchema);
