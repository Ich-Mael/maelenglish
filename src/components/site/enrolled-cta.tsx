import { Suspense } from "react";
import Link from "next/link";
import { PlayCircle } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/dal";
import { myCourseForProgram } from "@/lib/learn/queries";
import { coursePath } from "@/lib/learn/paths";
import { BUTTON } from "./ui";

async function Resolve({ slug, fallback }: { slug: string; fallback: React.ReactNode }) {
  const me = await getCurrentUser();
  const courseId = me ? await myCourseForProgram(me, slug) : null;
  if (!courseId) return <>{fallback}</>;
  return (
    <Link href={coursePath(courseId)} className={BUTTON.coral}>
      <PlayCircle className="size-5" aria-hidden /> Accéder à mon cours
    </Link>
  );
}

/** Programme CTA: « Accéder à mon cours » for an enrolled learner, else the enrol button (also the static fallback). */
export function EnrolledCta({ slug, children }: { slug: string; children: React.ReactNode }) {
  return (
    <Suspense fallback={children}>
      <Resolve slug={slug} fallback={children} />
    </Suspense>
  );
}
