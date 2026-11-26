import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { defineModel } from "./define";

/**
 * Sign-up request sent from the public « S'inscrire » form (/inscription).
 * Staff follow up (WhatsApp / phone), then create the account and the
 * enrolment from the admin. `kind: "notify"` = « prévenez-moi » for a
 * programme that isn't open yet.
 */
export const REQUEST_STATUSES = ["new", "contacted", "enrolled", "closed"] as const;
export const REQUEST_LEVELS = ["beginner", "intermediate", "advanced", "unknown"] as const;

const enrollmentRequestSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 60 },
    lastName: { type: String, required: true, trim: true, maxlength: 60 },
    phoneNumber: { type: String, required: true, trim: true },
    phoneE164: { type: String, required: true, index: true },
    email: { type: String, trim: true, lowercase: true, default: "" },
    /** Country code from src/lib/countries.ts (« BF », « CI »…, « OTHER »), "" for older requests. */
    country: { type: String, default: "", maxlength: 8 },
    /** Catalogue slug, « coaching », « challenge » or "" (not sure). */
    program: { type: String, default: "" },
    kind: { type: String, enum: ["enroll", "notify"], default: "enroll" },
    level: { type: String, enum: REQUEST_LEVELS, default: "unknown" },
    profession: { type: String, trim: true, default: "", maxlength: 120 },
    message: { type: String, trim: true, default: "", maxlength: 2000 },
    status: { type: String, enum: REQUEST_STATUSES, default: "new", index: true },
    notes: { type: String, default: "", maxlength: 2000 },
    handledBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    /** Account created from this request, once done. */
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);
enrollmentRequestSchema.index({ createdAt: -1 });

export type EnrollmentRequestDoc = InferSchemaType<typeof enrollmentRequestSchema> & { _id: Types.ObjectId };
export const EnrollmentRequest: Model<EnrollmentRequestDoc> =
  defineModel<EnrollmentRequestDoc>("EnrollmentRequest", enrollmentRequestSchema);
