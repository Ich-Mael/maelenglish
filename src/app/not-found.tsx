import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-20 text-center">
      <Image src="/images/maelenglish-logo.webp" alt="MaelEnglish" width={800} height={175} className="h-auto w-44" />
      <p lang="en" className="font-heading text-6xl font-extrabold text-coral-strong">Oops!</p>
      <h1 className="text-2xl font-extrabold text-brand-deep">Cette page n&apos;existe pas</h1>
      <p className="max-w-md text-muted-foreground">Le lien est peut-être ancien ou mal recopié. Repartez de l&apos;accueil pour trouver votre programme.</p>
      <Link href="/" className="inline-flex h-12 items-center rounded-2xl bg-primary px-6 font-semibold text-white">
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
