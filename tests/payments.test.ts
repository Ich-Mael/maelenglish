import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AiTopUp, Course, Enrollment, Payment, StoryEntitlement, StorySeason, User } from "@/models";
import { PaymentError, confirmPayment, setPaymentProviderForTests, shopFor, startCheckout } from "@/lib/payments/service";
import { SimulatedProvider, cleanDescription, type CheckResult, type PaymentProvider } from "@/lib/payments/provider";
import { recordUsage, remainingSeconds } from "@/lib/ai/metering";

let mongo: MongoMemoryServer;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).syncIndexes()));
});
afterAll(async () => {
  setPaymentProviderForTests(undefined);
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).deleteMany({})));
  setPaymentProviderForTests(new SimulatedProvider(async (tx) => Payment.findOne({ transactionId: tx }).select("simStatus amount").lean()));
});

const urls = { notifyUrl: "https://x/api/payments/notify", returnUrl: (tx: string) => `https://x/api/payments/return?tx=${tx}` };
async function learner() {
  return String((await User.create({ name: "Awa", surname: "D", username: `awa${Math.random()}`, email: `a${Math.random()}@example.com` }))._id);
}
const pay = (tx: string, status: "paid" | "failed") => Payment.updateOne({ transactionId: tx }, { $set: { simStatus: status } });

describe("payments", () => {
  it("course: server price, access only after a confirmed payment, once", async () => {
    const u = await learner();
    const c = await Course.create({ title: "Business English", isPublished: true, price: 30002 });
    await Course.create({ title: "Draft", isPublished: false, price: 1000 });
    const shop = await shopFor(u);
    expect(shop.courses.map((x) => [x.title, x.amount])).toEqual([["Business English", 30000]]);
    const { transactionId, paymentUrl } = await startCheckout(u, "course", String(c._id), urls);
    expect(paymentUrl).toContain(transactionId);
    expect(await confirmPayment(transactionId)).toMatchObject({ fulfilledNow: false, payment: { status: "pending" } });
    expect(await Enrollment.countDocuments({ userId: u })).toBe(0);
    await pay(transactionId, "paid");
    expect((await confirmPayment(transactionId))!.fulfilledNow).toBe(true);
    expect((await confirmPayment(transactionId))!.fulfilledNow).toBe(false); // notification + return page
    expect(await Enrollment.countDocuments({ userId: u, status: "active" })).toBe(1);
    await expect(startCheckout(u, "course", String(c._id), urls)).rejects.toThrow("already have access");
  });

  it("refused payment gives nothing; unknown items are refused", async () => {
    const u = await learner();
    await StorySeason.create({ slug: "s1", title: "Accra", status: "published", priceFcfa: 5000 });
    const { transactionId } = await startCheckout(u, "story", "s1", urls);
    await pay(transactionId, "failed");
    expect((await confirmPayment(transactionId))!.payment.status).toBe("failed");
    expect(await StoryEntitlement.countDocuments({ userId: u })).toBe(0);
    await expect(startCheckout(u, "story", "nope", urls)).rejects.toThrow(PaymentError);
  });

  it("a wrong amount from the provider is never fulfilled", async () => {
    const u = await learner();
    await StorySeason.create({ slug: "s1", title: "Accra", status: "published", priceFcfa: 5000 });
    const liar: PaymentProvider = { name: "fake", init: async (p) => ({ paymentUrl: `/x/${p.transactionId}`, token: "t" }), check: async (): Promise<CheckResult> => ({ status: "paid", amount: 5, currency: "XOF", method: "OM", providerRef: "", message: "" }) };
    setPaymentProviderForTests(liar);
    const { transactionId } = await startCheckout(u, "story", "s1", urls);
    const r = await confirmPayment(transactionId);
    expect([r!.payment.status, r!.fulfilledNow]).toEqual(["pending", false]);
    expect(await StoryEntitlement.countDocuments({ userId: u })).toBe(0);
  });

  it("minute packs add bought minutes, used after the monthly allowance", async () => {
    const u = await learner();
    await User.updateOne({ _id: u }, { $set: { aiMonthlyMinutes: 1 } });
    const { transactionId } = await startCheckout(u, "minutes", "m30", urls);
    await pay(transactionId, "paid");
    await confirmPayment(transactionId);
    expect(await remainingSeconds(u)).toBe(60 + 30 * 60);
    await recordUsage(u, { kind: "conversation", feature: "roleplay", provider: "x", seconds: 120 });
    expect(await remainingSeconds(u)).toBe(30 * 60 - 60);
    expect((await AiTopUp.findOne({ userId: u }))!.secondsLeft).toBe(30 * 60 - 60);
  });

  it("descriptions are made safe for the provider", () => {
    expect(cleanDescription("MaelEnglish Équipe #1 / Accra & co_")).toBe("MaelEnglish Equipe 1 Accra co");
  });
});
