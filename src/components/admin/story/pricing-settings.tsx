"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { btn } from "@/components/admin/ui";
import type { StoryPricing } from "@/lib/story/pricing";
import { savePricingSettingsAction } from "@/app/admin/story/actions";
import { Num } from "./fields";

/* Global Story Mode pricing settings (admins). */
export function PricingSettingsForm({ initial }: { initial: StoryPricing }) {
  const [p, setP] = useState(initial);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const set = (k: keyof StoryPricing) => (v: number | null) => setP({ ...p, [k]: v ?? 0 });
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Num label="Conversation ($ / min)" step={0.001} value={p.convUsdPerMin} onChange={set("convUsdPerMin")} hint="Used when no ElevenLabs plan is set in AI usage." />
        <Num label="Scene voices ($ / 1,000 characters)" step={0.001} value={p.ttsUsdPerKChar} onChange={set("ttsUsdPerKChar")} />
        <Num label="1 US$ in FCFA" value={p.usdToFcfa} onChange={set("usdToFcfa")} />
        <Num label="Default margin (%)" value={p.defaultMarginPct} onChange={set("defaultMarginPct")} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={btn.secondary}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await savePricingSettingsAction(p);
              setMsg(r.ok ? "Saved." : r.error);
            })
          }
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null} Save settings
        </button>
        {msg ? <span className="text-sm">{msg}</span> : null}
      </div>
    </div>
  );
}
