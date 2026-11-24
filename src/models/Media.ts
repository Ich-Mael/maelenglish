import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { defineModel } from "./define";

/**
 * A stored file: learner recordings, coach voice notes, listening clips, model audio,
 * instruction media, profile photos (`avatar`). The bytes live in object storage (`src/lib/storage.ts`,
 * key = `key`); this record holds ownership and access (`src/lib/media-access.ts`).
 * Browsers upload straight to storage with a presigned URL, then the upload is confirmed
 * (`status` pending → ready). Learner recordings and voice notes are private.
 */
/** `conversation`: the audio of an AI role-play call, copied from ElevenLabs by the server (never uploaded by a browser). */
export const MEDIA_KINDS = ["recording", "voice-note", "clip", "model-audio", "instruction", "avatar", "image", "conversation", "document"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

const mediaSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: { type: String, enum: MEDIA_KINDS, required: true },
    key: { type: String, required: true, unique: true },
    mime: { type: String, required: true },
    size: { type: Number, default: 0, min: 0 },
    durationS: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["pending", "ready"], default: "pending" },
    /** `public`: course content any signed-in learner may play; `private`: owner, their coach, admins. */
    visibility: { type: String, enum: ["private", "public"], default: "private" },
  },
  { timestamps: true },
);
mediaSchema.index({ status: 1, createdAt: 1 }); // cleanup of abandoned uploads

export type MediaDoc = InferSchemaType<typeof mediaSchema> & { _id: Types.ObjectId };
export const Media: Model<MediaDoc> = defineModel<MediaDoc>("Media", mediaSchema);
