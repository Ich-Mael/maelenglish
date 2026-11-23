import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, Award, BookOpen, BookOpenCheck, Flame, MessagesSquare, Mic, NotebookPen, RotateCcw, Target, Trophy, type LucideIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { ChallengeSubmission, ConversationSession, EpisodeProgress, StoryProfile, UserBadge, VocabWord } from "@/models";
import { statsFor, xpByDay } from "@/lib/gamification/service";
import { dueCount } from "@/lib/vocabulary";
import { monthlyCapSeconds, remainingSeconds } from "@/lib/ai/metering";
import { PageSkeleton } from "@/components/learn/ui";
import { Avatar } from "@/components/story/avatar";
import type { AvatarConfig } from "@/lib/story/schema";
import { cn } from "cn";

export const metadata: Metadata = {
  title: "My Learning Space",
  robots: { index: false },
};

/*
 * « My Learning Space » (owner decisions 2026-11-22/23): the navbar keeps My Courses and Talk with
 * Coach Ish; everything else is reached from here. Progress first (level, streak, today's goal,
 * badges, this week's XP), then « To do today » (only what's waiting), the Story Mode card, then a card per area —
 * conversations with Coach Ish (first), challenges, « The Vocabulary I Need » — each with a live figure (the account is reached from the username chip).
 */

type Tile = {
  href: string;
  title: string;
  text: string;
  icon: LucideIcon;
  stat: string;
  alert?: string;
  tone: "navy" | "blue" | "white" | "coach";
};
type Todo = { href: string; label: string; icon: LucideIcon; urgent?: boolean };

const DAY_LETTER = ["S", "M", "T", "W", "T", "F", "S"];

async function Space() {
  await connection();
  const me = await requireUser("/mon-espace");
  await connectDB();
  const [stats, week, badges, toRedo, waiting, words, due, talks, lastTalk, leftS, capS, storyProfile, episodesDone] = await Promise.all([
    statsFor(me.id),
    xpByDay(me.id, 7),
    UserBadge.countDocuments({ userId: me.id }),
    ChallengeSubmission.countDocuments({ userId: me.id, status: "returned" }),
    ChallengeSubmission.countDocuments({ userId: me.id, status: "pending" }),
    VocabWord.countDocuments({ userId: me.id }),
    dueCount(me.id),
    ConversationSession.countDocuments({
      userId: me.id,
      status: { $in: ["ended", "debriefed"] },
    }),
    ConversationSession.findOne({ userId: me.id, status: "debriefed" }).sort({ createdAt: -1 }).select("score").lean(),
    remainingSeconds(me.id),
    monthlyCapSeconds(me.id),
    StoryProfile.findOne({ userId: me.id }).select("storyDay characterName avatar").lean(),
    EpisodeProgress.countDocuments({ userId: me.id, status: "completed" }),
  ]);
  const minutesLeft = Math.floor(leftS / 60);
  const weekXp = week.reduce((n, d) => n + d.xp, 0);
  const maxDay = Math.max(1, ...week.map((d) => d.xp));
  const goalPct = Math.min(100, Math.round((stats.todayXp / Math.max(1, stats.dailyGoal)) * 100));
  const sent = stats.counters.assignmentsSubmitted ?? 0;

  const todo: Todo[] = [
    due
      ? {
          href: "/vocabulaire/test",
          label: `${Math.min(due, 10)} word${due === 1 ? "" : "s"} to review`,
          icon: BookOpenCheck,
          urgent: true,
        }
      : null,
    toRedo
      ? {
          href: "/mes-defis",
          label: `${toRedo} challenge${toRedo === 1 ? "" : "s"} to redo`,
          icon: RotateCcw,
          urgent: true,
        }
      : null,
    goalPct < 100
      ? {
          href: "/mes-cours",
          label: `${Math.max(0, stats.dailyGoal - stats.todayXp)} XP to reach today's goal`,
          icon: Target,
        }
      : null,
    {
      href: "/vocabulaire",
      label: "Today's 2 words of your job",
      icon: NotebookPen,
    },
    minutesLeft > 0
      ? {
          href: "/partenaire",
          label: `Talk with Coach Ish · ${minutesLeft} min left`,
          icon: MessagesSquare,
        }
      : null,
  ].filter((x): x is Todo => !!x);

  const tiles: Tile[] = [
    {
      href: "/partenaire#conversations",
      title: "My Conversation with Coach Ish",
      text: "Your talks with Coach Ish and their debriefs.",
      icon: MessagesSquare,
      stat: `${talks ? `${talks} conversation${talks === 1 ? "" : "s"}${lastTalk?.score != null ? ` · last score ${lastTalk.score}` : ""}` : "No conversation yet"} · ${minutesLeft} of ${Math.round(capS / 60)} min left`,
      tone: "coach",
    },
    {
      href: "/mes-defis",
      title: "My Speaking Challenges",
      text: "Your recordings and your coach's feedback.",
      icon: Mic,
      stat: sent ? `${sent} sent${waiting ? ` · ${waiting} waiting for feedback` : ""}` : "No challenge sent yet",
      alert: toRedo ? `${toRedo} to redo` : undefined,
      tone: "navy",
    },
    {
      href: "/vocabulaire",
      title: "The Vocabulary I Need",
      text: "Words of your job every day, your own sentences, short tests, your notebook and the dictionary.",
      icon: NotebookPen,
      stat: words ? `${words} words · ${due} to review today` : "Start with today's words",
      alert: due ? `${due} to review` : undefined,
      tone: "blue",
    },
  ];

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <header>
        <h1 className="text-3xl font-extrabold text-brand-deep">Hello {me.name}!</h1>
        <p className="text-muted-foreground">Your progress and everything about your learning, in one place.</p>
      </header>

      {/* Progress first. */}
      <section aria-label="My progress" className="relative grid gap-5 overflow-clip rounded-[2rem] bg-gradient-to-br from-brand-deep via-brand-deep to-brand-dark p-5 text-white sm:p-7">
        <span aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-80 rounded-full bg-[radial-gradient(circle,rgb(54_79_171/0.9),transparent_70%)]" />
        <span aria-hidden className="pointer-events-none absolute -bottom-24 left-10 size-64 rounded-full bg-[radial-gradient(circle,rgb(255_87_87/0.22),transparent_70%)]" />

        <div className="relative flex flex-wrap items-center gap-5">
          <span
            className="relative flex size-24 shrink-0 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(var(--color-coral) ${stats.level.progress}%, rgb(255 255 255 / 0.15) 0)`,
            }}
            role="img"
            aria-label={`Level ${stats.level.level}, ${stats.level.progress} % to the next level`}
          >
            <span className="flex size-[4.6rem] flex-col items-center justify-center rounded-full bg-brand-deep leading-none">
              <span className="text-[10px] font-bold tracking-wide text-white/70 uppercase">Level</span>
              <span className="font-heading text-3xl font-extrabold">{stats.level.level}</span>
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-2xl font-extrabold">{stats.xp.toLocaleString("en")} XP</p>
            <p className="text-sm text-white/75">
              {Math.max(0, stats.level.next - stats.xp).toLocaleString("en")} XP to level {stats.level.level + 1}
            </p>
            <span className="mt-2 block h-2 max-w-sm overflow-hidden rounded-full bg-white/15" aria-hidden>
              <span className="block h-full rounded-full bg-coral" style={{ width: `${stats.level.progress}%` }} />
            </span>
          </div>
          <Link href="/progression" className="inline-flex h-11 items-center gap-2 rounded-xl border-2 border-white/25 px-4 text-sm font-bold hover:bg-white/10">
            <Trophy className="size-4" aria-hidden /> All my progress <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>

        <dl className="relative grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl bg-white/10 p-4">
            <dt className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-white/70 uppercase">
              <Flame className="size-4 text-coral" aria-hidden /> Streak
            </dt>
            <dd className="mt-1 font-heading text-2xl font-extrabold">
              {stats.streak} day{stats.streak === 1 ? "" : "s"}
            </dd>
            <dd className="text-xs text-white/70">{stats.activeToday ? "Active today ✓" : stats.streak ? "Practise today to keep it!" : `Best: ${stats.longestStreak} day${stats.longestStreak === 1 ? "" : "s"}`}</dd>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <dt className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-white/70 uppercase">
              <Target className="size-4 text-coral" aria-hidden /> Today&apos;s goal
            </dt>
            <dd className="mt-1 font-heading text-2xl font-extrabold tabular-nums">
              {stats.todayXp} / {stats.dailyGoal} XP
            </dd>
            <dd className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/15" aria-hidden>
              <span className={cn("block h-full rounded-full", goalPct >= 100 ? "bg-white" : "bg-coral")} style={{ width: `${goalPct}%` }} />
            </dd>
            <dd className="mt-1 text-xs text-white/70">{goalPct >= 100 ? "Goal reached!" : `${goalPct} %`}</dd>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <dt className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-white/70 uppercase">
              <Award className="size-4 text-coral" aria-hidden /> Badges
            </dt>
            <dd className="mt-1 font-heading text-2xl font-extrabold tabular-nums">{badges}</dd>
            <dd className="text-xs text-white/70">earned so far</dd>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <dt className="text-xs font-bold tracking-wide text-white/70 uppercase">This week</dt>
            <dd className="mt-1 font-heading text-2xl font-extrabold tabular-nums">{weekXp} XP</dd>
            <dd className="mt-1 flex h-8 items-end gap-1" aria-label="XP per day, last 7 days">
              {week.map((d) => (
                <span key={d.day} className="grid flex-1 justify-items-center gap-0.5">
                  <span
                    className={cn("w-2/3 rounded-t-sm", d.xp ? "bg-coral" : "bg-white/20")}
                    style={{
                      height: `${Math.max(3, Math.round((d.xp / maxDay) * 22))}px`,
                    }}
                    title={`${d.day}: ${d.xp} XP`}
                  />
                  <span className="text-[9px] leading-none text-white/60">{DAY_LETTER[new Date(`${d.day}T12:00:00Z`).getUTCDay()]}</span>
                </span>
              ))}
            </dd>
          </div>
        </dl>
      </section>

      {/* What's waiting today. */}
      {todo.length > 0 && (
        <section aria-labelledby="todo" className="grid gap-2">
          <h2 id="todo" className="font-heading text-lg font-extrabold text-brand-deep">
            To do today
          </h2>
          <ul className="flex flex-wrap gap-2">
            {todo.map((t) => (
              <li key={t.label}>
                <Link
                  href={t.href}
                  className={cn(
                    "inline-flex h-11 items-center gap-2 rounded-full border-2 px-4 text-sm font-bold transition hover:-translate-y-0.5 motion-reduce:transition-none",
                    t.urgent ? "border-coral bg-white text-coral-dark shadow-[0_3px_0_0_var(--color-coral)]" : "border-border bg-card text-brand-deep hover:border-primary/40",
                  )}
                >
                  <t.icon className={cn("size-4", t.urgent ? "text-coral" : "text-primary")} aria-hidden /> {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Story Mode: its own card (a product of its own, not one area among others). */}
      <Link
        href="/histoire"
        className="group relative grid items-center gap-5 overflow-clip rounded-[2rem] bg-white p-5 shadow-[0_1px_2px_rgb(20_31_77/0.06),0_24px_48px_-20px_rgb(20_31_77/0.3)] ring-1 ring-primary/10 transition hover:-translate-y-0.5 hover:ring-primary/30 motion-reduce:transition-none sm:grid-cols-[auto_1fr_auto] sm:p-7"
      >
        <span aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-[radial-gradient(circle,rgb(54_79_171/0.14),transparent_70%)]" />
        <span aria-hidden className="pointer-events-none absolute -bottom-24 left-1/3 size-64 rounded-full bg-[radial-gradient(circle,rgb(255_87_87/0.12),transparent_70%)]" />
        {storyProfile ? (
          <Avatar config={storyProfile.avatar as AvatarConfig} size={96} title={storyProfile.characterName} className="relative shadow-lg ring-4 ring-white" />
        ) : (
          <span className="relative flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-primary to-brand-deep text-white shadow-lg ring-4 ring-white">
            <BookOpen className="size-10" aria-hidden />
          </span>
        )}
        <span className="relative grid gap-1">
          <span className="text-xs font-bold tracking-widest text-coral-dark uppercase">Story Mode</span>
          <span className="font-heading text-2xl leading-tight font-extrabold sm:text-3xl">
            <span className="text-primary">Your story</span> <span className="text-coral">in English</span>
          </span>
          <span className="text-ink/75">You are the main character: watch the situation, learn and practise, then talk with the characters to show what you can do.</span>
          <span className="mt-1 text-sm font-bold text-primary">
            {storyProfile ? `Day ${storyProfile.storyDay} of your story · ${episodesDone} episode${episodesDone === 1 ? "" : "s"} played` : "Create your character and start your first season"}
          </span>
        </span>
        <span className="relative inline-flex items-center justify-center gap-2 justify-self-start rounded-2xl border-2 border-coral bg-white px-5 py-2.5 text-[19px] font-bold text-coral shadow-[0_4px_0_0_var(--color-coral)] group-hover:bg-coral-soft sm:justify-self-end">
          {storyProfile ? "Continue" : "Discover"} <ArrowRight className="size-5" aria-hidden />
        </span>
      </Link>

      {/* One card per area. */}
      <ul className="grid gap-4 sm:grid-cols-2">
        {tiles.map((t) =>
          t.tone === "coach" ? (
            // Talk with Coach Ish: the flagship, in its own colours (coral « … with » + blue « Coach Ish », his portrait).
            <li key={t.href}>
              <Link
                href={t.href}
                className="group relative flex h-full items-start gap-4 overflow-clip rounded-3xl border-2 border-coral bg-gradient-to-br from-white via-white to-coral-soft p-5 shadow-[0_4px_0_0_var(--color-coral)] transition hover:-translate-y-0.5 motion-reduce:transition-none"
              >
                <span aria-hidden className="pointer-events-none absolute -top-16 -right-12 size-44 rounded-full bg-[radial-gradient(circle,rgb(54_79_171/0.14),transparent_70%)]" />
                {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized portrait */}
                <img src="/images/coach-ish-256.webp" alt="" width={56} height={56} className="relative size-14 shrink-0 rounded-full object-cover ring-[3px] ring-coral ring-offset-2" />
                <span className="relative grid min-w-0 flex-1 gap-1">
                  <span className="text-lg leading-tight font-extrabold">
                    <span className="text-coral-dark">My Conversation with</span> <span className="text-primary">Coach Ish</span>
                  </span>
                  <span className="text-sm text-ink/70">{t.text}</span>
                  <span className="mt-1 text-sm font-bold text-primary">{t.stat}</span>
                </span>
                <ArrowRight className="relative mt-1 size-5 shrink-0 text-coral transition group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
              </Link>
            </li>
          ) : (
            <li key={t.href}>
              <Link
                href={t.href}
                className={cn(
                  "group flex h-full items-start gap-4 rounded-3xl border-2 p-5 transition hover:-translate-y-0.5 motion-reduce:transition-none",
                  t.tone === "navy" && "border-transparent bg-gradient-to-br from-brand-deep to-brand-dark text-white",
                  t.tone === "blue" && "border-transparent bg-gradient-to-br from-primary to-brand-deep text-white",
                  t.tone === "white" && "border-border bg-card hover:border-primary/40",
                )}
              >
                <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl", t.tone === "white" ? "bg-brand-soft text-primary" : "border-2 border-coral bg-white text-coral")}>
                  <t.icon className="size-6" aria-hidden />
                </span>
                <span className="grid min-w-0 flex-1 gap-1">
                  <span className={cn("flex flex-wrap items-center gap-2 text-lg font-extrabold", t.tone === "white" ? "text-brand-deep group-hover:text-primary" : "text-white")}>
                    {t.title}
                    {t.alert && <span className="rounded-full border-2 border-coral bg-white px-2 py-0.5 text-xs font-bold text-coral-dark">{t.alert}</span>}
                  </span>
                  <span className={cn("text-sm", t.tone === "white" ? "text-muted-foreground" : "text-white/85")}>{t.text}</span>
                  <span className={cn("mt-1 text-sm font-bold", t.tone === "white" ? "text-primary" : "text-white")}>{t.stat}</span>
                </span>
                <ArrowRight className={cn("mt-1 size-5 shrink-0 transition group-hover:translate-x-0.5 motion-reduce:transition-none", t.tone === "white" ? "text-muted-foreground" : "text-white/80")} aria-hidden />
              </Link>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Space />
    </Suspense>
  );
}
