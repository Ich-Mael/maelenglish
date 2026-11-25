import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { defineModel } from "./define";

/*
 * Online payments (owner decisions 2026-11-24): CinetPay (Orange Money, Moov Money, cards), one-time
 * prices, signed-in learners only, for a course, a Story Mode season or a pack of AI minutes. The
 * amount is always set by the server from the item's price; access is given once, after the
 * provider confirms the payment (`fulfilledAt`).
 */
export const PAYMENT_KINDS = ["course", "story", "minutes"] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

const paymentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, enum: PAYMENT_KINDS, required: true },
    /** courseId, season slug, or minute pack id. */
    itemId: { type: String, required: true },
    label: { type: String, required: true },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, default: "XOF" },
    /** Our reference, sent to the provider (unique). */
    transactionId: { type: String, required: true, unique: true },
    provider: { type: String, required: true },
    status: { type: String, enum: ["pending", "paid", "failed", "cancelled"], default: "pending" },
    paymentUrl: { type: String, default: "" },
    method: { type: String, default: "" },
    providerRef: { type: String, default: "" },
    paidAt: { type: Date, default: null },
    fulfilledAt: { type: Date, default: null },
    error: { type: String, default: "" },
    /** For a minutes pack: the minutes bought. */
    minutes: { type: Number, default: null },
    /** Simulation mode (development): the outcome chosen on the fake checkout page. */
    simStatus: { type: String, default: "" },
    lastCheckedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });
export type PaymentDoc = InferSchemaType<typeof paymentSchema> & { _id: Types.ObjectId };
export const Payment: Model<PaymentDoc> = defineModel<PaymentDoc>("Payment", paymentSchema);

/** AI minutes bought: used once the monthly minutes are spent, valid 90 days. */
const topUpSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment", default: null },
    seconds: { type: Number, required: true, min: 0 },
    secondsLeft: { type: Number, required: true, min: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
topUpSchema.index({ userId: 1, expiresAt: 1 });
export type AiTopUpDoc = InferSchemaType<typeof topUpSchema> & { _id: Types.ObjectId };
export const AiTopUp: Model<AiTopUpDoc> = defineModel<AiTopUpDoc>("AiTopUp", topUpSchema);
