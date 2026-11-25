import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { defineModel } from "./define";

/*
 * MaelEnglish Coaching (owner decisions 2026-11-24): a private space between a coach and the
 * person — or the group — they coach. Goals, feedback (group thread + private threads), resources,
 * tasks on existing content (courses, Lab activities, speaking challenges, Talk with Coach Ish
 * role-plays) and live sessions (embedded video, screen sharing). Every item with `forUserId`
 * empty is for the whole coaching; set, it's only for that member (and the coach).
 */

const forUser = { type: Schema.Types.ObjectId, ref: "User", default: null };

const coachingSchema = new Schema(
  {
    kind: { type: String, enum: ["individual", "group"], default: "individual" },
    memberIds: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    coachId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    /** The objective and its deadline (rich text, French). */
    goal: { type: String, default: "" },
    status: { type: String, enum: ["active", "paused", "completed"], default: "active" },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    sessionsPlanned: { type: Number, default: null, min: 0 },
    /** Fallback video link (Zoom / Google Meet) when the embedded call isn't configured. */
    meetingUrl: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);
coachingSchema.index({ memberIds: 1 });
coachingSchema.index({ coachId: 1, status: 1 });
export type CoachingDoc = InferSchemaType<typeof coachingSchema> & { _id: Types.ObjectId };
export const Coaching: Model<CoachingDoc> = defineModel<CoachingDoc>("Coaching", coachingSchema);

const goalSchema = new Schema(
  {
    coachingId: { type: Schema.Types.ObjectId, ref: "Coaching", required: true },
    forUserId: forUser,
    title: { type: String, required: true, trim: true, maxlength: 200 },
    details: { type: String, default: "", maxlength: 2000 },
    status: { type: String, enum: ["todo", "in_progress", "done"], default: "todo" },
    /** For a group goal: each member's own status (userId → status). */
    memberStatus: { type: Map, of: String, default: {} },
    targetDate: { type: Date, default: null },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);
goalSchema.index({ coachingId: 1, order: 1 });
export type CoachingGoalDoc = InferSchemaType<typeof goalSchema> & { _id: Types.ObjectId };
export const CoachingGoal: Model<CoachingGoalDoc> = defineModel<CoachingGoalDoc>("CoachingGoal", goalSchema);

/** The feedback timeline: `forUserId` empty = the group thread; set = the private thread of that member with the coach. */
const entrySchema = new Schema(
  {
    coachingId: { type: Schema.Types.ObjectId, ref: "Coaching", required: true },
    forUserId: forUser,
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, enum: ["feedback", "message", "session_summary"], default: "message" },
    /** Rich text (normalizeRich). */
    text: { type: String, default: "" },
    /** Voice note (Media voice-note from the coach, recording from a member). */
    audioMediaId: { type: Schema.Types.ObjectId, ref: "Media", default: null },
    readBy: { type: [Schema.Types.ObjectId], default: [] },
  },
  { timestamps: true },
);
entrySchema.index({ coachingId: 1, createdAt: -1 });
export type CoachingEntryDoc = InferSchemaType<typeof entrySchema> & { _id: Types.ObjectId };
export const CoachingEntry: Model<CoachingEntryDoc> = defineModel<CoachingEntryDoc>("CoachingEntry", entrySchema);

const resourceSchema = new Schema(
  {
    coachingId: { type: Schema.Types.ObjectId, ref: "Coaching", required: true },
    forUserId: forUser,
    kind: { type: String, enum: ["file", "link", "video"], default: "link" },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    note: { type: String, default: "", maxlength: 1000 },
    url: { type: String, default: "" },
    mediaId: { type: Schema.Types.ObjectId, ref: "Media", default: null },
    addedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);
resourceSchema.index({ coachingId: 1, createdAt: -1 });
export type CoachingResourceDoc = InferSchemaType<typeof resourceSchema> & { _id: Types.ObjectId };
export const CoachingResource: Model<CoachingResourceDoc> = defineModel<CoachingResourceDoc>("CoachingResource", resourceSchema);

/** Existing content assigned in the coaching. Status is computed per member from progress records. */
const taskSchema = new Schema(
  {
    coachingId: { type: Schema.Types.ObjectId, ref: "Coaching", required: true },
    forUserId: forUser,
    kind: { type: String, enum: ["course", "lab", "challenge", "roleplay"], required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", default: null },
    activityId: { type: Schema.Types.ObjectId, ref: "Activity", default: null },
    note: { type: String, default: "", maxlength: 1000 },
    dueDate: { type: Date, default: null },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);
taskSchema.index({ coachingId: 1, order: 1 });
export type CoachingTaskDoc = InferSchemaType<typeof taskSchema> & { _id: Types.ObjectId };
export const CoachingTask: Model<CoachingTaskDoc> = defineModel<CoachingTaskDoc>("CoachingTask", taskSchema);

/** Progress on a Lab task (no course step behind it): best score and attempts. */
const taskProgressSchema = new Schema(
  {
    taskId: { type: Schema.Types.ObjectId, ref: "CoachingTask", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    score: { type: Number, default: null },
    attempts: { type: Number, default: 0 },
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
taskProgressSchema.index({ taskId: 1, userId: 1 }, { unique: true });
export type CoachingTaskProgressDoc = InferSchemaType<typeof taskProgressSchema> & { _id: Types.ObjectId };
export const CoachingTaskProgress: Model<CoachingTaskProgressDoc> = defineModel<CoachingTaskProgressDoc>("CoachingTaskProgress", taskProgressSchema);

/** A speaking challenge done in a coaching, and the coach's review. */
const submissionSchema = new Schema(
  {
    coachingId: { type: Schema.Types.ObjectId, ref: "Coaching", required: true },
    taskId: { type: Schema.Types.ObjectId, ref: "CoachingTask", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    mediaId: { type: Schema.Types.ObjectId, ref: "Media", default: null },
    durationS: { type: Number, default: 0 },
    status: { type: String, enum: ["pending", "validated", "returned"], default: "pending" },
    comment: { type: String, default: "" },
    feedbackAudioMediaId: { type: Schema.Types.ObjectId, ref: "Media", default: null },
    grade: { type: Number, default: null },
    submittedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date, default: null },
    /** Earlier sends with their review. */
    history: { type: [Schema.Types.Mixed], default: [] },
  },
  { timestamps: true },
);
submissionSchema.index({ taskId: 1, userId: 1 }, { unique: true });
export type CoachingSubmissionDoc = InferSchemaType<typeof submissionSchema> & { _id: Types.ObjectId };
export const CoachingSubmission: Model<CoachingSubmissionDoc> = defineModel<CoachingSubmissionDoc>("CoachingSubmission", submissionSchema);

/** A live session (embedded video call, screen sharing). `forUserId` set = an individual check-in inside a group. */
const sessionSchema = new Schema(
  {
    coachingId: { type: Schema.Types.ObjectId, ref: "Coaching", required: true },
    forUserId: forUser,
    title: { type: String, default: "", maxlength: 120 },
    startsAt: { type: Date, required: true },
    durationMin: { type: Number, default: 60, min: 15, max: 240 },
    status: { type: String, enum: ["scheduled", "done", "cancelled", "missed"], default: "scheduled" },
    roomName: { type: String, default: "" },
    roomUrl: { type: String, default: "" },
    summary: { type: String, default: "" },
    remindersSent: { type: [String], default: [] },
  },
  { timestamps: true },
);
sessionSchema.index({ coachingId: 1, startsAt: 1 });
sessionSchema.index({ status: 1, startsAt: 1 });
export type CoachingSessionDoc = InferSchemaType<typeof sessionSchema> & { _id: Types.ObjectId };
export const CoachingSession: Model<CoachingSessionDoc> = defineModel<CoachingSessionDoc>("CoachingSession", sessionSchema);

/** Daily vocabulary of a coaching (owner decision 2026-11-24): 3 words / expressions a day for the coaching's goal, shared by the group. */
const vocabItemSchema = new Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true, maxlength: 120 },
    translation: { type: String, default: "", maxlength: 160 },
    frNote: { type: String, default: "", maxlength: 400 },
    example: { type: String, default: "", maxlength: 300 },
    exampleFr: { type: String, default: "", maxlength: 300 },
  },
  { _id: false },
);
const vocabSchema = new Schema(
  {
    coachingId: { type: Schema.Types.ObjectId, ref: "Coaching", required: true },
    /** YYYY-MM-DD in APP_TZ. */
    day: { type: String, required: true },
    items: { type: [vocabItemSchema], default: [] },
    source: { type: String, default: "ai" },
  },
  { timestamps: true },
);
vocabSchema.index({ coachingId: 1, day: 1 }, { unique: true });
export type CoachingVocabDoc = InferSchemaType<typeof vocabSchema> & { _id: Types.ObjectId };
export const CoachingVocab: Model<CoachingVocabDoc> = defineModel<CoachingVocabDoc>("CoachingVocab", vocabSchema);

/** A member's own sentence with a daily expression (2 per expression), corrected; the whole group reads them. */
const sentenceSchema = new Schema(
  {
    coachingId: { type: Schema.Types.ObjectId, ref: "Coaching", required: true },
    vocabId: { type: Schema.Types.ObjectId, ref: "CoachingVocab", required: true },
    itemId: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, maxlength: 300 },
    /** AI check (null when it wasn't available). */
    ok: { type: Boolean, default: null },
    corrected: { type: String, default: "" },
    explanation: { type: String, default: "" },
  },
  { timestamps: true },
);
sentenceSchema.index({ vocabId: 1, itemId: 1, createdAt: 1 });
sentenceSchema.index({ coachingId: 1, userId: 1 });
export type CoachingSentenceDoc = InferSchemaType<typeof sentenceSchema> & { _id: Types.ObjectId };
export const CoachingSentence: Model<CoachingSentenceDoc> = defineModel<CoachingSentenceDoc>("CoachingSentence", sentenceSchema);
