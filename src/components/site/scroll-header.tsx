"use client";

import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  window.addEventListener("scroll", cb, { passive: true });
  return () => window.removeEventListener("scroll", cb);
};

/**
 * Sticky header: white with a blue bottom border, navy once the page is scrolled. Exposes
 * `data-scrolled` so children style themselves with `group-data-[scrolled=true]/hdr:`.
 */
export function ScrollHeader({ children }: { children: React.ReactNode }) {
  const scrolled = useSyncExternalStore(subscribe, () => window.scrollY > 24, () => false);
  return (
    <header
      data-scrolled={scrolled}
      className="group/hdr sticky top-0 z-40 border-b-2 border-primary bg-background/[0.97] transition-[background-color,border-color,box-shadow] duration-300 data-[scrolled=true]:border-white/10 data-[scrolled=true]:bg-brand-deep data-[scrolled=true]:shadow-[0_10px_30px_-15px_rgb(20_31_77/0.7)]"
    >
      {children}
    </header>
  );
}
