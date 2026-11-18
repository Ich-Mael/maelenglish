"use client";

import { Children, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "cn";

/**
 * Horizontal carousel on native scroll-snap: swipe on phones, arrows + progress
 * bar on desktop, keyboard scrolling on the focusable track. Works without
 * JavaScript (it's just a scrollable row); JS only drives the arrows, the
 * progress bar and the edge fades.
 */
export function Carousel({ label, heading, children }: { label: string; heading?: React.ReactNode; children: React.ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const [state, setState] = useState({ start: true, end: false, thumb: 1, offset: 0 });
  const slides = Children.toArray(children);

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const x = el.scrollLeft;
    const thumb = el.scrollWidth ? el.clientWidth / el.scrollWidth : 1;
    setState({ start: x < 8, end: x > max - 8, thumb, offset: max > 0 ? (x / max) * (1 - thumb) : 0 });
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    // ResizeObserver fires once on observe (initial measure) and on every resize.
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

  function go(dir: -1 | 1) {
    const el = track.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: reduce ? "auto" : "smooth" });
  }

  const arrow =
    "flex size-11 items-center justify-center rounded-full border-2 border-border bg-card text-brand-deep shadow-sm transition hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-35";

  return (
    <section aria-roledescription="carrousel" aria-label={label}>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="min-w-0">{heading}</div>
        <div className="hidden shrink-0 gap-2 sm:flex">
          <button type="button" className={arrow} onClick={() => go(-1)} disabled={state.start} aria-label="Programmes précédents">
            <ArrowLeft className="size-5" aria-hidden />
          </button>
          <button type="button" className={arrow} onClick={() => go(1)} disabled={state.end} aria-label="Programmes suivants">
            <ArrowRight className="size-5" aria-hidden />
          </button>
        </div>
      </div>

      <div
        ref={track}
        tabIndex={0}
        aria-label={`${label} — faites défiler`}
        className={cn(
          "-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-5 overflow-x-auto overscroll-x-contain px-4 pt-2 pb-6 outline-none [scrollbar-width:none] focus-visible:ring-4 focus-visible:ring-ring/40 sm:mx-0 sm:scroll-px-0 sm:px-0 [&::-webkit-scrollbar]:hidden",
          !state.end && "sm:[mask-image:linear-gradient(to_right,black_85%,transparent)]",
          !state.start && !state.end && "sm:[mask-image:linear-gradient(to_right,transparent,black_6%,black_85%,transparent)]",
          !state.start && state.end && "sm:[mask-image:linear-gradient(to_right,transparent,black_6%)]",
        )}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            role="group"
            aria-roledescription="diapositive"
            aria-label={`${i + 1} sur ${slides.length}`}
            className="flex shrink-0 basis-[84%] snap-start sm:basis-[46%] lg:basis-[31.5%]"
          >
            {slide}
          </div>
        ))}
      </div>

      <div className="mx-auto mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-border" aria-hidden>
        <div
          className="h-full rounded-full bg-primary transition-[margin] duration-150"
          style={{ width: `${Math.max(state.thumb * 100, 12)}%`, marginLeft: `${state.offset * 100}%` }}
        />
      </div>
    </section>
  );
}
