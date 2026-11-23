import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { defineModel } from "./define";

/*
 * « Mon carnet »: a word a learner saved from the dictionary card (src/lib/dictionary.ts), with the
 * sentence where they met it and where (course step), and their reviews (flashcards: known or not).
 * Part of « The Vocabulary I Need » (src/lib/vocabulary.ts): spaced review, own sentences, daily words.
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
    /** Where it came from: the dictionary card, or « my daily vocabulary » (profession words). */
    source: { type: String, enum: ["dictionary", "daily"], default: "dictionary" },
    /** Spaced review (src/lib/vocabulary.ts): successes in a row, and when it comes back (null = due now). */
    stage: { type: Number, default: 0, min: 0 },
    dueAt: { type: Date, default: null },
    /** « My own sentences » with this word, as corrected by the AI. */
    sentences: {
      type: [
        new Schema(
          {
            text: { type: String, required: true, maxlength: 300 },
            corrected: { type: String, default: "" },
            ok: { type: Boolean, default: false },
            explanation: { type: String, default: "" },
            at: { type: Date, default: Date.now },
          },
          { _id: true },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true },
);
vocabWordSchema.index({ userId: 1, word: 1 }, { unique: true });
vocabWordSchema.index({ userId: 1, createdAt: -1 });
vocabWordSchema.index({ userId: 1, dueAt: 1 });

export type VocabWordDoc = InferSchemaType<typeof vocabWordSchema> & { _id: Types.ObjectId };
export const VocabWord: Model<VocabWordDoc> = defineModel<VocabWordDoc>("VocabWord", vocabWordSchema);
