import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { defineModel } from "./define";
import { DEFAULT_PASS_SCORE, STEP_KINDS } from "@/lib/course/types";

/**
 * One step of a unit (owner spec COURSE_STRUCTURE.md), ordered by `position` (1, 2, 3… no gaps —
 * the admin services renumber after every change). Only the fields of its `kind` are used:
 * - lesson: `content` = LessonContent (src/lib/course/types.ts; cleaned by cleanLessonContent);
 * - activity: `activityId` (a reusable Labo activity), `lessonId` (the lesson step it practises,
 *   earlier in the same unit), `passScore` (below it the learner is offered « Revoir la leçon »);
 * - challenge: `activityId` (a Labo « speaking_challenge »), always last, one per unit.
 * The unit rules are checked by validateUnit; a unit breaking them is hidden from learners.
 */
const stepSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    moduleId: { type: Schema.Types.ObjectId, ref: "Module", required: true },
    unitId: { type: Schema.Types.ObjectId, ref: "Unit", required: true },
    position: { type: Number, required: true, min: 1 },
    kind: { type: String, required: true, enum: STEP_KINDS },
    title: { type: String, required: true, trim: true },
    estimatedMinutes: { type: Number, default: 0, min: 0 },
    content: { type: Schema.Types.Mixed, default: () => ({}) },
    activityId: { type: Schema.Types.ObjectId, ref: "Activity", default: null, index: true },
    lessonId: { type: Schema.Types.ObjectId, ref: "Step", default: null },
    passScore: { type: Number, default: DEFAULT_PASS_SCORE, min: 0, max: 100 },
  },
  { timestamps: true, minimize: false },
);

// Not unique: reordering renumbers the unit's steps without index conflicts.
stepSchema.index({ unitId: 1, position: 1 });
stepSchema.index({ unitId: 1 }, { unique: true, partialFilterExpression: { kind: "challenge" }, name: "one_challenge_per_unit" });

export type StepDoc = InferSchemaType<typeof stepSchema> & { _id: Types.ObjectId };

export const Step: Model<StepDoc> = defineModel<StepDoc>("Step", stepSchema);
