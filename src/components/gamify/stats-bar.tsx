import Link from "next/link";
import { connection } from "next/server";
import { Flame, LayoutDashboard, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { statsFor } from "@/lib/gamification/service";
import { cn } from "cn";

/** Streak · daily goal ring · level, in the app header (reads the session → inside <Suspense>); staff also get an « Admin » link. */
export async function StatsBar() {
  await connection(); // streak and daily goal depend on today's date
  const me = await getCurrentUser();
  if (!me) return null;
  await connectDB();
  const s = await statsFor(me.id);
  const goal = Math.min(100, Math.round((s.todayXp / s.dailyGoal) * 100));
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <>
      {me.isStaff && (
        <Link href="/admin" className="hidden h-9 items-center gap-1.5 rounded-xl px-2 text-sm font-bold text-primary hover:bg-brand-soft sm:flex group-data-[scrolled=true]/hdr:text-white group-data-[scrolled=true]/hdr:hover:bg-white/10" title="Administration">
          <LayoutDashboard className="size-4.5" aria-hidden />
          <span className="sr-only lg:not-sr-only">Admin</span>
        </Link>
      )}
      <Link href="/progression" className="flex items-center gap-2 rounded-2xl px-1 py-1 hover:bg-muted sm:gap-3 sm:px-2 group-data-[scrolled=true]/hdr:hover:bg-white/10">
        <span className={cn("flex items-center gap-1 font-heading font-extrabold", s.activeToday ? "text-coral-dark group-data-[scrolled=true]/hdr:text-coral" : "text-muted-foreground group-data-[scrolled=true]/hdr:text-white/60")}>
          <Flame className={cn("size-5", s.activeToday && "fill-coral/30")} aria-hidden /> {s.streak}
          <span className="sr-only"> jour{s.streak > 1 ? "s" : ""} de série,</span>
        </span>
        <span className="relative flex size-9 items-center justify-center">
          <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="18" cy="18" r={r} fill="none" strokeWidth="4" className="stroke-muted group-data-[scrolled=true]/hdr:stroke-white/20" />
            <circle cx="18" cy="18" r={r} fill="none" strokeWidth="4" strokeLinecap="round" className={goal >= 100 ? "stroke-primary group-data-[scrolled=true]/hdr:stroke-white" : "stroke-coral"} strokeDasharray={c} strokeDashoffset={c * (1 - goal / 100)} />
          </svg>
          <Sparkles className={cn("size-4", goal >= 100 ? "text-primary group-data-[scrolled=true]/hdr:text-white" : "text-coral-dark group-data-[scrolled=true]/hdr:text-coral")} aria-hidden />
          <span className="sr-only">
            {s.todayXp} XP sur {s.dailyGoal} aujourd&apos;hui,
          </span>
        </span>
        <span className="hidden rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-white sm:inline group-data-[scrolled=true]/hdr:bg-white group-data-[scrolled=true]/hdr:text-primary">
          Niv. {s.level.level}
        </span>
      </Link>
    </>
  );
}

export function StatsBarFallback() {
  return <span className="h-9 w-24 animate-pulse rounded-2xl bg-muted sm:w-36" aria-hidden />;
}
