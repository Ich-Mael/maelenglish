import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { Payment } from "@/models";
import { confirmPayment, itemHref } from "@/lib/payments/service";
import { PaymentStatus } from "@/components/shop/payment-status";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Payment", robots: { index: false } };

async function Status({ params }: { params: Promise<{ tx: string }> }) {
  await connection();
  const { tx } = await params;
  const me = await requireUser(`/paiement/${tx}`);
  await connectDB();
  const p = await Payment.findOne({ transactionId: tx, userId: me.id }).lean();
  if (!p) notFound();
  const r = p.status === "pending" ? await confirmPayment(tx).catch(() => null) : null;
  const status = r?.payment.status ?? p.status;
  return (
    <div className="mx-auto max-w-lg rounded-3xl border-2 border-border bg-card p-8">
      <PaymentStatus tx={tx} initial={status} href={itemHref(p)} label={p.label} />
    </div>
  );
}

export default function Page({ params }: { params: Promise<{ tx: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Status params={params} />
    </Suspense>
  );
}
