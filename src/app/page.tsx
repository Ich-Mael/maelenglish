import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Temporary home page — the real storefront is built in phase 3.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16 text-center">
      <Image
        src="/images/maelenglish-logo-slogan.webp"
        alt="MaelEnglish — Speak the Language of Your Profession"
        width={360}
        height={180}
        priority
        className="h-auto w-72 sm:w-90"
      />
      <h1 className="max-w-xl text-3xl font-extrabold text-brand-deep sm:text-4xl">
        La nouvelle plateforme MaelEnglish arrive bientôt.
      </h1>
      <div className="flex flex-wrap justify-center gap-3">
        <Button size="lg">Découvrir les programmes</Button>
        <Button size="lg" variant="outline" className="border-coral text-coral-dark" render={<Link href="/connexion" />}>
          Me connecter
        </Button>
      </div>
    </main>
  );
}
