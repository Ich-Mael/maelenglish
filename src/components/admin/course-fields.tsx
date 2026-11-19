import { PROGRAMS } from "@/lib/catalog";
import type { CourseDoc } from "@/models";
import { toEditorHtml } from "@/lib/rich-text";
import { RichTextEditor } from "./rich-text-editor";
import { Checkbox, Input, Select, formatFcfa, isoDate } from "./ui";

const LEVELS = [
  { value: "beginner", label: "Débutant" },
  { value: "intermediate", label: "Intermédiaire" },
  { value: "advanced", label: "Avancé" },
];

/**
 * Course info fields (+ access settings for admins). `wide` (full-page form): title and
 * description on the left, the other fields in a side column from xl screens.
 */
export function CourseFields({ course, settings, wide }: { course?: Partial<CourseDoc>; settings: boolean; wide?: boolean }) {
  const main = (
    <>
      <Input label="Titre" name="title" required defaultValue={course?.title ?? ""} />
      <RichTextEditor label="Description" name="description" minHeight={wide ? 320 : 180} defaultValue={toEditorHtml(course?.description, "text")} />
    </>
  );
  const side = (
    <>
      <div className={wide ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-1" : "grid gap-4 sm:grid-cols-2"}>
        <Select
          label="Programme du catalogue"
          name="program"
          defaultValue={course?.program ?? ""}
          options={[{ value: "", label: "— Aucun —" }, ...PROGRAMS.map((p) => ({ value: p.slug, label: p.name }))]}
        />
        <Select label="Niveau" name="level" defaultValue={course?.level ?? "beginner"} options={LEVELS} />
        <Input
          label="Prix (FCFA)"
          name="price"
          inputMode="numeric"
          placeholder="Ex. 30 000"
          defaultValue={course?.price != null ? formatFcfa(course.price, false) : ""}
          hint="Pour information : pas de paiement en ligne."
        />
        <Input label="Image (lien)" name="imageUrl" type="url" defaultValue={course?.imageUrl ?? ""} hint="Facultatif : sinon la photo du programme." />
        <Input label="Début de la session" name="startDate" type="date" defaultValue={isoDate(course?.startDate)} hint="Dates par défaut des nouvelles inscriptions." />
        <Input label="Fin de la session" name="endDate" type="date" defaultValue={isoDate(course?.endDate)} />
      </div>
      {settings && (
        <div className="grid gap-3 rounded-xl bg-muted/40 p-4">
          {course?._id && <Checkbox name="isPublished" label="Publié" hint="Les apprenants inscrits voient le cours." defaultChecked={!!course?.isPublished} />}
          <Checkbox name="isChallenge" label="Challenge (un module = un jour)" hint="Les jours s'ouvrent un par un, après validation du point de contrôle." defaultChecked={!!course?.isChallenge} />
          <Input label="Thème du challenge" name="themeLabel" defaultValue={course?.challenge?.themeLabel ?? ""} placeholder="Ex. Anglais des réunions" />
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
