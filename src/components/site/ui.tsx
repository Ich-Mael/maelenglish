import Link from "next/link";
import { cn } from "cn";
import { WhatsAppIcon } from "./icons";

export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4", className)}>{children}</div>;
}

export function Pill({ children, tone = "coral", className }: { children: React.ReactNode; tone?: "coral" | "light"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold tracking-wide uppercase",
        tone === "coral" ? "bg-coral-soft text-coral-dark" : "bg-white/12 text-white",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionHead({ pill, title, text, className }: { pill: string; title: React.ReactNode; text?: string; className?: string }) {
  return (
    <div className={cn("reveal mx-auto mb-10 max-w-2xl text-center", className)}>
      <Pill>{pill}</Pill>
      <h2 className="mt-3 text-3xl font-extrabold text-brand-deep text-balance sm:text-4xl">{title}</h2>
      {text && <p className="mt-3 text-lg text-muted-foreground text-pretty">{text}</p>}
    </div>
  );
}

const btn =
  "inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-6 font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-px";

export const BUTTON = {
  coral: cn(btn, "border-2 border-coral bg-white text-[19px] font-bold text-coral hover:bg-coral-soft shadow-[0_6px_0_0_var(--color-coral)] active:shadow-[0_2px_0_0_var(--color-coral)] active:translate-y-1"),
  blue: cn(btn, "bg-primary text-primary-foreground shadow-[0_6px_0_0_var(--color-brand-dark)] hover:brightness-110 active:shadow-[0_2px_0_0_var(--color-brand-dark)] active:translate-y-1"),
  outline: cn(btn, "border-2 border-brand/20 bg-white text-brand-deep hover:border-brand/40 hover:bg-brand-soft"),
  ghost: cn(btn, "border-2 border-white/25 text-white hover:bg-white/10"),
};

export function WhatsAppButton({ href, children, variant = "coral", className }: { href: string; children: React.ReactNode; variant?: keyof typeof BUTTON; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener" className={cn(BUTTON[variant], className)}>
      <WhatsAppIcon className="size-5" /> {children}
    </a>
  );
}

export function ButtonLink({ href, children, variant = "outline", className }: { href: string; children: React.ReactNode; variant?: keyof typeof BUTTON; className?: string }) {
  return (
    <Link href={href} className={cn(BUTTON[variant], className)}>
      {children}
    </Link>
  );
}

/** EN phrase + FR translation, styled like a chat bubble. */
export function PhraseCard({ role, en, fr, icon: Icon, className }: { role: string; en: string; fr: string; icon?: React.ComponentType<{ className?: string }>; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4 shadow-[0_12px_30px_-14px_rgb(21_26_51/0.35)]", className)}>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold tracking-wide text-coral-dark uppercase">
        {Icon && <Icon className="size-3.5" />} {role}
      </p>
      <p lang="en" className="font-heading font-bold text-brand-deep">“{en}”</p>
      <p className="mt-1 text-sm text-muted-foreground">{fr}</p>
    </div>
  );
}
