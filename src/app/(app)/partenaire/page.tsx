import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { canUsePartner, partnerState, recentSessions, scenariosByLesson } from "@/lib/conversation/queries";
import { ScenarioCard } from "@/components/conversation/scenario-card";
import { MinutesMeter } from "@/components/conversation/minutes-meter";
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
      {/* A « suspended » 3D card: layered shadows + a soft ground shadow below; Coach Ish's portrait framed in white on the left. */}
      <div className="relative pb-6">
        <span aria-hidden className="pointer-events-none absolute inset-x-[8%] bottom-0 h-10 rounded-[50%] bg-[radial-gradient(closest-side,rgb(20_31_77/0.28),transparent)]" />
        <header className="relative grid gap-3 rounded-[2rem] bg-white p-3 shadow-[inset_0_1px_0_rgb(255_255_255),0_1px_2px_rgb(20_31_77/0.06),0_8px_16px_-4px_rgb(20_31_77/0.10),0_28px_56px_-18px_rgb(20_31_77/0.38)] ring-1 ring-primary/5 md:grid-cols-[minmax(0,19rem)_1fr] md:gap-0">
          <div className="relative h-60 overflow-clip rounded-[1.6rem] border-[5px] border-white bg-[radial-gradient(circle_at_50%_40%,#0b5bd9_0%,#05319a_38%,#011544_75%)] shadow-[0_14px_28px_-10px_rgb(1_21_68/0.55),0_0_0_1px_rgb(20_31_77/0.08)] md:h-auto md:min-h-80">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/coach-ish-640.webp" alt="Coach Ish" width={640} height={640} className="absolute inset-0 size-full object-cover object-[50%_18%]" />
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border-2 border-coral bg-white px-3.5 py-1 text-sm font-extrabold whitespace-nowrap text-primary shadow-lg">Ready when you are!</span>
          </div>
          <div className="relative isolate grid content-center gap-6 overflow-clip rounded-[1.6rem] p-4 sm:p-6 lg:p-8">
            <span aria-hidden className="pointer-events-none absolute -right-20 -bottom-32 -z-10 size-80 rounded-full bg-[radial-gradient(circle,rgb(255_87_87/0.10),transparent_70%)]" />
            <span aria-hidden className="pointer-events-none absolute -top-28 -right-10 -z-10 size-72 rounded-full bg-[radial-gradient(circle,rgb(54_79_171/0.10),transparent_70%)]" />
            <div className="grid gap-3">
              <h1 className="font-heading text-4xl leading-[1.05] font-extrabold sm:text-5xl lg:text-6xl">
                <span className="whitespace-nowrap text-coral">Talk with</span> <span className="whitespace-nowrap text-primary">Coach Ish</span>
              </h1>
              <p className="max-w-xl text-lg text-ink/80">Practise real work conversations out loud, then get Coach Ish&apos;s feedback: your mistakes corrected, better ways to say it and his tips.</p>
              {state.minutesLeft !== null && state.capMinutes !== null && <MinutesMeter left={state.minutesLeft} cap={state.capMinutes} className="max-w-md pt-1" />}
              <p className="flex flex-wrap gap-2 pt-1 text-sm font-semibold">
                {done > 0 && <span className="rounded-full border-2 border-coral bg-white px-3 py-0.5 text-coral-dark">{done} conversation{done === 1 ? "" : "s"} done</span>}
              </p>
            </div>
          </div>
        </header>
      </div>

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
