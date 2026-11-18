import Image from "next/image";
import Link from "next/link";

// Minimal signed-in shell — the full learner app shell (nav, XP, streak) comes in phases 4–5.
export default function AccountLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-4">
          <Link href="/" aria-label="MaelEnglish — accueil">
            <Image src="/images/maelenglish-logo.webp" alt="MaelEnglish" width={800} height={175} className="h-auto w-36" />
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
