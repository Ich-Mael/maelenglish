import { AudioLines } from "lucide-react";

/** The recording of an AI role-play call (signed URL from the server), or why there isn't one yet. */
export function CallRecording({ url, pending }: { url: string | null; pending?: boolean }) {
  if (!url && !pending) return null;
  return (
    <section className="grid gap-2 rounded-3xl border border-border bg-card p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-lg font-extrabold text-brand-deep">
        <AudioLines className="size-5 text-primary" aria-hidden /> Recording of the call
      </h2>
      {url ? <audio src={url} controls preload="none" className="w-full" /> : <p className="text-sm text-muted-foreground">The recording will be available in a minute or two: refresh the page.</p>}
    </section>
  );
}
