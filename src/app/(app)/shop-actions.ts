"use server";

import { after } from "next/server";
import { refresh } from "next/cache";
import { readCurrentUser } from "@/lib/auth/dal";
import { appUrl } from "@/lib/email";
import { Payment, PAYMENT_KINDS, type PaymentKind } from "@/models";
import { PaymentError, confirmPayment, itemHref, startCheckout } from "@/lib/payments/service";
import { sendReceipt } from "@/lib/payments/notify";

/* Shop actions (learners). Prices and access are decided by the server (src/lib/payments/service.ts). */

export async function startCheckoutAction(kind: string, itemId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const me = await readCurrentUser();
    if (!me) throw new PaymentError("Your session has expired: sign in again.");
    if (!PAYMENT_KINDS.includes(kind as PaymentKind)) throw new PaymentError("This item can't be bought.");
    const r = await startCheckout(me.id, kind as PaymentKind, String(itemId).slice(0, 80), { notifyUrl: appUrl("/api/payments/notify"), returnUrl: (tx) => appUrl(`/api/payments/return?tx=${tx}`) });
    return { ok: true, url: r.paymentUrl };
  } catch (e) {
    if (!(e instanceof PaymentError)) console.error("[shop]", e);
    return { ok: false, error: e instanceof PaymentError ? e.message : "Something went wrong: try again in a moment." };
  }
}

/** The status of one of the learner's own payments (re-checked with the provider while pending). */
export async function paymentStatusAction(tx: string): Promise<{ status: string; href: string } | null> {
  const me = await readCurrentUser();
  if (!me) return null;
  const own = await Payment.findOne({ transactionId: String(tx).slice(0, 64), userId: me.id }).select("_id").lean();
  if (!own) return null;
  const r = await confirmPayment(String(tx));
  if (!r) return null;
  if (r.fulfilledNow) after(() => sendReceipt(r.payment));
  if (r.payment.status !== "pending") refresh();
  return { status: r.payment.status, href: itemHref(r.payment) };
}

/** Development only: the simulated checkout's « Pay » / « Refuse ». */
export async function simulatePaymentAction(tx: string, outcome: "paid" | "failed") {
  if (process.env.NODE_ENV === "production") return { ok: false };
  const me = await readCurrentUser();
  if (!me) return { ok: false };
  await Payment.updateOne({ transactionId: String(tx), userId: me.id, provider: "simulation", status: "pending" }, { $set: { simStatus: outcome === "paid" ? "paid" : "failed" } });
  return { ok: true };
}
