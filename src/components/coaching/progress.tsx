import Link from "next/link";
import { AlertTriangle, BarChart3, BookmarkCheck, CalendarCheck, FileText, Languages, ListChecks, MessagesSquare, Mic, Target, Video } from "lucide-react";
import type { Viewer } from "@/lib/coaching/service";
import { coachingProgress, monthsOf, type Flag, type MemberProgress } from "@/lib/coaching/progress";
import { Avatar } from "@/components/account/avatar";
import { cn } from "cn";

/*
 * « Progress » tab (owner decision 2026-11-25): the coach sees each member's activity over a month
 * (or the whole coaching) with what needs attention, and opens the monthly report for the company;
 * a member sees their own card (« My progress »). Server component.
 */

const FLAG_LABEL: Record<Flag, string> = { inactive: "No activity for 7 days", vocab_low: "Under half the vocabulary sentences", tasks_late: "Late tasks", redo: "Challenge to redo" };
const TZ = process.env.APP_TZ || "Africa/Ouagadougou";
export const monthLabel = (key: string, locale = "en-GB") => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${key}-15T12:00:00Z`));
const ago = (iso: string | null, now: Date) => {
  if (!iso) return "No activity yet";
  const d = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? "Active today" : d === 1 ? "Active yesterday" : `Last active ${d} days ago`;
};

export async function ProgressTab({ viewer, coachingId, period: raw, member, base, reportHref }: { viewer: Viewer; coachingId: string; period?: string; member?: string; base: string; reportHref?: string }) {
  const now = new Date();
  const { coaching, role, period, members, group } = await coachingProgress(viewer, coachingId, raw, { member, now });
  const coach = role === "coach";
  const months = monthsOf(coaching, now);
  const link = (p: string) => `${base}?${new URLSearchParams({ tab: "progress", period: p, ...(member ? { member } : {}) })}`;
  const report = reportHref ? `${reportHref}?mois=${period.month ?? months[0]}` : null;
  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-brand-deep">
            <BarChart3 className="size-5 text-primary" aria-hidden /> {coach ? "Progress" : "My progress"}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{coach ? "What each person did: daily vocabulary, tasks, speaking challenges, calls with Coach Ish, live sessions attended and goals. Tasks, challenges and goals show where they stand today." : "Your activity in this coaching: daily vocabulary, tasks, challenges, sessions and goals."}</p>
        </div>
        {coach && report && (
          <Link href={report} className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-[0_4px_0_0_var(--color-brand-dark)]">
            <FileText className="size-4" aria-hidden /> Monthly report
          </Link>
        )}
      </div>

      <nav aria-label="Period" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex min-w-max gap-1.5 text-sm">
          {months.map((m, i) => (
            <li key={m}>
              <Link href={link(m)} aria-current={period.key === m ? "page" : undefined} className={cn("block rounded-full px-3 py-1.5 font-semibold", period.key === m ? "bg-brand-deep text-white" : "bg-muted text-brand-deep hover:bg-brand-soft")}>
                {i === 0 ? "This month" : monthLabel(m)}
              </Link>
            </li>
          ))}
          <li>
            <Link href={link("all")} aria-current={period.key === "all" ? "page" : undefined} className={cn("block rounded-full px-3 py-1.5 font-semibold", period.key === "all" ? "bg-brand-deep text-white" : "bg-muted text-brand-deep hover:bg-brand-soft")}>
              Whole coaching
            </Link>
          </li>
        </ul>
      </nav>

      {coach && members.length > 1 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile label="Vocabulary done" value={`${group.vocabRate}%`} hint={`${group.sentences} sentences · ${group.correctRate}% correct`} />
          <Tile label="Session attendance" value={group.sessionsHeld ? `${group.attendanceRate}%` : "—"} hint={`${group.sessionsHeld} session${group.sessionsHeld === 1 ? "" : "s"} held`} />
          <Tile label="Tasks done" value={`${group.tasksDone} / ${group.tasksTotal}`} hint={`${group.validated} challenges validated`} />
          <Tile label="Goals reached" value={`${group.goalsDone} / ${group.goalsTotal}`} hint={`${group.calls} calls with Coach Ish`} />
        </div>
      )}

      {members.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {members.map((m) => (
            <MemberCard key={m.id} m={m} coach={coach} now={now} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">No one in this coaching yet.</p>
      )}
      {coach && <p className="text-xs text-muted-foreground">Session attendance counts the people who joined the call from the app (recorded since 25 November 2026). Times in {TZ}.</p>}
    </section>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-3">
      <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="font-heading text-2xl font-extrabold text-brand-deep">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function MemberCard({ m, coach, now }: { m: MemberProgress; coach: boolean; now: Date }) {
  const rows: { icon: typeof Languages; label: string; value: string; detail?: string; bar?: number }[] = [
    { icon: Languages, label: "Daily vocabulary", value: m.vocab.expected ? `${m.vocab.written} / ${m.vocab.expected} sentences` : "No expressions in this period", detail: m.vocab.checked ? `${Math.round((m.vocab.correct / m.vocab.checked) * 100)}% correct first time · ${m.vocab.activeDays} of ${m.vocab.days} days` : undefined, bar: m.vocab.expected ? m.vocab.rate : undefined },
    { icon: BookmarkCheck, label: "Expressions in the notebook", value: `${m.notebook.saved}`, detail: m.notebook.saved ? `${m.notebook.known} known` : undefined },
    { icon: ListChecks, label: "Tasks", value: m.tasks.total ? `${m.tasks.done} / ${m.tasks.total} done` : "None assigned", detail: [m.tasks.late ? `${m.tasks.late} late` : "", m.tasks.avgScore != null ? `average ${m.tasks.avgScore}` : ""].filter(Boolean).join(" · ") || undefined, bar: m.tasks.total ? Math.round((m.tasks.done / m.tasks.total) * 100) : undefined },
    { icon: Mic, label: "Speaking challenges", value: m.challenges.sent ? `${m.challenges.validated} validated of ${m.challenges.sent} sent` : "None sent", detail: m.challenges.avgGrade != null ? `average grade ${m.challenges.avgGrade}/10` : undefined },
    { icon: MessagesSquare, label: "Calls with Coach Ish", value: `${m.calls.count}`, detail: m.calls.avgScore != null ? `average score ${m.calls.avgScore}/10` : undefined },
    { icon: Video, label: "Live sessions", value: m.sessions.held ? `${m.sessions.attended} / ${m.sessions.held} attended` : "None held", bar: m.sessions.held ? Math.round((m.sessions.attended / m.sessions.held) * 100) : undefined },
    { icon: Target, label: "Goals", value: m.goals.total ? `${m.goals.done} / ${m.goals.total} reached` : "None yet", detail: m.goals.inProgress ? `${m.goals.inProgress} in progress` : undefined },
  ];
  return (
    <article className="grid content-start gap-3 rounded-3xl border-2 border-border bg-card p-4 sm:p-5">
      <header className="flex items-center gap-3">
        <Avatar src={m.avatarUrl} name={m.firstName} className="size-11" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-brand-deep">{coach ? m.fullName : "You"}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarCheck className="size-3.5" aria-hidden /> {ago(m.lastActive, now)} · {m.messages} message{m.messages === 1 ? "" : "s"}
          </p>
        </div>
      </header>
      {coach && m.flags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {m.flags.map((f) => (
            <li key={f} className="inline-flex items-center gap-1 rounded-full border border-coral bg-white px-2 py-0.5 text-xs font-bold text-coral-dark">
              <AlertTriangle className="size-3" aria-hidden /> {FLAG_LABEL[f]}
            </li>
          ))}
        </ul>
      )}
      <ul className="grid gap-2.5">
        {rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[auto_1fr] items-start gap-x-2.5">
            <span className="mt-0.5 flex size-7 items-center justify-center rounded-lg bg-brand-soft text-primary">
              <r.icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
                <span className="font-semibold text-muted-foreground">{r.label}</span>
                <span className="font-bold text-brand-deep">{r.value}</span>
              </span>
              {r.bar != null && (
                <span className="mt-1 block h-2 overflow-hidden rounded-full bg-brand-soft">
                  <span className="block h-full rounded-full bg-gradient-to-r from-primary to-brand-deep" style={{ width: `${Math.min(100, r.bar)}%` }} />
                </span>
              )}
              {r.detail && <span className="mt-0.5 block text-xs text-muted-foreground">{r.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}
