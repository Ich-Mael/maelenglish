import Image from "next/image";
import Link from "next/link";
import { BookOpen, CircleUserRound } from "lucide-react";

const NAV = [
  { href: "/mes-cours", label: "Mes cours", icon: BookOpen },
  { href: "/compte", label: "Mon compte", icon: CircleUserRound },
];

/** Signed-in shell: top bar on desktop, bottom tab bar on phones. XP / streak join it in phase 5. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col pb-16 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
          <Link href="/mes-cours" aria-label="MaelEnglish — mes cours">
            <Image src="/images/maelenglish-logo.webp" alt="MaelEnglish" width={800} height={175} className="h-auto w-32" />
          </Link>
          <nav aria-label="Navigation" className="ml-auto hidden gap-1 md:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-ink/80 hover:bg-brand-soft hover:text-brand-deep">
                <n.icon className="size-4.5" aria-hidden /> {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">{children}</main>
      <nav aria-label="Navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="flex flex-col items-center gap-0.5 py-2 text-xs font-semibold text-ink/75">
            <n.icon className="size-5.5" aria-hidden /> {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
