import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute -top-40 -right-32 size-96 bg-[radial-gradient(closest-side,var(--color-coral-soft),transparent)]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-32 size-96 bg-[radial-gradient(closest-side,var(--color-brand-soft),transparent)]" />
      <div className="relative w-full max-w-md">
        <Link href="/" className="mx-auto mb-6 block w-fit" aria-label="MaelEnglish — accueil">
          <Image src="/images/maelenglish-logo.webp" alt="MaelEnglish" width={800} height={175} priority className="h-auto w-48" />
        </Link>
        <div className="rounded-3xl border border-border bg-card p-6 shadow-[0_18px_50px_-20px_rgb(54_79_171/0.35)] sm:p-8">
          {children}
        </div>
      </div>
    </main>
  );
}
