import { PROGRAMS } from "@/lib/catalog";
import type { CourseDoc } from "@/models";
import { toEditorHtml } from "@/lib/rich-text";
import { RichTextEditor } from "./rich-text-editor";
import { Checkbox, Input, Select, formatFcfa, isoDate } from "./ui";

const LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

/**
 * Course info fields (+ access settings for admins). `wide` (full-page form): title and
 * description on the left, the other fields in a side column from xl screens.
 */
export function CourseFields({ course, settings, wide }: { course?: Partial<CourseDoc>; settings: boolean; wide?: boolean }) {
  const main = (
    <>
      <Input label="Title" name="title" required defaultValue={course?.title ?? ""} />
      <RichTextEditor label="Description" name="description" minHeight={wide ? 320 : 180} defaultValue={toEditorHtml(course?.description, "text")} />
    </>
  );
  const side = (
    <>
      <div className={wide ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-1" : "grid gap-4 sm:grid-cols-2"}>
        <Select
          label="Catalogue programme"
          name="program"
          defaultValue={course?.program ?? ""}
          options={[{ value: "", label: "— None —" }, ...PROGRAMS.map((p) => ({ value: p.slug, label: p.name }))]}
        />
        <Select label="Level" name="level" defaultValue={course?.level ?? "beginner"} options={LEVELS} />
        <Input
          label="Price (FCFA)"
          name="price"
          inputMode="numeric"
          placeholder="E.g. 30,000"
          defaultValue={course?.price != null ? formatFcfa(course.price, false) : ""}
          hint="Sale price in the learners' Shop (published courses). Empty = not sold online."
        />
        <Input label="Image (link)" name="imageUrl" type="url" defaultValue={course?.imageUrl ?? ""} hint="Optional: otherwise the programme photo." />
        <Input label="Session start" name="startDate" type="date" defaultValue={isoDate(course?.startDate)} hint="Default dates for new enrolments." />
        <Input label="Session end" name="endDate" type="date" defaultValue={isoDate(course?.endDate)} />
      </div>
      {settings && (
        <div className="grid gap-3 rounded-xl bg-muted/40 p-4">
          {course?._id && <Checkbox name="isPublished" label="Published" hint="Enrolled learners can see the course." defaultChecked={!!course?.isPublished} />}
          <Checkbox name="isChallenge" label="Challenge (one module = one day)" hint="Days open one by one, after the checkpoint is validated." defaultChecked={!!course?.isChallenge} />
          <Input label="Challenge theme" name="themeLabel" defaultValue={course?.challenge?.themeLabel ?? ""} placeholder="E.g. Anglais des réunions" />
        </div>
      )}
    </>
  );
  if (!wide)
    return (
      <>
        {main}
        {side}
      </>
    );
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] xl:gap-8">
      <div className="grid gap-4">{main}</div>
      <div className="grid gap-4">{side}</div>
    </div>
  );
}
