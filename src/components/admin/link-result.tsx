"use client";

import Link from "next/link";
import { CopyField } from "./forms";
import { btn } from "./ui";

/** Shows a one-time link (activation / reset) to copy, with an optional WhatsApp share opened by the staff member. */
export function LinkResult({ data, userHref }: { data?: Record<string, string>; userHref?: string }) {
  if (!data?.url) return null;
  // WhatsApp message to the learner: stays in French.
  const text = data.kind === "reset"
    ? `Bonjour ${data.name}, voici le lien pour choisir un nouveau mot de passe MaelEnglish (valable 1 heure) : ${data.url}`
    : `Bonjour ${data.name}, votre compte MaelEnglish est prêt${data.username ? ` (identifiant : ${data.username})` : ""}. Choisissez votre mot de passe ici (valable 7 jours) : ${data.url}`;
  return (
    <div className="grid gap-3 rounded-2xl border border-success/30 bg-success/5 p-4">
      <CopyField label="Link to pass on" value={data.url} />
      <div className="flex flex-wrap gap-2">
        {data.phone && (
          <a href={`https://wa.me/${data.phone}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener" className={btn.secondary}>
            Open WhatsApp with the message
          </a>
        )}
        {userHref && (
          <Link href={userHref} className={btn.secondary}>
            View account
          </Link>
        )}
      </div>
    </div>
  );
}
