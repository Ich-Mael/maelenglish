import { User, type PaymentDoc } from "@/models";
import { appUrl, sendPaymentReceiptEmail } from "@/lib/email";
import { itemHref } from "./service";

const fcfa = (n: number) => `${new Intl.NumberFormat("fr-FR").format(n).replace(/ | /g, " ")} FCFA`;

/** Receipt email to the buyer once access is given (never blocks; needs an email address). */
export async function sendReceipt(p: PaymentDoc) {
  try {
    const u = await User.findById(p.userId).select("name email").lean();
    if (!u?.email) return;
    await sendPaymentReceiptEmail(u.email, {
      firstName: u.name,
      label: p.label,
      amount: fcfa(p.amount),
      reference: p.transactionId,
      method: p.method,
      date: new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: process.env.APP_TZ || "Africa/Ouagadougou" }).format(p.paidAt ?? new Date()),
      url: appUrl(itemHref(p)),
      button: p.kind === "course" ? "Commencer le cours" : p.kind === "story" ? "Commencer la saison" : "Parler avec Coach Ish",
    });
  } catch (e) {
    console.error("[payments] receipt", e);
  }
}

export { fcfa };
