/*
 * A picture behind a whole page, blurred and softened (My Courses, Story Mode episodes). One fixed
 * layer painted once — scrolling doesn't redraw it — so it stays light on low-end phones. The
 * page's root must be `relative z-10` (the layer sits just behind it). No hooks: server or client.
 */
export function PageBackdrop({ src }: { src: string }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized picture (or signed storage URL), shown blurred */}
      <img src={src} alt="" className="size-full scale-110 object-cover blur-xl" />
      <span className="absolute inset-0 bg-gradient-to-b from-white/45 via-white/60 to-brand-soft/80" />
    </div>
  );
}
