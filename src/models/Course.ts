import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { PROGRAM_SLUGS } from "@/lib/catalog";
import { assignmentFields, gradedQuizFields } from "./shared";

/**
 * A course = one delivery of a catalogue programme (`program` = slug from
 * src/lib/catalog.ts, '' = not linked). Structure: Course → Module (ordered by
 * `order`) → Lesson. Learners get access through an `Enrollment`.
 *
 * Challenge courses (`isChallenge`) run day by day: each module is a "day",
 * revealed relative to the learner's enrolment start, and a day's checkpoint
 * (its module assignment) must be approved before the next one unlocks.
 */

export const COURSE_LEVELS = ["beginner", "intermediate", "advanced"] as const;

const courseSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    imageUrl: { type: String, default: "" },

    program: {
      type: String,
      default: "",
      index: true,
      validate: {
        validator: (v: string) => v === "" || PROGRAM_SLUGS.includes(v),
        message: "Programme MaelEnglish inconnu.",
      },
    },
    level: { type: String, enum: COURSE_LEVELS, default: "beginner" },

    /** Draft courses are only visible to staff. */
    isPublished: { type: Boolean, default: false },

    /** Default cohort window (each Enrollment has its own dates). */
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },

    instructors: [{ type: Schema.Types.ObjectId, ref: "User" }],

    finalExam: { type: new Schema(gradedQuizFields, { _id: false }), default: () => ({}) },
    finalProject: { type: new Schema(assignmentFields, { _id: false }), default: () => ({}) },

    isChallenge: { type: Boolean, default: false },
    challenge: {
      themeLabel: { type: String, default: "" }, // e.g. "Anglais pour le Marketing"
    },
  },
  { timestamps: true },
);

export type CourseDoc = InferSchemaType<typeof courseSchema> & { _id: Types.ObjectId };

export const Course: Model<CourseDoc> = (models.Course as Model<CourseDoc>) || model<CourseDoc>("Course", courseSchema);
