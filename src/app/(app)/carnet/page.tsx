import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Search } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { connectDB } from "@/lib/db";
import { listWords } from "@/lib/dictionary";
import { stepPath } from "@/lib/learn/paths";
import { Notebook, type NotebookWord } from "@/components/learn/notebook";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "My Notebook", robots: { index: false } };

async function Carnet() {
  await connection();
  const me = await requireUser("/carnet");
  await connectDB();
  const words: NotebookWord[] = (await listWords(me.id)).map((w) => ({
    word: w.word,
    context: w.context,
    translation: w.translation || w.entry?.translation || "",
    href: w.courseId && w.stepId ? stepPath(String(w.courseId), String(w.stepId)) : null,
    known: w.known,
    reviews: w.reviews,
    addedAt: new Date(w.createdAt).toISOString(),
    entry: w.entry,
  }));
  return (
    <div className="mx-auto grid max-w-4xl gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-brand-deep">My Notebook</h1>
          <p className="text-muted-foreground">The words you saved, to review them.</p>
        </div>
        <Link href="/dictionnaire" className="inline-flex items-center gap-2 rounded-xl border-2 border-border bg-card px-3 py-2 text-sm font-bold text-brand-deep hover:border-primary/40">
          <Search className="size-4 text-primary" aria-hidden /> Dictionary
        </Link>
      </div>
      <Notebook words={words} />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Carnet />
    </Suspense>
  );
}
