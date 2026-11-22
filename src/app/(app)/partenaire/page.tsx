import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Clock, MessagesSquare, Target } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { canUsePartner, listScenarios, partnerState, recentSessions } from "@/lib/conversation/queries";
import { CEFR_LEVELS, THEMES, themeLabel } from "@/lib/lab/meta";
import { DIFFICULTY_LABEL, type RolePlayContent } from "@/lib/lab/types";
import { PageSkeleton } from "@/components/learn/ui";
import { cn } from "cn";

export const metadata: Metadata = { title: "Speaking Partner", robots: { index: false } };

const fmtDate = (d: Date) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

async function Partner({ searchParams }: { searchParams: Promise<{ niveau?: string; theme?: string }> }) {
  await connection();
  const me = await requireUser("/partenaire");
  await connectDB();
  const sp = await searchParams;
  const level = CEFR_LEVELS.includes(sp.niveau as never) ? sp.niveau : "";
  const theme = THEMES.some((t) => t.value === sp.theme) ? sp.theme : "";
  if (!(await canUsePartner(me))) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl bg-brand-soft p-6 text-center">
        <h1 className="text-2xl font-extrabold text-brand-deep">Speaking Partner</h1>
        <p className="mt-2 text-ink">The Speaking Partner opens with an active course.</p>
      </div>
    );
  }
  const [scenarios, sessions, state] = await Promise.all([listScenarios({ level, theme }), recentSessions(me.id), partnerState(me)]);
  const href = (p: { niveau?: string; theme?: string }) => {
    const q = new URLSearchParams({ ...(level ? { niveau: level } : {}), ...(theme ? { theme } : {}), ...p });
    for (const [k, v] of [...q.entries()]) if (!v) q.delete(k);
    return `/partenaire${q.size ? `?${q}` : ""}`;
  };
  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <header className="relative overflow-clip rounded-3xl bg-gradient-to-br from-brand-deep via-brand-deep to-brand-dark p-6 text-white sm:p-8">
        <span aria-hidden className="pointer-events-none absolute -top-10 -right-10 size-56 rounded-full bg-[radial-gradient(circle,rgb(255_87_87/0.35),transparent_70%)]" />
        <p className="flex items-center gap-2 text-xs font-bold tracking-wide text-white/80 uppercase">
          <MessagesSquare className="size-4" aria-hidden /> Speaking Partner
        </p>
        <h1 className="mt-2 max-w-xl text-3xl font-extrabold sm:text-4xl">Practise real work conversations, out loud.</h1>
        <p className="mt-2 max-w-xl text-white/85">Pick a situation, talk with your AI partner, then get a debrief: your mistakes corrected, better ways to say it, and Mael&apos;s tip.</p>
        {state.minutesLeft !== null && <p className="mt-4 inline-flex rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">{Math.floor(state.minutesLeft)} AI minutes left this month</p>}
      </header>

      <nav aria-label="Filters" className="grid gap-2">
        <div className="flex flex-wrap gap-1.5">
          {["", ...CEFR_LEVELS].map((l) => (
            <Link key={l || "all"} href={href({ niveau: l })} className={cn("rounded-full border-2 px-3 py-1 text-sm font-bold", level === l ? "border-primary bg-primary text-white" : "border-border bg-card text-brand-deep hover:border-primary/40")}>
              {l || "All levels"}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[{ value: "", en: "All situations" }, ...THEMES.filter((t) => t.value !== "other")].map((t) => (
            <Link key={t.value || "all"} href={href({ theme: t.value })} className={cn("rounded-full border px-3 py-1 text-xs font-semibold", theme === t.value ? "border-primary bg-brand-soft text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/40")}>
              {t.en}
            </Link>
          ))}
        </div>
      </nav>

      {scenarios.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border p-8 text-center text-muted-foreground">{level || theme ? "No conversation matches these filters yet." : "Your first conversations are on their way."}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {scenarios.map((s) => {
            const c = s.content as RolePlayContent;
            return (
              <li key={String(s._id)}>
                <Link href={`/partenaire/${s._id}`} className="group grid h-full content-start gap-2 rounded-3xl border-2 border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/40 motion-reduce:transition-none">
                  <p className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
                    {s.level && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-primary">{s.level}</span>}
                    {s.theme && <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{themeLabel(s.theme, "en")}</span>}
                  </p>
                  <h2 className="text-lg leading-snug font-extrabold text-brand-deep group-hover:text-primary">{s.title}</h2>
                  <p lang="en" className="line-clamp-2 text-sm text-muted-foreground">
                    With: {c.aiRole}
                  </p>
                  <p className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-1 text-xs font-semibold text-ink/70">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" aria-hidden /> {c.maxMinutes} min
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Target className="size-3.5" aria-hidden /> {c.goals.length} goals
                    </span>
                    <span>{DIFFICULTY_LABEL[c.difficulty]}</span>
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {sessions.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-xl font-extrabold text-brand-deep">My conversations</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card">
            {sessions.map((s) => (
              <li key={String(s._id)}>
                <Link href={`/partenaire/seances/${s._id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-brand-soft/40">
                  <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full font-heading text-sm font-extrabold", s.score !== null && s.score !== undefined ? "bg-gradient-to-br from-primary to-brand-deep text-white" : "bg-muted text-muted-foreground")}>{s.score ?? "–"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-brand-deep">{s.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {fmtDate(s.createdAt)} · {Math.max(1, Math.round((s.durationS ?? 0) / 60))} min · level {s.difficulty}
                      {s.status !== "debriefed" && " · no debrief"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function Page({ searchParams }: { searchParams: Promise<{ niveau?: string; theme?: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Partner searchParams={searchParams} />
    </Suspense>
  );
}
