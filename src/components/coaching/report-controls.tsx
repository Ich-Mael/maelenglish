"use client";

import { Printer } from "lucide-react";
import { saveReportCommentAction } from "@/app/coaching-actions";
import { AdminForm, Submit } from "@/components/admin/forms";
import { TextArea } from "@/components/admin/ui";

/** « Print / Save as PDF »: the browser's print dialog (the page's print styles keep the report only). */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-[0_4px_0_0_var(--color-brand-dark)]">
      <Printer className="size-4" aria-hidden /> Print / Save as PDF
    </button>
  );
}

/** The coach's comment for the month, shown in the report as « Le mot du coach » (French, for the company). */
export function ReportCommentForm({ coachingId, month, comment }: { coachingId: string; month: string; comment: string }) {
  return (
    <AdminForm action={saveReportCommentAction}>
      <input type="hidden" name="coachingId" value={coachingId} />
      <input type="hidden" name="month" value={month} />
      <TextArea label="Your comment for the company (in French)" name="comment" defaultValue={comment} rows={6} maxLength={4000} hint="Shown in the report as « Le mot du coach »: progress seen in sessions, strengths, what to work on next month." />
      <Submit variant="secondary" className="w-fit">
        Save the comment
      </Submit>
    </AdminForm>
  );
}
