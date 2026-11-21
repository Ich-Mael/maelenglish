import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminNav } from "@/components/admin/nav";
import { LogoutButton } from "@/components/pwa/logout-button";
import { UserChip } from "@/components/account/user-chip";

export const metadata: Metadata = { title: { template: "%s · Admin MaelEnglish", default: "Admin" }, robots: { index: false } };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    // Staff UI is in English (user decision 2026-11-20); learner-facing content stays French.
    <div lang="en" className="flex flex-1 flex-col bg-muted/30 lg:flex-row">
      <aside className="border-b border-border bg-card lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="flex items-center gap-3 px-4 py-3 lg:block lg:px-5 lg:py-5">
          <Link href="/admin" aria-label="MaelEnglish administration" className="block shrink-0">
            <Image src="/images/maelenglish-logo.webp" alt="MaelEnglish" width={800} height={175} className="h-auto w-28 lg:w-36" />
          </Link>
          <span className="rounded-full bg-coral-soft px-2 py-0.5 text-xs font-bold text-coral-dark lg:mt-2 lg:inline-block">Admin</span>
          <Suspense>
            <UserChip label="My account" className="ml-auto max-w-40 lg:mt-3 lg:ml-0 lg:flex lg:max-w-full" />
          </Suspense>
          <LogoutButton variant="compact" className="lg:hidden" label="Sign out" />
        </div>
        <div className="hidden px-3 lg:block">
          <Suspense>
            <AdminNav />
          </Suspense>
          <Link href="/mes-cours" className="mt-6 flex items-center gap-2 px-3 text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft className="size-4" aria-hidden /> Learner area
          </Link>
          <LogoutButton variant="nav" className="mt-3" label="Sign out" />
        </div>
        <div className="px-2 pb-2 lg:hidden">
          <Suspense>
            <AdminNav mobile />
          </Suspense>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
    </div>
  );
}
