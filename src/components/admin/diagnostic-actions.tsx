"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Copy, Eye, Mail, UserPlus } from "lucide-react";
import { setDiagnosticStatusAction } from "@/app/admin/actions";
import { WhatsAppIcon } from "@/components/site/icons";
import { cn } from "cn";

/*
 * Quick actions on a diagnostic lead (Admin → Diagnostics): WhatsApp and email with a ready message
 * (opening one marks a « new » lead as contacted), copy the email / number, create the account
 * (pre-filled), open the detail, and the follow-up status.
 */

export type LeadContact = { id: string; status: string; firstName: string; lastName: string; email: string; phone: string; profile: string };

const STATUS = [
  { value: "new", label: "New", cls: "border-coral bg-white text-coral-dark" },
  { value: "contacted", label: "Contacted", cls: "border-primary bg-brand-soft text-primary" },
  { value: "closed", label: "Closed", cls: "border-border bg-muted text-muted-foreground" },
];

export function messages(l: LeadContact) {
  const text = `Bonjour ${l.firstName}, c'est Coach Ish de MaelEnglish. Merci d'avoir fait votre diagnostic ! Votre profil : « ${l.profile} ». Avez-vous quelques minutes cette semaine pour en parler et voir comment avancer ensemble ?`;
  const subject = "Votre diagnostic MaelEnglish";
  const body = `Bonjour ${l.firstName},\n\nMerci d'avoir fait votre diagnostic MaelEnglish. Votre profil d'apprenant : « ${l.profile} ».\n\nJe vous propose un court échange pour en parler et voir ensemble comment progresser en anglais professionnel.\n\nÀ bientôt,\nCoach Ish — MaelEnglish`;
  return {
    whatsapp: l.phone ? `https://wa.me/${l.phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}` : "",
    mailto: `mailto:${l.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  };
}

export function DiagnosticActions({ lead, createHref, detailHref, size = "md" }: { lead: LeadContact; createHref?: string | null; detailHref?: string; size?: "md" | "lg" }) {
  const [status, setStatus] = useState(lead.status);
  const [copied, setCopied] = useState("");
  const [, start] = useTransition();
  const m = messages(lead);
  const save = (s: string) => {
    setStatus(s);
    start(() => void setDiagnosticStatusAction(lead.id, s));
  };
  const contacted = () => status === "new" && save("contacted");
  const copy = async (what: "email" | "phone", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  const btn = cn("inline-flex items-center gap-1.5 rounded-xl border-2 font-semibold transition", size === "lg" ? "h-10 px-3.5 text-sm" : "h-9 px-3 text-xs");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {m.whatsapp && (
        <a href={m.whatsapp} target="_blank" rel="noopener" onClick={contacted} className={cn(btn, "border-[#25D366] bg-white text-[#128C7E] hover:bg-[#25D366]/10")}>
          <WhatsAppIcon className="size-4" /> WhatsApp
        </a>
      )}
      <a href={m.mailto} onClick={contacted} className={cn(btn, "border-primary/30 bg-white text-primary hover:bg-brand-soft")}>
        <Mail className="size-4" aria-hidden /> Email
      </a>
      <button type="button" onClick={() => void copy("email", lead.email)} className={cn(btn, "border-border bg-white text-ink/80 hover:bg-muted")} title={lead.email}>
        {copied === "email" ? <Check className="size-4 text-primary" aria-hidden /> : <Copy className="size-4" aria-hidden />} {copied === "email" ? "Copied" : "Copy email"}
      </button>
      {lead.phone && (
        <button type="button" onClick={() => void copy("phone", lead.phone)} className={cn(btn, "border-border bg-white text-ink/80 hover:bg-muted")} title={lead.phone}>
          {copied === "phone" ? <Check className="size-4 text-primary" aria-hidden /> : <Copy className="size-4" aria-hidden />} {copied === "phone" ? "Copied" : "Copy number"}
        </button>
      )}
      {createHref && (
        <Link href={createHref} className={cn(btn, "border-border bg-white text-ink/80 hover:bg-muted")}>
          <UserPlus className="size-4" aria-hidden /> Create account
        </Link>
      )}
      {detailHref && (
        <Link href={detailHref} className={cn(btn, "border-border bg-white text-ink/80 hover:bg-muted")}>
          <Eye className="size-4" aria-hidden /> Report & answers
        </Link>
      )}
      <div className="ml-auto flex rounded-xl border border-border bg-white p-0.5" role="radiogroup" aria-label="Follow-up">
        {STATUS.map((s) => (
          <button key={s.value} type="button" role="radio" aria-checked={status === s.value} onClick={() => save(s.value)} className={cn("rounded-lg border-2 px-2.5 py-1 text-xs font-bold transition", status === s.value ? s.cls : "border-transparent text-muted-foreground hover:bg-muted")}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
