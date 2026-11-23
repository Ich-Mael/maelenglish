import Link from "next/link";
import { Briefcase, Building2, Bus, Car, Check, Coffee, Cross, GraduationCap, Hotel, House, Landmark, Lock, MapPin, Plane, ShoppingBasket, Smartphone, Store, TrainFront, Trees, Utensils, type LucideIcon } from "lucide-react";

/*
 * « My life in Accra »: the city as a light SVG illustration (sea, roads, districts) with a pin per
 * place. A pin is done (blue tick), current (big, pulsing red ring, links to the episode), open,
 * or locked / not yet in the story (grey). No map tiles: nothing to download.
 */

export const PLACE_ICONS: Record<string, LucideIcon> = { MapPin, Plane, Car, Bus, TrainFront, House, Hotel, Building2, Briefcase, Landmark, Store, ShoppingBasket, Smartphone, Cross, Coffee, Utensils, GraduationCap, Trees };
const ICONS = PLACE_ICONS;

export type MapPin = { id: string; name: string; icon: string; x: number; y: number; state: "done" | "current" | "open" | "locked" | "future"; href: string | null; episodeTitle: string | null };

export function CityMap({ city, pins }: { city: string; pins: MapPin[] }) {
  return (
    <div className="relative aspect-[4/3] w-full overflow-clip rounded-[1.75rem] bg-[#f3efe4] ring-1 ring-ink/10 sm:aspect-[16/9]">
      <svg viewBox="0 0 160 90" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
        <path d="M0 74 C30 70 50 80 80 76 S130 70 160 78 V90 H0z" fill="#bcd6f2" />
        <path d="M0 77 C30 73 50 83 80 79 S130 73 160 81" stroke="#fff" strokeWidth="0.6" fill="none" opacity="0.7" />
        <path d="M18 18c14-4 22 4 30 0s16-6 22 2-6 14-18 12-28 2-34-4 0-10 0-10z" fill="#dfe8cf" />
        <path d="M100 40c10-6 26-4 32 4s-4 14-16 14-22-12-16-18z" fill="#dfe8cf" />
        <g stroke="#fff" strokeLinecap="round" fill="none">
          <path d="M130 14 C110 26 96 34 80 50 S50 66 20 66" strokeWidth="3" />
          <path d="M36 10 C44 30 56 50 58 74" strokeWidth="2.2" />
          <path d="M70 20 C90 30 110 48 120 70" strokeWidth="2.2" />
          <path d="M10 40 H150" strokeWidth="1.4" strokeDasharray="0" />
        </g>
        <g stroke="#e3dccb" strokeLinecap="round" fill="none">
          <path d="M130 14 C110 26 96 34 80 50 S50 66 20 66" strokeWidth="0.5" strokeDasharray="2 2" />
        </g>
      </svg>
      <p className="absolute top-3 left-4 rounded-full bg-white/85 px-3 py-1 font-heading text-sm font-extrabold text-brand-deep">{city}</p>
      <p className="absolute right-4 bottom-2 text-xs font-semibold tracking-wide text-[#5b7fa8] uppercase">Gulf of Guinea</p>
      <ul>
        {pins.map((p) => {
          const Icon = ICONS[p.icon] ?? MapPin;
          const dim = p.state === "locked" || p.state === "future";
          const dot = (
            <span className="flex flex-col items-center gap-1">
              <span className={`relative flex items-center justify-center rounded-full shadow-md ${p.state === "current" ? "size-12 border-[3px] border-coral bg-white text-coral sm:size-14" : p.state === "done" ? "size-10 bg-primary text-white" : dim ? "size-9 bg-white/80 text-ink/35" : "size-10 border-2 border-primary bg-white text-primary"}`}>
                {p.state === "current" ? <span aria-hidden className="absolute -inset-1.5 animate-ping rounded-full border-2 border-coral/60 motion-reduce:hidden" /> : null}
                <Icon className={p.state === "current" ? "size-6" : "size-5"} />
                {p.state === "done" ? (
                  <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-white text-primary ring-1 ring-primary">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                ) : dim ? (
                  <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-white text-ink/40 ring-1 ring-ink/15">
                    <Lock className="size-2.5" />
                  </span>
                ) : null}
              </span>
              <span className={`max-w-28 rounded-full px-2 py-0.5 text-center text-[11px] leading-tight font-bold sm:text-xs ${p.state === "current" ? "bg-white text-coral-dark shadow" : dim ? "bg-white/60 text-ink/45" : "bg-white/90 text-brand-deep"}`}>{p.name}</span>
            </span>
          );
          return (
            <li key={p.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}>
              {p.href ? (
                <Link href={p.href} title={p.episodeTitle ?? p.name} className="block rounded-full focus-visible:outline-3 focus-visible:outline-primary">
                  {dot}
                  <span className="sr-only">{p.episodeTitle ? `Episode: ${p.episodeTitle}` : ""}</span>
                </Link>
              ) : (
                dot
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
