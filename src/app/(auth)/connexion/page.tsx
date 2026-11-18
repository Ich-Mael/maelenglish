import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { whatsappLink } from "@/lib/catalog";

export const metadata: Metadata = { title: "Connexion", robots: { index: false } };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-2xl font-extrabold text-brand-deep">Bon retour !</h1>
      <p className="mt-1 mb-6 text-muted-foreground">Connectez-vous pour continuer votre apprentissage.</p>
      <LoginForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Pas encore de compte ? Les comptes sont créés à l&apos;inscription.{" "}
        <a href={whatsappLink()} className="font-medium text-coral-dark hover:underline" target="_blank" rel="noopener">
          Nous écrire sur WhatsApp
        </a>
      </p>
    </>
  );
}
