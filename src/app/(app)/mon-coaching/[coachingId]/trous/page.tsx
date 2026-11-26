import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { CoachingError, openCoaching } from "@/lib/coaching/service";
import { coachingPath } from "@/lib/coaching/paths";
import { GapPracticeError, MIN_ITEMS, attemptsByMember, coachingPractice, isGapMode, publicPractice } from "@/lib/gap-practice";
import { User } from "@/models";
import { GapPracticePlayer } from "@/components/vocabulary/gap-practice";
import { GapModes } from "@/components/vocabulary/gap-modes";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Fill the gaps", robots: { index: false } };

/*
 * Fill the gaps with the coaching's expressions of the last 7 days (owner decision 2026-11-26):
 * one practice per coaching, day and mode, shared by the group. The coach tries it (nothing saved)
 * and sees each member's best score.
 */

type P = { params: Promise<{ coachingId: string }>; searchParams: Promise<{ mode?: string }> };

async function Practice({ params, searchParams }: P) {
  await connection();
  const { coachingId } = await params;
  const me = await requireUser(`/mon-coaching/${coachingId}/trous`);
  await connectDB();
  const v = { id: me.id, role: me.role };
  let opened;
  try {
    opened = await openCoaching(v, coachingId);
  } catch (e) {
    if (e instanceof CoachingError) notFound();
    throw e;
  }
  const { coaching, role } = opened;
  const coach = role === "coach";
  const back = coach ? `/admin/coaching/${coachingId}?tab=vocabulary` : coachingPath(coachingId, "vocabulary");
  const raw = (await searchParams).mode;
  const mode = isGapMode(raw) ? raw : "sentences";
  let p: Awaited<ReturnType<typeof coachingPractice>> | null = null;
  let error = "";
  try {
    p = await coachingPractice(v, coachingId, mode);
  } catch (e) {
    if (!(e instanceof GapPracticeError) && !(e instanceof CoachingError)) console.error("[gap practice]", e);
    error = e instanceof GapPracticeError ? e.message : "The practice isn't available right now: come back in a moment.";
  }
  const scores = coach && p && !("notEnough" in p) ? attemptsByMember(p) : null;
  const people = scores ? await User.find({ _id: { $in: coaching.memberIds ?? [] } }).select("name surname").lean() : [];
  const body = !p ? (
    <p className="mx-auto max-w-2xl rounded-2xl bg-muted/50 p-5 text-center text-muted-foreground">{error}</p>
  ) : "notEnough" in p ? (
    <p className="mx-auto max-w-2xl rounded-2xl bg-muted/50 p-5 text-center text-muted-foreground">This practice uses the expressions of the last 7 days: at least {MIN_ITEMS} are needed ({p.notEnough} so far). Come back after a few days of vocabulary.</p>
  ) : (
    <>
      <GapPracticePlayer practice={publicPractice(p, me.id)} backHref={back} preview={coach} />
      {scores && (
        <section className="mx-auto grid w-full max-w-2xl gap-2 rounded-3xl border-2 border-border bg-card p-4">
          <h2 className="font-bold text-brand-deep">Today&apos;s results</h2>
          <ul className="grid gap-1 text-sm">
            {people.map((u) => {
              const s = scores.get(String(u._id));
              return (
                <li key={String(u._id)} className="flex justify-between gap-2">
                  <span>{`${u.name} ${u.surname ?? ""}`.trim()}</span>
                  <span className={s ? "font-bold text-brand-deep" : "text-muted-foreground"}>{s ? `${s.best}% · ${s.tries} tr${s.tries > 1 ? "ies" : "y"}` : "Not done yet"}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
  return (
    <div className="grid gap-4">
      <div className="mx-auto grid w-full max-w-2xl gap-2">
        <Link href={back} className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-primary">
          <ChevronLeft className="size-4" aria-hidden /> {coaching.title}
        </Link>
        <h1 className="font-heading text-2xl font-extrabold text-brand-deep sm:text-3xl">Fill the gaps · this week&apos;s expressions</h1>
      </div>
      <GapModes mode={mode} href={(m) => `/mon-coaching/${coachingId}/trous?mode=${m}`} />
      {body}
    </div>
  );
}

export default function Page(props: P) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Practice {...props} />
    </Suspense>
  );
}
