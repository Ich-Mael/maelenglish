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

/** Stable pseudo-random order of 0…n-1 from a seed (same on the server and in the browser: no hydration mismatch); never the identity when n ≥ 2. */
export function seededOrder(n: number, seed: string): number[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const rand = () => {
    h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    return h / 4294967296;
  };
  const out = Array.from({ length: n }, (_, i) => i);
  for (let attempt = 0; attempt < 8; attempt++) {
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    if (n < 2 || out.some((x, i) => x !== i)) break;
  }
  return out;
}

/** Matching pairs: the right column, shuffled so that no card sits on the same row as its partner in `left`. */
export function partnerColumn<T>(left: readonly T[], seed: string): T[] {
  const n = left.length;
  if (n < 2) return [...left];
  for (let k = 0; k < 50; k++) {
    const order = seededOrder(n, `${seed}:${k}`);
    if (order.every((j, row) => j !== row)) return order.map((j) => left[j]);
  }
  return left.map((_, row) => left[(row + 1) % n]); // rotation: never aligned
}
