/*
 * Course title in the brand colours (user decision 2026-11-22), like « Speak the Language of /
 * Your Profession » on the home page: the beginning in logo blue, the end in logo red —
 * « English for / Airport Managers », « MaelEnglish / Essentials ». Split after « for » when the
 * title has it, else before the last word. Red stays at heading size (contrast rule: red text
 * ≥ 19 px bold).
 */
export function splitTitle(title: string): [string, string] {
  const t = title.trim();
  const m = t.match(/^(.*?\bfor)\s+(.+)$/i);
  if (m) return [m[1], m[2]];
  const at = t.lastIndexOf(" ");
  return at > 0 ? [t.slice(0, at), t.slice(at + 1)] : [t, ""];
}

export function BrandTitle({ title, className }: { title: string; className?: string }) {
  const [start, end] = splitTitle(title);
  return (
    <span className={className}>
      <span className="text-primary">{start}</span>
      {end && (
        <>
          {" "}
          <span className="text-coral">{end}</span>
        </>
      )}
    </span>
  );
}
