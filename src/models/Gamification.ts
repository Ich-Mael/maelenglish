import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { defineModel } from "./define";

/* Gamification records — rules in src/lib/gamification/. */

// ── XpEvent: one row per award; `key` makes each award idempotent ─────────
const xpEventSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", default: null },
    /** e.g. "lesson:<id>", "quiz:<moduleId>", "goal:2026-11-18" — unique per user. */
    key: { type: String, required: true },
    source: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    /** Local calendar day (APP_TZ), YYYY-MM-DD. */
    day: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
xpEventSchema.index({ userId: 1, key: 1 }, { unique: true });
xpEventSchema.index({ courseId: 1, createdAt: -1 }); // weekly leaderboard
xpEventSchema.index({ userId: 1, day: 1 });

export type XpEventDoc = InferSchemaType<typeof xpEventSchema> & { _id: Types.ObjectId };
export const XpEvent: Model<XpEventDoc> = defineModel<XpEventDoc>("XpEvent", xpEventSchema);

// ── UserStats: running totals per learner ─────────────────────────────────
const userStatsSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    xp: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    /** Last day (APP_TZ, YYYY-MM-DD) with XP. */
    lastActiveDay: { type: String, default: "" },
    todayXp: { type: Number, default: 0 },
    todayDay: { type: String, default: "" },
    dailyGoal: { type: Number, default: 30, min: 10 },
    lessonsCompleted: { type: Number, default: 0 },
    perfectPractices: { type: Number, default: 0 },
    quizzesPassed: { type: Number, default: 0 },
    examsPassed: { type: Number, default: 0 },
    assignmentsSubmitted: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type UserStatsDoc = InferSchemaType<typeof userStatsSchema> & { _id: Types.ObjectId };
export const UserStats: Model<UserStatsDoc> =
  defineModel<UserStatsDoc>("UserStats", userStatsSchema);

// ── UserBadge: earned badges (definitions in src/lib/gamification/rules.ts) ──
const userBadgeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    badgeId: { type: String, required: true },
    earnedAt: { type: Date, default: Date.now },
  },
);
userBadgeSchema.index({ userId: 1, badgeId: 1 }, { unique: true });

export type UserBadgeDoc = InferSchemaType<typeof userBadgeSchema> & { _id: Types.ObjectId };
export const UserBadge: Model<UserBadgeDoc> =
  defineModel<UserBadgeDoc>("UserBadge", userBadgeSchema);
