import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { defineModel } from "./define";

/**
 * A unit inside a module (owner spec: one topic, done in one or a few sittings). It holds an
 * ordered sequence of Steps (`Step.unitId`): lesson + 2–3 activities, repeated, then one speaking
 * challenge. Units are ordered by `order` within their module.
 */
const unitSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    moduleId: { type: Schema.Types.ObjectId, ref: "Module", required: true },
    title: { type: String, required: true, trim: true },
    /** « À la fin, vous saurez… » — one line each. */
    objectives: { type: [String], default: [] },
    estimatedMinutes: { type: Number, default: 0, min: 0 },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

unitSchema.index({ moduleId: 1, order: 1 });

export type UnitDoc = InferSchemaType<typeof unitSchema> & { _id: Types.ObjectId };

export const Unit: Model<UnitDoc> = defineModel<UnitDoc>("Unit", unitSchema);
