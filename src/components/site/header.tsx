import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";
import { whatsappLink } from "@/lib/catalog";
import { AccountLink, LoginLink } from "./account-link";
import { WhatsAppIcon } from "./icons";

const NAV = [
  { href: "/#programmes", label: "Programmes" },
  { href: "/#methode", label: "Méthode" },
  { href: "/coaching", label: "Coaching" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/[0.97]">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href="/" aria-label="MaelEnglish — accueil" className="shrink-0">
          <Image src="/images/maelenglish-logo.webp" alt="MaelEnglish" width={800} height={175} priority className="h-auto w-36 sm:w-40" />
        </Link>

        <nav aria-label="Navigation principale" className="ml-4 hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-xl px-3 py-2 text-sm font-medium text-ink/80 transition-colors hover:bg-brand-soft hover:text-brand-deep">
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <Suspense fallback={<LoginLink />}>
            <AccountLink />
          </Suspense>
          <a
            href={whatsappLink()}
            target="_blank"
            rel="noopener"
            className="hidden h-10 items-center gap-2 rounded-xl bg-coral-strong px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-coral-dark sm:inline-flex"
          >
            <WhatsAppIcon className="size-4" /> S&apos;inscrire
          </a>
          {/* Mobile menu: <details> works without JavaScript. */}
          <details className="group relative md:hidden">
            <summary className="flex size-10 cursor-pointer list-none items-center justify-center rounded-xl text-brand-deep hover:bg-brand-soft [&::-webkit-details-marker]:hidden" aria-label="Menu">
              <Menu className="size-5" aria-hidden />
            </summary>
            <nav aria-label="Navigation mobile" className="absolute right-0 mt-2 grid w-56 gap-1 rounded-2xl border border-border bg-card p-2 shadow-xl">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="rounded-xl px-3 py-2.5 font-medium hover:bg-brand-soft">
                  {n.label}
                </Link>
              ))}
              <a href={whatsappLink()} target="_blank" rel="noopener" className="mt-1 flex items-center gap-2 rounded-xl bg-coral-strong px-3 py-2.5 font-semibold text-white">
                <WhatsAppIcon className="size-4" /> S&apos;inscrire
              </a>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
