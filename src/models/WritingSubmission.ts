import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { defineModel } from "./define";

/*
 * A learner's answer to a Lab « writing task » step (one per learner and step), reviewed by a coach
 * (owner decision 2026-11-22): each version sent gets an AI correction draft (`correction`, Claude —
 * seen by the coach only); the coach edits it, adds a comment and a score and sends it to the
 * learner (`feedback`, `coachComment`, `coachScore`; `coachStatus` pending → reviewed). 3 sends per
 * activity (`attempts`, + `extraAttempts` granted when the coach asks for a new version after the
 * last one). `history` keeps each version with its draft and the coach's feedback.
 */

const tryShape = new Schema(
  {
    text: { type: String, default: "" },
    wordCount: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    correction: { type: Schema.Types.Mixed, default: null },
    at: { type: Date, default: Date.now },
    // The coach's answer to this version.
    feedback: { type: Schema.Types.Mixed, default: null },
    coachComment: { type: String, default: "" },
    coachScore: { type: Number, default: null },
    reviewedAt: { type: Date, default: null },
  },
  { _id: false },
);

const writingSubmissionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    moduleId: { type: Schema.Types.ObjectId, ref: "Module", default: null },
    unitId: { type: Schema.Types.ObjectId, ref: "Unit", default: null },
    stepId: { type: Schema.Types.ObjectId, ref: "Step", required: true },
    activityId: { type: Schema.Types.ObjectId, ref: "Activity", required: true },
    text: { type: String, default: "" },
    wordCount: { type: Number, default: 0 },
    correction: { type: Schema.Types.Mixed, default: null },
    aiScore: { type: Number, default: 0 },
    bestScore: { type: Number, default: 0 },
    tries: { type: Number, default: 0 },
    /** Versions sent (limit: MAX_WRITING_SENDS + extraAttempts). */
    attempts: { type: Number, default: 0 },
    extraAttempts: { type: Number, default: 0 },
    /** What the learner sees: the coach's edited correction of the latest version. */
    feedback: { type: Schema.Types.Mixed, default: null },
    /** The coach asked for a new version. */
    redoAsked: { type: Boolean, default: false },
    history: { type: [tryShape], default: [] },
    submittedAt: { type: Date, default: null },
    coachStatus: { type: String, enum: ["pending", "reviewed"], default: "pending" },
    coachComment: { type: String, default: "" },
    /** The coach's score for the latest reviewed version (the step's score). */
    coachScore: { type: Number, default: null, min: 0, max: 100 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
writingSubmissionSchema.index({ userId: 1, stepId: 1 }, { unique: true });
writingSubmissionSchema.index({ courseId: 1, coachStatus: 1, submittedAt: 1 });

export type WritingSubmissionDoc = InferSchemaType<typeof writingSubmissionSchema> & { _id: Types.ObjectId };
export const WritingSubmission: Model<WritingSubmissionDoc> = defineModel<WritingSubmissionDoc>("WritingSubmission", writingSubmissionSchema);
