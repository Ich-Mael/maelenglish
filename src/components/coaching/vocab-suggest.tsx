"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Lightbulb, Loader2, Plus, X } from "lucide-react";
import { removeQueuedVocabAction, suggestVocabAction } from "@/app/coaching-actions";
import { AdminForm } from "@/components/admin/forms";
import { TextArea } from "@/components/admin/ui";

/*
 * The coach suggests their own words or expressions (owner request 2026-11-26): added to today's,
 * or planned for the coming days (each new day takes up to 3 of them before the AI completes it).
 * The AI writes the translation, the French note and the example; « Edit » on the card adjusts them.
 */

type Queued = { id: string; text: string; translation: string };

export function SuggestVocab({ coachingId, queue, todayCount, max, active }: { coachingId: string; queue: Queued[]; todayCount: number; max: number; active: boolean }) {
  const room = Math.max(0, max - todayCount);
  return (
    <section className="grid gap-3 rounded-3xl border-2 border-dashed border-primary/35 bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-primary">
          <Lightbulb className="size-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="font-heading text-lg font-bold text-brand-deep">Suggest vocabulary</h3>
          <p className="text-sm text-muted-foreground">Your own words or expressions for this group, one per line. Add the French after « = » if you want; otherwise it is written for you, with a note and an example you can edit after.</p>
        </div>
      </div>
      <AdminForm action={suggestVocabAction} resetOnSuccess>
        <input type="hidden" name="coachingId" value={coachingId} />
        <TextArea label="Words or expressions" name="items" required rows={4} lang="en" placeholder={"walk you through\na track record of = un parcours solide\nto follow up on"} hint="Up to 10 at a time. Expressions already given are left out." />
        <div className="flex flex-wrap gap-2">
          {active && room > 0 && (
            <button type="submit" name="when" value="today" className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-white">
              <Plus className="size-4" aria-hidden /> Add to today <span className="font-normal text-white/80">({room} left)</span>
            </button>
          )}
          <button type="submit" name="when" value="next" className="inline-flex h-10 items-center gap-1.5 rounded-xl border-2 border-primary/30 bg-white px-4 text-sm font-semibold text-brand-deep hover:border-primary">
            <CalendarClock className="size-4" aria-hidden /> Plan for the coming days
          </button>
        </div>
      </AdminForm>
      {queue.length > 0 && (
        <div className="grid gap-2 border-t border-border pt-3">
          <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Coming next ({queue.length}) · 3 a day, before the AI&apos;s</p>
          <ul className="flex flex-wrap gap-2">
            {queue.map((q) => (
              <QueuedChip key={q.id} coachingId={coachingId} q={q} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function QueuedChip({ coachingId, q }: { coachingId: string; q: Queued }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <li className="inline-flex items-center gap-1 rounded-full bg-brand-soft py-1 pr-1 pl-3 text-sm text-brand-deep" title={error || undefined}>
      <strong lang="en">{q.text}</strong>
      {q.translation && <span lang="fr" className="text-muted-foreground">· {q.translation}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await removeQueuedVocabAction(coachingId, q.id);
            setError(r.ok ? "" : r.error);
          })
        }
        className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-white hover:text-destructive"
        aria-label={`Remove « ${q.text} »`}
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <X className="size-3.5" aria-hidden />}
      </button>
    </li>
  );
}
