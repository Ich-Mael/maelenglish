import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ArrowRight, BookOpen, CircleHelp, MapPin } from "lucide-react";
import { cn } from "cn";
import { actorOf, requireStaff } from "@/lib/admin/context";
import { can } from "@/lib/admin/permissions";
import { adminSeasonList } from "@/lib/story/admin";
import { pricingSettings, measuredCostPerMinute } from "@/lib/story/minutes";
import { reviewMediaUrl } from "@/lib/media";
import { Card, EmptyState, Input, PageHeader, formatFcfa } from "@/components/admin/ui";
import { AdminForm, Submit } from "@/components/admin/forms";
import { PricingSettingsForm } from "@/components/admin/story/pricing-settings";
import { PageSkeleton } from "@/components/learn/ui";
import { createSeasonAction, importSeasonAction } from "./actions";

export const metadata: Metadata = { title: "Story Mode" };

async function Seasons() {
  await connection();
  const me = await requireStaff("/admin/story");
  const a = actorOf(me);
  if (!can.editStory(a)) redirect("/admin");
  const manage = can.manageStory(a);
  const [seasons, pricing, measured] = await Promise.all([adminSeasonList(), pricingSettings(), measuredCostPerMinute()]);
  const covers = await Promise.all(seasons.map((s) => (s.coverMediaId ? reviewMediaUrl(s.coverMediaId).catch(() => null) : null)));

  return (
    <div className="grid max-w-5xl gap-5">
      <PageHeader
        title="Story Mode"
        subtitle="Paid seasons: an interactive story in a city, with one learning goal. Learners get the published seasons they have access to (plus each season's free preview episodes)."
        actions={
          <Link href="/admin/story/guide" className="inline-flex h-10 items-center gap-2 rounded-xl border-2 border-coral bg-white px-4 text-sm font-bold text-coral-dark shadow-[0_3px_0_0_var(--color-coral)] hover:bg-coral-soft">
            <CircleHelp className="size-4" aria-hidden /> How Story Mode works
          </Link>
        }
      />
      {seasons.length ? (
        <ul className="grid gap-4">
          {seasons.map((s, i) => {
            const pct = s.episodes ? Math.round((s.ready / s.episodes) * 100) : 0;
            const live = s.status === "published";
            return (
              <li key={s.id}>
                <Link href={`/admin/story/${s.id}`} className="group grid overflow-hidden rounded-3xl border border-border bg-card shadow-[0_1px_2px_rgb(20_31_77/0.05),0_18px_36px_-24px_rgb(20_31_77/0.35)] transition hover:-translate-y-0.5 hover:border-primary/40 motion-reduce:transition-none md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
                  <div className="relative aspect-[16/9] bg-gradient-to-br from-primary to-brand-deep md:aspect-auto md:min-h-64">
                    {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL, already resized when uploaded */}
                    {covers[i] ? <img src={covers[i]!} alt="" className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-[1.03] motion-reduce:transition-none" /> : <BookOpen className="absolute inset-0 m-auto size-12 text-white/40" />}
                    <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-brand-deep/60 to-transparent" />
                    <span className={cn("absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold shadow", live ? "bg-white text-success" : "bg-white text-ink/70")}>
                      <span className={cn("size-2 rounded-full", live ? "bg-success" : "bg-ink/30")} aria-hidden /> {live ? "Published" : "Draft"}
                    </span>
                    <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-brand-deep shadow">
                      <MapPin className="size-3.5" aria-hidden /> {[s.city, s.country].filter(Boolean).join(", ") || "No city"}
                    </span>
                  </div>
                  <div className="grid content-between gap-4 p-5">
                    <div className="grid gap-1.5">
                      <p className="flex flex-wrap items-center gap-2 text-xs font-bold tracking-wide uppercase">
                        <span className="rounded-full bg-brand-soft px-2.5 py-1 text-primary">{s.level || "No level"}</span>
                        <span className="text-muted-foreground">/histoire/{s.slug}</span>
                      </p>
                      <p className="font-heading text-2xl leading-tight font-extrabold text-brand-deep group-hover:text-primary">{s.title}</p>
                      <p lang="fr" className={cn("border-l-4 pl-3 italic", s.learningGoal ? "border-coral text-ink/80" : "border-border text-muted-foreground")}>
                        {s.learningGoal || "No learning goal yet"}
                      </p>
                    </div>
                    <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                      <div className="rounded-2xl bg-brand-soft/60 px-3 py-2 sm:col-span-2">
                        <dt className="flex justify-between text-xs text-muted-foreground">
                          Episodes ready <span className="font-semibold text-brand-deep">{s.ready} / {s.episodes}</span>
                        </dt>
                        <dd className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white">
                          <span className={cn("block h-full rounded-full", s.ready === s.episodes && s.episodes ? "bg-gradient-to-r from-primary to-brand-deep" : "bg-coral")} style={{ width: `${pct}%` }} />
                        </dd>
                      </div>
                      <div className="rounded-2xl bg-brand-soft/60 px-3 py-2">
                        <dt className="text-xs text-muted-foreground">Price</dt>
                        <dd className={cn("font-bold", s.priceFcfa != null ? "text-brand-deep" : "text-coral-dark")}>{s.priceFcfa != null ? formatFcfa(s.priceFcfa) : "Not set"}</dd>
                      </div>
                      <div className="rounded-2xl bg-brand-soft/60 px-3 py-2">
                        <dt className="text-xs text-muted-foreground">Learners</dt>
                        <dd className="font-bold text-brand-deep">{s.learners}</dd>
                      </div>
                    </dl>
                    <p className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">{s.aiMinutesIncluded} conversation min included per learner</span>
                      <span className="inline-flex items-center gap-1 font-bold text-primary">
                        Edit the season <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
                      </span>
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState>No season yet: create one or import a season file.</EmptyState>
      )}

      {manage ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="New season" description="The short name is the season's URL and never changes.">
            <AdminForm action={createSeasonAction}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Title" name="title" required placeholder="Season 1 — The Arrival" />
                <Input label="Short name (URL)" name="slug" required placeholder="s1-arrival" pattern="[a-z0-9][a-z0-9\-_]*" />
                <Input label="City" name="city" placeholder="Accra" />
                <Input label="Country" name="country" placeholder="Ghana" />
                <Input label="Level" name="level" placeholder="A1–A2" />
                <Input label="Learning goal (French)" name="learningGoal" placeholder="Je me débrouille au quotidien en anglais" />
              </div>
              <div>
                <Submit>Create the season</Submit>
              </div>
            </AdminForm>
          </Card>
          <Card title="Import a season file" description="A .json season (the « Export JSON » format). It arrives as a draft.">
            <AdminForm action={importSeasonAction}>
              <input type="file" name="file" accept="application/json,.json" className="text-sm" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="replace" /> Replace the season with the same short name (episodes updated, learner progress kept)
              </label>
              <div>
                <Submit variant="secondary">Import</Submit>
              </div>
            </AdminForm>
          </Card>
          <Card title="Pricing settings" description={`Used for the « Pricing » estimate of every season. ${measured ? `Real cost measured over 30 days: $${measured.usd.toFixed(3)} per conversation minute (${measured.minutes} min).` : `Until enough real usage: the ElevenLabs plan's cost (Talk with Coach Ish budget) if set, else $${pricing.convUsdPerMin.toFixed(3)} per conversation minute.`}`} className="lg:col-span-2">
            <PricingSettingsForm initial={pricing} />
          </Card>
        </div>
      ) : null}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Seasons />
    </Suspense>
  );
}
