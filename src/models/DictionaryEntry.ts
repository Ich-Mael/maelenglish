import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { defineModel } from "./define";

/*
 * Dictionary cache (src/lib/dictionary.ts): one document per English word, shared by every learner.
 * From the Free Dictionary API (dictionaryapi.dev): phonetic, native audio, meanings; from the AI
 * layer (Claude Haiku 5.5): the French translation, a one-line French note and a business example.
 * `found: false` caches « not in the dictionary » too (with an AI-only entry when possible).
 */

const definition = new Schema({ definition: { type: String, default: "" }, example: { type: String, default: "" } }, { _id: false });
const meaning = new Schema({ partOfSpeech: { type: String, default: "" }, definitions: { type: [definition], default: [] } }, { _id: false });

const dictionaryEntrySchema = new Schema(
  {
    word: { type: String, required: true, unique: true, lowercase: true, trim: true },
    found: { type: Boolean, default: true },
    /** The word the dictionary answered for (a lemma: « bookings » → « booking »). */
    headword: { type: String, default: "" },
    phonetic: { type: String, default: "" },
    audioUrl: { type: String, default: "" },
    meanings: { type: [meaning], default: [] },
    /** Main meaning (most common everyday sense) chosen by the AI: 1-based over the meanings' definitions in order, 0 = none. */
    sense: { type: Number, default: 0 },
    /** Version of the AI enrichment (src/lib/dictionary.ts ENRICH_VERSION): older entries are re-enriched. */
    enrichVersion: { type: Number, default: 0 },
    translation: { type: String, default: "" },
    frNote: { type: String, default: "" },
    businessExample: { type: String, default: "" },
    /** dictionary = Free Dictionary API (+ AI translation); ai = AI only (word not in the dictionary). */
    source: { type: String, enum: ["dictionary", "ai", "none"], default: "dictionary" },
    fetchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export type DictionaryEntryDoc = InferSchemaType<typeof dictionaryEntrySchema> & { _id: Types.ObjectId };
export const DictionaryEntry: Model<DictionaryEntryDoc> = defineModel<DictionaryEntryDoc>("DictionaryEntry", dictionaryEntrySchema);

/*
 * The meaning of a word IN A SENTENCE (« together » in « we enjoyed good food together » =
 * « ensemble »): one document per word and normalised sentence, shared — course sentences repeat
 * across learners, so each pair is asked to the AI once.
 */
const dictionaryContextSchema = new Schema(
  {
    word: { type: String, required: true, lowercase: true, trim: true },
    sentence: { type: String, required: true },
    translation: { type: String, default: "" },
    frNote: { type: String, default: "" },
    /** Same numbering as `DictionaryEntry.sense`. */
    sense: { type: Number, default: 0 },
  },
  { timestamps: true },
);
dictionaryContextSchema.index({ word: 1, sentence: 1 }, { unique: true });

export type DictionaryContextDoc = InferSchemaType<typeof dictionaryContextSchema> & { _id: Types.ObjectId };
export const DictionaryContext: Model<DictionaryContextDoc> = defineModel<DictionaryContextDoc>("DictionaryContext", dictionaryContextSchema);
