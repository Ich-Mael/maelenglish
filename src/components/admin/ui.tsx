import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "cn";

export function PageHeader({ title, subtitle, back, actions }: { title: string; subtitle?: React.ReactNode; back?: { href: string; label: string }; actions?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-1 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-primary">
            <ChevronLeft className="size-4" aria-hidden /> {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-extrabold text-brand-deep sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ title, description, children, className, actions }: { title?: string; description?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-5", className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="text-lg font-bold text-brand-deep">{title}</h2>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export const inputCls = "h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-3 focus:ring-ring/30";

export function Input({ label, hint, className, ...props }: React.ComponentProps<"input"> & { label: string; hint?: string; name: string }) {
  return (
    <label className={cn("grid gap-1 text-sm", className)}>
      <span className="font-medium">{label}</span>
      <input className={inputCls} {...props} />
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function TextArea({ label, hint, className, ...props }: React.ComponentProps<"textarea"> & { label: string; hint?: string; name: string }) {
  return (
    <label className={cn("grid gap-1 text-sm", className)}>
      <span className="font-medium">{label}</span>
      <textarea className={cn(inputCls, "h-auto min-h-24 py-2 leading-relaxed")} {...props} />
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function Select({ label, options, className, ...props }: React.ComponentProps<"select"> & { label: string; name: string; options: { value: string; label: string }[] }) {
  return (
    <label className={cn("grid gap-1 text-sm", className)}>
      <span className="font-medium">{label}</span>
      <select className={inputCls} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Checkbox({ label, hint, ...props }: React.ComponentProps<"input"> & { label: string; hint?: string; name: string }) {
  return (
    <label className="flex items-start gap-2.5 text-sm">
      <input type="checkbox" className="mt-0.5 size-4 accent-primary" {...props} />
      <span>
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

const PILL = {
  green: "bg-success/12 text-success",
  blue: "bg-brand-soft text-primary",
  amber: "bg-xp/20 text-[#7a4d00]",
  red: "bg-destructive/10 text-destructive",
  grey: "bg-muted text-muted-foreground",
};
export function Pill({ tone = "grey", children }: { tone?: keyof typeof PILL; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap", PILL[tone])}>{children}</span>;
}

export const btn = {
  primary: "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50",
  secondary: "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-brand-deep hover:bg-brand-soft disabled:opacity-50",
  danger: "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-card px-4 text-sm font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-50",
  icon: "inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30",
};

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{children}</p>;
}

export const ROLE_LABELS: Record<string, string> = {
  user: "Apprenant·e",
  "english-coach": "Coach",
  instructor: "Formateur·rice",
  "account-manager": "Gestion des comptes",
  admin: "Admin",
  "super-admin": "Super admin",
};

const shortDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });
export const fmtDate = (d?: Date | string | null) => (d ? shortDate.format(new Date(d)) : "—");
/** yyyy-mm-dd for <input type="date">. */
export const isoDate = (d?: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");
