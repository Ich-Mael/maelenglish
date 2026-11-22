import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { FlaskConical, Mic, Plus, Search } from "lucide-react";
import { actorOf, requireStaff } from "@/lib/admin/context";
import { can } from "@/lib/admin/permissions";
import { listActivities } from "@/lib/lab/service";
import { ACTIVITY_INFO, ACTIVITY_TYPES, SKILL_FAMILIES, type ActivityType } from "@/lib/lab/types";
import { CEFR_LEVELS, SKILLS, THEMES, skillLabel, themeLabel } from "@/lib/lab/meta";
import { Card, EmptyState, Input, PageHeader, fmtDate, inputCls } from "@/components/admin/ui";
import { AdminForm, Submit } from "@/components/admin/forms";
import { ACTIVITY_ICON } from "@/components/lab/type-icon";
import { COMING_NEXT, SKILL_NAME, TYPE_LOOK, TypeArt } from "@/components/lab/type-style";
import { PageSkeleton } from "@/components/learn/ui";
import { createActivityAction } from "./actions";
import { cn } from "cn";

export const metadata: Metadata = { title: "Lab" };

async function Lab({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const me = await requireStaff("/admin/labo");
  if (!can.useLab(actorOf(me))) redirect("/admin");
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const filter = { type: one("type"), status: one("statut"), q: one("q"), level: one("level"), skill: one("skill"), theme: one("theme") };
  const filtered = Object.values(filter).some(Boolean);
  const items = await listActivities(filter);
  const all = filtered ? await listActivities({}) : items;
  // Practice types grouped by skill family (registry order); the challenge has its own card.
  const practiceGroups = SKILL_FAMILIES.map((skill) => ({ skill, types: ACTIVITY_TYPES.filter((t) => ACTIVITY_INFO[t].role === "practice" && ACTIVITY_INFO[t].skill === skill) })).filter((g) => g.types.length);

  return (
    <div className="grid max-w-5xl gap-5">
      <PageHeader title="Lab" subtitle="Reusable practice activities: create them here, then add them to your courses' units." />

      {/* Library at a glance. */}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Activities", value: all.length },
          { label: "Ready", value: all.filter((x) => x.status === "ready").length },
          { label: "Drafts", value: all.filter((x) => x.status !== "ready").length },
          { label: "Used in units", value: all.filter((x) => x.uses).length },
        ].map((x) => (
          <div key={x.label} className="flex flex-col-reverse rounded-2xl border border-border bg-card px-4 py-3">
            <dt className="text-xs font-semibold text-muted-foreground">{x.label}</dt>
            <dd className="font-heading text-2xl font-extrabold text-brand-deep tabular-nums">{x.value}</dd>
          </div>
        ))}
      </dl>

      {/* The speaking challenge closes every unit: it gets the hero card. */}
      <section aria-labelledby="new-challenge" className="relative isolate overflow-clip rounded-3xl bg-gradient-to-br from-brand-deep via-brand-deep to-brand-dark p-5 text-white sm:p-7">
        <div aria-hidden className="absolute -top-24 -right-16 -z-10 size-80 rounded-full bg-[radial-gradient(circle,rgb(54_79_171/0.55),transparent_70%)]" />
        <div aria-hidden className="absolute -bottom-28 left-1/3 -z-10 size-72 rounded-full bg-[radial-gradient(circle,rgb(255_87_87/0.18),transparent_70%)]" />
        <div className="grid items-center gap-6 md:grid-cols-[1fr_auto]">
          <div className="grid gap-3">
            <p className="inline-flex w-fit items-center gap-1.5 rounded-full border border-coral/70 bg-white/10 px-3 py-1 text-xs font-bold tracking-wide uppercase">
              <span className="size-1.5 rounded-full bg-coral" /> Closes every unit
            </p>
            <h2 id="new-challenge" className="font-heading text-3xl leading-tight font-extrabold text-white">
              {ACTIVITY_INFO.speaking_challenge.label}
            </h2>
            <p className="max-w-xl text-white/85">The moment learners speak for real: they record an answer, their coach replies with a grade, a comment or a voice note. Keep it short, concrete and tied to the unit&apos;s vocabulary.</p>
            <ul className="flex flex-wrap gap-2">
              {TYPE_LOOK.speaking_challenge.perks.map((x) => (
                <li key={x} className="rounded-full bg-white/12 px-3 py-1 text-sm font-semibold">
                  {x}
                </li>
              ))}
            </ul>
            <AdminForm action={createActivityAction} className="mt-1 grid gap-2 rounded-2xl bg-white/10 p-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <input type="hidden" name="type" value="speaking_challenge" />
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-white">Challenge title</span>
                <input name="title" required placeholder={TYPE_LOOK.speaking_challenge.example} className={cn(inputCls, "border-white bg-white text-ink")} />
              </label>
              <button type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border-2 border-coral bg-white px-5 font-bold text-coral-dark shadow-[0_4px_0_0_var(--color-coral)] transition hover:bg-coral-soft active:translate-y-0.5 active:shadow-none">
                <Mic className="size-4" aria-hidden /> Create a challenge
              </button>
            </AdminForm>
          </div>
          <TypeArt type="speaking_challenge" className="mx-auto hidden md:block" />
        </div>
      </section>

      {/* Practice activities, grouped by skill. */}
      <section aria-labelledby="new-practice" className="grid gap-4">
        <div>
          <h2 id="new-practice" className="text-xl font-extrabold text-brand-deep">
            Practice activities
          </h2>
          <p className="text-sm text-muted-foreground">Each one practises the lesson above it in a unit. Every type has its own editor and learner screen.</p>
        </div>
        {practiceGroups.map((g) => (
          <div key={g.skill} className="grid gap-3">
            <h3 className="text-xs font-bold tracking-wide text-primary uppercase">{SKILL_NAME[g.skill]}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {g.types.map((t) => {
                const Icon = ACTIVITY_ICON[t];
                const look = TYPE_LOOK[t];
                return (
                  <AdminForm key={t} action={createActivityAction} className="group grid overflow-clip rounded-3xl border-2 border-border bg-card transition hover:border-primary/40 hover:shadow-[0_10px_30px_-18px_rgb(20_31_77/0.5)]">
                    <input type="hidden" name="type" value={t} />
                    <div className={cn("relative flex h-32 items-center justify-between gap-4 px-5", look.band, t === "fill_gaps" || t === "sentence_builder" ? "border-b border-border" : "")}>
                      <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl", t === "fill_gaps" || t === "sentence_builder" ? "bg-white text-primary shadow-sm" : "bg-white/15 text-white")}>
                        <Icon className="size-6" aria-hidden />
                      </span>
                      <TypeArt type={t} className="w-44 transition group-hover:-translate-y-0.5" />
                    </div>
                    <div className="grid gap-3 p-5">
                      <div>
                        <p className="font-heading text-lg font-extrabold text-brand-deep">{ACTIVITY_INFO[t].label}</p>
                        <p className="text-sm text-muted-foreground">{ACTIVITY_INFO[t].description}</p>
                      </div>
                      <ul className="flex flex-wrap gap-1.5">
                        {look.perks.map((x) => (
                          <li key={x} className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-primary">
                            {x}
                          </li>
                        ))}
                      </ul>
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                        <Input label="Title" name="title" required placeholder={look.example} />
                        <Submit>
                          <Plus className="size-4" aria-hidden /> Create
                        </Submit>
                      </div>
                    </div>
                  </AdminForm>
                );
              })}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed border-border px-4 py-3">
          <span className="mr-1 text-sm font-semibold text-muted-foreground">Coming next:</span>
          {COMING_NEXT.map((x) => (
            <span key={x.name} className="rounded-full border border-border bg-card px-3 py-1 text-sm text-brand-deep">
              {x.name} <span className="text-xs text-muted-foreground">· {SKILL_NAME[x.skill]}</span>
            </span>
          ))}
        </div>
      </section>

      <Card title="Library">
        <form className="mb-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-[1fr_auto_auto_auto_auto_auto_auto] lg:items-end" role="search">
          <label className="relative">
            <span className="sr-only">Search</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input name="q" defaultValue={filter.q} placeholder="Search a title" className={cn(inputCls, "pl-9")} />
          </label>
          <select name="type" defaultValue={filter.type} aria-label="Type" className={cn(inputCls, "w-auto")}>
            <option value="">All types</option>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACTIVITY_INFO[t].label}
              </option>
            ))}
          </select>
          <select name="statut" defaultValue={filter.status} aria-label="Status" className={cn(inputCls, "w-auto")}>
            <option value="">All statuses</option>
            <option value="ready">Ready</option>
            <option value="draft">Drafts</option>
          </select>
          <select name="level" defaultValue={filter.level} aria-label="Level" className={cn(inputCls, "w-auto")}>
            <option value="">All levels</option>
            {CEFR_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <select name="skill" defaultValue={filter.skill} aria-label="Skill" className={cn(inputCls, "w-auto")}>
            <option value="">All skills</option>
            {SKILLS.map((x) => (
              <option key={x.value} value={x.value}>
                {x.en}
              </option>
            ))}
          </select>
          <select name="theme" defaultValue={filter.theme} aria-label="Theme" className={cn(inputCls, "w-auto")}>
            <option value="">All themes</option>
            {THEMES.map((x) => (
              <option key={x.value} value={x.value}>
                {x.en}
              </option>
            ))}
          </select>
          <button type="submit" className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-white">
            Filter
          </button>
        </form>
        {items.length === 0 ? (
          <EmptyState>
            <FlaskConical className="mx-auto mb-2 size-8 text-muted-foreground" aria-hidden />
            {filtered ? "No matching activities." : "The Lab is empty: create your first activity above."}
          </EmptyState>
        ) : (
          <ul className="grid gap-2">
            {items.map((a) => {
              const t = a.type as ActivityType;
              const Icon = ACTIVITY_ICON[t] ?? FlaskConical; // unknown type (old id left in the database)
              return (
                <li key={String(a._id)}>
                  <Link href={`/admin/labo/${a._id}`} className={cn("flex flex-wrap items-center gap-3 rounded-2xl border px-3 py-2.5 transition hover:border-primary/40 hover:bg-brand-soft/40", t === "speaking_challenge" ? "border-coral/40 bg-coral-soft/25" : "border-border")}>
                    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", TYPE_LOOK[t]?.tile ?? "bg-muted text-muted-foreground")}>
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-brand-deep">{a.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {ACTIVITY_INFO[t]?.label ?? `Unknown type « ${a.type} »`}
                        {a.level && ` · ${a.level}`}
                        {a.theme && ` · ${themeLabel(a.theme, "en")}`}
                        {a.skills?.length ? ` · ${a.skills.map((x) => skillLabel(x, "en")).join(", ")}` : ""} · {a.uses ? `used in ${a.uses} unit(s)` : "not used yet"} · edited {fmtDate(a.updatedAt)}
                      </span>
                    </span>
                    {a.status === "ready" ? (
                      <span className="rounded-full bg-gradient-to-r from-primary to-brand-deep px-2.5 py-0.5 text-xs font-bold text-white">Ready</span>
                    ) : (
                      <span className="rounded-full border border-coral bg-white px-2.5 py-0.5 text-xs font-bold text-coral-dark">Draft</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default function Page({ searchParams }: PageProps<"/admin/labo">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Lab searchParams={searchParams} />
    </Suspense>
  );
}
