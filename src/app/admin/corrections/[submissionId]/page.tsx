import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Types } from "mongoose";
import { requireStaff, courseFor } from "@/lib/admin/context";
import { AssignmentSubmission, Module, Unit, User, type AssignmentSubmissionDoc } from "@/models";
import { reviewMediaUrl } from "@/lib/media";
import { Card, PageHeader, Pill, fmtDate } from "@/components/admin/ui";
import { GradeForm } from "@/components/admin/grade-form";
import { RichText } from "@/components/learn/rich-text";
import { toEditorHtml } from "@/lib/rich-text";
import { PageSkeleton } from "@/components/learn/ui";

export const metadata: Metadata = { title: "Correction" };

async function Grade({ params }: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await params;
  await connection();
  const me = await requireStaff(`/admin/corrections/${submissionId}`);
  if (!Types.ObjectId.isValid(submissionId)) notFound();
  const sub = await AssignmentSubmission.findById(submissionId).lean<AssignmentSubmissionDoc>();
  if (!sub) notFound();
  const course = await courseFor(me, String(sub.courseId), "grade");
  if (!course) notFound();
  const isAudio = sub.assignmentType === "unit_challenge";
  const [user, mod, unit, audio] = await Promise.all([
    User.findById(sub.userId).select("name surname username").lean(),
    sub.moduleId ? Module.findById(sub.moduleId).select("title assignment").lean() : null,
    sub.unitId ? Unit.findById(sub.unitId).select("title challenge").lean() : null,
    isAudio && sub.mediaId ? reviewMediaUrl(String(sub.mediaId)).catch(() => null) : null,
  ]);
  const def = isAudio ? { title: unit?.challenge?.title || "Défi oral", instructions: unit?.challenge?.instructions ?? "" } : mod ? mod.assignment : course.finalProject;
  const isCheckpoint = !!course.isChallenge && !!mod && !isAudio;
  const isLink = sub.submissionType === "link";

  return (
    <div className="grid max-w-5xl gap-5">
      <PageHeader
        title={user ? `${user.name} ${user.surname}` : "Apprenant"}
        back={{ href: "/admin/corrections", label: "Corrections" }}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {course.title} · {mod?.title ?? "Projet final"}
            {unit && ` · ${unit.title} · Défi oral`}
            <Pill tone={sub.status === "graded" ? "green" : sub.status === "returned" ? "amber" : "blue"}>{sub.status === "graded" ? "Validé" : sub.status === "returned" ? "Renvoyé" : "À corriger"}</Pill>
          </span>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="grid content-start gap-5">
          <Card title="Réponse de l'apprenant" description={`Envoyée le ${fmtDate(sub.updatedAt)}`}>
            {isAudio ? (
              audio ? (
                <div className="grid gap-1">
                  <audio src={audio} controls preload="metadata" className="w-full" />
                  {sub.durationS ? <p className="text-xs text-muted-foreground">Durée : {Math.round(sub.durationS)} s</p> : null}
                </div>
              ) : (
                <p className="text-sm text-coral-dark">Enregistrement indisponible (stockage non configuré ou fichier manquant).</p>
              )
            ) : isLink ? (
              <a href={sub.content} target="_blank" rel="noopener noreferrer" className="font-semibold break-all text-primary underline">
                {sub.content}
              </a>
            ) : (
              <p lang="en" className="whitespace-pre-line text-ink">{sub.content}</p>
            )}
          </Card>
          <Card title={def?.title || "Consignes"}>
            <RichText>{def?.instructions}</RichText>
          </Card>
        </div>
        <Card title="Correction">
          <GradeForm submissionId={submissionId} maxScore={sub.maxScore ?? 100} isCheckpoint={isCheckpoint} initial={{ grade: sub.grade ?? null, feedback: toEditorHtml(sub.feedback, "text") }} />
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
