import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { BookOpen, CalendarDays, ClipboardCheck, Eye, Layers, ListChecks, Plus, Search, Users, Zap, type LucideIcon } from "lucide-react";
import { requireStaff, actorOf, visibleCourseIds } from "@/lib/admin/context";
import { can } from "@/lib/admin/permissions";
import { findProgram } from "@/lib/catalog";
import { ChallengeSubmission, Course, Enrollment, Module, Unit, User, type CourseDoc } from "@/models";
import { formatFcfa, fmtDate, EmptyState, PageHeader, btn } from "@/components/admin/ui";
import { Photo } from "@/components/site/photo";
import { ICONS } from "@/components/site/icons";
import { PageSkeleton } from "@/components/learn/ui";
import { cn } from "cn";

export const metadata: Metadata = { title: "Courses" };

const LEVEL: Record<string, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };
const FILTERS = [
  { id: "all", label: "All" },
  { id: "published", label: "Published" },
  { id: "draft", label: "Drafts" },
  { id: "challenge", label: "Challenge" },
] as const;
type Filter = (typeof FILTERS)[number]["id"];

const matches = (c: CourseDoc, f: Filter) => (f === "published" ? c.isPublished : f === "draft" ? !c.isPublished : f === "challenge" ? c.isChallenge : true);

async function Courses({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const me = await requireStaff("/admin/cours");
  const sp = await searchParams;
  const filter: Filter = FILTERS.some((f) => f.id === sp.filtre) ? (sp.filtre as Filter) : "all";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const ids = await visibleCourseIds(me);
  const courses = await Course.find(ids ? { _id: { $in: ids } } : {}).sort({ createdAt: -1 }).lean<CourseDoc[]>();
  const cid = courses.map((c) => c._id);
  const count = async (M: typeof Module | typeof Unit | typeof Enrollment | typeof ChallengeSubmission, extra = {}) =>
    new Map((await (M as typeof Module).aggregate<{ _id: unknown; n: number }>([{ $match: { courseId: { $in: cid }, ...extra } }, { $group: { _id: "$courseId", n: { $sum: 1 } } }])).map((r) => [String(r._id), r.n]));
  const staffIds = [...new Set(courses.flatMap((c) => (c.instructors ?? []).map(String)))];
  const [mods, units, enr, pend, staff] = await Promise.all([
    count(Module),
    count(Unit),
    count(Enrollment, { status: "active" }),
    count(ChallengeSubmission, { status: "pending" }),
    staffIds.length ? User.find({ _id: { $in: staffIds } }).select("name surname").lean() : [],
  ]);
  const staffName = new Map(staff.map((s) => [String(s._id), `${s.name ?? ""} ${s.surname ?? ""}`.trim()]));

  const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
  const needle = q.toLowerCase();
  const shown = courses.filter((c) => matches(c, filter) && (!needle || c.title.toLowerCase().includes(needle) || (findProgram(c.program)?.name ?? "").toLowerCase().includes(needle)));
  const href = (f: Filter) => {
    const p = new URLSearchParams();
    if (f !== "all") p.set("filtre", f);
    if (q) p.set("q", q);
    const s = p.toString();
    return s ? `/admin/cours?${s}` : "/admin/cours";
  };

  return (
    <>
      <PageHeader
        title={ids ? "My courses" : "Courses"}
        subtitle={ids ? "The courses whose teaching team you belong to." : "Build programmes, enrol learners and follow their work."}
        actions={
          can.createCourse(actorOf(me)) ? (
            <Link href="/admin/cours/nouveau" className={btn.primary}>
              <Plus className="size-4" aria-hidden /> New course
            </Link>
          ) : undefined
        }
      />

      {courses.length === 0 ? (
        <EmptyState>{ids ? "You aren't assigned to any course yet." : "No courses yet. Create the first one!"}</EmptyState>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={BookOpen} label="Courses" value={courses.length} />
            <Stat icon={Eye} label="Published" value={courses.filter((c) => c.isPublished).length} />
            <Stat icon={Users} label="Active learners" value={sum(enr)} />
            <Stat icon={ClipboardCheck} label="Challenges to grade" value={sum(pend)} href={sum(pend) ? "/admin/corrections" : undefined} highlight={sum(pend) > 0} />
          </div>

          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <nav aria-label="Filter courses" className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
              {FILTERS.map((f) => {
                const n = courses.filter((c) => matches(c, f.id)).length;
                const active = f.id === filter;
                return (
                  <Link
                    key={f.id}
                    href={href(f.id)}
                    aria-current={active ? "page" : undefined}
                    className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold whitespace-nowrap transition", active ? "bg-card text-brand-deep shadow-sm" : "text-muted-foreground hover:text-brand-deep")}
                  >
                    {f.label}
                    <span className={cn("rounded-full px-1.5 text-xs", active ? "bg-brand-soft text-primary" : "bg-background/60")}>{n}</span>
                  </Link>
                );
              })}
            </nav>
            <form action="/admin/cours" className="relative w-full sm:w-64">
              {filter !== "all" && <input type="hidden" name="filtre" value={filter} />}
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Search a course or programme"
                aria-label="Search courses"
                className="h-10 w-full rounded-xl border border-input bg-card pr-3 pl-9 text-sm outline-none focus:border-primary focus:ring-3 focus:ring-ring/30"
              />
            </form>
          </div>

          {shown.length === 0 ? (
            <EmptyState>
              No course matches{q ? <> « {q} »</> : " this filter"}.{" "}
              <Link href="/admin/cours" className="font-semibold text-primary hover:underline">
                Show all courses
              </Link>
            </EmptyState>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {shown.map((c) => {
                const id = String(c._id);
                return (
                  <CourseCard
                    key={id}
                    course={c}
                    modules={mods.get(id) ?? 0}
                    units={units.get(id) ?? 0}
                    learners={enr.get(id) ?? 0}
                    pending={pend.get(id) ?? 0}
                    team={(c.instructors ?? []).map((i) => staffName.get(String(i)) ?? "").filter(Boolean)}
                  />
                );
              })}
            </ul>
          )}
        </>
      )}
    </>
  );
}

function Stat({ icon: Icon, label, value, href, highlight }: { icon: LucideIcon; label: string; value: number; href?: string; highlight?: boolean }) {
  const body = (
    <>
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", highlight ? "bg-xp/20 text-[#7a4d00]" : "bg-brand-soft text-primary")}>
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl leading-none font-extrabold text-brand-deep tabular-nums">{value}</span>
        <span className="mt-1 block text-xs leading-tight font-medium text-muted-foreground">{label}</span>
      </span>
    </>
  );
  const cls = "flex items-center gap-3 rounded-2xl border border-border bg-card p-4";
  return href ? (
    <Link href={href} className={cn(cls, "transition hover:border-primary/40 hover:shadow-sm")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function CourseCard({ course: c, modules, units, learners, pending, team }: { course: CourseDoc; modules: number; units: number; learners: number; pending: number; team: string[] }) {
  const id = String(c._id);
  const program = findProgram(c.program);
  const Icon = program ? ICONS[program.icon] : BookOpen;
  const initials = (n: string) =>
    n
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  return (
    <li className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-0.5 hover:shadow-md focus-within:ring-3 focus-within:ring-ring/30">
      <div className="relative aspect-[16/7] overflow-hidden bg-[radial-gradient(circle_at_85%_15%,rgb(255_255_255/0.18),transparent_45%),linear-gradient(135deg,var(--color-primary),var(--color-brand-deep))]">
        {c.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.imageUrl} alt="" loading="lazy" className="size-full object-cover" />
        ) : program ? (
          <Photo name={program.photo} alt="" sizes="(max-width: 767px) 100vw, 400px" />
        ) : (
          <span className="absolute -right-4 -bottom-6 text-white/15">
            <Icon className="size-36" strokeWidth={1.5} aria-hidden />
          </span>
        )}
        {(c.imageUrl || program) && <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/55 to-transparent" />}
        <span className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shadow-sm", c.isPublished ? "bg-white text-success" : "bg-white text-[#7a4d00]")}>
            <span className={cn("size-1.5 rounded-full", c.isPublished ? "bg-success" : "bg-xp")} aria-hidden />
            {c.isPublished ? "Published" : "Draft"}
          </span>
          {c.isChallenge && (
            <span className="inline-flex items-center gap-1 rounded-full border-2 border-coral bg-white px-2 py-0.5 text-xs font-bold text-coral-dark">
              <Zap className="size-3" aria-hidden /> Challenge
            </span>
          )}
        </span>
        {pending > 0 && (
          <Link href="/admin/corrections" className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-white shadow-sm hover:brightness-110">
            <ClipboardCheck className="size-3.5" aria-hidden /> {pending} to grade
          </Link>
        )}
        <span className="absolute bottom-3 left-4 flex items-center gap-1.5 text-sm font-semibold text-white">
          <Icon className="size-4" aria-hidden />
          {program?.name ?? "No programme"}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h2 className="text-lg leading-snug font-bold text-brand-deep">
          <Link href={`/admin/cours/${id}`} className="outline-none after:absolute after:inset-0 group-hover:text-primary">
            {c.title}
          </Link>
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {LEVEL[c.level ?? ""] ?? c.level}
          {c.price != null && (
            <>
              {" · "}
              <span className="font-semibold text-brand-deep">{formatFcfa(c.price)}</span>
            </>
          )}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Metric icon={Layers} label={modules === 1 ? "module" : "modules"} value={modules} />
          <Metric icon={ListChecks} label={units === 1 ? "unit" : "units"} value={units} />
          <Metric icon={Users} label={learners === 1 ? "learner" : "learners"} value={learners} />
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-xs text-muted-foreground">
          {team.length ? (
            <span className="flex min-w-0 items-center gap-2" title={team.join(", ")}>
              <span className="flex -space-x-2">
                {team.slice(0, 3).map((n) => (
                  <span key={n} className="flex size-7 items-center justify-center rounded-full border-2 border-card bg-primary font-heading text-[10px] font-extrabold text-white">
                    {initials(n)}
                  </span>
                ))}
              </span>
              <span className="truncate">{team.length === 1 ? team[0] : `${team.length} coaches`}</span>
            </span>
          ) : (
            <span className="italic">No teaching team</span>
          )}
          {c.startDate ? (
            <span className="inline-flex shrink-0 items-center gap-1">
              <CalendarDays className="size-3.5" aria-hidden /> {fmtDate(c.startDate)}
            </span>
          ) : (
            <span className="shrink-0">Updated {fmtDate((c as { updatedAt?: Date }).updatedAt)}</span>
          )}
        </div>

        <div className="relative z-10 mt-4 flex gap-2 border-t border-border pt-3">
          <Link href={`/admin/cours/${id}/inscriptions`} className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold text-brand-deep hover:bg-brand-soft">
            <Users className="size-3.5" aria-hidden /> Enrolments
          </Link>
          <Link href={`/apprendre/${id}`} className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold text-brand-deep hover:bg-brand-soft">
            <Eye className="size-3.5" aria-hidden /> Preview
          </Link>
        </div>
      </div>
    </li>
  );
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="rounded-xl bg-muted/50 px-2 py-2">
      <span className="flex items-center justify-center gap-1 text-base font-extrabold text-brand-deep tabular-nums">
        <Icon className="size-3.5 text-primary" aria-hidden />
        {value}
      </span>
      <span className="block text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

export default function Page({ searchParams }: PageProps<"/admin/cours">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Courses searchParams={searchParams} />
    </Suspense>
  );
}
