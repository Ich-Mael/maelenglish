import Link from "next/link";
import { BarChart3, BookOpen, CalendarClock, CheckCircle2, ChevronRight, Languages, Library, ExternalLink, FileText, Flag, GraduationCap, Headphones, Link2, ListChecks, MessagesSquare, Mic, PlayCircle, Settings, Target, Users, Video } from "lucide-react";
import type { Viewer } from "@/lib/coaching/service";
import { assignOptions, loadSpace, loadSubmissions, loadThread, type Space } from "@/lib/coaching/queries";
import { coachingAssessmentPath, coachingSessionPath, coachingTaskPath } from "@/lib/coaching/paths";
import { assessmentsFor } from "@/lib/coaching/assessment";
import { User } from "@/models";
import { Avatar } from "@/components/account/avatar";
import { RichText } from "@/components/learn/rich-text";
import { VoiceNote } from "@/components/learn/voice-note";
import { Composer, DeleteItem, GoalStatus, MarkRead } from "./controls";
import { VocabDay } from "./vocab-day";
import { ProgressTab } from "./progress";
import { dayProgress, pastVocab, reviewState, savedItems, sentencesOn, todayVocab } from "@/lib/coaching/vocabulary";
import { AttendanceForm, NextStepCheck, PrepareForm, WeeklyEmailToggle } from "./session-forms";
import { GoalForm, MembersEditor, ResourceForm, ReviewForm, SessionForm, SessionStatusButtons, SessionSummaryForm, SettingsForm, TaskForm } from "./coach-forms";
import { cn } from "cn";

/*
 * The coaching space (owner decisions 2026-11-24): the same screen for the people coached
 * (/mon-coaching/[id]) and the coach (/admin/coaching/[id], editable, with a member filter for groups).
 * Tabs: Overview, Goals, Daily vocabulary, Tasks, Sessions, Learning space, Progress, Feedback (+ Settings for the coach).
 */

export const TABS = ["overview", "goals", "vocabulary", "tasks", "sessions", "library", "progress", "feedback", "settings"] as const;
export type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { overview: "Overview", vocabulary: "Daily vocabulary", goals: "Goals", feedback: "Feedback", tasks: "Tasks", sessions: "Sessions", library: "Learning space", progress: "Progress", settings: "Settings" };
const TAB_ICON = { overview: Flag, vocabulary: Languages, goals: Target, feedback: MessagesSquare, tasks: ListChecks, sessions: Video, library: Library, progress: BarChart3, settings: Settings };
const TASK_LABEL: Record<string, string> = { lab: "Practice", challenge: "Speaking challenge", roleplay: "Talk with Coach Ish", course: "Course" };
const TASK_ICON = { lab: PlayCircle, challenge: Mic, roleplay: MessagesSquare, course: BookOpen };

const card = "rounded-3xl border-2 border-border bg-card p-4 sm:p-5";

type Props = { viewer: Viewer; coachingId: string; base: string; tab: string; member?: string; thread?: string; period?: string; /** The coach's monthly report page (admin). */ reportHref?: string };

function href(base: string, p: Record<string, string | undefined>) {
  const q = new URLSearchParams(Object.entries(p).filter((e): e is [string, string] => !!e[1]));
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

export async function CoachingSpace({ viewer, coachingId, base, tab: rawTab, member: rawMember, thread, period, reportHref }: Props) {
  const s = await loadSpace(viewer, coachingId, { member: rawMember });
  const coach = s.role === "coach";
  const tabs = TABS.filter((t) => t !== "settings" || coach);
  const wanted = rawTab === "resources" ? "library" : rawTab; // older links
  const tab = (tabs as readonly string[]).includes(wanted) ? (wanted as Tab) : "overview";
  const group = s.members.length > 1;
  const link = (p: Record<string, string | undefined>) => href(base, { tab, member: s.member || undefined, ...p });
  const forName = (id: string) => (id ? (s.members.find((m) => m.id === id)?.firstName ?? "") : "");

  return (
    <div className="grid gap-5">
      <Hero s={s} coach={coach} />

      {coach && group && (
        <nav aria-label="Show" className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-muted-foreground">Show:</span>
          <Link href={href(base, { tab })} className={cn("rounded-full px-3 py-1.5 font-semibold", !s.member ? "bg-brand-deep text-white" : "bg-muted text-brand-deep hover:bg-brand-soft")}>
            Everyone
          </Link>
          {s.members.map((m) => (
            <Link key={m.id} href={href(base, { tab, member: m.id })} className={cn("rounded-full px-3 py-1.5 font-semibold", s.member === m.id ? "bg-brand-deep text-white" : "bg-muted text-brand-deep hover:bg-brand-soft")}>
              {m.fullName}
            </Link>
          ))}
        </nav>
      )}

      <nav aria-label="Coaching sections" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex min-w-max gap-1 rounded-2xl bg-muted p-1">
          {tabs.map((t) => {
            const Icon = TAB_ICON[t];
            return (
              <li key={t}>
                <Link href={link({ tab: t === "overview" ? undefined : t, thread: undefined })} aria-current={tab === t ? "page" : undefined} className={cn("flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition", tab === t ? "bg-white text-brand-deep shadow-sm" : "text-muted-foreground hover:text-brand-deep")}>
                  <Icon className="size-4" aria-hidden /> {t === "progress" && !coach ? "My progress" : TAB_LABEL[t]}
                  {t === "feedback" && s.unread > 0 && <span className="rounded-full border-2 border-coral bg-white px-1.5 text-xs font-bold text-coral-dark">{s.unread}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {tab === "overview" && <Overview s={s} coach={coach} base={base} viewerId={viewer.id} today={await todayProgress(s, viewer)} test={coach ? null : await pendingAssessment(viewer, coachingId)} />}
      {tab === "goals" && <Goals s={s} coach={coach} forName={forName} />}
      {tab === "feedback" && <Feedback s={s} viewer={viewer} coach={coach} thread={thread} link={link} />}
      {tab === "vocabulary" && <DailyVocab s={s} viewer={viewer} coach={coach} />}
      {tab === "library" && <LearningSpace s={s} viewer={viewer} coach={coach} forName={forName} />}
      {tab === "tasks" && <Tasks s={s} viewer={viewer} coach={coach} forName={forName} />}
      {tab === "sessions" && <Sessions s={s} coach={coach} forName={forName} />}
      {tab === "progress" && <ProgressTab viewer={viewer} coachingId={coachingId} period={period} member={s.member || undefined} base={base} reportHref={coach ? reportHref : undefined} />}
      {tab === "settings" && coach && <SettingsTab s={s} viewer={viewer} />}
    </div>
  );
}

function Hero({ s, coach }: { s: Space; coach: boolean }) {
  const c = s.coaching;
  return (
    <header className="relative isolate overflow-clip rounded-3xl bg-gradient-to-br from-brand-deep via-brand-dark to-primary p-5 text-white sm:p-7">
      <div className="pointer-events-none absolute -top-24 -right-24 -z-10 size-72 rounded-full bg-[radial-gradient(circle,rgba(255,87,87,0.35),transparent_70%)]" aria-hidden />
      <p className="flex items-center gap-2 text-xs font-bold tracking-wide text-white/80 uppercase">
        <GraduationCap className="size-4" aria-hidden /> MaelEnglish Coaching · {c.kind === "group" ? "Group" : "One-on-one"}
        {c.status !== "active" && <span className="rounded-full bg-white/15 px-2 py-0.5 normal-case">{c.status === "paused" ? "Paused" : "Completed"}</span>}
      </p>
      <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">{c.title}</h1>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        {s.coach && (
          <span className="flex items-center gap-2.5">
            <Avatar src={s.coach.avatarUrl} name={s.coach.firstName} className="size-11 ring-2 ring-white" />
            <span className="leading-tight">
              <span className="block text-xs text-white/75">Coach</span>
              <span className="font-bold">{coach ? s.coach.fullName : s.coach.label}</span>
            </span>
          </span>
        )}
        <span className="flex items-center gap-2.5">
          <span className="flex -space-x-2">
            {s.members.slice(0, 6).map((m) => (
              <Avatar key={m.id} src={m.avatarUrl} name={m.firstName} className="size-9 text-sm ring-2 ring-brand-deep" />
            ))}
          </span>
          <span className="text-sm leading-tight">
            <span className="block text-xs text-white/75">{s.members.length > 1 ? `${s.members.length} people` : "Coached"}</span>
            <span className="font-semibold">{s.members.map((m) => (coach ? m.fullName : m.firstName)).join(", ")}</span>
          </span>
        </span>
      </div>
    </header>
  );
}

function SectionTitle({ icon: Icon, children, aside }: { icon: typeof Flag; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-lg font-extrabold text-brand-deep">
        <Icon className="size-5 text-primary" aria-hidden /> {children}
      </h2>
      {aside}
    </div>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="rounded-2xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">{children}</p>;
const ForTag = ({ name }: { name: string }) => (name ? <span className="rounded-full bg-coral-soft px-2 py-0.5 text-[11px] font-bold text-coral-dark">Only {name}</span> : null);

/** Today's expressions for the Overview card (made on the first visit of the day). */
async function todayProgress(s: Space, viewer: Viewer) {
  const vocab = await todayVocab(viewer, String(s.coaching._id)).catch(() => null);
  if (!vocab) return null;
  const sentences = await sentencesOn([vocab._id]);
  const mine = dayProgress(vocab, sentences, viewer.id);
  const writers = new Set(sentences.map((x) => x.userId)).size;
  return { items: vocab.items.map((i) => i.text), done: mine.done, total: mine.total, count: sentences.length, writers };
}

/** A member's assessment still to take (the end one first), for the Overview. */
async function pendingAssessment(viewer: Viewer, coachingId: string) {
  const t = await assessmentsFor(viewer, coachingId).catch(() => null);
  if (!t) return null;
  for (const ph of ["end", "start"] as const) {
    const a = t[ph];
    if (a.assessment && !a.rows[0]?.submitted) return { phase: ph, answered: a.rows[0]?.answers.length ?? 0, total: a.assessment.prompts.length };
  }
  return null;
}

function Overview({ s, coach, base, viewerId, today, test }: { s: Space; coach: boolean; base: string; viewerId: string; today: Awaited<ReturnType<typeof todayProgress>>; test: Awaited<ReturnType<typeof pendingAssessment>> }) {
  const id = String(s.coaching._id);
  const next = s.sessions.find((x) => x.upcoming);
  const done = s.goals.filter((g) => g.status === "done").length;
  const pct = s.goals.length ? Math.round((done / s.goals.length) * 100) : 0;
  // Learner: their open tasks. Coach: tasks someone still has to do.
  const todo = s.tasks.filter((t) => (coach ? Object.values(t.states).some((x) => !x.done) : !t.states[viewerId]?.done));
  const finished = s.tasks.length - todo.length;
  // Learner: next steps from earlier sessions not ticked yet (newest session first).
  const steps = coach ? [] : [...s.sessions].reverse().filter((x) => x.status === "done").flatMap((x) => x.nextSteps.filter((n) => !n.done).map((n) => ({ ...n, sessionId: x.id, when: x.when })));
  return (
    <div className="grid gap-5">
      {test && (
        <Link href={coachingAssessmentPath(id, test.phase)} className="group flex flex-wrap items-center gap-4 rounded-3xl border-2 border-coral bg-white p-4 shadow-[0_4px_0_0_var(--color-coral)] transition hover:bg-coral-soft sm:p-5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-coral bg-white text-coral">
            <Mic className="size-6" aria-hidden />
          </span>
          <span className="grid min-w-0 flex-1 gap-0.5">
            <span className="font-heading text-lg font-extrabold text-brand-deep">{test.phase === "start" ? "Your start speaking assessment" : "Your end speaking assessment"}</span>
            <span className="text-sm text-muted-foreground">{test.answered ? `${test.answered} / ${test.total} answered: finish and send it to your coach.` : `${test.total} questions to answer out loud, about 5 minutes.`}</span>
          </span>
          <ChevronRight className="size-6 text-coral" aria-hidden />
        </Link>
      )}
      {steps.length > 0 && (
        <section className={cn(card, "grid gap-2 border-primary/30")}>
          <SectionTitle icon={ListChecks} aside={<span className="text-sm font-semibold text-muted-foreground">{steps.length} to do</span>}>
            Your next steps
          </SectionTitle>
          <p className="text-sm text-muted-foreground">From your last sessions with your coach: tick them off once done.</p>
          <div className="grid gap-0.5">
            {steps.slice(0, 8).map((n) => (
              <NextStepCheck key={`${n.sessionId}-${n.id}`} sessionId={n.sessionId} id={n.id} text={n.text} done={false} />
            ))}
          </div>
        </section>
      )}
      {today && (
        <Link href={`${base}?tab=vocabulary`} className="group flex flex-wrap items-center gap-4 rounded-3xl border-2 border-primary/30 bg-gradient-to-r from-brand-soft to-white p-4 transition hover:border-primary/60 sm:p-5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-brand-deep text-white">
            <Languages className="size-6" aria-hidden />
          </span>
          <span className="grid min-w-0 flex-1 gap-0.5">
            <span className="text-[11px] font-bold tracking-wide text-coral-dark uppercase">Today&apos;s vocabulary for your goal</span>
            <span lang="en" className="font-bold break-words text-brand-deep group-hover:text-primary">
              {today.items.join(" · ")}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">{coach ? `${today.count} sentence${today.count === 1 ? "" : "s"} by ${today.writers} ${today.writers === 1 ? "person" : "people"}` : today.done >= today.total ? "All your sentences are written. Read the others'!" : `${today.done} / ${today.total} sentences written`}</span>
          </span>
          {!coach && (
            <span className="h-2.5 w-full overflow-hidden rounded-full bg-white ring-1 ring-primary/20 sm:w-40">
              <span className="block h-full rounded-full bg-gradient-to-r from-primary to-brand-deep" style={{ width: `${Math.round((today.done / Math.max(1, today.total)) * 100)}%` }} />
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-xl border-2 border-coral bg-white px-3 py-2 text-sm font-bold text-coral-dark group-hover:bg-coral-soft">
            {coach ? "See" : today.done >= today.total ? "Read" : "Write"} <ChevronRight className="size-4" aria-hidden />
          </span>
        </Link>
      )}
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <section className={cn(card, "grid content-start gap-4")}>
          <SectionTitle icon={Flag}>The goal</SectionTitle>
          {s.coaching.goal ? <RichText lang="fr" className="text-[17px]">{s.coaching.goal}</RichText> : <p className="text-sm text-muted-foreground">{coach ? "Describe the goal in Settings." : "Your coach will write your goal here."}</p>}
          {s.goals.length ? (
            <div className="grid gap-3 rounded-2xl bg-brand-soft/50 p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-white">
                  <span className="block h-full rounded-full bg-gradient-to-r from-primary to-brand-deep" style={{ width: `${pct}%` }} />
                </span>
                <span className="shrink-0 text-sm font-bold text-brand-deep">
                  {done} / {s.goals.length} reached
                </span>
              </div>
              <ul className="grid gap-1.5">
                {s.goals.slice(0, 4).map((g) => (
                  <li key={g.id} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className={cn("mt-0.5 size-4 shrink-0", g.status === "done" ? "text-primary" : g.status === "in_progress" ? "text-primary/50" : "text-border")} aria-hidden />
                    <span lang="fr" className={cn("font-semibold", g.status === "done" ? "text-muted-foreground line-through" : "text-brand-deep")}>
                      {g.title}
                    </span>
                  </li>
                ))}
              </ul>
              <Link href={`${base}?tab=goals`} className="w-fit text-sm font-semibold text-primary hover:underline">
                {s.goals.length > 4 ? `All ${s.goals.length} goals` : "See the goals"}
              </Link>
            </div>
          ) : (
            <p className="rounded-2xl border-2 border-dashed border-border p-3 text-sm text-muted-foreground">{coach ? "No step-by-step goals yet: add them in the Goals tab." : "Your coach will break this goal into small steps."}</p>
          )}
        </section>

        {next ? (
          <section className="relative isolate grid content-start gap-3 overflow-clip rounded-3xl bg-gradient-to-br from-brand-deep to-primary p-5 text-white">
            <div className="pointer-events-none absolute -right-16 -bottom-16 -z-10 size-48 rounded-full bg-[radial-gradient(circle,rgba(255,87,87,0.35),transparent_70%)]" aria-hidden />
            <p className="flex items-center gap-2 text-xs font-bold tracking-wide text-white/80 uppercase">
              <CalendarClock className="size-4" aria-hidden /> Next live session
            </p>
            <p className="font-heading text-2xl font-extrabold">{next.when}</p>
            <p className="text-sm text-white/85">
              {next.durationMin} min{next.title ? ` · ${next.title}` : ""}
            </p>
            <SessionPlan agenda={next.agenda} prep={next.prep} tone="dark" />
            <a href={coachingSessionPath(id, next.id)} className="mt-1 inline-flex h-12 w-fit items-center gap-2 rounded-2xl border-2 border-coral bg-white px-5 text-[19px] font-bold text-coral shadow-[0_4px_0_0_var(--color-coral)] hover:bg-coral-soft">
              <Video className="size-5" aria-hidden /> Join the session
            </a>
            <p className="text-xs text-white/70">The room opens 10 minutes before the start.</p>
          </section>
        ) : (
          <section className={cn(card, "grid content-start gap-2")}>
            <SectionTitle icon={CalendarClock}>Next live session</SectionTitle>
            <p className="text-sm text-muted-foreground">{coach ? "No session scheduled: plan one in the Sessions tab." : "No session scheduled yet. Your coach will plan the next one."}</p>
          </section>
        )}
      </div>

      <section className="grid gap-3">
        <SectionTitle
          icon={ListChecks}
          aside={
            <Link href={`${base}?tab=tasks`} className="text-sm font-semibold text-primary hover:underline">
              All tasks{s.tasks.length ? ` (${finished} / ${s.tasks.length} done)` : ""}
            </Link>
          }
        >
          To do
        </SectionTitle>
        {todo.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {todo.slice(0, 6).map((t) => {
              const Icon = TASK_ICON[t.kind as keyof typeof TASK_ICON] ?? ListChecks;
              const mine = t.states[viewerId];
              const waiting = Object.values(t.states).filter((x) => !x.done).length;
              const href = coach ? `${base}?tab=tasks` : t.kind === "course" ? `/apprendre/${t.courseId}` : coachingTaskPath(id, t.id);
              const redo = mine?.label === "To redo";
              return (
                <li key={t.id}>
                  <Link href={href} className="group flex h-full items-center gap-3 rounded-3xl border-2 border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[0_12px_24px_-16px_rgb(20_31_77/0.4)] motion-reduce:transition-none">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-brand-deep text-white">
                      <Icon className="size-6" aria-hidden />
                    </span>
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="text-[11px] font-bold tracking-wide text-coral-dark uppercase">{TASK_LABEL[t.kind]}</span>
                      <span className="font-bold break-words text-brand-deep group-hover:text-primary">{t.title}</span>
                      <span className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                        {t.due && <span className={cn("rounded-full px-2 py-0.5", t.late ? "border border-coral bg-coral-soft text-coral-dark" : "bg-muted text-muted-foreground")}>{t.late ? "Late · " : "Due "}{t.due}</span>}
                        {coach ? (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{s.members.length > 1 ? `${waiting} still to do` : (Object.values(t.states)[0]?.label ?? "To do")}</span>
                        ) : (
                          <span className={cn("rounded-full px-2 py-0.5", redo ? "border border-coral bg-coral-soft text-coral-dark" : "bg-brand-soft text-primary")}>{mine?.label ?? "To do"}</span>
                        )}
                      </span>
                    </span>
                    <span className={cn("hidden shrink-0 items-center gap-1 rounded-xl border-2 border-coral bg-white px-3 py-2 text-sm font-bold text-coral-dark group-hover:bg-coral-soft sm:inline-flex", coach && "border-border text-brand-deep group-hover:bg-brand-soft")}>
                      {coach ? "Follow" : redo ? "Redo" : "Start"} <ChevronRight className="size-4" aria-hidden />
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground sm:hidden" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-3xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">{s.tasks.length ? "Everything is done. Well done! 🎉" : coach ? "No task yet: assign content in the Tasks tab." : "Nothing to do yet. Your coach will give you activities here."}</p>
        )}
      </section>
      {!coach && <WeeklyEmailToggle coachingId={id} on={!(s.coaching.weeklyOff ?? []).some((x) => String(x) === viewerId)} />}
    </div>
  );
}

function Goals({ s, coach, forName }: { s: Space; coach: boolean; forName: (id: string) => string }) {
  const id = String(s.coaching._id);
  const members = s.members.map((m) => ({ id: m.id, fullName: m.fullName }));
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <section className="grid content-start gap-3">
        <SectionTitle icon={Target}>Goals</SectionTitle>
        {s.goals.length ? (
          <ol className="grid gap-3">
            {s.goals.map((g, i) => (
              <li key={g.id} className={cn(card, "grid gap-2", g.status === "done" && "border-primary/30 bg-brand-soft/40")}>
                <div className="flex items-start gap-3">
                  <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full font-heading font-extrabold", g.status === "done" ? "bg-primary text-white" : "bg-brand-soft text-primary")}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p lang="fr" className="font-bold text-brand-deep">
                      {g.title} <ForTag name={forName(g.forUserId)} />
                    </p>
                    {g.details && (
                      <p lang="fr" className="mt-0.5 text-sm text-muted-foreground">
                        {g.details}
                      </p>
                    )}
                    {g.targetDate && <p className="mt-1 text-xs font-semibold text-muted-foreground">Target: {g.targetDate}</p>}
                  </div>
                  {coach && <DeleteItem kind="goal" coachingId={id} id={g.id} label="Delete the goal" />}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <GoalStatus coachingId={id} goalId={g.id} status={g.status} />
                  {coach && !g.forUserId && s.members.length > 1 && (
                    <span className="flex flex-wrap gap-1.5 text-xs">
                      {s.members.map((m) => {
                        const st = g.memberStatus[m.id] ?? "todo";
                        return (
                          <span key={m.id} className={cn("rounded-full px-2 py-0.5 font-semibold", st === "done" ? "bg-primary text-white" : st === "in_progress" ? "bg-brand-soft text-primary" : "bg-muted text-muted-foreground")} title={`${m.fullName}: ${st.replace("_", " ")}`}>
                            {m.firstName}
                          </span>
                        );
                      })}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <Empty>{coach ? "Add the first goal: small, concrete steps towards the big objective." : "Your coach will set your goals here."}</Empty>
        )}
      </section>
      {coach && (
        <section className={cn(card, "grid content-start gap-3")}>
          <SectionTitle icon={Target}>New goal</SectionTitle>
          <GoalForm coachingId={id} members={members} member={s.member} />
        </section>
      )}
    </div>
  );
}

async function Feedback({ s, viewer, coach, thread: rawThread, link }: { s: Space; viewer: Viewer; coach: boolean; thread?: string; link: (p: Record<string, string | undefined>) => string }) {
  const id = String(s.coaching._id);
  const group = s.members.length > 1;
  // Threads: individual = one; group = shared + private (the coach: one private thread per member).
  let thread = "";
  if (group) {
    if (coach) thread = rawThread && s.members.some((m) => m.id === rawThread) ? rawThread : rawThread === "group" ? "" : s.member;
    else thread = rawThread === "me" ? viewer.id : "";
  }
  const entries = await loadThread(viewer, s.coaching, s.role, thread);
  const authors = await User.find({ _id: { $in: [...new Set(entries.map((e) => e.authorId))] } }).select("name surname coachName avatarUrl").lean();
  const who = (uid: string) => {
    const u = authors.find((a) => String(a._id) === uid);
    if (!u) return { name: "—", avatar: null as string | null, isCoach: false };
    const isCoach = uid === String(s.coaching.coachId);
    return { name: isCoach && !coach ? (s.coach?.label ?? u.name) : coach ? `${u.name} ${u.surname ?? ""}`.trim() : u.name, avatar: u.avatarUrl ?? null, isCoach };
  };
  const threads = group ? (coach ? [{ key: "group", label: "Group thread", on: !thread }, ...s.members.map((m) => ({ key: m.id, label: `Private · ${m.firstName}`, on: thread === m.id }))] : [{ key: "", label: "Group", on: !thread }, { key: "me", label: "Private with my coach", on: !!thread }]) : [];
  const unread = entries.filter((e) => e.unread).length;

  return (
    <section className="mx-auto grid w-full max-w-3xl gap-4">
      <MarkRead coachingId={id} unread={unread} />
      <SectionTitle icon={MessagesSquare}>Feedback</SectionTitle>
      {threads.length > 0 && (
        <nav aria-label="Threads" className="flex flex-wrap gap-2">
          {threads.map((t) => (
            <Link key={t.key || "group"} href={link({ tab: "feedback", thread: t.key || undefined })} aria-current={t.on ? "page" : undefined} className={cn("rounded-full px-3 py-1.5 text-sm font-semibold", t.on ? "bg-brand-deep text-white" : "bg-muted text-brand-deep hover:bg-brand-soft")}>
              {t.label}
            </Link>
          ))}
        </nav>
      )}
      {thread && group && <p className="text-sm text-muted-foreground">{coach ? "Only this person and you see this thread." : "Only you and your coach see this thread."}</p>}
      {entries.length ? (
        <ol className="grid gap-3">
          {entries.map((e) => {
            const a = who(e.authorId);
            const mine = e.authorId === viewer.id;
            return (
              <li key={e.id} className={cn("flex gap-2.5", mine && "flex-row-reverse")}>
                <Avatar src={a.avatar} name={a.name} className="mt-1 size-9 text-sm" />
                <div className={cn("grid max-w-[85%] min-w-0 gap-2 rounded-2xl p-3 sm:p-4", e.kind === "session_summary" ? "border-2 border-primary/30 bg-brand-soft/60" : e.kind === "feedback" ? "border-2 border-coral/40 bg-white" : mine ? "bg-primary/10" : "bg-muted")}>
                  <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <span className="font-bold text-brand-deep">{a.name}</span>
                    {e.kind === "feedback" && <span className="rounded-full bg-coral-soft px-2 py-0.5 text-[11px] font-bold text-coral-dark">Feedback</span>}
                    {e.kind === "session_summary" && <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-primary">Session summary</span>}
                    <span>{e.when}</span>
                    {(mine || coach) && <DeleteItem kind="entry" coachingId={id} id={e.id} label="Delete the message" />}
                  </p>
                  {e.audioUrl && <VoiceNote src={e.audioUrl} seed={e.id} durationS={e.audioS} coachName={a.name} coachAvatar={a.avatar} />}
                  {e.text && <RichText lang="fr" className="text-[15px]">{e.text}</RichText>}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <Empty>{coach ? "No message yet. Write the first feedback." : "No message yet. Ask your coach a question, or tell them how it's going."}</Empty>
      )}
      <Composer coachingId={id} thread={coach ? thread : thread ? viewer.id : ""} coach={coach} placeholder={coach ? "Your feedback…" : "Write to your coach…"} />
    </section>
  );
}

async function DailyVocab({ s, viewer, coach }: { s: Space; viewer: Viewer; coach: boolean }) {
  const id = String(s.coaching._id);
  const vocab = await todayVocab(viewer, id).catch(() => null);
  const sentences = vocab ? await sentencesOn([vocab._id]) : [];
  const mine = dayProgress(vocab, sentences, viewer.id);
  const [saved, review] = coach ? [[], null] : await Promise.all([savedItems(viewer.id, vocab ? [vocab] : []), reviewState(viewer.id, id)]);
  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionTitle icon={Languages}>Daily vocabulary</SectionTitle>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{coach ? "3 words or expressions a day, chosen for this coaching's goal. Each person writes 2 sentences of their own per expression; everyone reads the group's sentences. Earlier days move to the Learning space." : "3 expressions a day for your goal. Write 2 sentences of your own with each one: they are corrected at once and shared with the group. Read the others' sentences too!"}</p>
        </div>
        {vocab && !coach && (
          <div className="grid w-full gap-1 sm:w-56">
            <p className="flex justify-between text-sm font-bold text-brand-deep">
              <span>Today</span>
              <span>
                {mine.done} / {mine.total}
              </span>
            </p>
            <span className="h-2.5 overflow-hidden rounded-full bg-brand-soft">
              <span className="block h-full rounded-full bg-gradient-to-r from-primary to-brand-deep" style={{ width: `${Math.round((mine.done / Math.max(1, mine.total)) * 100)}%` }} />
            </span>
          </div>
        )}
      </div>
      {review && review.due > 0 && <ReviewCard {...review} />}
      {vocab ? (
        <VocabDay vocab={vocab} sentences={sentences} viewerId={viewer.id} coach={coach} coachingId={id} saved={saved} />
      ) : (
        <Empty>{s.coaching.status !== "active" ? "This coaching is paused or completed: no new expressions." : "Today's expressions aren't ready. Come back in a moment."}</Empty>
      )}
      {review && !review.due && <ReviewCard {...review} />}
    </section>
  );
}

/** The member's coaching expressions in their notebook: tested with spaced review in The Vocabulary I Need. */
function ReviewCard({ saved, due }: { saved: number; due: number }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-3xl border-2 border-primary/25 bg-brand-soft/50 p-4">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white text-primary">
        <GraduationCap className="size-6" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-brand-deep">{due ? `${due} coaching expression${due > 1 ? "s" : ""} to review today` : saved ? `${saved} coaching expression${saved > 1 ? "s" : ""} in your notebook` : "Keep the expressions you learn"}</p>
        <p className="text-sm text-muted-foreground">{saved ? "They come back in your vocabulary tests: the next day, then after 3, 7, 14 and 30 days." : "Each expression you write a sentence with goes into your notebook and comes back in your vocabulary tests."}</p>
      </div>
      {due > 0 ? (
        <Link href="/vocabulaire/test" className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-[0_4px_0_0_var(--color-brand-dark)]">
          Test my words <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : saved > 0 ? (
        <Link href="/carnet" className="inline-flex h-11 items-center gap-2 rounded-xl border-2 border-border bg-white px-4 text-sm font-bold text-brand-deep hover:border-primary/40">
          My notebook <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

async function LearningSpace({ s, viewer, coach, forName }: { s: Space; viewer: Viewer; coach: boolean; forName: (id: string) => string }) {
  const id = String(s.coaching._id);
  const days = await pastVocab(viewer, id);
  const sentences = days.length ? await sentencesOn(days.map((d) => d._id)) : [];
  const saved = coach ? [] : await savedItems(viewer.id, days);
  const total = days.reduce((n, d) => n + d.items.length, 0);
  const fmt = (day: string) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
  return (
    <div className="grid gap-8">
      <section className="grid gap-3">
        <SectionTitle icon={Languages} aside={total ? <span className="text-sm font-semibold text-muted-foreground">{total} expressions</span> : null}>
          Vocabulary of earlier days
        </SectionTitle>
        {days.length ? (
          <div className="grid gap-3">
            {days.map((d, i) => {
              const p = dayProgress(d, sentences, viewer.id);
              const count = sentences.filter((x) => x.vocabId === String(d._id)).length;
              return (
                <details key={String(d._id)} open={i === 0} className="group rounded-3xl border-2 border-border bg-card">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4">
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold tracking-wide text-muted-foreground uppercase">{fmt(d.day)}</span>
                      <span lang="en" className="font-bold break-words text-brand-deep">
                        {d.items.map((it) => it.text).join(" · ")}
                      </span>
                    </span>
                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", !coach && p.done >= p.total ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>{coach ? `${count} sentences` : `${p.done} / ${p.total} written`}</span>
                    <ChevronRight className="size-5 text-muted-foreground transition group-open:rotate-90" aria-hidden />
                  </summary>
                  <div className="border-t border-border p-4">
                    <VocabDay vocab={d} sentences={sentences} viewerId={viewer.id} coach={coach} coachingId={id} saved={saved} />
                  </div>
                </details>
              );
            })}
          </div>
        ) : (
          <Empty>The expressions of each day come here the next day, with everyone&apos;s sentences.</Empty>
        )}
      </section>
      <Resources s={s} coach={coach} forName={forName} />
    </div>
  );
}

function Resources({ s, coach, forName }: { s: Space; coach: boolean; forName: (id: string) => string }) {
  const id = String(s.coaching._id);
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <section className="grid content-start gap-3">
        <SectionTitle icon={FileText}>Resources</SectionTitle>
        {s.resources.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {s.resources.map((r) => {
              const Icon = r.kind === "file" ? FileText : r.kind === "video" ? PlayCircle : Link2;
              return (
                <li key={r.id} className={cn(card, "grid content-start gap-2")}>
                  <div className="flex items-start gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-primary">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p lang="fr" className="font-bold break-words text-brand-deep">
                        {r.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.kind === "file" ? (r.mime === "application/pdf" ? "PDF" : "Picture") : r.kind === "video" ? "Video" : "Link"} · {r.added} <ForTag name={forName(r.forUserId)} />
                      </p>
                    </div>
                    {coach && <DeleteItem kind="resource" coachingId={id} id={r.id} label="Delete the resource" />}
                  </div>
                  {r.note && (
                    <p lang="fr" className="text-sm text-muted-foreground">
                      {r.note}
                    </p>
                  )}
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1.5 text-sm font-bold text-primary hover:underline">
                      {r.kind === "file" ? "Open the file" : "Open"} <ExternalLink className="size-4" aria-hidden />
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">File unavailable.</p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>{coach ? "Add documents, links or videos for this coaching." : "Your coach will share documents and links here."}</Empty>
        )}
      </section>
      {coach && (
        <section className={cn(card, "grid content-start gap-3")}>
          <SectionTitle icon={FileText}>Add a resource</SectionTitle>
          <ResourceForm coachingId={id} members={s.members.map((m) => ({ id: m.id, fullName: m.fullName }))} member={s.member} />
        </section>
      )}
    </div>
  );
}

async function Tasks({ s, viewer, coach, forName }: { s: Space; viewer: Viewer; coach: boolean; forName: (id: string) => string }) {
  const id = String(s.coaching._id);
  const subs = await loadSubmissions(viewer, s.coaching, s.role);
  const waiting = coach ? subs.filter((x) => x.status === "pending" && (!s.member || x.userId === s.member)) : [];
  const options = coach ? await assignOptions() : null;
  const name = (uid: string) => s.members.find((m) => m.id === uid)?.fullName ?? "";
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="grid content-start gap-4">
        {waiting.length > 0 && (
          <section className={cn(card, "grid gap-3 border-coral/50")}>
            <SectionTitle icon={Headphones}>Waiting for your feedback ({waiting.length})</SectionTitle>
            {waiting.map((w) => (
              <div key={w.id} className="grid gap-3 rounded-2xl bg-muted/60 p-3">
                <p className="text-sm font-semibold text-brand-deep">
                  {name(w.userId)} · {s.tasks.find((t) => t.id === w.taskId)?.title} · send {w.sends} · {w.submitted}
                </p>
                {w.recordingUrl && <audio src={w.recordingUrl} controls preload="none" className="h-10 w-full" />}
                <ReviewForm submissionId={w.id} />
              </div>
            ))}
          </section>
        )}
        <section className="grid content-start gap-3">
          <SectionTitle icon={ListChecks}>Tasks</SectionTitle>
          {s.tasks.length ? (
            <ul className="grid gap-3">
              {s.tasks.map((t) => {
                const Icon = TASK_ICON[t.kind as keyof typeof TASK_ICON] ?? ListChecks;
                const mine = t.states[viewer.id];
                const open = t.kind === "course" ? `/apprendre/${t.courseId}` : coachingTaskPath(id, t.id);
                const entries = Object.entries(t.states);
                return (
                  <li key={t.id} className={cn(card, "grid gap-3", !coach && mine?.done && "border-primary/30 bg-brand-soft/40")}>
                    <div className="flex items-start gap-3">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-brand-deep text-white">
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold tracking-wide text-coral-dark uppercase">{TASK_LABEL[t.kind]}</p>
                        <p className="font-bold break-words text-brand-deep">
                          {t.title} <ForTag name={forName(t.forUserId)} />
                        </p>
                        {t.note && (
                          <p lang="fr" className="mt-0.5 text-sm text-muted-foreground">
                            {t.note}
                          </p>
                        )}
                        {t.due && <p className={cn("mt-1 text-xs font-bold", t.late && !mine?.done ? "text-coral-dark" : "text-muted-foreground")}>Due {t.due}</p>}
                      </div>
                      {coach && <DeleteItem kind="task" coachingId={id} id={t.id} label="Remove the task" />}
                    </div>
                    {coach ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {entries.map(([uid, st]) => (
                          <span key={uid} className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", st.done ? "bg-primary text-white" : st.label === "To redo" ? "border border-coral bg-coral-soft text-coral-dark" : "bg-muted text-muted-foreground")}>
                            {s.members.length > 1 ? `${s.members.find((m) => m.id === uid)?.firstName ?? ""}: ` : ""}
                            {st.label}
                          </span>
                        ))}
                        <Link href={open} className="ml-auto text-sm font-semibold text-primary hover:underline">
                          {t.kind === "course" ? "See the course" : "Try it"}
                        </Link>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", mine?.done ? "bg-primary text-white" : mine?.label === "To redo" ? "border border-coral bg-coral-soft text-coral-dark" : "bg-muted text-muted-foreground")}>{mine?.label ?? "To do"}</span>
                        <Link href={open} className="ml-auto inline-flex h-10 items-center gap-2 rounded-xl border-2 border-coral bg-white px-4 font-bold text-coral-dark hover:bg-coral-soft">
                          {mine?.done ? "Open again" : "Start"}
                        </Link>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty>{coach ? "Assign Lab activities, speaking challenges, role-plays or a course." : "Your coach will give you activities here."}</Empty>
          )}
        </section>
      </div>
      {coach && options && (
        <section className={cn(card, "grid content-start gap-3")}>
          <SectionTitle icon={ListChecks}>Assign</SectionTitle>
          <TaskForm coachingId={id} members={s.members.map((m) => ({ id: m.id, fullName: m.fullName }))} options={options} member={s.member} />
        </section>
      )}
    </div>
  );
}

/** A session's agenda and what to prepare (both sides). */
function SessionPlan({ agenda, prep, tone = "light" }: { agenda: string; prep: string; tone?: "light" | "dark" }) {
  if (!agenda && !prep) return null;
  const dark = tone === "dark";
  return (
    <div className={cn("grid w-full gap-3 rounded-2xl p-3 sm:grid-cols-2", dark ? "bg-white/10" : "bg-brand-soft/40")}>
      {agenda && (
        <div>
          <p className={cn("text-xs font-bold tracking-wide uppercase", dark ? "text-white/75" : "text-primary")}>Agenda</p>
          <ul lang="fr" className="mt-1 grid list-disc gap-0.5 pl-5 text-sm">
            {agenda.split("\n").filter(Boolean).map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      )}
      {prep && (
        <div>
          <p className={cn("text-xs font-bold tracking-wide uppercase", dark ? "text-white/75" : "text-coral-dark")}>To prepare</p>
          <p lang="fr" className="mt-1 text-sm whitespace-pre-line">
            {prep}
          </p>
        </div>
      )}
    </div>
  );
}

function Sessions({ s, coach, forName }: { s: Space; coach: boolean; forName: (id: string) => string }) {
  const id = String(s.coaching._id);
  const people = (forUserId: string) => s.members.filter((m) => !forUserId || m.id === forUserId).map((m) => ({ id: m.id, name: m.fullName }));
  const upcoming = s.sessions.filter((x) => x.upcoming);
  const past = s.sessions.filter((x) => !upcoming.includes(x)).reverse();
  const planned = s.coaching.sessionsPlanned;
  const done = s.sessions.filter((x) => x.status === "done").length;
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="grid content-start gap-4">
        <SectionTitle icon={Video} aside={planned ? <span className="text-sm font-semibold text-muted-foreground">{done} / {planned} sessions done</span> : null}>
          Upcoming sessions
        </SectionTitle>
        {upcoming.length ? (
          <ul className="grid gap-3">
            {upcoming.map((x) => (
              <li key={x.id} className={cn(card, "flex flex-wrap items-center gap-3 border-primary/40")}>
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-brand-deep text-white">
                  <Video className="size-6" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-brand-deep">{x.when}</p>
                  <p className="text-sm text-muted-foreground">
                    {x.durationMin} min{x.title ? ` · ${x.title}` : ""} <ForTag name={forName(x.forUserId)} />
                  </p>
                </div>
                <a href={coachingSessionPath(id, x.id)} className="inline-flex h-11 items-center gap-2 rounded-2xl border-2 border-coral bg-white px-4 font-bold text-coral-dark shadow-[0_3px_0_0_var(--color-coral)] hover:bg-coral-soft">
                  Session room
                </a>
                <SessionPlan agenda={x.agenda} prep={x.prep} />
                {coach && (
                  <div className="grid w-full gap-2">
                    <details className="group rounded-2xl border border-border">
                      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-sm font-semibold text-primary">
                        <ChevronRight className="size-4 transition group-open:rotate-90" aria-hidden /> {x.agenda || x.prep ? "Edit the agenda and preparation" : "Prepare the session: agenda and what to prepare"}
                      </summary>
                      <div className="border-t border-border p-3">
                        <PrepareForm sessionId={x.id} agenda={x.agenda} prep={x.prep} />
                      </div>
                    </details>
                    {x.started && x.attendance && <AttendanceForm sessionId={x.id} people={people(x.forUserId)} present={x.attendance.present} confirmed={x.attendance.confirmed} />}
                    <SessionStatusButtons sessionId={x.id} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>{coach ? "Schedule the next session: everyone concerned gets an email and a reminder." : "No session scheduled. Your coach will plan the next one."}</Empty>
        )}
        {past.length > 0 && (
          <>
            <SectionTitle icon={CalendarClock}>Past sessions</SectionTitle>
            <ul className="grid gap-3">
              {past.map((x) => (
                <li key={x.id} className={cn(card, "grid gap-2")}>
                  <p className="flex flex-wrap items-center gap-2 font-bold text-brand-deep">
                    {x.when}
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", x.status === "done" ? "bg-brand-soft text-primary" : x.status === "cancelled" ? "bg-muted text-muted-foreground" : "bg-coral-soft text-coral-dark")}>{x.status === "scheduled" ? "To close" : x.status === "done" ? "Done" : x.status === "cancelled" ? "Cancelled" : "Missed"}</span>
                    <ForTag name={forName(x.forUserId)} />
                  </p>
                  {x.attendance && x.status !== "cancelled" && x.attendance.absent.length > 0 && (
                    <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-coral-dark">
                      Absent: {x.attendance.absent.map((a) => forName(a) || "—").join(", ")}
                      {!x.attendance.confirmed && <span className="font-normal text-muted-foreground">(not confirmed yet)</span>}
                    </p>
                  )}
                  {x.summary && <RichText lang="fr" className="text-sm">{x.summary}</RichText>}
                  {x.nextSteps.length > 0 && (
                    <div className="grid gap-1 rounded-2xl bg-brand-soft/40 p-3">
                      <p className="text-xs font-bold tracking-wide text-primary uppercase">Next steps</p>
                      {coach ? (
                        <ul className="grid gap-1 text-sm">
                          {x.nextSteps.map((n) => (
                            <li key={n.id} className="flex items-start justify-between gap-2">
                              <span lang="fr">{n.text}</span>
                              <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                                {n.doneBy.length} / {(x.attendance?.present.length ?? 0) + (x.attendance?.absent.length ?? 0)} done
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        x.nextSteps.map((n) => <NextStepCheck key={n.id} sessionId={x.id} id={n.id} text={n.text} done={n.done} />)
                      )}
                    </div>
                  )}
                  {coach && x.status !== "cancelled" && x.attendance && <AttendanceForm sessionId={x.id} people={people(x.forUserId)} present={x.attendance.present} confirmed={x.attendance.confirmed} />}
                  {coach && x.status !== "cancelled" && <SessionSummaryForm sessionId={x.id} summary={x.summary} nextSteps={x.nextSteps.map((n) => n.text)} />}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {coach && (
        <section className={cn(card, "grid content-start gap-3")}>
          <SectionTitle icon={CalendarClock}>Schedule a session</SectionTitle>
          <SessionForm coachingId={id} members={s.members.map((m) => ({ id: m.id, fullName: m.fullName }))} member={s.member} />
          <p className="text-xs text-muted-foreground">The video room opens 10 minutes before. Reminders are emailed the day before and 1 hour before.</p>
        </section>
      )}
    </div>
  );
}

async function SettingsTab({ s, viewer }: { s: Space; viewer: Viewer }) {
  const c = s.coaching;
  const manager = ["admin", "super-admin", "account-manager"].includes(viewer.role);
  const coaches = manager ? await User.find({ role: { $in: ["english-coach", "instructor", "admin", "super-admin"] }, isActive: { $ne: false } }).select("name surname coachName").sort({ name: 1 }).lean() : [];
  const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <section className={cn(card, "grid content-start gap-3")}>
        <SectionTitle icon={Settings}>Settings</SectionTitle>
        <SettingsForm
          manager={manager}
          coaches={coaches.map((u) => ({ value: String(u._id), label: `${u.name} ${u.surname ?? ""}`.trim() + (u.coachName ? ` (${u.coachName})` : "") }))}
          c={{ id: String(c._id), title: c.title, goal: c.goal ?? "", startDate: day(c.startDate), endDate: day(c.endDate), sessionsPlanned: c.sessionsPlanned != null ? String(c.sessionsPlanned) : "", meetingUrl: c.meetingUrl ?? "", status: c.status, coachId: String(c.coachId) }}
        />
      </section>
      <section className={cn(card, "grid content-start gap-3")}>
        <SectionTitle icon={Users}>People coached</SectionTitle>
        <p className="text-sm text-muted-foreground">Add people to turn it into a group coaching. Members see each other&apos;s first names only.</p>
        <MembersEditor coachingId={String(c._id)} members={s.members.map((m) => ({ id: m.id, fullName: m.fullName }))} />
      </section>
    </div>
  );
}
