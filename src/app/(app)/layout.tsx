import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, CircleUserRound, Trophy } from "lucide-react";
import { StatsBar, StatsBarFallback } from "@/components/gamify/stats-bar";
import { SoundToggle } from "@/components/gamify/sound-toggle";
import { RewardCenter } from "@/components/gamify/reward-center";
import { OfflineSync } from "@/components/pwa/pwa-client";
import { LogoutButton } from "@/components/pwa/logout-button";

const NAV = [
  { href: "/mes-cours", label: "Mes cours", icon: BookOpen },
  { href: "/progression", label: "Progression", icon: Trophy },
  { href: "/compte", label: "Compte", icon: CircleUserRound },
];

/** Signed-in shell: top bar (stats) + bottom tab bar on phones; celebrations live here so they survive navigation. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col pb-16 md:pb-0">
      <a href="#contenu-app" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-xl focus:bg-card focus:px-4 focus:py-2 focus:shadow-lg">
        Aller au contenu
      </a>
      <header className="sticky top-0 z-30 border-b border-border bg-card/[0.97]">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
          <Link href="/" aria-label="MaelEnglish — accueil" className="shrink-0">
            <Image src="/images/maelenglish-logo.webp" alt="MaelEnglish" width={800} height={175} className="h-auto w-28 sm:w-32" />
          </Link>
          <nav aria-label="Navigation" className="hidden gap-1 md:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-ink/80 hover:bg-brand-soft hover:text-brand-deep">
                <n.icon className="size-4.5" aria-hidden /> {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <Suspense fallback={<StatsBarFallback />}>
              <StatsBar />
            </Suspense>
            <SoundToggle />
            <LogoutButton variant="compact" />
          </div>
        </div>
      </header>
      <OfflineSync />
      <main id="contenu-app" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">{children}</main>
      <nav aria-label="Navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="flex flex-col items-center gap-0.5 py-2 text-xs font-semibold text-ink/75">
            <n.icon className="size-5.5" aria-hidden /> {n.label}
          </Link>
        ))}
      </nav>
      <RewardCenter />
    </div>
  );
}
