import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { GapPracticeError, MIN_ITEMS, isGapMode, publicPractice, vocabPractice } from "@/lib/gap-practice";
import { GapPracticePlayer } from "@/components/vocabulary/gap-practice";
import { GapModes } from "@/components/vocabulary/gap-modes";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Fill the gaps", robots: { index: false } };

type P = { searchParams: Promise<{ mode?: string }> };

async function Practice({ searchParams }: P) {
  await connection();
  const me = await requireUser("/vocabulaire/trous");
  await connectDB();
  const raw = (await searchParams).mode;
  const mode = isGapMode(raw) ? raw : "sentences";
  let p: Awaited<ReturnType<typeof vocabPractice>> | null = null;
  let error = "";
  try {
    p = await vocabPractice(me.id, mode);
  } catch (e) {
    if (!(e instanceof GapPracticeError)) console.error("[gap practice]", e);
    error = e instanceof GapPracticeError ? e.message : "The practice isn't available right now: come back in a moment.";
  }
  const body = !p ? (
    <p className="mx-auto max-w-2xl rounded-2xl bg-muted/50 p-5 text-center text-muted-foreground">{error}</p>
  ) : "notEnough" in p ? (
    <div className="mx-auto grid max-w-2xl justify-items-center gap-3 rounded-[2rem] border border-border bg-card p-8 text-center">
      <p className="font-heading text-2xl font-extrabold text-brand-deep">Save a few words first</p>
      <p className="text-muted-foreground">This practice uses the words of your notebook: you need at least {MIN_ITEMS} ({p.notEnough} so far). Add your daily words or words from your lessons.</p>
      <Link href="/vocabulaire" className="rounded-2xl bg-primary px-5 py-3 font-bold text-white">
        Back to my vocabulary
      </Link>
    </div>
  ) : (
    <GapPracticePlayer practice={publicPractice(p, me.id)} backHref="/vocabulaire" renew />
  );
  return (
    <div className="grid gap-4">
      <div className="mx-auto grid w-full max-w-2xl gap-2">
        <Link href="/vocabulaire" className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-primary">
          <ChevronLeft className="size-4" aria-hidden /> The Vocabulary I Need
        </Link>
        <h1 className="font-heading text-2xl font-extrabold text-brand-deep sm:text-3xl">Fill the gaps with my words</h1>
      </div>
      <GapModes mode={mode} href={(m) => `/vocabulaire/trous?mode=${m}`} />
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
