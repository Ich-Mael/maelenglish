import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { defineModel } from "./define";

/*
 * « Mon carnet »: a word a learner saved from the dictionary card (src/lib/dictionary.ts), with the
 * sentence where they met it and where (course step), and their reviews (flashcards: known or not).
 */
const vocabWordSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    word: { type: String, required: true, lowercase: true, trim: true },
    context: { type: String, default: "" },
    /** French translation in that context, when the word was saved from a sentence. */
    translation: { type: String, default: "" },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", default: null },
    stepId: { type: Schema.Types.ObjectId, ref: "Step", default: null },
    reviews: { type: Number, default: 0 },
    known: { type: Boolean, default: false },
    lastReviewedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
vocabWordSchema.index({ userId: 1, word: 1 }, { unique: true });
vocabWordSchema.index({ userId: 1, createdAt: -1 });

export type VocabWordDoc = InferSchemaType<typeof vocabWordSchema> & { _id: Types.ObjectId };
export const VocabWord: Model<VocabWordDoc> = defineModel<VocabWordDoc>("VocabWord", vocabWordSchema);
