import Link from "next/link";
import { connection } from "next/server";
import { Flame, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { statsFor } from "@/lib/gamification/service";
import { cn } from "cn";

/** Streak · daily goal ring · level, in the app header (reads the session → inside <Suspense>). */
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
    <Link href="/progression" className="flex items-center gap-3 rounded-2xl px-2 py-1 hover:bg-muted">
      <span className={cn("flex items-center gap-1 font-heading font-extrabold", s.activeToday ? "text-coral-dark" : "text-muted-foreground")}>
        <Flame className={cn("size-5", s.activeToday && "fill-coral/30")} aria-hidden /> {s.streak}
        <span className="sr-only"> jour{s.streak > 1 ? "s" : ""} de série,</span>
      </span>
      <span className="relative flex size-9 items-center justify-center">
        <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="18" cy="18" r={r} fill="none" strokeWidth="4" className="stroke-muted" />
          <circle cx="18" cy="18" r={r} fill="none" strokeWidth="4" strokeLinecap="round" className={goal >= 100 ? "stroke-success" : "stroke-xp"} strokeDasharray={c} strokeDashoffset={c * (1 - goal / 100)} />
        </svg>
        <Sparkles className={cn("size-4", goal >= 100 ? "text-success" : "text-[#9a6200]")} aria-hidden />
        <span className="sr-only">
          {s.todayXp} XP sur {s.dailyGoal} aujourd&apos;hui,
        </span>
      </span>
      <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-white">
        Niv. {s.level.level}
      </span>
    </Link>
  );
}

export function StatsBarFallback() {
  return <span className="h-9 w-36 animate-pulse rounded-2xl bg-muted" aria-hidden />;
}
