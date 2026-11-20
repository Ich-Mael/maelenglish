import type { Metadata } from "next";
import { Suspense } from "react";
import { requireStaff } from "@/lib/admin/context";
import { Card, PageHeader } from "@/components/admin/ui";
import { PageSkeleton } from "@/components/learn/ui";
import { MicTest } from "./mic-test";

export const metadata: Metadata = { title: "Tester le micro" };

async function MicPage() {
  await requireStaff("/admin/micro");
  return (
    <div className="max-w-2xl">
      <PageHeader title="Tester le micro" subtitle="Vérifiez votre micro avant d’enregistrer un retour vocal ou un audio de cours. Rien n’est envoyé, sauf si vous testez l’envoi." />
      <Card>
        <MicTest />
      </Card>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MicPage />
    </Suspense>
  );
}
