import { after, type NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { confirmPayment } from "@/lib/payments/service";
import { sendReceipt } from "@/lib/payments/notify";

/*
 * Payment notification (CinetPay calls it server-to-server). The body only tells us WHICH
 * transaction changed: the status is always re-read from the provider (`confirmPayment`).
 */
async function transactionOf(req: NextRequest): Promise<string> {
  const type = req.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) {
      const j = (await req.json()) as Record<string, unknown>;
      return String(j.cpm_trans_id ?? j.transaction_id ?? "");
    }
    const f = await req.formData();
    return String(f.get("cpm_trans_id") ?? f.get("transaction_id") ?? "");
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  const tx = (await transactionOf(req)).slice(0, 64);
  if (!/^[A-Z0-9]{8,64}$/i.test(tx)) return new Response("OK", { status: 200 });
  await connectDB();
  try {
    const r = await confirmPayment(tx);
    if (r?.fulfilledNow) after(() => sendReceipt(r.payment));
  } catch (e) {
    console.error("[payments] notify", tx, e);
    return new Response("RETRY", { status: 500 });
  }
  return new Response("OK", { status: 200 });
}

/** The provider checks that the URL answers. */
export function GET() {
  return new Response("OK", { status: 200 });
}
