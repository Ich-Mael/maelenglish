import { Schema } from "mongoose";

/**
 * Multiple-choice question, shared by lesson practice quizzes, module quizzes
 * and final exams. `correctOptionId` must be the `id` of one of `options`.
 */
export const quizQuestionSchema = new Schema(
  {
    text: { type: String, required: true, trim: true },
    options: {
      type: [
        new Schema(
          {
            id: { type: String, required: true },
            text: { type: String, required: true, trim: true },
          },
          { _id: false },
        ),
      ],
      validate: {
        validator: (v: unknown[]) => Array.isArray(v) && v.length >= 2,
        message: "Une question doit proposer au moins 2 réponses.",
      },
    },
    correctOptionId: {
      type: String,
      required: true,
      validate: {
        validator: function (this: { options?: { id: string }[] }, v: string) {
          return (this.options ?? []).some((o) => o.id === v);
        },
        message: "La bonne réponse doit faire partie des réponses proposées.",
      },
    },
    explanation: { type: String, default: "" },
  },
  { _id: true },
);

/** Graded quiz block (module quiz, final exam). `timeLimit` in minutes, 0 = none. */
export const gradedQuizFields = {
  title: { type: String, default: "" },
  passingScore: { type: Number, default: 70, min: 0, max: 100 },
  timeLimit: { type: Number, default: 0, min: 0 },
  questions: { type: [quizQuestionSchema], default: [] },
};

/** Manually graded written task (module assignment, final project). */
export const assignmentFields = {
  title: { type: String, default: "" },
  instructions: { type: String, default: "" },
  submissionType: { type: String, enum: ["text", "link"], default: "text" },
  maxScore: { type: Number, default: 100, min: 1 },
};
