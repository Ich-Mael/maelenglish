import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { Payment } from "@/models";
import { fcfa } from "@/lib/payments/notify";
import { SimulatedCheckout } from "@/components/shop/simulated-checkout";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Simulated payment", robots: { index: false } };

/* Development only: stands in for the CinetPay checkout when no keys are set. */
async function Sim({ params }: { params: Promise<{ tx: string }> }) {
  await connection();
  if (process.env.NODE_ENV === "production") notFound();
  const { tx } = await params;
  const me = await requireUser(`/paiement/simulation/${tx}`);
  await connectDB();
  const p = await Payment.findOne({ transactionId: tx, userId: me.id, provider: "simulation" }).lean();
  if (!p) notFound();
  return (
    <div className="mx-auto grid max-w-md gap-4 rounded-3xl border-2 border-dashed border-primary/40 bg-card p-8 text-center">
      <p className="text-xs font-bold tracking-wide text-coral-dark uppercase">Simulated checkout · development</p>
      <h1 className="text-2xl font-extrabold text-brand-deep">{p.label}</h1>
      <p className="font-heading text-3xl font-extrabold text-primary">{fcfa(p.amount)}</p>
      <p className="text-sm text-muted-foreground">With CinetPay keys, this is the real payment page (Orange Money, Moov Money, card).</p>
      <SimulatedCheckout tx={tx} />
    </div>
  );
}

export default function Page({ params }: { params: Promise<{ tx: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Sim params={params} />
    </Suspense>
  );
}
