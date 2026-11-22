"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/*
 * « My Speaking Challenge »: a compact row (`trigger`) that opens the challenge's details —
 * recording, coach feedback, earlier sends — in a modal (native <dialog>: focus trap, Escape).
 * A bottom sheet on phones, a centred window from `sm`. Closing stops any audio / video playing
 * inside. `#defi-<id>` in the URL opens it on load (links from emails / notifications).
 */
export function ChallengeDialog({ id, title, subtitle, trigger, children }: { id: string; title: string; subtitle?: string; trigger: React.ReactNode; children: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);

  const open = () => {
    const d = dialog.current;
    if (!d || d.open) return;
    d.showModal();
    document.documentElement.style.overflow = "hidden";
  };
  const onClose = () => {
    document.documentElement.style.overflow = "";
    dialog.current?.querySelectorAll("audio, video").forEach((m) => (m as HTMLMediaElement).pause());
    if (location.hash === `#defi-${id}`) history.replaceState(null, "", location.pathname + location.search);
  };

  useEffect(() => {
    if (location.hash === `#defi-${id}`) open();
    return () => {
      document.documentElement.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on mount only
  }, []);

  return (
    <>
      <button type="button" onClick={open} aria-haspopup="dialog" className="block w-full text-left">
        {trigger}
      </button>
      <dialog
        ref={dialog}
        onClose={onClose}
        // A click on the backdrop (the dialog element itself, outside the panel) closes it.
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        aria-labelledby={`defi-${id}-title`}
        className="mx-0 mt-auto mb-0 max-h-[92dvh] w-full max-w-full overflow-y-auto overscroll-contain rounded-t-3xl bg-background p-0 text-ink shadow-2xl backdrop:bg-brand-deep/60 sm:m-auto sm:max-h-[88dvh] sm:max-w-2xl sm:rounded-3xl"
      >
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-border bg-background/95 px-5 pt-4 pb-3">
          <div className="min-w-0 flex-1">
            {subtitle && <p className="text-xs font-semibold text-muted-foreground">{subtitle}</p>}
            <h2 id={`defi-${id}-title`} className="font-heading text-lg leading-tight font-extrabold text-brand-deep">
              {title}
            </h2>
          </div>
          <button type="button" onClick={() => dialog.current?.close()} className="-mr-1 flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-muted" aria-label="Fermer">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="grid gap-4 p-5 pb-8">{children}</div>
      </dialog>
    </>
  );
}
