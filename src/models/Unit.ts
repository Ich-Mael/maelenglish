import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

/**
 * A unit inside a module (spec: Course → Module → Unit → Activities). It groups lessons
 * (`Lesson.unitId`) around one objective; units are ordered by `order` within their module.
 * Lessons open one after the other across the module's units; a unit with a speaking challenge
 * must have it sent before the next unit opens. The module quiz and assignment stay on the module.
 */
const unitSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    moduleId: { type: Schema.Types.ObjectId, ref: "Module", required: true },
    title: { type: String, required: true, trim: true },
    objective: { type: String, default: "", trim: true }, // one line: what the learner will be able to do
    order: { type: Number, default: 0 },
    /**
     * Speaking challenge closing the unit: the learner records an answer, a coach gives feedback
     * (« Corrections »). Sending it completes the unit and opens the next one. Empty instructions =
     * no challenge (the unit is complete when its activities are).
     */
    challenge: {
      type: new Schema(
        {
          title: { type: String, default: "", trim: true },
          instructions: { type: String, default: "" }, // rich text (HTML, sanitised on save)
          maxSeconds: { type: Number, default: 60, min: 15, max: 300 },
          prepSeconds: { type: Number, default: 0, min: 0, max: 120 },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
  },
  { timestamps: true },
);

unitSchema.index({ moduleId: 1, order: 1 });

export type UnitDoc = InferSchemaType<typeof unitSchema> & { _id: Types.ObjectId };

export const Unit: Model<UnitDoc> = (models.Unit as Model<UnitDoc>) || model<UnitDoc>("Unit", unitSchema);
