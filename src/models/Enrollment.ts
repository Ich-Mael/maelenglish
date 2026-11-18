import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

/**
 * A learner's access to a course, with its own date window. Replaces the
 * legacy `User.specialProgram[]` (matched by course title) / `coursesTaken[]`
 * / `Course.students[]` trio: this is the only source of truth for access.
 *
 * `suspendedReason: 'account-deactivated'` marks suspensions made when the
 * account was deactivated, so restoring the account only lifts those.
 */
export const ENROLLMENT_STATUSES = ["active", "suspended", "completed"] as const;
export const SUSPENDED_REASONS = ["", "account-deactivated", "admin"] as const;

const enrollmentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    startDate: { type: Date, default: Date.now },
    /** null = no end date. */
    endDate: { type: Date, default: null },
    status: { type: String, enum: ENROLLMENT_STATUSES, default: "active" },
    suspendedReason: { type: String, enum: SUSPENDED_REASONS, default: "" },
    enrolledBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

enrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });

enrollmentSchema.pre("validate", function () {
  if (this.endDate && this.startDate && this.endDate < this.startDate) {
    this.invalidate("endDate", "La date de fin doit être après la date de début.");
  }
});

export type EnrollmentDoc = InferSchemaType<typeof enrollmentSchema> & { _id: Types.ObjectId };

export const Enrollment: Model<EnrollmentDoc> =
  (models.Enrollment as Model<EnrollmentDoc>) || model<EnrollmentDoc>("Enrollment", enrollmentSchema);

export type AccessState = "active" | "not-started" | "expired" | "suspended" | "completed";

/** Where an enrolment stands at `now`. Only "active" (and "completed": read-only review) grant access to content. */
export function accessState(
  e: Pick<EnrollmentDoc, "status" | "startDate" | "endDate">,
  now: Date = new Date(),
): AccessState {
  if (e.status === "suspended") return "suspended";
  if (e.status === "completed") return "completed";
  if (e.startDate && e.startDate > now) return "not-started";
  if (e.endDate && e.endDate < now) return "expired";
  return "active";
}
