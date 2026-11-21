import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { defineModel } from "./define";

/* Learner activity: step completion, final exam attempts, speaking challenge submissions. */

// ── StepProgress: one record per learner per step ─────────────────────────
const stepProgressSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    stepId: { type: Schema.Types.ObjectId, ref: "Step", required: true },
    status: { type: String, enum: ["completed"], default: "completed" },
    completedAt: { type: Date, default: () => new Date() },
    /** Activities: best score (0–100) and number of submitted attempts. */
    score: { type: Number, default: null, min: 0, max: 100 },
    attempts: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);
stepProgressSchema.index({ userId: 1, stepId: 1 }, { unique: true });
stepProgressSchema.index({ userId: 1, courseId: 1 });

export type StepProgressDoc = InferSchemaType<typeof stepProgressSchema> & { _id: Types.ObjectId };
export const StepProgress: Model<StepProgressDoc> = defineModel<StepProgressDoc>("StepProgress", stepProgressSchema);

// ── QuizAttempt: graded course final exam ─────────────────────────────────
const quizAttemptSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    quizType: { type: String, required: true, enum: ["final_exam"], default: "final_exam" },
    score: { type: Number, required: true, min: 0, max: 100 },
    passingScore: { type: Number, required: true, default: 70 },
    passed: { type: Boolean, required: true },
    /** Chosen option ids, in question order. */
    answers: { type: [String], default: [] },
    attemptNumber: { type: Number, default: 1, min: 1 },
  },
  { timestamps: true },
);
quizAttemptSchema.index({ userId: 1, courseId: 1, quizType: 1, createdAt: -1 });

export type QuizAttemptDoc = InferSchemaType<typeof quizAttemptSchema> & { _id: Types.ObjectId };
export const QuizAttempt: Model<QuizAttemptDoc> = defineModel<QuizAttemptDoc>("QuizAttempt", quizAttemptSchema);

// ── ChallengeSubmission: a unit's speaking challenge, reviewed by a coach ──
const challengeSubmissionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    moduleId: { type: Schema.Types.ObjectId, ref: "Module", required: true },
    unitId: { type: Schema.Types.ObjectId, ref: "Unit", required: true },
    /** The challenge step and the Labo activity answered (instructions shown to the coach). */
    stepId: { type: Schema.Types.ObjectId, ref: "Step", required: true },
    activityId: { type: Schema.Types.ObjectId, ref: "Activity", default: null },
    /** The learner's recording. */
    mediaId: { type: Schema.Types.ObjectId, ref: "Media", required: true },
    durationS: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["pending", "graded", "returned"], default: "pending" },
    grade: { type: Number, default: null, min: 0 },
    maxScore: { type: Number, default: 100, min: 1 },
    feedback: { type: String, default: "" },
    gradedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    gradedAt: { type: Date, default: null },
    /** Sends so far (limit: src/lib/learn/challenge.ts) and the extra sends granted by coach returns. */
    attempts: { type: Number, default: 0, min: 0 },
    extraAttempts: { type: Number, default: 0, min: 0 },
    /** Every recording sent, oldest first (the learner's « Mes défis » history). */
    history: {
      type: [new Schema({ mediaId: { type: Schema.Types.ObjectId, ref: "Media", required: true }, durationS: { type: Number, default: 0 }, sentAt: { type: Date, default: Date.now } }, { _id: false })],
      default: [],
    },
  },
  { timestamps: true },
);
// One submission per learner per unit (re-recording after « returned » updates it).
challengeSubmissionSchema.index({ userId: 1, unitId: 1 }, { unique: true });
// Grading queue.
challengeSubmissionSchema.index({ courseId: 1, status: 1 });

export type ChallengeSubmissionDoc = InferSchemaType<typeof challengeSubmissionSchema> & { _id: Types.ObjectId };
export const ChallengeSubmission: Model<ChallengeSubmissionDoc> = defineModel<ChallengeSubmissionDoc>("ChallengeSubmission", challengeSubmissionSchema);
