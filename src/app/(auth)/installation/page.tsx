import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { connectDB } from "@/lib/db";
import { adminExists } from "@/lib/auth/accounts";
import { TokenPageFallback } from "@/components/auth/token-page";
import { AdminForm } from "./admin-form";

export const metadata: Metadata = { title: "Installation", robots: { index: false } };

/** Open only while the database has no admin: creates the first administrator account. */
async function Installation() {
  await connection();
  await connectDB();
  if (await adminExists()) redirect("/connexion");
  return (
    <>
      <h1 className="text-2xl font-extrabold text-brand-deep">Premier administrateur</h1>
      <p className="mt-1 mb-6 text-muted-foreground">
        Aucun administrateur n&apos;existe encore. Ce formulaire disparaît dès que le compte est créé.
      </p>
      <AdminForm />
    </>
  );
}

export default function InstallationPage() {
  return (
    <Suspense fallback={<TokenPageFallback />}>
      <Installation />
    </Suspense>
  );
}
