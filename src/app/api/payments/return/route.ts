import { after, type NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { appUrl } from "@/lib/email";
import { confirmPayment } from "@/lib/payments/service";
import { sendReceipt } from "@/lib/payments/notify";

/* Back from the checkout (GET or POST): re-check the payment, then show its status page. */
async function handle(req: NextRequest) {
  let tx = req.nextUrl.searchParams.get("tx") ?? "";
  if (!tx && req.method === "POST") {
    try {
      const f = await req.formData();
      tx = String(f.get("transaction_id") ?? f.get("cpm_trans_id") ?? "");
    } catch {
      /* no body */
    }
  }
  if (!/^[A-Z0-9]{8,64}$/i.test(tx)) return Response.redirect(appUrl("/boutique"), 303);
  await connectDB();
  try {
    const r = await confirmPayment(tx);
    if (r?.fulfilledNow) after(() => sendReceipt(r.payment));
  } catch (e) {
    console.error("[payments] return", tx, e);
  }
  return Response.redirect(appUrl(`/paiement/${tx}`), 303);
}
export const GET = handle;
export const POST = handle;
