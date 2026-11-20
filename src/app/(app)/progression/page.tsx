import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { Flame, Lock, Sparkles, Target } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { badgesFor, statsFor, xpByDay } from "@/lib/gamification/service";
import { DAILY_GOALS } from "@/lib/gamification/rules";
import { BadgeIcon } from "@/components/gamify/badge-icon";
import { PageSkeleton, ProgressBar, formatDate } from "@/components/learn/ui";
import { chooseDailyGoal } from "./actions";
import { cn } from "cn";

export const metadata: Metadata = { title: "Ma progression", robots: { index: false } };

const weekday = new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "UTC" });

async function Progress() {
  await connection();
  const me = await requireUser("/progression");
  await connectDB();
  const [s, badges, week] = await Promise.all([statsFor(me.id), badgesFor(me.id), xpByDay(me.id, 7)]);
  const max = Math.max(s.dailyGoal, ...week.map((d) => d.xp));
  const earned = badges.filter((b) => b.earnedAt).length;

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <h1 className="text-3xl font-extrabold text-brand-deep">Ma progression</h1>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl bg-gradient-to-br from-primary to-brand-dark p-5 text-white sm:col-span-2">
          <p className="text-sm font-bold tracking-wide uppercase opacity-80">Niveau</p>
          <p className="font-heading text-5xl font-extrabold">{s.level.level}</p>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuenow={s.level.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progression vers le niveau suivant">
            <div className="h-full rounded-full bg-xp" style={{ width: `${Math.max(s.level.progress, 3)}%` }} />
          </div>
          <p className="mt-2 text-sm opacity-90">
            {s.xp} XP · encore {s.level.next - s.xp} XP pour le niveau {s.level.level + 1}
          </p>
        </div>
        <div className="rounded-3xl border-2 border-border bg-card p-5">
          <p className="flex items-center gap-1.5 text-sm font-bold tracking-wide text-coral-dark uppercase">
            <Flame className="size-4" aria-hidden /> Série
          </p>
          <p className="font-heading text-5xl font-extrabold text-brand-deep">{s.streak}</p>
          <p className="text-sm text-muted-foreground">
            {s.activeToday ? "Bravo, la série continue aujourd'hui !" : s.streak ? "Faites une activité aujourd'hui pour la garder." : "Faites une activité pour la lancer."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Record : {s.longestStreak} jour(s)</p>
        </div>
      </section>

      <section className="rounded-3xl border-2 border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-brand-deep">
            <Target className="size-5 text-success" aria-hidden /> Objectif du jour
          </h2>
          <span className="font-semibold text-ink/80">
            {s.todayXp} / {s.dailyGoal} XP
          </span>
        </div>
        <ProgressBar value={Math.min(100, Math.round((s.todayXp / s.dailyGoal) * 100))} className="mt-3" label="Objectif du jour" />
        <form action={chooseDailyGoal} className="mt-4 flex flex-wrap gap-2" aria-label="Choisir mon objectif quotidien">
          {DAILY_GOALS.map((g) => (
            <button
              key={g}
              type="submit"
              name="goal"
              value={g}
              aria-pressed={g === s.dailyGoal}
              className={cn("rounded-full border-2 px-3.5 py-1.5 text-sm font-semibold transition", g === s.dailyGoal ? "border-primary bg-primary text-white" : "border-border hover:border-primary/40")}
            >
              {g} XP{g === 10 ? " · tranquille" : g === 30 ? " · régulier" : g === 50 ? " · intense" : ""}
            </button>
          ))}
        </form>

        <h3 className="mt-6 mb-3 text-sm font-bold tracking-wide text-muted-foreground uppercase">7 derniers jours</h3>
        <ol className="flex h-36 items-end gap-2" aria-label="XP gagnés par jour">
          {week.map((d) => {
            const h = Math.round((d.xp / max) * 100);
            const hit = d.xp >= s.dailyGoal;
            return (
              <li key={d.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-xs font-semibold text-ink/70">{d.xp || ""}</span>
                <span className={cn("w-full rounded-t-xl", hit ? "bg-success" : d.xp ? "bg-xp" : "bg-muted")} style={{ height: `${Math.max(h, 4)}%` }} />
                <span className="text-xs text-muted-foreground capitalize">{weekday.format(new Date(`${d.day}T12:00:00Z`)).replace(".", "")}</span>
              </li>
            );
          })}
        </ol>
      </section>

      <section>
        <h2 className="mb-1 flex items-center gap-2 text-xl font-extrabold text-brand-deep">
          <Sparkles className="size-5 text-xp" aria-hidden /> Badges
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {earned} sur {badges.length} obtenus
        </p>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {badges.map((b) => (
            <li key={b.id} className={cn("flex flex-col items-center rounded-3xl border-2 p-4 text-center", b.earnedAt ? "border-border bg-card" : "border-dashed border-border bg-muted/40")}>
              <span className={cn("flex size-14 items-center justify-center rounded-2xl", b.earnedAt ? "bg-primary text-white shadow-[0_4px_0_0_var(--color-brand-dark)]" : "bg-muted text-muted-foreground")}>
                {b.earnedAt ? <BadgeIcon name={b.icon} className="size-7" /> : <Lock className="size-6" aria-hidden />}
              </span>
              <span className={cn("mt-2 font-bold", b.earnedAt ? "text-brand-deep" : "text-muted-foreground")}>{b.name}</span>
              <span className="text-xs text-muted-foreground">{b.description}</span>
              {b.earnedAt && <span className="mt-1 text-xs text-success">{formatDate(b.earnedAt)}</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function ProgressionPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Progress />
    </Suspense>
  );
}
