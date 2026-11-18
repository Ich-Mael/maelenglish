import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

/* Auth records: login sessions, one-time links (activation / reset), rate-limit counters. */

// ── Session: one per signed-in browser ─────────────────────────────────────
const sessionSchema = new Schema(
  {
    /** sha256 of the random cookie token — the token itself is never stored. */
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    /** Long-lived `me_device` cookie value, matches `User.devices[].deviceId`. */
    deviceId: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    ipAddress: { type: String, default: "" },
    lastSeenAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type SessionDoc = InferSchemaType<typeof sessionSchema> & { _id: Types.ObjectId };
export const Session: Model<SessionDoc> =
  (models.Session as Model<SessionDoc>) || model<SessionDoc>("Session", sessionSchema);

// ── AuthToken: single-use link (activation = first password, reset = forgotten password) ──
export const AUTH_TOKEN_PURPOSES = ["activation", "reset"] as const;
export type AuthTokenPurpose = (typeof AUTH_TOKEN_PURPOSES)[number];

const authTokenSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    purpose: { type: String, enum: AUTH_TOKEN_PURPOSES, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type AuthTokenDoc = InferSchemaType<typeof authTokenSchema> & { _id: Types.ObjectId };
export const AuthToken: Model<AuthTokenDoc> =
  (models.AuthToken as Model<AuthTokenDoc>) || model<AuthTokenDoc>("AuthToken", authTokenSchema);

// ── RateLimit: fixed-window counter per key (e.g. "login:ip:1.2.3.4") ──────
const rateLimitSchema = new Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});
rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RateLimitDoc = InferSchemaType<typeof rateLimitSchema> & { _id: Types.ObjectId };
export const RateLimit: Model<RateLimitDoc> =
  (models.RateLimit as Model<RateLimitDoc>) || model<RateLimitDoc>("RateLimit", rateLimitSchema);
