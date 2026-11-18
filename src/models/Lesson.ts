import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { exerciseSchema } from "./shared";

/**
 * Atomic learning unit inside a module. Only the fields of its `type` are used.
 * `practice` = a sequence of interactive exercises (ungraded self-check; the
 * first-try score is kept in `LessonProgress.practiceScore`).
 */
export const LESSON_TYPES = ["video", "text", "pdf", "practice"] as const;
export type LessonType = (typeof LESSON_TYPES)[number];

const lessonSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    moduleId: { type: Schema.Types.ObjectId, ref: "Module", required: true },
    title: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true },
    type: { type: String, required: true, enum: LESSON_TYPES },
    description: { type: String, default: "" },

    // video
    videoUrl: { type: String, default: "" },
    durationMinutes: { type: Number, default: 0, min: 0 },
    // text — Markdown (rendered without raw HTML); also an optional intro for other types
    content: { type: String, default: "" },
    // pdf
    fileUrl: { type: String, default: "" },
    fileName: { type: String, default: "" },
    // practice: interactive exercises
    exercises: { type: [exerciseSchema], default: [] },
  },
  { timestamps: true },
);

// Not unique: reordering lessons swaps orders without index conflicts.
lessonSchema.index({ moduleId: 1, order: 1 });

export type LessonDoc = InferSchemaType<typeof lessonSchema> & { _id: Types.ObjectId };

export const Lesson: Model<LessonDoc> = (models.Lesson as Model<LessonDoc>) || model<LessonDoc>("Lesson", lessonSchema);
