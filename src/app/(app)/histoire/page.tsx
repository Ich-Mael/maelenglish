import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, BookOpen, CalendarDays, Lock, MapPin, MessageCircle, Mic, Pencil } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { EpisodeProgress, StoryEntitlement, User } from "@/models";
import { getProfile } from "@/lib/story/service";
import { listSeasons, storyEpisodes } from "@/lib/story/content";
import { mediaUrlFor } from "@/lib/media";
import { waLink } from "@/lib/site";
import type { AvatarConfig } from "@/lib/story/schema";
import { formatFcfa } from "@/components/admin/ui";
import { Avatar } from "@/components/story/avatar";
import { StoryOnboarding } from "@/components/story/onboarding";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Story Mode", robots: { index: false } };

const card = "rounded-[1.75rem] bg-white shadow-[0_1px_2px_rgb(20_31_77/0.06),0_24px_48px_-24px_rgb(20_31_77/0.3)] ring-1 ring-primary/10";

/*
 * Story Mode home: the learner's character, then their seasons (access, or free preview episodes)
 * and the other published seasons (price, voice minutes included, « Ask for access »).
 */
async function Catalogue() {
  await connection();
  const me = await requireUser("/histoire");
  await connectDB();
  const viewer = { id: me.id, isStaff: me.isStaff };
  const [profile, seasons] = await Promise.all([getProfile(me.id), listSeasons({ drafts: me.isStaff })]);
  if (!profile) {
    const user = await User.findById(me.id).select("name profession").lean();
    return <StoryOnboarding defaultName={user?.name ?? ""} defaultJob={user?.profession ?? ""} cityName={seasons[0]?.city.name || "a new city"} />;
  }
  const now = new Date();
  const [ents, done, covers] = await Promise.all([
    StoryEntitlement.find({ userId: me.id }).lean(),
    EpisodeProgress.aggregate<{ _id: string; n: number }>([{ $match: { userId: profile.userId, status: "completed" } }, { $group: { _id: "$storyId", n: { $sum: 1 } } }]),
    Promise.all(seasons.map((s) => (s.coverMediaId ? mediaUrlFor({ id: me.id, isAdmin: me.isStaff }, s.coverMediaId).catch(() => null) : null))),
  ]);
  const entitled = (slug: string) => viewer.isStaff || ents.some((e) => e.storyId === slug && (!e.expiresAt || e.expiresAt > now));
  const rows = seasons.map((s, i) => ({ s, cover: covers[i], entitled: entitled(s.id), episodes: storyEpisodes(s).length, done: done.find((d) => d._id === s.id)?.n ?? 0 }));
  const mine = rows.filter((r) => r.entitled || r.s.free_episodes > 0);
  const others = rows.filter((r) => !mine.includes(r));

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  /** A season: wide card (picture left, story right) — the picture is the poster of the season, shown whole. */
  const SeasonCard = ({ r }: { r: (typeof rows)[number] }) => {
    const pct = r.episodes ? Math.round((r.done / r.episodes) * 100) : 0;
    const cta = r.entitled ? (r.done ? "Continue the story" : "Start the season") : r.s.free_episodes ? "Try it for free" : "Discover the season";
    return (
      <Link href={`/histoire/${r.s.id}`} className={`${card} group grid overflow-hidden transition hover:-translate-y-0.5 hover:ring-primary/40 motion-reduce:transition-none md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]`}>
        <div className="relative aspect-[16/10] bg-gradient-to-br from-primary to-brand-deep md:aspect-auto md:min-h-72">
          {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL, already resized when uploaded */}
          {r.cover ? <img src={r.cover} alt="" className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-[1.03] motion-reduce:transition-none" /> : <BookOpen className="absolute inset-0 m-auto size-14 text-white/30" />}
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-brand-deep/60 to-transparent" />
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-brand-deep shadow">
            <MapPin className="size-3.5" /> {[r.s.city.name, r.s.city.country].filter(Boolean).join(", ")}
          </span>
          {me.isStaff && r.s.status === "draft" ? <span className="absolute top-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-coral-dark shadow">Draft (staff only)</span> : null}
        </div>
        <div className="grid content-between gap-4 p-5 sm:p-6">
          <div className="grid gap-2">
            <p className="flex flex-wrap items-center gap-2 text-xs font-bold tracking-wide uppercase">
              <span className="rounded-full bg-brand-soft px-2.5 py-1 text-primary">{r.s.level}</span>
              <span className="text-muted-foreground">{plural(r.episodes, "episode")}</span>
            </p>
            <p className="font-heading text-2xl leading-tight font-extrabold text-brand-deep group-hover:text-primary sm:text-[1.7rem]">{r.s.title}</p>
            <p lang="fr" className="border-l-4 border-coral pl-3 text-ink/80 italic">
              {r.s.promise_fr}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-2xl bg-brand-soft/60 px-3 py-2">
              <dt className="text-xs text-muted-foreground">Conversations</dt>
              <dd className="inline-flex items-center gap-1 font-bold text-brand-deep">
                <Mic className="size-3.5 text-primary" aria-hidden /> {r.s.aiMinutesIncluded} min
              </dd>
            </div>
            <div className="rounded-2xl bg-brand-soft/60 px-3 py-2">
              <dt className="text-xs text-muted-foreground">{r.entitled ? "Your progress" : r.s.priceFcfa != null ? "Price" : "Access"}</dt>
              <dd className="font-bold text-brand-deep">{r.entitled ? `${r.done} / ${r.episodes} played` : r.s.priceFcfa != null ? formatFcfa(r.s.priceFcfa) : r.s.free_episodes ? plural(r.s.free_episodes, "free episode") : "Ask for access"}</dd>
            </div>
          </dl>
          {r.entitled ? (
            <span className="h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${pct} % of the season played`}>
              <span className="block h-full rounded-full bg-gradient-to-r from-primary to-brand-deep" style={{ width: `${Math.max(pct, r.done ? 4 : 0)}%` }} />
            </span>
          ) : null}
          <span className="inline-flex items-center justify-center gap-2 justify-self-stretch rounded-2xl border-2 border-coral bg-white px-5 py-3 text-[19px] font-bold text-coral shadow-[0_4px_0_0_var(--color-coral)] transition group-hover:bg-coral-soft sm:justify-self-start">
            {cta} <ArrowRight className="size-5" aria-hidden />
          </span>
        </div>
      </Link>
    );
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <header className={`${card} relative flex flex-wrap items-center gap-5 overflow-clip p-5 sm:p-6`}>
        <span aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-[radial-gradient(circle,rgb(255_87_87/0.12),transparent_70%)]" />
        <Avatar config={profile.avatar as AvatarConfig} size={96} title={profile.characterName} className="shadow-lg ring-4 ring-white" />
        <div className="relative min-w-0 flex-1">
          <p className="text-sm font-bold tracking-widest text-coral-dark uppercase">Story Mode</p>
          <h1 className="font-heading text-3xl font-extrabold">
            <span className="text-primary">Your story</span> <span className="text-coral">in English</span>
          </h1>
          <p className="text-ink/75">
            {profile.characterName} · {profile.job} · from {profile.country}
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-primary">
            <CalendarDays className="size-4" /> Day {profile.storyDay} of your story
          </p>
        </div>
        <Link href="/histoire/personnage" className="relative inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold text-primary hover:bg-brand-soft">
          <Pencil className="size-3.5" /> My character
        </Link>
      </header>

      {mine.length ? (
        <section aria-labelledby="mine" className="grid gap-3">
          <h2 id="mine" className="font-heading text-xl font-extrabold">
            My seasons
          </h2>
          <div className="grid gap-5">
            {mine.map((r) => (
              <SeasonCard key={r.s.id} r={r} />
            ))}
          </div>
        </section>
      ) : null}

      {others.length ? (
        <section aria-labelledby="more" className="grid gap-3">
          <h2 id="more" className="flex items-center gap-2 font-heading text-xl font-extrabold">
            <Lock className="size-5 text-primary" /> {mine.length ? "More seasons" : "Seasons"}
          </h2>
          <div className="grid gap-5">
            {others.map((r) => (
              <SeasonCard key={r.s.id} r={r} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/boutique" className="inline-flex items-center gap-2 rounded-2xl border-2 border-coral bg-white px-5 py-2.5 text-[19px] font-bold text-coral shadow-[0_4px_0_0_var(--color-coral)] hover:bg-coral-soft">
              Buy a season
            </Link>
            <a href={waLink("Bonjour, je voudrais accéder au mode histoire MaelEnglish.")} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
              <MessageCircle className="size-4" /> Ask us on WhatsApp
            </a>
          </div>
        </section>
      ) : null}

      {!rows.length ? <p className={`${card} p-6 text-muted-foreground`}>The first season is on its way: come back soon.</p> : null}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Catalogue />
    </Suspense>
  );
}
