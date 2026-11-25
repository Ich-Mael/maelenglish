"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { simulatePaymentAction } from "@/app/(app)/shop-actions";

export function SimulatedCheckout({ tx }: { tx: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (o: "paid" | "failed") =>
    start(async () => {
      await simulatePaymentAction(tx, o);
      router.push(`/api/payments/return?tx=${tx}`);
    });
  return (
    <div className="flex flex-wrap justify-center gap-3">
      <button type="button" disabled={pending} onClick={() => go("paid")} className="h-11 rounded-2xl bg-primary px-5 font-semibold text-white disabled:opacity-60">
        Pay (simulated)
      </button>
      <button type="button" disabled={pending} onClick={() => go("failed")} className="h-11 rounded-2xl border-2 border-coral bg-white px-5 font-bold text-coral-dark disabled:opacity-60">
        Refuse
      </button>
    </div>
  );
}
