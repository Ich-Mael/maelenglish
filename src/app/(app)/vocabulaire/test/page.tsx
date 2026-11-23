import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { buildTest } from "@/lib/vocabulary";
import { TestPlayer } from "@/components/vocabulary/test-player";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Today's test", robots: { index: false } };

async function Test() {
  await connection();
  const me = await requireUser("/vocabulaire/test");
  await connectDB();
  const questions = await buildTest(me.id);
  return (
    <div className="mx-auto max-w-2xl">
      {questions.length ? (
        <TestPlayer questions={questions} />
      ) : (
        <div className="grid justify-items-center gap-3 rounded-[2rem] border border-border bg-card p-8 text-center">
          <p className="font-heading text-2xl font-extrabold text-brand-deep">Nothing to review today</p>
          <p className="text-muted-foreground">Your words come back here when it&apos;s time to review them.</p>
          <Link href="/vocabulaire" className="rounded-2xl bg-primary px-5 py-3 font-bold text-white">
            Back to my vocabulary
          </Link>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Test />
    </Suspense>
  );
}
