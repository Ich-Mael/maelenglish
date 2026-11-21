import { cn } from "cn";

/** Profile photo, or the first letter of the name on a blue disc. Size via `className` (default size-10). */
export function Avatar({ src, name, className }: { src?: string | null; name: string; className?: string }) {
  const base = cn("inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary font-heading font-extrabold text-white uppercase", className);
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- small redirecting URL, no image optimiser
    return <img src={src} alt="" width={160} height={160} loading="lazy" decoding="async" className={cn(base, "object-cover")} />;
  }
  return (
    <span aria-hidden className={base}>
      {name.trim().charAt(0) || "?"}
    </span>
  );
}
