"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { deleteFactAction } from "@/app/(app)/story-actions";

/* « What the characters remember about you »: learners can delete any fact (spec: facts are editable). */

const LABEL: Record<string, string> = {
  learner_job: "Your job",
  learner_country: "Your country",
  learner_hometown: "Your home town",
  learner_reason_for_coming: "Why you came",
  learner_length_of_stay: "How long you stay",
  learner_job_description: "Your work",
  learner_address_area: "Where you live",
};
export const factLabel = (k: string) => LABEL[k] ?? k.replace(/^learner_/, "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export function FactsList({ facts }: { facts: { key: string; storeKey: string; value: string }[] }) {
  const [pending, start] = useTransition();
  if (!facts.length) return <p className="text-sm text-muted-foreground">Nothing yet: talk with the characters and they&apos;ll remember what you tell them.</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {facts.map((f) => (
        <li key={f.storeKey} className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft py-1 pr-1 pl-3 text-sm">
          <span className="text-muted-foreground">{factLabel(f.key)}:</span> <span lang="en" className="font-semibold text-brand-deep">{f.value}</span>
          <button type="button" disabled={pending} onClick={() => start(async () => void (await deleteFactAction(f.storeKey)))} aria-label={`Forget « ${factLabel(f.key)} »`} className="flex size-6 items-center justify-center rounded-full text-ink/50 hover:bg-white hover:text-coral-dark">
            <X className="size-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}
