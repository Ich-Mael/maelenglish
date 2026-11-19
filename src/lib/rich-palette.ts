/*
 * Colours offered by the rich-text editor (text colour + highlight). Shared by the editor
 * (client) and the sanitiser (server): only these exact values survive a save.
 * Text colours keep ≥ 4.5:1 contrast on white; highlights keep dark text readable.
 */
export const TEXT_COLORS = [
  { hex: "#364fab", name: "Bleu" },
  { hex: "#141f4d", name: "Bleu nuit" },
  { hex: "#b02a2a", name: "Rouge" },
  { hex: "#12855a", name: "Vert" },
] as const;

export const HIGHLIGHT_COLORS = [
  { hex: "#fff3b0", name: "Jaune" },
  { hex: "#ffe0e0", name: "Rose" },
  { hex: "#dfe5fb", name: "Bleu clair" },
  { hex: "#dcf3e8", name: "Vert clair" },
] as const;

/** HugeRTE `color_map` format: ["364fab", "Bleu", …]. */
export const colorMap = (colors: readonly { hex: string; name: string }[]) => colors.flatMap((c) => [c.hex.slice(1), c.name]);
