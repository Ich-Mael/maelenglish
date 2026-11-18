import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

/**
 * Staff-only material attached to a module (lesson plan, activities, answer
 * key…). Replaces the original app's `Module.coachResources[]` links and the
 * `TeachingResource` lesson plans.
 */
export const RESOURCE_TYPES = ["lesson_plan", "activities", "answer_key", "slides", "worksheet", "rubric", "other"] as const;

const teachingResourceSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    moduleId: { type: Schema.Types.ObjectId, ref: "Module", required: true, index: true },
    resourceType: { type: String, enum: RESOURCE_TYPES, default: "lesson_plan" },
    title: { type: String, required: true, trim: true },
    /** External file / document link, if any. */
    link: { type: String, default: "" },
    content: {
      type: new Schema(
        {
          objectives: String,
          materials: String,
          warmUp: String,
          mainActivity: String,
          practice: String,
          assessment: String,
          homework: String,
          notes: String,
        },
        { _id: false },
      ),
      default: () => ({}),
    },
    tags: { type: [String], default: [] },
    isPublished: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    lastEditedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export type TeachingResourceDoc = InferSchemaType<typeof teachingResourceSchema> & { _id: Types.ObjectId };

export const TeachingResource: Model<TeachingResourceDoc> =
  (models.TeachingResource as Model<TeachingResourceDoc>) ||
  model<TeachingResourceDoc>("TeachingResource", teachingResourceSchema);
