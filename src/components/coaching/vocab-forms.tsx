"use client";

import { useState, useTransition } from "react";
import { BookmarkCheck, BookmarkPlus, Loader2, Pencil, Send, Trash2 } from "lucide-react";
import { deleteSentenceAction, editVocabItemAction, saveExpressionAction, writeSentenceAction } from "@/app/coaching-actions";
import { AdminForm, Submit } from "@/components/admin/forms";
import { Input } from "@/components/admin/ui";
import { cn } from "cn";

/** « Write my sentence »: checked at once, then shared with the group. */
export function SentenceForm({ coachingId, vocabId, itemId, text, left }: { coachingId: string; vocabId: string; itemId: string; text: string; left: number }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError("");
          const r = await writeSentenceAction(coachingId, vocabId, itemId, value);
          if (r.ok) setValue("");
          else setError(r.error);
        });
      }}
    >
      <label className="text-sm font-semibold text-brand-deep" htmlFor={`s-${vocabId}-${itemId}`}>
        Your sentence with « <span lang="en">{text}</span> » {left === 2 ? "(2 to write)" : "(1 more)"}
      </label>
      <textarea
        id={`s-${vocabId}-${itemId}`}
        lang="en"
        rows={2}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={300}
        placeholder="Write a sentence about your own situation…"
        className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-[15px] outline-none focus:border-primary focus:ring-3 focus:ring-ring/30"
      />
      <button type="submit" disabled={pending || value.trim().split(/\s+/).length < 4} className="inline-flex h-10 w-fit items-center gap-2 justify-self-end rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />} Check &amp; share
      </button>
      {error && <p className="text-sm font-semibold text-coral-dark">{error}</p>}
    </form>
  );
}

/** « Add to my notebook » on an expression (it then comes back in the vocabulary tests). */
export function SaveExpression({ coachingId, vocabId, itemId, saved }: { coachingId: string; vocabId: string; itemId: string; saved: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  if (saved)
    return (
      <span className="inline-flex h-10 w-fit items-center gap-1.5 rounded-xl bg-white/15 px-3 text-sm font-semibold text-white" title="It comes back in your vocabulary tests">
        <BookmarkCheck className="size-4" aria-hidden /> In my notebook
      </span>
    );
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          setError("");
          const r = await saveExpressionAction(coachingId, vocabId, itemId);
          if (!r.ok) setError(r.error);
        })
      }
      className="inline-flex h-10 w-fit items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-bold text-primary shadow-[0_3px_0_0_var(--color-brand-dark)] disabled:opacity-60"
      title={error || "Save it to review it in your vocabulary tests"}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <BookmarkPlus className="size-4" aria-hidden />} {error ? "Try again" : "Add to my notebook"}
    </button>
  );
}

export function DeleteSentence({ coachingId, id }: { coachingId: string; id: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(async () => void (await deleteSentenceAction(coachingId, id)))} className={cn("inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive", pending && "opacity-50")} aria-label="Delete the sentence" title="Delete">
      <Trash2 className="size-3.5" aria-hidden />
    </button>
  );
}

/** The coach adjusts an expression of the day. */
export function EditItem({ coachingId, vocabId, item }: { coachingId: string; vocabId: string; item: { id: string; text: string; translation: string; frNote: string; example: string; exampleFr: string } }) {
  return (
    <details className="group">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary">
        <Pencil className="size-3.5" aria-hidden /> Edit
      </summary>
      <div className="mt-2 rounded-2xl bg-muted/60 p-3">
        <AdminForm action={editVocabItemAction}>
          <input type="hidden" name="coachingId" value={coachingId} />
          <input type="hidden" name="vocabId" value={vocabId} />
          <input type="hidden" name="itemId" value={item.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Expression" name="text" defaultValue={item.text} required />
            <Input label="French" name="translation" defaultValue={item.translation} />
          </div>
          <Input label="Note (French)" name="frNote" defaultValue={item.frNote} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Example" name="example" defaultValue={item.example} />
            <Input label="Example in French" name="exampleFr" defaultValue={item.exampleFr} />
          </div>
          <Submit variant="secondary" className="w-fit">
            Save
          </Submit>
        </AdminForm>
      </div>
    </details>
  );
}
