import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { listWords } from "@/lib/dictionary";
import { SentencesBoard, type WordWithSentences } from "@/components/vocabulary/sentences-board";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "My own sentences", robots: { index: false } };

async function Sentences({ searchParams }: { searchParams: Promise<{ mot?: string }> }) {
  await connection();
  const me = await requireUser("/vocabulaire/phrases");
  await connectDB();
  const sp = await searchParams;
  const words: WordWithSentences[] = (await listWords(me.id)).map((w) => ({
    word: w.word,
    translation: w.translation || w.entry?.translation || "",
    sentences: (w.sentences ?? []).map((s) => ({ id: String(s._id), text: s.text, corrected: s.corrected ?? "", ok: !!s.ok, explanation: s.explanation ?? "" })),
  }));
  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <Link href="/vocabulaire" className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> The Vocabulary I Need
      </Link>
      <div>
        <h1 className="text-3xl font-extrabold text-brand-deep">My own sentences</h1>
        <p className="text-muted-foreground">Make your words yours: use each one in a sentence about your work. You get a correction at once.</p>
      </div>
      {words.length ? (
        <SentencesBoard words={words} initialWord={sp.mot} />
      ) : (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-muted-foreground">
          Your notebook is empty: add your daily words or words from your lessons first.{" "}
          <Link href="/vocabulaire" className="font-semibold text-primary underline">
            Back to my vocabulary
          </Link>
        </p>
      )}
    </div>
  );
}

export default function Page({ searchParams }: { searchParams: Promise<{ mot?: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Sentences searchParams={searchParams} />
    </Suspense>
  );
}
