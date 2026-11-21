import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { defineModel } from "./define";
import { CEFR_LEVELS } from "@/lib/lab/meta";

/**
 * A big theme of 3–6 units (a "day" in a challenge course). Units point to their module
 * (`Unit.moduleId`); modules are ordered by `order` within a course. A module is complete when all
 * its units are (each unit's speaking challenge sent).
 */
const moduleSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    title: { type: String, required: true, trim: true },
    summary: { type: String, default: "" }, // objective: one line, what the learner will be able to do
    description: { type: String, default: "" }, // rich text (HTML, sanitised on save), shown on the course map
    level: { type: String, enum: ["", ...CEFR_LEVELS], default: "" },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

moduleSchema.index({ courseId: 1, order: 1 });

export type ModuleDoc = InferSchemaType<typeof moduleSchema> & { _id: Types.ObjectId };

export const Module: Model<ModuleDoc> = defineModel<ModuleDoc>("Module", moduleSchema);
