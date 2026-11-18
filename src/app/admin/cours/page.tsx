import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Plus } from "lucide-react";
import { requireStaff, actorOf, visibleCourseIds } from "@/lib/admin/context";
import { can } from "@/lib/admin/permissions";
import { findProgram } from "@/lib/catalog";
import { AssignmentSubmission, Course, Enrollment, Module, type CourseDoc } from "@/models";
import { EmptyState, PageHeader, Pill, btn } from "@/components/admin/ui";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Cours" };

async function Courses() {
  await connection();
  const me = await requireStaff("/admin/cours");
  const ids = await visibleCourseIds(me);
  const courses = await Course.find(ids ? { _id: { $in: ids } } : {}).sort({ createdAt: -1 }).lean<CourseDoc[]>();
  const cid = courses.map((c) => c._id);
  const count = async (M: typeof Module | typeof Enrollment | typeof AssignmentSubmission, extra = {}) =>
    new Map((await (M as typeof Module).aggregate<{ _id: unknown; n: number }>([{ $match: { courseId: { $in: cid }, ...extra } }, { $group: { _id: "$courseId", n: { $sum: 1 } } }])).map((r) => [String(r._id), r.n]));
  const [mods, enr, pend] = await Promise.all([count(Module), count(Enrollment, { status: "active" }), count(AssignmentSubmission, { status: "pending" })]);

  return (
    <>
      <PageHeader
        title={ids ? "Mes cours" : "Cours"}
        subtitle={ids ? "Les cours dont vous faites partie de l'équipe pédagogique." : `${courses.length} cours`}
        actions={
          can.createCourse(actorOf(me)) ? (
            <Link href="/admin/cours/nouveau" className={btn.primary}>
              <Plus className="size-4" aria-hidden /> Nouveau cours
            </Link>
          ) : undefined
        }
      />
      {courses.length === 0 ? (
        <EmptyState>{ids ? "Vous n'êtes rattaché(e) à aucun cours pour l'instant." : "Aucun cours. Créez le premier !"}</EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {courses.map((c) => {
            const id = String(c._id);
            return (
              <li key={id}>
                <Link href={`/admin/cours/${id}`} className="block rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex flex-wrap items-center gap-2">
                    {c.isPublished ? <Pill tone="green">Publié</Pill> : <Pill tone="amber">Brouillon</Pill>}
                    {c.isChallenge && <Pill tone="red">Challenge</Pill>}
                    {(pend.get(id) ?? 0) > 0 && <Pill tone="blue">{pend.get(id)} à corriger</Pill>}
                  </div>
                  <h2 className="mt-2 text-lg font-bold text-brand-deep">{c.title}</h2>
                  <p className="text-sm text-muted-foreground">{findProgram(c.program)?.name ?? "Sans programme"}</p>
                  <p className="mt-3 text-sm text-ink/80">
                    {mods.get(id) ?? 0} module(s) · {enr.get(id) ?? 0} inscrit(s) actif(s)
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Courses />
    </Suspense>
  );
}
