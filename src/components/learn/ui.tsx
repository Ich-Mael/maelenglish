import Link from "next/link";
import { CalendarClock, CircleSlash, Hourglass, Lock, SearchX } from "lucide-react";
import { whatsappLink } from "@/lib/catalog";
import { cn } from "cn";

const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "long" });
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
  "not-found": { icon: SearchX, title: "Course not found", text: "This link doesn't match any course." },
  "not-enrolled": { icon: Lock, title: "You're not enrolled in this course", text: "Contact the MaelEnglish team to enrol." },
  "not-started": { icon: CalendarClock, title: "This course hasn't started yet", text: "It opens on your enrolment's start date." },
  expired: { icon: Hourglass, title: "Your access to this course has ended", text: "Contact the MaelEnglish team to extend it." },
  suspended: { icon: CircleSlash, title: "Your access is suspended", text: "Contact the MaelEnglish team to find out more." },
} as const;

export function AccessProblem({ reason, startDate }: { reason: keyof typeof PROBLEMS; startDate?: Date | null }) {
  const p = PROBLEMS[reason];
  return (
    <div className="mx-auto max-w-md rounded-3xl border-2 border-border bg-card p-8 text-center">
      <p.icon className="mx-auto size-12 text-coral" aria-hidden />
      <h1 className="mt-4 text-2xl font-extrabold text-brand-deep">{p.title}</h1>
      <p className="mt-2 text-muted-foreground">
        {reason === "not-started" && startDate ? `It opens on ${formatDate(startDate)}.` : p.text}
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <Link href="/mes-cours" className="inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-5 font-semibold text-white">
          My Courses
        </Link>
        {reason !== "not-found" && reason !== "not-started" && (
          <a href={whatsappLink()} target="_blank" rel="noopener" className="text-sm font-semibold text-coral-dark hover:underline">
            Message the team on WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="grid animate-pulse gap-4" aria-busy aria-label="Loading">
      <div className="h-8 w-1/2 rounded-xl bg-muted" />
      <div className="h-4 w-1/3 rounded bg-muted" />
      <div className="h-40 rounded-3xl bg-muted" />
      <div className="h-40 rounded-3xl bg-muted" />
    </div>
  );
}
