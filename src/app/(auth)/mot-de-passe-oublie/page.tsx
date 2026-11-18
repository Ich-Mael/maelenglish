import type { Metadata } from "next";
import { ForgotForm } from "./forgot-form";
import { WHATSAPP_NUMBER } from "@/lib/catalog";

export const metadata: Metadata = { title: "Mot de passe oublié", robots: { index: false } };

const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "Bonjour, j'ai oublié mon mot de passe MaelEnglish. Mon identifiant est : ",
)}`;

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-extrabold text-brand-deep">Mot de passe oublié</h1>
      <p className="mt-1 mb-6 text-muted-foreground">Nous vous envoyons un lien pour en choisir un nouveau.</p>
      <ForgotForm whatsappHref={whatsappHref} />
    </>
  );
}
