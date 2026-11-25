"use client";

import { useState, useTransition } from "react";
import { Loader2, Lock } from "lucide-react";
import { startCheckoutAction } from "@/app/(app)/shop-actions";
import { cn } from "cn";

/** Opens the secure payment page (CinetPay: Orange Money, Moov Money, cards). */
export function BuyButton({ kind, itemId, label = "Buy", className }: { kind: string; itemId: string; label?: string; className?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div className="grid gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError("");
            const r = await startCheckoutAction(kind, itemId);
            if (r.ok) window.location.assign(r.url);
            else setError(r.error);
          })
        }
        className={cn("inline-flex h-11 items-center justify-center gap-2 rounded-2xl border-2 border-coral bg-white px-5 text-[19px] font-bold text-coral shadow-[0_4px_0_0_var(--color-coral)] hover:bg-coral-soft disabled:opacity-60", className)}
      >
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Lock className="size-4" aria-hidden />} {label}
      </button>
      {error && <p className="text-sm font-semibold text-coral-dark">{error}</p>}
    </div>
  );
}
