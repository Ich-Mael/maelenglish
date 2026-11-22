import { Flame, Lock, Medal, Target } from "lucide-react";
import { DAILY_GOALS } from "@/lib/gamification/rules";
import type { StatsSummary, badgesFor, xpByDay, BadgeView } from "@/lib/gamification/service";
import { BadgeIcon } from "./badge-icon";
import { formatDate } from "@/components/learn/ui";
import { chooseDailyGoal } from "@/app/(app)/progression/actions";
import { cn } from "cn";

/*
 * « Ma progression »: level, streak, daily goal with the last 7 days, then badges grouped by
 * category (next badge to earn, category chips, medals by tier with progress). Brand colours only
 * (blues, navy, logo red).
 */

const weekday = new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "UTC" });

export function ProgressView({ s, groups, week }: { s: StatsSummary; groups: Awaited<ReturnType<typeof badgesFor>>; week: Awaited<ReturnType<typeof xpByDay>> }) {
  const max = Math.max(s.dailyGoal, ...week.map((d) => d.xp));
  const all = groups.flatMap((g) => g.badges);
  const live = all.filter((b) => b.available);
  const earned = all.filter((b) => b.earnedAt).length;
  // The closest badge to earn next (available, not owned): a concrete short-term goal.
  const next = live.filter((b) => !b.earnedAt).sort((a, b) => b.value / b.goal - a.value / a.goal || a.goal - b.goal)[0];
  const goalPct = Math.min(100, Math.round((s.todayXp / s.dailyGoal) * 100));

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <h1 className="text-3xl font-extrabold text-brand-deep">Ma progression</h1>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="relative overflow-clip rounded-3xl bg-gradient-to-br from-primary via-brand-dark to-brand-deep p-5 text-white sm:col-span-2">
          <div aria-hidden className="absolute -top-16 -right-10 size-48 rounded-full bg-[radial-gradient(circle,rgb(255_255_255/0.18),transparent_70%)]" />
          <p className="text-sm font-bold tracking-wide uppercase opacity-80">Niveau</p>
          <p className="font-heading text-5xl font-extrabold">{s.level.level}</p>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuenow={s.level.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progression vers le niveau suivant">
            <div className="h-full rounded-full bg-white" style={{ width: `${Math.max(s.level.progress, 3)}%` }} />
          </div>
          <p className="mt-2 text-sm opacity-90">
            {s.xp} XP · encore {s.level.next - s.xp} XP pour le niveau {s.level.level + 1}
          </p>
        </div>
        <div className="rounded-3xl border-2 border-coral bg-white p-5 shadow-[0_4px_0_0_var(--color-coral)]">
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
            <Target className="size-5 text-primary" aria-hidden /> Objectif du jour
          </h2>
          <span className="font-semibold text-ink/80">
            {s.todayXp} / {s.dailyGoal} XP
          </span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-brand-soft" role="progressbar" aria-valuenow={goalPct} aria-valuemin={0} aria-valuemax={100} aria-label="Objectif du jour">
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-brand-deep" style={{ width: `${Math.max(goalPct, goalPct ? 4 : 0)}%` }} />
        </div>
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
                <span className={cn("w-full rounded-t-xl", hit ? "bg-gradient-to-t from-brand-deep to-primary" : d.xp ? "bg-primary/35" : "bg-brand-soft")} style={{ height: `${Math.max(h, 4)}%` }} title={hit ? "Objectif atteint" : undefined} />
                <span className="text-xs text-muted-foreground capitalize">{weekday.format(new Date(`${d.day}T12:00:00Z`)).replace(".", "")}</span>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span aria-hidden className="size-3 rounded bg-gradient-to-t from-brand-deep to-primary" /> Objectif atteint
          <span aria-hidden className="ml-3 size-3 rounded bg-primary/35" /> En dessous de l&apos;objectif
        </p>
      </section>

      <section aria-labelledby="badges" className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="badges" className="flex items-center gap-2 text-2xl font-extrabold text-brand-deep">
              <Medal className="size-6 text-primary" aria-hidden /> Badges
            </h2>
            <p className="text-sm text-muted-foreground">
              {earned} sur {live.length} obtenus · d&apos;autres arrivent avec les nouveaux exercices du Labo
            </p>
          </div>
        </div>

        {next && (
          <div className="flex items-center gap-4 rounded-3xl bg-gradient-to-r from-brand-deep to-primary p-4 text-white sm:p-5">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white/15 ring-2 ring-white/40">
              <BadgeIcon name={next.icon} className="size-7" />
            </span>
            <div className="grid min-w-0 flex-1 gap-1.5">
              <p className="text-xs font-bold tracking-wide uppercase opacity-80">Prochain badge</p>
              <p className="font-heading text-lg leading-tight font-extrabold">{next.name}</p>
              <p className="text-sm opacity-90">{next.description}</p>
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/20">
                  <div className="h-full rounded-full bg-white" style={{ width: `${Math.max(4, Math.round((next.value / next.goal) * 100))}%` }} />
                </div>
                <span className="text-xs font-bold tabular-nums">
                  {next.value} / {next.goal}
                </span>
              </div>
            </div>
          </div>
        )}

        <nav aria-label="Catégories de badges" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {groups.map((g) => {
            const got = g.badges.filter((b) => b.earnedAt).length;
            return (
              <a key={g.id} href={`#badges-${g.id}`} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border-2 border-border bg-card px-3 py-1.5 text-sm font-semibold text-brand-deep hover:border-primary/40">
                <BadgeIcon name={g.icon} className="size-4 text-primary" />
                {g.name}
                <span className="rounded-full bg-brand-soft px-1.5 text-xs text-primary tabular-nums">
                  {got}/{g.badges.length}
                </span>
              </a>
            );
          })}
        </nav>

        {groups.map((g) => {
          const got = g.badges.filter((b) => b.earnedAt).length;
          const soon = g.badges.every((b) => !b.available);
          return (
            <section key={g.id} id={`badges-${g.id}`} aria-labelledby={`badges-${g.id}-title`} className="scroll-mt-24 rounded-3xl border-2 border-border bg-card p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-primary">
                  <BadgeIcon name={g.icon} className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 id={`badges-${g.id}-title`} className="flex flex-wrap items-center gap-2 font-heading text-lg font-extrabold text-brand-deep">
                    {g.name}
                    {soon && <span className="rounded-full border border-coral bg-white px-2 py-0.5 font-sans text-[11px] font-bold text-coral-dark">Bientôt</span>}
                  </h3>
                  <p className="text-sm text-muted-foreground">{g.description}</p>
                </div>
                <span className="shrink-0 text-sm font-bold text-primary tabular-nums">
                  {got} / {g.badges.length}
                </span>
              </div>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {g.badges.map((b) => (
                  <BadgeTile key={b.id} b={b} />
                ))}
              </ul>
            </section>
          );
        })}
      </section>
    </div>
  );
}

/** Medal styles by tier (brand colours only): blue outline, blue gradient, navy with a red ring. */
const MEDAL = {
  1: "bg-white text-primary ring-2 ring-primary",
  2: "bg-gradient-to-br from-primary to-brand-dark text-white shadow-[0_4px_0_0_var(--color-brand-deep)]",
  3: "bg-gradient-to-br from-brand-deep via-brand-dark to-primary text-white ring-2 ring-coral ring-offset-2 ring-offset-card",
} as const;

function BadgeTile({ b }: { b: BadgeView }) {
  const got = !!b.earnedAt;
  const pct = Math.round((b.value / b.goal) * 100);
  return (
    <li className={cn("flex flex-col items-center rounded-2xl border-2 p-3 text-center", got ? "border-primary/25 bg-brand-soft/40" : b.available ? "border-border bg-card" : "border-dashed border-border bg-muted/30")}>
      <span className={cn("relative flex size-14 items-center justify-center rounded-full", got ? MEDAL[b.tier] : "bg-brand-soft text-primary/35")}>
        <BadgeIcon name={b.icon} className="size-7" />
        {!got && (
          <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full border-2 border-card bg-muted text-muted-foreground">
            <Lock className="size-2.5" aria-hidden />
          </span>
        )}
      </span>
      <span className="mt-1.5 text-[11px] tracking-widest text-coral-dark" aria-label={`Difficulté ${b.tier} sur 3`}>
        {"★".repeat(b.tier)}
        <span className="text-border">{"★".repeat(3 - b.tier)}</span>
      </span>
      <span className={cn("font-bold leading-tight", got ? "text-brand-deep" : "text-ink/70")}>{b.name}</span>
      <span className="mt-0.5 text-xs text-muted-foreground">{b.description}</span>
      {got ? (
        <span className="mt-1.5 text-xs font-semibold text-primary">Obtenu le {formatDate(b.earnedAt!)}</span>
      ) : b.available ? (
        <span className="mt-2 grid w-full gap-1">
          <span className="h-1.5 overflow-hidden rounded-full bg-brand-soft">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(pct, pct ? 6 : 0)}%` }} />
          </span>
          <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
            {b.value} / {b.goal}
          </span>
        </span>
      ) : (
        <span className="mt-1.5 rounded-full border border-coral bg-white px-2 py-0.5 text-[11px] font-bold text-coral-dark">Bientôt</span>
      )}
    </li>
  );
}
