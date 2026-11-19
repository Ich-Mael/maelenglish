import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireStaff, actorOf } from "@/lib/admin/context";
import { can } from "@/lib/admin/permissions";
import { Card, PageHeader } from "@/components/admin/ui";
import { AdminForm, Submit } from "@/components/admin/forms";
import { CourseFields } from "@/components/admin/course-fields";
import { createCourseAction } from "../../actions";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Nouveau cours" };

async function NewCourse() {
  const me = await requireStaff("/admin/cours/nouveau");
  if (!can.createCourse(actorOf(me))) redirect("/admin/cours");
  return (
    <div className="max-w-6xl">
      <PageHeader title="Nouveau cours" back={{ href: "/admin/cours", label: "Cours" }} subtitle="Le cours est créé en brouillon : publiez-le quand le contenu est prêt." />
      <Card>
        <AdminForm action={createCourseAction}>
          <CourseFields settings wide />
          <div>
            <Submit>Créer le cours</Submit>
          </div>
        </AdminForm>
      </Card>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewCourse />
    </Suspense>
  );
}
