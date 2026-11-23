import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { canUsePartner, partnerState, recentSessions, scenariosByLesson } from "@/lib/conversation/queries";
import { ScenarioCard } from "@/components/conversation/scenario-card";
import { CEFR_LEVELS, THEMES } from "@/lib/lab/meta";
import { PageSkeleton } from "@/components/learn/ui";
import { cn } from "cn";

export const metadata: Metadata = { title: "Talk with Coach Ish", robots: { index: false } };

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
        <h1 className="text-2xl font-extrabold text-brand-deep">Talk with Coach Ish</h1>
        <p className="mt-2 text-ink">Talk with Coach Ish opens with an active course.</p>
      </div>
    );
  }
  const [{ groups, free }, sessions, state] = await Promise.all([scenariosByLesson(me, { level, theme }), recentSessions(me.id), partnerState(me)]);
  const done = sessions.filter((x) => x.status === "debriefed").length;
  const href = (p: { niveau?: string; theme?: string }) => {
    const q = new URLSearchParams({ ...(level ? { niveau: level } : {}), ...(theme ? { theme } : {}), ...p });
    for (const [k, v] of [...q.entries()]) if (!v) q.delete(k);
    return `/partenaire${q.size ? `?${q}` : ""}`;
  };
  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <header className="relative overflow-clip rounded-[2rem] border-2 border-primary/10 bg-gradient-to-br from-white via-white to-brand-soft">
        <span aria-hidden className="pointer-events-none absolute -top-24 right-0 size-80 rounded-full bg-[radial-gradient(circle,rgb(54_79_171/0.16),transparent_70%)]" />
        <span aria-hidden className="pointer-events-none absolute -bottom-28 -left-16 size-72 rounded-full bg-[radial-gradient(circle,rgb(255_87_87/0.14),transparent_70%)]" />
        <div className="relative grid items-center gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto]">
          <div className="grid gap-3">
            <h1 className="font-heading text-4xl leading-[1.05] font-extrabold sm:text-5xl lg:text-6xl">
              <span className="whitespace-nowrap text-coral">Talk with</span> <span className="whitespace-nowrap text-primary">Coach Ish</span>
            </h1>
            <p className="max-w-xl text-lg text-ink/80">Practise real work conversations out loud, then get Coach Ish&apos;s feedback: your mistakes corrected, better ways to say it and his tips.</p>
            <p className="flex flex-wrap gap-2 pt-1 text-sm font-semibold">
              {state.minutesLeft !== null && <span className="rounded-full bg-brand-soft px-3 py-1 text-primary">{Math.floor(state.minutesLeft)} AI minutes left this month</span>}
              {done > 0 && <span className="rounded-full border-2 border-coral bg-white px-3 py-0.5 text-coral-dark">{done} conversation{done === 1 ? "" : "s"} done</span>}
            </p>
          </div>
          <div className="relative mx-auto hidden md:block">
            <span aria-hidden className="absolute -inset-3 rounded-full border-2 border-primary/15" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/coach-ish-512.webp" alt="Coach Ish" width={176} height={176} className="relative size-44 rounded-full object-cover ring-4 ring-coral" />
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-extrabold whitespace-nowrap text-white shadow">Ready when you are!</span>
          </div>
        </div>
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

      {groups.length === 0 && free.length === 0 && (
        <p className="rounded-3xl border border-dashed border-border p-8 text-center text-muted-foreground">{level || theme ? "No conversation matches these filters yet." : "Your first conversations are on their way."}</p>
      )}

      {groups.map((g) => (
        <section key={g.key} className="grid gap-3">
          <div>
            <p className="text-xs font-bold tracking-wide text-primary uppercase">{g.course}</p>
            <h2 className="text-xl font-extrabold text-brand-deep">{g.module}</h2>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {g.cards.map((c) => (
              <li key={`${c.activityId}:${c.where?.stepId}`}>
                <ScenarioCard c={c} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {free.length > 0 && (
        <section className="grid gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-extrabold text-brand-deep">
              <Sparkles className="size-5 text-coral" aria-hidden /> {groups.length ? "Free practice" : "Situations to practise"}
            </h2>
            <p className="text-sm text-muted-foreground">{groups.length ? "More work situations, outside your lessons, easiest first." : "Easiest first."}</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {free.map((c) => (
              <li key={c.activityId}>
                <ScenarioCard c={c} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {sessions.length > 0 && (
        <section id="conversations" className="grid scroll-mt-20 gap-2">
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
