import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, LayoutGrid, MessagesSquare } from "lucide-react";
import { StatsBar, StatsBarFallback } from "@/components/gamify/stats-bar";
import { SoundToggle } from "@/components/gamify/sound-toggle";
import { RewardCenter } from "@/components/gamify/reward-center";
import { OfflineSync } from "@/components/pwa/pwa-client";
import { LogoutButton } from "@/components/pwa/logout-button";
import { UserChip } from "@/components/account/user-chip";
import { ScrollHeader } from "@/components/site/scroll-header";
import { WordLookup } from "@/components/learn/word-lookup";

/* Three links only (owner decision 2026-11-22): the rest — challenges, progress, notebook, dictionary, account — is on « My Learning Space ». */
const NAV = [
  { href: "/mes-cours", label: "My Courses", short: "Courses", icon: BookOpen },
  { href: "/partenaire", label: "Speaking Partner", short: "Partner", icon: MessagesSquare },
  { href: "/mon-espace", label: "My Learning Space", short: "My Space", icon: LayoutGrid },
];

/** Signed-in shell: top bar (stats) + bottom tab bar on phones; celebrations live here so they survive navigation. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    // English UI (owner decision 2026-11-22); French content inside is marked lang="fr".
    <div lang="en" className="flex flex-1 flex-col pb-16 md:pb-0">
      <a href="#contenu-app" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-xl focus:bg-card focus:px-4 focus:py-2 focus:shadow-lg">
        Skip to content
      </a>
      {/* Turns navy once the page is scrolled (same as the public site header). */}
      <ScrollHeader>
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:gap-4 sm:px-4">
          <Link href="/" aria-label="MaelEnglish — home" className="relative shrink-0">
            <Image src="/images/maelenglish-logo.webp" alt="MaelEnglish" width={800} height={175} className="h-auto w-24 transition-opacity duration-300 group-data-[scrolled=true]/hdr:opacity-0 sm:w-32" />
            {/* Light wordmark on the navy (scrolled) bar. */}
            <Image src="/images/maelenglish-mark-light.webp" alt="" width={800} height={175} className="absolute inset-0 h-auto w-24 opacity-0 transition-opacity duration-300 group-data-[scrolled=true]/hdr:opacity-100 sm:w-32" />
          </Link>
          <nav aria-label="Navigation" className="hidden gap-1 md:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} title={n.label} className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-semibold whitespace-nowrap lg:px-3 text-ink/80 transition-colors hover:bg-brand-soft hover:text-brand-deep group-data-[scrolled=true]/hdr:text-white/85 group-data-[scrolled=true]/hdr:hover:bg-white/10 group-data-[scrolled=true]/hdr:hover:text-white">
                <n.icon className="size-4.5" aria-hidden />
                {/* Short labels on small desktops, full labels from lg. */}
                <span className="lg:hidden">{n.short}</span>
                <span className="hidden lg:inline">{n.label}</span>
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex min-w-0 items-center gap-1">
            <Suspense fallback={<StatsBarFallback />}>
              <StatsBar />
            </Suspense>
            <SoundToggle />
            <Suspense>
              <UserChip className="max-w-28 transition-colors sm:max-w-44 md:shrink-0 group-data-[scrolled=true]/hdr:text-white group-data-[scrolled=true]/hdr:hover:bg-white/10" />
            </Suspense>
            {/* Phones: sign out from « Account » (bottom tab bar), so the username always fits. */}
            <LogoutButton variant="compact" className="hidden md:inline-flex" />
          </div>
        </div>
      </ScrollHeader>
      <OfflineSync />
      <main id="contenu-app" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">{children}</main>
      <nav aria-label="Navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="flex min-w-0 flex-col items-center gap-0.5 py-2 text-xs font-semibold text-ink/75">
            <n.icon className="size-5.5" aria-hidden /> {n.short}
          </Link>
        ))}
      </nav>
      <RewardCenter />
      {/* « Tap a word »: long-press / double-click an English word → its dictionary card. */}
      <WordLookup />
    </div>
  );
}
