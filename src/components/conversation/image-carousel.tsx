"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { cn } from "cn";

/*
 * The pictures of a role-play (map, menu, slides…) before and during the call: one at a time with
 * arrows, swipe (scroll-snap) and dots; tap to see it full screen. A single picture shows alone.
 */
export type CallImage = { url: string; caption: string };

export function ImageCarousel({ images, tone = "light", className }: { images: CallImage[]; tone?: "light" | "dark"; className?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);
  if (!images.length) return null;
  const go = (i: number) => {
    const el = track.current;
    if (!el) return;
    const n = Math.max(0, Math.min(images.length - 1, i));
    el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
  };
  const dark = tone === "dark";
  return (
    <figure className={cn("grid gap-2", className)} aria-roledescription="carousel" aria-label="Pictures for the call">
      <div className="relative">
        <div
          ref={track}
          className="flex snap-x snap-mandatory overflow-x-auto rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={(e) => {
            const el = e.currentTarget;
            setAt(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
          }}
        >
          {images.map((im, i) => (
            <button key={i} type="button" onClick={() => setZoom(i)} className={cn("relative w-full shrink-0 snap-center", dark ? "bg-black/30" : "bg-muted/60")} aria-label={`Picture ${i + 1} of ${images.length}${im.caption ? `: ${im.caption}` : ""} — open full screen`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL, resized when uploaded */}
              <img src={im.url} alt={im.caption} className="mx-auto max-h-[22rem] w-full object-contain sm:max-h-[28rem]" loading={i ? "lazy" : "eager"} />
              <span className="absolute top-2 right-2 rounded-full bg-black/45 p-1.5 text-white">
                <Expand className="size-4" aria-hidden />
              </span>
            </button>
          ))}
        </div>
        {images.length > 1 ? (
          <>
            <button type="button" onClick={() => go(at - 1)} disabled={at === 0} className="absolute top-1/2 left-2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-primary shadow-md disabled:opacity-30" aria-label="Previous picture">
              <ChevronLeft className="size-6" />
            </button>
            <button type="button" onClick={() => go(at + 1)} disabled={at === images.length - 1} className="absolute top-1/2 right-2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-primary shadow-md disabled:opacity-30" aria-label="Next picture">
              <ChevronRight className="size-6" />
            </button>
          </>
        ) : null}
      </div>
      <figcaption className={cn("flex flex-wrap items-center justify-between gap-2 text-sm", dark ? "text-white/85" : "text-ink/75")}>
        <span lang="fr">{images[at]?.caption}</span>
        {images.length > 1 ? (
          <span className="flex items-center gap-1.5">
            {images.map((_, i) => (
              <button key={i} type="button" onClick={() => go(i)} aria-label={`Picture ${i + 1}`} aria-current={i === at} className={cn("size-2.5 rounded-full transition", i === at ? (dark ? "bg-white" : "bg-primary") : dark ? "bg-white/35" : "bg-primary/25")} />
            ))}
            <span className="ml-1 tabular-nums">
              {at + 1} / {images.length}
            </span>
          </span>
        ) : null}
      </figcaption>

      {zoom !== null ? (
        <div role="dialog" aria-modal="true" aria-label={images[zoom]?.caption || "Picture"} className="fixed inset-0 z-[60] flex flex-col bg-black/90 p-3" onClick={() => setZoom(null)}>
          <div className="flex items-center justify-between gap-2 text-white">
            <span lang="fr" className="text-sm">
              {images[zoom]?.caption} {images.length > 1 ? `· ${zoom + 1} / ${images.length}` : ""}
            </span>
            <button type="button" className="rounded-full bg-white/15 p-2" aria-label="Close" onClick={() => setZoom(null)}>
              <X className="size-5" />
            </button>
          </div>
          <div className="relative flex flex-1 items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
            <img src={images[zoom]?.url} alt={images[zoom]?.caption} className="max-h-full max-w-full object-contain" />
            {images.length > 1 ? (
              <>
                <button type="button" onClick={() => setZoom((z) => Math.max(0, (z ?? 0) - 1))} disabled={zoom === 0} className="absolute left-1 flex size-11 items-center justify-center rounded-full bg-white/90 text-primary disabled:opacity-30" aria-label="Previous picture">
                  <ChevronLeft className="size-6" />
                </button>
                <button type="button" onClick={() => setZoom((z) => Math.min(images.length - 1, (z ?? 0) + 1))} disabled={zoom === images.length - 1} className="absolute right-1 flex size-11 items-center justify-center rounded-full bg-white/90 text-primary disabled:opacity-30" aria-label="Next picture">
                  <ChevronRight className="size-6" />
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </figure>
  );
}
