import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { FlaskConical, Plus, Search } from "lucide-react";
import { actorOf, requireStaff } from "@/lib/admin/context";
import { can } from "@/lib/admin/permissions";
import { listActivities } from "@/lib/lab/service";
import { ACTIVITY_INFO, ACTIVITY_TYPES, type ActivityType } from "@/lib/lab/types";
import { CEFR_LEVELS, SKILLS, THEMES, skillLabel, themeLabel } from "@/lib/lab/meta";
import { Card, EmptyState, Input, PageHeader, Pill, fmtDate, inputCls } from "@/components/admin/ui";
import { AdminForm, Submit } from "@/components/admin/forms";
import { ACTIVITY_ICON } from "@/components/lab/type-icon";
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

  return (
    <div className="grid max-w-5xl gap-5">
      <PageHeader title="Lab" subtitle="Reusable practice activities: create them here, then add them to your courses' units." />

      <Card title="New activity" description="Each type has its own editor and its own learner page. New types arrive one by one.">
        <div className="grid gap-3 sm:grid-cols-2">
          {ACTIVITY_TYPES.map((t) => {
            const Icon = ACTIVITY_ICON[t];
            return (
              <AdminForm key={t} action={createActivityAction} className="rounded-2xl border border-border p-4">
                <input type="hidden" name="type" value={t} />
                <p className="flex items-center gap-2 font-heading font-extrabold text-brand-deep">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-brand-soft text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  {ACTIVITY_INFO[t].label}
                </p>
                <p className="text-sm text-muted-foreground">{ACTIVITY_INFO[t].description}</p>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                  <Input label="Title" name="title" required placeholder="E.g. Accueillez vos passagers" />
                  <Submit>
                    <Plus className="size-4" aria-hidden /> Create
                  </Submit>
                </div>
              </AdminForm>
            );
          })}
        </div>
      </Card>

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
                  <Link href={`/admin/labo/${a._id}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-border px-3 py-2.5 hover:bg-brand-soft/50">
                    <Icon className="size-5 shrink-0 text-primary" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-brand-deep">{a.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {ACTIVITY_INFO[t]?.label ?? `Unknown type « ${a.type} »`}
                        {a.level && ` · ${a.level}`}
                        {a.theme && ` · ${themeLabel(a.theme, "en")}`}
                        {a.skills?.length ? ` · ${a.skills.map((x) => skillLabel(x, "en")).join(", ")}` : ""} · {a.uses ? `used in ${a.uses} unit(s)` : "not used yet"} · edited {fmtDate(a.updatedAt)}
                      </span>
                    </span>
                    {a.status === "ready" ? <Pill tone="green">Ready</Pill> : <Pill tone="amber">Draft</Pill>}
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
