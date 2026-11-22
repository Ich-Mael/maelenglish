"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";

/**
 * Horizontal path of a unit (course map): native scroll-snap, so it swipes on phones and works
 * without JavaScript. JS only centres the learner's current step on load (`data-current`) and
 * drives the desktop arrows and edge fades. Few steps → the row stays centred (`w-max mx-auto`).
 */
export function PathRow({ label, children }: { label: string; children: React.ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: true });

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft > max - 8 });
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const current = el.querySelector<HTMLElement>("[data-current]");
    if (current) el.scrollLeft = current.offsetLeft - (el.clientWidth - current.offsetWidth) / 2;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [update]);

  const go = (dir: -1 | 1) => {
    const el = track.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.75, behavior: reduce ? "auto" : "smooth" });
  };

  const arrow =
    "absolute top-[3.25rem] z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border-2 border-border bg-card text-brand-deep shadow-sm transition hover:border-primary hover:text-primary sm:flex";

  return (
    <div className="relative">
      {!edge.start && (
        <button type="button" className={cn(arrow, "left-0")} onClick={() => go(-1)} aria-label="Previous activities">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
      )}
      <div
        ref={track}
        tabIndex={0}
        aria-label={`${label} — scroll`}
        className={cn(
          "relative -mx-4 snap-x snap-proximity overflow-x-auto overscroll-x-contain px-4 py-3 outline-none [scrollbar-width:none] focus-visible:ring-4 focus-visible:ring-ring/40 sm:mx-0 [&::-webkit-scrollbar]:hidden",
          !edge.start && !edge.end && "[mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]",
          edge.start && !edge.end && "[mask-image:linear-gradient(to_right,black_85%,transparent)]",
          !edge.start && edge.end && "[mask-image:linear-gradient(to_right,transparent,black_15%)]",
        )}
      >
        <ol className="mx-auto flex w-max">{children}</ol>
      </div>
      {!edge.end && (
        <button type="button" className={cn(arrow, "right-0")} onClick={() => go(1)} aria-label="Next activities">
          <ChevronRight className="size-5" aria-hidden />
        </button>
      )}
    </div>
  );
}

/** One step of a PathRow, joined to the previous one by a line (green once the previous step is done; the step's circle sits above it with z-[1]). */
export function PathStep({ first, reached, current, children }: { first: boolean; reached: boolean; current: boolean; children: React.ReactNode }) {
  return (
    <li data-current={current || undefined} className="relative flex w-32 shrink-0 snap-center justify-center">
      {!first && <span aria-hidden className={cn("absolute top-10 right-1/2 -left-1/2 h-1 -translate-y-1/2 rounded-full", reached ? "bg-gradient-to-r from-primary to-brand-deep" : "bg-border")} />}
      {children}
    </li>
  );
}
