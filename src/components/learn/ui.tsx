import Link from "next/link";
import { CalendarClock, CircleSlash, Hourglass, Lock, SearchX } from "lucide-react";
import { whatsappLink } from "@/lib/catalog";
import { cn } from "cn";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });
export const formatDate = (d: Date | string) => dateFmt.format(new Date(d));

export function ProgressBar({ value, className, label }: { value: number; className?: string; label?: string }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-label={label ?? "Progression"}
      className={cn("h-3 overflow-hidden rounded-full bg-brand-soft", className)}
    >
      <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${Math.max(value, value > 0 ? 4 : 0)}%` }} />
    </div>
  );
}

const PROBLEMS = {
  "not-found": { icon: SearchX, title: "Cours introuvable", text: "Ce lien ne correspond à aucun cours." },
  "not-enrolled": { icon: Lock, title: "Vous n'êtes pas inscrit(e) à ce cours", text: "Contactez l'équipe MaelEnglish pour vous inscrire." },
  "not-started": { icon: CalendarClock, title: "Ce cours n'a pas encore commencé", text: "Il s'ouvrira à la date de début de votre inscription." },
  expired: { icon: Hourglass, title: "Votre accès à ce cours est terminé", text: "Contactez l'équipe MaelEnglish pour le prolonger." },
  suspended: { icon: CircleSlash, title: "Votre accès est suspendu", text: "Contactez l'équipe MaelEnglish pour en savoir plus." },
} as const;

export function AccessProblem({ reason, startDate }: { reason: keyof typeof PROBLEMS; startDate?: Date | null }) {
  const p = PROBLEMS[reason];
  return (
    <div className="mx-auto max-w-md rounded-3xl border-2 border-border bg-card p-8 text-center">
      <p.icon className="mx-auto size-12 text-coral" aria-hidden />
      <h1 className="mt-4 text-2xl font-extrabold text-brand-deep">{p.title}</h1>
      <p className="mt-2 text-muted-foreground">
        {reason === "not-started" && startDate ? `Il s'ouvrira le ${formatDate(startDate)}.` : p.text}
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <Link href="/mes-cours" className="inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-5 font-semibold text-white">
          Mes cours
        </Link>
        {reason !== "not-found" && reason !== "not-started" && (
          <a href={whatsappLink()} target="_blank" rel="noopener" className="text-sm font-semibold text-coral-dark hover:underline">
            Écrire à l&apos;équipe sur WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="grid animate-pulse gap-4" aria-busy aria-label="Chargement">
      <div className="h-8 w-1/2 rounded-xl bg-muted" />
      <div className="h-4 w-1/3 rounded bg-muted" />
      <div className="h-40 rounded-3xl bg-muted" />
      <div className="h-40 rounded-3xl bg-muted" />
    </div>
  );
}
