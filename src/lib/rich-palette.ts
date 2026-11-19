/*
 * Fonts and colours offered by the rich-text editor (text colour + highlight). Shared by the editor
 * (client) and the sanitiser (server): only these exact values survive a save.
 * Fonts: Outfit and Archivo are the site's own fonts (loaded on every page); the others are
 * system fonts with a generic fallback (Android has no Georgia: it falls back to its serif font).
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

export const FONTS = [
  { name: "Outfit (par défaut)", stack: "Outfit, sans-serif" },
  { name: "Archivo (titres)", stack: "Archivo, sans-serif" },
  { name: "Arial", stack: "Arial, Helvetica, sans-serif" },
  { name: "Georgia", stack: "Georgia, serif" },
  { name: "Machine à écrire", stack: "'Courier New', Courier, monospace" },
] as const;

/** HugeRTE `font_family_formats` format: "Name=stack; …". */
export const fontFormats = () => FONTS.map((f) => `${f.name}=${f.stack}`).join("; ");

/** HugeRTE `color_map` format: ["364fab", "Bleu", …]. */
export const colorMap = (colors: readonly { hex: string; name: string }[]) => colors.flatMap((c) => [c.hex.slice(1), c.name]);
