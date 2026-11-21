import { Schema } from "mongoose";

/**
 * Multiple-choice question of the course final exam. `correctOptionId` must be the `id` of one of `options`.
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
        message: "A question needs at least 2 answers.",
      },
    },
    correctOptionId: {
      type: String,
      required: true,
      validate: {
        validator: function (this: { options?: { id: string }[] }, v: string) {
          return (this.options ?? []).some((o) => o.id === v);
        },
        message: "The correct answer must be one of the answers.",
      },
    },
    explanation: { type: String, default: "" },
  },
  { _id: true },
);

/** Graded quiz block (course final exam). `timeLimit` in minutes, 0 = none. */
export const gradedQuizFields = {
  title: { type: String, default: "" },
  passingScore: { type: Number, default: 70, min: 0, max: 100 },
  timeLimit: { type: Number, default: 0, min: 0 },
  questions: { type: [quizQuestionSchema], default: [] },
};
