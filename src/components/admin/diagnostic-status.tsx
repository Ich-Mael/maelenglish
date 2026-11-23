"use client";

import { useTransition } from "react";
import { setDiagnosticStatusAction } from "@/app/admin/actions";
import { inputCls } from "@/components/admin/ui";

/** Follow-up status of a diagnostic lead (saved on change). */
export function DiagnosticStatus({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  return (
    <select aria-label="Follow-up" defaultValue={status} disabled={pending} onChange={(e) => start(() => void setDiagnosticStatusAction(id, e.target.value))} className={`${inputCls} h-9 w-auto`}>
      <option value="new">New</option>
      <option value="contacted">Contacted</option>
      <option value="closed">Closed</option>
    </select>
  );
}
