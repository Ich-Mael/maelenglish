import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireStaff, actorOf } from "@/lib/admin/context";
import { can } from "@/lib/admin/permissions";
import { assignableRoles } from "@/lib/auth/accounts";
import { Card, PageHeader } from "@/components/admin/ui";
import { CreateUserForm } from "@/components/admin/user-forms";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Create an account" };

async function NewUser({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireStaff("/admin/utilisateurs/nouveau");
  if (!can.manageUsers(actorOf(me))) redirect("/admin");
  const sp = await searchParams;
  const pick = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const defaults = { name: pick("prenom"), surname: pick("nom"), email: pick("email"), phoneNumber: pick("tel") };
  return (
    <div className="max-w-2xl">
      <PageHeader title="Create an account" back={{ href: "/admin/utilisateurs", label: "Users" }} subtitle="The account is created without a password: the person chooses it with their activation link." />
      <Card>
        <CreateUserForm roles={[...assignableRoles({ _id: me.id as never, role: me.role })]} defaults={defaults} />
      </Card>
    </div>
  );
}

export default function Page({ searchParams }: PageProps<"/admin/utilisateurs/nouveau">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewUser searchParams={searchParams} />
    </Suspense>
  );
}
