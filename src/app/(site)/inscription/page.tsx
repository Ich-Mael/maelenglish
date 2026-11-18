import type { Metadata } from "next";
import { Suspense } from "react";
import { BadgeCheck, CalendarCheck, Laptop, MessageCircle, UserCheck } from "lucide-react";
import { PROGRAM_SLUGS, findProgram, whatsappLink } from "@/lib/catalog";
import { FOUNDER } from "@/lib/content";
import { Container, Pill } from "@/components/site/ui";
import { FounderCard } from "@/components/site/founder";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "S'inscrire",
  description: "Demande d'inscription à un programme MaelEnglish : laissez vos coordonnées, Coach Ish vous recontacte sur WhatsApp.",
  alternates: { canonical: "/inscription" },
};

const STEPS = [
  { icon: MessageCircle, title: "Nous vous contactons", text: "Sur WhatsApp, sous 24 à 48 h, pour comprendre votre métier et vos objectifs." },
  { icon: UserCheck, title: "Test de niveau", text: "Un court test pour vous placer dans le bon programme et le bon niveau." },
  { icon: CalendarCheck, title: "Vous démarrez", text: "Votre compte est créé : vous recevez votre lien d'accès et commencez vos leçons." },
];

async function FormWithDefaults({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const raw = typeof sp.programme === "string" ? sp.programme : "";
  const program = PROGRAM_SLUGS.includes(raw) || raw === "coaching" || raw === "challenge" ? raw : "";
  const notify = sp.type === "prevenir" || findProgram(program)?.status === "soon";
  return (
    <>
      <h1 className="text-3xl font-extrabold text-primary sm:text-4xl">{notify ? "Être prévenu(e)" : "Demande d'inscription"}</h1>
      <p className="mt-2 mb-7 text-muted-foreground">
        {notify ? "Laissez vos coordonnées : nous vous prévenons dès l'ouverture." : "2 minutes pour nous dire qui vous êtes : nous vous recontactons pour finaliser votre inscription."}
      </p>
      <SignupForm program={program} kind={notify ? "notify" : "enroll"} />
    </>
  );
}

export default function SignupPage({ searchParams }: PageProps<"/inscription">) {
  return (
    <section className="relative overflow-clip bg-brand-soft/50 py-10 sm:py-16">
      <Container className="grid items-start gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <aside className="order-2 lg:sticky lg:top-24 lg:order-1">
          <Pill>Comment ça se passe</Pill>
          <ol className="mt-5 grid gap-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border-2 border-primary bg-white text-primary">
                  <s.icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="font-bold text-brand-deep">
                    {i + 1}. {s.title}
                  </p>
                  <p className="text-sm text-muted-foreground">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <ul className="mt-7 grid gap-2 text-sm font-semibold text-ink/80">
            <li className="flex items-center gap-2"><Laptop className="size-4 text-primary" aria-hidden /> 100 % en ligne, sur téléphone ou ordinateur</li>
            <li className="flex items-center gap-2"><BadgeCheck className="size-4 text-primary" aria-hidden /> Avec {FOUNDER.nickname}, coach certifié TEFL</li>
          </ul>
          <FounderCard className="mt-7 w-fit" />
          <p className="mt-6 text-sm text-muted-foreground">
            Une question avant de vous inscrire ?{" "}
            <a href={whatsappLink()} target="_blank" rel="noopener" className="font-semibold text-primary underline">
              Écrivez-nous sur WhatsApp
            </a>
          </p>
        </aside>

        <div className="order-1 rounded-[2rem] border border-border bg-card p-6 shadow-[0_24px_60px_-30px_rgb(54_79_171/0.4)] sm:p-9 lg:order-2">
          <Suspense fallback={<div className="h-[640px] animate-pulse rounded-2xl bg-muted" aria-busy />}>
            <FormWithDefaults searchParams={searchParams} />
          </Suspense>
        </div>
      </Container>
    </section>
  );
}
