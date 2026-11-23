import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { NotebookPen } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { DictionarySearch } from "@/components/learn/dictionary-search";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Dictionary", robots: { index: false } };

async function Dictionary({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await connection();
  await requireUser("/dictionnaire");
  const q = String((await searchParams).q ?? "").slice(0, 40);
  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <Link href="/vocabulaire" className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
        ← The Vocabulary I Need
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-brand-deep">Dictionary</h1>
          <p className="text-muted-foreground">Meaning, pronunciation and French translation.</p>
        </div>
        <Link href="/carnet" className="inline-flex items-center gap-2 rounded-xl border-2 border-border bg-card px-3 py-2 text-sm font-bold text-brand-deep hover:border-primary/40">
          <NotebookPen className="size-4 text-primary" aria-hidden /> My Notebook
        </Link>
      </div>
      <DictionarySearch initial={q} />
    </div>
  );
}

export default function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Dictionary searchParams={searchParams} />
    </Suspense>
  );
}
