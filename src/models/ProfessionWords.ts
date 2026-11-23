import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { defineModel } from "./define";

/*
 * « My daily vocabulary » (The Vocabulary I Need): the 2 words of the day for a profession, written
 * once by the AI and shared by every learner with the same profession (`key` = normalised
 * profession, `day` = YYYY-MM-DD in APP_TZ).
 */
const professionWordsSchema = new Schema(
  {
    key: { type: String, required: true },
    profession: { type: String, default: "" },
    day: { type: String, required: true },
    items: {
      type: [
        new Schema(
          {
            word: String,
            translation: String,
            frNote: String,
            /** First example (kept for older rows); `examples` = two examples, each with its French translation. */
            example: String,
            examples: { type: [new Schema({ en: String, fr: String }, { _id: false })], default: [] },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true },
);
professionWordsSchema.index({ key: 1, day: 1 }, { unique: true });

export type ProfessionWordsDoc = InferSchemaType<typeof professionWordsSchema> & { _id: Types.ObjectId };
export const ProfessionWords: Model<ProfessionWordsDoc> = defineModel<ProfessionWordsDoc>("ProfessionWords", professionWordsSchema);
