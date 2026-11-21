/**
 * New random order for « Recommencer » (client only, after a click: never during render, which
 * would differ between the server HTML and hydration). Never returns the order just played when
 * there are 2 items or more.
 */
export function reshuffle<T>(items: readonly T[], current: readonly T[] = items): T[] {
  if (items.length < 2) return [...items];
  for (;;) {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    if (out.some((x, i) => x !== current[i])) return out;
  }
}
