import { randomBytes } from "node:crypto";
import { Types } from "mongoose";
import { AiTopUp, AppSettings, Course, Enrollment, Payment, StoryEntitlement, StorySeason, User, accessState, type PaymentDoc, type PaymentKind } from "@/models";
import { CinetPayProvider, SimulatedProvider, isCinetPayConfigured, type PaymentProvider } from "./provider";

/*
 * Online payments (owner decisions 2026-11-24). Framework-free (tests/payments.test.ts).
 * - Only signed-in learners pay; one-time prices: a course (`Course.price`, published), a Story
 *   Mode season (`StorySeason.priceFcfa`, published) or a pack of AI minutes (`AppSettings.minutePacks`).
 * - The amount always comes from the server. Access is given by `confirmPayment`, only after the
 *   provider's server-side check says « paid » with the same amount — and only once (`fulfilledAt`).
 */

export class PaymentError extends Error {}

export const TOP_UP_DAYS = 90;
const DAY = 86_400_000;

let override: PaymentProvider | null | undefined;
export const setPaymentProviderForTests = (p: PaymentProvider | null | undefined) => {
  override = p;
};
/** CinetPay when configured; the simulated checkout outside production; else null (payments off). */
export function paymentProvider(): PaymentProvider | null {
  if (override !== undefined) return override;
  if (isCinetPayConfigured()) return new CinetPayProvider(process.env.CINETPAY_API_KEY!, process.env.CINETPAY_SITE_ID!);
  if (process.env.NODE_ENV !== "production") return new SimulatedProvider(async (tx) => Payment.findOne({ transactionId: tx }).select("simStatus amount").lean());
  return null;
}

export type MinutePack = { id: string; minutes: number; priceFcfa: number };
export async function minutePacks(): Promise<MinutePack[]> {
  const s = await AppSettings.findOne({ key: "global" }).select("minutePacks").lean();
  return (s?.minutePacks ?? [{ id: "m30", minutes: 30, priceFcfa: 2500 }, { id: "m60", minutes: 60, priceFcfa: 4500 }]).map((p) => ({ id: p.id, minutes: p.minutes, priceFcfa: p.priceFcfa }));
}

/** Admin: up to 4 packs, prices rounded to 5 FCFA (CinetPay). */
export async function saveMinutePacks(raw: { minutes: unknown; priceFcfa: unknown }[]) {
  const packs = raw
    .map((p) => ({ minutes: Math.round(Number(p.minutes)), priceFcfa: Math.round(Number(p.priceFcfa) / 5) * 5 }))
    .filter((p) => p.minutes > 0 && p.priceFcfa >= 100)
    .slice(0, 4)
    .map((p) => ({ id: `m${p.minutes}`, ...p }));
  if (new Set(packs.map((p) => p.id)).size !== packs.length) throw new PaymentError("Two packs have the same number of minutes.");
  await AppSettings.updateOne({ key: "global" }, { $set: { minutePacks: packs } }, { upsert: true });
}

/** CinetPay takes amounts in multiples of 5 XOF. */
const amountOf = (n: number | null | undefined) => (n && n > 0 ? Math.round(n / 5) * 5 : 0);

export type ShopItem = { kind: PaymentKind; itemId: string; title: string; subtitle: string; amount: number; owned: boolean; image: string };

/** What a learner can buy: priced published courses and seasons (marked when already owned), and the minute packs. */
export async function shopFor(userId: string, now = new Date()): Promise<{ courses: ShopItem[]; seasons: ShopItem[]; packs: ShopItem[] }> {
  const [courses, seasons, packs, enrolments, ents] = await Promise.all([
    Course.find({ isPublished: true, price: { $gt: 0 } }).select("title description imageUrl price level isChallenge").sort({ title: 1 }).lean(),
    StorySeason.find({ status: "published", priceFcfa: { $gt: 0 } }).select("slug title learningGoal level priceFcfa").sort({ title: 1 }).lean(),
    minutePacks(),
    Enrollment.find({ userId }).select("courseId status startDate endDate").lean(),
    StoryEntitlement.find({ userId }).select("storyId expiresAt").lean(),
  ]);
  const ownsCourse = (id: string) => enrolments.some((e) => String(e.courseId) === id && ["active", "not-started"].includes(accessState(e, now)));
  const ownsSeason = (slug: string) => ents.some((e) => e.storyId === slug && (!e.expiresAt || e.expiresAt > now));
  return {
    courses: courses.map((c) => ({ kind: "course" as const, itemId: String(c._id), title: c.title, subtitle: c.isChallenge ? "MaelEnglish Challenge" : "Course", amount: amountOf(c.price), owned: ownsCourse(String(c._id)), image: c.imageUrl ?? "" })),
    seasons: seasons.map((s) => ({ kind: "story" as const, itemId: s.slug, title: s.title, subtitle: [s.level, s.learningGoal].filter(Boolean).join(" · "), amount: amountOf(s.priceFcfa), owned: ownsSeason(s.slug), image: "" })),
    packs: packs.map((p) => ({ kind: "minutes" as const, itemId: p.id, title: `${p.minutes} minutes with Coach Ish`, subtitle: `Valid ${TOP_UP_DAYS} days, used after your monthly minutes`, amount: amountOf(p.priceFcfa), owned: false, image: "" })),
  };
}

/** The item as sold now (server price), or an error when it can't be bought. */
async function itemFor(userId: string, kind: PaymentKind, itemId: string, now: Date) {
  const shop = await shopFor(userId, now);
  const list = kind === "course" ? shop.courses : kind === "story" ? shop.seasons : shop.packs;
  const item = list.find((i) => i.itemId === itemId);
  if (!item || !item.amount) throw new PaymentError("This item can't be bought.");
  if (item.owned) throw new PaymentError(kind === "course" ? "You already have access to this course." : "You already have this season.");
  const minutes = kind === "minutes" ? (await minutePacks()).find((p) => p.id === itemId)?.minutes ?? null : null;
  return { ...item, minutes };
}

const newTransactionId = () => `ME${Date.now().toString(36).toUpperCase()}${randomBytes(4).toString("hex").toUpperCase()}`;

/** Creates the payment and returns the provider's checkout URL. */
export async function startCheckout(userId: string, kind: PaymentKind, itemId: string, urls: { notifyUrl: string; returnUrl: (tx: string) => string }, now = new Date()) {
  const provider = paymentProvider();
  if (!provider) throw new PaymentError("Online payment isn't available yet. Contact us on WhatsApp to pay.");
  const user = await User.findById(userId).select("name surname email phoneE164 phoneNumber isActive").lean();
  if (!user || user.isActive === false) throw new PaymentError("Account not found.");
  // Too many unfinished checkouts in a short time: probably a loop or abuse.
  if ((await Payment.countDocuments({ userId, status: "pending", createdAt: { $gt: new Date(now.getTime() - 3600_000) } })) >= 10) throw new PaymentError("Too many payments started: try again in an hour.");
  const item = await itemFor(userId, kind, itemId, now);
  const transactionId = newTransactionId();
  const p = await Payment.create({ userId, kind, itemId, label: item.title, amount: item.amount, transactionId, provider: provider.name, minutes: item.minutes });
  try {
    const r = await provider.init({
      transactionId,
      amount: item.amount,
      description: `MaelEnglish ${item.title}`,
      notifyUrl: urls.notifyUrl,
      returnUrl: urls.returnUrl(transactionId),
      customer: { id: userId, name: user.name, surname: user.surname ?? "", email: user.email ?? "", phone: (user.phoneE164 ?? "").replace(/^\+/, "") },
    });
    await Payment.updateOne({ _id: p._id }, { $set: { paymentUrl: r.paymentUrl, providerRef: r.token } });
    return { transactionId, paymentUrl: r.paymentUrl };
  } catch (e) {
    await Payment.updateOne({ _id: p._id }, { $set: { status: "failed", error: (e as Error).message.slice(0, 300) } });
    console.error("[payments] init", e);
    throw new PaymentError("The payment page couldn't be opened: try again in a moment.");
  }
}

/** Gives what was bought. Idempotent: claims `fulfilledAt` first. */
async function fulfill(p: PaymentDoc, now: Date) {
  const claimed = await Payment.findOneAndUpdate({ _id: p._id, status: "paid", fulfilledAt: null }, { $set: { fulfilledAt: now } }, { returnDocument: "after" }).lean();
  if (!claimed) return false;
  if (p.kind === "course") {
    const course = await Course.findById(p.itemId).select("endDate").lean();
    // Access from today until the course's end date (open when it's past or unset).
    const end = course?.endDate && course.endDate > now ? course.endDate : null;
    await Enrollment.updateOne({ userId: p.userId, courseId: new Types.ObjectId(p.itemId) }, { $set: { status: "active", startDate: now, endDate: end, suspendedReason: "" } }, { upsert: true });
  } else if (p.kind === "story") {
    await StoryEntitlement.updateOne({ userId: p.userId, storyId: p.itemId }, { $set: { source: "purchase", startsAt: now, expiresAt: null } }, { upsert: true });
  } else {
    const seconds = Math.max(0, (p.minutes ?? 0) * 60);
    await AiTopUp.create({ userId: p.userId, paymentId: p._id, seconds, secondsLeft: seconds, expiresAt: new Date(now.getTime() + TOP_UP_DAYS * DAY) });
  }
  return true;
}

/**
 * Asks the provider for the real status and applies it. Safe to call many times (notification,
 * return page, admin « check again »). Returns the updated payment and whether access was given now.
 */
export async function confirmPayment(transactionId: string, now = new Date()): Promise<{ payment: PaymentDoc; fulfilledNow: boolean } | null> {
  const p = await Payment.findOne({ transactionId }).lean<PaymentDoc>();
  if (!p) return null;
  if (p.status === "paid") return { payment: p, fulfilledNow: p.fulfilledAt ? false : await fulfill(p, now) };
  if (p.status !== "pending") return { payment: p, fulfilledNow: false };
  const provider = paymentProvider();
  if (!provider || provider.name !== p.provider) return { payment: p, fulfilledNow: false };
  const r = await provider.check(transactionId);
  await Payment.updateOne({ _id: p._id }, { $set: { lastCheckedAt: now } });
  if (r.status === "pending") return { payment: p, fulfilledNow: false };
  if (r.status === "failed") {
    const f = await Payment.findOneAndUpdate({ _id: p._id, status: "pending" }, { $set: { status: "failed", error: r.message.slice(0, 300) } }, { returnDocument: "after" }).lean<PaymentDoc>();
    return { payment: f ?? p, fulfilledNow: false };
  }
  // Paid: the amount must be the one we asked for.
  if (r.amount !== p.amount || (r.currency && r.currency !== "XOF")) {
    await Payment.updateOne({ _id: p._id }, { $set: { error: `Amount mismatch: ${r.amount} ${r.currency}` } });
    console.error("[payments] amount mismatch", transactionId, r.amount, r.currency);
    return { payment: p, fulfilledNow: false };
  }
  const paid = await Payment.findOneAndUpdate({ _id: p._id, status: "pending" }, { $set: { status: "paid", paidAt: now, method: r.method, ...(r.providerRef ? { providerRef: r.providerRef } : {}) } }, { returnDocument: "after" }).lean<PaymentDoc>();
  if (!paid) {
    const again = await Payment.findById(p._id).lean<PaymentDoc>();
    return { payment: again ?? p, fulfilledNow: false };
  }
  return { payment: paid, fulfilledNow: await fulfill(paid, now) };
}

/** Where the learner goes after paying. */
export function itemHref(p: Pick<PaymentDoc, "kind" | "itemId">) {
  return p.kind === "course" ? `/apprendre/${p.itemId}` : p.kind === "story" ? `/histoire/${p.itemId}` : "/partenaire";
}

/** Admin list with totals. */
export async function listPayments(filter: { status?: string; q?: string } = {}, limit = 200) {
  const q: Record<string, unknown> = {};
  if (filter.status) q.status = filter.status;
  if (filter.q) q.$or = [{ transactionId: new RegExp(filter.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }, { label: new RegExp(filter.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }];
  const [rows, totals] = await Promise.all([
    Payment.find(q).sort({ createdAt: -1 }).limit(limit).lean<PaymentDoc[]>(),
    Payment.aggregate<{ _id: string; amount: number; n: number }>([{ $match: { status: "paid", paidAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } }, { $group: { _id: "$kind", amount: { $sum: "$amount" }, n: { $sum: 1 } } }]),
  ]);
  return { rows, totals };
}
