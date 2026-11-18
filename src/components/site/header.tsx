import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, UserPlus } from "lucide-react";
import { AccountLink, LoginLink } from "./account-link";
import { ScrollHeader } from "./scroll-header";

const NAV = [
  { href: "/#programmes", label: "Programmes" },
  { href: "/#methode", label: "Méthode" },
  { href: "/coaching", label: "Coaching" },
];

export function SiteHeader() {
  return (
    <ScrollHeader>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href="/" aria-label="MaelEnglish — accueil" className="relative shrink-0">
          <Image src="/images/maelenglish-logo.webp" alt="MaelEnglish" width={800} height={175} priority className="h-auto w-36 transition-opacity duration-300 group-data-[scrolled=true]/hdr:opacity-0 sm:w-40" />
          {/* Light version for the navy (scrolled) header. */}
          <Image src="/images/maelenglish-mark-light.webp" alt="" width={800} height={175} className="absolute inset-0 h-auto w-36 opacity-0 transition-opacity duration-300 group-data-[scrolled=true]/hdr:opacity-100 sm:w-40" />
        </Link>

        <nav aria-label="Navigation principale" className="ml-4 hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-xl px-3 py-2 text-sm font-medium text-ink/80 transition-colors hover:bg-brand-soft hover:text-brand-deep group-data-[scrolled=true]/hdr:text-white/85 group-data-[scrolled=true]/hdr:hover:bg-white/10 group-data-[scrolled=true]/hdr:hover:text-white">
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <Suspense fallback={<LoginLink />}>
            <AccountLink />
          </Suspense>
          <Link
            href="/inscription"
            className="hidden h-10 items-center gap-2 rounded-xl border-2 border-coral bg-white px-4 text-sm font-bold text-coral-dark transition hover:bg-coral-soft sm:inline-flex"
          >
            <UserPlus className="size-4" aria-hidden /> S&apos;inscrire
          </Link>
          {/* Mobile menu: <details> works without JavaScript. */}
          <details className="group relative md:hidden">
            <summary className="flex size-10 cursor-pointer list-none items-center justify-center rounded-xl text-brand-deep hover:bg-brand-soft group-data-[scrolled=true]/hdr:text-white group-data-[scrolled=true]/hdr:hover:bg-white/10 [&::-webkit-details-marker]:hidden" aria-label="Menu">
              <Menu className="size-5" aria-hidden />
            </summary>
            <nav aria-label="Navigation mobile" className="absolute right-0 mt-2 grid w-56 gap-1 rounded-2xl border border-border bg-card p-2 shadow-xl">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="rounded-xl px-3 py-2.5 font-medium hover:bg-brand-soft">
                  {n.label}
                </Link>
              ))}
              <Link href="/inscription" className="mt-1 flex items-center gap-2 rounded-xl border-2 border-coral bg-white px-3 py-2.5 font-bold text-coral-dark hover:bg-coral-soft">
                <UserPlus className="size-4" aria-hidden /> S&apos;inscrire
              </Link>
            </nav>
          </details>
        </div>
      </div>
    </ScrollHeader>
  );
}
