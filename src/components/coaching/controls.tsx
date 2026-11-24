"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, FileUp, Loader2, Mic, Send, Trash2, X } from "lucide-react";
import { deleteEntryAction, deleteGoalAction, deleteResourceAction, deleteTaskAction, markReadAction, postEntryAction, setGoalStatusAction } from "@/app/coaching-actions";
import { uploadMedia } from "@/components/audio/upload";
import { VoiceNoteField } from "@/components/admin/voice-note-field";
import { cn } from "cn";

/* Interactive bits of the coaching space, shared by the learner and the coach screens. */

const STATUS = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
] as const;

export function GoalStatus({ coachingId, goalId, status }: { coachingId: string; goalId: string; status: string }) {
  const [value, setValue] = useState(status);
  const [pending, start] = useTransition();
  return (
    <div role="radiogroup" aria-label="Goal status" className={cn("inline-flex rounded-xl border border-border bg-card p-0.5 text-xs font-bold", pending && "opacity-60")}>
      {STATUS.map((s) => (
        <button
          key={s.value}
          type="button"
          role="radio"
          aria-checked={value === s.value}
          disabled={pending}
          onClick={() => {
            setValue(s.value);
            start(async () => {
              const r = await setGoalStatusAction(coachingId, goalId, s.value);
              if (!r.ok) setValue(status);
            });
          }}
          className={cn("rounded-lg px-2.5 py-1.5 transition", value === s.value ? (s.value === "done" ? "bg-primary text-white" : s.value === "in_progress" ? "bg-brand-soft text-primary" : "bg-muted text-brand-deep") : "text-muted-foreground hover:text-brand-deep")}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

const DELETE = { goal: deleteGoalAction, entry: deleteEntryAction, resource: deleteResourceAction, task: deleteTaskAction };

export function DeleteItem({ kind, coachingId, id, label = "Delete" }: { kind: keyof typeof DELETE; coachingId: string; id: string; label?: string }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  if (confirm)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold">
        <button type="button" disabled={pending} className="rounded-lg border border-destructive/30 px-2 py-1 text-destructive hover:bg-destructive/5" onClick={() => start(async () => void (await DELETE[kind](coachingId, id)))}>
          {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : "Delete"}
        </button>
        <button type="button" className="rounded-lg px-2 py-1 text-muted-foreground hover:bg-muted" onClick={() => setConfirm(false)}>
          Cancel
        </button>
      </span>
    );
  return (
    <button type="button" onClick={() => setConfirm(true)} className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive" aria-label={label} title={label}>
      <Trash2 className="size-4" aria-hidden />
    </button>
  );
}

/** Marks the visible messages read once the page is shown. */
export function MarkRead({ coachingId, unread }: { coachingId: string; unread: number }) {
  const done = useRef(false);
  useEffect(() => {
    if (!unread || done.current) return;
    done.current = true;
    void markReadAction(coachingId);
  }, [coachingId, unread]);
  return null;
}

/** Message box: text and / or a voice note. The coach can mark it as feedback. */
export function Composer({ coachingId, thread, coach, placeholder }: { coachingId: string; thread: string; coach: boolean; placeholder: string }) {
  const [n, setN] = useState(0);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [voice, setVoice] = useState(false);
  return (
    <form
      key={n}
      className="grid gap-3 rounded-2xl border-2 border-border bg-card p-3 sm:p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        start(async () => {
          const r = await postEntryAction(undefined, data);
          if (r?.error) setError(r.error);
          else {
            setError("");
            setVoice(false);
            setN((x) => x + 1);
          }
        });
      }}
    >
      <input type="hidden" name="coachingId" value={coachingId} />
      <input type="hidden" name="thread" value={thread} />
      <label className="sr-only" htmlFor={`msg-${n}`}>
        Message
      </label>
      <textarea id={`msg-${n}`} name="text" rows={3} placeholder={placeholder} className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-[15px] outline-none focus:border-primary focus:ring-3 focus:ring-ring/30" />
      {voice ? (
        <VoiceNoteField name="audioMediaId" initialId="" initialUrl={null} kind={coach ? "voice-note" : "recording"} label={coach ? "Voice note" : "Voice message"} hint={coach ? "Model the right pronunciation, then explain." : "Up to 3 minutes."} />
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {!voice && (
          <button type="button" onClick={() => setVoice(true)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-brand-deep hover:bg-brand-soft">
            <Mic className="size-4 text-primary" aria-hidden /> Add a voice {coach ? "note" : "message"}
          </button>
        )}
        {coach && (
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-brand-deep">
            <input type="checkbox" name="kind" value="feedback" className="size-4 accent-primary" /> Mark as feedback
          </label>
        )}
        <button type="submit" disabled={pending} className="ml-auto inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />} Send
        </button>
      </div>
      {error && <p className="text-sm font-semibold text-coral-dark">{error}</p>}
    </form>
  );
}

/** Upload a PDF or a picture for the coaching (Media kind « document », private). */
export function DocumentField({ name }: { name: string }) {
  const [id, setId] = useState("");
  const [file, setFile] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="grid gap-1.5">
      <input type="hidden" name={name} value={id} />
      <span className="text-sm font-semibold text-brand-deep">File (PDF or picture, up to 20 MB)</span>
      {id ? (
        <span className="flex items-center gap-2 rounded-xl border border-border bg-brand-soft/50 px-3 py-2 text-sm font-semibold text-brand-deep">
          <Check className="size-4 text-primary" aria-hidden /> <span className="min-w-0 flex-1 truncate">{file}</span>
          <button type="button" onClick={() => (setId(""), setFile(""))} className="text-muted-foreground hover:text-destructive" aria-label="Remove the file">
            <X className="size-4" aria-hidden />
          </button>
        </span>
      ) : (
        <label className={cn("inline-flex h-10 w-fit cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-brand-deep hover:bg-brand-soft", busy && "pointer-events-none opacity-60")}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileUp className="size-4" aria-hidden />} {busy ? "Uploading…" : "Choose a file"}
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setError("");
              setBusy(true);
              try {
                setId(await uploadMedia(f, { kind: "document" }));
                setFile(f.name);
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      )}
      {error && <p className="text-sm font-semibold text-coral-dark">{error}</p>}
    </div>
  );
}

/** A datetime-local input sent as an ISO date (the browser's time zone), so the server stores the right moment. */
export function DateTimeField({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string }) {
  const [iso, setIso] = useState(defaultValue ?? "");
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-brand-deep">
      {label}
      <input type="datetime-local" required onChange={(e) => setIso(e.target.value ? new Date(e.target.value).toISOString() : "")} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-3 focus:ring-ring/30" />
      <input type="hidden" name={name} value={iso} />
    </label>
  );
}

export function useRefreshOnFocus() {
  const router = useRouter();
  useEffect(() => {
    const f = () => router.refresh();
    window.addEventListener("focus", f);
    return () => window.removeEventListener("focus", f);
  }, [router]);
}
