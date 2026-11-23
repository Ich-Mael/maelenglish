import { Input, Select } from "@/components/admin/ui";
import { CEFR_LEVELS, SKILLS, THEMES } from "@/lib/lab/meta";

/** Common details of a Lab activity (admin form): level, skills, theme, minutes, instruction, Coach Ish's tip. */
export function MetaFields({ a }: { a: { level?: string | null; skills?: string[] | null; theme?: string | null; durationMin?: number | null; instructions?: string | null; maelTip?: string | null } }) {
  const skills = new Set(a.skills ?? []);
  return (
    <fieldset className="grid gap-4 rounded-2xl border border-border p-4">
      <legend className="px-1 font-heading font-extrabold text-brand-deep">Details</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        <Select label="CEFR level" name="level" defaultValue={a.level ?? ""} options={[{ value: "", label: "—" }, ...CEFR_LEVELS.map((l) => ({ value: l, label: l }))]} />
        <Select label="Business theme" name="theme" defaultValue={a.theme ?? ""} options={[{ value: "", label: "—" }, ...THEMES.map((t) => ({ value: t.value, label: t.en }))]} />
        <Input label="Duration (min)" name="durationMin" type="number" min={0} max={60} defaultValue={a.durationMin || ""} placeholder="E.g. 5" />
      </div>
      <div className="grid gap-1 text-sm">
        <span className="font-medium">Skills</span>
        <div className="flex flex-wrap gap-2">
          {SKILLS.map((s) => (
            <label key={s.value} className="flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1.5 has-checked:border-primary has-checked:bg-brand-soft">
              <input type="checkbox" name="skills" value={s.value} defaultChecked={skills.has(s.value)} className="size-4 accent-primary" /> {s.en}
            </label>
          ))}
        </div>
      </div>
      <Input label="Instruction (French, for learners)" name="instructions" defaultValue={a.instructions ?? ""} maxLength={300} placeholder="E.g. Écoutez l'appel du fournisseur et répondez aux questions." hint="One line, shown at the top of the exercise." />
      <Input label="Le conseil de Coach Ish (French, optional)" name="maelTip" defaultValue={a.maelTip ?? ""} maxLength={600} placeholder="E.g. Au téléphone, « I'm afraid… » adoucit une mauvaise nouvelle." hint="Coach Ish's personal tip, shown on the results screen." />
    </fieldset>
  );
}
