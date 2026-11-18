import { PROGRAMS } from "@/lib/catalog";
import type { CourseDoc } from "@/models";
import { Checkbox, Input, Select, TextArea, isoDate } from "./ui";

const LEVELS = [
  { value: "beginner", label: "Débutant" },
  { value: "intermediate", label: "Intermédiaire" },
  { value: "advanced", label: "Avancé" },
];

/** Course info fields (+ access settings for admins). */
export function CourseFields({ course, settings }: { course?: Partial<CourseDoc>; settings: boolean }) {
  return (
    <>
      <Input label="Titre" name="title" required defaultValue={course?.title ?? ""} />
      <TextArea label="Description" name="description" rows={3} defaultValue={course?.description ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Programme du catalogue"
          name="program"
          defaultValue={course?.program ?? ""}
          options={[{ value: "", label: "— Aucun —" }, ...PROGRAMS.map((p) => ({ value: p.slug, label: p.name }))]}
        />
        <Select label="Niveau" name="level" defaultValue={course?.level ?? "beginner"} options={LEVELS} />
        <Input label="Début de la session" name="startDate" type="date" defaultValue={isoDate(course?.startDate)} hint="Dates par défaut des nouvelles inscriptions." />
        <Input label="Fin de la session" name="endDate" type="date" defaultValue={isoDate(course?.endDate)} />
      </div>
      <Input label="Image (lien)" name="imageUrl" type="url" defaultValue={course?.imageUrl ?? ""} hint="Facultatif : sinon la photo du programme est utilisée." />
      {settings && (
        <div className="grid gap-3 rounded-xl bg-muted/40 p-4">
          {course?._id && <Checkbox name="isPublished" label="Publié" hint="Les apprenants inscrits voient le cours." defaultChecked={!!course?.isPublished} />}
          <Checkbox name="isChallenge" label="Challenge (un module = un jour)" hint="Les jours s'ouvrent un par un, après validation du point de contrôle." defaultChecked={!!course?.isChallenge} />
          <Input label="Thème du challenge" name="themeLabel" defaultValue={course?.challenge?.themeLabel ?? ""} placeholder="Ex. Anglais des réunions" />
        </div>
      )}
    </>
  );
}
