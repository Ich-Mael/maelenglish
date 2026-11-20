import Link from "next/link";
import { Eye, LayoutDashboard, Pencil } from "lucide-react";

/** Admin links for the page staff are previewing (learner pages, staff preview mode). */
export const adminPaths = {
  course: (courseId: string) => `/admin/cours/${courseId}`,
  lesson: (courseId: string, lessonId: string) => `/admin/cours/${courseId}/lecons/${lessonId}`,
  module: (courseId: string, moduleId: string) => `/admin/cours/${courseId}/modules/${moduleId}`,
  unit: (courseId: string, unitId: string) => `/admin/cours/${courseId}/unites/${unitId}`,
  finals: (courseId: string) => `/admin/cours/${courseId}/final`,
};

/**
 * Banner shown to staff previewing a course as a learner: what preview means, plus a way back to
 * the matching admin page (« Modifier ») and to the dashboard.
 */
export function PreviewBar({ text, editHref, className }: { text: string; editHref: string; className?: string }) {
  const link = "inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-sm font-bold text-primary ring-1 ring-primary/20 hover:bg-primary hover:text-white";
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-brand-soft px-4 py-2.5 ${className ?? ""}`}>
      <p className="flex basis-full items-center gap-2 text-sm font-semibold text-primary sm:basis-auto sm:flex-1">
        <Eye className="size-4 shrink-0" aria-hidden /> {text}
      </p>
      <div className="flex gap-2">
        <Link href={editHref} className={link}>
          <Pencil className="size-4" aria-hidden /> Modifier
        </Link>
        <Link href="/admin" className={link}>
          <LayoutDashboard className="size-4" aria-hidden /> Admin
        </Link>
      </div>
    </div>
  );
}
