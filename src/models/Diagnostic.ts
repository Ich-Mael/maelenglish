import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { defineModel } from "./define";

/*
 * Learning-path diagnostic (DIAGNOSTIC_SPEC.md §9): one document per questionnaire, created when it
 * starts (abandons are measured by `lastSection`) and updated after each section. The browser holds
 * a random token; only its sha256 is stored (`tokenHash`). The lead (first name, email, optional
 * phone, consents) is captured before the report is shown.
 */
const leadShape = new Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, default: "" },
    consentAnalysis: { type: Boolean, required: true },
    consentMarketing: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const diagnosticSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    answers: { type: Schema.Types.Mixed, default: () => ({}) },
    /** Last section completed (0 = none), for drop-off stats. */
    lastSection: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },
    profileScores: { type: Schema.Types.Mixed, default: null },
    primaryProfile: { type: String, default: "" },
    secondaryProfiles: { type: [String], default: [] },
    report: { type: Schema.Types.Mixed, default: null },
    reportSource: { type: String, enum: ["ai", "fallback", ""], default: "" },
    lead: { type: leadShape, default: null },
    utmSource: { type: String, default: "" },
    utmMedium: { type: String, default: "" },
    utmCampaign: { type: String, default: "" },
    /** Staff follow-up (Admin → Diagnostics). */
    status: { type: String, enum: ["new", "contacted", "closed"], default: "new" },
  },
  { timestamps: true, minimize: false },
);
diagnosticSchema.index({ createdAt: -1 });
diagnosticSchema.index({ completedAt: -1 });

export type DiagnosticDoc = InferSchemaType<typeof diagnosticSchema> & { _id: Types.ObjectId };
export const Diagnostic: Model<DiagnosticDoc> = defineModel<DiagnosticDoc>("Diagnostic", diagnosticSchema);
