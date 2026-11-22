import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Types } from "mongoose";
import { actorOf, requireStaff } from "@/lib/admin/context";
import { can } from "@/lib/admin/permissions";
import { Activity, Course, Unit, User, WritingSubmission, type ActivityDoc, type CourseDoc, type WritingSubmissionDoc } from "@/models";
import type { WritingTaskContent } from "@/lib/lab/types";
import type { WritingCorrection } from "@/lib/ai/types";
import { reviewMediaUrl } from "@/lib/media";
import { toEditorHtml } from "@/lib/rich-text";
import { Card, PageHeader, Pill, fmtDate } from "@/components/admin/ui";
import { AdminForm, Submit } from "@/components/admin/forms";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { RichText } from "@/components/learn/rich-text";
import { PageSkeleton } from "@/components/learn/ui";
import { CorrectionView } from "@/components/lab/writing-correction";
import { WritingFeedbackEditor } from "@/components/admin/writing-feedback-editor";
import { writingSendsLeft } from "@/lib/lab/writing";
import { reviewWritingAction } from "../../../actions";

export const metadata: Metadata = { title: "Writing review" };

async function Review({ params }: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await params;
  await connection();
  const me = await requireStaff(`/admin/corrections/ecrits/${submissionId}`);
  if (!Types.ObjectId.isValid(submissionId)) notFound();
  const sub = await WritingSubmission.findById(submissionId).lean<WritingSubmissionDoc>();
  if (!sub) notFound();
  const [course, learner] = await Promise.all([Course.findById(sub.courseId).lean<CourseDoc>(), User.findById(sub.userId).select("name surname username coachId").lean()]);
  if (!course || !can.gradeSubmission(actorOf(me), course, learner?.coachId)) notFound();
  const [activity, unit, reviewer] = await Promise.all([
    Activity.findById(sub.activityId).lean<ActivityDoc>(),
    sub.unitId ? Unit.findById(sub.unitId).select("title").lean() : null,
    sub.reviewedBy ? User.findById(sub.reviewedBy).select("name surname").lean() : null,
  ]);
  const c = activity?.content as WritingTaskContent | undefined;
  const imageUrl = c?.imageMediaId ? await reviewMediaUrl(c.imageMediaId).catch(() => null) : null;
  const correction = sub.correction as WritingCorrection | null;
  const earlier = (sub.history ?? []).slice(0, -1).reverse();

  return (
    <div className="grid max-w-6xl gap-5">
      <PageHeader
        title={learner ? `${learner.name} ${learner.surname}` : "Learner"}
        back={{ href: "/admin/corrections/ecrits", label: "Writing review" }}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {course.title}
            {unit && ` › ${unit.title}`} · {activity?.title ?? "Writing task"}
            {correction && <Pill tone="blue">AI draft {sub.aiScore}/100</Pill>}
            {sub.coachStatus === "reviewed" ? <Pill tone="grey">Reviewed{reviewer ? ` by ${reviewer.name}` : ""}{sub.reviewedAt ? ` · ${fmtDate(sub.reviewedAt)}` : ""}</Pill> : <Pill tone="amber">To review</Pill>}
          </span>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="grid content-start gap-5">
          <Card title="The learner's text" description={`${sub.wordCount} words · version ${sub.attempts || sub.tries} · sent ${sub.submittedAt ? fmtDate(sub.submittedAt) : "—"}`}>
            <p lang="en" className="leading-relaxed whitespace-pre-line text-ink">
              {sub.text}
            </p>
          </Card>
          {correction && (
            <Card title="AI correction draft" description="Prepared by Claude for you: it is edited and sent from your review (the learner never sees the raw draft).">
              <CorrectionView correction={correction} locale="en" />
            </Card>
          )}
          {earlier.length > 0 && (
            <Card title={`Earlier versions (${earlier.length})`}>
              <ul className="grid gap-2">
                {earlier.map((h, i) => (
                  <li key={i}>
                    <details className="rounded-xl border border-border px-3 py-2">
                      <summary className="cursor-pointer text-sm font-semibold text-brand-deep">
                        {h.at ? fmtDate(h.at) : "—"} · {h.wordCount} words{h.coachScore !== null && h.coachScore !== undefined ? ` · your score ${h.coachScore}/100` : " · not reviewed"}
                      </summary>
                      <p lang="en" className="mt-2 text-sm whitespace-pre-line text-ink">
                        {h.text}
                      </p>
                    </details>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <div className="grid content-start gap-5">
          <Card title={sub.coachStatus === "reviewed" ? "Your feedback (sent)" : "Your feedback"} description="Start from the AI draft: edit, delete or add corrections, set the score, add your comment, then send it. The learner sees it as your feedback.">
            <AdminForm action={reviewWritingAction}>
              <input type="hidden" name="submissionId" value={submissionId} />
              <WritingFeedbackEditor initial={(sub.coachStatus === "reviewed" ? (sub.feedback as WritingCorrection | null) : null) ?? correction} checklist={c?.checklist ?? []} />
              <RichTextEditor label="Your comment for the learner (French)" name="comment" minHeight={200} defaultValue={toEditorHtml(sub.coachComment, "text")} placeholder="Your human touch: encouragement, the one thing to work on, a tip from your experience…" />
              <label className="flex items-center gap-2 text-sm font-semibold text-brand-deep">
                <input type="checkbox" name="askNewVersion" className="size-4 accent-primary" defaultChecked={!!sub.redoAsked} /> Ask the learner for a new version
                <span className="font-normal text-muted-foreground">({writingSendsLeft(sub)} send{writingSendsLeft(sub) === 1 ? "" : "s"} left{writingSendsLeft(sub) === 0 ? ": one more will be granted" : ""})</span>
              </label>
              <div>
                <Submit>{sub.coachStatus === "reviewed" ? "Update the feedback" : "Send to the learner"}</Submit>
              </div>
            </AdminForm>
          </Card>
          <Card title={activity?.title ?? "Writing task"}>
            <RichText>{c?.prompt ?? ""}</RichText>
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
              <img src={imageUrl} alt="" className="mt-3 max-h-72 rounded-xl border border-border object-contain" />
            )}
            {(c?.checklist ?? []).length > 0 && (
              <ul className="mt-3 list-disc pl-5 text-sm">
                {c!.checklist.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            )}
            {c?.modelAnswer && (
              <div className="mt-3">
                <p className="text-sm font-semibold text-brand-deep">Model answer</p>
                <p lang="en" className="mt-1 text-sm whitespace-pre-line text-ink">
                  {c.modelAnswer}
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function Page({ params }: PageProps<"/admin/corrections/ecrits/[submissionId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Review params={params} />
    </Suspense>
  );
}
