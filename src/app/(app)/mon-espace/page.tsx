import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, CircleUserRound, Flame, MessagesSquare, Mic, NotebookPen, Search, Trophy, type LucideIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { ChallengeSubmission, ConversationSession, VocabWord } from "@/models";
import { statsFor } from "@/lib/gamification/service";
import { monthlyCapSeconds, remainingSeconds } from "@/lib/ai/metering";
import { PageSkeleton } from "@/components/learn/ui";
import { cn } from "cn";

export const metadata: Metadata = { title: "My Learning Space", robots: { index: false } };

/*
 * « My Learning Space » (owner decision 2026-11-22): the navbar keeps My Courses and Speaking
 * Partner; everything else is reached from here — challenges, conversations, progress, notebook, dictionary,
 * account — each card with a live figure.
 */

type Tile = { href: string; title: string; text: string; icon: LucideIcon; stat?: string; alert?: string; hero?: boolean; wide?: boolean };

async function Space() {
  await connection();
  const me = await requireUser("/mon-espace");
  await connectDB();
  const [stats, toRedo, waiting, words, toReview, talks, lastTalk, leftS, capS] = await Promise.all([
    statsFor(me.id),
    ChallengeSubmission.countDocuments({ userId: me.id, status: "returned" }),
    ChallengeSubmission.countDocuments({ userId: me.id, status: "pending" }),
    VocabWord.countDocuments({ userId: me.id }),
    VocabWord.countDocuments({ userId: me.id, known: false }),
    ConversationSession.countDocuments({ userId: me.id, status: { $in: ["ended", "debriefed"] } }),
    ConversationSession.findOne({ userId: me.id, status: "debriefed" }).sort({ createdAt: -1 }).select("score title").lean(),
    remainingSeconds(me.id),
    monthlyCapSeconds(me.id),
  ]);
  const minutesLine = `${Math.floor(leftS / 60)} of ${Math.round(capS / 60)} min left this month`;
  const sent = stats.counters.assignmentsSubmitted ?? 0;
  const tiles: Tile[] = [
    {
      href: "/mes-defis",
      title: "My Speaking Challenges",
      text: "Your recordings and your coach's feedback.",
      icon: Mic,
      stat: sent ? `${sent} sent${waiting ? ` · ${waiting} waiting for feedback` : ""}` : "No challenge sent yet",
      alert: toRedo ? `${toRedo} to redo` : undefined,
      hero: true,
    },
    {
      href: "/partenaire#conversations",
      title: "My Conversations",
      text: "Your AI role-plays and their debriefs: scores, corrections, Coach Ish Tips.",
      icon: MessagesSquare,
      stat: `${talks ? `${talks} conversation${talks === 1 ? "" : "s"}${lastTalk?.score != null ? ` · last score ${lastTalk.score} / 100` : ""}` : "No conversation yet"} · ${minutesLine}`,
    },
    { href: "/progression", title: "My Progress", text: "Level, streak, daily goal and badges.", icon: Trophy, stat: `Level ${stats.level.level} · ${stats.xp} XP` },
    { href: "/carnet", title: "My Notebook", text: "The words you saved, and flashcards to review them.", icon: NotebookPen, stat: words ? `${words} words · ${toReview} to review` : "No word saved yet" },
    { href: "/dictionnaire", title: "Dictionary", text: "Look up any English word: meaning, French translation, pronunciation.", icon: Search },
    { href: "/compte", title: "My Account", text: "Profile, photo, password and connected devices.", icon: CircleUserRound, stat: me.username, wide: true },
  ];
  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-brand-deep">My Learning Space</h1>
          <p className="text-muted-foreground">Everything about your learning, in one place.</p>
        </div>
        {stats.streak > 0 && (
          <p className="inline-flex items-center gap-1.5 rounded-full border-2 border-coral bg-white px-3 py-1 text-sm font-bold text-coral-dark">
            <Flame className="size-4 text-coral" aria-hidden /> {stats.streak}-day streak
          </p>
        )}
      </header>
      <ul className="grid gap-4 sm:grid-cols-2">
        {tiles.map((t) => (
          <li key={t.href} className={cn((t.hero || t.wide) && "sm:col-span-2")}>
            <Link
              href={t.href}
              className={cn(
                "group flex h-full items-start gap-4 rounded-3xl border-2 p-5 transition hover:-translate-y-0.5 motion-reduce:transition-none",
                t.hero ? "border-transparent bg-gradient-to-br from-brand-deep to-brand-dark text-white" : "border-border bg-card hover:border-primary/40",
              )}
            >
              <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl", t.hero ? "border-2 border-coral bg-white text-coral" : "bg-brand-soft text-primary")}>
                <t.icon className="size-6" aria-hidden />
              </span>
              <span className="grid min-w-0 flex-1 gap-1">
                <span className={cn("flex items-center gap-2 text-lg font-extrabold", t.hero ? "text-white" : "text-brand-deep group-hover:text-primary")}>
                  {t.title}
                  {t.alert && <span className="rounded-full border-2 border-coral bg-white px-2 py-0.5 text-xs font-bold text-coral-dark">{t.alert}</span>}
                </span>
                <span className={cn("text-sm", t.hero ? "text-white/85" : "text-muted-foreground")}>{t.text}</span>
                {t.stat && <span className={cn("mt-1 text-sm font-bold", t.hero ? "text-white" : "text-primary")}>{t.stat}</span>}
              </span>
              <ArrowRight className={cn("mt-1 size-5 shrink-0 transition group-hover:translate-x-0.5 motion-reduce:transition-none", t.hero ? "text-white/80" : "text-muted-foreground")} aria-hidden />
            </Link>
          </li>
        ))}
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
