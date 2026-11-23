import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, BookOpenCheck, CalendarClock, NotebookPen, PenLine, Search, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { DAILY_COUNT, dailyWords, missedWords, nextDue, vocabularyStats } from "@/lib/vocabulary";
import { dayKey } from "@/lib/gamification/rules";
import { DailyWords, MissedWords } from "@/components/vocabulary/daily-words";
import { ProfessionForm } from "@/components/vocabulary/profession-form";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "The Vocabulary I Need", robots: { index: false } };

const fmtDay = (d: Date) => new Date(d).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

/** Today's 2 words (the AI makes them on the first visit of the day for this profession). */
async function Today({ userId, profession, from }: { userId: string; profession: string; from: string }) {
  const [words, missed] = await Promise.all([dailyWords(userId, profession), missedWords(userId, profession, from)]);
  return (
    <div className="grid gap-4">
      {words.length ? <DailyWords words={words} /> : <p className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">Today&apos;s words aren&apos;t ready yet: come back in a moment.</p>}
      <MissedWords groups={missed} />
    </div>
  );
}

async function Vocabulary() {
  await connection();
  const me = await requireUser("/vocabulaire");
  await connectDB();
  const [u, stats, next] = await Promise.all([User.findById(me.id).select("profession dailyWordsFrom").lean(), vocabularyStats(me.id), nextDue(me.id)]);
  const profession = u?.profession ?? "";
  // Learners who set their job before catch-up existed start from today.
  let from = u?.dailyWordsFrom ?? "";
  if (profession && !from) {
    from = dayKey();
    await User.updateOne({ _id: me.id }, { $set: { dailyWordsFrom: from } });
  }
  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <header className="relative overflow-clip rounded-[2rem] bg-white p-6 shadow-[0_1px_2px_rgb(20_31_77/0.06),0_24px_48px_-20px_rgb(20_31_77/0.3)] ring-1 ring-primary/10 sm:p-8">
        <span aria-hidden className="pointer-events-none absolute -top-20 -right-16 size-72 rounded-full bg-[radial-gradient(circle,rgb(54_79_171/0.14),transparent_70%)]" />
        <span aria-hidden className="pointer-events-none absolute -bottom-24 -left-10 size-64 rounded-full bg-[radial-gradient(circle,rgb(255_87_87/0.12),transparent_70%)]" />
        <h1 className="relative font-heading text-4xl leading-tight font-extrabold sm:text-5xl">
          <span className="text-primary">The Vocabulary</span> <span className="whitespace-nowrap text-coral">I Need</span>
        </h1>
        <p className="relative mt-2 max-w-2xl text-lg text-ink/75">The English words of your work: discover {DAILY_COUNT} new ones every day, use them in your own sentences, and keep them for good with short reviews.</p>
        <dl className="relative mt-5 flex flex-wrap gap-2">
          {[
            { label: "words in your notebook", value: stats.words },
            { label: "to review today", value: stats.due, accent: stats.due > 0 },
            { label: "known", value: stats.known },
            { label: "sentences written", value: stats.sentences },
          ].map((x) => (
            <div key={x.label} className={x.accent ? "rounded-full border-2 border-coral bg-white px-3 py-1 text-sm text-coral-dark" : "rounded-full bg-brand-soft px-3 py-1 text-sm text-primary"}>
              <dt className="sr-only">{x.label}</dt>
              <dd>
                <strong className="tabular-nums">{x.value}</strong> {x.label}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <section className="grid gap-4 rounded-[2rem] border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="flex items-center gap-2 font-heading text-xl font-extrabold text-brand-deep">
            <Sparkles className="size-5 text-coral" aria-hidden /> My daily vocabulary
          </h2>
          {profession && <ProfessionForm initial={profession} />}
        </div>
        {profession ? (
          <Suspense fallback={<div className="h-56 animate-pulse rounded-2xl bg-muted" aria-busy />}>
            <Today userId={me.id} profession={profession} from={from} />
          </Suspense>
        ) : (
          <ProfessionForm initial="" />
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href={stats.due ? "/vocabulaire/test" : "#"} aria-disabled={!stats.due} className={stats.due ? "group grid content-start gap-2 rounded-[2rem] bg-gradient-to-br from-primary to-brand-deep p-6 text-white transition hover:-translate-y-0.5 motion-reduce:transition-none" : "grid content-start gap-2 rounded-[2rem] border border-border bg-card p-6"}>
          <p className={stats.due ? "flex items-center gap-2 font-heading text-xl font-extrabold" : "flex items-center gap-2 font-heading text-xl font-extrabold text-brand-deep"}>
            <BookOpenCheck className={stats.due ? "size-6 text-white" : "size-6 text-primary"} aria-hidden /> Today&apos;s test
          </p>
          {stats.due ? (
            <>
              <p className="text-white/85">
                {Math.min(stats.due, 10)} of your words to review{stats.due > 10 ? ` (${stats.due} in all)` : ""}. 2 minutes, +10 XP.
              </p>
              <span className="mt-1 inline-flex w-fit items-center gap-2 rounded-xl border-2 border-coral bg-white px-4 py-2 font-bold text-coral-dark shadow-[0_4px_0_0_var(--color-coral)]">
                Start the test <ArrowRight className="size-4" aria-hidden />
              </span>
            </>
          ) : (
            <p className="flex items-center gap-2 text-muted-foreground">
              <CalendarClock className="size-4" aria-hidden />
              {stats.words ? (next ? `Nothing to review today. Next words come back on ${fmtDay(next)}.` : "Nothing to review today.") : "Add words to your notebook: they come back here for short tests."}
            </p>
          )}
        </Link>

        <Link href="/vocabulaire/phrases" className="group grid content-start gap-2 rounded-[2rem] border border-border bg-card p-6 transition hover:-translate-y-0.5 hover:border-primary/40 motion-reduce:transition-none">
          <p className="flex items-center gap-2 font-heading text-xl font-extrabold text-brand-deep group-hover:text-primary">
            <PenLine className="size-6 text-primary" aria-hidden /> My own sentences
          </p>
          <p className="text-muted-foreground">Use your words in sentences about your work: they are corrected at once, and come back in your tests.</p>
          <p className="text-sm font-bold text-primary">{stats.sentences ? `${stats.sentences} sentence${stats.sentences === 1 ? "" : "s"} written` : "Write your first sentence"} →</p>
        </Link>

        <Link href="/carnet" className="group grid content-start gap-2 rounded-[2rem] border border-border bg-card p-6 transition hover:-translate-y-0.5 hover:border-primary/40 motion-reduce:transition-none">
          <p className="flex items-center gap-2 font-heading text-xl font-extrabold text-brand-deep group-hover:text-primary">
            <NotebookPen className="size-6 text-primary" aria-hidden /> My Notebook
          </p>
          <p className="text-muted-foreground">Every word you saved — from lessons, the dictionary and your daily words — with where you met it.</p>
          <p className="text-sm font-bold text-primary">
            {stats.words} word{stats.words === 1 ? "" : "s"} →
          </p>
        </Link>

        <form action="/dictionnaire" className="grid content-start gap-3 rounded-[2rem] border border-border bg-card p-6">
          <p className="flex items-center gap-2 font-heading text-xl font-extrabold text-brand-deep">
            <Search className="size-6 text-primary" aria-hidden /> Dictionary
          </p>
          <p className="text-muted-foreground">Look up any English word: meaning, French translation, pronunciation.</p>
          <div className="flex gap-2">
            <input name="q" lang="en" placeholder="Search a word…" aria-label="Search a word" className="h-11 min-w-0 flex-1 rounded-xl border-2 border-border bg-white px-3 text-base outline-none focus:border-primary" />
            <button type="submit" className="h-11 rounded-xl bg-primary px-4 font-bold text-white hover:brightness-110">
              Search
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Vocabulary />
    </Suspense>
  );
}
