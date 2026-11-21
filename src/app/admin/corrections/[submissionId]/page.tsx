import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Types } from "mongoose";
import { actorOf, requireStaff } from "@/lib/admin/context";
import { can } from "@/lib/admin/permissions";
import { Activity, ChallengeSubmission, Course, Module, Unit, User, type ActivityDoc, type ChallengeSubmissionDoc, type CourseDoc } from "@/models";
import type { SpeakingChallengeContent } from "@/lib/lab/types";
import { reviewMediaUrl } from "@/lib/media";
import { Card, PageHeader, Pill, fmtDate } from "@/components/admin/ui";
import { GradeForm } from "@/components/admin/grade-form";
import { RichText } from "@/components/learn/rich-text";
import { toEditorHtml } from "@/lib/rich-text";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Grading" };

async function Grade({ params }: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await params;
  await connection();
  const me = await requireStaff(`/admin/corrections/${submissionId}`);
  if (!Types.ObjectId.isValid(submissionId)) notFound();
  const sub = await ChallengeSubmission.findById(submissionId).lean<ChallengeSubmissionDoc>();
  if (!sub) notFound();
  // The course team, or the learner's main coach.
  const [course, owner] = await Promise.all([Course.findById(sub.courseId).lean<CourseDoc>(), User.findById(sub.userId).select("coachId").lean()]);
  if (!course || !can.gradeSubmission(actorOf(me), course, owner?.coachId)) notFound();
  const [user, mod, unit, audio, challenge, voiceNote] = await Promise.all([
    User.findById(sub.userId).select("name surname username").lean(),
    Module.findById(sub.moduleId).select("title").lean(),
    Unit.findById(sub.unitId).select("title").lean(),
    sub.mediaId ? reviewMediaUrl(String(sub.mediaId)).catch(() => null) : null,
    // The challenge answered (kept on the submission even if the unit's challenge changed since).
    sub.activityId ? Activity.findById(sub.activityId).lean<ActivityDoc>() : null,
    sub.feedbackAudioMediaId ? reviewMediaUrl(String(sub.feedbackAudioMediaId)).catch(() => null) : null,
  ]);
  const c = challenge?.content as SpeakingChallengeContent | undefined;

  return (
    <div className="grid max-w-5xl gap-5">
      <PageHeader
        title={user ? `${user.name} ${user.surname}` : "Learner"}
        back={{ href: "/admin/corrections", label: "Grading" }}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {course.title} · {mod?.title ?? "Module"}
            {unit && ` · ${unit.title} · Speaking challenge`}
            <Pill tone={sub.status === "graded" ? "green" : sub.status === "returned" ? "amber" : "blue"}>{sub.status === "graded" ? "Validated" : sub.status === "returned" ? "Returned" : "To grade"}</Pill>
          </span>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="grid content-start gap-5">
          <Card title="Learner's answer" description={`Sent on ${fmtDate(sub.submittedAt ?? sub.updatedAt)}`}>
            {audio ? (
              <div className="grid gap-1">
                <audio src={audio} controls preload="metadata" className="w-full" />
                {sub.durationS ? <p className="text-xs text-muted-foreground">Duration: {Math.round(sub.durationS)} s</p> : null}
              </div>
            ) : (
              <p className="text-sm text-coral-dark">Recording unavailable (storage not configured or file missing).</p>
            )}
          </Card>
          <Card title={challenge?.title || "Speaking challenge"}>
            <RichText>{c?.instructions ?? ""}</RichText>
            {(c?.mustInclude ?? []).length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-semibold text-brand-deep">The learner should include</p>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {c!.mustInclude.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
            {c?.modelAnswerText && (
              <div className="mt-3">
                <p className="text-sm font-semibold text-brand-deep">Model answer</p>
                <p lang="en" className="mt-1 text-sm whitespace-pre-line text-ink">
                  {c.modelAnswerText}
                </p>
              </div>
            )}
          </Card>
        </div>
        <Card title="Feedback">
          <GradeForm submissionId={submissionId} maxScore={sub.maxScore ?? 100} isCheckpoint={!!course.isChallenge} initial={{ grade: sub.grade ?? null, feedback: toEditorHtml(sub.feedback, "text"), audioId: sub.feedbackAudioMediaId ? String(sub.feedbackAudioMediaId) : "", audioUrl: voiceNote }} />
        </Card>
      </div>
    </div>
  );
}

export default function Page({ params }: PageProps<"/admin/corrections/[submissionId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Grade params={params} />
    </Suspense>
  );
}
