"use server";

import { after } from "next/server";
import { refresh } from "next/cache";
import { staffOrThrow } from "@/lib/admin/context";
import { PaymentError, confirmPayment, saveMinutePacks } from "@/lib/payments/service";
import { sendReceipt } from "@/lib/payments/notify";

type State = { error?: string; success?: string } | undefined;

async function admin() {
  const me = await staffOrThrow();
  if (!me.isAdmin) throw new PaymentError("Only admins manage payments.");
  return me;
}

/** Asks the provider again (a notification may have been missed). */
export async function recheckPaymentAction(_: State, f: FormData): Promise<State> {
  try {
    await admin();
    const r = await confirmPayment(String(f.get("tx") ?? ""));
    if (!r) return { error: "Payment not found." };
    if (r.fulfilledNow) after(() => sendReceipt(r.payment));
    refresh();
    return { success: r.payment.status === "paid" ? (r.fulfilledNow ? "Paid: access given now." : "Paid.") : r.payment.status === "pending" ? "Still waiting for the operator." : "Not paid." };
  } catch (e) {
    return { error: e instanceof PaymentError ? e.message : "Couldn't reach the payment provider." };
  }
}

export async function saveMinutePacksAction(_: State, f: FormData): Promise<State> {
  try {
    await admin();
    const minutes = f.getAll("minutes");
    const prices = f.getAll("priceFcfa");
    await saveMinutePacks(minutes.map((m, i) => ({ minutes: m, priceFcfa: String(prices[i] ?? "").replace(/\s/g, "") })));
    refresh();
    return { success: "Packs saved." };
  } catch (e) {
    return { error: e instanceof PaymentError ? e.message : "Couldn't save the packs." };
  }
}
