import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { normalizePhone } from "@/lib/phone";

/**
 * Account. Learners often have no email: an account needs an email OR a
 * WhatsApp number (`phoneNumber`, normalised into `phoneE164`, not unique —
 * a family may share one phone).
 *
 * Credentials (password hash, activation / reset tokens and codes) are added
 * in phase 2 with the auth layer.
 *
 * Soft-delete only: `isActive: false` blocks login and suspends enrolments
 * while keeping progress and grades.
 */

export const ROLES = ["user", "english-coach", "instructor", "account-manager", "admin", "super-admin"] as const;
export type Role = (typeof ROLES)[number];

/** Roles with full admin rights (granted directly in the database only). */
export const ADMIN_ROLES: readonly Role[] = ["admin", "super-admin"];
/** Roles that can teach / grade. */
export const STAFF_ROLES: readonly Role[] = ["english-coach", "instructor", "account-manager", "admin", "super-admin"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const deviceSchema = new Schema(
  {
    deviceId: { type: String, required: true },
    deviceType: { type: String, enum: ["mobile", "tablet", "desktop"], required: true },
    deviceModel: String,
    browser: String,
    os: String,
    userAgent: String,
    ipAddress: String,
    firstSeen: { type: Date, default: Date.now },
    lastLogin: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    surname: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    gender: { type: String, enum: ["male", "female", "other"] },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
      validate: {
        validator: (v?: string | null) => !v || EMAIL_RE.test(v),
        message: "Saisissez une adresse mail valide.",
      },
    },
    phoneNumber: { type: String, trim: true },
    /** phoneNumber as international digits (e.g. 22670123456) — WhatsApp recipient and phone login. */
    phoneE164: { type: String, index: true },

    role: { type: String, enum: ROLES, default: "user" },
    /** true once the learner has chosen a password (activation link) — admins created by bootstrap start verified. */
    isVerified: { type: Boolean, default: false },

    /** scrypt hash (`src/lib/auth/password.ts`); never selected by default. Empty until activation. */
    passwordHash: { type: String, select: false },
    passwordChangedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },

    avatarUrl: { type: String, trim: true },
    about: { type: String, trim: true, default: "" },
    englishLevel: { type: String, trim: true },

    devices: { type: [deviceSchema], default: [] },
    maxDevices: { type: Number, default: 3, min: 1 },
    /** Main coach (reviews this learner's speaking submissions); set by an admin. */
    coachId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    /** Monthly AI minutes override (null = the default in AppSettings). */
    aiMonthlyMinutes: { type: Number, default: null, min: 0 },

    isActive: { type: Boolean, default: true },
    deactivatedAt: { type: Date, default: null },
    deactivatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

// Email or phone: at least one contact channel; keep phoneE164 in sync with phoneNumber.
userSchema.pre("validate", function () {
  if (this.email === "") this.email = undefined;
  if (this.isModified("phoneNumber") || (this.phoneNumber && !this.phoneE164)) {
    this.phoneE164 = normalizePhone(this.phoneNumber) ?? undefined;
  }
  if (this.phoneNumber && !this.phoneE164) {
    this.invalidate("phoneNumber", "Numéro de téléphone invalide.");
  }
  if (!this.email && !this.phoneNumber) {
    this.invalidate("email", "Renseignez une adresse email ou un numéro WhatsApp.");
  }
});

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };

export const User: Model<UserDoc> = (models.User as Model<UserDoc>) || model<UserDoc>("User", userSchema);

/** `isActive` undefined is treated as active; only an explicit false blocks. */
export function isAccountActive(user: Pick<UserDoc, "isActive">): boolean {
  return user.isActive !== false;
}

export function hasRole(user: { role?: string | null } | null | undefined, roles: readonly Role[]): boolean {
  return !!user?.role && (roles as readonly string[]).includes(user.role);
}
