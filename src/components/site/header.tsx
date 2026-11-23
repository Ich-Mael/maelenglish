import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";
import {
  AccountLink,
  LoggedOut,
  MobileSignup,
  MobileSignupLink,
} from "./account-link";
import { ScrollHeader } from "./scroll-header";

const NAV: { href: string; label: string; badge?: string }[] = [
  { href: "/#programmes", label: "Programmes" },
  { href: "/#methode", label: "Méthode" },
  { href: "/coaching", label: "Coaching" },
];

export function SiteHeader() {
  return (
    <>
      <ScrollHeader>
        <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center gap-4 px-4">
          <Link
            href="/"
            aria-label="MaelEnglish — accueil"
            className="relative shrink-0"
          >
            <Image
              src="/images/maelenglish-logo.webp"
              alt="MaelEnglish"
              width={800}
              height={175}
              priority
              className="h-auto w-36 transition-opacity duration-300 group-data-[scrolled=true]/hdr:opacity-0 sm:w-40"
            />
            {/* Light version for the navy (scrolled) header. */}
            <Image
              src="/images/maelenglish-mark-light.webp"
              alt=""
              width={800}
              height={175}
              className="absolute inset-0 h-auto w-36 opacity-0 transition-opacity duration-300 group-data-[scrolled=true]/hdr:opacity-100 sm:w-40"
            />
          </Link>

          {/* Links in a soft blue capsule (white on the navy scrolled bar). */}
          <nav
            aria-label="Navigation principale"
            className="ml-4 hidden items-center gap-0.5 rounded-full border border-primary/10 bg-brand-soft/70 p-1 transition-colors lg:flex group-data-[scrolled=true]/hdr:border-white/10 group-data-[scrolled=true]/hdr:bg-white/10"
          >
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold text-brand-deep/80 transition hover:bg-white hover:text-primary hover:shadow-sm group-data-[scrolled=true]/hdr:text-white/85 group-data-[scrolled=true]/hdr:hover:bg-white/15 group-data-[scrolled=true]/hdr:hover:text-white"
              >
                {n.label}
                {n.badge && (
                  <span className="rounded-full border border-coral bg-white px-1.5 py-px text-[10px] font-extrabold tracking-wide text-coral-dark uppercase">
                    {n.badge}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <Suspense fallback={<LoggedOut />}>
              <AccountLink />
            </Suspense>
            {/* Mobile menu: <details> works without JavaScript. */}
            <details className="group relative lg:hidden">
              <summary
                className="flex size-10 cursor-pointer list-none items-center justify-center rounded-xl text-brand-deep hover:bg-brand-soft group-data-[scrolled=true]/hdr:text-white group-data-[scrolled=true]/hdr:hover:bg-white/10 [&::-webkit-details-marker]:hidden"
                aria-label="Menu"
              >
                <Menu className="size-5" aria-hidden />
              </summary>
              <nav
                aria-label="Navigation mobile"
                className="absolute right-0 mt-2 grid w-56 gap-1 rounded-2xl border border-border bg-card p-2 shadow-xl"
              >
                {NAV.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 font-medium hover:bg-brand-soft"
                  >
                    {n.label}
                    {n.badge && (
                      <span className="rounded-full border border-coral bg-white px-1.5 py-px text-[10px] font-extrabold tracking-wide text-coral-dark uppercase">
                        {n.badge}
                      </span>
                    )}
                  </Link>
                ))}
                <Suspense fallback={<MobileSignupLink />}>
                  <MobileSignup />
                </Suspense>
              </nav>
            </details>
          </div>
        </div>
      </ScrollHeader>
    </>
  );
}
