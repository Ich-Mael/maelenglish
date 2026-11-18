import Link from "next/link";
import { connection } from "next/server";
import { LinkIcon } from "lucide-react";
import { connectDB } from "@/lib/db";
import { userForToken } from "@/lib/auth/service";
import { SetPasswordForm } from "./set-password-form";

/** Server part of /activer/[token] and /reinitialiser/[token]: checks the link before showing the form. */
export async function TokenPage({ params, purpose }: { params: Promise<{ token: string }>; purpose: "activation" | "reset" }) {
  const { token } = await params;
  await connection(); // token validity depends on the current time
  await connectDB();
  const user = await userForToken(token, purpose);

  if (!user) {
    return (
      <div className="grid gap-4 text-center">
        <LinkIcon className="mx-auto size-12 text-coral" aria-hidden />
        <h1 className="text-2xl font-extrabold text-brand-deep">Lien invalide ou expiré</h1>
        <p className="text-muted-foreground">
          {purpose === "activation"
            ? "Ce lien d'activation n'est plus valable. Demandez-en un nouveau à l'équipe MaelEnglish."
            : "Ce lien de réinitialisation n'est plus valable (il expire au bout d'une heure)."}
        </p>
        <Link href={purpose === "activation" ? "/connexion" : "/mot-de-passe-oublie"} className="font-medium text-primary hover:underline">
          {purpose === "activation" ? "Aller à la connexion" : "Demander un nouveau lien"}
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-extrabold text-brand-deep">
        {purpose === "activation" ? `Bienvenue, ${user.name} !` : "Nouveau mot de passe"}
      </h1>
      <p className="mt-1 mb-6 text-muted-foreground">
        {purpose === "activation" ? (
          <>
            Votre identifiant est <strong className="text-foreground">{user.username}</strong>. Choisissez votre mot de
            passe pour activer votre compte.
          </>
        ) : (
          <>Choisissez un nouveau mot de passe pour {user.username}.</>
        )}
      </p>
      <SetPasswordForm token={token} purpose={purpose} />
    </>
  );
}

export function TokenPageFallback() {
  return (
    <div className="grid animate-pulse gap-4" aria-busy>
      <div className="h-7 w-2/3 rounded-lg bg-muted" />
      <div className="h-4 w-full rounded bg-muted" />
      <div className="h-11 rounded-xl bg-muted" />
      <div className="h-11 rounded-xl bg-muted" />
      <div className="h-11 rounded-xl bg-muted" />
    </div>
  );
}
