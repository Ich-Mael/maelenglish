"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { paymentStatusAction } from "@/app/(app)/shop-actions";

/** Waits for the provider's confirmation (checks every 4 s for up to 3 minutes). */
export function PaymentStatus({ tx, initial, href, label }: { tx: string; initial: string; href: string; label: string }) {
  const [status, setStatus] = useState(initial);
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (status !== "pending" || tries > 45) return;
    const t = setTimeout(async () => {
      const r = await paymentStatusAction(tx);
      if (r) setStatus(r.status);
      setTries((n) => n + 1);
    }, 4000);
    return () => clearTimeout(t);
  }, [status, tries, tx]);

  if (status === "paid")
    return (
      <div className="grid justify-items-center gap-3 text-center">
        <CheckCircle2 className="size-16 text-primary" aria-hidden />
        <h1 className="text-2xl font-extrabold text-brand-deep">Payment confirmed!</h1>
        <p className="text-muted-foreground">Your access is open: {label}. A receipt was sent to your email.</p>
        <Link href={href} className="inline-flex h-12 items-center rounded-2xl border-2 border-coral bg-white px-6 text-[19px] font-bold text-coral shadow-[0_4px_0_0_var(--color-coral)] hover:bg-coral-soft">
          Start now
        </Link>
      </div>
    );
  if (status === "failed" || status === "cancelled")
    return (
      <div className="grid justify-items-center gap-3 text-center">
        <XCircle className="size-16 text-coral" aria-hidden />
        <h1 className="text-2xl font-extrabold text-brand-deep">The payment didn&apos;t go through</h1>
        <p className="text-muted-foreground">Nothing was charged for this attempt. You can try again, or with another payment method.</p>
        <Link href="/boutique" className="inline-flex h-11 items-center rounded-2xl bg-primary px-5 font-semibold text-white">
          Back to the shop
        </Link>
      </div>
    );
  return (
    <div className="grid justify-items-center gap-3 text-center">
      <Loader2 className="size-14 animate-spin text-primary" aria-hidden />
      <h1 className="text-2xl font-extrabold text-brand-deep">Waiting for the confirmation…</h1>
      <p className="max-w-md text-muted-foreground">
        {tries > 45 ? "It's taking longer than usual. If you approved the payment on your phone, your access will open as soon as the operator confirms it — you can leave this page." : "Approve the payment on your phone if asked (Orange Money / Moov Money). This page updates by itself."}
      </p>
    </div>
  );
}
