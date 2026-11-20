import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

/* Learner activity: lesson completion, graded quiz attempts, assignment submissions. */

// ── LessonProgress: one record per learner per lesson ─────────────────────
const lessonProgressSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    moduleId: { type: Schema.Types.ObjectId, ref: "Module", required: true },
    lessonId: { type: Schema.Types.ObjectId, ref: "Lesson", required: true },
    status: { type: String, enum: ["not_started", "completed"], default: "not_started" },
    completedAt: { type: Date, default: null },
    /** Last practice-quiz score (0–100), ungraded self-check. */
    practiceScore: { type: Number, default: null, min: 0, max: 100 },
  },
  { timestamps: true },
);
lessonProgressSchema.index({ userId: 1, lessonId: 1 }, { unique: true });
lessonProgressSchema.index({ userId: 1, courseId: 1 });

export type LessonProgressDoc = InferSchemaType<typeof lessonProgressSchema> & { _id: Types.ObjectId };
export const LessonProgress: Model<LessonProgressDoc> =
  (models.LessonProgress as Model<LessonProgressDoc>) ||
  model<LessonProgressDoc>("LessonProgress", lessonProgressSchema);

// ── QuizAttempt: graded module quiz / final exam ──────────────────────────
const quizAttemptSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    /** null for a final exam. */
    moduleId: { type: Schema.Types.ObjectId, ref: "Module", default: null },
    quizType: { type: String, required: true, enum: ["module_quiz", "final_exam"] },
    score: { type: Number, required: true, min: 0, max: 100 },
    passingScore: { type: Number, required: true, default: 70 },
    passed: { type: Boolean, required: true },
    /** Chosen option ids, in question order. */
    answers: { type: [String], default: [] },
    attemptNumber: { type: Number, default: 1, min: 1 },
  },
  { timestamps: true },
);
quizAttemptSchema.index({ userId: 1, courseId: 1, quizType: 1, moduleId: 1, createdAt: -1 });

export type QuizAttemptDoc = InferSchemaType<typeof quizAttemptSchema> & { _id: Types.ObjectId };
export const QuizAttempt: Model<QuizAttemptDoc> =
  (models.QuizAttempt as Model<QuizAttemptDoc>) || model<QuizAttemptDoc>("QuizAttempt", quizAttemptSchema);

// ── AssignmentSubmission: module assignment / final project / unit speaking challenge, graded by staff ──
const assignmentSubmissionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    /** null for a final project. */
    moduleId: { type: Schema.Types.ObjectId, ref: "Module", default: null },
    /** Unit speaking challenge only. */
    unitId: { type: Schema.Types.ObjectId, ref: "Unit", default: null },
    assignmentType: { type: String, required: true, enum: ["module_assignment", "final_project", "unit_challenge"] },
    submissionType: { type: String, required: true, enum: ["text", "link", "audio"] },
    /** Text or link answer (empty for audio). */
    content: { type: String, default: "" },
    /** Audio answer (unit speaking challenge): the learner's recording. */
    mediaId: { type: Schema.Types.ObjectId, ref: "Media", default: null },
    durationS: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["pending", "graded", "returned"], default: "pending" },
    grade: { type: Number, default: null, min: 0 },
    maxScore: { type: Number, default: 100, min: 1 },
    feedback: { type: String, default: "" },
    gradedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    gradedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
// One submission per learner per assignment (resubmitting updates it).
// (The older index without unitId is dropped at startup: see LEGACY_INDEXES in src/lib/db.ts.)
assignmentSubmissionSchema.index({ userId: 1, courseId: 1, moduleId: 1, unitId: 1, assignmentType: 1 }, { unique: true, name: "one_submission_per_step" });
// Grading queue.
assignmentSubmissionSchema.index({ courseId: 1, status: 1 });

export type AssignmentSubmissionDoc = InferSchemaType<typeof assignmentSubmissionSchema> & { _id: Types.ObjectId };
export const AssignmentSubmission: Model<AssignmentSubmissionDoc> =
  (models.AssignmentSubmission as Model<AssignmentSubmissionDoc>) ||
  model<AssignmentSubmissionDoc>("AssignmentSubmission", assignmentSubmissionSchema);
