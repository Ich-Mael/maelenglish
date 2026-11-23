"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { deleteConversationAudioAction } from "@/app/admin/actions";

/** Admins only: delete a call's recording (the transcript and debrief stay). */
export function DeleteRecording({ sessionId }: { sessionId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Delete this recording for good? The transcript and the debrief are kept.")) return;
          setError("");
          start(async () => {
            const r = await deleteConversationAudioAction(sessionId);
            if (r.error) setError(r.error);
          });
        }}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border-2 border-coral bg-white px-3 text-sm font-bold text-coral-dark hover:bg-coral-soft disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />} Delete the recording
      </button>
      {error && <span className="text-sm text-coral-dark">{error}</span>}
    </div>
  );
}
