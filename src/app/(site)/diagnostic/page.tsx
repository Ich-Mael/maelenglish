import type { Metadata } from "next";
import { HeartHandshake, ListChecks, Sparkles } from "lucide-react";
import { Container, Pill } from "@/components/site/ui";
import { FounderCard } from "@/components/site/founder";
import { fr } from "@/lib/diagnostic/questions";
import { DiagnosticApp } from "./diagnostic-app";

export const metadata: Metadata = {
  title: "Diagnostic gratuit : qu'est-ce qui freine votre anglais ?",
  description: "En 8 minutes, découvrez ce qui freine vraiment votre anglais professionnel et recevez un rapport personnalisé avec la méthode adaptée à votre profil.",
  alternates: { canonical: "/diagnostic" },
};

const PROMISES = [
  { icon: ListChecks, title: "6 courtes parties", text: "Votre parcours scolaire, vos essais, ce que vous ressentez, votre travail, vos objectifs." },
  { icon: Sparkles, title: "Un rapport personnalisé", text: "Votre profil d'apprenant, ce qui vous freine vraiment, vos atouts et la méthode adaptée." },
  { icon: HeartHandshake, title: "Sans jugement", text: "Le problème vient le plus souvent de la méthode, pas de vous. On commence par comprendre." },
];

/** Learning-path diagnostic (owner spec DIAGNOSTIC_SPEC.md, 2026-11-23): public, no account. */
export default function DiagnosticPage() {
  return (
    <section className="bg-[#F0F4FB] py-10 sm:py-16">
      <Container className="grid items-start gap-10 lg:grid-cols-[1fr_0.55fr]">
        <div className="grid gap-6">
          <div className="grid gap-3">
            <Pill>Diagnostic gratuit · 8 minutes</Pill>
            <h1 className="font-heading text-4xl leading-[1.05] font-extrabold text-brand-deep sm:text-5xl">{fr("Qu'est-ce qui freine")} <span className="text-coral">votre anglais</span> ?</h1>
            <p className="max-w-2xl text-lg text-ink/75">{fr("Répondez à quelques questions sur votre parcours : Coach Ish vous explique ce qui vous bloque vraiment, et comment avancer.")}</p>
          </div>
          <DiagnosticApp />
        </div>
        <aside className="no-print grid gap-4 lg:sticky lg:top-24">
          {PROMISES.map((p, i) => (
            <div key={p.title} className="flex gap-4 rounded-3xl border border-[#E3E7F0] bg-white p-5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-coral bg-white font-heading font-extrabold text-coral shadow-[0_4px_0_0_var(--color-coral)]">{i + 1}</span>
              <div>
                <p className="flex items-center gap-2 font-bold text-brand-deep">
                  <p.icon className="size-4 text-primary" aria-hidden /> {p.title}
                </p>
                <p className="text-sm text-muted-foreground">{fr(p.text)}</p>
              </div>
            </div>
          ))}
          <FounderCard className="w-fit" />
        </aside>
      </Container>
    </section>
  );
}
