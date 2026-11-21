import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { defineModel } from "./define";
import { PROGRAM_SLUGS } from "@/lib/catalog";
import { gradedQuizFields } from "./shared";

/**
 * A course = one delivery of a catalogue programme (`program` = slug from
 * src/lib/catalog.ts, '' = not linked). The owner spec calls it the « Program ». Structure:
 * Course → Module → Unit → Step (src/lib/course/types.ts). Learners get access through an `Enrollment`.
 *
 * Challenge courses (`isChallenge`) run day by day: each module is a "day",
 * revealed relative to the learner's enrolment start, and the coach must validate the
 * day's last unit speaking challenge before the next day unlocks.
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
        message: "Unknown MaelEnglish programme.",
      },
    },
    level: { type: String, enum: COURSE_LEVELS, default: "beginner" },

    /** Training fee in FCFA (information for staff; no online payment). null = not set. */
    price: {
      type: Number,
      default: null,
      min: [0, "Le prix ne peut pas être négatif."],
      validate: { validator: (v: number | null) => v === null || Number.isInteger(v), message: "The price must be a whole number of FCFA." },
    },

    /** Draft courses are only visible to staff. */
    isPublished: { type: Boolean, default: false },

    /** Default cohort window (each Enrollment has its own dates). */
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },

    instructors: [{ type: Schema.Types.ObjectId, ref: "User" }],

    finalExam: { type: new Schema(gradedQuizFields, { _id: false }), default: () => ({}) },

    isChallenge: { type: Boolean, default: false },
    challenge: {
      themeLabel: { type: String, default: "" }, // e.g. "Anglais pour le Marketing"
    },
  },
  { timestamps: true },
);

export type CourseDoc = InferSchemaType<typeof courseSchema> & { _id: Types.ObjectId };

export const Course: Model<CourseDoc> = defineModel<CourseDoc>("Course", courseSchema);
