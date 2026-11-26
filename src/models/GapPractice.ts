import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { defineModel } from "./define";

/*
 * Fill-the-gaps practice on the learner's own expressions (owner decision 2026-11-26): a text
 * written by the AI with each expression in [brackets] — `mode` « sentences » (one unrelated
 * sentence per expression) or « story » (one short text using them all). Either one learner's
 * (`userId`: their notebook words, The Vocabulary I Need) or a coaching's (`coachingId`: the week's
 * daily expressions, shared by the group, one per coaching + day + mode).
 * `gapItems[i]` = the `items[].key` practised by blank g(i+1).
 */
const gapPracticeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    coachingId: { type: Schema.Types.ObjectId, ref: "Coaching", default: null },
    day: { type: String, required: true },
    mode: { type: String, enum: ["sentences", "story"], required: true },
    title: { type: String, default: "" },
    /** `key` = the notebook key (VocabWord.word) of the expression. */
    items: { type: [new Schema({ key: String, text: String, translation: String }, { _id: false })], default: [] },
    /** `en` holds the blanks in [brackets]; `fr` its French translation. */
    lines: { type: [new Schema({ en: String, fr: String }, { _id: false })], default: [] },
    gapItems: { type: [String], default: [] },
    explanations: { type: [String], default: [] },
    attempts: { type: [new Schema({ userId: { type: Schema.Types.ObjectId, ref: "User" }, score: Number, right: Number, total: Number, at: Date }, { _id: false })], default: [] },
  },
  { timestamps: true },
);
gapPracticeSchema.index({ userId: 1, day: 1, mode: 1, createdAt: -1 });
gapPracticeSchema.index({ coachingId: 1, day: 1, mode: 1 }, { unique: true, partialFilterExpression: { coachingId: { $type: "objectId" } } });

export type GapPracticeDoc = InferSchemaType<typeof gapPracticeSchema> & { _id: Types.ObjectId; createdAt: Date };
export const GapPractice: Model<GapPracticeDoc> = defineModel<GapPracticeDoc>("GapPractice", gapPracticeSchema);
