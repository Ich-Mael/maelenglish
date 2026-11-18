import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { assignmentFields, gradedQuizFields } from "./shared";

/**
 * A course section (a "day" in a challenge course). Lessons point to their
 * module (`Lesson.moduleId`); modules are ordered by `order` within a course.
 */
const moduleSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    title: { type: String, required: true, trim: true },
    summary: { type: String, default: "" }, // what the learner will learn
    order: { type: Number, default: 0 },

    /** Challenge courses: the checkpoint (module assignment) must be approved before the next day unlocks. */
    isCheckpointRequired: { type: Boolean, default: true },

    quiz: { type: new Schema(gradedQuizFields, { _id: false }), default: () => ({}) },
    assignment: {
      type: new Schema({ ...assignmentFields, dueDate: { type: Date, default: null } }, { _id: false }),
      default: () => ({}),
    },
  },
  { timestamps: true },
);

moduleSchema.index({ courseId: 1, order: 1 });

export type ModuleDoc = InferSchemaType<typeof moduleSchema> & { _id: Types.ObjectId };

export const Module: Model<ModuleDoc> = (models.Module as Model<ModuleDoc>) || model<ModuleDoc>("Module", moduleSchema);
