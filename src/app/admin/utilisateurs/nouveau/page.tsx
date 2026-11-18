import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireStaff, actorOf } from "@/lib/admin/context";
import { can } from "@/lib/admin/permissions";
import { assignableRoles } from "@/lib/auth/accounts";
import { Card, PageHeader } from "@/components/admin/ui";
import { CreateUserForm } from "@/components/admin/user-forms";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Créer un compte" };

async function NewUser() {
  const me = await requireStaff("/admin/utilisateurs/nouveau");
  if (!can.manageUsers(actorOf(me))) redirect("/admin");
  return (
    <div className="max-w-2xl">
      <PageHeader title="Créer un compte" back={{ href: "/admin/utilisateurs", label: "Utilisateurs" }} subtitle="Le compte est créé sans mot de passe : la personne le choisit avec son lien d'activation." />
      <Card>
        <CreateUserForm roles={[...assignableRoles({ _id: me.id as never, role: me.role })]} />
      </Card>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewUser />
    </Suspense>
  );
}
