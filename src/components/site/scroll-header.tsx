"use client";

import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  window.addEventListener("scroll", cb, { passive: true });
  return () => window.removeEventListener("scroll", cb);
};

/**
 * Sticky header: white with a blue → red brand line at the bottom, navy once the page is scrolled. Exposes
 * `data-scrolled` so children style themselves with `group-data-[scrolled=true]/hdr:`.
 */
export function ScrollHeader({ children }: { children: React.ReactNode }) {
  const scrolled = useSyncExternalStore(subscribe, () => window.scrollY > 24, () => false);
  return (
    <header
      data-scrolled={scrolled}
      className="group/hdr sticky top-0 z-40 bg-white/[0.97] shadow-[0_6px_24px_-18px_rgb(20_31_77/0.35)] transition-[background-color,box-shadow] duration-300 data-[scrolled=true]:bg-brand-deep data-[scrolled=true]:shadow-[0_10px_30px_-15px_rgb(20_31_77/0.7)]"
    >
      {children}
      {/* Brand line under the header: blue fading into the logo red (hidden on the navy scrolled bar). */}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-primary via-primary to-coral transition-opacity duration-300 group-data-[scrolled=true]/hdr:opacity-0" />
    </header>
  );
}
