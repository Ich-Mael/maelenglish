"use client";

import Link from "next/link";

/*
 * Unexpected error inside a page (production shows this instead of Next's bare message). French /
 * English together: it can appear on the public site and in the learner app. Details stay in the
 * server logs (Render), never on screen.
 */
export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center">
      <p className="font-heading text-5xl font-extrabold text-coral">Oops!</p>
      <h1 className="text-2xl font-extrabold text-brand-deep">Something went wrong · Une erreur est survenue</h1>
      <p className="max-w-md text-muted-foreground">Try again in a moment. If it keeps happening, tell us on WhatsApp. · Réessayez dans un instant ; si cela continue, écrivez-nous sur WhatsApp.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => retry()} className="inline-flex h-12 items-center rounded-2xl bg-primary px-6 font-semibold text-white">
          Try again · Réessayer
        </button>
        <Link href="/" className="inline-flex h-12 items-center rounded-2xl border-2 border-border bg-white px-6 font-semibold text-brand-deep">
          Home · Accueil
        </Link>
      </div>
    </main>
  );
}
